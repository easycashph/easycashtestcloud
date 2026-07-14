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

## Current state

- Working tree clean as of the commits below; Docker stack (`postgres`, `backend`, `frontend`)
  is running locally at `localhost:5173`/`localhost:4000`/`localhost:5432` and left up
  intentionally.
- Commits made this session: `5658b3a` (frontend vitest harness), `0152eac` (11 ADR-051 `.docx`
  templates, placeholder editing in progress). Not yet pushed to `origin/main`.
- Known follow-ups (carried over from 2026-07-13, still unresolved):
  - Two independent Note systems still coexist in the backend (`loan-note` vs `note` module) —
    needs a product decision on which is canonical.
  - Duplicate `LocalFileStorage` in `@shared/infrastructure` and
    `@modules/document/infrastructure`.
  - 16 pre-existing backend test failures in `loan-application`/`borrower` modules — should be
    reported to Jomer, not fixed without knowing his intended redesign.
  - Per-Loan-Product `DocumentTemplateMapping` data still needs confirming.
- Updated follow-up: user is now actively filling in `{Placeholder}` merge fields for the remaining
  9 of 11 ADR-051 templates (`ACKNOWLEDGEMENT_RECEIPT`, `DATA_PRIVACY_CONSENT`,
  `LOAN_AGREEMENT_SALARY`, `LOAN_AGREEMENT_SEAFARER`, `DEED_OF_ASSIGNMENT_BORROWER`,
  `DEED_OF_ASSIGNMENT_CO_BORROWER`, `DEED_OF_ASSIGNMENT_SALARY`, `SPECIAL_POWER_OF_ATTORNEY`,
  `MANULIFE`), plus finishing `DISCLOSURE_STATEMENT`'s remaining blank fields — generation pipeline
  confirmed working, so this is now pure content work in Word, not an engineering blocker.
  `DocumentTemplateMapping` seed data (which conditional docs apply to which loan products) is
  still needed before conditional-document generation is fully usable end-to-end (the 4 required
  documents don't depend on it).
- New follow-up from this session: the frontend test harness now exists but has exactly one test
  file covering pure utility functions — no component/page tests yet. Expanding coverage
  (components, hooks, API type guards) is future work, not attempted here.
