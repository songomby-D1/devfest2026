# Claude and Codex workflow

Use this workflow to turn approved specifications into small, reviewable tasks while conserving the team's limited AI subscriptions.

[CONFIRMED] The CTO defines the specification → assigns one task owner → the agent inspects existing implementation → proposes a plan → receives CTO approval when needed → implements → tests and verifies → reports results → the CTO reviews integration.

[CONFIRMED] Attach acceptance criteria to every task and give the agent the relevant docs, code, contracts and constraints. Coordinate any overlapping edits before work starts. Agents escalate architectural choices to the CTO. Use parallel agents only for independent work with a clear need. Each agent reports changed files, tests executed, assumptions and unresolved issues.

[RECOMMENDED] Assign primary ownership by service directory once the layout is approved. Coordinate edits to the gateway, shared package, contracts and root tooling with the CTO first, since they affect multiple owners.

The reference informs these principles: write the specification first, give clear context, keep tasks small, define explicit acceptance criteria, plan implementation, verify results and obtain human review. [AI-Native Development: Specifications, Loop and Graph Engineering](https://aishippingblog.com/p/ai-native-development-specifications)

## Task specification template

- Goal and primary owner
- Context and relevant contracts or prior work
- In scope and out of scope
- Files or directories likely to change
- Testable acceptance criteria
- Constraints, dependencies and approval gates. Follow the [shared code policy](../development/code-policy.md).

## Agent report template

- Outcome and changed files
- Acceptance criteria verified and supporting evidence
- Commands and tests actually executed, results and checks still pending
- Lint, format, type-check and test results or “not runnable yet”, per the [shared code policy](../development/code-policy.md).
- CI status and exact local checks run, or “not runnable yet”. See the [CI guide](../development/ci.md).
- Assumptions, unresolved issues and integration notes
- Appended to [log.md](log.md) / updated [handoff.md](handoff.md), per the [session protocol](../../AGENTS.md#session-protocol).
