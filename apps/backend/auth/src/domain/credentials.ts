import { type FieldIssue, ValidationFailedError } from './errors.js';

export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const DISPLAY_NAME_MAX_LENGTH = 60;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

export interface Registration extends Credentials {
  readonly displayName: string | null;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function normalizePassword(raw: string): string {
  return raw.normalize('NFKC');
}

/** Length in code points, so that emoji and accented letters count once. */
export function codePointLength(value: string): number {
  let length = 0;
  // Iterating a string visits code points, not UTF-16 units.
  for (const _codePoint of value) length += 1;
  return length;
}

export function emailIssue(email: string): FieldIssue | null {
  if (email.length === 0) return { field: 'email', reason: 'required' };
  if (email.length > EMAIL_MAX_LENGTH)
    return { field: 'email', reason: 'too_long' };
  if (!EMAIL_PATTERN.test(email)) return { field: 'email', reason: 'invalid' };
  return null;
}

export function passwordIssue(password: string): FieldIssue | null {
  const length = codePointLength(password);
  if (length < PASSWORD_MIN_LENGTH)
    return { field: 'password', reason: 'too_short' };
  if (length > PASSWORD_MAX_LENGTH)
    return { field: 'password', reason: 'too_long' };
  return null;
}

export function normalizeDisplayName(
  raw: string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;
  const collapsed = raw.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return collapsed.length === 0 ? null : collapsed;
}

export function parseRegistration(input: {
  readonly email: string;
  readonly password: string;
  readonly displayName?: string | null | undefined;
}): Registration {
  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);
  const displayName = normalizeDisplayName(input.displayName);
  const issues = [emailIssue(email), passwordIssue(password)].filter(
    (issue): issue is FieldIssue => issue !== null,
  );
  if (
    displayName !== null &&
    codePointLength(displayName) > DISPLAY_NAME_MAX_LENGTH
  ) {
    issues.push({ field: 'displayName', reason: 'too_long' });
  }
  if (issues.length > 0) throw new ValidationFailedError(issues);
  return { email, password, displayName };
}

/**
 * Login only rejects inputs that would make hashing expensive or that cannot be an email.
 * A short password is still verified so that every login attempt costs the same.
 */
export function parseCredentials(input: {
  readonly email: string;
  readonly password: string;
}): Credentials {
  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);
  const issues: FieldIssue[] = [];
  const emailProblem = emailIssue(email);
  if (emailProblem !== null) issues.push(emailProblem);
  if (codePointLength(password) > PASSWORD_MAX_LENGTH) {
    issues.push({ field: 'password', reason: 'too_long' });
  }
  if (issues.length > 0) throw new ValidationFailedError(issues);
  return { email, password };
}
