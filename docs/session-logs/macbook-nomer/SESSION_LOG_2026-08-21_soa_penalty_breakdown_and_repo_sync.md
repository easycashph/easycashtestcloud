# Session Log — 2026-08-21 (MacBook Nomer): repo sync/migration recovery, LAN IP fixes, SOA on-screen penalty breakdown

## Context

Session running on Nomer's MacBook (his secondary dev machine and LMS backup laptop, distinct from
the Office Server PC which is the real/main server, and from his separate Laptop Nomer machine —
see the `project-office-server-vs-macbook` memory). This Mac's local Postgres/Docker stack had
drifted significantly behind `origin/main` (many days of other sessions' work across the Office
Server PC and elsewhere), so most of this session was catching this machine back up before the
actual feature work at the end.

## 1. Repo sync recovery (repeated across the session)

`git pull` was run many times over the course of the session, each time pulling in anywhere from a
handful to 100+ commits from other sessions (Add Fee feature, Add Penalty/kill-switch, on-screen
report tables, MIS Portal Posts, Portal chat BPO redesign, Roles & Permissions, Document Templates
admin config, and much more — see the individual commits in `origin/main`'s history for full
detail, not repeated here). Recurring pattern each time: `git fetch` → `git pull --ff-only` (or a
plain merge when this machine also had a local unpushed commit) → `npx prisma migrate deploy` for
any new migrations → `npx prisma generate` → `npm install` in whichever app(s) changed → `npx tsc
--noEmit` on backend and frontend → `docker compose up -d --build`. Every migration was checked for
`DROP TABLE`/`DROP COLUMN`/`TRUNCATE`/`DELETE FROM` before applying — all were purely additive or
narrow column drops on now-superseded fields (e.g. `undoneAt` after the Undo Restructure feature's
delete-based redesign).

**One large structural pull mid-session**: the top-level `app/{backend,frontend,portal}` folders
had been renamed to `app/{easycashbackend,lmsfrontend,portalfrontend}` by a commit already merged
before this session started, but this Mac's checkout still had a pending local reorg of its own
scripts. Handled by re-copying `.env` files into the new directory names and updating the 3
`.command` launcher scripts' internal paths to match.

**Root scripts moved into `scripts/`**: a later pull relocated every root `.bat`/`.command` file
(including this machine's own `Update LAN IP.command`, `Update Database From SDevTech.command`,
`Backfill SDevTech Attachments.command`) into `scripts/`. The git rename correctly carried over an
already-fixed `ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"` (the extra `/..` for the
new depth), but the executable bit was lost in the process on this checkout — reset with `chmod +x`
after every pull that touches these files.

## 2. Test account cleanup

At the user's request, purged 10 test `Borrower` records entirely — both Nomer's own (`TESTNOMER`,
`TEST2NOMER`, `TEST3NOMER`, `TEST4COB`, `TESTCONTACT`) and 5 other staff members' (`BHENZII TESTA`,
`JAY TEST`, `KABORROW TESTING`, `ROXANNE TESTONLY`, `TEST PAYLATER`) after explicit confirmation on
each batch. Cascading delete written as a single hand-built SQL transaction (temp tables of ids,
children deleted in FK-dependency order, borrowers last) rather than one-by-one API calls, since
several had real `ACTIVE` loan accounts with schedules/transactions/`payment_allocations` attached.
First attempt errored on a missed `payment_allocations` FK and rolled back cleanly with no partial
damage; second attempt (with that table added to the delete order) succeeded.

## 3. SDevTech re-sync + balance integrity follow-up

