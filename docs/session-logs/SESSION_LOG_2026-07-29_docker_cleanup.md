# Session Log — 2026-07-29 — Docker Desktop Cleanup

**Goal (user, in Filipino):** linisin ang Docker Desktop — tanggalin ang mga containers, images,
volumes, at build cache na hindi na ginagamit ng Easycash LMS/Portal project. I-dokumento kung
paano ito gagawin sa hinaharap at kung paano ito nagawa ngayon.

---

## 1. Survey

Ran a full inventory (`docker ps -a`, `docker images -a`, `docker volume ls`, `docker network ls`,
`docker system df -v`) before touching anything.

**Finding:** the container/image list was already minimal — only 2 containers
(`easycash-backend-1`, `easycash-postgres-1`) and 2 images (`easycash-backend:latest`,
`postgres:16-alpine`), both actually in use. No dangling images. So the user's mental model
("there's probably a lot of unused stuff") didn't match what was actually there for
containers/images — but two real things were found instead:

1. **3.741GB of reclaimable build cache** (`docker system df -v`, Build Cache row) — almost
   entirely leftover intermediate layers from the backend image rebuild done earlier this session
   (for the forgot-password feature). Purely regenerable, zero risk.
2. **One dangling volume, `easycash_backend_storage`**, not attached to any running container.

## 2. The volume turned out to have real data in it

Investigated before deleting anything (per house rule — never delete an unfamiliar volume blind):

```
docker run --rm -v easycash_backend_storage:/data alpine sh -c "du -sh /data; find /data -maxdepth 2"
```

7.6MB, containing `borrower/<uuid>/`, `loan-documents/<uuid>/`, and `loan_application/<uuid>/`
subfolders — i.e. real uploaded borrower photos and loan-application documents, not scratch data.

Cross-checked `docker-compose.yml`: the backend's `volumes:` block mounts a **bind mount**
(`../backend/storage:/app/storage`), not this named volume. A 2026-07-22 comment on that line
explains the switch was made specifically so a Docker-run backend and a host-run `npm run dev`
backend never silently diverge on uploaded files. So `easycash_backend_storage` predates that
change — it's not declared anywhere in the current compose file at all.

Compared against the current host-side bind-mounted folder (`app/backend/storage/`): 86K, 3 files,
**no `borrower/` subfolder at all**, and different document UUIDs than the old volume.

**Conclusion: this was not duplicate/superseded data.** It was real files that were never migrated
across when the storage mechanism changed on 2026-07-22 — deleting the volume outright would have
permanently lost them. Stopped and asked the user how to proceed (`AskUserQuestion`) rather than
guessing. User chose: migrate the data into the host storage folder, then delete the volume.

## 3. Migration — and a Windows/Git Bash gotcha worth documenting

First migration attempt used Git Bash's `$(pwd)` for the host-side mount path:

```bash
docker run --rm -v easycash_backend_storage:/src -v "$(pwd)/storage:/dest" alpine sh -c "cp -rvn /src/. /dest/"
```

The command's verbose output *looked* like it copied everything — but the host folder afterward
was unchanged (still 86K/3 files). Root cause: Git Bash's MSYS path translation of `$(pwd)`
(`/d/ECLC CLAUDE CODE/app/backend`) doesn't reliably survive the trip through Docker Desktop's
Windows path handling when the path contains spaces (`ECLC CLAUDE CODE`) — it silently mounted
something other than the intended folder, with no error at all.

Diagnosed by writing a test file from inside a container to the bind mount and checking whether it
appeared on the actual host filesystem — it did when using an **explicit Windows-style path**
(`D:/ECLC CLAUDE CODE/app/backend/storage`) instead of `$(pwd)`. Retried the copy with that path;
this time it worked correctly, confirmed by finding `borrower/` and all expected UUIDs on the host
afterward.

**Documented in `docs/guides/DOCKER_CLEANUP_GUIDE.md` §4** so this doesn't need re-discovering the
next time someone runs a `docker run -v` copy from Git Bash on this machine.

**Verification:** volume had 30 files (7.6M); host had 33 files (7.7M) after migration — exactly
30 migrated + 3 pre-existing, no overlap/overwrite conflicts (the old volume's UUIDs and the host's
pre-existing UUIDs never collided). Spot-checked a specific file
(`storage/borrower/d3e15426.../592e3576-....jpg`) present on the host post-migration.

## 4. Cleanup actions taken

- `docker volume rm easycash_backend_storage` — removed, now-migrated and confirmed empty of
  anything unique.
- `docker builder prune -af` — reclaimed the full 3.741GB build cache.
- `docker rmi alpine:latest` — removed the one-off image pulled just to run the migration/inspection
  commands above; not part of the LMS/Portal project itself.

**Before → after (`docker system df`):**

| | Before | After |
|---|---|---|
| Images | 2 / 3.169GB / 0B reclaimable | unchanged |
| Containers | 2 / 24.58kB / 0B reclaimable | unchanged |
| Local Volumes | 2 / 926MB / 7.889MB reclaimable | 1 / 920.2MB / **0B reclaimable** |
| Build Cache | 24 / 3.741GB / 3.741GB reclaimable | 0 / 0B / **0B reclaimable** |

**~3.75GB reclaimed total.** Everything remaining (2 images, 2 containers, 1 volume) is something
the running LMS/Portal stack actually uses — 0% reclaimable across the board.

Full raw command output: `docs/session-logs/DOCKER_CLEANUP_2026-07-29.log`.

## 5. Verification

`docker ps` — both containers still `Up`/healthy after all of the above (the volume removal and
build-cache prune never touch a running container's live filesystem or state).
`curl http://localhost:4000/api/v1/auth/me` → `401` (server responding correctly — 401 is the
expected "no token provided" response, confirming the API is still up).

## 6. Documentation added

- **`docs/guides/DOCKER_CLEANUP_GUIDE.md`** (new) — the reusable how-to: what this project actually
  uses in Docker, how to check whether something is safe to remove (including the "dangling volume
  might have real data" trap this session ran into), the always-safe commands, the
  needs-a-decision commands (with the Windows/Git Bash path gotcha called out explicitly), and what
  never to run (`docker system prune -a --volumes` — too broad for a shared dev machine, exactly
  the kind of blanket command that would have deleted the borrower documents in §2 without a
  second thought).
- **`docs/session-logs/DOCKER_CLEANUP_2026-07-29.log`** (new) — raw command-by-command record of
  this run, same format as the prior `DOCKER_CLEANUP_2026-07-16.log`.
- **This file** — narrative summary, in particular the reasoning behind not just deleting the
  dangling volume outright.
- `docs/README.md` — indexed the new guide.

## 7. Current state & follow-up

Docker environment is clean: only the 2 images/2 containers/1 volume the project needs, 0B
reclaimable anywhere. The migrated borrower/loan-application files now live at
`app/backend/storage/borrower/` and `.../loan-documents/` and `.../loan_application/` alongside the
files already there — no application code changes were needed, since the backend already reads
from that bind-mounted path.

No follow-up required. If a similar "volume looks orphaned" situation comes up again, follow
`docs/guides/DOCKER_CLEANUP_GUIDE.md` §2b/§4 rather than deleting first.
