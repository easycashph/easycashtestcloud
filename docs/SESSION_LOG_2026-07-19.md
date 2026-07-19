# Session Log — 2026-07-19

## Summary

Mixed session: a merge with a parallel teammate session, several git-mechanics Q&A threads, a
declined-then-abandoned access-restriction feature, a macOS setup script, a sidebar CSS bug fix
(two iterations), and — the largest item — a new Statement of Account (SOA) generation feature
built end to end (backend + frontend), sourced from the user's own legacy Excel/VBA tool.

## What was done, in order

1. **Merge with Jomer's parallel session** (`2543860` → `61e2ec5`): global search, real overdue
   notification scheduler, bulk decline on Loan Applications, in-app Help. One conflict, in
   `server.ts` (combined both sides' scheduler startup code). Verified clean (tsc, 729/729 tests,
   Docker rebuild) before pushing.
2. **Git mechanics Q&A** (no code changes): commit-vs-push, whether a commit can be altered by
   others, verifying a commit is really on GitHub via `gh api`. User asked to revert a push, then
   explicitly said to stop mid-explanation — no revert was performed.
3. **Declined features** (both explicitly stopped by the user before implementation):
   - Hiding the Reminder Settings toggle from one specific MIS colleague (Jomer) until informed —
     user chose to just tell him directly instead.
   - A "someone else is already working on this" presence notification — abandoned mid-scoping.
4. **UI lock on SMS/Email reminder toggles** (`f8eec55`): grayed out, disabled, with a banner
   ("...by MIS - Nomer"). UI-only, trivially reversible (one boolean flag).
5. **macOS setup**: found `docs/MACOS_SETUP_GUIDE.md` referenced a `setup-macos.sh` that didn't
   exist yet — wrote it (`cd2c167`), automating §1-§4 (prerequisites, env files, Postgres, npm
   install, Prisma generate/migrate/seed), deliberately stopping before §5 (legacy data migration).
   Also covered GitHub CLI setup, SSH commit signing, and the `pg_dump`/`pg_restore` process for
   copying the Windows Postgres database to the Mac.
6. **Caught a real PII gap**: `app/docker/easycash-backup.dump` (a real client-data pg_dump) was
   found untracked and NOT covered by any `.gitignore` rule. Moved to the correct, already-ignored
   `legacy/db-exports/` location and added a blanket `*.dump` safety-net rule. Merged with a second
   parallel session (`d72d0d7`, Mac `.command` scripts + a `legacyDumpPath.ts` helper).
7. **Diagnosed `backup-mongodb.bat` failure**: not a script bug — the remote SDevTech MongoDB
   server actively refuses TCP connections on port 5200 (confirmed via `Test-NetConnection`), a
   remote/external issue to raise with SDevTech.
8. **Sidebar CSS bug, two iterations**:
   - First report: sidebar scrolled away with the page. Root cause: the sidebar's flex wrapper
     stretched to match the main column's height (flexbox `align-items: stretch` default) and,
     combined with `overflow-hidden`, broke the sticky `<aside>` inside it. Fixed with `self-start`
     (`82faaf0`... actually see below, this was superseded).
   - User then clarified they actually wanted **independent scroll regions** (sidebar and main
     content each scroll on their own, not one shared page scroll) — a bigger change than the
     first fix. Reworked `AppLayout.tsx` to a viewport-height (`h-dvh` + `overflow-hidden`) shell
     with each pane owning its own `overflow-y-auto` region. Committed (`82faaf0`) and pushed.
     Deliberately reverts an earlier "shared document scroll" design that existed because
     `100vh`/`100dvh` could over-report height vs. the visible area above the Windows taskbar at
     some zoom/DPI combos — flagged as a risk to watch for, not silently re-introduced.
9. **Statement of Account (SOA) generation — the main feature of this session.**

## SOA feature — full detail

### Discovery phase

- Found an existing `StatementOfAccountPage.tsx` (browser view + `window.print()`) already at
  `/loans/:loanId/soa`, not linked from anywhere in the UI, with "Export PDF" as a disabled "Coming
  Soon" button.
