#!/usr/bin/env node
// Creates missing local .env files from their committed examples and fills empty secrets
// with random URL-safe values. Existing files and values are never replaced, and no value is
// printed, so the command is safe to run again and in shared terminals.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Root secrets that are generated when empty. Other empty values are left for the owner. */
const GENERATED =
  /(_PASSWORD|_SECRET_KEY|_ACCESS_KEY|^SERVICE_TOKEN_.*|^GATEWAY_ADMIN_TOKEN)$/;

const targets = [
  { example: '.env.example', target: '.env', generate: true },
  // Owners' service files are copied as-is: their secrets come from their own accounts.
  {
    example: 'apps/backend/nft/.env.example',
    target: 'apps/backend/nft/.env',
    generate: false,
  },
];

function secret(name) {
  // Access keys stay short and alphanumeric like S3 keys; other secrets get 32 random bytes.
  return name.endsWith('_ACCESS_KEY')
    ? randomBytes(10).toString('hex').toUpperCase()
    : randomBytes(32).toString('base64url');
}

function fill(content) {
  let generated = 0;
  const lines = content.split('\n').map((line) => {
    const match = /^([A-Z0-9_]+)=$/.exec(line);
    if (match === null || !GENERATED.test(match[1])) return line;
    generated += 1;
    return `${match[1]}=${secret(match[1])}`;
  });
  return { text: lines.join('\n'), generated };
}

for (const { example, target, generate } of targets) {
  const examplePath = join(root, example);
  const targetPath = join(root, target);
  if (!existsSync(examplePath)) continue;
  if (existsSync(targetPath)) {
    if (generate) {
      const { text, generated } = fill(readFileSync(targetPath, 'utf8'));
      if (generated > 0) writeFileSync(targetPath, text, { mode: 0o600 });
      process.stdout.write(
        `${relative(root, targetPath)}: kept, ${String(generated)} empty secrets filled\n`,
      );
    } else {
      process.stdout.write(`${relative(root, targetPath)}: kept\n`);
    }
    continue;
  }
  const source = readFileSync(examplePath, 'utf8');
  const { text, generated } = generate
    ? fill(source)
    : { text: source, generated: 0 };
  writeFileSync(targetPath, text, { mode: 0o600 });
  process.stdout.write(
    `${relative(root, targetPath)}: created, ${String(generated)} secrets generated\n`,
  );
}
