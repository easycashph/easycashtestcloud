# ADR-052 — Statement of Account (SOA) Generation

**Status:** ACCEPTED — scope, computation source, and placeholder list confirmed directly with the
user (2026-07-19 session). Backend pipeline and frontend UI (Create SOA dialog + history list on
the Loan Account detail page) both implemented. Remaining: the user still needs to insert the
`.docx` placeholder tags in Word (§6).

**Context documents:** `legacy/reports/SOA Template/StatementOfAccount.docx` (the user's own current
layout — source of truth for wording/fields); `legacy/Excel LMS Files/BETA 1.5.83 LMSv3.xlsm`'s
`vbaProject.bin` VBA source (the user's own working SOA-generation tool — source of truth for the
Accrued Interest formula and which fields are computed vs. staff-entered).

---

## 1. Why this is a separate module, not part of ADR-051's 11-document pipeline

ADR-051 §1 explicitly scoped Statement of Account **out** of the required/conditional
`DocumentTemplate` matrix: "requested on demand at any point during a loan's life (a
servicing/collection document), not generated once after approval like the other 11." This ADR
implements that deferred feature.

Consequences of that different lifecycle:
- No `DocumentTemplate` row, no `DocumentTemplateMapping`, no required/conditional gating — SOA
  applies to every loan account uniformly, regardless of product.
- A new, independent module (`app/backend/src/modules/statement-of-account/`) and table
  (`GeneratedStatementOfAccount`), not a row in `GeneratedLoanDocument`.
- Still reuses ADR-051 §4's underlying generation stack directly: `IDocumentFiller`
  (docxtemplater), `IDocxToPdfConverter` (LibreOffice headless), `IFileStorage` (local storage
  abstraction). The SOA use case calls `documentFiller.fill('SOA', mergeData)` with a hardcoded
  template code, bypassing `DocumentTemplateRepository` entirely.
- Same append-only philosophy as `GeneratedLoanDocument` (ADR-051 §3): every generation is its own
  permanent, immutable snapshot — a later payment or penalty accrual must never silently change
  what an already-generated SOA said at the time it was produced or sent.

## 2. Data model

```
GeneratedStatementOfAccount — one row per generation event (append-only, no template/mapping tables)
```

Unlike `GeneratedLoanDocument` (which stores only a `storageKey` and re-derives everything else from
the live loan on demand), this table also stores the **computed figures themselves**
(`currentAmortizationDue`, `pastDuePrincipal/Interest/Penalty`, `totalPastDue`, `accruedInterest`,
`collectionFee`, `otherFee`, `totalAmountDue`) at the row level. This is deliberate: Collection
Fee/Other Fee are staff-entered per generation (§4) and can't be re-derived later, and the whole
point of an immutable snapshot is that it must not change even if the underlying loan's balances
are later corrected — storing only a PDF blob would make that snapshot un-queryable (e.g. for a
future "total amount billed across all SOAs" report) without re-parsing PDFs.

## 3. Trigger point and lifecycle

Available for generation once a loan reaches **APPROVED**, **ACTIVE**, or **ACTIVE_IN_ARREARS**
status — the same `GENERATABLE_STATUSES` gate as ADR-051 §2's required documents, since an SOA is
meaningless before the loan's terms are final. "Regenerate" always inserts a new row (§2); there is
no edit/overwrite operation on an existing `GeneratedStatementOfAccount`.

## 4. Field sourcing — confirmed vs. computed vs. staff-entered

Confirmed directly with the user (2026-07-19), cross-checked against the legacy Excel/VBA tool:

