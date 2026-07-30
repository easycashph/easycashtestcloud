# Session Log — 2026-07-29 — Root Organization, Round 2

**Goal (user, in Filipino):** "paki organize din ng root" — a follow-up asking to further organize
the repo root, after the earlier `local/` folder work this same day.

---

## 1. Unexpected state found

Re-surveying the root turned up something not caused by this session: `Run LMS Preview.bat`,
`Run LMS Preview.command`, `Run LMS  Preview.md`, and `Sync Database From Export.bat` were missing
from disk despite being tracked in git (`git status` showed them as `D` — deleted from the working
tree, not touched by any tool call in this session).

Per house rule (investigate unfamiliar state before acting on it, especially when files disappear
rather than appear), stopped and asked the user directly rather than assuming intent either way —
restoring files the user deliberately removed would be just as wrong as finalizing a deletion they
didn't intend. **User confirmed: intentional, no longer needed.** Staged the deletions
(`git rm --cached`) to finalize them for the next commit.

## 2. Stale-doc-reference cleanup this uncovered

`docs/guides/WINDOWS_SETUP_GUIDE.md` referenced `Run LMS Preview.bat` twice as a still-existing
"easiest way to run the app" fast path (§7) and in the quick-reference command list (bottom of the
doc). With the script gone, both were stale/misleading for anyone following the guide fresh.

- §7: removed the "double-click `Run LMS Preview.bat`" fast-path block entirely, keeping the manual
  `npm run dev` (backend) / `npm run dev` (frontend) instructions that were already documented
  right below it as the "or manually" alternative — no functionality was actually lost, since that
  manual path already existed and still works.
- Quick-reference list: replaced `Run LMS Preview.bat (o npm run dev sa backend at frontend)` with
  the manual command explicitly, since the parenthetical alternative is now the only path.

## 3. A second stray file found while checking for others

While confirming no other loose scripts had root-vs-elsewhere duplicates (checked
`Update LAN IP.*`, `restore-easycash-backup.command`, `setup-macos.sh` for references), found
**`legacy/setup-macos.sh`** — a second, older copy of the setup script, sitting inside `legacy/`
(which should hold legacy-*system* migration material, not dev-environment tooling).

Traced via `git log`:
1. `9eb4f98` — original `setup-macos.sh` added at root.
2. `6e8f3e5` (2026-07-14) — "chore: move setup-macos.sh to legacy/" — moved there.
3. `cd2c167` (2026-07-19, later) — "chore: add setup-macos.sh, close *.dump gitignore gap" — a new,
   more polished version re-added at root (the one `MACOS_SETUP_GUIDE.md` currently documents and
   references).

The `legacy/` copy was never removed when the script was recreated at root — a leftover from step 2
that step 3 superseded but didn't clean up. Confirmed nothing references it by that path, and its
content is materially older/different (compared via `diff`) from the current root version. Removed
it (`git rm legacy/setup-macos.sh`) — full history preserved in git either way.

Checked the rest of `legacy/`'s loose top-level files (`Run Full Legacy Migration.command`,
`Sync Database And Apply Migrations.bat/.command`) for the same kind of stray-duplicate pattern —
these are unique, not duplicated at root, and genuinely belong there (they run the legacy migration
process itself). Left untouched.

## 4. What was deliberately left alone

- **`PROJECT_RULES.md`** — cited by exact root-relative path from 15+ ADRs and architecture docs.
  Moving it would mean updating every one of those references for a doc that conventionally belongs
  at root anyway (same tier as `README.md`/`CLAUDE.md`).
- **`CLAUDE.md`** — must stay at repo root; Claude Code auto-discovers project instructions from
  exactly that path.
- **`Update LAN IP.bat`/`.command`, `restore-easycash-backup.command`, `setup-macos.sh`** — the
  remaining launcher/setup scripts. Still double-click/terminal entry points meant to be run from
  the repo root (same reasoning as the earlier decision this session not to relocate this category
  of file) — only 4 files remain in this category now, not clutter in their own right.

## 5. Current root state

```
.gitattributes  .gitignore  CLAUDE.md  PROJECT_RULES.md  README.md
Update LAN IP.bat  Update LAN IP.command
restore-easycash-backup.command  setup-macos.sh
app/  docs/  legacy/  local/
```

Every remaining root-level file is either a required dotfile, a project-level doc conventionally
kept at root, or a script meant to be run/double-clicked from exactly that location. No further
consolidation candidates identified.

## 6. Verification

`git status --short` reviewed in full before and after each removal to confirm only the intended
files were affected. No source code, build config, or app behavior changed in this session — purely
file organization plus the two stale doc references in §2.
