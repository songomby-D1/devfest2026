# 0001 Frontend toolchain and Node runtime

- **Status:** Proposed. Awaiting approval from endy-rkt for the dependencies and D15.
- **Decision owner:** endy-rkt
- **Proposed by:** Sesedra, with Claude
- **Backlog:** FE-01, endy-rkt-07, endy-rkt-13, endy-rkt-18 (D15), endy-rkt-19

## Context

The React/TypeScript frontend is confirmed and must use the gateway as its sole application entry point. FE-01 needed a build tool, a test runner and a Node version under D15.

## Options

- **Vite single-page app.** Builds a static bundle and has no server of its own. In development, its server proxies API calls to the gateway.
- **Next.js.** Adds its own Node server, routes and API handlers. These would form a second application entry point beside the gateway and need their own runtime image.

## Decision

- Use Vite 8 with React 19 and TypeScript, tested with Vitest, Testing Library and jsdom.
- Use Node 24 LTS, recorded in `.nvmrc` and in the root `engines` field (`>=24`).
- Keep ESLint on 9.x, because `eslint-plugin-jsx-a11y` and `eslint-plugin-import` do not support ESLint 10.
- Keep TypeScript on 6.0.x, because `typescript-eslint` supports versions below 6.1.

## Consequences

- The frontend ships as static files that a future Dockerfile can serve with a static server.
- CI still runs Node 22. Aligning it with `.nvmrc` is a workflow change and needs approval (endy-rkt-18).
- Node 26 became Active LTS on 2026-10-28. Node 24 stays in maintenance until April 2028, which covers the hackathon.
- ESLint 9 no longer receives upstream support. Revisit this when both plugins support ESLint 10, or move to maintained alternatives.
