# Auth service

Accounts, revocable opaque sessions and the `reviewer` permission for LOVA (D07, D13). Only the gateway calls it. The behavior follows the [Auth contract](../../../docs/specs/auth-contract.md) and the internal API is described in [auth.openapi.yaml](../../../docs/api/auth.openapi.yaml).

## Design

| Layer          | Contents                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Domain         | Email and password normalization and limits, session expiry rules, the `reviewer` permission, error types with safe messages     |
| Application    | `AuthService`: register, login, introspect, revoke, read an account, grant and revoke permissions, purge sessions                |
| Infrastructure | Prisma repositories, scrypt hasher (N=2^17, r=8, p=1) behind a concurrency limiter, random 32-byte tokens stored as SHA-256 only |
| Interface      | Internal controller, `ServiceTokenGuard`, zod validation, `{ code, message, requestId }` errors, operator CLI                    |

Sessions expire after 2 hours without use and 7 days after creation. Introspection slides the idle deadline and writes at most once per minute. Logs carry account and request IDs only.

## Commands

Run from the repository root with Node from `.nvmrc`.

```bash
npm run typecheck -w apps/backend/auth
npm run test -w apps/backend/auth      # unit tests, plus PostgreSQL tests when AUTH_TEST_DATABASE_URL is set
npm run build -w apps/backend/auth
```

`AUTH_TEST_DATABASE_URL` is a PostgreSQL URL for a role that can create databases. Each run creates, migrates and drops its own database. CI sets `REQUIRE_DB_TESTS=true` so that a missing database fails instead of skipping.

## Operator CLI

Inside the running container (`docker compose exec auth sh`):

```bash
node dist/cli.js grant-permission ana@example.org reviewer
node dist/cli.js revoke-permission ana@example.org reviewer
node dist/cli.js purge-sessions
```

The gateway exposes the same grant and revoke actions under `/api/admin/permissions` with the operator token.

## Configuration

See [.env.example](.env.example). In Compose, the root `.env` provides the values. The container applies migrations with the migration role, then starts with the runtime role only (D04).
