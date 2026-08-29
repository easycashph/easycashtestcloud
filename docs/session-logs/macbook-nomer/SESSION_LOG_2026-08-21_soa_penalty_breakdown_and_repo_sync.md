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

## 20a. Follow-up: white logo also needed for Premium + Light mode, and centered

User reported the white logo also needs to show for the **Premium** Theme Style (Settings >
Appearance) while in light mode, not just regular dark mode - Premium's light-mode sidebar
(`--sidebar-background: 221 51% 16%` in `index.css`, under `[data-theme-style='premium']`) is
already navy, the same family as regular dark mode, so the colored logo's navy wordmark disappears
there too. A plain Tailwind `dark:` class variant can't express this (it only tracks the `.dark`
class, not `[data-theme-style]`), so switched the logo choice to JS via the existing `useTheme()`
hook from [theme-provider.tsx](../../../app/lmsfrontend/src/components/theme-provider.tsx):

```
const { theme, themeStyle } = useTheme();
const useWhiteLogo = theme === 'dark' || themeStyle === 'premium';
```

Also centered the logo in the header (`justify-center` on the header `<div>`, dropping the old
`gap-3` used for the removed text). Both changes in the `Sidebar` component of
[AppLayout.tsx](../../../app/lmsfrontend/src/layouts/AppLayout.tsx) (not the outer `AppLayout`
component - the header markup lives in a separate `Sidebar` sub-component, caught by a first typecheck
pass failing with "Cannot find name 'useWhiteLogo'" since the hook was initially added to the wrong
function).

Verified: `npx tsc --noEmit` clean, Docker `lmsfrontend`+`easycashbackend` rebuilt and confirmed
"Up" via `docker ps`. Same as §20's own caveat - could not visually confirm inside the actual
logged-in sidebar (no staff credentials on this Mac); only reached the login page in the browser
check.

## 21. Portal as an installable mobile app - added PWA service worker + offline app-shell caching

User asked whether the client Portal could become a mobile app someone installs on their phone.
Investigated first rather than assuming: [portalfrontend](../../../app/portalfrontend) already had
a working `site.webmanifest` (icons, `display: standalone`, theme color) linked from
[index.html](../../../app/portalfrontend/index.html) - so "Add to Home Screen" already worked in
some form on both Android and iOS Safari before this session touched anything. What was missing for
a real installable PWA (Chrome's "Install app" prompt, not just a bookmark shortcut) and for the
offline resilience CLAUDE.md's "Offline-Friendly Design" section calls for was a **service worker**.

Presented a mockup first (home screen icon, install prompt, standalone fullscreen view) per the
standing workflow rule; user approved building it for real ("oo, ituloy mo na").

Chose `vite-plugin-pwa` (open-source, Workbox-based, the standard Vite PWA tool) over hand-rolling a
service worker - installed as a portalfrontend devDependency. Implementation:

- [vite.config.ts](../../../app/portalfrontend/vite.config.ts): added the `VitePWA` plugin,
  `registerType: 'autoUpdate'` (silently swaps in a new service worker on next load - no "update
  available" prompt UI, matching this app's release cadence), `manifest: false` since
  `index.html` already links its own hand-tuned `site.webmanifest` and only the service worker
  needed generating. `navigateFallbackDenylist: [/^\/api\//]` keeps API routes out of the SPA
  navigation fallback.
- **Deliberately did NOT cache `/api/` responses** - a stale cached loan balance or application
  status shown as if live would be worse than the existing [OfflineBanner](../../../app/portalfrontend/src/components/OfflineBanner.tsx)
  (already built, already wired into `App.tsx`) honestly telling the borrower they're offline. The
  service worker only precaches the static app shell (JS/CSS/HTML/icons via Workbox
  `generateSW`/`precacheAndRoute`, 40 entries / ~687 KiB in this build) so the app itself still
  loads with no connection - matches CLAUDE.md's "cached recently viewed data... graceful retry...
  clear offline indicators", not "serve stale financial data".
- [main.tsx](../../../app/portalfrontend/src/main.tsx): `registerSW({ immediate: true })` from the
  plugin's `virtual:pwa-register` module.
- [vite-env.d.ts](../../../app/portalfrontend/src/vite-env.d.ts): added the
  `vite-plugin-pwa/client` type reference (the virtual module has no types without it).

Verified: `npx tsc -b` clean, `npx vite build` succeeded and generated `dist/sw.js` +
`dist/workbox-*.js` precaching 40 entries. Docker `portalfrontend` (Docker Desktop had crashed
again between sessions, same recurring issue - relaunched via `open -a Docker` + waited for the
daemon) rebuilt and confirmed "Up" via `docker ps`; `sw.js` confirmed served correctly (HTTP 200,
correct `Content-Type: application/javascript`, correct byte length) via both `curl` and an
in-browser `fetch()`.

**Known limitation found while verifying**: `navigator.serviceWorker.register()` fails inside this
Mac's automated Browser-pane tool specifically - `TypeError: ... An unknown error occurred when
fetching the script`, even though the exact same file fetches successfully via plain `fetch()` from
the same page. This points to the embedded browser-automation sandbox itself blocking/restricting
Service Worker registration (a known category of restriction in hosted/automated browser tools,
unrelated to the generated service worker's own correctness), not a bug in this change - the
Workbox output itself is standard and was independently confirmed byte-correct. **Not yet verified
in a real, unrestricted browser** (desktop Chrome or an actual phone) - next session (or Nomer
directly, right now, from his phone on the LAN) should open the Portal URL in a real mobile browser
and confirm the "Install app" / "Add to Home Screen" prompt appears and the installed app opens
standalone.

## 21a. Follow-up: fixed two real bugs found from an actual phone test, found the address-bar-on-install cause was HTTPS, deferred that fix

User tested §21 on a real Android phone (Chrome) over LAN. Two real problems surfaced, plus one
root cause identified and deliberately deferred:

1. **Portal was unreachable from any other device on the LAN at all** - unlike
   [lmsfrontend's apiClient.ts](../../../app/lmsfrontend/src/lib/apiClient.ts) (`API_BASE_URL =
   import.meta.env.VITE_API_BASE_URL ?? \`http://${'{window.location.hostname}'}:4000/api/v1\``,
   which "just works" from any host without a rebuild), [portalfrontend's apiClient.ts](../../../app/portalfrontend/src/lib/apiClient.ts)
   had a hardcoded `'http://localhost:4000/api/v1'` fallback - on a phone, "localhost" means the
   phone itself, so every API call silently failed. Root cause: the Portal was previously only ever
   tested via `npm run dev` on the host or deployed to Cloudflare Pages (which always sets
   `VITE_API_BASE_URL` explicitly at build time) - LAN/phone access through the Docker container was
   never exercised before. Fixed by matching the LMS frontend's own proven fallback pattern
   (`window.location.hostname` instead of a literal `'localhost'`) - doesn't touch the Pages
   deployment (still overridden by its own explicit env var), only fixes the local/LAN fallback.
   Also discovered the existing `scripts/Update LAN IP (Macbook-Nomer).command` only ever updates
   `lmsfrontend`'s config/CORS, never `portalfrontend`'s - flagged as a follow-up below rather than
   fixed here (out of scope for this immediate test).
2. **Backend CORS didn't allow the Portal's LAN origin** - `CORS_ORIGIN` in `.env` had `:5173` (LMS)
   but not `:5199` (Portal). Added `http://192.168.1.25:5199` to the existing list and restarted
   the backend (CORS is read at runtime, no rebuild needed - same as the LAN-IP script's own
   pattern).
3. **Root cause of "may address bar pa rin" after install**: Chrome only grants a PWA true
   standalone/fullscreen display (and the real "Install app" prompt) over HTTPS or `localhost` -
   never over a plain LAN IP like `http://192.168.1.25:5199`. That's a browser security requirement,
   not something fixable in the app's own code. Investigated the repo's existing (but currently
   disabled) Tailscale HTTPS scaffolding in
   [docker-compose.yml](../../../app/docker/docker-compose.yml) and
   [lmsfrontend/nginx.conf](../../../app/lmsfrontend/nginx.conf) (commented out since 2026-07-30,
   waiting on a re-issued cert) - found Tailscale itself isn't even installed on this Mac (`tailscale`
   not in `PATH`, no `Tailscale.app` in `/Applications`), and the existing scaffolding only ever
   covered `lmsfrontend`, never `portalfrontend`. Asked the user whether to install and sign into
   Tailscale now to pursue this; **user chose to defer** ("Panatilihin muna as-is") rather than set
   up a new account/install mid-session - the Portal stays reachable and functional over LAN HTTP,
   it just won't show the fully chromeless standalone window until HTTPS is wired up.

Verified: `npx tsc -b` clean, Docker `portalfrontend`+`easycashbackend` rebuilt, confirmed `curl
http://192.168.1.25:5199/` returns 200 and the built JS bundle now bakes in
`` `http://${window.location.hostname}:4000/api/v1` `` instead of the old hardcoded localhost
string.

## 22. Restored the 9 real staff accounts (+ role assignments) from a Postgres dump into this Mac's local database

User pointed at `legacy/mongodb/easycash-database-2026-08-28.dump` and asked whether it contained
user accounts. Inspected it first rather than assuming - despite the folder name and `.dump`
extension suggesting a MongoDB export, `file` identified it as a **PostgreSQL custom-format dump**
(`pg_dump -Fc`), i.e. a snapshot of the LMS's own Postgres database, not legacy Mongo/SDevTech data.
Confirmed via a throwaway scratch database (`pg_restore` isn't on the host, so this ran inside the
`easycash-postgres-1` container) that it held real data: 9 rows in `users` (staff LMS accounts -
Nomer Perez, Rosan Cinco, Kyla Lozabia, Liezel Pentecostes, Alfred Ogana, Irene Elicano, Lyka
Zipagan, Howell Hay, Jomer Biason), 6 rows in `portal_accounts`, and the same 6 `roles` this Mac
already had (MIS, Loan Operation Manager, CRM, Finance, Accounting, Collection Officer).

User asked to bring these into this Mac's actual running database - directly relevant, since **this
Mac's local `users` table had exactly one row (Nomer's own account) all session**, which is the
concrete reason every feature since §14 could only be backend-verified, never click-tested in a
real logged-in browser session.

