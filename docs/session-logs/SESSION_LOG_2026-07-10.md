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

## Current state as of Sections 1–6 (MIS Nomer's machine)

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

---

## 7. Loan Application intake fixes (MIS Jomer's machine, same calendar day)

- User asked to make the Loan Applications "Create Application" flow fully functional and asked for
  an indicator of who encoded a walk-in application.
- Found a real bug: `loanApplicationController.ts`'s `create` handler never called
  `getCurrentUser(req)` — `encodedByUserId` was always `null` in the database despite the field,
  domain logic, and even the frontend's own confirm-dialog text ("encoded by {currentAccount.name}")
  already assuming it worked. The Detail page's `encodedByUserId` truthy-check therefore always fell
  through to "Submitted via the (not yet built) public loan application website," even for
  staff-encoded walk-ins. Fixed by deriving it from the authenticated request, matching how
  `reviewedByUserId` already works for approve/decline.
- Also renamed "Create Application" buttons to "Create Loan Application" per business request, and
  fixed a real `react-hooks/rules-of-hooks` violation caught by ESLint while touching
  `LoanApplicationCreatePage.tsx` (a `useMutation` call sat after an early return for unauthorized
  users — moved below all hooks).
- Added the actual "encoded by" / "reviewed by" name display on the Detail page (resolves the raw
  user id against `GET /users`, same join pattern as borrower/product names elsewhere).
- Verified end-to-end via a real `POST /loan-applications` call and the Detail page render — the
  header now reads "… · Encoded by Jomer Biason" and the Applicant Details card reads "Walk-in
  applicant — encoded by Jomer Biason…".

## 8. Cascading product type/class assignment with a "Discontinued" indicator

- User asked to replace the flat "Assign product version" dropdown on Loan Application approval
  with two cascading selects: Assigned product type (Salary Loan / Seafarer Loan / Business Loan),
  then Assigned product class filtered to that type.
- Cross-checked the user's requested class list against real active `LoanProduct` rows in the
  database before building anything (CLAUDE.md "never guess") — found real mismatches (no
  `SL-Special` exists; the Seafarer entry the user meant was `SML-Special`, not `SL-Special`) and
  asked clarifying questions rather than assuming. Confirmed with the user: Salary Loan = SL-Regular/
  SL-Corporate (current) + SL-Snap-A/B, SL-Online, SL-Online_New, SL-Lazada variants (existing but
  discontinued); Seafarer Loan = SML-Regular/SML-Special (current) + SML-Kaborrow, SML-PDC,
  SML-Quick Cash, SML-Co-Borrower Allotment, SML-Self Allotment (discontinued, added in a follow-up
  request); Business Loan = BL-Regular/BL-Special.
- Discontinued classes show a badge and are `disabled` on the `SelectItem` (not just visually
  greyed — actually non-clickable, confirmed via `aria-disabled` and that the dropdown doesn't close
  on a click attempt), per the user's explicit "hindi dapat clickable" requirement.
- Verified all three type→class cascades and the disabled behavior live in the browser preview.

## 9. Attachment upload feature (new Document module)

- User asked whether an attachment-upload button with auto-fill from the uploaded document was
  feasible. Flagged the auto-fill/OCR half as a separate, bigger decision (cloud OCR = cost +
  third-party dependency vs. local Tesseract = lower accuracy, both needing a business decision) and
  scoped this session to attachment upload only, which the user agreed to.
- Backend: new Document module (`app/backend/src/modules/document/`) — `IAttachmentRepository`/
  `IFileStorage` ports, `LocalFileStorage` (CLAUDE.md storage abstraction — an `S3FileStorage` could
  implement the same port later without touching application logic), `PrismaAttachmentRepository`,
  and `POST/GET /attachments`, `GET /attachments/:id/download`. Added `LOAN_APPLICATION` to the
  `AttachmentOwnerType` enum and a `fileSize` column (two migrations; existing 21,012 legacy-migrated
  attachment rows get `fileSize = NULL`, harmless since the column is nullable).
- Security: server-generates the storage key (never the client-supplied file name) to avoid path
  traversal, whitelists MIME types (PDF/JPEG/PNG only) and caps size at 10 MB, enforced both in
  multer and again in `UploadAttachmentUseCase`. Upload restricted to MIS/Loan Operation Manager/CRM
  (same roles as loan-application writes); list/download only require authentication.