| Field | Source |
|---|---|
| **SOA No.** | **Computed** — `SOA-{5-digit sequence}-{MMDDYYYY}` (e.g. `SOA-00001-07192026`), a GLOBAL running counter across every loan account. Originally set to `LoanAccount.loanCode` (2026-07-19), then corrected the same day after the user shared a real screenshot of the legacy tool showing this distinct numbering — see §5.3 |
| PN No. | `LoanAccount.loanCode` (unchanged — distinct from SOA No.) |
| Loan Date | `LoanAccount.anticipatedDisbursementDate` |
| Maturity Date | Last installment's `dueDate` |
| PN Value | `LoanAccount.principalAmount` |
| Borrower / Co-Borrower + Address | Same resolution as `LoanDocumentMergeDataResolver` (blank co-borrower fields when none attached — not "Unknown") |
| Current Amortization Due | The next unpaid installment that is **not yet LATE** (0 if every remaining installment is already LATE) — not date-dependent |
| Past Due (Principal / Interest) | Summed across LATE installments only — not date-dependent (LATE status is always relative to real "now", per `RepaymentInstallment.status`) |
| **Penalty** (part of Past Due) | Summed across LATE installments, using the same override-then-live-ADR-050-projection-then-frozen precedence as `RepaymentInstallmentPresenter`, **as of the staff-entered `penaltyAsOfDate`** — see §5.1 |
| Total Past Due | Principal + Interest + Penalty past due (confirmed with the user: includes Penalty, not just Principal + Interest) |
| **Accrued Interest** | **Computed, as of the staff-entered `accruedInterestAsOfDate`** — see §5.2 |
| Collection Fee / Other Fee | **Staff-entered per generation** — no system field for either. Confirmed from the legacy VBA tool's own `txtCollectionFee`/`txtotherfee` text boxes (`_Change`/`_AfterUpdate` event handlers — manual input, never computed there either) |
| Total Amount Due | Current Amortization Due + Total Past Due + Accrued Interest + Collection Fee + Other Fee |
| Remaining Amortization table | Every unpaid installment, oldest first (Due Date / Principal / Interest / Total Due) |

## 5. Two independent "as of" dates, and the Accrued Interest formula

