# ADR-052 — Statement of Account (SOA) Generation

**Status:** ACCEPTED — scope, computation source, and placeholder list confirmed directly with the
user (2026-07-19 session). Backend pipeline and frontend UI (Create SOA dialog + history list on
the Loan Account detail page) both implemented. Remaining: the user still needs to insert the
`.docx` placeholder tags in Word (§6).

**Context documents:** `legacy/reports/SOA Template/StatementOfAccount.docx` (the user's own current
layout — source of truth for wording/fields); `legacy/Excel LMS Files/BETA 1.5.83 LMSv3.xlsm`'s
`vbaProject.bin` VBA source — initially reverse-engineered by searching the compressed binary for
printable ASCII strings (2026-07-19), then the user shared the FULL, real source directly (same
session) for `frmSOAPreview`'s `btnCreateSOA_Click`, `btnApplyPenalties_Click`,
`btnLoadSchedule_Click`, `btnApplyAccrued_Click`, `UpdateFinalAmount`, and `btnGenerateSOA_Click` —
this full source is the actual source of truth for every formula/field below; the earlier
binary-search pass only got the Accrued Interest formula right and got several other things wrong
(flagged individually below), corrected once the full source was available.

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

Confirmed directly with the user (2026-07-19), cross-checked against the legacy Excel/VBA tool's
full source (see the "Context documents" note above — several of these were corrected the same day
once the full source, not just a screenshot/binary-search, was available):