- Found `seed.ts`'s own comment confirming SOA was deliberately excluded from ADR-051's 11-document
  pipeline as "a separate, on-demand feature" — not yet built.
- User confirmed: build a "Create SOA" button on the Loan Account detail page, reusing the existing
  docx/PDF generation pipeline (docxtemplater + LibreOffice headless), with SOA-specific
  computation.

### Formula sourcing (critical — nothing was invented)

- User supplied `legacy/reports/SOA Template/StatementOfAccount.docx` — a blank layout (labels,
  empty cells), no merge tags. Extracted via `mammoth`/`pizzip` (Node, no Word needed).
- User then supplied `legacy/Excel LMS Files/BETA 1.5.83 LMSv3.xlsm` as the reference for the
  Accrued Interest computation. Extracted the actual VBA source from `xl/vbaProject.bin` (a
  compressed OLE binary) by searching for printable ASCII strings around keyword hits — found a
  comment block literally titled `--- NEW ACCRUED INTEREST FORMULA ENGINE ---`:
  ```
  Formula: ((txtTotalPastDue x Contractual Rate) / 30 days) x days late
  ```
  plus "Date Logic: Compute exact days late dynamically from Maturity Date to target Accrued
  Date... Clamp to 0 if not past maturity."
- Also discovered (same VBA source) that Collection Fee and Other Fee are **staff-entered manual
  text boxes** in the legacy tool (`txtCollectionFee`/`txtotherfee`, with `_Change`/`_AfterUpdate`
  handlers) — not computed anywhere — which shaped the "Create SOA" dialog design (asks for these
  two values instead of trying to derive them).
- Confirmed with the user directly: SOA No. = Loan Code; Loan Date = Anticipated Disbursement Date;
  "Total Past Due" in the formula = Principal + Interest + Penalty (not Principal + Interest only).

### Backend (`app/backend/src/modules/statement-of-account/`)

New, independent module — NOT a row in `DocumentTemplate`/`GeneratedLoanDocument` (ADR-051 §1
explicitly excluded SOA from that required/conditional matrix). Reuses the same underlying
`IDocumentFiller`/`IDocxToPdfConverter`/`IFileStorage` ports directly, calling
`documentFiller.fill('SOA', mergeData)` with a hardcoded template code.

- **Migration** `20260719060230_add_statement_of_account` — new `GeneratedStatementOfAccount`
  table, storing the computed figures themselves (not just a PDF blob), since Collection
  Fee/Other Fee can't be re-derived later and the whole point is an immutable per-generation
  snapshot.
- **`StatementOfAccountCalculator`** (pure, unit-tested) — computes Current Amortization Due, Past
  Due (Principal/Interest/Penalty, LATE installments only, penalty via the same
  override-then-live-ADR-050-projection-then-frozen precedence as `RepaymentInstallmentPresenter`),
  Total Past Due, Accrued Interest (the formula above), and the Remaining Amortization table.
  7 unit tests in `tests/unit/statement-of-account/StatementOfAccountCalculator.test.ts`, including
  a worked example matching the formula exactly (₱1,150.00 Total Past Due × 3% ÷ 30 × 40 days =
  ₱46.00).
- **`StatementOfAccountMergeDataResolver`** — resolves borrower/co-borrower/loan data + calls the
  calculator, produces the flat placeholder map for docxtemplater.
- **`GenerateStatementOfAccountUseCase`** / **`ListStatementsOfAccountUseCase`** /
  **`GetGeneratedStatementOfAccountFileUseCase`** — mirror `loan-document`'s use-case shape exactly.
- **HTTP**: `POST/GET /loan-accounts/:id/statements-of-account`,
  `GET /loan-accounts/:id/statements-of-account/:id/download` — same auth/branch-access level as
  `GET /loan-accounts/:id` (ADR-051 §5 precedent).
- Wired into `app.ts` alongside the existing loan-document wiring.
- Full backend suite verified after every change: 736/736 passed (up from the 729 baseline + 7 new
  SOA tests), `tsc --noEmit` clean.