Ran the full `Update Database From SDevTech.command` pipeline against a newer legacy export
(migrate-legacy-data → migrate-repayment-schedules → recompute-active-loan-balances-from-schedule →
check-legacy-balance-integrity), interrupted once mid-run by an actual Mac shutdown and resumed
cleanly (every step in the pipeline is idempotent/resumable by design). The integrity check flagged
4 loans reading ₱0 `principalBalance` despite a genuine unpaid schedule balance — the known
"raw SDevTech record has no account-level balance snapshot at all" class of bug. 3 were already
covered by an existing one-off script (`backfill-newly-discovered-missing-balance-loans.ts`, just
never run against this machine's freshly-rebuilt database); the 4th (`SP-Easy_00001`) was new, so a
second small script (`backfill-newly-discovered-missing-balance-loans-2.ts`) was added rather than
extending the first (whose own doc comment explains why its specific 3 loans needed the fix —
mixing in an unrelated later discovery would blur that history).

Also ran `Backfill SDevTech Attachments.command` (SFTP credentials were missing from this machine's
`.env` — user supplied them, added under a new `SDEVTECH_SFTP_*` block) — 21,312 of 21,319
attachment files downloaded successfully.

## 4. Roles & Permissions seed gap

After a fresh migration run, every report/reports-adjacent page 403'd for the MIS role
("Could not load the transaction report") despite MIS normally being the super-user role. Root
cause: `prisma/seed.ts`'s permission list had grown from 12 (old colon-style codes like
`audit_log:read`) to 33 (new dot-style codes like `report.view`) across the commits already merged
into `origin/main`, but the seed script itself had never been re-run on this machine's rebuilt
database. Fixed by running `npx tsx prisma/seed.ts` directly (`npm run seed` failed with a
monorepo-path npm quirk, worked fine invoked directly) — safe to re-run, everything is
`upsert`-based.

## 5. LAN IP drift (recurring)

This machine's LAN IP changed at least three times across the session (`.50` → `.25`, plus an
earlier `.2` → `.50`), each time requiring the same manual fix `Update LAN IP.command` automates:
detect the current IP, replace only the old LAN-shaped `CORS_ORIGIN` entry (preserving the
`easycash-lms.pages.dev`/`easycash-portal.pages.dev` Cloudflare origins), update
`VITE_API_BASE_URL`, rebuild the frontend (IP is baked into the bundle at build time), restart the
backend (`CORS_ORIGIN` is a runtime env var, no rebuild needed). At the user's request, renamed the
script to `Update LAN IP (Macbook-Nomer).command` to match the existing `(Laptop-Nomer)` naming
convention on this machine's Windows sibling, since all three of the user's machines now have their
own differently-named copy.

## 6. SOA on-screen penalty computation table (the actual feature work)

