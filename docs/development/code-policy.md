# Shared code quality policy

This policy applies to every contributor and to the React frontend, gateway, Auth, Content, NFT and LiDAR apps. Start with the [development workflow](workflow.md), [quality gates](quality-gates.md), [service boundaries](../architecture/services.md), and [agent workflow](../agents/workflow.md) for context.

## Principles

- [CONFIRMED] Use the same root checks for every app. Enforced through shared configuration and CI.
- [CONFIRMED] Keep the default strict and use tools for mechanical checks. Enforced through ESLint, Prettier and TypeScript.
- [CONFIRMED] Prefer the smallest toolset that covers the checks. Enforced in dependency review.
- [CONFIRMED] Preserve independent service boundaries. Enforced through import rules and contract review.

## ESLint

- [CREATED, NOT EXECUTED] [Root flat config](../../eslint.config.mjs) uses ESM, `@eslint/js` recommended and `typescript-eslint` strict type-checked with `projectService: true`. Each app needs a `tsconfig.json` that includes its linted TypeScript files, including tests and tooling files. Any future linted shared TypeScript also needs a project config. No shared config package is used.
- [CONFIRMED] Run lint from the repository root outside Docker builds. Lint requires no change to service Dockerfiles or their build contexts.
- [CREATED, NOT EXECUTED] Global ignores cover `dist`, `build`, `coverage`, `node_modules`, `generated` directories and `*.generated.*` files. ESLint reports unused disable directives as errors.
- [CREATED, NOT EXECUTED] Use errors for explicit `any`, floating and misused promises, inconsistent type imports, and unused names. The unused-name rules permit intentional `^_` names.
- [CREATED, NOT EXECUTED] Use strict equality and restrict console calls to `warn` and `error` via `eqeqeq` and `no-console`. Use the Nest logger for backend operational logs, enforced in review.
- [CREATED, NOT EXECUTED] Use `ban-ts-comment` to reject `@ts-ignore` and `@ts-nocheck`. A line using `@ts-expect-error` requires a description.
- [CREATED, NOT EXECUTED] Each app has a boundary override. `no-restricted-imports` checks static specifiers and allows only type imports from the literal `packages/shared` path and the `@devfest2026/shared` package name. `import/no-restricted-paths` uses TypeScript resolution to reject peer source paths, including relative paths and configured aliases. Review checks computed specifiers.
- [CONFIRMED] The frontend uses the gateway and backend services use HTTP contracts. Keep `packages/shared` limited to types and contracts. Review ownership and integration at the API boundary.
- [CONFIRMED] D14 allows type-only imports of shared transport declarations, including any common error type. Review actual import spellings and aliases for type-only use until lint coverage is verified. [Shared contract policy](../architecture/services.md#contracts-and-shared-package)
- [CREATED, NOT EXECUTED] `apps/frontend/**` gets browser globals, Hooks rules for call order and dependencies, and `jsx-a11y` recommended checks on JSX/TSX files.
- [CREATED, NOT EXECUTED] Each of `apps/backend/{gateway,auth,content,nft,lidar}/**` gets Node globals. For Nest legacy decorators with emitted metadata, the typed parser uses the service TS config and `consistent-type-imports` leaves decorated files alone. Review imports used as runtime DI tokens. The backend uses the same strict preset and rules.
- [CREATED, NOT EXECUTED] Only `**/*.spec.ts` and `**/*.test.{ts,tsx}` relax `unbound-method` so assertions can take spy method references. Promise and boundary rules still apply.
- [CONFIRMED] Use line-scoped ESLint suppressions with a one-line reason and a task ID for temporary exceptions. File-wide suppressions require approval from endy-rkt and PR review.
- [CREATED, NOT EXECUTED] Load `eslint-config-prettier/flat` last to turn off competing style rules. The CI command and planned root `lint` script use `eslint . --max-warnings 0`.
- [RECOMMENDED] Skip a generic security lint plugin for the MVP. Prioritize Gitleaks, dependency checks and review of input validation, authorization and logging to keep triage focused. [Security plugin scope and triage](https://github.com/eslint-community/eslint-plugin-security)

**Root devDependencies for endy-rkt-19 to pin at initial install.** `eslint`, `@eslint/js`, `typescript-eslint`, `typescript`, `globals`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-plugin-import`, `eslint-import-resolver-typescript`, `eslint-config-prettier`, `prettier`.

Upstream references: [ESLint flat config](https://eslint.org/docs/latest/use/configure/configuration-files) · [restricted imports](https://eslint.org/docs/latest/rules/no-restricted-imports) · [typed linting](https://typescript-eslint.io/getting-started/typed-linting/) · [strict preset](https://typescript-eslint.io/users/configs/#stricttypechecked) · [decorator caveat](https://typescript-eslint.io/rules/consistent-type-imports/#caveat-decorators--experimentaldecorators-true--emitdecoratormetadata-true) · [React Hooks](https://react.dev/reference/eslint-plugin-react-hooks) · [JSX accessibility](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y#shareable-configs) · [resolved import boundaries](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md) · [TypeScript resolver](https://github.com/import-js/eslint-import-resolver-typescript#configuration) · [Prettier compatibility](https://github.com/prettier/eslint-config-prettier#installation).

## Formatting

- [CREATED, NOT EXECUTED] Prettier is the single formatter. `.prettierrc.json` uses two spaces, LF, single quotes for JS/TS strings, and semicolons. `.editorconfig` aligns whitespace, UTF-8 and final newlines, and preserves intentional Markdown hard breaks. Prettier owns quote style.
- [CREATED, NOT EXECUTED] `.prettierignore` excludes generated output, dependencies, local env files and the npm lockfile.
- [IMPLEMENTED] The root `format:check` script runs `prettier --config .prettierrc.json --check .` from the root. The current CI command explicitly selects the same config. Use it in editor integrations because the preserved legacy `.prettierrc` has higher discovery precedence. [Prettier CLI](https://prettier.io/docs/cli#--find-config-path-and---config) · [Discovery order](https://github.com/prettier/prettier/blob/main/src/config/prettier-config/config-searcher.js)

## TypeScript

- [CREATED, NOT EXECUTED] Extend `tsconfig.base.json` in each app's future project configuration. The shared compiler base requires `strict`. Each app chooses its own module, JSX, decorator and output settings.
- [RECOMMENDED] Enable `noUncheckedIndexedAccess` to require callers to handle absent indexed entries. Enforced by the shared compiler base.
- [RECOMMENDED] Enable `noImplicitOverride` to catch accidental divergence from base classes. Enforced by the shared compiler base.
- [RECOMMENDED] Enable `exactOptionalPropertyTypes` to preserve the distinction between a missing field and explicit `undefined` in contracts. Enforced by the shared compiler base.
- [IMPLEMENTED] Run a TypeScript check for every affected app project in CI. TypeScript comment exceptions follow the ESLint policy above. [TypeScript compiler options](https://www.typescriptlang.org/tsconfig/)

## Code conventions

- [CONFIRMED] Write repository documentation in English and use English names for code and environment variables. Keep the README subtitle in French as the sole documentation exception. Enforced in PR review.

- [RECOMMENDED] Use PascalCase for types, classes and React components, camelCase for variables and functions, and kebab-case for folders and non-component source files. Use PascalCase filenames for component files. Enforced in review.
- [RECOMMENDED] Organize each Nest service by feature module and keep controllers, providers and DTOs with their owning module. Enforced in architecture review.
- [CONFIRMED] Validate input DTOs at the HTTP edge. Map failures to the [gateway error contract](../architecture/services.md#contracts-and-shared-package). Verify both in integration tests and review.
- [CONFIRMED] Keep secrets and personal data out of logs and public errors. Verify redaction and failure paths in review and tests.
- [CONFIRMED] Await, return or handle promises. Deliberate background work must own its failure handling. Enforced by typed lint and review.
- [RECOMMENDED] Remove dead code and attach a backlog ID to each TODO so it has an owner and context. Enforced in review.

## Environment and secrets

- [IMPLEMENTED for Auth and the gateway] Add a per-service `.env.example` with uppercase snake case names and safe placeholders. Validate env settings with a schema at startup and test rejection of invalid or missing values.
- [CONFIRMED] Keep real secrets and local env files out of commits. Use least-privilege service credentials. Review configuration and run Gitleaks as a CI backstop.

## Testing

- [RECOMMENDED] Keep unit `*.spec.ts` or `*.test.ts(x)` files near their code and integration suites under the owning app's test directory. Enforced by test discovery and review.
- [CONFIRMED] Assert observable behavior including relevant failures. Empty assertions and snapshot-only coverage of business logic do not satisfy review.
- [RECOMMENDED] Use deterministic, synthetic or rights-cleared fixtures with no personal data or production secrets. Verify in review.
- [CONFIRMED] A service is ready for review when its behavior checks, contract and startup checks meet the [service definition of done](quality-gates.md#testing-and-service-definition-of-done).

## Dependencies and hooks

- [CONFIRMED] Justify new dependencies and verify maintenance before adoption. Prefer standard library or framework features. Commit the lockfile and run a dependency audit where practical. Enforced in review and CI.
- [CONFIRMED] App and service owners approve dependencies scoped to their workspace. Declare them in that workspace and coordinate shared lockfile changes. Dependencies added to shared workspaces or root tooling require agreement on the shared change under the [decision register](../decisions/project-decisions.md).
- [CONFIRMED] D17 uses npm scripts and CI for the initial rollout. Husky and lint-staged are deferred to endy-rkt-16 if endy-rkt approves their addition. Thin Taskfile wrappers require separate approval. [Tooling decision](../decisions/project-decisions.md#d17-quality-tooling-and-ci-rollout)

## PRs and agents

- [CONFIRMED] Use the [PR checklist](../../.github/PULL_REQUEST_TEMPLATE.md) for scope, checks, contracts and approvals. Review behavior, service boundaries and security. Formatting belongs to the formatter.
- [CONFIRMED] Agent changes use the same checks and [report format](../agents/workflow.md#agent-report-template). Include changed files, exact commands and results, tests and assumptions. Use “not runnable yet” when checks are unavailable.
- [CONFIRMED] Agents follow the dependency policy above and need approval from endy-rkt for changes to shared quality configs. Do not disable checks or add suppressions to make checks pass. Coordinate before editing another service's directory. See [AGENTS.md](../../AGENTS.md).

## Enforcement map

| Rule group                                     | Mechanism                                      | Status                  | Backlog                                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Lint, app boundaries and comments              | Root ESLint config and first lint verification | [IMPLEMENTED]           | [endy-rkt-13, endy-rkt-17](../product/task.md#endy-rkt-code-quality-follow-up)                                           |
| Formatting and editor defaults                 | Prettier and EditorConfig                      | [IMPLEMENTED]           | [endy-rkt-13](../product/task.md#endy-rkt-code-quality-follow-up)                                                        |
| Strict compiler defaults                       | Root TypeScript base                           | [CREATED, NOT EXECUTED] | [endy-rkt-14](../product/task.md#endy-rkt-code-quality-follow-up)                                                        |
| Local lint, formatting and type-check commands | Root package scripts and app project configs   | [IMPLEMENTED]           | [endy-rkt-13, endy-rkt-14](../product/task.md#endy-rkt-code-quality-follow-up)                                           |
| PR quality, tests and security                 | CI jobs and required status                    | [CREATED, NOT EXECUTED] | [endy-rkt-11](../product/task.md#endy-rkt-foundation), [endy-rkt-15](../product/task.md#endy-rkt-code-quality-follow-up) |
| Hooks                                          | Optional Husky and lint-staged                 | [NOT IMPLEMENTED]       | [endy-rkt-16](../product/task.md#endy-rkt-code-quality-follow-up)                                                        |

## CI script contract

[CONFIRMED] Use the existing `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `.editorconfig` and `tsconfig.base.json` as the quality baseline. The private root npm manifest declares workspaces for `apps/frontend`, `apps/backend/*` and `packages/*`. Run `npm run lint` and `npm run format:check` from the root once the scripts land. Every initialized workspace, including a future shared package, defines nonempty `typecheck`, `test` and `build` scripts. Its TypeScript project extends `tsconfig.base.json` and includes all linted TypeScript files. The matrix checks that each script exists before invoking it and fails if any script is missing, invalid or fails. [CI guide](ci.md#partial-workspaces-and-prerequisites)

[IMPLEMENTED] The root scripts and workspace scripts exist and pass locally. App directories without `package.json` are placeholders and are not linted until initialized. `scripts/3d` is a standalone tool with its own lockfile and TypeScript 7, outside the root lint and format scope. [NOT IMPLEMENTED] A hosted run and manual activation of the required check remain.