### Frontend

- New "Statement of Account" card on `LoanDetailPage.tsx` (below Documents): "Create SOA" button
  opens a dialog (As Of Date, Collection Fee, Other Fee inputs) → generates → lists past
  generations with Download. `tsc --noEmit` and `npm run build` both clean.

### Documentation

- `docs/Architecture/ADR-052-statement-of-account-generation.md` — full scope, data model, formula
  citation (with the exact legacy source), and the complete `{Placeholder}` list still needed in
  the `.docx` template.
- `app/frontend/CHANGELOG.md` — new 2026-07-19 entry.

## Current state / known follow-up work

- **`app/backend/templates/SOA.docx` has NO merge tags yet** — it's the user's blank layout, copied
  as-is. Per ADR-051 §2's established convention ("hand-edited by the user directly in Microsoft
  Word — not auto-generated by this tooling"), the user needs to open that file in Word and insert
  the placeholder tags listed in ADR-052 §6. Until then, `POST .../statements-of-account` will
  compute and persist figures correctly and produce a PDF, but the PDF's body will render blank
  where each tag should be (docxtemplater leaves unrecognized text as-is rather than erroring).
- No browser click-through was possible this session (no login credentials in this environment,
  a standing constraint throughout) — verified via `tsc`, `vitest`, and `npx prisma migrate status`
  only. The user still needs to confirm both the sidebar independent-scroll fix and the SOA feature
  end-to-end in their own browser.
- SOA history list UI exists (backend + a card on Loan Detail), but there's no dedicated
  cross-loan SOA browsing page — not requested, not built.

## Addendum — SOA corrections after the user shared the full legacy VBA source

After the initial SOA implementation above, the user asked for a "View SOA" preview button
(implemented — Preview alongside Download in the history list, reusing a generalized
`LoanDocumentPreviewModal`), then shared a screenshot of the legacy tool's actual popup UI and
finally its complete VBA source (`frmSOAPreview`'s event handlers). Comparing against that ground
truth surfaced several mistakes in the first pass, all corrected the same session:

1. **SOA Number scope**: implemented as a global counter; the VBA (`wsLoan.Cells(r, 26)`) proved
   it's per-loan-account. Fixed `findMaxSoaSequenceNumber` to filter by `loanAccountId`.
2. **PN Value**: implemented as `LoanAccount.principalAmount`; the VBA's `totalObligation` is
   Principal + Interest summed across the entire schedule. Fixed in the merge data resolver.
3. **Past Due / Current Amortization bucketing**: implemented using `RepaymentInstallment.status`
   (LATE/PENDING, always relative to the real clock); the VBA buckets by comparing each
   installment's due date against the STAFF-ENTERED `penaltyAsOfDate`. Since the whole point of a
   manual "as of" date is to let staff check the account as of any date, this was a real bug, not a
   style choice — rewrote `StatementOfAccountCalculator` to bucket by date comparison instead of
   installment status.
4. **Penalty formula**: implemented using the system's own ADR-050 formula (compounding,
   size-tiered 5%/10%, 3-day grace) so the SOA would agree with the Loan Detail page. The VBA uses a
   different, flatter formula (10%/month flat, linear daily proration, no grace period,
   non-compounding) specific to this legacy tool. Asked the user directly which to use — **user
   chose the legacy formula** — implemented that exactly, documented in ADR-052 §5.1 as a
   deliberate, confirmed difference from the rest of the system.

`StatementOfAccountCalculator`'s test suite was rewritten from scratch to match (10 tests, up from
7), plus a `formatSoaNumber` test (3 tests) — 742/742 backend tests passing overall.

This is a good illustration of why "ask for the real source before implementing" matters even after
a design has already been confirmed once: the first implementation was internally consistent and
passed its own tests, but several of its computations were still guesses dressed as reasonable
defaults (e.g. "match the Loan Detail page's live penalty" seemed like the safer, more consistent
choice) until the actual legacy behavior was available to check against.
