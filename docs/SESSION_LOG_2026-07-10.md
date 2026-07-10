# Session Log — 2026-07-10

**Purpose:** plain-language record of this session, continuing from
`docs/SESSION_LOG_2026-07-08_to_2026-07-09.md`. Written per the project's standing convention
(`CLAUDE.md` §Session Logs) so context is never lost between conversations.

---

## 1. Discovering and resolving a parallel-session merge conflict

- User asked to commit and push the previous session's CP12 follow-up work (repayment schedule
  migration, balance reconstruction, address-code fix — see the 07-08/07-09 log).
- Before committing, discovered `origin/main` had moved **27 commits ahead** — a **separate git
  worktree** (`C:\ECLC CLAUDE CODE\.claude\worktrees\exciting-herschel-138865`, branch
  `claude/exciting-herschel-138865`) had independently done its own CP12 legacy migration plus much
  broader frontend/backend wiring (Dashboard, Loan Applications, Reports, Payment Reminders, Member
  Details, Activity Logs, PSGC cascading address picker) and already published it to `origin/main`.
- Also found: `legacy/MongoDB dump/` (the real customer-data MongoDB export used for this session's
  migration work) was **not actually gitignored** — a casing mismatch (`MongoDB dump` vs the
  existing `legacy/mongodb/` rule) left it trackable. Fixed in `.gitignore` before anything was
  staged, so it never entered git history.
- Resolution process (all confirmed with the user before proceeding, per the "risky/hard-to-reverse
  action" rule): stashed local uncommitted work, fast-forward pulled `origin/main`, restored the
  stash, and manually resolved real conflicts in 10 files:
  - Backend `ILoanAccountRepository`/`ListLoanAccountsUseCase`/`PrismaLoanAccountRepository`/
    `loanAccountController`: both sides added non-overlapping list filters (`search` from the
    other session, `borrowerId` from this one) — merged to keep both.
  - Frontend `ClientListPage`/`ClientProfilePage`/`LoanDetailPage`/`LoanListPage`: the other
    session's versions had genuine server-side pagination + debounced search (their own fix for
    the same "loading everything up front" performance problem this session had been patching
    around client-side) — took theirs wholesale, then re-added the Interest/Penalty/Fees Balance
    columns on `ClientProfilePage`'s Loan History table (an explicit user request from the prior
    session that the other branch didn't have).
  - `package-lock.json`: regenerated via `npm install` rather than hand-merged.
  - Deleted `borrowerCache.ts` (this session's now-superseded client-side cache workaround) and the
    already-known-flawed `reconstruct-active-loan-balances.ts` (dry-run only, never applied).
- Applied the other session's two pending Prisma migrations (`add_loan_applications`,
  `add_psgc_reference_tables`) that existed on disk but weren't yet applied to the shared local
  Postgres database; regenerated the Prisma client.
- Caught and fixed a real pre-existing bug in the other session's code during the merged typecheck:
  `LoanDetailPage.tsx`/`StatementOfAccountPage.tsx` compared installment status against `'OVERDUE'`,
  which the real API never sends (the actual enum value is `'LATE'`) — the comparison was backwards
  from what its own comment claimed.
- **Before committing:** the auto-mode safety classifier flagged that
  `CP12-repayment-schedule-migration.md` embedded a real customer's full name and financial figures
  sourced from the legacy PII dump. Anonymized (loan code only, name withheld) before staging.
- Verified: backend typecheck clean, frontend typecheck clean, full backend suite (525 tests)
  passing, migrations in sync with the database. Committed (`ea4f760`) and pushed to `origin/main`.

## 2. SSH commit signing setup

- User asked for an SSH signing key ("for device signature, MIS Nomer").
- Generated a new ed25519 keypair (`~/.ssh/id_ed25519_signing`), configured git
  (`gpg.format=ssh`, `user.signingkey`, `commit.gpgsign=true`).
- Registered the public key on GitHub as a signing key via `gh ssh-key add` — required refreshing
  the `gh` CLI's OAuth scope first (`admin:ssh_signing_key`, a second device-code browser
  authorization).
- Configured `gpg.ssh.allowedSignersFile` locally so `git log --show-signature` verifies too, not
  just GitHub's own server-side check.
