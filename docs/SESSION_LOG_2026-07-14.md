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

## Current state

- Working tree clean as of the commits below; Docker stack (`postgres`, `backend`, `frontend`)
  is running locally at `localhost:5173`/`localhost:4000`/`localhost:5432` and left up
  intentionally.
- Commits made this session: `5658b3a` (frontend vitest harness), `0152eac` (11 ADR-051 `.docx`
  templates), `c6d9778` (inline PDF preview), `6200500` (nginx SPA fallback fix), `dc5a130`
  (Promissory Note schedule + Anticipated Disbursement Date). Not yet pushed to `origin/main`
  (5 commits ahead).
- Known follow-ups (carried over from 2026-07-13, still unresolved):
  - Two independent Note systems still coexist in the backend (`loan-note` vs `note` module) —
    needs a product decision on which is canonical.
  - Duplicate `LocalFileStorage` in `@shared/infrastructure` and
    `@modules/document/infrastructure`.
  - 16 pre-existing backend test failures in `loan-application`/`borrower` modules — should be
    reported to Jomer, not fixed without knowing his intended redesign.
  - Per-Loan-Product `DocumentTemplateMapping` data still needs confirming.
- Updated follow-up: `PROMISSORY_NOTE.docx` is now functionally complete (schedule table, total
  payment due in figures/words, borrower/PN-number fields) and confirmed working end to end. The
  other 8 of 11 ADR-051 templates (`ACKNOWLEDGEMENT_RECEIPT`, `DATA_PRIVACY_CONSENT`,
  `LOAN_AGREEMENT_SALARY`, `LOAN_AGREEMENT_SEAFARER`, `DEED_OF_ASSIGNMENT_BORROWER`,
  `DEED_OF_ASSIGNMENT_CO_BORROWER`, `DEED_OF_ASSIGNMENT_SALARY`, `SPECIAL_POWER_OF_ATTORNEY`,
  `MANULIFE`) still need their `{Placeholder}` merge fields added, plus `DISCLOSURE_STATEMENT`'s
  remaining blank fields (Miscellaneous Fee, Net Proceeds, Effective Interest Rate,
  Late Charges/Atty's Fee/Litigation Fee rates — the resolver already computes/hardcodes these
  values, per 2026-07-14 earlier in this log, only the template placeholders are missing). Pipeline
  confirmed working, so this is pure content work in Word, not an engineering blocker.
  `DocumentTemplateMapping` seed data (which conditional docs apply to which loan products) is
  still needed before conditional-document generation is fully usable end-to-end (the 4 required
  documents don't depend on it).
- New follow-up: only 2 of ~1790 loan accounts in the dev database have `anticipatedDisbursementDate`
  populated (both temporarily, for this session's testing, then reverted to `NULL`) — every
  pre-2026-07-14 loan account will show a blank `{AnticipatedDisbursementDate}` on generated
  documents until a new loan account is created through the (now-fixed) Create Loan Account form.
  Not a bug, just worth knowing when testing against old data.
- New follow-up from this session: the frontend test harness now exists but has exactly one test
  file covering pure utility functions — no component/page tests yet. Expanding coverage
  (components, hooks, API type guards) is future work, not attempted here.
