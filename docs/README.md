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
| [05-deployment.md](05-deployment.md) | Northflank deployment: one container, volume, env |
| [06-roadmap.md](06-roadmap.md) | Next-iteration plan and candidate backlog |
| [07-monetization.md](07-monetization.md) | Unit economics and pricing options — investigation, nothing built |
| [decisions/](decisions/) | ADRs — settled decisions and their rationale |

Conventions:

- Requirements carry stable IDs (`FR-x`, `NFR-x`) so code reviews and ADRs can
  reference them.
- Docs describe **what is built and why**. Agent-facing working instructions
  live in `CLAUDE.md` (repo-wide, and the source for commands) and in
  `server/CLAUDE.md` / `web/CLAUDE.md` (loaded when working in that folder).
  They state rules and point here for the reasons.
- `superpowers/` holds design specs and implementation plans while the work is
  in flight; once it ships they move to `superpowers/archive/`. The ADRs and
  this folder's numbered docs are what stays current.
- When behavior changes, update the matching requirement/architecture section
  in the same PR.