**5.0 Why two separate dates, not one shared "As Of Date"** (2026-07-19, user request): the legacy
tool's own UI has independent "To Date" fields for Penalties and for Accrued Interest — staff can
check the Penalty figure as of one date and the Accrued Interest figure as of a different date
before generating, and both are manually entered (no silent server-side default), so staff can
verify the computation is correct first. Implemented as `penaltyAsOfDate` and
`accruedInterestAsOfDate` throughout the stack (`StatementOfAccountCalculator.calculate()`'s
parameters, the `GeneratedStatementOfAccount` table's two `@db.Date` columns, the API request body,
and the Create SOA dialog's two date inputs) — never conflated into one value.

**5.1 Penalty** — `pastDuePenalty` is computed **as of `penaltyAsOfDate`**, via
`resolveComputedPenalty()` (ADR-050's live daily formula) for an open, prospective-loan
installment, falling back to any `penaltyOverride` or the frozen `due.penalty`, exactly like
`RepaymentInstallmentPresenter`'s display logic.

**5.2 Accrued Interest formula** — found verbatim in
`legacy/Excel LMS Files/BETA 1.5.83 LMSv3.xlsm`'s `vbaProject.bin`, under a comment block literally
titled `--- NEW ACCRUED INTEREST FORMULA ENGINE ---`:

```
Formula: ((txtTotalPastDue x Contractual Rate) / 30 days) x days late
```

with an adjacent comment: *"Date Logic: Compute exact days late dynamically from Maturity Date to
target Accrued Date... Clamp to 0 if not past maturity."*

Confirmed with the user (2026-07-19) and implemented in `StatementOfAccountCalculator` as:

```
Accrued Interest = (Total Past Due [Principal + Interest + Penalty] × Contractual Rate) / 30 × Days Late
```

- **Total Past Due** = the same Principal + Interest + Penalty past-due figure as the template's own
  "Total Past Due" line (confirmed with the user — not a Principal+Interest-only base; note this
  already reflects whatever `penaltyAsOfDate` was used for §5.1's Penalty figure).
- **Contractual Rate** = `LoanAccount.contractualInterestRate` (already stored per loan — no new
  field or lookup needed).
- **Days Late** = whole calendar days from the **Maturity Date** (last installment's due date) to
  **`accruedInterestAsOfDate`** (NOT `penaltyAsOfDate` — the two are independent), clamped to 0 when
  that date hasn't reached maturity yet (no accrual before then, even if individual installments
  are already past due).
- Divided by a flat 30 (not actual days-in-month), matching the legacy tool exactly.

Verified against a worked example in
`tests/unit/statement-of-account/StatementOfAccountCalculator.test.ts`: Total Past Due ₱1,150.00 ×
3% ÷ 30 × 40 days late = ₱46.00; a second test confirms `penaltyAsOfDate` and
`accruedInterestAsOfDate` genuinely act as two independent inputs (pushing one later changes its
own figure — and, via the larger Total Past Due base, Accrued Interest too — without the other
date's figure being affected directly).

**5.3 SOA Number** — `SOA-{5-digit soaSequenceNumber}-{MMDDYYYY of generatedAt}` (e.g.
`SOA-00001-07192026`), confirmed against a real screenshot of the legacy tool's own "Create SOA"
form (2026-07-19). A GLOBAL running counter across every loan account, not per-loan (the legacy
format has no loan-code prefix, unlike `LoanAccount.loanCode`/PN No.). Implemented the same way as
`CreateLoanAccountUseCase.generateLoanCode` — read the current max `soaSequenceNumber` across all
`GeneratedStatementOfAccount` rows, add 1, and use that value BEFORE filling the PDF (since the
number is a placeholder on the document itself, it must be known ahead of the DB insert — a plain
`Int` column, not a Postgres-native autoincrement/sequence, which would only yield a value after
insert). This is a non-atomic read-then-use, same accepted tradeoff as the loan code precedent for
this low-frequency, staff-driven action. `formatSoaNumber()` (pure, unit-tested in
`tests/unit/statement-of-account/formatSoaNumber.test.ts`) is the single place this format is
computed, called from both the generation path (before filling the template) and read paths
(`GeneratedStatementOfAccount.soaNumber` getter, `PrismaGeneratedStatementOfAccountRepository`'s
history view) so the two can never drift apart.

## 6. Placeholder naming (for the `.docx` template, ADR-051 §2's "hand-edited in Word" workflow)

Following the same convention as ADR-051 §8/§2 — the `.docx` is edited directly in Microsoft Word,
not auto-generated by this tooling. `app/backend/templates/SOA.docx` currently holds the user's
blank layout (copied 2026-07-19 from `legacy/reports/SOA Template/StatementOfAccount.docx`) with
**no merge tags yet** — the user needs to insert the following `{Placeholder}` tags into that file
in Word, matching the cell each label sits next to:

Header/identity: `{StatementDate}` (the generation date, not a manual input), `{BorrowerName}`,
`{BorrowerAddress}`, `{CoBorrowerName}`, `{CoBorrowerAddress}`.

Account Information: `{SOANumber}`, `{PNNumber}`, `{LoanDate}`, `{Term}`, `{MaturityDate}`,
`{PNValue}`.

Statement Summary: `{CurrentAmortizationDue}`, `{PastDuePrincipal}`, `{PastDueInterest}`,
`{PastDuePenalty}`, `{PenaltyAsOfDate}` (the manually-entered date §5.1's Penalty figure was
computed as of), `{TotalPastDue}`, `{AccruedInterest}`, `{AccruedInterestAsOfDate}` (the
manually-entered date §5.2's Accrued Interest figure was computed as of — independent of
`{PenaltyAsOfDate}`), `{CollectionFee}`, `{OtherFee}`, `{TotalAmountDue}`.

Remaining Amortization table (wrap the data row in `{#RemainingSchedule}`/`{/RemainingSchedule}` so
docxtemplater repeats it once per unpaid installment): `{DueDate}`, `{Principal}`, `{Interest}`,
`{TotalDue}`.

The footer's bank account block is static text already in the template — no placeholder needed.

Until the template file has these tags, `POST /loan-accounts/:id/statements-of-account` will
successfully compute and persist the figures but the returned PDF's body will be blank where a tag
should render (docxtemplater silently leaves unrecognized-tag text as-is; it does not error) — this
is a template-content gap, not a pipeline bug.

## 7. Frontend UI (implemented)

"Create SOA" action on the Loan Account detail page opens a dialog with two date inputs (Penalty -
As Of Date, Accrued Interest - As Of Date, both required, defaulting to today but editable),
Collection Fee, and Other Fee, then generates. Below it, a history list (newest first) shows every
past generation with both dates, Total Amount Due, who/when generated, and Preview (inline PDF,
reusing `LoanDocumentPreviewModal` — generalized to take a `downloadPath` prop so both ADR-051's
Documents and this feature share one component) and Download.

## 8. HTTP API

```
POST /loan-accounts/:id/statements-of-account         — generate (body: penaltyAsOfDate, accruedInterestAsOfDate, collectionFee?, otherFee?)
GET  /loan-accounts/:id/statements-of-account         — list history for this loan, newest first
GET  /loan-accounts/:id/statements-of-account/:generatedStatementId/download — download the PDF
```

Same auth/branch-access level as `GET /loan-accounts/:id` itself (ADR-051 §5's precedent) — no
additional role restriction.