- Frontend: reusable `AttachmentsPanel` component (built generic against `AttachmentOwnerType` so
  Borrower/LoanAccount pages can adopt it later), wired into the Loan Application Detail page.
  `apiClient.ts` gained `uploadFile()` (raw `FormData`, must not let `apiRequest`'s
  `JSON.stringify` touch it) and `downloadFile()` (fetches as a Bearer-authenticated blob then
  triggers a normal browser save, since a plain `<a href>` can't send the auth header).
- Verified end-to-end in the browser: uploaded a real file via a synthesized `File`/`DataTransfer`
  event on the hidden input, confirmed `POST /attachments → 201`, the file appearing in the list,
  and `GET /attachments/:id/download → 200` on a manual download click.
- Full backend suite re-run after these changes: 525/532 passing (no regressions).

## 10. Migration tooling: ledger + automated status checks

- While investigating why the local database still showed `₱0.00` balances on some real loans
  despite CP12 fixes supposedly already applied, discovered the actual gap: `resolve-address-codes.ts`
  and three balance-recompute follow-up scripts (`migrate-repayment-schedules.ts`,
  `flag-missing-balance-loans.ts`, `recompute-active-loan-balances-from-schedule.ts`) are **not**
  Prisma migrations — `prisma migrate deploy` never runs them, so pulling the commit that added them
  doesn't apply them. Ran all four (after the user supplied a matching July-9 legacy dump), which
  fixed the visibly-broken loan the user had pointed at (`SML-REG_00359` / Raquel Laoreno).
- Wrote `docs/DEVICE_SYNC_GUIDE.md` (fetch/pull-before-push order; the full post-pull checklist:
  `npm install`, `prisma generate`, `prisma migrate deploy`, one-off scripts, Docker rebuild) and
  `docs/Architecture/MIGRATION_LEDGER.md` (dependency order of every one-off script + a per-device
  "who's run what" table), so this class of "did I actually apply that" confusion doesn't recur.
- Wrote `app/backend/scripts/check-migration-status.ts` (read-only PASS/ACTION-NEEDED report per
  known CP12 script) and `app/backend/scripts/check-legacy-sync-safety.ts` (flags which loans have
  "gone native" in the LMS — at least one `LoanTransaction` with no `legacyId` — versus which are
  still safe to rely on a legacy re-import for, since `migrate-legacy-data.ts`'s `update: {}` upsert
  pattern never refreshes an already-migrated loan's balance from a newer dump).
- `check-migration-status.ts` incidentally surfaced a real, pre-existing data inconsistency, not a
  script bug: `SML-REG_00294`'s repayment schedule shows fully paid (every installment, principal +
  interest) but its `status` is still `ACTIVE_IN_ARREARS`, not `CLOSED`. Logged in the ledger for
  manual review — not auto-fixed, since changing a loan's status isn't this script's call to make.

## 11. Reconciling with MIS Nomer's parallel session (Sections 1–6 above)

- Before pushing Sections 7–10's work, `git fetch` showed 2 new commits from MIS Nomer's machine —
  the Payment Recording redesign (Section 6) and its merge commit, both touching `app/backend/src/app.ts`
  (same file this session's Document-module wiring also touched).
- Committed this session's work first in 4 scoped commits (loan-application fixes; cascading
  product assignment + attachments-panel wiring; the Document module backend; `app.ts` wiring), then
  pulled — `git`'s automatic merge resolved `app.ts` cleanly (non-overlapping regions, no manual
  conflict markers). Re-ran the full backend suite post-merge: 530/537 passing (Nomer's 5 new
  manual-allocation tests plus this session's, no regressions), both frontend and backend typecheck
  clean.
- The merge also reintroduced `.claude/launch.json`'s wrong-drive-letter problem (Nomer's commit had
  it as `C:\...`, this machine is `D:\...`) — the two machines had been silently overwriting each
  other's absolute path on every pull. Fixed properly this time: `runtimeExecutable` changed to a
  relative path (`.\.claude\run-frontend.bat`, matching the convention `backend-preview` already
  used), verified working in the browser preview, committed. This should be the last time this
  specific conflict happens.

## Current state (end of this log, both machines' work merged)

- `origin/main` includes everything through both machines' sessions today — Payment Recording
  client-first redesign + manual allocation (Nomer), loan-application encoded-by/product-assignment/
  attachment-upload features (Jomer), and the migration tooling in Section 10.
- Full backend suite: 530/537 passing, 7 intentionally skipped. Both frontend and backend typecheck
  clean.
- Known follow-ups carried forward: PSGC reference tables still need the right legacy dump path to
  populate (Section 6's note); `backup-mongodb.bat` still not run against the real remote server;
  manual allocation mode still has no dedicated integration test; `SML-REG_00294`'s
  status/schedule mismatch (Section 10) needs a human decision, not a script fix; the OCR/auto-fill
  half of the attachment feature (Section 9) is deliberately not started, pending a business decision
  on cloud vs. local OCR.