- Verified with a signed empty test commit (`dd2975d`) — "Good signature" both locally and after
  push.

## 3. Backend rate-limit / stale-process troubleshooting

- After the merge work (many verification `curl`/PowerShell calls against the backend), the
  frontend's Payment Recording page started showing "Could not load loan accounts. Is the backend
  running?" — the backend's general rate limiter (300 req/15 min, in-memory) had been exhausted by
  the session's own verification traffic.
- Restarting didn't immediately fix it: a **stale backend process** (an old `npm run dev` instance)
  was still bound to port 4000 and hadn't actually been killed by an earlier stop attempt, so the
  exhausted rate-limit counter persisted. Found and force-killed the correct PID, then started a
  fresh instance — resolved.

## 4. Real bug found and fixed: N+1 borrower-fetch storm in Payment Recording

- User noticed the loan-account dropdown on Payment Recording stuck on "Loading… — SML-REG_00377"
  indefinitely, alongside the same "Could not load loan accounts" error, even though "1281 of 1281
  payable loan accounts match" was already displayed (a self-contradictory combination that pointed
  at a real bug, not just leftover rate-limit state).
- Root cause: `PaymentRecordingPage.tsx` fetched every unique borrower behind the ~1,300 payable
  loans via a single `Promise.all` of ~1,300 individual `GET /borrowers/:id` calls, fired all at
  once. Two consequences: (a) *no* borrower name could resolve until *every* one of the ~1,300
  requests finished, so the UI showed "Loading…" for as long as the slowest request took, and
  (b) that request burst was large enough on its own to trip the backend's general rate limiter —
  the likely original cause of this session's earlier rate-limit exhaustion, not just this
  session's own verification traffic.
- Fixed by switching to React Query's `useQueries` (one query per borrower id, each independently
  cached/de-duplicated/resolved) instead of one `useQuery` wrapping a giant `Promise.all` — names
  now populate progressively as each resolves, and the request burst is smoothed by React Query's
  own scheduling instead of firing simultaneously.
- Checked the rest of the frontend for the same anti-pattern (`grep` for `Promise.all` across
  `src/pages/`) — only one other hit (`LoanApplicationsPage.tsx`'s bulk "mark reviewed" action),
  which is a small, explicitly user-triggered batch, not an unbounded background fetch; not a bug.
- Verified: frontend typecheck clean. Not yet re-tested live in a browser this session (no preview
  tool was available) — should be manually re-verified in the actual Payment Recording page.

## 5. MongoDB remote backup script (reverse-engineered from MIS Jomer's original)

- User wants to run their own backup of the SDevTech-managed remote MongoDB database, same as MIS
  Jomer's existing `legacy/mongodb-ELCI-LMS_batchfile-source-code.zip` (`.bat`/`.ps1` + a bundled
  `mongodump.exe` 100.13.0).
- Extracted just `mongodump.exe` to `legacy/mongodb-tools/` (verified working via `--version`) and
  gitignored it — a large third-party binary, not source.