| Field | Source |
|---|---|
| **SOA No.** | **Computed** — `SOA-{5-digit sequence}-{MMDDYYYY}` (e.g. `SOA-00001-07192026`), a **PER-LOAN-ACCOUNT** running counter (`wsLoan.Cells(r, 26)` in the VBA — corrected from an earlier "global counter" assumption made from a screenshot alone) — see §5.3 |
| PN No. | `LoanAccount.loanCode` (distinct from SOA No.) |
| Loan Date | `LoanAccount.anticipatedDisbursementDate` |
| Maturity Date | Last installment's `dueDate` (VBA computes `firstRepaymentDate + (term-1) months`; the persisted schedule's actual last due date is equivalent for a normal monthly schedule and more robust against holiday/manual adjustments) |
| **PN Value** | **Corrected 2026-07-19** — Principal + Interest summed across the ENTIRE original schedule (`btnCreateSOA_Click`'s `totalObligation`), NOT `LoanAccount.principalAmount` alone. Same computation already used as `TotalPrincipal`/`TotalInterest` in `LoanDocumentMergeDataResolver` |
| Borrower / Co-Borrower + Address | Same resolution as `LoanDocumentMergeDataResolver` (blank co-borrower fields when none attached — not "Unknown") |
| **Current Amortization Due** | The next unpaid installment whose due date is AFTER `penaltyToDate` (0 if every installment is due on/before that date) — see §5.1 |
| **Past Due (Principal / Interest)** | Summed across installments whose due date is ON OR BEFORE `penaltyToDate` and that are not yet fully settled as of that date — see §5.1 |
| **Penalty** (part of Past Due) | **Reworked 2026-07-19** — `unpaid balance × Days(penaltyFromDate, penaltyToDate) × rate/30`, using ONE SHARED, manually-entered date range across every Past Due installment (not each installment's own due date) and a per-installment 5%/10% rate tier — deliberately different from BOTH the legacy tool's own per-installment day count AND the system's ADR-050 formula used elsewhere (e.g. Loan Detail's live penalty). See §5.1 |
| Total Past Due | Principal + Interest + Penalty past due (confirmed with the user: includes Penalty, not just Principal + Interest) |
| **Accrued Interest** | **Computed, as of the staff-entered `accruedInterestAsOfDate`** — see §5.2 (unaffected by the corrections above) |
| Collection Fee / Other Fee | **Staff-entered per generation** — no system field for either. Confirmed from the legacy VBA tool's own `txtCollectionFee`/`txtotherfee` text boxes (`_Change`/`_AfterUpdate` event handlers — manual input, never computed there either) |
| Total Amount Due | Current Amortization Due + Total Past Due + Accrued Interest + Collection Fee + Other Fee |
| Remaining Amortization table | Every installment with a positive remaining balance, oldest first, regardless of date (Due Date / Principal / Interest / Total Due) — matches `btnGenerateSOA_Click`'s table-fill loop, which is unconditional on date |

## 5. Three independent date inputs, and the Accrued Interest formula

**5.0 Why three separate date inputs, not one shared "As Of Date"**: the legacy tool's own UI has
independent "To Date" fields for Penalties and for Accrued Interest, both manually entered (no
silent server-side default), so staff can verify each figure before generating. Reworked further
2026-07-19 (user request, after reviewing a mockup): Penalty uses a manually-entered date **range**
(`penaltyFromDate` → `penaltyToDate`), not a single date — applied as ONE SHARED range across every
Past Due installment (not each installment's own due date, unlike the legacy tool itself). Accrued
Interest keeps its own single, independent `accruedInterestAsOfDate`. Implemented throughout the
stack (`StatementOfAccountCalculator.calculate()`'s parameters, `GeneratedStatementOfAccount`'s
three `@db.Date` columns, the API request body, and the Create SOA dialog's three date inputs) —
never conflated into one value.

**5.1 Past Due bucket and Penalty formula:**

- An installment counts toward **Past Due** (Principal, Interest, and is Penalty-eligible) when its
  `dueDate <= penaltyToDate` AND it isn't already fully settled as of that date (unpaid Principal +
  Interest > 0). Deliberately NOT `RepaymentInstallment.status === 'LATE'` — that status is always
  relative to the real clock ("now"), but the whole point of a manually-entered date is to let staff
  check the account as of ANY date (past, present, or a projected future one).
- **Penalty per installment** = `(unpaid Principal + Interest) × Days(penaltyFromDate,
  penaltyToDate) × (rate / 30)`. Two deliberate departures from the legacy tool's own
  `btnApplyPenalties_Click`/`btnLoadSchedule_Click` formula, both confirmed with the user
  (2026-07-19):
  1. The day count comes from the SAME staff-entered `penaltyFromDate`→`penaltyToDate` range for
     every qualifying installment, NOT `DateDiff(installment's own dueDate, cutoffDate)` per
     installment as the legacy tool computed it — lets staff preview "what if penalty only accrued
     from this date" (e.g. a negotiated grace period or collection-intervention date).
  2. `rate` is 5%/month when THAT installment's own unpaid balance is ≤ ₱10,000, else 10%/month —
     the same ₱10,000 threshold as ADR-050, but evaluated per-installment here rather than against
     the whole loan's principal (ADR-050's own basis). Still flat/non-compounding with no grace
     period, unlike ADR-050's live formula used elsewhere (e.g. Loan Detail's penalty) — a
     deliberate, confirmed difference specific to this document, not an oversight.
- **Current Amortization Due** = the next unpaid installment whose `dueDate` is AFTER
  `penaltyToDate` (mirrors `btnCreateSOA_Click`'s "current calendar month" bucket, generalized from
  "the real calendar month" to "after the staff-chosen date").
- The Create SOA dialog shows a **live client-side preview** (Days, Penalty amount, Accrued
  Interest amount) that recomputes as staff adjust the date inputs, mirroring
  `StatementOfAccountCalculator`'s formula in JS against the already-loaded repayment schedule —
  lets staff verify the figures before submitting. The backend recomputes independently at
  generation time and remains the source of truth for what's actually persisted/printed; the
  frontend preview is read-only convenience, not authoritative.

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
  already reflects whatever `penaltyFromDate`/`penaltyToDate` were used for §5.1's Penalty figure).
- **Contractual Rate** = `LoanAccount.contractualInterestRate` (already stored per loan — no new
  field or lookup needed).
- **Days Late** = whole calendar days from the **Maturity Date** (last installment's due date) to
  **`accruedInterestAsOfDate`** (independent of the Penalty date range), clamped to 0 when that date
  hasn't reached maturity yet (no accrual before then, even if individual installments are already
  past due).
