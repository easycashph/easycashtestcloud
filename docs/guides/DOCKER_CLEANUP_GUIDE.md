# Docker Desktop Cleanup Guide (Easycash LMS/Portal)

How to safely clean up unused Docker containers, images, volumes, and build cache on a machine
running this project — without deleting anything the LMS or Portal actually needs.

Last performed: 2026-07-29 (see `docs/session-logs/DOCKER_CLEANUP_2026-07-29.log` for that run's
exact before/after numbers and what was found).

---

## 1. What this project actually uses in Docker

As of `app/docker/docker-compose.yml`, currently:

| Resource | Name | Purpose |
|---|---|---|
| Container | `easycash-backend-1` | The API (`easycash-backend` image) |
| Container | `easycash-postgres-1` | The database (`postgres:16-alpine` image) |
| Image | `easycash-backend:latest` | Built from `app/easycashbackend` via `app/docker/backend.Dockerfile` |
| Image | `postgres:16-alpine` | Pulled from Docker Hub, unmodified |
| Volume | `easycash_postgres_data` | Postgres's actual data directory — **never delete this** |
| Network | `easycash_default` | Compose's auto-created network for the two services above |

Backend file storage (`/app/storage` in the container) is a **bind mount** to
`app/easycashbackend/storage` on the host, not a named Docker volume — deliberately, since 2026-07-22, so
a `docker compose`-run backend and a host-run `npm run dev` backend always read/write the exact
same folder (see the comment on that line in `docker-compose.yml`). This means uploaded
borrower/loan-application files live on the host filesystem, not inside Docker at all — cleaning
up Docker never touches them.

Everything else Docker Desktop shows you (other containers, images, volumes, build cache) is safe
to consider for removal, **after the checks in §2**.

---

## 2. Before deleting anything: check for other projects and for real data

This machine may run Docker for things other than Easycash. Two checks, every time:

**a. Is it actually unrelated to this project, or just currently stopped/not running?**
A container/image not currently running is not the same as "unused" — check the name and the
image it's built from before assuming it's safe to remove.

**b. Does a volume that looks orphaned actually contain real data?**
`docker volume ls -f dangling=true` lists volumes not attached to any container right now — but
"not currently attached" does not mean "safe to delete." A volume can be dangling because the
compose config changed (a named volume was replaced by a bind mount, like `easycash_backend_storage`
was on 2026-07-22) while old data from before that change is still sitting inside it, never
migrated. **Always inspect a dangling volume's contents before deleting it:**

```bash
docker run --rm -v <volume_name>:/data alpine sh -c "du -sh /data; find /data -maxdepth 2"
```

If it contains real files (uploaded documents, generated PDFs, anything that isn't obviously
scratch/cache), **do not delete it** until you've confirmed the same data exists elsewhere (e.g.
the current bind-mounted host folder) or migrated it there yourself. See §4 for how.

---

## 3. Safe, no-thinking-required cleanup

These never touch real data — run anytime:

```bash
# Full inventory first, so you know what you're about to reclaim
docker system df -v

# Build cache: always safe. These are regenerable intermediate image layers, not application
# data - worst case, the next `docker compose build` takes longer because it has to redo work it
# would otherwise have cached.
docker builder prune -af

# Dangling (untagged/orphaned) images: also always safe - these are leftover layers from old
# builds that nothing references anymore.
docker image prune -f
```

## 4. Cleanup that needs a decision first

**A dangling volume with real data in it** (see §2b): migrate before deleting.

```bash
# 1. Copy the volume's contents into wherever the project now actually reads from (check
#    docker-compose.yml's current volumes: block to find that path).
docker run --rm \
  -v <old_volume_name>:/src \
  -v "<ABSOLUTE_WINDOWS_PATH_TO_TARGET_FOLDER>:/dest" \
  alpine sh -c "cp -av /src/. /dest/"

# 2. Verify file counts/sizes match before trusting the migration.
docker run --rm -v <old_volume_name>:/src alpine sh -c "find /src -type f | wc -l; du -sh /src"
find "<target_folder>" -type f | wc -l   # run on the host, compare

# 3. Only once verified, delete the old volume.
docker volume rm <old_volume_name>
```

**⚠️ Windows/Git Bash path gotcha:** if you run these `docker run -v` commands from Git Bash on
Windows and this project's path contains spaces (`D:\ECLC CLAUDE CODE\...` does), do **not** use
`$(pwd)` for the host-side mount path — Git Bash's MSYS path translation can silently produce a
mount that looks correct in the command but resolves to something empty inside the container (no
error, it just quietly doesn't work). Use the explicit Windows-style path instead, quoted:

```bash
# WRONG on this project - may silently mount nothing (Git Bash `/d/ECLC CLAUDE CODE/...` path
# translation can fail with spaces in the path):
-v "$(pwd)/storage:/dest"

# RIGHT:
-v "D:/ECLC CLAUDE CODE/app/easycashbackend/storage:/dest"
```
Always verify the mount actually landed by writing a test file from inside the container and then
checking for it on the host, before trusting a larger copy operation.

**Any container/image you don't recognize:** find out what it's for before removing it (see §2a).
Don't run a blanket `docker system prune -a --volumes` on a shared dev machine — that removes
*every* stopped container and *every* volume not currently attached to a running container,
regardless of project, which is exactly how the `easycash_backend_storage` situation in §2b could
turn into actual data loss instead of a caught-in-time migration.

---

## 5. Quick reference: what NOT to run on this machine

| Command | Why not |
|---|---|
| `docker system prune -a --volumes` | Deletes every unattached volume across every project on the machine, no per-volume review. Too broad. |
| `docker volume rm easycash_postgres_data` | This is the actual database. Deleting it deletes every borrower, loan, and payment record. |
| `docker rmi easycash-backend / postgres:16-alpine` | These are the images the running containers need. Removing them doesn't free meaningful space anyway (Docker won't let you remove an image a container is using) but don't try. |

---

## 6. After cleanup

Confirm the stack still works before considering the cleanup done:

```bash
docker ps                                       # both containers still Up/healthy
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/v1/auth/me   # expect 401 (server is up, just unauthenticated)
```

If you rebuilt an image as part of this session (e.g. after pulling new backend code), restart the
container from the fresh image rather than assuming a running container picked up the change on
its own — Docker doesn't hot-swap a running container's code:

```bash
cd app/docker
docker compose build backend
docker compose up -d backend
```
