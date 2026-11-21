# Gateway

The frontend's only application entry point (D06). It authenticates the session cookie with Auth, builds the caller context, forwards each public route to its owning service and maps every failure to the public error shape. It owns no product data. The public routes are frozen in [gateway.openapi.yaml](../../../docs/api/gateway.openapi.yaml) and explained in the [platform contract](../../../docs/specs/platform-contract.md).

## Behavior

- **Guests.** Requests without a session cookie never reach Auth and carry no user ID (AUTH-04).
- **Sessions.** Login sets an `HttpOnly`, `SameSite=Lax` cookie. Protected routes fail closed with `401 UNAUTHENTICATED` or `503 AUTH_UNAVAILABLE`. Optional routes fall back to guest access, which never grants more.
- **Caller context.** Upstream headers are built from scratch, so client-supplied `x-caller-*` and `x-service-*` headers are never forwarded. Each service receives its own `x-service-token`.
- **Browser safeguards.** State-changing requests need an allowed `Origin`. CORS is limited to `GATEWAY_ALLOWED_ORIGINS`. Login and registration are rate limited per client address.
- **Errors.** Service errors in the contract shape are relayed. Other bodies get a generic code, upstream 5xx becomes `502 UPSTREAM_ERROR`, and timeouts become `503 <SERVICE>_UNAVAILABLE`.
- **Media and 3D.** Uploads and files are streamed with an upload size limit, range headers are kept, and wildcard paths refuse dot segments. LiDAR answers are mapped to the frozen 3D descriptor, which only accepts gateway-relative URLs.
- **Operators.** `/api/admin/*` routes need the `x-admin-token` header.

## Commands

Run from the repository root with Node from `.nvmrc`.

```bash
npm run typecheck -w apps/backend/gateway
npm run test -w apps/backend/gateway   # unit tests and HTTP tests against stub services
npm run build -w apps/backend/gateway
GATEWAY_URL=http://localhost:3000 npm run smoke:auth   # against a running stack
```

## Configuration

See [.env.example](.env.example). In Compose, the root `.env` provides the values and the gateway is the only published service.
