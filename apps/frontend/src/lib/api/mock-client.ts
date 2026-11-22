import { ApiError, type ApiClient } from './client';
import type {
  ClaimReview,
  ContentId,
  CreateItemRequest,
  ItemDetail,
  ItemSummary,
  MediaRef,
  Me,
  MintResult,
  Model3d,
  Provenance,
  ValidationIssue,
} from './contract';
import {
  fixtureItems,
  fixtureModels,
  fixtureProvenance,
  fixtureUsers,
} from './fixtures';
import { checkMediaFile, MEDIA_UPLOAD_LIMITS } from './media-limits';

export interface MockClientOptions {
  /** Simulated network latency in milliseconds. */
  latencyMs?: number;
  createId?: () => ContentId;
  /** Starts with this fixture account signed in, as if its cookie were set. */
  signedInAs?: keyof typeof fixtureUsers | undefined;
}

let requestCounter = 0;

function fail(
  status: number,
  code: string,
  message: string,
  details?: ValidationIssue[],
): ApiError {
  requestCounter += 1;
  return new ApiError(status, {
    code,
    message,
    requestId: `mock-${String(requestCounter)}`,
    ...(details === undefined ? {} : { details }),
  });
}

function notFound(): ApiError {
  return fail(404, 'NOT_FOUND', 'Cette œuvre est introuvable.');
}

function invalid(details: ValidationIssue[]): ApiError {
  return fail(400, 'VALIDATION_FAILED', 'La requête est invalide.', details);
}

const CREATE_LIMITS: Partial<Record<keyof CreateItemRequest, number>> = {
  title: 160,
  description: 8000,
  creatorName: 160,
  creatorCommunity: 160,
  technique: 160,
  origin: 160,
  period: 80,
  rightsStatement: 2000,
};

function validateCreate(body: CreateItemRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const field of ['title', 'description', 'rightsStatement'] as const) {
    if (body[field].trim() === '') {
      issues.push({ field, reason: 'must not be empty' });
    }
  }
  for (const [field, max] of Object.entries(CREATE_LIMITS)) {
    const value = body[field as keyof CreateItemRequest];
    if (typeof value === 'string' && value.trim().length > max) {
      issues.push({ field, reason: `must be at most ${String(max)} characters` });
    }
  }
  return issues;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

function toSummary(item: ItemDetail): ItemSummary {
  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    creatorName: item.creatorName,
    origin: item.origin,
    period: item.period,
    thumbnailUrl: item.thumbnailUrl,
    publicationStatus: item.publicationStatus,
    submissionStatus: item.submissionStatus,
    claims: item.claims,
    updatedAt: item.updatedAt,
  };
}

interface Entry {
  ownerId: string;
  item: ItemDetail;
}

interface Account {
  me: Omit<Me, 'sessionExpiresAt'>;
  /** Only accounts registered at runtime have one; fixture accounts accept any valid password. */
  password: string | null;
}

/**
 * In-memory implementation of the gateway contract. Each client owns a copy of
 * the fixtures and one simulated session cookie, so tests stay isolated. The
 * rules follow the Content service: visibility, ownership, reviewer-only
 * review and decisions, no self-review, D18 publication rules. A mint stays
 * `pending` on the request and is confirmed on the next provenance read.
 */
