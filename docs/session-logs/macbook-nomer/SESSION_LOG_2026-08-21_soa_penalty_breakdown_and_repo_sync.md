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
`lmsfrontend` clean; both containers came back healthy.

**End-to-end verified without a browser login** (none available in this session, same limitation
as §14): wrote a one-off script (`scripts/verify-generate-loan-application-form.ts`, created, run,
then deleted per this repo's convention) that calls `GenerateLoanApplicationFormUseCase` directly
against the real local dev database - bypasses HTTP/auth entirely, but exercises the exact same
code path the UI button calls. Ran it against a real (test) APPROVED application
(`60bf78bf-58e6-40c2-ba8a-257143dacb1f`, "TESTNOMER TESTMIDDLE TESTLASTNAME").

**Bug found and fixed by this verification**: pdf-lib's standard (non-embedded) Helvetica font uses
WinAnsi encoding, which has no glyph for "₱" (U+20B1) - `drawText` threw
`WinAnsi cannot encode "₱"` the first time this ran. Fixed by switching the `money()` formatter in
`LoanApplicationFormPdfBuilder.ts` to prefix amounts with "PHP " instead of the peso sign
(`—` for missing values is fine - that's a standard WinAnsi/cp1252 character). Re-ran after the
fix: succeeded, produced a 3.4 KB PDF, matched the approved mockup layout exactly when inspected
visually (letterhead, all 4 sections, signature lines). Confirmed the resulting `Attachment` row
is findable via `attachmentRepository.listByOwner('LOAN_APPLICATION', applicationId)` - the exact
query `AttachmentsPanel` uses - with the correct `uploadedByName` ("Nomer Perez") resolved, proving
the "auto-attach, no manual upload" behavior actually works, not just compiles. Cleaned up
afterward: deleted the test `Attachment` row and its underlying storage file, deleted the temporary
verification script, rebuilt `easycashbackend` once more with the peso-sign fix included.

Not yet checked: the actual "Print Application" button click in a real browser session (only the
underlying use case was exercised, not the HTTP route/frontend wiring) - low risk since both are
thin pass-throughs verified separately (`tsc` clean, route wired in the router, button wired to the
mutation), but worth a real click-through next session if a staff login becomes available.

## 16. Print Application now previews in a new tab instead of forcing a download

User asked whether clicking "Print Application" shows a preview first - it didn't (§15's
implementation force-downloaded via the existing `downloadFile` helper, same as every other
attachment download in this app). Changed to open the generated PDF in a new browser tab instead,
so staff see it before deciding to print/save (a plain browser PDF viewer, with its own
print/save/zoom controls) - a better fit for something literally called "Print Application" than a
blind download.

Implementation note: opening a new tab has to happen synchronously inside the button's `onClick`
(`window.open('', '_blank')`, before any `await`) - browsers block `window.open` calls made from
inside an async callback (the mutation's `onSuccess`) as an unrequested popup. The blank tab's
`Window` reference is stashed in a ref, then once the PDF blob is fetched (`fetchFileBlob`, the
existing authenticated-blob helper - `downloadFile` wasn't reusable here since it forces a save
dialog instead of just returning the bytes), that already-open tab's `location.href` is set to the
blob's object URL.

**Verified with a real generation, left in place per user request** (not cleaned up like §15's
test run): re-ran the same one-off verification script (created, run, deleted again) against the
existing TESTNOMER application (`60bf78bf-58e6-40c2-ba8a-257143dacb1f`) - the user's original
ask was to test against TEST2NOMER specifically, but that borrower/application no longer exists
(removed in this same session's earlier test-account cleanup, see the "Test account cleanup"
context from earlier in this log) - confirmed with the user and used TESTNOMER instead. This
attachment (`eff81539-9be7-4277-a9f4-c3eee854b19a`) is intentionally left on the application for
the user to see in the actual Attachments tab, unlike §15's test run which was cleaned up
immediately after.

Verified: `npx tsc --noEmit` clean. Docker rebuild of `lmsfrontend` (and `easycashbackend` came
along as a dependency recreate) succeeded, both containers healthy.

## 17. New report: Portal Accounts (net-new, no prior list endpoint existed)

User asked for a new report listing every client self-service Portal Account. Mocked up first
(new card on the Reports hub + the report page itself) and got sign-off before implementing.

Confirmed this is genuinely net-new, not just wiring up an existing endpoint - there was no
staff-facing "list all Portal Accounts" endpoint anywhere; `PortalAccount` data was previously
only ever looked up one-at-a-time (a single client's own portal status). Built following this
module's existing "one flat table -> one .xlsx sheet" convention exactly (matches all 14 other
live reports):

- `IReportingRepository`: new `PortalAccountReportRow` type + `getPortalAccountsReport(filter:
  { search?, status? })`. Deliberately **not branch-scoped**, unlike most other reports here - a
  `PortalAccount` has no `branchId` of its own (only gains one indirectly once linked to a
  Borrower), and the login itself isn't a per-branch concept.
- `PrismaReportingRepository.getPortalAccountsReport`: `name` prefers the linked Borrower's name
  (authoritative once linked, per `PortalAccount`'s own schema doc comment) and falls back to the
  account's own pre-application profile fields, then the email if neither has a name yet.
  `linkedTo` is deliberately the Borrower's *name*, not a specific loan code - a Borrower can have
  more than one loan account and there's no single "the" one to pick without inventing a rule.
  `search` matches name/email across both the account's own fields and the linked Borrower's.
- `GetPortalAccountsReportUseCase`, `presentPortalAccountReportRow`, `writePortalAccountsReportXlsx`
  (no legacy `.xlsx` sample to match column-for-column, unlike most of this module's other
  writers - net-new report, own column order), new routes `GET /reports/portal-accounts` (JSON) /
  `.xlsx` (export), wired into `app.ts` alongside the other report use cases.
- Frontend: `PortalAccountsReportPage.tsx` (search box + status dropdown, debounced via the
  existing `useDebouncedValue` hook, no date-range filter - account creation date isn't what staff
  filter portal accounts by), new route in `App.tsx`, new "Portal accounts" card (marked live) in
  the Reports hub's General category.

**No "Last Login" column** - confirmed `PortalAccount` has no such field in the schema today;
left out rather than inventing one, per CLAUDE.md's "never fabricate" rule. Could be added later
if that data starts being tracked.

Verified end-to-end without a browser login (same limitation as §15/§16): wrote a one-off script
(created, run, then deleted) that calls `GetPortalAccountsReportUseCase` directly. This local dev
database has zero `PortalAccount` rows today, so also inserted two throwaway test rows directly
via SQL (one linked to a real Borrower, one not) to exercise the name-resolution/linking logic,
confirmed both resolved correctly (linked row showed the Borrower's name and `linkedTo`; unlinked
row showed its own profile name and `linkedTo: null`), confirmed the status filter and search both
work, confirmed the `.xlsx` writer produces a valid buffer - then deleted both test rows. `npx tsc
--noEmit` clean on both apps; `easycashbackend` and `lmsfrontend` rebuilt clean and healthy.

Not yet checked: the actual page in a real browser session (same caveat as the last two features
this session - no staff login available here).

## 18. Reports: split the single blanket `report.view` permission into one code per report

User asked whether Reports could be added to Roles & Permissions so MIS can control who sees which
reports. Confirmed `report.view` already existed as a permission gate on every report route
(`reportingRouter.ts`, added 2026-08-06) and already had its own "Reports" section in the Roles &
Permissions screen (`RolesPermissionsTab.tsx` - prefix-grouped, `report` already mapped to its own
category) - but it was **one blanket toggle**: on granted every report, off granted none, with no
way to restrict a role to a subset. User confirmed they wanted true per-report granularity, and
scoped it to the 13 reports actually gated by `reportingRouter.ts` - Reminder Logs/E-signature Logs
are separate routers with no permission gate at all yet (not even `report.view`), left as a
follow-up rather than pulled into this change.

Implementation:
- `seed.ts`: replaced the single `'report.view'` entry with 13 codes
  (`report.loan_origination.view`, `report.collections.view`, `report.transactions.view`,
  `report.loan_releases.view`, `report.aging.view`, `report.ending_balance.view`,
  `report.accounts_past_due.view`, `report.collection_history.view`,
  `report.expected_collection.view`, `report.first_amortization.view`,
  `report.daily_collection.view`, `report.fully_paid.view`, `report.portal_accounts.view`) - one
  per report card on the Reports hub. Added an `ALL_REPORT_PERMISSIONS` constant and replaced every
  role's `'report.view'` grant with `...ALL_REPORT_PERMISSIONS` (Loan Operation Manager, CRM,
  Finance, Accounting, Collection Officer - MIS already gets every permission automatically), so
  the migration preserves "sees every report" as every role's starting point; MIS can narrow
  individual roles down from there.
- `reportingRouter.ts`: each route now checks its own `report.<name>.view` code instead of the
  shared `requireReportView` middleware.
- `roleContext.tsx` (frontend): `PermissionCode` union updated to match - removed `'report.view'`,
  added the 13 new codes (this type isn't just documentation - a stale code here would silently
  make `hasPermission()` calls fail to compile-check against reality).
- `ReportsHubPage.tsx`: **this was the "makikita" (see) half of the ask, not just API-level
  gating** - added a `permission` field to `ReportEntry` and filed each of the 13 report cards
  under its matching code, then filtered `CATEGORIES` through `hasPermission()` before rendering -
  a report the current user isn't granted no longer shows a card at all, rather than showing one
  that 403s on click when they navigate to it. A category that ends up with zero visible reports is
  hidden entirely, and an empty "no access to any reports" state was added for the edge case of a
  role with none of the 13 granted. Reminder Logs/E-signature Logs have no `permission` set, so
  they stay always-visible, unchanged from before (matches their still-ungated backend routes).

**Cleanup of the now-superseded `report.view` DB row**: `seed.ts` is purely additive
(upsert-based) - re-running it never deletes a permission that's no longer in
`permissionDescriptions`, so the old row and its 6 role grants would otherwise sit in the database
forever as a dead, confusing toggle. Ran the seed first (adds the 13 new codes + grants, verified
via direct query: all 13 codes present, 6/6 roles granted each), then wrote and ran a one-off
cleanup script (`scripts/remove-report-view-permission.ts`, dry-run first, then `--apply`, then
deleted per this repo's convention) that deleted the `report.view` `Permission` row - the FK
cascade on `rolePermission.permissionId` removed its 6 stale grants automatically. Confirmed via a
final query: `permissions` table now has exactly the 13 new `report.*` codes, `report.view` gone.

Verified: `npx tsc --noEmit` clean on both apps. `easycashbackend` and `lmsfrontend` rebuilt clean
and healthy. Not yet checked in a real browser session (same no-login-credentials limitation as
§15-17) - next session should log in as MIS, open Roles & Permissions, confirm the Reports section
now shows 13 individual toggles instead of one, and confirm unchecking one hides that report's card
on the Reports hub for a role without it.

## 19. Verified e-signature works for both Borrower (Portal) and Co-Borrower (public link) - real end-to-end run, no code changes needed

User asked to verify e-signature via the Portal works for both borrower and co-borrower.
Investigated the `loan-signing` module first and found a hard design constraint:
`CreateLoanSigningSessionUseCase.ts` explicitly throws `ValidationError` for
`partyType=CO_BORROWER` + `channel=PORTAL` - **a co-borrower can never sign inside the Portal
itself**, only the primary borrower can (co-borrowers have no Portal login of their own, "Phase 1"
per the code's own 2026-08-20 comment). A co-borrower can only sign via the public SMS/email link
flow (`publicLoanSigningRouter.ts`), outside the Portal. Confirmed with the user this was the
correct scope to verify (not a bug to fix) before proceeding.

**Safety-first approach for the actual test** - this environment has REAL SMTP/SMS gateway
credentials configured (Nodemailer + M360), so naively exercising the flow risks sending real
messages to whoever's contact info is used. Checked `reminder_settings` first and found
`signingEmailEnabled`/`signingSmsEnabled`/`portalEmailEnabled`/`portalSmsEnabled` are all already
`false` in this environment (existing dry-run safety net, not something set up for this test) -
every relevant gateway (`DryRunAwareEmailGateway`/`DryRunAwareSmsGateway`, and
`PortalNotificationService`'s own internal check) logs instead of actually sending. Built the
verification to run through this existing dry-run path rather than temporarily flipping it on -
the user had approved a real test send to their own email, but the safer option that still proves
the exact same code paths was used instead (told the user this explicitly rather than silently
downgrading their request).

**What was actually verified** (one-off script, run via `docker exec` INSIDE the
`easycashbackend` container since this Mac has no local LibreOffice install and the container's
production image has no `tsx`/`src` - both were temporarily added just for this run and removed
after): reused the exact same wiring `app.ts` uses (same repositories, same
`GenerateLoanDocumentUseCase`, same `PdfLibDocumentSignatureStamper`), against the existing
test-named loan `SP-Easy_00001` (borrower BHENZII TESTA - already a test/non-client loan, not
real client data), with one throwaway `CoBorrower` added for the co-borrower half:

1. **Borrower via Portal**: created a temporary `PortalAccount` linked to the borrower, created a
   BORROWER/PORTAL signing session (3 required documents - Disclosure Statement, Promissory Note,
   Data Privacy Consent - auto-generated on demand), confirmed it's visible via
   `GetPortalSigningSessionUseCase` (the same read the Portal UI calls), requested + captured +
   verified a real OTP (read straight from the dry-run log line, not guessed), then signed all 3
   documents. **All succeeded.**
2. **Co-borrower via public EMAIL link**: first confirmed CO_BORROWER+PORTAL still throws exactly
   as documented. Then created a CO_BORROWER/EMAIL session (same 3 documents), requested + captured
   + verified its OTP, signed all 3 documents via the raw link token (mirroring exactly what
   `publicLoanSigningController` does). **All succeeded.**
3. **Cross-party stamping**: confirmed the co-borrower's final signed PDF for each shared document
   is larger than the borrower-only version (~800 bytes more per doc) - matches
   `SignLoanSigningDocumentUseCase`'s documented behavior of stamping the second party's signature
   onto the FIRST party's already-signed copy, so both signatures land on one final PDF rather than
   two independent single-signature copies.

**No code changes were needed or made** - this was pure verification, and it passed. Real audit
trail (the signing sessions, notification logs, and signed PDFs) was deliberately left in the
database rather than cleaned up, matching this repo's "never delete ledger-like records" posture;
only the scaffolding added specifically to make the test possible (the temporary `PortalAccount`
and `CoBorrower`) was removed afterward. The temporary `tsx` install and copied script inside the
`easycashbackend` container were also removed - the container is back to its normal production
image state.

**Follow-up (same conversation):** user separately noticed the LMS staff-facing "Create Loan
Signing Session" dialog (`LoanDetailPage.tsx:798-804`) already shows a disabled Portal button with
a "Soon" `Badge` in the Co-Borrower section - confirmed this is the frontend's own deliberate
mirror of the exact same backend restriction verified in §19 (not a bug, not an oversight): the
Borrower party has all three channels (SMS/Email/Portal) enabled, the Co-Borrower party only has
SMS/Email enabled with Portal disabled+badged, so the UI already prevents picking an impossible
combination rather than letting it fail on submit. Discussed whether to build a full co-borrower
Portal-login feature to remove this "Soon" state - user decided to leave it as-is: the existing
SMS/email-link flow is a complete, working solution (verified in §19) and doesn't need a
co-borrower account to function; building real Portal accounts for co-borrowers would only be
worth it if co-borrowers need broader Portal access later (checking loan status, payment history,
etc.), not just to remove this badge. No code changes made or needed.

## 20. Sidebar logo: replaced the small cropped icon + company-name text with the full wordmark logo (dark-mode-aware)

User showed a screenshot of the LMS sidebar header in dark mode - the Easycash logo was squeezed
into a 36x36 icon box with "Easycash Lending Company Inc." / "Manila Branch" text beside it - and
asked to show the Easycash logo only, dark mode. Went through a mockup round first per the standing
workflow rule.

User supplied a source file at `/Users/nomer/Downloads/B&W-Logo.png` for the dark-mode version.
First read of it appeared blank/white - turned out to be a real image with a fully transparent
background (confirmed via `alpha.getbbox()`), just invisible without something to composite it
onto. Compositing onto a dark background revealed a pure-white "easycash" wordmark (with the ®
mark), purpose-built for dark surfaces - no white card needed behind it. Cropped to its content
bbox (800x207) and saved as `app/lmsfrontend/public/logo-easycash-white.png`.

Presented mockups for both the header layout (logo-only vs. logo + "Manila Branch" caption) and,
after user asked "paano kung nasa light mode nga pala?", for how light mode should look (the
existing colored logo stays as-is there, since its navy wordmark reads fine on a light sidebar).
User picked logo-only, both modes: **"option b. logo only"** then **"oo, ituloy mo na"**.

Implementation, [AppLayout.tsx](../../../app/lmsfrontend/src/layouts/AppLayout.tsx):
- Removed the `COMPANY_INFO` import (no longer referenced in the sidebar header).
- Replaced the old `<img className="h-9 w-9 ... rounded bg-white ...">` + name/branch text block
  with two `<img>` tags switched by Tailwind's `dark:` variant (matches how every other themed
  value in this app already switches - no JS-based theme branching):
  - `logo-easycash.png` (existing colored logo) with `dark:hidden` for light mode
  - `logo-easycash-white.png` (new) with `hidden dark:block` for dark mode
- Branch name ("Manila Branch") dropped from the sidebar header per this request; still shown
  elsewhere in the app (e.g. the account menu), not removed from the system.

Verified: `npx tsc --noEmit` clean on `lmsfrontend`. Docker Desktop had crashed/stuck again between
sessions (`docker info` NOT_READY) - relaunched via `open -a Docker`, waited for the daemon, then
`docker compose up -d --build lmsfrontend`; `docker ps` confirmed both `lmsfrontend` and
`easycashbackend` came back up healthy. Confirmed both `/logo-easycash-white.png` and
`/logo-easycash.png` are served with HTTP 200 from the running container, and loaded the white
logo directly in the browser to visually confirm it renders correctly (crisp, correct 800x207
dimensions, no artifacts) against a dark background.

**Not verified**: the actual logged-in sidebar view itself - this Mac still has no staff login
credentials available (same limitation as every UI feature since §14). The asset and the component
change are confirmed correct in isolation; next session with real credentials should do a final
visual check of the live sidebar in both light and dark mode.

## Current state

This log now spans a very long single day (2026-08-21/22) across two machines - §1-8 were the
original repo-sync + SOA penalty breakdown work on this Mac; §9-20 (added later the same "day",
still on this Mac unless noted) cover a string of separate, unrelated feature requests that came in
afterward. §13's investigation was superseded by a fix applied on the **Office Server PC**, not
here - see that section's own cross-link. Everything else below (§14-§20) is native to this Mac.

- All changes verified: `npx tsc --noEmit` clean on both apps after every edit throughout the whole
  log, including every feature added after the original SOA work; backend suite run multiple times
  early in the session, consistently 947-948 passed / 24 pre-existing failures (confirmed via `git
  stash` to be present on `origin/main` before any of this session's edits - unrelated portal/
  borrower-repository test-mock gaps and an already-broken SOA penalty-rate test, not touched or
  introduced here) - not re-run after §9 onward, worth a fresh run next session given how much
  landed afterward. Docker rebuilt and healthy after every single backend/frontend change across
  the whole log, including two mid-session Docker Desktop crash/stuck-process recoveries (see §14
  and its follow-ups) that needed a hard `pkill -9` sweep before relaunching.
- This machine's local database is fully synced with the latest SDevTech export it has (see §13's
  caveat: this Mac's own legacy Mongo backup is NOT the authoritative source - only the Office
  Server PC's is), has every pending migration applied, has a complete Roles & Permissions seed
  (now including the 13 new per-report codes from §18), and its `.env`/LAN IP config is current as
  of this session's end.
- **Everything added from §14 onward is backend-verified only, never click-tested in a real
  browser** - this Mac had no staff login credentials available anywhere in this session. Each of
  those sections used one-off scripts (created, run, deleted) to exercise the real use case/
  repository code directly against the local dev database instead, which caught one real bug
  (§15's peso-sign PDF-encoding crash) before it would have reached a user. Next session with
  actual LMS credentials should click through: the "Recorded by" column (§14), Print Application +
  its Attachments auto-attach (§15/§16), the Portal Accounts report (§17), the new per-report
  Roles & Permissions toggles (§18), and the sidebar logo swap in both light and dark mode (§20).

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