Confirmed scope with the user before touching the live database (per the "confirm before
destructive/hard-to-reverse actions" rule - this is the machine's actual working dev database, not
a throwaway):
- **Users table only** (not `portal_accounts`, `branches`, or anything else) - just the 9 staff
  accounts and their role assignments (`user_roles`), since a staff account with no role assigned
  would be functionally useless.
- **Overwrite on email conflict** - if a row already existed with the same email (true for Nomer's
  own account), replace its fields with the dump's version rather than skip it.

Implementation - id/name mapping had to happen by hand rather than a blind table copy, because the
dump and this Mac's live schema have diverged (different `branches`/`role_classes`/`roles` primary
keys for the same real-world entities, and a `companies` table that existed in the dump's era but
has since been dropped from the schema entirely):
1. Restored the dump into a throwaway scratch database (`dump_check2`, full schema + data, dropped
   afterward) to read from cleanly.
2. Manually matched the dump's `branches`/`role_classes`/`roles` rows to this Mac's live rows **by
   name**, not by id (only one branch, "Head Office", exists in both - so every user maps to it).
   One gap found: dump has an "Admin" `role_classes` row (used by `howell@easycash.ph`) that no
   longer exists under that name in the live schema - left `roleClassId` `NULL` for that one user
   rather than guessing a substitute; he still gets his `MIS` role via `user_roles`, just no
   specific role-class label.
3. Generated `INSERT ... ON CONFLICT (email) DO UPDATE` SQL for all 9 users (SQL-generating-SQL via
   `quote_literal`/`CASE` in a query against the scratch db), and `INSERT ... ON CONFLICT DO
   NOTHING` for their `user_roles` rows, using the hand-verified id mappings from step 2. Ran both
   inside one transaction (`BEGIN`/`COMMIT`) against the live `easycash` database.
