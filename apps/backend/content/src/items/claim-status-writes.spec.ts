import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Guardrail 1 of `docs/deferred-scope.md` and MVP section B: only the
 * CONTENT-04 review route sets a claim status to `verified` or `uncertain`.
 * Edits only reset it to `unreviewed`, and no other code path (publication,
 * media, future advisory signals) writes it. This test reads the production
 * sources, so a new write elsewhere fails here and gets reviewed.
 */
const SRC = join(__dirname, '..');
const REVIEW_WRITER = 'items/prisma-item-repository.ts';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === 'generated' ? [] : sources(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
      ? [path]
      : [];
  });
}

const files = sources(SRC).map((path) => ({
  file: relative(SRC, path).split('\\').join('/'),
  lines: readFileSync(path, 'utf8').split('\n'),
}));

function occurrences(pattern: RegExp): { file: string; line: string }[] {
  return files.flatMap(({ file, lines }) =>
    lines
      .filter((line) => pattern.test(line))
      .map((line) => ({ file, line: line.trim() })),
  );
}

describe('claim status writes (CONTENT-04 invariant)', () => {
  it('scans the production sources', () => {
    expect(files.map(({ file }) => file)).toContain(REVIEW_WRITER);
    expect(files.length).toBeGreaterThan(20);
  });

  it('sets a claim status only to unreviewed, except in the review write', () => {
    const allowed = [
      /^readonly claimStatus: ClaimStatus;$/, // type declarations
      /^claimStatus: row\.(description\.)?claimStatus,$/, // reading a row
      /claimStatus: 'unreviewed'/, // D18 reset on a material edit
    ];
    // An object key, not a property read such as `item.claimStatus : ...`.
    const others = occurrences(/(?<![.\w])claimStatus\s*:/).filter(
      ({ line }) => !allowed.some((pattern) => pattern.test(line)),
    );

    // The item claim and the description claim, both in reviewClaim.
    expect(others).toEqual([
      {
        file: REVIEW_WRITER,
        line: '? { claimStatus: review.outcome, updatedAt: new Date() }',
      },
      {
        file: REVIEW_WRITER,
        line: 'description: { update: { claimStatus: review.outcome } },',
      },
    ]);
  });

  it('names the reviewed outcomes only in the domain types', () => {
    expect(
      occurrences(/'(verified|uncertain)'/).map(({ file }) => file),
    ).toEqual(['items/item.ts', 'items/item.ts']);
  });

  it('never writes the claim columns with raw SQL', () => {
    expect(occurrences(/"claimStatus"|claim_status/i)).toEqual([]);
  });
});