- Divided by a flat 30 (not actual days-in-month), matching the legacy tool exactly.

Verified against worked examples in
`tests/unit/statement-of-account/StatementOfAccountCalculator.test.ts` (11 tests) — including a
test confirming `penaltyFromDate`/`penaltyToDate` apply as ONE SHARED range across multiple
installments regardless of each one's own due date, a test confirming the 5%/10% rate tier switches
per-installment based on that installment's own unpaid balance, and a test confirming the Penalty
range and `accruedInterestAsOfDate` act as fully independent inputs.

**5.3 SOA Number** — `SOA-{5-digit soaSequenceNumber}-{MMDDYYYY of generatedAt}` (e.g.
`SOA-00001-07192026`), confirmed against a real screenshot of the legacy tool's own "Create SOA"
form, then against the full VBA source (`btnCreateSOA_Click`: `soaCount = wsLoan.Cells(r,
26).Value + 1`) — a **PER-LOAN-ACCOUNT** running counter, corrected 2026-07-19 from an earlier
"global counter" assumption (the screenshot alone didn't reveal the scope; the full source did).
Implemented similarly to `CreateLoanAccountUseCase.generateLoanCode` — read the current max
`soaSequenceNumber` FOR THIS LOAN ACCOUNT, add 1, and use that value BEFORE filling the PDF (since
the number is a placeholder on the document itself, it must be known ahead of the DB insert — a
plain `Int` column, not a Postgres-native autoincrement/sequence, which would only yield a value
after insert). This is a non-atomic read-then-use, same accepted tradeoff as the loan code precedent
for this low-frequency, staff-driven action. `formatSoaNumber()` (pure, unit-tested in
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
`{PastDuePenalty}`, `{PenaltyFromDate}`/`{PenaltyToDate}` (the manually-entered date range §5.1's
Penalty figure was computed against), `{TotalPastDue}`, `{AccruedInterest}`,
`{AccruedInterestAsOfDate}` (the manually-entered date §5.2's Accrued Interest figure was computed
as of — independent of the Penalty range), `{CollectionFee}`, `{OtherFee}`, `{TotalAmountDue}`.

Remaining Amortization table (wrap the data row in `{#RemainingSchedule}`/`{/RemainingSchedule}` so
docxtemplater repeats it once per unpaid installment): `{DueDate}`, `{Principal}`, `{Interest}`,
`{TotalDue}`.

The footer's bank account block is static text already in the template — no placeholder needed.

Until the template file has these tags, `POST /loan-accounts/:id/statements-of-account` will
successfully compute and persist the figures but the returned PDF's body will be blank where a tag
should render (docxtemplater silently leaves unrecognized-tag text as-is; it does not error) — this
is a template-content gap, not a pipeline bug.

## 7. Frontend UI (implemented)

"Create SOA" action on the Loan Account detail page opens a dialog with:
- **Penalty (daily computation)**: From date / To date inputs (both required, default today,
  editable), plus a live-computed Days / Penalty amount readout (see §5.1's client-side preview
  note) and a static note explaining the 5%/10% threshold.
- **Accrued interest**: a single As of date input, plus a live-computed amount readout.
- Collection Fee and Other Fee inputs.

Below it, a history list (newest first) shows every past generation with its Penalty date range,
Accrued Interest date, Total Amount Due, who/when generated, and Preview (inline PDF, reusing
`LoanDocumentPreviewModal` — generalized to take a `downloadPath` prop so both ADR-051's Documents
and this feature share one component) and Download.

## 8. HTTP API

```
POST /loan-accounts/:id/statements-of-account         — generate (body: penaltyFromDate, penaltyToDate, accruedInterestAsOfDate, collectionFee?, otherFee?)
GET  /loan-accounts/:id/statements-of-account         — list history for this loan, newest first
GET  /loan-accounts/:id/statements-of-account/:generatedStatementId/download — download the PDF
```

Same auth/branch-access level as `GET /loan-accounts/:id` itself (ADR-051 §5's precedent) — no
additional role restriction.
