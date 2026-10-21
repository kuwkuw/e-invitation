## What and why

<!-- One or two sentences. Link the FR/NFR ids or the ADR this touches. -->

## Checklist

- [ ] CI is green (lint, typecheck, test, build, audit, docker)
- [ ] Behaviour changed → the matching FR/NFR/architecture section is updated in this PR (docs/README.md convention)
- [ ] `schemas.ts` changed → `web/src/types.ts` mirrored; a hand-mirrored table changed → its twin changed too
- [ ] New user-visible strings are in both `i18n.ts` tables
- [ ] New env var → `server/.env.example` and `docs/05-deployment.md`
- [ ] Data shape in `DATA_DIR` changed → old files still load (no migration step exists)
- [ ] `CLAUDE.md` updated only where an agent would otherwise get it wrong
