# Session Log — 2026-07-14

**Purpose:** plain-language record of this session, continuing from
`docs/SESSION_LOG_2026-07-13.md`. Written per the project's standing convention
(`CLAUDE.md` §Session Logs) so context is never lost between conversations.

---

## Project health check

Reviewed overall repo structure (backend modules, frontend pages, docs, legacy data) and confirmed
current build health:

- Backend `tsc --noEmit`: 0 errors.
- Frontend `tsc -b --noEmit`: 0 errors.
- Backend tests: 573 passed, 16 failed, 7 skipped — all 16 failures already known-pre-existing per
  the 2026-07-13 log (`loan-application`/`borrower` modules, to be reported to Jomer, not fixed
  blind).
- `git status`: `main` confirmed in sync with `origin/main` (0 ahead/behind) — the 47 commits noted
  as "not yet pushed" in the 2026-07-13 log have since been pushed.
- Noted 11 untracked `.docx` files under `app/backend/templates/` — these are the real ADR-051 loan
  document templates (`DocumentTemplate.code` per file) replacing the placeholder `.gitkeep`; not
  yet committed.

## Frontend test harness was completely missing

Running `npm test` in `app/frontend` exited with **"No test files found"** — not a config
regression, an actual gap: `vitest`, `jsdom`, and `@testing-library/react`/`jest-dom` were already
installed as devDependencies, but `vite.config.ts` had no `test` block at all, no setup file, and
there were zero `*.test.*`/`*.spec.*` files anywhere under `src/`. The backend has real test
coverage (596 tests); the frontend had none, contradicting `CLAUDE.md`'s "every feature should
include appropriate tests."

Fixed by:

- [app/frontend/vite.config.ts](../app/frontend/vite.config.ts) — added a `test` block:
  `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`.
  - `globals: true` was required, not optional — `@testing-library/jest-dom`'s matcher extension
    reads the global `expect` at import time; without it, the very first test run threw
    `ReferenceError: expect is not defined` inside the setup file itself.
- [app/frontend/src/test/setup.ts](../app/frontend/src/test/setup.ts) — new file, imports
  `@testing-library/jest-dom` so its custom matchers (`toBeInTheDocument()` etc.) are available in
  every test.
- [app/frontend/src/lib/utils.test.ts](../app/frontend/src/lib/utils.test.ts) — new smoke-test
  suite (7 tests) against existing pure functions (`formatPeso`, `formatMobileNumber`,
  `toProperCase`) to prove the harness actually runs end-to-end. No production logic touched.

Deliberately left tsconfig untouched (test files import `describe`/`it`/`expect` explicitly from
`vitest` rather than relying on ambient `vitest/globals` types) to avoid any risk to the `tsc -b`
build config used by CI/deploy.

## Verification

- `npx vitest run` in `app/frontend`: 7/7 passed (previously: 0 test files found, exit code 1).
- `npx tsc -b --noEmit` in `app/frontend`: still 0 errors after the new test files.

## Loan document templates: verified naming, then generation end-to-end

User added the 11 real ADR-051 `.docx` templates to `app/backend/templates/` (previously only a
`.gitkeep` placeholder). Before committing:

- Verified filenames against `prisma/seed.ts`'s `documentTemplateRows` and against the
  `<code>.docx` resolution path in `DocxtemplaterDocumentFiller.ts` — all 11 match exactly.
- Extracted each `.docx`'s merge-field placeholders (via `unzip`+strip-tags on
  `word/document.xml`, since Word can split `{Placeholder}` text across multiple XML runs and a
  naive regex misses that) and compared against ADR-051 §8's naming convention.
  - `DISCLOSURE_STATEMENT.docx`: 9 of the documented fields present and correctly named. Several
    still blank as of this check — `Miscellaneous Fee`, `NET PROCEEDS`, `EFFECTIVE INTEREST RATE`,
    and three currently-hardcoded conditional-charge rates (Late Charges 15%, Atty's Fee 25%,
    Litigation Fee "Actual Cost") that should eventually become placeholders
    (`{LateChargesRate}`/`{AttorneysFeeRate}`/`{LitigationFee}`) rather than fixed text. **User
    confirmed this is intentional for now** — placeholder work is being done incrementally, and
    they wanted to confirm the generation pipeline actually works before continuing the remaining
    templates.
  - `PROMISSORY_NOTE.docx`: 5 fields present, matching ADR-051 §8.
  - The other 9 templates: only `{BorrowerName}` present so far (or nothing, for
    `ACKNOWLEDGEMENT_RECEIPT`/the 3 `DEED_OF_ASSIGNMENT_*` files) — expected, per the user's stated
    plan to fill these in incrementally after confirming the pipeline.