export function createMockClient(options: MockClientOptions = {}): ApiClient {
  const { latencyMs = 0, createId = () => crypto.randomUUID() } = options;
  const items = new Map<ContentId, Entry>(
    fixtureItems.map((entry) => [entry.item.id, structuredClone(entry)]),
  );
  const accounts = new Map<string, Account>(
    Object.values(fixtureUsers).map((me) => [
      me.email,
      { me: structuredClone(me) as Account['me'], password: null },
    ]),
  );
  const models = new Map<ContentId, Model3d>(
    fixtureModels.map((model) => [model.contentId, structuredClone(model)]),
  );
  const provenance = new Map<ContentId, Provenance>(
    fixtureProvenance.map((entry) => [entry.contentId, structuredClone(entry)]),
  );
  const mintsByKey = new Map<string, MintResult>();
  let sessionUserId: string | null =
    options.signedInAs === undefined
      ? null
      : fixtureUsers[options.signedInAs].userId;

  async function respond<T>(produce: () => T): Promise<T> {
    if (latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }
    return structuredClone(produce());
  }

  function currentAccount(): Account | null {
    if (sessionUserId === null) return null;
    for (const account of accounts.values()) {
      if (account.me.userId === sessionUserId) return account;
    }
    return null;
  }

  function isReviewer(): boolean {
    return currentAccount()?.me.permissions.includes('reviewer') ?? false;
  }

  function requireUser(): Account {
    const account = currentAccount();
    if (account === null) {
      throw fail(401, 'UNAUTHENTICATED', 'Connectez-vous pour continuer.');
    }
    return account;
  }

  function canView(entry: Entry): boolean {
    return (
      entry.item.publicationStatus === 'published' ||
      entry.ownerId === sessionUserId ||
      isReviewer()
    );
  }

  function findEntry(id: ContentId): Entry {
    const entry = items.get(id);
    if (!entry || !canView(entry)) throw notFound();
    return entry;
  }

  /** The item as the current caller sees it. */
  function view(entry: Entry): ItemDetail {
    const isOwner = entry.ownerId === sessionUserId;
    const { advisorySignals, ...rest } = entry.item;
    const showSignals =
      (isOwner || isReviewer()) && advisorySignals !== undefined;
    return {
      ...rest,
      isOwner,
      ...(showSignals ? { advisorySignals } : {}),
    };
  }

  function requireReviewerOf(entry: Entry, action: string): Account {
    const account = requireUser();
    if (!isReviewer()) {
      throw fail(403, 'FORBIDDEN', `Only reviewers can ${action}.`);
    }
    if (entry.ownerId === account.me.userId) {
      throw fail(
        403,
        'FORBIDDEN',
        `A reviewer cannot ${action} their own item.`,
      );
    }
    return account;
  }

  function update(entry: Entry, changes: Partial<ItemDetail>): void {
    entry.item = {
      ...entry.item,
      ...changes,
      updatedAt: new Date().toISOString(),
    };
  }

  function sessionMe(account: Account): Me {
    return {
      ...account.me,
      sessionExpiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
    };
  }

  return {
    register: (body) =>
      respond(() => {
        const email = body.email.trim().toLowerCase();
        const issues: ValidationIssue[] = [];
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          issues.push({ field: 'email', reason: 'must be a valid email' });
        }
        if (body.password.length < 12 || body.password.length > 128) {
          issues.push({
            field: 'password',
            reason: 'must be 12 to 128 characters',
          });
        }
        if (issues.length > 0) throw invalid(issues);
        if (accounts.has(email)) {
          throw fail(
            409,
            'EMAIL_ALREADY_REGISTERED',
            'This email is already registered.',
          );
        }
        const userId = createId();
        accounts.set(email, {
          me: {
            userId,
            email,
            displayName: emptyToNull(body.displayName),
            permissions: [],
          },
          password: body.password,
        });
        return { userId };
      }),
    login: (body) =>
      respond(() => {
        const account = accounts.get(body.email.trim().toLowerCase());
        const passwordOk =
          account !== undefined &&
          (account.password === null
            ? body.password.length >= 12
            : account.password === body.password);
        if (!account || !passwordOk) {
          throw fail(
            401,
            'INVALID_CREDENTIALS',
            'Email or password is incorrect.',
          );
        }
        sessionUserId = account.me.userId;
        return sessionMe(account);
      }),
    logout: () =>
      respond(() => {
        sessionUserId = null;
      }),
    me: () => respond(() => sessionMe(requireUser())),
    listItems: (query = {}) =>
      respond(() => {
        const scope = query.scope ?? 'public';
        let entries = [...items.values()];
        if (scope === 'public') {
          entries = entries.filter(
            (entry) => entry.item.publicationStatus === 'published',
          );
        } else if (scope === 'mine') {
          const account = requireUser();
          entries = entries.filter(
            (entry) => entry.ownerId === account.me.userId,
          );
        } else {
          requireUser();
          if (!isReviewer()) {
            throw fail(403, 'FORBIDDEN', 'Only reviewers can list the queue.');
          }
          entries = entries.filter(
            (entry) => entry.item.submissionStatus === 'in_review',
          );
        }
        if (query.kind !== undefined) {
          entries = entries.filter((entry) => entry.item.kind === query.kind);
        }
        const q = query.q?.trim().toLowerCase() ?? '';
        if (q !== '') {
          entries = entries.filter((entry) =>
            `${entry.item.title} ${entry.item.description}`
              .toLowerCase()
              .includes(q),
          );
        }
        const limit = query.limit ?? 20;
        const start = query.cursor === undefined ? 0 : Number(query.cursor);
        const page = entries.slice(start, start + limit);
        const next = start + limit;
        return {
          items: page.map((entry) => toSummary(entry.item)),
          nextCursor: next < entries.length ? String(next) : null,
        };
      }),
    getItem: (id) => respond(() => view(findEntry(id))),
    createItem: (body) =>
      respond(() => {
        const account = requireUser();
        const issues = validateCreate(body);
        if (issues.length > 0) throw invalid(issues);
        const now = new Date().toISOString();
        const creatorName = emptyToNull(body.creatorName);
        const item: ItemDetail = {
          id: createId(),
          title: body.title.trim(),
          kind: body.kind,
          creatorName,
          origin: emptyToNull(body.origin),
          period: emptyToNull(body.period),
          thumbnailUrl: null,
          publicationStatus: 'draft',
          submissionStatus: 'in_review',
          claims: { item: 'unreviewed', description: 'unreviewed' },
          updatedAt: now,
          description: body.description.trim(),
          creator: {
            name: creatorName,
            community: emptyToNull(body.creatorCommunity),
            technique: emptyToNull(body.technique),
          },
          rights: {
            statement: body.rightsStatement.trim(),
            confirmed: body.rightsConfirmed,
          },
          media: [],
          reviews: [],
          isOwner: true,
          createdAt: now,
          publishedAt: null,
        };
        items.set(item.id, { ownerId: account.me.userId, item });
        return item;
      }),
    uploadMedia: (id, file, uploadOptions = {}) =>
      respond(() => {
        const account = requireUser();
        const entry = findEntry(id);
        if (entry.ownerId !== account.me.userId) {
          throw fail(403, 'FORBIDDEN', 'Only the submitter can add media.');
        }
        if (entry.item.publicationStatus === 'published') {
          throw fail(409, 'CONFLICT', 'A published item cannot be changed.');
        }
        const check = checkMediaFile(file);
        if (!check.ok && check.reason === 'empty') {
          throw invalid([{ field: 'file', reason: 'must not be empty' }]);
        }
        if (!check.ok) {
          throw check.reason === 'size'
            ? fail(413, 'PAYLOAD_TOO_LARGE', 'The file is too large.')
            : fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'This file type is not accepted.');
        }
        if (entry.item.media.length >= MEDIA_UPLOAD_LIMITS.maxPerItem) {
          throw fail(
            422,
            'MEDIA_LIMIT_REACHED',
            'An item holds at most 10 media files.',
          );
        }
        uploadOptions.onProgress?.(1);
        const mediaId = createId();
        const media: MediaRef = {
          id: mediaId,
          kind: check.kind,
          mimeType: file.type,
          bytes: file.size,
          url:
            typeof URL.createObjectURL === 'function'
              ? URL.createObjectURL(file)
              : `/api/items/${id}/media/${mediaId}`,
          caption: emptyToNull(uploadOptions.caption),
        };
        const allMedia = [...entry.item.media, media];
        update(entry, {
          media: allMedia,
          thumbnailUrl:
            allMedia.find((candidate) => candidate.kind === 'image')?.url ??
            null,
        });
        return media;
      }),
    reviewItem: (id, body) =>
      respond(() => {
        const entry = findEntry(id);
        const account = requireReviewerOf(entry, 'review');
        if (body.rationale.trim() === '') {
          throw invalid([{ field: 'rationale', reason: 'must not be empty' }]);
        }
        if (entry.item.submissionStatus === 'rejected') {
          throw fail(
            409,
            'SUBMISSION_REJECTED',
            'A rejected submission cannot be changed',
          );
        }
        if (entry.item.submissionStatus !== 'in_review') {
          throw fail(
            422,
            'SUBMISSION_NOT_IN_REVIEW',
            'Only a submission in review can be reviewed',
          );
        }
        const record: ClaimReview = {
          target: body.target,
          outcome: body.outcome,
          rationale: body.rationale.trim(),
          evidence: body.evidence,
          reviewerId: account.me.userId,
          reviewedAt: new Date().toISOString(),
        };
        update(entry, {
          reviews: [
            ...entry.item.reviews.filter(
              (review) => review.target !== body.target,
            ),
            record,
          ],
          claims: { ...entry.item.claims, [body.target]: body.outcome },
        });
        return view(entry);
      }),
    decideItem: (id, body) =>
      respond(() => {
        const entry = findEntry(id);
        requireReviewerOf(entry, 'decide on');
        const { item } = entry;
        if (body.decision !== 'publish' && body.note.trim() === '') {
          throw invalid([
            { field: 'note', reason: 'must not be empty for return or reject' },
          ]);
        }
        if (body.decision === 'publish') {
          if (item.publicationStatus === 'published') return view(entry);
          if (
            item.submissionStatus !== 'in_review' &&
            item.submissionStatus !== 'accepted'
          ) {
            throw fail(
              422,
              'SUBMISSION_NOT_PUBLISHABLE',
              'Only a submission in review or already accepted can be published',
            );
          }
          if (
            item.claims.item === 'unreviewed' ||
            item.claims.description === 'unreviewed'
          ) {
            throw fail(
              422,
              'CLAIMS_UNREVIEWED',
              'Both the item claims and the description claims must be reviewed first',
            );
          }
          if (!item.rights.confirmed) {
            throw fail(
              422,
              'RIGHTS_NOT_CONFIRMED',
              'The rights must be confirmed before publication',
            );
          }
          update(entry, {
            publicationStatus: 'published',
            submissionStatus: 'accepted',
            publishedAt: new Date().toISOString(),
          });
        } else if (body.decision === 'return') {
          if (item.submissionStatus !== 'in_review') {
            throw fail(
              422,
              'SUBMISSION_NOT_IN_REVIEW',
              'Only a submission in review can be returned',
            );
          }
          update(entry, { submissionStatus: 'returned' });
        } else {
          if (item.submissionStatus === 'accepted') {
            throw fail(
              422,
              'SUBMISSION_NOT_IN_REVIEW',
              'An accepted submission cannot be rejected; unpublish it instead',
            );
          }
          update(entry, { submissionStatus: 'rejected' });
        }
        return view(entry);
      }),
    mintItem: (id, idempotencyKey) =>
      respond(() => {
        findEntry(id);
        const previous = mintsByKey.get(idempotencyKey);
        if (previous) return previous;
        const result: MintResult = { contentId: id, status: 'pending' };
        mintsByKey.set(idempotencyKey, result);
        provenance.set(id, { contentId: id, mint: 'pending' });
        return result;
      }),
    getProvenance: (id) =>
      respond(() => {
        findEntry(id);
        const entry = provenance.get(id) ?? { contentId: id, mint: null };
        if (entry.mint === 'pending') {
          entry.mint = 'confirmed';
          entry.tokenId = String(provenance.size);
        }
        return entry;
      }),
    getModel3d: (id) =>
      respond(() => {
        findEntry(id);
        return models.get(id) ?? { contentId: id, status: 'missing' as const };
      }),
  };
}
