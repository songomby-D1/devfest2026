/*
 * viem loader for this CommonJS service. Under `module: node16`, viem's type
 * declarations are ESM-only (its `_types` folder is `"type": "module"`), so
 * a CommonJS file cannot `import` viem although viem ships a CommonJS build
 * (`exports.default` → `_cjs`). Types come through ESM type-only imports;
 * values come through `require`, which loads that CommonJS build.
 */
import type * as Viem from 'viem' with { 'resolution-mode': 'import' };
import type * as ViemAccounts from 'viem/accounts' with {
  'resolution-mode': 'import',
};

/* eslint-disable @typescript-eslint/no-require-imports -- see the comment above: viem's types are ESM-only under node16, its runtime is CommonJS-compatible */
export const viem = require('viem') as typeof Viem;
export const viemAccounts = require('viem/accounts') as typeof ViemAccounts;
/* eslint-enable @typescript-eslint/no-require-imports */