- Committed the 11 templates as-is (`0152eac`), documenting in the commit message that placeholder
  editing is still in progress.

**End-to-end generation test**, since `DocxtemplaterDocumentFiller` needs no extra runtime
dependency but the PDF conversion step (`LibreOfficeDocxToPdfConverter`) shells out to `soffice`,
which is not installed on this Windows dev machine (only baked into `backend.Dockerfile`, ~600MB
`libreoffice` package) — confirmed via `which soffice`/`which libreoffice` (not found):

- Built and started the full stack via `docker compose up -d --build` in `app/docker/`
  (postgres + backend with LibreOffice + frontend). Initial attempt failed — ports 4000/5173 were
  already bound by locally-running `npm run dev` processes (PIDs 18364/12716); user stopped those,
  then `docker compose up -d` succeeded.
- `npx prisma migrate status` inside the backend container: schema up to date (27 migrations, no
  drift) — the `postgres_data` volume already had a populated dev database (3 users, 1790 loan
  accounts, many `ACTIVE_IN_ARREARS`) from prior local dev usage against the same Docker Postgres.
- User logged in via the browser at `http://localhost:5173`, opened a Loan Account, and triggered
  document generation from the UI. **Confirmed: PDF generated and downloaded successfully** —
  the full pipeline (merge-data resolve → docxtemplater fill → LibreOffice docx→pdf → local file
  storage → download) works end-to-end in Docker.
