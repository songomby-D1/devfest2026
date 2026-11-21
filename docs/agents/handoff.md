# Current handoff

[CONFIRMED] The backend layout is `apps/backend/<service>/`. The gateway, auth, content, nft and lidar directories are placeholders. See the [backlog](../product/task.md) for owners and dependencies.

## Latest session

- [CREATED, NOT EXECUTED] Added [CI](../../.github/workflows/ci.yml), [Dependabot](../../.github/dependabot.yml) and the [CI guide](../development/ci.md). Contributor and agent docs point to the guide and the required `ci-ok` status.
- PyYAML 6.0.3 parsed both YAML files. `actionlint` was unavailable. No hosted jobs, scans, builds or tests ran.
- [NOT IMPLEMENTED] Root npm manifests, installs, app projects and workspace scripts are still pending. Without the root manifest, CI warns and skips JS jobs. Local quality tooling and CI rollout are tracked in CTO-13–CTO-24.
- The [shared quality configs](../development/code-policy.md) are unchanged. CI explicitly selects `.prettierrc.json`. GitHub settings remain a [manual CTO checklist](../development/ci.md#repository-settings-checklist).

## Open CTO decisions

- [CTO DECISION REQUIRED] D14 shared contracts, import aliases and Docker build context. D15 runtime version management. D17 tooling rollout, audit policy and whether to defer hooks.
- [CTO DECISION REQUIRED] D01 deadline and demo scope. D02 delivery owners. D04 database isolation. D05 object storage and delivery. D06 gateway and Nginx. D07 identity propagation and logout.
- [CTO DECISION REQUIRED] D08 blockchain. D09 NFT standard. D10 wallet. D11 minting and metadata approach. D12 3D scope. D13 role model. D16 async processing. D18 review and media policy. DEMO-01 demo host.
- [CTO DECISION REQUIRED] CI settings: admin bypass, approval count, strict up-to-date policy, merge method, CodeQL, CODEOWNERS and push scan scope. D18 also covers cultural-media licensing and consent for public Git history. See the [CI guide](../development/ci.md).

## Next approved work

Wait for CTO approval. Use the [session protocol](../../AGENTS.md#session-protocol) and [session log](log.md) to resume from repository evidence.
