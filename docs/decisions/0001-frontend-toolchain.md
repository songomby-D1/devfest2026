# 0001 Frontend toolchain and Node runtime

- **Status:** Proposed. Node 22 matches the version CI already runs. The dependency list awaits approval from endy-rkt.
- **Decision owner:** endy-rkt
- **Proposed by:** Sesedra, with Claude
- **Backlog:** FE-01, endy-rkt-07, endy-rkt-13, endy-rkt-18 (D15), endy-rkt-19

## Context

The React/TypeScript frontend is confirmed and must use the gateway as its sole application entry point. FE-01 needed a build tool, a test runner and a Node version under D15. CI already runs Node 22.

## Options

- **Vite single-page app.** Builds a static bundle and has no server of its own. In development, its server proxies API calls to the gateway.
- **Next.js.** Adds its own Node server, routes and API handlers. These would form a second application entry point beside the gateway and need their own runtime image.
- **Node 22 or Node 24.** Both LTS lines run the toolchain. Node 22 is what CI pins today.

## Decision

- Use Vite 8 with React 19 and TypeScript, tested with Vitest, Testing Library and jsdom.
- Use Node 22 LTS, recorded in `.nvmrc` and in the root `engines` field (`>=22.12`, the minimum Vite and Vitest accept). CI keeps `NODE_VERSION: "22"`.
- Keep ESLint on 9.x, because `eslint-plugin-jsx-a11y` and `eslint-plugin-import` do not support ESLint 10.
- Keep TypeScript on 6.0.x, because `typescript-eslint` supports versions below 6.1.

## Consequences

- The frontend ships as static files that a future Dockerfile can serve with a static server.
- `.nvmrc`, `engines` and CI agree on Node 22, so D15 needs no workflow change. Node 22 is maintained until 30 April 2027, which covers the hackathon. A later move to Node 24 touches `.nvmrc`, `engines` and the workflow only.
- ESLint 9 no longer receives upstream support. Revisit this when both plugins support ESLint 10, or move to maintained alternatives.