- Docker stack left running (by user's choice) so templates can be retested quickly while the user
  continues adding placeholders to the remaining 9 documents.

## Added inline PDF preview for generated loan documents

While the user continued editing placeholders, added a "Preview" action next to "Download" on the
Loan Detail page's Documents card so a generated document can be reviewed inline (PDF in a modal)
without a full download round-trip first.

- [app/frontend/src/components/LoanDocumentPreviewModal.tsx](../app/frontend/src/components/LoanDocumentPreviewModal.tsx) —
  new component, modeled directly on the existing `AttachmentPreviewModal.tsx` pattern
  (`fetchFileBlob` → `URL.createObjectURL` → `<iframe>`, with a Download button inside the modal).
  Simpler than the attachment version: generated loan documents are always PDF (the
  `download` controller always sets `Content-Type: application/pdf`), so there's no
  image/mime-type branching needed.
- [app/frontend/src/pages/LoanDetailPage.tsx](../app/frontend/src/pages/LoanDetailPage.tsx) — added
  `previewTarget` state and a "Preview" button beside each generated document's existing
  "Download" button; renders `<LoanDocumentPreviewModal>` at the page root.

**Verification:** `tsc -b --noEmit` clean. Since the Docker `frontend` container serves a
production Vite build (not the dev server), rebuilt it via `docker compose up -d --build frontend`
to pick up the change, then the user confirmed in the browser: clicking Preview opens the modal
with the PDF rendering inline, correctly, before downloading.

## Nginx SPA fallback bug (found while testing document generation)

Navigating directly to a client-side route (e.g. `/loans/:id`) — or refreshing one — 404'd in the
Docker deployment. Root cause: `frontend.Dockerfile`'s `nginx:1.27-alpine` runtime stage had no
custom nginx config, so the default config looked for a literal file at that path instead of
falling back to `index.html` and letting React Router take over. Only surfaced now because local
dev (`vite`) has SPA fallback built in — the Docker-served build had never been navigated to
directly until this session.

- [app/frontend/nginx.conf](../app/frontend/nginx.conf) — new file, `try_files $uri $uri/
  /index.html;`.
- [app/docker/frontend.Dockerfile](../app/docker/frontend.Dockerfile) — copies it to
  `/etc/nginx/conf.d/default.conf`. (Placed under `app/frontend/`, not `app/docker/`, because the
  frontend image's build context is `app/frontend` — Docker refuses `COPY ../docker/...` paths
  outside the build context.)
- Verified: `curl -o /dev/null -w '%{http_code}' http://localhost:5173/loans/<id>` went from 404 to
  200 after rebuilding the frontend image; confirmed again in the browser.
- Committed separately (`6200500`) since it's an unrelated infra bug, not part of the
  document-generation feature work.

## Promissory Note installment schedule + Anticipated Disbursement Date

User shared a real legacy Promissory Note PDF (`DS - SML-REG_00373.pdf`) as the target format —
it includes a per-installment schedule table (`# / Date / Payment Due` + Totals row) that the
current template/merge-data setup had no way to produce (flat `Record<string,string>` merge data,
no loop support).

**Design (confirmed with user before implementing, since it changes 2 port interfaces):**
`IDocumentFiller`/`ILoanDocumentMergeDataResolver`'s data type loosened from
`Record<string,string>` to `Record<string,unknown>` so an array of row objects can flow through —
docxtemplater (3.x, already a dependency, no new package needed) repeats a table row once per
array entry when the template wraps that row in `{#Schedule}`/`{/Schedule}` tags.
`LoanDocumentMergeDataResolver` now also returns `Schedule` (per-installment `Number`/`Date`/
`PaymentDue`), `TotalPaymentDue`, and (added later, per user correction — the loan-amount sentence
should show total payment due, not principal) `TotalPaymentDueWords` via the existing
`moneyToWords` helper.

**Template editing, iterated live against the Docker stack (rebuild backend → user tests → fix):**
1. First attempt put the loop tags in plain tab-separated text, not a real Word table — flagged
   before the user built it, since docxtemplater would have squished every installment onto one
   line with no row breaks (this is also why the sample PDF's extracted text came out jumbled:
   the *original* is a real table, cell boundaries just get lost by PDF text extraction).
2. User rebuilt it as an actual 3-column table; first generation attempt failed with
   docxtemplater's `TemplateError: Unclosed tag` — diagnosed via `docker compose logs backend`
   down to a stray `{` left in the doc.xml (a placeholder had been partially deleted mid-edit,
   e.g. `( P {  )  , Philippine Currency` instead of `( P {LoanAmountFigures} )`).
3. Fixed, but the retyped placeholder turned out to be `{TotalPaymentDue}` where
   `{LoanAmountFigures}` was expected — flagged, then the user clarified this was **intentional**:
   the line should show total payment due, not loan amount, which is why
   `TotalPaymentDueWords` was added as a new merge field.
4. Generation succeeded; schedule table and total-due figures render correctly end to end.

**Anticipated Disbursement Date:** user wanted this on the Promissory Note too. Turned out to
already exist as a form field (`LoanAccountCreatePage.tsx`, "Anticipated Disbursement Date") used
only to compute the Advance Interest Fee (ADR-046) client-side, then discarded — never sent to the
backend, no schema column. Confirmed with user before adding a DB migration:

- New nullable `LoanAccount.anticipatedDisbursementDate` column, migration
  `20260714024327_add_anticipated_disbursement_date`, threaded through the domain entity
  (`LoanAccount.ts`), repository, `CreateLoanAccountUseCase`, Zod validation schema, and presenter.
- `LoanAccountCreatePage.tsx` now sends the existing `disbursementDate` form value in the create
  payload instead of discarding it.
- Exposed as `{AnticipatedDisbursementDate}` in merge data — distinct from `{DisbursementDate}`
  (`activatedAt`), which has no value yet at APPROVED (when documents are generated).
- **Verification approach:** avoided guessing the dev account's login password — instead wrote a
  one-off `tsx` script calling `LoanDocumentMergeDataResolver.resolve()` directly against the local
  Postgres to confirm the field resolves correctly, deleted the script after. All 1790 existing
  loan accounts predate this field (created 2026-07-09) and have it `NULL` by definition, which is
  correct, not a bug — confirmed by checking `createdAt` on the two accounts (`SML-REG_00373`,
  `SL-REG_00114`) the user tested against. Temporarily set test values via direct SQL for both
  (since no new loan account was created through the UI during this session), then reverted both
  back to `NULL` before committing so no fake data was left in the dev database.

Committed as `dc5a130` (schema/backend/frontend/template together — one coherent feature).
`tsc --noEmit` clean on both backend and frontend; backend test suite unaffected (573 passed / 16
pre-existing failures, unrelated to this work).

## Disclosure Statement: full merge data + a legacy netProceeds data bug

Continued through the rest of the Disclosure Statement's placeholders, live-testing against the
Docker stack after each backend rebuild:

- `Address` (borrower's first address on file, comma-joined — same convention as
  `ClientProfilePage.tsx`'s `existingAddressLine`), `InterestRate`/`ContractualRate`.
- Found and fixed a real display bug along the way: `Percentage.toString()` always returns the
  fixed 3-decimal storage form ("2.520"), which read wrong once actually generated ("2.520%" and,
  compounded by a literal "%" the user had also typed in the template, "2.520%%"). Added
  `formatPercentage()` to trim trailing zeros for display ("2.520" -> "2.52%"); told the user to
  remove the extra literal "%" from the template since the value already includes one.
- `MiscellaneousFee` — not its own stored field; per user, defined as Notarial Fee + Web Fee +
  Insurance Fee combined.
- **Hide-if-zero line items**: user wants the legacy Excel LMS's behavior (a fee's whole
  label+amount line disappears when zero, not just a blank/zero amount) replicated. Since
  docxtemplater has no separate "IF" construct, reused its loop-tag syntax
  (`{#HasX}...{/HasX}`) with a boolean instead of an array — falsy hides the section entirely,
  truthy renders it once. Added `HasPrincipalAmount`/`HasProcessingFee`/`HasAdvanceInterest`/
  `HasAccountManagementFee`/`HasDocStamp`/`HasOutstandingBalance`/`HasOthers`/
  `HasMiscellaneousFee` gates. Caught via screenshot review that the user's first two attempts put
  only the tags (no label text) or all-in-one-cell layouts — clarified that the literal label text
  must sit *inside* the `{#HasX}...{/HasX}` boundary (same cell/row) alongside the value, not just
  the value alone, otherwise the label survives even when the row's amount is hidden.
- **AmortizationSchedule**: user shared a real legacy Disclosure Statement PDF
  (`DS- SL-REG_00114.pdf`) showing a richer 7-column schedule (`#`/Date/Principal/Interest/Fees/
  Payment Due/running Balance) plus an opening "row 0" at disbursement showing the starting
  balance — distinct from the Promissory Note's simpler 3-column `Schedule`. Added as a separate
  merge array (opening row + one entry per installment with a running balance computed via
  `Money.subtract`), plus `TotalPrincipal`/`TotalInterest`/`TotalFees` for the Totals row (reusing
  the already-existing `TotalPaymentDue`).

**Legacy `netProceeds` bug**, found while testing: the acknowledgment paragraph's `{NetProceeds}`
placeholder rendered `₱0.00` for a ₱10,000 loan with zero fees — should have been ₱10,000. Checked
the database directly: **all 1790 loan accounts**, not just this one, have `netProceeds` stored as
`0.00` regardless of principal or fees — the CP12 migration never computed it (same class of gap
as `legacyBalanceDataMissing`/`anticipatedDisbursementDate`, all previously found and documented).
`LoanAccount.create()` already computes this correctly for any loan created going forward; wrote
[scripts/backfill-net-proceeds.ts](../app/backend/scripts/backfill-net-proceeds.ts) (idempotent,
`--dry-run` supported, same pattern as the existing `flag-missing-balance-loans.ts`) to apply that
formula (`principalAmount - originationFees.total()`) retroactively. Dry-run confirmed all 1790
rows needed correction; user confirmed applying it; second dry-run afterward confirmed 0 remaining
corrections (idempotency verified). User confirmed the acknowledgment paragraph should keep using
`NetProceeds` (not switch to `PrincipalAmount`) — the data was wrong, not the template.

Committed as `a3d088c`. `tsc --noEmit` clean; backend test suite unaffected (573 passed / 16
pre-existing failures, unrelated).

## Font fix: every generated PDF was rendering as tofu boxes

User flagged that a freshly-regenerated Acknowledgement Receipt PDF showed blank boxes (□□□)
instead of text. Root cause: the Alpine `libreoffice` package in `backend.Dockerfile` ships with
**zero fonts** (`fc-list` returned 0 entries) — LibreOffice had nothing to substitute Word's
Arial/Times New Roman/Segoe UI with. This was true the whole session, not new — earlier
"verified working" checks on the Promissory Note/Disclosure Statement only used `pdf-parse` text
extraction, which reads the underlying text layer correctly even when the visual glyphs fail to
render, so the bug was invisible until someone actually looked at a rendered page.

Fixed in [backend.Dockerfile](../app/docker/backend.Dockerfile): added `ttf-liberation` (metric
compatible with Arial/Times New Roman/Courier New) and `font-noto` (broader Unicode, e.g. ₱) plus
`fc-cache -f`. Verified properly this time — not just text-extracted but actually rendered to an
image (temporary in-container `poppler-utils` install, `pdftoppm`, viewed via the `Read` tool) for
all three templates (Acknowledgement Receipt, Promissory Note, Disclosure Statement): all legible.
Committed as `c750b76`.

Knock-on finding: with real font rendering finally visible, the Disclosure Statement's Amortization
Schedule table turned out to be styled in Courier New (monospace) while the rest of the document
used Segoe UI — a visual mismatch that was always there but only became visible once fonts
actually rendered. User changed the whole document to Arial; committed as `1b4f734`. Also added a
`.gitignore` rule for Word's `~$*.doc*` lock files (`64b8a47`), found sitting untracked while a
template was open for editing.

## Two more origin/main merges (colleague's parallel work)

Push was rejected twice more this session by new commits from the colleague's side — same
"merge, verify, resolve the one real conflict, re-run full verification" pattern as earlier today:

1. **Merge 1** (`e1f54aa`): 8 origin commits (user self-service profile endpoints, `note` module
   renamed to `profile-note`, Matured loan status indicator, legacy migration idempotency fixes).
   One real conflict: `LoanDetailPage.tsx`'s import block (our `LoanDocumentPreviewModal` import
   alongside origin's `NotesPanel` → `ProfileNotesPanel` rename) — resolved by keeping both.
   Exposed one test-fixture gap the merge itself caused: `LoanAccountController`'s `list()` gained
   a new required `listMaturedLoanAccountIdsUseCase` dependency from origin's Matured-status work,
   which the existing test didn't mock — fixed inline (mocked with `new Set()`) before committing
   the merge, confirmed test suite back to the known 573/16 baseline.
2. **Merge 2** (`5401d1f`): 2 origin commits (Loan Application ↔ Client Profile lifecycle: borrower
   monthly income, structured address capture, PH ZIP code import/lookup, renewal flow). No real
   conflicts — everything auto-merged cleanly, including `backend.Dockerfile` (font packages) and
   `utils.ts` (`formatPercentage` alongside origin's improved `toProperCase`).

Both merges applied their new Prisma migrations locally (`prisma migrate deploy`) and were
verified with the full `tsc --noEmit` + test-suite + Docker-rebuild routine before pushing.

## Local database wiped by a new sync script — recovery + root-cause fix

While testing, the user's login started failing (`INVALID_CREDENTIALS`) for an account
(`nomer.perez@easycash.ph`) that had worked all session. Investigation: the user had run a new
script the second merge brought in, `Sync Database From Export.bat`, which does
`pg_restore --clean --if-exists` from the colleague's latest `legacy/db-exports/*.dump` — this
replaces **both schema and data**, not just data. Confirmed via `loan_accounts` count (1790 → 1783)
and `netProceeds` reverting to `0.00` for `SL-REG_00114` that this had actually run. Worse: the
restored dump predated our `anticipatedDisbursementDate` migration, so Prisma queries against that
column started failing (`P2022: column does not exist`) — the restore had silently dropped it.

No pre-restore backup existed to fully revert to (confirmed: the only `.dump` file present was the
one that had just been restored). Recovery path, in order:
1. Re-ran `prisma migrate deploy` to reapply the missing migration.
2. Re-ran `scripts/backfill-net-proceeds.ts` (all 1783 rows needed correction again).
3. Created a new MIS user for `nomer.perez@easycash.ph` via `scripts/create-additional-mis-user.ts`
   — `bootstrap-admin.ts` refuses once an MIS account already exists, which this DB now had
   (`jomer.biason@easycash.ph`). User ran the command themselves (env vars including
   `MIS_PASSWORD`) since account creation/passwords are never something Claude enters directly.
4. Found `document_templates` (0 rows) and `document_template_mappings` (0 rows) were also empty
   post-restore — re-ran `prisma/seed.ts` (idempotent, upsert-only) to restore the 11 document
   template rows.
5. User asked why the optional Loan Agreement documents never appeared in the Documents card even
   after the seed: `document_template_mappings` was never populated at all (a known ADR-051 §9
   deferred item, not caused by the restore). User specified the business rule directly: every
   "SML"-prefixed loan product (15 found) gets the same 5 conditional documents (Loan Agreement -
   Seafarer, Special Power of Attorney, Deed of Assignment - Borrower/Co-Borrower, Manulife). Wrote
   [scripts/map-sml-document-templates.ts](../app/backend/scripts/map-sml-document-templates.ts)
   (idempotent, `createMany({skipDuplicates: true})`, dry-run supported) and applied it (75 rows).

**Root-cause fix**: wrote
[legacy/Sync Database And Apply Migrations.bat](../legacy/Sync%20Database%20And%20Apply%20Migrations.bat)
— same restore flow as the existing script, but runs `npx prisma migrate deploy` immediately after
`pg_restore`, so schema additions survive regardless of how old the colleague's dump snapshot is.
Also reminds the user (echoed at the end) that they still need to re-run `seed.ts` and the two
data-backfill scripts after any restore, since those aren't schema and won't self-heal via
migrations. User moved this script into `legacy/`; fixed its `ROOT_DIR` resolution (`pushd
"%~dp0.." + %CD%`) so it still finds `app/backend` and `legacy/db-exports` correctly from its new
location. Committed alongside a batch of new template placeholders as `b9969f4`.

**Verified separately with the actual legacy SDevTech data** (not guessed) whether `netProceeds`
and `anticipatedDisbursementDate` exist upstream: direct inspection of the legacy `Loans_details`
Excel sheet (`BETA 1.5.83 LMSv3.xlsm`) confirmed "Anticipated Disbursement Date" is a real,
100%-populated legacy column (260/260 rows) — validating today's earlier field addition — while
"Net Proceeds" is **not** a stored per-loan column there; it's computed live in a separate
standalone calculator workbook ("Net Amount Auto Computation v3...") at origination time, never
persisted historically. Confirms the `backfill-net-proceeds.ts` approach (recomputing from
principal − fees) is the correct way to reconstruct it for old loans, not a data-recovery gap.

## Remaining template placeholders

Continued wiring placeholders into the templates, all reusing already-resolved merge fields (no
further backend changes needed beyond what's noted): `DATA_PRIVACY_CONSENT`,
`DEED_OF_ASSIGNMENT_BORROWER/CO_BORROWER/SALARY`, `SPECIAL_POWER_OF_ATTORNEY` now use
`{Address}`, `{AnticipatedDisbursementDate}`, `{PNNumber}`, `{TotalPaymentDue}`/
`{TotalPaymentDueWords}`, and `{CoBorrowerName}` where applicable. `PROMISSORY_NOTE.docx` also
picked up `{CoBorrowerName}`/`{AnticipatedDisbursementDate}` while the user was at it. This required
one small backend addition: `CoBorrowerName`/`CoBorrowerAddress` (blank when the loan has no
co-borrower) and `AgreementDate` in the merge data resolver, wiring the existing
`ICoBorrowerRepository` instance through `app.ts` — committed as `ee033a2`, then the template edits
as `b9969f4`.

User also asked for personal-info placeholders (First/Middle/Last Name, Date of Birth, Gender,
Civil Status, Nationality, Occupation, Email, Contact Number) — all sourced from the `Borrower`
domain entity, none previously exposed. Added `FirstName`/`MiddleName`/`LastName` (from
`PersonName`'s public fields), `DateOfBirth`, `Gender`, `CivilStatus`, `Nationality`, `Occupation`
(closest available field is `incomeDetail.position`, a job title — flagged to the user as not an
exact semantic match), `Email`, `ContactNumber` (`mobilePhone1`). **Not yet committed** — user was
mid-test with this change and a `MANULIFE.docx` template edit when this log entry was written.
`Term`/`MaturityDate` needed no new work — `{NumberOfInstallments}`/`{MaturityDate}` already
existed from earlier in the session.

## Current state

- Docker stack (`postgres`, `backend`, `frontend`) running locally, backend just rebuilt with the
  new personal-info merge fields (uncommitted).
- Commits made this session (chronological): `5658b3a`, `0152eac`, `c6d9778`, `6200500`, `dc5a130`,
  `80bbc25`, `a3d088c`, `dcccee4`, `e41dae3`, `c750b76`, `1b4f734`, `64b8a47`, `e1f54aa` (merge),
  `5401d1f` (merge), `ee033a2`, `b9969f4`. All pushed to `origin/main` as of `b9969f4`.
- Uncommitted: `LoanDocumentMergeDataResolver.ts` (personal-info fields) and `MANULIFE.docx` —
  user is actively testing, not yet confirmed working.
- Known follow-ups (carried over from 2026-07-13, still unresolved):
  - Two independent Note systems still coexist in the backend (`loan-note` vs `note` module) —
    needs a product decision on which is canonical.
  - Duplicate `LocalFileStorage` in `@shared/infrastructure` and
    `@modules/document/infrastructure`.
  - 16 pre-existing backend test failures in `loan-application`/`borrower` modules — should be
    reported to Jomer, not fixed without knowing his intended redesign.
  - ~~Per-Loan-Product `DocumentTemplateMapping` data still needs confirming.~~ **Resolved for SML
    products** (`map-sml-document-templates.ts`, 75 rows). Still unconfirmed for the other ~28
    non-SML loan products — no optional documents will appear for those until mapped.
- **Template status as of end of session**: `PROMISSORY_NOTE` and `DISCLOSURE_STATEMENT` fully
  functional and confirmed end-to-end (schedule tables, all fee lines, hide-if-zero, rates, fonts).
  `DATA_PRIVACY_CONSENT`, `DEED_OF_ASSIGNMENT_BORROWER/CO_BORROWER/SALARY`,
  `SPECIAL_POWER_OF_ATTORNEY` have placeholders wired but not yet visually/end-to-end confirmed the
  way the first two were. `ACKNOWLEDGEMENT_RECEIPT` deliberately still has no placeholders (mostly
  manual/paper data — check numbers, ATM/passbook details — not tracked in this system; user chose
  to leave it blank/manual for now). `LOAN_AGREEMENT_SALARY`/`LOAN_AGREEMENT_SEAFARER` have
  placeholders wired, confirmed generating (once SML mapping was fixed). `MANULIFE` has only
  `{BorrowerName}` plus whatever the user was mid-editing when this log was written.
- `DISCLOSURE_STATEMENT`'s "Effective Interest Rate" line (§5) still has no placeholder. Per
  ADR-010, "Effective Interest Rate" = Contractual Rate = `LoanAccount.interestRate`, which already
  has a merge field (`{InterestRate}`) — likely just needs the placeholder added in Word, not a new
  backend field, but not yet confirmed with the user.
- Every pre-2026-07-14 loan account was missing `anticipatedDisbursementDate`,
  `addOnInterestRate`, `contractualInterestRate` (all `NULL` — legacy gap, not a bug); temporary
  SQL test values were set and reverted multiple times this session for `SL-REG_00114` while
  testing — as of the last revert, it's back to `NULL` like every other pre-2026-07-14 loan. Any
  **new** loan account created via the Create Loan Account form now correctly persists all three.
- The frontend test harness still has exactly one test file covering pure utility functions — no
  component/page tests yet. Expanding coverage is future work, not attempted here.
- Two sync scripts now coexist: `Sync Database From Export.bat` (data + schema, can drop new
  columns if the dump predates them) and `legacy/Sync Database And Apply Migrations.bat`
  (same, but self-heals the schema afterward via `prisma migrate deploy`). The safe one should
  probably become the only one used going forward, but the old one wasn't removed (colleague-owned
  file, not this session's to delete unilaterally).
