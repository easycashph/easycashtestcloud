# Session Log: 2026-08-25 (Nomer Laptop) — SOA fix, scroll-bug fix, Mambu notes script, Exports permission + Cancel + redesign

Continues `docs/session-logs/Nomer Laptop/SESSION_LOG_2026-08-24_gdrive_incident_and_mambu_notes_recovery.md`.

## 1. SOA Collection Fee formula correction

User flagged the Collection Fee formula on Create SOA was wrong, with a reference Excel file:
`legacy/reports/PENALTY AND ACCRUED SAMPLE COMPUTATION FOR SOA.xlsx`. Read it via an ad-hoc
`exceljs` script (already a backend dependency) — confirmed the correct formula is
`Collection Fee = (Past Due Amount + Penalty) × Collection Fee %`, not `Accrued Interest × %` as
the code had it.

Fixed in `app/lmsfrontend/src/pages/LoanDetailPage.tsx` (~line 2055): `collectionFeeAmount` now
multiplies against `totalPastDue` instead of `accruedInterest`; updated the on-page hint text and
doc comment to match. Verified against the Excel sample's own numbers (10% × ₱70,682.14 =
₱7,068.21 ✓) with a standalone arithmetic check before shipping. Commit `d62bfe7`.

## 2. Removed "Download All Documents" button from Loan Account page

User asked to remove the MIS-gated "Download All Documents" button that sat above the Loan
Accounts list on `LoanDetailPage.tsx` — this became redundant once the dedicated Exports feature
(bulk export by date range, see §5 below) existed. Removed the button, its handler, its error
banner, and the now-unused `Loader2` import. Commit `f978de6`.

## 3. Whole-page-scroll bug (recurrence)

User reported the whole LMS scrolling as one page instead of just the content area. This is a
**known, previously-documented recurrence class** — `AppLayout.tsx` already carried a comment from
an earlier incident describing the same symptom. Root cause: `h-dvh` (dynamic viewport height) can
over-report the visible area vs. the actual usable space above the Windows taskbar at certain
zoom/DPI combinations. Fixed by swapping to `h-svh` (small viewport height — spec-guaranteed to
never exceed the actual visible viewport) rather than reverting the sidebar/main-scroll layout
architecture, per the original comment's own "flag it, don't revert" instruction. Commit `f40ae33`.

## 4. Mambu (pre-SDevTech) database investigation and notes-recovery script

User supplied a pre-2023 Mambu MySQL dump (`legacy/Easycash-20231115T012529Z-001.zip`, 240MB
zipped / 1.1GB extracted) — the system used before SDevTech. Investigated two questions:

