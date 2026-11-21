# Current handoff

[CONFIRMED] The backend layout is `apps/backend/<service>/`. The gateway, auth, content, nft and lidar directories are placeholders. See the [backlog](../product/task.md) for owners and dependencies.

## Latest session

- Published the [shared code policy](../development/code-policy.md), root quality configs and [PR checklist](../../.github/PULL_REQUEST_TEMPLATE.md). Synced contributor and agent docs.
- [CREATED, NOT EXECUTED] The root ESLint, Prettier, EditorConfig and TypeScript settings are present. `node --check eslint.config.mjs` exited 0 with no output. Both new JSON files parsed successfully.
- [NOT IMPLEMENTED] Dependency installs, scripts, app TypeScript projects, lint execution, hooks and CI remain in CTO-13–CTO-17. App and service initialization remain in the backlog.
- The empty legacy `.prettierrc` is preserved. Planned scripts and editor integrations use `--config .prettierrc.json` or select the equivalent explicit path.

## Open CTO decisions

- [CTO DECISION REQUIRED] D14 shared contracts, import aliases and Docker build context. D15 runtime version management. D17 tooling rollout, audit policy and whether to defer hooks.
- [CTO DECISION REQUIRED] D01 deadline and demo scope. D02 delivery owners. D04 database isolation. D05 object storage and delivery. D06 gateway and Nginx. D07 identity propagation and logout.
- [CTO DECISION REQUIRED] D08 blockchain. D09 NFT standard. D10 wallet. D11 minting and metadata approach. D12 3D scope. D13 role model. D16 async processing. D18 review and media policy. DEMO-01 demo host.

## Next approved work

Wait for CTO approval. Use the [session protocol](../../AGENTS.md#session-protocol) and [session log](log.md) to resume from repository evidence.
