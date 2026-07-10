# Easycash LMS — Daily Goals Log

**Purpose:** a running, dated log of daily goals and whether they were achieved, so the team (and
whoever picks up this project next) can see at a glance whether the LMS is on track. Read
`docs/STATUS_REPORT_2026-07-10.md` first for the fuller context these goals are drawn from.

**How to use this log:**
1. At the start of each work session, review yesterday's entry — mark each goal ✅ Done, 🟡
   Partial, or ❌ Not started, with a one-line reason if not ✅.
2. Add a new dated entry with the next 5 goals, prioritizing whatever slipped yesterday.
3. Keep entries short — this is a tracking log, not a design doc. Link to a commit hash or PR when
   a goal completes.

---

## 2026-07-10

**Context:** See full report in `docs/STATUS_REPORT_2026-07-10.md`. This cycle wired every
remaining core frontend page to the real backend, fixed a real address data-quality bug (PSGC
codes instead of names), added real search + pagination to replace "load everything" list pages,
and fixed the Docker build. Status: **on track, no blockers.**

### Today's 5 goals

1. **[ ] Verify the Docker deployment end-to-end, standalone** — stop the local hot-reload frontend,
   confirm `docker compose up -d` alone (backend + frontend + postgres) supports a full login →
   browse-every-page → logout session with zero errors. Closes the loop on this cycle's Docker
   fixes; today they were verified via curl/API checks and the hot-reload frontend, not the
   Docker-served frontend end-to-end.
2. **[ ] Wire Client Profile's Attachments tab to real data** — smallest remaining "partially mock"
   gap on an otherwise-real page. Needs: a decision on where attachment files are stored (local
   disk per `STORAGE_DRIVER=local`, already configured) and an upload/list endpoint on the borrower
   or a new attachments module.
3. **[ ] Add `GET /branches`** — a small, low-risk read-only endpoint (mirrors the `psgc` module's
   pattern: no domain layer, plain list). Unblocks a real branch picker anywhere one's needed later;
   today every branch-scoped feature silently assumes the single seeded "Head Office" branch.
4. **[ ] Full regression pass, written up as a QA checklist** — Nomer (QA Engineer) runs a manual
   click-through of all 12 wired pages plus the 2 mock-only ones, logs pass/fail per page in a new
   `docs/QA_CHECKLIST.md`, so there's a repeatable reference for future regression passes instead of
   re-deriving what to check each time.
5. **[ ] Investigate the frontend's single ~1MB JS bundle warning** — at minimum, identify which
   dependency (recharts is a likely candidate) is the biggest contributor, and scope whether
   route-based code-splitting is worth doing now or safe to defer.

### End-of-day check-in (fill in before starting tomorrow's entry)

- Goal 1: _pending_
- Goal 2: _pending_
- Goal 3: _pending_
- Goal 4: _pending_
- Goal 5: _pending_

---

<!-- Next day's entry goes above this line. Copy the "Today's 5 goals" / "End-of-day check-in"
     structure above for each new date. -->