- **Address recovery**: only 14 address rows exist in the *entire* Mambu database vs 4,413
  clients — confirms the address gap (see prior session's 92%-missing-address investigation)
  predates SDevTech and goes back to Mambu itself. Negligible recovery value; not pursued further.
- **Loan account notes/comments recovery**: Mambu's `comment` table has 20,707 rows, 18,796 tied
  to a `loanaccount` via `PARENTKEY`. Confirmed `loanaccount.ID` uses the same `{productCode}_{code}`
  format as this system's `LoanAccount.loanCode`, and SDevTech's own `client_accounts.uid` field
  IS the original Mambu `client.ENCODEDKEY` (already mirrored into `Borrower.legacyId`) — so Mambu
  data joins directly onto current borrowers/loans with **no extra mapping table needed**. 1,190 of
  5,699 Mambu loan accounts match a current `LoanAccount.loanCode`, yielding **9,232 importable
  comments**.

Built `app/easycashbackend/scripts/migrate-mambu-notes.ts` — a from-scratch mysqldump parser
(byte-offset/Buffer-based, not `readline`, because some legacy text fields contain literal
embedded newlines that broke line-based parsing on the first attempt) following this codebase's
existing CP12 migration conventions (`legacyId @unique` idempotent upsert, dry-run vs `--apply`,
`Reconciliation` helper). **Committed and dry-run-verified only (`aa76641`) — not yet applied
anywhere.** User wants this run on the **Office Server PC** (the "main" database) after manually
transferring the Mambu zip there; exact PowerShell extraction + dry-run + apply steps were given
but not yet executed as of this log.

`.gitignore` updated to exclude the Mambu zip/extracted SQL (same PII class as the SDevTech dumps
already excluded).

## 5. Exports feature: permission system, Cancel, and visual redesign

Multi-part feature arc, all under Administration > System, driven by several rounds of explicit
user requests this session.

### 5a. Moved onto the DB-backed permission system

Previously `requireRole('MIS')` hardcoded on the backend and `roles.includes('MIS')` hardcoded on
the frontend. Per user request ("ilagay ang export features ng lms sa permission... Toggle ON
lamang ito sa MIS"), converted to `requirePermission('bulk_export.use')` /
`hasPermission('bulk_export.use')`, with the permission granted to MIS only by default via
`seed.ts` — same effective restriction, now configurable from Roles & Permissions without a code
change.

**Bug found and fixed in the same pass**: `RolesPermissionsTab.tsx`'s module-grouping logic
silently dropped any permission whose code prefix had no `MODULE_META` entry — `bulk_export`,
`system_announcement`, and `chat_canned_response` were all invisible in the Roles & Permissions UI
because of this. Added the missing `MODULE_META` entries and an `'Other'` catch-all so future
permission additions can't silently vanish the same way. Commit `c3e8ed9`.

### 5b. Cancel Export

User asked, mid-session, to be able to cancel a stuck/long-running export. This codebase
deliberately has no job queue (documented rationale already present in
`ProcessBulkExportJobUseCase.ts`), so cancellation is a new in-process
`BulkExportCancellationRegistry` — a `Map<jobId, AbortController>` — checked between records
(attachment exports) or used to kill the `pg_dump` child process (database dumps), with partial
output files cleaned up in both cases. New `CANCELLED` status added to `BulkExportStatus`
(migration `20260825032854_add_bulk_export_cancelled_status`).

Design was mocked up first (published Artifact, "Export Ledger") per the user's explicit
mockup-before-implementation preference, including a follow-up edit to add the inline
confirm-in-place Cancel interaction shown in the final UI. **Live-verified with a real functional
test**, not just `tsc --noEmit`: a temporary script created a genuine 4,610-record export job
against the live local database, cancelled it mid-flight (~300ms in), and confirmed the DB status
transitioned to `CANCELLED` with the partial `.zip` correctly deleted. Commit `bf9ff78` (backend)
+ `a4cad12` (frontend wiring, bundled with 5c below).

Mid-troubleshooting note: when the user first asked to cancel a stuck export, I initially assumed
it referred to the live office server (given earlier screenshots were from the live domain) and
asked about restarting *that* backend. User corrected: this was localhost on this laptop, not
live. Restarted the local backend and manually marked the already-stuck job `FAILED` in the DB
(restarting the process alone doesn't update a job left `PROCESSING`).

### 5c. Visual redesign to match the "Export Ledger" mockup

After Cancel shipped, user compared the real page to the earlier mockup and asked for the full
visual treatment: stat strip (Total Requested / Completed / In Progress), icon chips per export
type, status pills with a colored dot, tabular-nums right-aligned numeric columns, pill-style
action buttons. Implemented in `BulkExportsPage.tsx`, `BulkExportDialog.tsx`, and
`DatabaseExportButton.tsx` (the latter two gained a `triggerClassName` prop so their trigger
buttons could be restyled without duplicating the dialog logic) — reusing the app's real
navy/gold CSS tokens throughout, no hardcoded colors.

**Deliberately skipped** the mockup's Fraunces display serif: investigation found the real app
currently loads **no webfont at all** anywhere (`tailwind.config.ts` declares Inter, but no
`<link>`/`@font-face`/fontsource package actually loads it — every page silently falls back to
`system-ui`). Adding Fraunces to just this one page would have looked inconsistent with the rest
of the LMS; flagged this as a separate, bigger app-wide decision rather than deciding it
unilaterally. Commit `a4cad12`.

### 5d. Moved Exports from a standalone header button into the System tab row

User asked where Exports should live, since it was the only non-tab control on the System page.
Mocked up a before/after (button → tab, published Artifact) before touching code, showing the
proposed placement as the last tab (newest section, least-frequently-used role gate). User
approved ("ituloy mo na ang bukod na Export Tab").

Implemented: `BulkExportsPage` gained an `embedded?: boolean` prop that hides its own "Back"
button when rendered inside another page's layout; `SystemPage.tsx` added `'exports'` to its tab
type/list and renders `<BulkExportsPage embedded />` for it, removed the header button entirely.
The standalone `/exports` route was left in place (used by the notification bell's deep link when
an export completes). Commit `4146567`.

## 6. Tabs component: missing hover state (shared component fix)

User pointed out that hovering over the System page's tab row gave no visual feedback at all —
couldn't tell which tab the cursor was over before clicking. Traced to `components/ui/tabs.tsx`'s
`TabsTrigger`: it styled `data-[state=active]` only, with no `hover:` state whatsoever. Added
`hover:bg-background/60 hover:text-foreground` (plus `data-[state=active]:hover:bg-background` so
the active tab doesn't visually dim on hover). This is the shared Tabs primitive used across the
whole app, not just System, so the fix applies everywhere tabs are used. Commit `c1bb69a`.

## 7. SOA Collection Fee — second correction (accrued interest was still missing)

User re-checked the same Excel sample (`PENALTY AND ACCRUED SAMPLE COMPUTATION FOR SOA.xlsx`)
after the §1 fix shipped and found the sheet's own Collection Fee cell is actually
`=(F9+F12)*C17` — F9 is "TOTAL PAST DUE + PENALTY", but **F12 (Accrued Interest) is also part of
the base**, which the §1 fix had omitted. Corrected `LoanDetailPage.tsx`'s `collectionFeeAmount`
to `(totalPastDue + accruedInterest) * (collectionFeePercent / 100)`, and the on-page hint text to
say "Past Due Amount + Penalty + Accrued Interest". Verified against the sheet's own numbers with
a standalone arithmetic check: 10% × (₱70,682.14 + ₱210,255.79) = ₱28,093.79 ✓, matching the
Excel's computed result exactly. Commit `c1bb69a`.

## 8. Attachments: show who uploaded, and flag legacy-migrated rows

User asked whether attachments could show who uploaded them, and whether a migrated attachment
could be flagged as coming from Mambu or SDevTech. Investigation: `uploadedByName` was already
returned by the API and already rendered in `AttachmentsPanel.tsx` (this was already working,
just not something the user had noticed) - free win, no code needed for that half. For the
source system: skipped a dedicated Mambu-vs-SDevTech field since only SDevTech attachments were
ever migrated (Mambu's own documents were never recovered, only its loan notes were, per §4 of the
prior day's log) - so `legacyId != null` already means "from SDevTech" unambiguously.

Added a new `isLegacyMigrated` boolean threaded through the whole chain -
`IAttachmentRepository.AttachmentRecord` → `PrismaAttachmentRepository.toRecord` (`row.legacyId !==
null`) → `AttachmentPresenter` → frontend `Attachment` type → `AttachmentsPanel.tsx`, which now
shows "Migrated from legacy system" instead of "Unknown" when `uploadedByName` is null but the row
is legacy-migrated. Commit `2c32422`.

Same pass: removed the "Download All Documents" button from `ClientProfilePage.tsx` (per user
request) - same reasoning as the earlier Loan Account page removal, redundant with the dedicated
Exports feature. Commit `2c32422`.

## 9. Notifications: overdue-loan alerts now include the borrower's name

User asked to add the client's name to overdue-loan notifications (previously just "Loan
{loanCode} is overdue"). `NotificationService.syncOverdueNotifications` now reads a
`borrowerName` field added to `findOverdueLoanAccounts`'s raw SQL (joined `borrowers b ON b.id =
la."borrowerId"`, `(b."firstName" || ' ' || b."lastName") AS "borrowerName"` - safe, `loan_accounts.
borrowerId` is non-nullable), and the title is now `Loan {loanCode} ({borrowerName}) is overdue`.
**Only affects newly-created notifications going forward** - existing rows in the DB keep their old
title text (not retroactively rewritten), and since there's a 24-hour resync window per loan
(`OVERDUE_RESYNC_WINDOW_HOURS`), the first notification with the new format for any given
already-overdue loan may not appear until that window elapses. Commit `2c32422`.

## 10. Settings page whole-document scroll bug — real root cause found and fixed

Third occurrence this week of "the whole page scrolls instead of just the content," this time
user-confirmed to be **Settings-page-specific, not global** - every other page scrolled correctly.
That ruled out the §3 (2026-08-25) `h-dvh`→`h-svh` swap as ever having been a real fix: `dvh`,
`svh`, and plain `vh` are all identical on desktop Chrome (the distinction between them is a
mobile-only feature - toolbar show/hide - which doesn't exist on desktop), so that swap changed
nothing and the underlying bug was never actually addressed, just coincidentally not reproducing
for a while.

Diagnosed live via the user's own DevTools console (three rounds of guided diagnostics, since no
login credentials are available in this dev environment for me to reproduce it directly):
- `document.body.scrollHeight` matched `window.innerHeight` (730 = 730), but
  `document.documentElement.scrollHeight` was 949 - confirmed real document-level overflow, ~219px.
- `getComputedStyle` showed `overflow: visible` on both `html` and `body` despite a CSS rule of
  `html, body, #root { height: 100%; overflow: hidden; }` having been added and deployed - the
  build's CSS minifier was silently dropping `overflow: hidden` from that rule entirely (confirmed
  by grepping the actual compiled CSS in the running container: only `height:100%` survived).
  Rewriting it as three separate single-selector rules (`html {...}`, `body {...}`, `#root {...}`)
  instead of one comma-separated selector list fixed the minifier's stripping and immediately
  resolved the scroll bug (re-verified via a DOM walk finding zero elements exceeding
  `window.innerHeight`).

Net fix: `html`/`body`/`#root` in `index.css` now carry explicit `height: 100%; overflow: hidden;`
(as three separate rules, not one combined selector), and `AppLayout.tsx`'s outer shell changed
from `h-svh` to `h-full` - height is now anchored to the box model instead of a recalculated
viewport unit, which is what was actually susceptible to whatever measurement quirk was inflating
`documentElement.scrollHeight` by ~219px in the first place. This is a more durable fix than either
of the two prior same-bug-class fixes (`h-dvh`→`h-svh` on 2026-08-25, the original document-scroll→
independent-scroll-panes redesign referenced in `AppLayout.tsx`'s own older comment) since it no
longer depends on any `*vh` unit's accuracy at all. Commit `2c32422`.

## Current state / follow-ups for next session

- **`migrate-mambu-notes.ts --apply` not yet run anywhere** — dry-run confirmed (9,232 notes),
  needs the Mambu zip manually transferred to the Office Server PC first.
- **Google Drive cleanup**: scheduled task disabled, user confirmed which items to delete, but as
  of last check Trash had not yet been emptied and no credentials had been rotated. Replacement
  backup approach (scoped rclone sync of `local\backups\` only) recommended but not yet set up —
  user wants to do this on the Office Server PC.
- Exports feature (permission system, Cancel, redesign, tab placement) is now fully shipped and
  pushed to `main`. Office Server PC needs `git pull` + rebuild of `easycashbackend` (for the
  Cancel Export backend + `CANCELLED` migration — remember to check
  `prisma migrate status`/`migrate deploy` after rebuilding) and `lmsfrontend` (all four parts).
- Everything through §10 is now committed and pushed to `main` (`c1bb69a`, `2c32422`). Office
  Server PC needs `git pull` + rebuild of both `easycashbackend` and `lmsfrontend` for §6-§10 —
  no new Prisma migration in this batch, so no `migrate deploy` needed for these specifically.
- Carried over, still untouched: the ₱19.3M post-maturity-penalty correction (user "thinking it
  over"), and accrued interest on long-defaulted accounts (flagged as likely significant, never
  examined).
