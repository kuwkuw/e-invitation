# Documentation index

Knowledge base for the e-invitation app. Structure follows open documentation
conventions: business vision, requirements (ISO/IEC/IEEE 29148-inspired),
architecture (arc42-inspired), and architecture decision records (ADRs).

| Doc | Contents |
| --- | --- |
| [01-vision.md](01-vision.md) | Business intent, target users, success signals |
| [02-functional-requirements.md](02-functional-requirements.md) | What the system does, mapped to endpoints and UI |
| [03-non-functional-requirements.md](03-non-functional-requirements.md) | Latency, cost, security, i18n, observability constraints |
| [04-architecture.md](04-architecture.md) | System context, containers, pipeline, data model |
| [decisions/](decisions/) | ADRs — settled decisions and their rationale |

Conventions:

- Requirements carry stable IDs (`FR-x`, `NFR-x`) so code reviews and ADRs can
  reference them.
- Docs describe **what is built and why**; `CLAUDE.md` at the repo root holds
  agent-facing working instructions and stays the source for commands.
- When behavior changes, update the matching requirement/architecture section
  in the same PR.
