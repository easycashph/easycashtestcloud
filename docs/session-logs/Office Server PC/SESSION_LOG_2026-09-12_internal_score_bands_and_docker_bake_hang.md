# Session Log — 2026-09-12 — Internal Credit Score Reference Table + Docker Build Hang

**Machine:** Office Server PC
**Requested by:** Nomer Perez

## Summary

While reviewing Maniwang's Internal Credit Score (33.5% DTI → 22 income points), user asked why
the Income factor landed on 22 points, then suggested the full points-per-band reference table
should be visible in the UI, not just the one arithmetic line for the current application. Agreed
and implemented it. Deploying the fix then ran into a separate, unrelated `docker compose build`
hang that took most of the session to diagnose and work around.

## Feature: Income/DTI/Employment band reference tables

`InternalScoreFactor` (in `LoanApplicationDetailPage.tsx`) already showed each factor's exact
arithmetic (`f.formula`, e.g. "₱65,000 ÷ ₱21,800 = 2.98× income ratio → 22 pts") when a row was
expanded, but not the full scale - no way to see how close an applicant was to the next band
without doing the math by hand.

Added an optional `bands: { label; points; active }[]` field, populated for the three factors with
discrete point bands (Income, DTI, Employment - Payment History's points are a continuous
`round(rate × 25)`, no lookup table applies there), and rendered as a small highlighted table under
the existing formula line in the expand-to-see-more section. Committed `0063490a`.

## Docker build hang (unrelated to the above, ate most of the session)

Deploying required rebuilding `lmsfrontend`. `docker compose up -d --build lmsfrontend` hung
indefinitely - zero build output, zero CPU on the buildkit daemon, stuck at the very first step
("load local bake definitions") for 10+ minutes. Retried with `--progress=plain` via `docker
compose build` directly - hung again, same symptom, same first step.

Ruled out (all checked out healthy): Docker daemon itself (`docker info`, `docker compose ps`,
`docker events` all responsive), disk space (plenty free on C/D/E), WSL2 (`docker-desktop`
distro Running), buildx builders (`docker buildx ls` reports both `default` and `desktop-linux`
running).

**Root cause**: `docker compose build`'s default "bake" backend on this machine - confirmed by its
own warning line (`--progress is a global compose flag, better use 'docker compose --progress xx
build ...'`) appearing right before it hung. Bypassed by calling **`docker build` directly**,
reading the exact `dockerfile`/`context` out of `docker-compose.yml`'s `lmsfrontend` service block:

```
docker build -f frontend.Dockerfile -t easycash-lmsfrontend:latest ../lmsfrontend --progress=plain
```

This built successfully end-to-end (~20 minutes total - `tsc -b` alone took ~10 of those minutes,
much slower than running it on the host directly; `vite build` another ~6). Then
`docker compose up -d --no-build lmsfrontend` picked up the freshly-built image and recreated the
container normally - only the *build* step needed the bypass.

**A second, smaller gotcha surfaced by the recovery**: after the `--no-build` recreate (which ran
in the aftermath of the earlier killed build attempts), `easycashbackend`'s container came back
correctly running and correctly tracked by compose (`com.docker.compose.service` label intact,
healthy, right port binding) but with its name auto-mangled to
`5a1d253dc962_easycash-easycashbackend-1` - Docker's own auto-rename-on-collision behavior,
triggered by the overlapping build attempts. Fixed cosmetically with a plain `docker rename`.

**Process notes**:
- Killing the first two stuck `docker.exe compose ...` processes needed `taskkill /F` - the first
  attempt was blocked by the auto-mode permission classifier; asked the user directly, who
  confirmed, then it worked.
- Both memories `[[project_docker_compose_bake_build_hangs]]` (the hang itself + workaround) and an
  update to `[[project_docker_compose_build_may_skip_recreate]]`'s neighbor entry were saved so a
  future session recognizes this immediately instead of re-diagnosing from scratch.

## Current state

- `lmsfrontend`/`easycashbackend`/`portalfrontend`/`postgres` all verified healthy via `docker ps`
  uptime (not just compose's own output - see the memory above on why that alone isn't proof).
- Code + build-info committed and pushed (`0063490a`).
- Known risk for next time: `docker compose build`/`up --build` may hang again on this machine
  until the underlying bake-backend issue is actually fixed (e.g. a Docker Desktop update, or
  explicitly forcing the legacy build backend) - the direct-`docker build` workaround is
  documented in memory for whoever hits it next.