4. Verified Nomer's own account kept its existing `id` (`07d3620c-e123-441f-ba95-4fed9f6b6939`) -
   critical, since this id is already referenced by test data created earlier this session (e.g.
   §19's e-signature verification script) - the upsert matched by email and only updated fields,
   never touched the row's `id`.

Result (`email | status | role | role_class`):

| Email | Status | Role | Role class |
|---|---|---|---|
| nomer.perez@easycash.ph | ACTIVE | MIS | MIS Manager |
| jomer.biason@easycash.ph | INACTIVE | MIS | MIS Assistant |
| rosan.cinco@easycash.ph | ACTIVE | Collection Officer | Accounts Recovery Officer |
| kyla.lozabia@easycash.ph | ACTIVE | Accounting | Accounting |
| liezel.pentecostes@easycash.ph | ACTIVE | Loan Operation Manager | LOM |
| alfred.ogana@easycash.ph | ACTIVE | Collection Officer | Field Collector |
| irene.elicano@easycash.ph | INACTIVE | Collection Officer | Collection Manager |
| lyka.zipagan@easycash.ph | ACTIVE | Accounting | Accounting |
| howell@easycash.ph | ACTIVE | MIS | *(none - see the "Admin" gap above)* |

Password hashes were copied as-is from the dump (bcrypt, untouched) - these are each person's real
production password, not reset or regenerated. Cleaned up: dropped the scratch database, removed
the copied dump file and generated SQL from both the container and host `/tmp`.

**Not yet done**: no actual login was attempted with any of these restored accounts this session
(would require knowing each person's real password) - next session should try logging in as one of
the non-Nomer accounts (e.g. `rosan.cinco@easycash.ph`, a Collection Officer, or
`liezel.pentecostes@easycash.ph`, an LOM) to finally click-test the features flagged since §14 as
"backend-verified only" under a role other than MIS.

## 23. Added the missing Mac counterpart of "Run Full Legacy Migration (Office Server PC).bat" for this machine

User asked for an equivalent of `scripts/Run Full Legacy Migration (Office Server PC).bat` for this
Mac. Checked first rather than assuming one didn't exist: `legacy/Run Full Legacy Migration.command`
already existed as a generic Mac `.command`, but it was **stale** - written before the
`app/backend` -> `app/easycashbackend` folder rename (still `cd`s into the old path) and missing
five backup/restore-native-* steps plus the optional Mambu recovery step that the current Windows
`.bat` scripts have (all added 2026-08-19 through 2026-08-27, after that `.command` file was last
touched). Confirmed the two Windows `.bat` siblings (Office Server PC / Nomer Laptop) are byte-for-
byte identical aside from a header comment - "nothing... is actually machine-specific, this is just
a per-machine named copy so it's obvious at a glance which machine a session log entry was about"
(per the Nomer Laptop version's own comment) - so the right fix was a fresh, up-to-date, per-machine
`.command` file for this Mac, not patching the old shared one (which stays in `legacy/` as-is,
unmaintained, since nothing currently points at it as the canonical version).

Created `scripts/Run Full Legacy Migration (Macbook-Nomer).command` - ported the full current
18-step sequence + all 5 `backup-native-*.ts`/`restore-native-*.ts` steps (user accounts, Roles &
Permissions, native loan applications, other system settings, Portal accounts) + the guarded
optional Mambu notes/address recovery step from the Windows `.bat`, translated to bash/Mac paths
(`app/easycashbackend`, not `app/backend`). Verified: `chmod +x`'d, `bash -n` syntax check passed,
and cross-checked all 31 `.ts` scripts referenced in the file actually exist under
`app/easycashbackend/scripts/` (they do - no typos/renamed scripts missed in the port).

**Not run this session** - this is a destructive, `prisma migrate reset --force`-based rebuild of
the entire local database; per the same reasoning documented in the Windows `.bat` header, only run
it when Nomer actually wants a from-scratch rebuild, not as part of routine dev work. §22's restored
staff accounts (this same session) would be backed up and automatically restored by this script's
own `backup-native-users.ts`/`restore-native-users.ts` steps if it's ever run.

## 24. New LoanCompromiseSettlement model + real Reschedule/Compromise Agreement migration mapping (grew out of the BL-SPEC_00028 investigation above)

User asked to analyze `legacy/mongodb/easycash-database-2026-08-28.dump` (turned out to be a
**Postgres**, not MongoDB, dump - a full DB snapshot) and confirmed it held real `users`/
`portal_accounts`/`roles` data. Separately - not from that dump, from the live SDevTech Aug-28
snapshot already synced via §-none-of-this-session's own "Update Database" run - asked why
**BL-SPEC_00028 (MARLON ALMANZOR RICALDE)** was CLOSED despite a non-zero balance. Investigated the
raw legacy `loan_accounts.bson`: `closureReason: "Reschedule"` - the loan's remaining balance moved
to a brand new loan (`BL-SPEC_00030`). Explored the full scope: **20 loans** with
`closureReason: "Reschedule"` across the whole dump, plus a second, previously-unknown closure
reason - **8 loans** with `closureReason: "Compromise Agreement"` (multiple old, defaulted loans
for ONE borrower consolidated into ONE new loan at a negotiated write-down - confirmed the sum of
the 8 old loans' balances was ~4.6x the new consolidated loan's principal).

User confirmed both should be represented properly in the LMS (not silently mapped to plain
`CLOSED`, which was the design doc's original, now-disproven assumption: "no write-off accounts
exist"), and asked for a design. Reschedule already had a home - `CLOSED_RESTRUCTURED` +
`LoanRestructure`, built weeks ago for the in-app Loan Restructure feature but never wired into the
*migration's* status mapping. Compromise Agreement had no home - its N-old-loans-to-1-new-loan shape
doesn't fit `LoanRestructure`'s 1:1 `@unique` `oldLoanAccountId`. Presented a design (new
`LoanCompromiseSettlement` header row + `LoanCompromiseSettlementItem` per old loan, new
`CLOSED_COMPROMISED` status) - user approved, scoped explicitly to **data model + migration mapping
only** (no in-app "Compromise Settlement" button/use-case yet - user separately confirmed that's a
real future want, to be built in a later session).

**Schema** (`prisma/schema.prisma`, migration `20260829001841_add_loan_compromise_settlement`):
- `LoanAccountStatus` enum: added `CLOSED_COMPROMISED`.
- New `LoanCompromiseSettlement` model: `newLoanAccountId` (`@unique`), `totalPreviousBalance`,
  `settlementAmount`, `reason`, `settledByUserId`, `items` relation.
- New `LoanCompromiseSettlementItem` model: `settlementId`, `oldLoanAccountId` (`@unique`),
  `previousCollectionsBalance`.
- Mirrored the domain-layer `LoanAccountStatus` type/`ALLOWED_TRANSITIONS` in
  [LoanAccount.ts](../../../app/easycashbackend/src/modules/loan-account/domain/LoanAccount.ts) (no
  outbound transitions yet - no undo feature exists for this migration-only status).

**Migration mapping** ([migrate-legacy-data.ts](../../../app/easycashbackend/scripts/migrate-legacy-data.ts)):
`resolveLoanStatus()` now checks `closureReason` for CLOSED loans - `"Reschedule"` ->
`CLOSED_RESTRUCTURED`, `"Compromise Agreement"` -> `CLOSED_COMPROMISED`, everything else stays plain
`CLOSED`. Also fixed a related, previously-unnoticed gap while in this code: **`closedReason` was
never written at all**, regardless of closure type - every closed loan showed no explanation in the
LMS. Now carried straight through from `la.closureReason`.

**New script** [backfill-loan-restructure-compromise.ts](../../../app/easycashbackend/scripts/backfill-loan-restructure-compromise.ts) -
populates the actual `LoanRestructure`/`LoanCompromiseSettlement` link rows (writing the status
alone doesn't say WHICH new loan a closed one became). Pairing heuristic: for a given borrower, the
chronologically next loan account created after the closed one - the only signal SDevTech has, no
explicit old->new link field exists. Verified against the full dataset: found a next loan for every
single one of the 20 Reschedule + 8 Compromise Agreement loans (20/20, 8/8), but the remaining
balance only matched the next loan's opening principal exactly for **11/20** Reschedule pairs - the
other 9 (mostly older `SML-*` chains) are flagged `MISMATCH-review` in the row's own `reason` text
rather than silently trusted, so a human can spot-check them later.

**Bug found and fixed mid-implementation**: the balance-matching numbers were initially all `0.00`
for every Reschedule loan except BL-SPEC_00028 - traced to
[recompute-active-loan-balances-from-schedule.ts](../../../app/easycashbackend/scripts/recompute-active-loan-balances-from-schedule.ts)
being scoped to `ACTIVE`/`ACTIVE_IN_ARREARS` only (2026-07-09 design decision: "a CLOSED loan
reading 0.00 remains plausible - paid off"). That assumption is wrong for `CLOSED_RESTRUCTURED`/
`CLOSED_COMPROMISED` specifically - the whole point of those closures is the loan was NOT paid off.
Extended the status filter to include both. BL-SPEC_00028 itself had a real (non-zero) balance only
by coincidence - it happened to still be `ACTIVE`/`ACTIVE_IN_ARREARS` earlier in this same session,
before an intervening `migrate-legacy-data.ts` re-run flipped it to `CLOSED_RESTRUCTURED`.

**Second bug found**: the backfill script's `upsert(... update: {})` pattern (correct for a true
one-time historical record) meant the FIRST, pre-fix run's wrong `0.00`-derived numbers got
permanently frozen once written, immune to the later recompute fix. Cleaned up by deleting all 27
rows this session had created (19 `loan_restructures` + 8 `loan_compromise_settlements` + their 8
items - confirmed safe: all created this session, no real staff data at risk) and re-running the
backfill cleanly against the corrected balances.

**Wired into all migration entry points** so this isn't a manual step to remember:
`"Update Database From SDevTech.command"`/`.bat` (new step, after the balance recompute, before the
final integrity check - 8→9 / 10→11 steps) and all three `"Run Full Legacy Migration"` scripts
(Macbook-Nomer/Office Server PC/Nomer Laptop - new step after the balance recompute, 18→19 steps).
Placement matters: must run AFTER the balance recompute (needs real Collections Balance figures,
not the raw dump's often-absent account-level snapshot).

Final state (this Mac, current DB): 19 `LoanRestructure` rows (1 of 20 skipped - its new loan,
`SML-Self_00042`, has an unresolved borrower per the core migration's own reconciliation, so isn't
migrated yet), 8 `LoanCompromiseSettlement` rows / 8 items - all 8 old Compromise loans and their
one shared new loan (`OTH-COMP_00001`) resolved cleanly.

Verified: `npx tsc --noEmit` clean throughout. Backend test suite: 28 failed / 943 passed / 7
skipped - all 28 failures are the same pre-existing categories already logged earlier this session
(PrismaBorrowerRepository mocks, client-portal mocks, AccruedInterestCalculator/
RepaymentInstallmentPresenter/StatementOfAccountCalculator penalty-rate date-sensitivity) - none
touch LoanAccount/LoanRestructure/LoanCompromiseSettlement, confirmed unrelated to this section's
changes.

**Known follow-up** (user-confirmed want, not built this session - data-model-only scope): an
in-app "Compromise Settlement" feature (button + use-case on the Loan Detail page), mirroring the
existing Restructure/Adjustment features, so staff can trigger a real consolidation from within the
LMS itself rather than only via migration backfill.

## 25. Built the in-app Compromise Settlement feature (the §24 follow-up, same session)

User confirmed wanting the in-app feature right after §24 landed. Design questions asked and
answered (CLAUDE.md "never invent business rules") via `AskUserQuestion` before writing any code:

- **Selection**: staff multi-selects old loans via checkboxes on the **Client Profile** page (not
  Loan Detail) - matches how the real SDevTech data actually looked (multiple loans, one borrower).
- **Eligibility**: `ACTIVE`/`ACTIVE_IN_ARREARS` only - deliberately NO "must be past due" requirement
  (unlike Restructure) since a compromise is a negotiated settlement, not necessarily
  delinquency-triggered.
- **Settlement amount**: staff types the exact negotiated figure directly - **never computed**,
  unlike Restructure's computed-then-optionally-overridden principal (a compromise is the result of
  an off-system negotiation; only staff knows the real agreed number).
- **New loan's product/interest rate/grace period/term**: all staff-entered too (unlike Restructure,
  which copies the old loan's own product) - a compromise may deliberately move the borrower onto a
  different product.
- **Activation**: one click straight to ACTIVE, no approval step - same posture as Restructure.
- **Permission**: reuses `loan_account.restructure` - no new permission code.

**Backend** (mirrors `RestructureLoanUseCase`'s exact shape throughout):
- New domain entity [LoanCompromiseSettlement.ts](../../../app/easycashbackend/src/modules/loan-account/domain/LoanCompromiseSettlement.ts)
  (aggregate holding its `items` array directly, unlike `LoanRestructure`'s 1:1 shape).
- `LoanAccount.compromiseClose()` + `CLOSED_COMPROMISED` added to `ALLOWED_TRANSITIONS` (was
  present in the enum since §24 but had NO outbound path from ACTIVE/ACTIVE_IN_ARREARS yet - §24's
  migration-only writes bypassed the domain entity entirely via raw Prisma, so this gap didn't
  surface until the in-app use case actually needed to call `transitionTo()`).
- 3 new domain errors: `LoanNotEligibleForCompromiseSettlementError`,
  `LoanAlreadyInCompromiseSettlementError`, `CompromiseSettlementRequiresSameBorrowerError` (the new
  loan has one borrower - every folded-in old loan must match).
- [CompromiseSettleLoanUseCase.ts](../../../app/easycashbackend/src/modules/loan-account/application/use-cases/CompromiseSettleLoanUseCase.ts) -
  validates every old loan (exists, eligible status, not already settled, same borrower), builds the
  new loan via the same `AmortizationScheduleGenerator` mechanism Restructure uses (turning a payoff
  figure into a real amortized schedule), closes every old loan, writes one
  `LoanCompromiseSettlement` + N `LoanCompromiseSettlementItem` rows, all in one
  `unitOfWork.run()` transaction.
- `ILoanCompromiseSettlementRepository`/`PrismaLoanCompromiseSettlementRepository` +
  `GetLoanCompromiseSettlementUseCase` (read-side, mirrors `GetLoanRestructureUseCase`) +
  `LoanCompromiseSettlementPresenter`.
- New route `POST /loan-accounts/compromise-settle` (deliberately no `:id` - creates a new loan from
  multiple old ones, no single anchor) and `GET /loan-accounts/:id/compromise-settlement`, both
  wired into `loanAccountRouter.ts`/`loanAccountController.ts`/`app.ts`.

**Frontend** - mockup built and approved (`mcp__visualize`, per the standing "mockup before UI
changes" rule) before any code:
- [ClientProfilePage.tsx](../../../app/lmsfrontend/src/pages/ClientProfilePage.tsx): checkbox
  column on the loans table (only enabled for ACTIVE/ACTIVE_IN_ARREARS rows, gated behind
  `canRestructureLoan`), a "Compromise Settlement (N selected)" button, and a new
  `CompromiseSettlementDialog` component (product select, interest rate/term/first-repayment-date/
  settlement-amount inputs, reason textarea) - posts with the same `Idempotency-Key` header pattern
  `RestructureLoanUseCase`'s own frontend mutation uses.
- [LoanDetailPage.tsx](../../../app/lmsfrontend/src/pages/LoanDetailPage.tsx): new
  `compromiseSettlementQuery` + banner mirroring the existing Restructure/Adjustment banners - the
  NEW loan's banner lists every OLD loan folded into it (plural-aware, unlike Restructure's single
  link), each old loan's banner links to the one new loan.
- `CLOSED_COMPROMISED` added to `LoanStatusBadge` ("Compromised" badge) and the frontend
  `LoanAccountStatus` type.

Verified: `npx tsc --noEmit` clean on both apps throughout. Backend test suite re-run after the full
feature landed: still 28 failed / 943 passed / 7 skipped, identical failure set to §24's own run -
confirmed no regression from the domain/use-case/router changes. Docker `easycashbackend`+
`lmsfrontend` rebuilt, both healthy (`/health` OK, frontend 200). Smoke-tested the new routes
without auth - both correctly return 401 (confirms `requireAuth`/`requirePermission` wiring reached
the router, without touching any real data).

**Not functionally tested this session** - creating an actual settlement permanently closes real
loan accounts with **no undo feature** (unlike Restructure/Adjustment, which both got Undo features
in earlier sessions) - deliberately did not exercise this against real migrated SDevTech loans, and
this Mac still has no staff login credentials to click-test through the UI regardless (same
limitation noted since §14, partially resolved by §22's restored accounts but their real passwords
remain unknown). Next session with real credentials should: create 2-3 disposable test loan
accounts specifically for this purpose (never real migrated data), exercise the full Client Profile
-> select loans -> Compromise Settlement dialog -> Loan Detail banner flow end to end, and consider
whether an Undo Compromise Settlement feature is worth building to match its two siblings.

## 26. Diagnosed a missing 2FA login email, enabled real EMAIL_ENABLED - first confirmed real staff login this session

User (logged into the LMS on the LAN IP, `nomer.perez@easycash.ph`) reported never receiving the
2FA verification code email. Traced it to the same dry-run pattern already documented elsewhere in
this log (§19's `signingEmailEnabled`/etc.) but with its own, separate flag pair: login OTP goes
through [OtpSender.ts](../../../app/easycashbackend/src/modules/identity/infrastructure/OtpSender.ts),
gated by `SMS_ENABLED`/`EMAIL_ENABLED` env vars (not the `reminder_settings` DB table's own
`emailEnabled`/`smsEnabled` columns, which are read-modeled from the Settings UI and gate a
different code path - Payment Reminders/Signing/Portal - entirely). Both env flags were `false` in
this Mac's `.env`, despite real SMTP/M360 credentials already being present there - the code was
being generated correctly and logged (`DRY-RUN: OTP email not actually sent`), never lost, just
never sent as a real email. Read the pending code straight from the container's own logs
(`nomer.perez@easycash.ph -> 083093`) to unblock the login immediately, then per the user's
explicit confirmation, flipped `EMAIL_ENABLED=false` -> `true` in `app/easycashbackend/.env` (the
comment line above it happened to be byte-identical to the real setting line except for a trailing
`\r`, which is why a first `sed` pass silently no-opped - fixed by targeting the exact line number).
`SMS_ENABLED` deliberately left `false` - not asked about, not touched.

Restarted `easycashbackend` (`docker compose up -d --force-recreate`) to pick up the new env value;
confirmed healthy via `/health` and, in the same restart's request logs, confirmed Nomer's own
staff account was by then already logged in and actively using the LMS (audit-logs/users/roles-
permissions/chat-queue requests all succeeding with a valid JWT) - the first real, non-scripted
staff login this Mac has seen all session (every feature since §14 had been backend-verified only,
for exactly this "no working login" reason).

**Consequence going forward, told to the user directly**: this Mac's backend now sends REAL email
for every feature gated by `EMAIL_ENABLED` - 2FA login codes, Payment Reminders, e-signature
notifications, Portal notifications - not just OTP. Nothing else was changed to accommodate this;
each of those features' own DB-backed toggles (`reminder_settings.emailEnabled`,
`signingEmailEnabled`, `portalEmailEnabled`) still independently gate whether THEY fire, same as
before - only the env-level dry-run switch flipped.

## 27. Cleaned up 12 stale colon-scheme permissions found via the newly-working staff login

With §26's real login working, user asked what the Roles & Permissions page's "Other" category
items meant, then asked why this Mac's list looked different from the Office Server PC's live one.
Investigated rather than guessing: 12 of the 14 "Other" items (`audit_log:read`, `borrower:read`/
`write`, `loan_account:approve`/`close`/`disburse`/`read`, `loan_product:read`/`write`,
`repayment:post`/`read`, `user:manage`) use an old `module:action` **colon** scheme, superseded long
ago by the current `module.action` **dot** scheme everything else in the app uses (`loan_account
.restructure`, `report.portal_accounts.view`, etc.) - confirmed via `grep` that **zero**
`requirePermission(...)` call sites anywhere in `src/` reference any of the 12 colon-style codes.
Only granted to MIS, which already holds the real dot-scheme equivalents - deleting them changes no
one's actual access. The remaining 2 "Other" items (`fee.charge`, `document_template.manage`) ARE
real, actively-checked dot-scheme permissions - just fall into "Other" because their module prefix
("fee", "document_template") has no entry in the frontend's `MODULE_META` category map, a cosmetic
gap, not staleness - left untouched.

Root cause of the Mac-vs-live difference: `seed.ts` is purely additive (documented earlier this
session, §18) - never deletes a stale row on its own, so these 12 dead rows just sat here since
whatever earlier seed run first introduced them, while the Office Server PC's database either never
had them or already got its own cleanup pass.

Same one-off-script pattern as §18's `remove-report-view-permission.ts`: wrote
`scripts/remove-stale-colon-permissions.ts` (dry-run listing each code + its granted roles, then
`--apply`), ran it, confirmed `0` colon-containing codes remain, deleted the script (FK cascade on
`role_permissions.permissionId` cleaned up MIS's 12 stale grants automatically). Data-only change -
nothing to commit besides this log entry.

## 27a. Follow-up: the reverse gap - one permission MISSING here that the live site already has

User compared this Mac's now-cleaned-up "Other" category (2 items) against a screenshot of the live
Office Server PC's own "Other" category (3 items) and asked why this Mac was missing
`two_factor_enforcement.manage` ("Manage the 'Require 2FA for all users' security setting"). Found
it already defined in `seed.ts` (line 121, part of the Security Settings feature pulled in via
§9-26's big `git pull` earlier this session) but never actually seeded into this Mac's local
database - `npx prisma db seed` (or a full migration run, which also seeds) hadn't been re-run since
that pull landed. Ran `npx prisma db seed` directly - purely additive/idempotent, safe to re-run
any time (same property that made §27's stale rows possible to accumulate in the first place, cuts
both ways: it also means a genuinely NEW permission from a pull sits unseeded until someone re-runs
it). Confirmed `two_factor_enforcement.manage` now exists and is granted to MIS, matching live.
Purely a seed-timing gap, not a real code difference between the two machines - both already had the
Security Settings feature's code from the same pull, only this Mac's database was stale.

## 28. New "Sync After Pull" scripts for all 3 machines - the general fix for §27a's whole problem class

User then reported the SAME class of gap on Office Server PC and Laptop Nomer - "hindi nakukuha ang
mga bagong update... nag git pull naman ako." Root cause explained: `git pull` only ever updates
code on disk - it never applies new Prisma migrations, never re-seeds new permissions/roles/
reference data, never installs new npm dependencies, and never rebuilds the running Docker
containers. Every one of this session's own "repo sync recovery" entries (§1) already followed a
manual version of this exact checklist after every pull - the problem was that discipline living
only in this log and this session's own habits, never in a script anyone else could just run.

User asked how to know WHICH steps are needed after a given pull - answered directly: you don't
need to know, every step here is safe to run unconditionally (`npm install` no-ops if
`package.json` didn't change, `prisma migrate deploy` skips already-applied migrations, `prisma db
seed` only ever upserts, `docker compose --build` only rebuilds what actually changed) - so the fix
is a single script that always runs the full sequence, removing the guesswork entirely rather than
trying to teach a diagnostic.

Created `scripts/Sync After Pull (Macbook-Nomer).command` (bash) and
`scripts/Sync After Pull (Office Server PC).bat` / `scripts/Sync After Pull (Nomer Laptop).bat`
(the latter two identical apart from the header comment, same per-machine-named-copy convention as
every other multi-machine script in this repo) - 8 steps: git pull, ensure Docker/Postgres running,
backend `npm install`, `prisma migrate deploy`, `prisma generate`, `prisma db seed`, frontend(s)
`npm install`, Docker rebuild of `easycashbackend`+`lmsfrontend`+`portalfrontend`. Verified: `chmod
+x`'d the `.command` file, `bash -n` syntax check passed; the two `.bat` siblings diff identically
to the same "only the header differs" pattern already established by every other per-machine script
pair in this repo.

Not run on this Mac this session - every step it performs was already done individually earlier
this session (pull, seed, rebuild); this is purely a convenience/discipline tool for future pulls,
on this machine and the other two.

## 28a. Follow-up: actually test-ran "Sync After Pull (Macbook-Nomer).command" end to end - clean pass

User asked to try running it for real right after §28 landed. Executed live (working tree was
already clean, nothing uncommitted to worry about): `[1/8]` git pull -> "Already up to date" (as
expected, this Mac had just pushed everything itself); `[2/8]` confirmed Postgres already running;
`[3/8]`-`[6/8]` backend `npm install`/`prisma migrate deploy`/`prisma generate`/`prisma db seed` all
completed clean (no-ops, since nothing new since the manual run minutes earlier); `[7/8]` frontend
`npm install`s clean; `[8/8]` Docker rebuilt all three app containers (`easycashbackend`,
`lmsfrontend`, `portalfrontend`) in one pass - previously this session's own manual routine only
ever rebuilt one or two containers at a time per change, this is the first time all three got
rebuilt together via a single script invocation. Exit code 0. Verified after: `docker ps` shows all
four containers (`postgres`, `easycashbackend`, `lmsfrontend`, `portalfrontend`) "Up", `/health`
returns `{"status":"ok",...}`, both frontends return HTTP 200.

Mid-run, user asked whether they could double-click the same `.command` file themselves while this
run was still in progress - answered no, explained why (two concurrent `npm install`/`prisma
migrate deploy`/Docker build runs against the same project/database risk corrupting `node_modules`
or racing on the database) - waited for the single run to finish cleanly before confirming it was
safe to try again.

Confirms the script is genuinely one-click-safe on this Mac. Still not yet run on Office Server PC
or Laptop Nomer - next use of either machine should try their own `.bat` copy for the first time.

## 29. Replaced this Mac's local database with a full restore of the live Office Server PC snapshot

User asked to run the full destructive "Run Full Legacy Migration" (`prisma migrate reset --force`),
restoring native user/settings/portal-account data afterward so login would keep working. Before
starting, paused to check the actual `--` per-machine confirmation and, mid-conversation, asked a
better question instead: could `legacy/mongodb/easycash-database-2026-08-28.dump` (the file §22
turned out to be a real Postgres dump, not MongoDB - already used there to restore just the `users`
table) be restored WHOLESALE instead of doing the lossy SDevTech-reconstruction migration?

Investigated before committing to either path: `pg_restore --list` on the dump showed **74 tables**
with data - not a partial export, essentially the entire schema (`loan_accounts`,
`loan_transactions`, `repayment_schedules`, `loan_restructures`, `security_settings`,
`_prisma_migrations`, everything). A scratch-database dry run confirmed 0 restore errors and
substantial, real row counts (1,805 loan accounts, 280,284 transactions, 4,607 borrowers, 108
applied migrations) - user confirmed by hand this dump is a direct snapshot **from the Office Server
PC** ("dahil ito yung pinaka main"). Recommended restoring this instead of the SDevTech
reconstruction - real, already-correct production data beats re-deriving/guessing it - user agreed.

**Execution** (all against this Mac's local Docker Postgres only - never touches the actual Office
Server PC or GitHub):
1. Stopped `easycashbackend` (avoid writes mid-restore).
2. Terminated connections to `easycash`, `DROP DATABASE` + `CREATE DATABASE` (clean slate), then
   `pg_restore --no-owner --no-privileges` the full dump - 1 harmless "schema public already
   exists" warning (expected on a fresh database), otherwise clean. Verified row counts match the
   scratch-db dry run exactly.
3. `npx prisma migrate deploy` - applied exactly the ONE migration missing from the dump's own 108
   (today's `20260829001841_add_loan_compromise_settlement`, §24) - confirms this Mac's code is
   only one migration ahead of the live snapshot.
4. `npx prisma generate` + `npx prisma db seed`.
5. Restarted `easycashbackend`, confirmed healthy.

**User asked the obvious follow-up**: since the restore already makes this Mac's data identical to
live, why re-run `migrate-legacy-data.ts --apply` on top of it? Answered directly: the restored data
is only identical to live's CURRENT state - which itself doesn't have today's `closureReason`
status-mapping fix (§24) applied yet, since that fix is code that exists only on this Mac and hasn't
reached Office Server PC. Re-running it applies an improvement that goes BEYOND matching live, not
back toward it. **User asked to proceed anyway** rather than leave the Mac merely identical to live.

Ran `migrate-legacy-data.ts --apply` again (525k transactions, ~10 min) against the restored data -
correctly protected every real, live-recorded transaction via the existing "locked loan"/"possible
duplicate of a native REPAYMENT" guards (14 such duplicates correctly skipped, confirming staff's
real recorded payments on live were never at risk of being overwritten or double-counted). Result:
`BL-REG_00021`, `SML-REG_00215`, and the other 17 SDevTech-Reschedule loans correctly flipped from
plain `CLOSED` to `CLOSED_RESTRUCTURED` - but **`BL-SPEC_00028` itself was untouched, exactly as
designed**, because it already carries a REAL, live-recorded `LoanRestructure` row
(`closedReason: 'Restructured'`, reason `"Loan Extension"`) - and this is where the session's very
first BL-SPEC_00028 investigation (way back near the start) got its final, definitive answer:

**The real new loan is `BL-SPEC_00029`, not `BL-SPEC_00030`** - the "next loan chronologically for
the same borrower" heuristic `backfill-loan-restructure-compromise.ts` uses (the only signal
SDevTech's own data provides) guessed wrong for this specific loan. Proof: after re-running
`recompute-active-loan-balances-from-schedule.ts` (198 -> fresh balances again, same "loans changed
from CLOSED to CLOSED_RESTRUCTURED need a fresh recompute" gap as §24/§25's own fix) and cleaning up
+ re-running the backfill script (same "stale 0.00-balance rows from before the recompute" cleanup
pattern as before - deleted the 18 SDevTech-derived rows, kept the one real live row, re-ran), the
script correctly **no-op'd** on `BL-SPEC_00028` (its `oldLoanAccountId` unique constraint already
satisfied by the real row) rather than creating a conflicting/wrong second entry pointing at
`BL-SPEC_00030`. This is exactly the safety property `update: {}` in the upsert was designed to
provide, now proven against a real conflicting case, not just reasoned about in the abstract.

Final state verified: 19 `loan_restructures` (18 SDevTech-derived + the 1 real live one, correctly
undisturbed), 8 `loan_compromise_settlements`, 9 `users`. `easycashbackend` restarted, healthy,
confirmed via live request logs that Nomer's own staff session kept working uninterrupted throughout
(JWT still valid, `/chat/queue`/`/notifications` polling succeeding) - the whole sequence above ran
without ever requiring a fresh login.

**Mid-conversation tangent**: user realized Office Server PC and Laptop Nomer need their own
`git pull` to receive today's code (this whole session's work, including the very
`closureReason`/`LoanCompromiseSettlement` fix just described) - pointed them at §28's new
`Sync After Pull (Office Server PC).bat`/`(Nomer Laptop).bat` as the one-click way to do that, then
suggested the same `migrate-legacy-data.ts --apply` + `backfill-loan-restructure-compromise.ts
--apply` sequence be run there too once pulled, so the live database itself gets the same
`closureReason` improvement this Mac now has - not done this session, flagged as the natural
next step.

## 29a. Follow-up: user noticed the Transaction Report totals differ between this Mac and Office Server PC - traced and surgically fixed

User asked why. Investigated rather than guessing: `loan_transactions` on this Mac had **280,423**
rows vs the live dump's original **280,284** - a gap of 139, all created in this same session (`WHERE
"createdAt" > '2026-08-29 02:00:00'`). Cause: §29's `migrate-legacy-data.ts --apply` re-run (done to
apply the `closureReason` status-mapping fix onto loan_accounts) also re-syncs Phase 4
(`loan_transactions`) unconditionally - the two phases aren't independently toggleable. The SDevTech
source had 139 genuinely real, recently-dated (2026-08-19 to 2026-08-28) transactions - FEE_CHARGED,
PENALTY_APPLIED, ADJUSTMENT, REPAYMENT, DISBURSEMENT, FEE_REPAYMENT, PENALTY_REPAYMENT - that simply
hadn't reached the Office Server PC's own Postgres database yet as of its Aug 28 dump (i.e. genuinely
new activity, not an error or duplicate).

User's call, once informed these were real and not garbage: still remove them, to keep this Mac's
transaction ledger an exact match for live's current state (rather than silently running ahead of
the authoritative production database on a table this precise). Confirmed all 139 had zero dependent
rows in `payment_allocations`/`fee_charges`/`payment_adjustments` (all three are `ON DELETE
RESTRICT` - would have blocked the delete otherwise, and would have signaled these weren't safe to
remove in isolation) - clean to delete outright. `DELETE FROM loan_transactions WHERE "createdAt" >
'2026-08-29 02:00:00'` - 139 rows removed, count back to exactly 280,284. Confirmed this doesn't
touch `repayment_schedules` (a separate table, only ever written by `migrate-repayment-schedules.ts`,
not re-run this session) or `loan_accounts.balances` (sourced from the raw dump / the schedule-based
recompute, neither of which reads `loan_transactions` directly) - a genuinely surgical fix, nothing
else this session's work touched needed re-doing. `loan_restructures` (19), `loan_compromise_
settlements` (8), and `users` (9) all confirmed unchanged.

Net effect: this Mac's `loan_transactions` table is now byte-for-byte count-identical to Office
Server PC's live database, while still carrying the `closureReason` status-mapping improvement
(§29) that neither database originally had. Same underlying gap as §29's own "Office Server PC
needs its own SDevTech sync" follow-up - once that happens there, both machines converge for real.

## 29b. Follow-up: Total Active Loans dashboard stat also differed (1270 here vs 1263 live) - same root cause, same fix, closed the BL-SPEC_00030 loose thread for good

User next noticed the Dashboard's "Total Active Loans" card (`status IN ('ACTIVE',
'ACTIVE_IN_ARREARS')`, confirmed in [PrismaDashboardRepository.ts](../../../app/easycashbackend/src/modules/dashboard/infrastructure/PrismaDashboardRepository.ts))
also disagreed - 1270 on this Mac vs 1263 on live, the mirror image of §29a's transaction-count gap
(there, this Mac had MORE recent activity than live had synced; here, this Mac had 7 more ACTIVE
loans than live). Investigated the same way: restored the still-cached `/tmp/dump.bin` into a second
scratch database (`live_check2`), exported both databases' `loan_accounts.legacyId` sets to text
files, and diffed them (`comm -13`) rather than guessing - found exactly **8** legacy IDs present on
this Mac that don't exist in the live dump at all: `BL-SPEC_00030`, `SML-REG_00382`, `SL-CORP_00129`/
`00130`/`00134`/`00135`, `SML-REG_00385`, `SML-REG_00387` - all genuinely NEW loans (created
2026-08-20 through 2026-08-27, principal amounts real and specific) that §29's `migrate-legacy-data.ts
--apply` re-run inserted from SDevTech because they simply didn't exist yet when Office Server PC's
Postgres was last dumped (Aug 28) - same "SDevTech is ahead of the last live sync" root cause as
§29a's 139 transactions, this time manifesting as brand-new loan ROWS instead of new transactions on
existing loans. 7 of the 8 are `ACTIVE` (1 is `APPROVED`, not counted in this stat) -
`1263 + 7 = 1270`, exact match confirmed.

**Resolves the session's original open thread for good**: `BL-SPEC_00030` - the "next loan
chronologically for the same borrower" guess `backfill-loan-restructure-compromise.ts`'s heuristic
made for `BL-SPEC_00028`'s restructure (proven wrong in §29, since the REAL live-recorded new loan
is `BL-SPEC_00029`) - is confirmed here to be a genuinely unrelated, brand-new loan for that same
borrower that happens to not exist in live's own database yet at all. Not a mis-migrated version of
the same event, not connected to the restructure in any way - just an ordinary coincidence of timing
for the same person taking out another loan shortly after.

Same user decision as §29a (consistency, not silently running ahead of the authoritative production
snapshot on precise per-record counts): remove these 8 too. Checked every `RESTRICT`-constrained
child table first (`loan_transactions`, `repayment_schedules`, `applied_fees`,
`loan_restructures`/`loan_compromise_settlement_items` on either side, `generated_statements_of_
account`, `generated_loan_documents`, `loan_notes`) - all zero, because these loans' own
`DISBURSEMENT` transactions were already among the 139 rows §29a had just deleted (`loan_account_co_
borrowers` had 3 rows, but that FK is `ON DELETE CASCADE`, cleans up on its own). Deleted all 8
`loan_accounts` rows directly - no orphaned RESTRICT-blocked children left behind. `loan_accounts`
total back to exactly 1,805 (matching live), status breakdown: `ACTIVE` 122 + `ACTIVE_IN_ARREARS`
1,141 = **1,263**, exact match. Cleaned up: dropped `live_check2`, removed the cached `/tmp/dump.bin`
from the container and all this session's leftover `/tmp/*.log` scratch files on the host.

## Current state

This log now spans a very long single day (2026-08-21/22) across two machines - §1-8 were the
original repo-sync + SOA penalty breakdown work on this Mac; §9-29b (added later the same "day",
still on this Mac unless noted) cover a string of separate, unrelated feature requests that came in
afterward. §13's investigation was superseded by a fix applied on the **Office Server PC**, not
here - see that section's own cross-link. Everything else below (§14-§29b) is native to this Mac.

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
- **Everything added from §14 through §21 was backend-verified only, never click-tested in a real
  browser** - this Mac had no staff login credentials available for most of this session. Each of
  those sections used one-off scripts (created, run, deleted) to exercise the real use case/
  repository code directly against the local dev database instead, which caught one real bug
  (§15's peso-sign PDF-encoding crash) before it would have reached a user. **§22 (end of session)
  restored 9 real staff accounts into this Mac's local database, so this limitation no longer
  applies going forward** - next session should log in as one of them (passwords are each person's
  real production password, not known/reset here) and click through: the "Recorded by" column
  (§14), Print Application + its Attachments auto-attach (§15/§16), the Portal Accounts report
  (§17), the new per-report Roles & Permissions toggles (§18), the sidebar logo swap in both light
  and dark mode (§20), and the Portal's new install-as-app prompt on a real phone (§21 - blocked
  from verifying in this Mac's own Browser-pane tool, see that section's caveat).

## Known follow-up work

- **Highest priority**: §29's `closureReason` status-mapping improvement (§24/§25) only exists on
  this Mac's local database - Office Server PC's actual live database still shows plain `CLOSED`
  for all 18 SDevTech-sourced Reschedule/Compromise Agreement loans (everything except
  `BL-SPEC_00028`, which has its own real in-app restructure record). Next session on Office Server
  PC should: run its own `Sync After Pull (Office Server PC).bat` (§28) to pull today's code, then
  `npx prisma migrate deploy`/`npx prisma db seed` (covered by that script), then
  `npx tsx scripts/migrate-legacy-data.ts --apply` ->
  `npx tsx scripts/recompute-active-loan-balances-from-schedule.ts` ->
  `npx tsx scripts/backfill-loan-restructure-compromise.ts --apply`, in that exact order (recompute
  MUST run before the backfill, same ordering bug fixed twice this session already) - so the actual
  production database gets this improvement, not just this Mac's local copy of it.
- Portal on the phone still shows Chrome's address bar even after "Add to Home screen" - this is
  expected until the Portal is served over HTTPS (Chrome requires HTTPS or `localhost` for a true
  standalone PWA window). Deferred (§21a) - needs Tailscale installed + signed in on this Mac, a
  cert issued via `tailscale cert`, and both `docker-compose.yml`/`nginx.conf`'s disabled Tailscale
  HTTPS block re-enabled for `lmsfrontend` *and* newly wired up for `portalfrontend` (which never
  had it in the first place).
- `scripts/Update LAN IP (Macbook-Nomer).command` only updates `lmsfrontend`'s `.env`/CORS/rebuild -
  never touches `portalfrontend` at all. Not extended this session (worked around by fixing
  `portalfrontend/apiClient.ts`'s fallback to derive the host dynamically instead - see §21a - which
  makes a per-network Portal rebuild unnecessary going forward), but the script's own description
  ("Isang click lang ito para sa lahat") is no longer fully accurate since it silently skips the
  Portal - worth updating its wording, or extending it to also restart `portalfrontend`, at some
  point.
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
