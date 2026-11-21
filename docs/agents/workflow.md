# Claude and Codex workflow

Use this workflow for small, reviewable tasks. Each owner uses the tool listed in [team responsibilities](../team/responsibilities.md). Both tools follow [AGENTS.md](../../AGENTS.md).

[CONFIRMED] endy-rkt defines the MVP and system overview. The task owner defines or revises the task specification, then directs the agent to inspect, plan, implement, verify and report. The task owner reviews the result and coordinates integration with affected owners.

[CONFIRMED] Attach acceptance criteria and give the agent the relevant docs, code, contracts and constraints. Owners decide implementation details for their area. Agents surface decisions to their task owner. Coordinate overlapping edits and shared contracts with affected owners. Bring changes to MVP scope or system-wide architecture to endy-rkt.

[CONFIRMED] For service work, follow the [ownership rules](../team/responsibilities.md#task-ownership), including coordination for the root Compose file. Use parallel agents only for independent work with a clear need.

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