- Wrote `backup-mongodb.bat` at the project root: same remote host/port/credentials as the original
  (structurally required for `mongodump` to connect — these are real SDevTech server credentials,
  same sensitivity as the original zip), but output redirected to `legacy\mongodb\<timestamp>.zip`
  (gitignored, per user's explicit request) instead of the original's `D:\MISA-LAPTOP-KQ4\...`
  path, and pointed at the local `legacy\mongodb-tools\mongodump.exe` instead of a path relative to
  MIS Jomer's laptop. Compresses and cleans up backups older than 7 days, same as the original.
  Gitignored the script itself too, since it embeds the same plaintext credentials.
- Deliberately did not execute it against the real remote server — user explicitly wants to run it
  themselves ("gusto ko na ako mismo ang mag-run").

## 6. Payment Recording redesign: client-first flow + manual per-installment allocation

- User flagged that Payment Recording had two confusing, side-by-side search controls ("Find loan
  account" text box + "Loan account" dropdown) and asked for a cashier-realistic flow: find the
  *client* first, then pick from *their* active loans only.
- Redesigned `PaymentRecordingPage.tsx` into three steps in the same card: (1) Find Client — debounced
  search against `GET /borrowers?search=`, results as clickable rows; (2) that client's own
  ACTIVE/ACTIVE_IN_ARREARS loans only via `GET /loan-accounts?borrowerId=`, never the whole
  company's ~1,300 payable loans; (3) the existing payment form, now scoped to the chosen loan. The
  `?loanId=` deep link from `LoanDetailPage`'s "Record Payment" button still works — it resolves the
  loan's borrower automatically via `GET /loan-accounts/:id` + `GET /borrowers/:id` instead of
  requiring the search step again.
- User then asked for a real gap: no way to enter Principal/Interest/Penalty/Fees amounts manually
  to post a payment — only a lump sum with server-computed automatic allocation. Per
  CLAUDE.md's "never invent business rules," asked the user two design questions before touching
  financial logic: manual mode = pick specific installment(s) then enter an exact per-component
  split overriding the automatic waterfall (not just an edge-case override); validated on both
  frontend (real-time, blocks submit on mismatch) and backend (authoritative).
- Backend: `ProcessPaymentUseCase` now accepts an optional `manualAllocations` parameter. When
  present, skips `PaymentAllocationService.allocate()`'s automatic waterfall entirely and instead
  validates the caller-supplied split via a new `toManualAllocations()` — each installment must be
  one of the loan's actual unpaid installments, no installment repeated, no negative amount, no
  component amount exceeding that installment's remaining due for that component, and the grand
  total across every entry must exactly equal `paymentAmount` (hard rejection on any mismatch — no
  remainder concept in manual mode, unlike automatic overpayment). Added `allocations` to
  `processPaymentSchema` (Zod) and wired it through the controller. Added 5 new unit tests
  (happy path + 4 rejection cases) — all 15 `ProcessPaymentUseCase` tests pass.
- Frontend: enabled the previously-disabled "Manual" allocation tab. Selecting it shows the unpaid
  installment list with checkboxes; checking one reveals four amount fields (Principal/Interest/
  Penalty/Fees) with that installment's remaining due shown as a hint. A running total vs. Payment
  Amount is shown live (green when matched, red when not); Submit Payment stays disabled until they
  match exactly.
- User manually verified both changes live in the browser preview and confirmed they look correct.

## Local dev environment fixes found along the way

- `.claude/launch.json`'s `frontend-preview` config pointed at `D:\ECLC CLAUDE CODE\...` — wrong
  drive letter (project is on `C:`). Fixed to `C:\ECLC CLAUDE CODE\...`.
- `.claude/run-frontend.bat` hardcoded `--port 5173`, which fought the browser-preview tool's own
  dynamic port assignment (Vite would silently fall back to 5174 while the tool's proxy still
  pointed at its originally-assigned port, causing a blank/`chrome-error://` page). Fixed to honor
  a `%PORT%` env var with a `--strictPort` flag, defaulting to 5173 only when unset.
- Backend CORS (`app.ts`) only allowed the exact `CORS_ORIGIN` env value (`http://localhost:5173`),
  which broke every time the preview tool assigned a different port. In development only, CORS now
  accepts any `http://localhost:<port>` / `http://127.0.0.1:<port>` origin (production still
  enforces the exact `CORS_ORIGIN` allow-list) — a `nodemon`-style watcher picked up the change and
  restarted the already-running dev backend automatically.

## Current state / known follow-up

- `origin/main` is at `512da53` (includes the N+1 fix + gitignore updates from earlier in this
  session; the Payment Recording redesign and manual-allocation feature are committed locally as of
  this log but not yet pushed — see below).
- SSH commit signing is set up and working for future commits from this machine.
- The PSGC reference tables (`psgc_barangays` etc.) exist in the schema but are **empty** — the
  other session's import script expects a legacy dump path
  (`legacy/mongodb/07012026_103239/db-address-api`) that isn't present in this working copy; the
  cascading address picker will show empty dropdowns until that's run with the right dump
  available.
- `backup-mongodb.bat` has not yet been run against the real remote server — that's on the user
  ("MIS Nomer") to do themselves.
- Manual allocation mode currently has no dedicated backend integration test (only the unit-level
  `ProcessPaymentUseCase` tests) — worth adding one alongside the automatic-mode integration
  coverage if/when that suite is extended.