User request, mockup shown first: display a per-installment penalty computation table in the
Create SOA dialog's COMPUTED mode, matching the shape of the user's own Excel reference tool
(FROM/TO/PRINCIPAL/INTEREST/DAYS LATE/PENALTY per row, totals row, plus a separate "Accrued
interest computation" section and a Total Obligation figure) — confirmed via `AskUserQuestion`
that this required a real backend change (the calculator only ever produced aggregate totals, no
per-row breakdown existed anywhere) before starting.

- **Backend** (`StatementOfAccountCalculator.ts`): added `PenaltyBreakdownRow[]` (one row per
  past-due installment that contributed to `pastDuePenalty`, populated under both `RECORDED` and
  `COMPUTED` modes, empty under `MANUAL` since there's no per-installment figure there) and a
  single-row `AccruedInterestBreakdown`, both returned alongside the existing scalar totals. Not
  yet persisted to the `GeneratedStatementOfAccount` record itself (would need new jsonb columns +
  a migration) — scoped to the live preview only for now.
- **Frontend** (`LoanDetailPage.tsx`): the Create SOA dialog already computed a full client-side
  mirror of the backend calculator for a live, no-round-trip preview as staff type dates
  (`soaPreview` memo) — ported the same row-collection logic into that existing duplicate rather
  than wiring a new backend preview endpoint, so the live-typing UX stays instant. Rendered as a
  collapsible `<details>` table under "Recompute every installment" (Penalty computation) and
  inside the Accrued Interest card (Accrued interest computation), both collapsed/hidden by default
  so a loan with a long schedule doesn't dominate the dialog.

**Bug found and fixed in the same feature**: the new default-date logic for Penalty From/To (and,
by extension, the pre-existing Accrued Interest "As of date" default) used
`date.toISOString().slice(0, 10)` to pre-fill the date inputs — reads the **UTC** calendar day, one
day earlier than the correct **Manila** day for any due date stored as Manila-midnight-as-
`T16:00:00Z` (the majority of this system's dates). Exactly the bug class `manilaTime.ts`/
`manilaDaysBetween` already exist to prevent, just newly reintroduced in a date-*formatting* path
rather than a day-*counting* one. Fixed by adding `manilaDateInputValue()` to `utils.ts` (same
+8-hour-shift-then-read-UTC-fields pattern as `manilaDaysBetween`) and using it everywhere a date
input gets a computed default in this dialog.

**Date-default rules, per user's explicit spec**:
- Penalty From date: the due date of the earliest installment that is not yet fully paid (any
  unpaid Principal + Interest > 0), regardless of whether it already has a penalty on record —
  simplified from the previous "earliest *blank* installment" rule, which silently fell back to
  installment #1's due date (paid or not) whenever every installment already had *some* recorded
  penalty.
- Penalty To date / Accrued Interest As-of date: the loan's maturity date once actually matured,
  otherwise today (Manila calendar day) — both re-applied every time the dialog opens, not just on
  first mount.

## 7. Penalty computation table totals bug (found via user screenshot)

The new table's totals row (Principal/Interest columns) disagreed with what its own visible rows
summed to. Root cause: `pastDuePrincipal`/`pastDueInterest` in both the backend calculator and its
frontend mirror are accumulated for every past-due installment unconditionally, near the top of the
loop — but the COMPUTED-mode branch that pushes a `penaltyBreakdown` row used to `continue` early
(skipping the push entirely) whenever an installment's own days-late worked out to 0 (e.g. an
installment due exactly on the penalty cutoff/maturity date), even though its principal/interest
had already been folded into the running totals a few lines earlier. Net effect: an installment
could be silently invisible in the table yet still counted in the total beneath it.

Fixed two ways, mirrored in both `StatementOfAccountCalculator.ts` and the `soaPreview` client
copy: (1) every past-due installment now always gets a breakdown row, even at 0 days late/0
penalty (rendered as "—" for the penalty cell) — matching the user's own Excel reference tool,
which shows exactly such a row rather than omitting it; (2) as a second, independent safety net,
the table's own totals row now sums directly from the rendered `penaltyBreakdown` array
(`.reduce(...)`) instead of reusing the separate `pastDuePrincipal`/`pastDueInterest`/
`pastDuePenalty` scalars, so the two can never disagree again even if a future edit reintroduces a
similar gap. Also dropped the old "Days" / "Installments filled in" summary counters above the
table — redundant now that the table itself shows the same information per row — and left the
table expanded (`open`) by default in their place.

## 8. Collection Fee changed to a percentage input

User request: Collection Fee should be entered as a **percentage of the Accrued Interest amount**,
not typed in as a peso figure directly — `Collection Fee amount = Accrued interest amount x
entered percent`. Confirmed this applies to every loan account's Create SOA dialog (the single
shared dialog component, not gated per loan type/product).

Implementation stayed entirely client-side: renamed the state to `soaCollectionFeePercent`,
computed `collectionFeeAmount` inside the existing `soaPreview` memo (`accruedInterest x
(percent / 100)`, rounded to 2 decimals) and used that computed figure both in the on-screen Total
Amount Due and in the actual `POST /statements-of-account` payload sent to the backend — the
backend's own `collectionFee` field is unchanged (still a plain peso decimal string), so no
backend/schema change was needed. The input now shows a small live line underneath it (e.g. "10%
of accrued interest = ₱1,234.56") so staff can see the computed peso figure without leaving the
field.

## 9. SOA penalty-mode label wording

Renamed the "COMPUTED" penalty-mode radio option in the Create SOA dialog from "Compute the
missing ones" to **"Compute Missing Entries"** for a more formal banking-UI tone, per user request
(went through a few label suggestions in chat before landing on this one). Purely a copy change in
`LoanDetailPage.tsx` — no logic touched. Frontend container rebuilt and confirmed healthy.

## 10. Portal: "Product" dropdown added to the top navigation

User asked to add a "Product" item to the public Portal's top nav (`LandingPage.tsx`'s `Navbar`).
Mocked up two variants first (plain link vs. a dropdown) via an Artifact and got explicit sign-off
on the dropdown variant before touching code, per the standing mockup-before-UI-changes rule.

Implementation reused the existing `LOAN_PRODUCTS` catalog (`app/portalfrontend/src/lib/
loanProducts.ts`) rather than inventing new product copy — this is the single source of truth
already shared with the Products section further down the same landing page, the Loan Calculator
widget, and the actual application form, so the dropdown can never drift out of sync with what's
really offered. Per user's explicit product selection ("Seafarer, Personal at MSE"), all 3 active
products in the catalog are shown (SME Loan, Personal Loan, Seafarer Loan — Easycash currently has
no others), each with its icon, `displayLabel`, and localized `blurb`, linking to `/signup`; a
"See all products" footer link jumps to the existing `#products` anchor section.

Added `nav.product` / `nav.productFull` / `nav.seeAllProducts` translation keys (English + Filipino)
in `app/portalfrontend/src/lib/i18n/translations.ts`, matching the existing nav key style. Desktop
nav shows a hover/click dropdown panel (2-column grid) positioned first, before Requirements/News/
Security. Mobile nav shows the same 3 products as a flat indented list under a "Our Loan Products"
heading, consistent with how the other mobile nav sections are laid out.

Verified: `npx tsc --noEmit` clean; `portalfrontend` Docker container rebuilt and healthy; dropdown
visually confirmed in the Browser preview in both dark and light theme (hover interaction, icons,
descriptions, "See all products" link all render correctly). Mobile hamburger-menu open/close could
not be click-verified in this session due to a Browser-tool timeout quirk unrelated to this change
— the mobile markup reuses the exact same list pattern already working for Requirements/News/
Security, so risk is low, but worth a manual phone check next time this machine is used.

## 11. Portal: removed Personal Loan eligibility note and the public bank account card

Two display-only removals, both per explicit user request, neither changing any underlying
business rule:

- Removed the "For private-sector employees only..." note shown on the Personal Loan card
  (`eligibilityNote` field on the Salary Loan entry in `app/portalfrontend/src/lib/
  loanProducts.ts`). Confirmed with the user first: Easycash still does **not** accept government
  employees for this product — only the visible note is gone, not the actual restriction (that
  restriction isn't enforced anywhere in code today; it was UI-only messaging). Cleaned up the two
  now-dead `'eligibilityNote' in product` render checks in `LandingPage.tsx` and
  `RequirementsPage.tsx` rather than leaving them as no-ops.
- Removed the "Payment to Official Bank Account" card (BDO account details) from the public
  landing page's "Ways to Pay" section — user wants the bank account no longer shown there. The
  two payment-method tiles (Bank Transfer / Post-Dated Check) stay. This only touches the public
  landing page; the equivalent card on the authenticated Dashboard
  (`PortalOfficialBankAccountCard.tsx`) and the `OFFICIAL_BANK_ACCOUNT` constant itself in
  `companyInfo.ts` were left untouched — the account details are still shown to logged-in
  clients, just not to anonymous visitors on the marketing page.

Verified: `npx tsc --noEmit` clean; `portalfrontend` Docker rebuild hit a transient Docker Hub TLS
timeout on the first attempt (`docker compose up -d --build`), diagnosed via its logs, then
resolved by rebuilding the image directly (`docker compose build portalfrontend`) followed by
`docker compose up -d portalfrontend` - confirmed both the note and the bank account card are gone
from the live page afterward.

## 12. Portal landing page: photo mockups explored (not yet implemented)

User asked to explore adding real photos to the Portal landing page's hero and the 3 product
cards (`hero-seafarer.jpg`, `product-business.jpg`, `product-salary.jpg`, `product-seafarer.jpg`
— the 4 slots already documented in `app/portalfrontend/public/images/README.md`, currently empty
so the page falls back to icon placeholders). Per the standing mockup-before-UI-changes rule,
several rounds of mockups were built and shown via Artifact before touching any code — **no code
was changed in this exploration**, everything below happened only in the chat/Artifact.

Sequence of directions tried, each shown as a separate mockup and iterated on user feedback:

1. **Direction A** - real photos cropped from the old `New Website picture/` folder (2016-2017
   Easycash campaign posters), text/logo overlays cropped out. User rejected this - didn't want
   photos from that old folder.
2. **Direction B** - photo-free, abstract/illustrative: gradient hero art with a line-art
   "compass and sail" motif, an editorial serif (Fraunces, paired with the portal's existing Plus
   Jakarta Sans) added for headlines, brass/gold accent added alongside the existing Emerald
   brand color. User then asked for actual images of people/objects instead of pure abstraction.
3. **Direction C** - original flat-style SVG illustrations (not photos) of a seafarer at a ship
   rail, a market stall owner, and someone reviewing a payslip, in the same emerald+brass
   palette. User then explicitly asked for **real people**, not illustrations.
4. **Direction D** - real, freely-licensed stock photography sourced from Unsplash (Unsplash
   License, free for commercial use, no attribution required) after asking the user's explicit
   permission to search and download external images (per the standing download-permission rule).
   Cropped/graded 4 photos to fit the exact 4 required slots: a ship-deck sunset shot for hero,
   two crew members on a teal-water deck for Seafarer Loan, a candid office portrait for Personal
   Loan, and (after two more rounds of swaps per user feedback - first "big business" workshop
   owner, then a suited "businessman", then a symmetric city skyline - none of which stuck) a
   small online seller packing shipping boxes for SME Loan.
5. Checked the live `easycash.ph` site as a design reference per user request (navigated with the
   Browser tool, dismissed a data-privacy consent overlay via JS to see the page underneath).
   Confirmed the real site's product pages use literal, on-theme photography rather than
   abstraction - an actual cargo ship for Seafarer Loan, a laptop + shipping boxes for SME Loan
   (small online seller framing), and a rubber stamp + coins + a house model for Personal Loan.
   The SME Loan mockup photo was swapped to match that same "small online seller" framing instead
   of the corporate-skyline direction, to stay consistent with how Easycash already positions
   this product. Also confirmed the live nav pattern: "Seafarer Loan" as a direct top-level link
   (flagship product) plus an "Other Products" dropdown for Personal Loan and SME Loan - worth
   revisiting if the Portal's earlier `Product` dropdown work (see §10) should be restructured
   to match.

User paused the work here ("stop muna natin") before approving a final direction or asking for
implementation. **Nothing was written to `app/portalfrontend/public/images/` and no component code
was touched** - the 4 candidate photos only exist embedded in the throwaway mockup Artifact
(`portal_real_photos_mockup.html`, in this machine's session scratchpad, not the repo). Whoever
picks this up next should re-show that mockup (or rebuild it) and get explicit sign-off on the
final photo set before saving real files into `public/images/` and wiring them into
`LandingPage.tsx`.

## 13. Loan SL-LAZ_Y1T1R (FAYE MARIE ELEONOR GO LEJERO) - status/balance mismatch investigated on this Mac, RESOLVED on the Office Server PC

**Update (same day, pulled from `origin/main`):** resolved on the Office Server PC (see
`docs/session-logs/Office Server PC/SESSION_LOG_2026-08-14_office_server_move_and_manual_payment_
adjustment.md` §43) - root cause was that this loan's real payoff was a legacy-migrated
`REPAYMENT`, so it never passed through `ProcessPaymentUseCase`'s auto-close logic. Fixed directly
against the live database there: `principalBalance`/`interestBalance` corrected to 0.00, status
transitioned `ACTIVE_IN_ARREARS -> CLOSED`, and a native `ADJUSTMENT` transaction recorded as a
true-up entry that also permanently locks this loan (`lockedLoanAccountIds` in
`migrate-legacy-data.ts`) against ever being silently overwritten by a future SDevTech re-sync.
Confirmed isolated (full-database scan, no other matches) - no broader migration-script change was
needed. The investigation below is this Mac's own read-only trail from earlier the same day, kept
for context on how the diagnosis unfolded before the fix landed elsewhere - it's superseded by §43,
not a second source of truth.

## 13a. Original investigation on this Mac (superseded by the fix above)

User reported: this loan shows "in arrears" even though they believed it was closed with zero
balance. Investigated via two background agents plus direct DB queries (all read-only, no writes
made):

**Postgres findings**: `loan_accounts.status = ACTIVE_IN_ARREARS`, `closedAt = NULL`, outstanding
balance ₱1,249.90 (principal ₱1,000 + interest ₱249.90) - i.e. genuinely not closed, not zero, at
the account-aggregate level. The confusion likely comes from the **installment-level**
`repayment_schedules` row, which shows `status = PAID` with zero due - that's what probably reads
as "closed, zero balance" on whatever screen the user was looking at, while the account-level
aggregate (what actually drives the stored `status`) disagrees.

Full transaction ledger for this loan (all rows carry a `legacyId`, all inserted in the same
migration batch on 2026-07-23 - i.e. this is exactly what SDevTech's own historical ledger
contains, not something generated by this app's runtime):
`DISBURSEMENT 1000 -> INTEREST_APPLIED 249.90 -> PENALTY_APPLIED 124.99 (Mar 2025) -> REPAYMENT
1249.90 (Jul 14 2025, balance to 0, which per current `ProcessPaymentUseCase` logic would
auto-close the loan) -> two zero-amount ADJUSTMENT entries (same timestamp) that reinstate the
1249.90 balance -> a second PENALTY_APPLIED 124.99 (Jul 15 2025)`. Confirmed via a Postgres query
that this loan is the **only** one in the entire database matching this exact
"REPAYMENT-zeroed-then-same-timestamp-ADJUSTMENT-reinstated" pattern - an isolated case, not a
fleet-wide issue.

**User's initial ask**: reverse the two erroneous ADJUSTMENT entries (and the resulting penalty)
so the loan ends up CLOSED with zero balance again, "since in SDevTech this is a closed account."
Started drafting the fix as a proper idempotent script (following this repo's existing
`scripts/backfill-close-fully-paid-loans.ts` / `scripts/flag-non-reconciling-closed-loans.ts`
conventions - additive `REVERSAL`-type transactions referencing `reversesTransactionId`, never
deleting/editing the legacy rows, per this project's "never fabricate financial logic" /
ADR-007 §4 precedent) - **but did not execute it**, because a check of this machine's local
legacy MongoDB backup contradicted the premise first (see next).

**Checked this Mac's local legacy MongoDB backup** (`legacy/mongodb/extracted/20260814_231610/
db-easycash`, via `bsondump`) as the "go to the source" step the user asked for. Found the loan in
the raw `loan_accounts` Mongo collection itself shows `accountState: "ACTIVE_IN_ARREARS"`,
`closedDate: null`, `fullyPaid: false`, `principalBalance: 1000`, `interestBalance: 249.9` - i.e.
**the exact same mismatch already exists in SDevTech's own raw account-level data**, not something
introduced by our migration. The `repayments` collection (installment-level) does show
`state: "PAID"`, matching what's in our `repayment_schedules` - so the same
installment-says-paid-but-account-aggregate-disagrees split exists natively in SDevTech too.

**User then clarified this Mac's local Mongo backup is NOT the current/authoritative one** - the
actual migration was run from the Office Server PC, which holds the real current SDevTech source.
So the finding above may not reflect the true current SDevTech state and should not be treated as
final - it only proves the *shape* of the mismatch (installment vs. account-aggregate disagreement)
existed in whatever backup snapshot this Mac happens to have, not that it's still true today.

**Status at the time this Mac paused:** nothing had been written to any database here - the actual
fix (see §13's update above) was applied on the Office Server PC later the same day. Left as
originally written below for the investigation trail; superseded, not a live TODO anymore.

## 14. Payment History: added a "Recorded by" column

User asked whether the Loan Detail page's Payment History table could show which staff member
recorded each transaction. Mocked up the change first (Artifact) and got sign-off before touching
code, per the standing mockup-before-UI-changes rule.

Implementation follows this codebase's existing `PenaltyOverride.byName` / `FeesOverride.byName`
convention (repayment module) - a display-only, denormalized name field on the domain entity,
populated by the repository's read query via a Prisma `include`, never set on write:

- `LoanTransaction` domain entity (`app/easycashbackend/src/modules/ledger/domain/
  LoanTransaction.ts`): added `postedByName?: string` to `LoanTransactionProps` plus a getter,
  documented as read-path-only exactly like the repayment module's precedent.
- `PrismaLoanTransactionRepository.findByLoanAccountId` (`app/easycashbackend/src/modules/ledger/
  infrastructure/PrismaLoanTransactionRepository.ts`): added `include: { postedBy: { select:
  { firstName: true, lastName: true } } }` to the `findMany` call, and `toDomain()` now builds
  `postedByName` from the joined `postedBy` relation when present.
- `LoanTransactionPresenter`: added `postedByName` to the JSON response.
- Frontend `LoanTransaction` type (`app/lmsfrontend/src/lib/loanApiTypes.ts`) and the Payment
  History table (`LoanDetailPage.tsx`): new "Recorded by" column between Date and Type, showing
  the staff name or "Legacy" (muted) for rows with no `postedByUserId` (legacy-migrated). The
  existing penalty-reduction/fee-adjustment row type already showed `byName` inline in its Comment
  column ("Installment #X · byName · reason") - moved that into the new column too instead of
  duplicating it, and bumped the expanded-allocations-panel row's `colSpan` by 1 for the new
  column.

Verified: `npx tsc --noEmit` clean on both apps. Docker rebuild hit the same Docker Desktop
stuck-backend-process issue as before (`com.docker.backend` survived a graceful `quit`, pegged at
500%+ CPU since that morning's launch) - fixed with a harder `pkill -9` sweep of the Docker
processes before relaunching, same as the known workaround, just needed to be more forceful this
time since the graceful quit alone didn't clear the stuck process. Both `easycashbackend` and
`lmsfrontend` rebuilt clean and healthy afterward. Could not verify the column visually in the
browser - no staff login credentials available in this session - so this is unverified in the UI;
next session should log in and confirm the column renders correctly before considering this done.

## 15. "Print Application" - generate a PDF of the Loan Application, auto-saved to Attachments

User asked whether an approved Loan Application (once the applicant becomes a client) could be
printed. Mocked up first (button placement + a sample printed form layout) and got sign-off before
implementing, per the standing rule.

**Why a new PDF path instead of the existing `loan-document` module:** that module's
`GenerateLoanDocumentUseCase` fills an admin-uploaded `.docx` template and only ever reads
`LoanAccount` data (post-approval agreements/promissory notes) - there's no `.docx` template to
author for "the application form itself" (nothing like it exists), and hand-authoring a `.docx`
file isn't something that can be done blindly through text tools anyway. Built a new path instead
that draws the PDF directly with `pdf-lib` (already a dependency, previously only used for
signature-stamping an existing PDF in the loan-signing module, not for building one from scratch):

- `LoanApplicationFormPdfBuilder` (`app/easycashbackend/src/modules/loan-application/application/
  services/`) - draws the letterhead, Applicant Information / Employment & Income / Requested Loan
  Terms sections from the application, and a 4th "Approval & Resulting Account" section (only when
  the application has a reviewer or a linked `LoanAccount`) showing who approved it and the
  resulting loan account code/amount/activation date. Signature lines at the bottom since it
  doubles as a printable/physical form.
- `GenerateLoanApplicationFormUseCase` - fetches the application, resolves the approval/linkage
  details (reviewer name via `IUserRepository`, linked `LoanAccount` via
  `findBySourceApplicationId`), builds the PDF, then calls the existing `UploadAttachmentUseCase`
  (reused as-is, not re-implemented) with `ownerType: 'LOAN_APPLICATION'` - this is what makes it
  "auto-attach": no new Attachment-creation logic, just the same path a manual upload takes.
  `documentCategory` left `null` - none of the existing categories (all borrower-supplied document
  types) describe a system-generated form, and adding a new one wasn't asked for.
- New endpoint `POST /loan-applications/:id/generate-form` (same `loan_application.manage` access
  gate as the rest of that router), returns the created Attachment's metadata.
- Frontend: new outlined "Print Application" button in `LoanApplicationDetailPage.tsx`'s header
  action group (distinct styling from the filled Create Client Profile/Create Loan Account buttons
  next to it, since printing is optional/repeatable rather than a one-time state transition),
  visible once the application is APPROVED or DECLINED. On success, invalidates the Attachments
  panel's query (`['attachments', 'LOAN_APPLICATION', applicationId]` - same key the existing
  `AttachmentsPanel` component already uses for this page) so the new PDF appears there
  immediately, and triggers an immediate download via the existing `downloadFile` helper.

Verified: `npx tsc --noEmit` clean on both apps. Docker Desktop had crashed/quit between sessions
(unrelated to this change) - relaunched, waited for the daemon, then rebuilt `easycashbackend` and
`lmsfrontend` clean; both containers came back healthy. Still not verified end-to-end in the
browser (no staff login credentials available in this session, same limitation as §14). Next
session should log in, generate a form on a real approved
application, and confirm the PDF renders correctly and appears in Attachments.

## Current state

- All changes verified: `npx tsc --noEmit` clean on both apps after every edit; backend suite run
  multiple times, consistently 947-948 passed / 24 pre-existing failures (confirmed via `git stash`
  to be present on `origin/main` before any of this session's edits — unrelated portal/borrower-
  repository test-mock gaps and an already-broken SOA penalty-rate test, not touched or introduced
  here); Docker rebuilt and healthy after every backend/frontend change, including the two follow-up
  fixes in §7 and §8.
- This machine's local database is now fully synced with the latest SDevTech export, has every
  pending migration applied, has a complete Roles & Permissions seed, and its `.env`/LAN IP config
  is current as of this session's end.

## Known follow-up work

- The SOA penalty/accrued breakdown is preview-only (not persisted on the generated SOA record) —
  if staff need to see the same table again later against an already-generated statement, that
  requires new `jsonb` columns on `GeneratedStatementOfAccount` plus a migration, not done here.
- The client-side `soaPreview` memo remains a second hand-maintained copy of
  `StatementOfAccountCalculator`'s logic (now three total copies of parts of this formula counting
  `RepaymentInstallmentPresenter`'s live figure) — flagged as an architecture smell worth resolving
  via a real backend preview endpoint at some point, not addressed this session (kept as-is to
  preserve the existing instant, no-round-trip preview UX).
- 24 pre-existing backend test failures (client-portal mocks, `PrismaBorrowerRepository` mocks, an
  `AccruedInterestCalculator`/`RepaymentInstallmentPresenter` penalty-rate mismatch, one already-
  broken `StatementOfAccountCalculator` test) remain unfixed — out of scope for this session, not
  introduced here, but worth a dedicated pass since they now number enough to hide a real
  regression among them.
