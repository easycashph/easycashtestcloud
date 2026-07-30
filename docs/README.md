# Documentation Index

How this folder is organized.

| Path | Contents |
|---|---|
| `Architecture/` | ADRs, calculation engine spec, financial invariants, migration design |
| `Legacy Analysis/` | Analysis of the legacy Excel / SDevTech / MongoDB systems |
| `diagrams/` | Flow diagrams (images) |
| `guides/` | Setup & environment guides (Windows, macOS, device sync, Docker cleanup) |
| `session-logs/` | Dated AI-assisted session logs + status reports (append-only history) |

## Key documents

- [PORTAL_WEBSITE_STRATEGY.md](PORTAL_WEBSITE_STRATEGY.md) — roadmap for turning the client portal
  into the official Easycash website
- [LMS_PROJECT_SUMMARY.md](LMS_PROJECT_SUMMARY.md) — overall platform summary
- [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) — full handoff reference
- [Architecture/CALCULATION_ENGINE_SPEC.md](Architecture/CALCULATION_ENGINE_SPEC.md) — the single
  source of truth for all financial math
- [Architecture/FINANCIAL_INVARIANTS.md](Architecture/FINANCIAL_INVARIANTS.md) — rules that must
  never be violated
- [guides/DOCKER_CLEANUP_GUIDE.md](guides/DOCKER_CLEANUP_GUIDE.md) — how to safely clean up Docker
  Desktop on this project without losing data

## Conventions

- Session logs go in `session-logs/` as `SESSION_LOG_<date-range>[_topic].md` (see `CLAUDE.md`).
- Architecture decisions go in `Architecture/` as `ADR-<nnn>-<kebab-title>.md`.
- Personal/machine-local/scratch files (credential notes, ad-hoc local DB backups) go in `local/`
  at the repo root, not loose at the top level — see `local/README.md`. Everything in `local/` is
  gitignored except that README.
