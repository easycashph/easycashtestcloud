# Reference: MIS Nomer's Excel-Based LMS (`BETA 1.5.83 LMSv3.xlsm`)

**Source:** `legacy/reports/BETA 1.5.83 LMSv3.xlsm` (gitignored — real client PII; ~7MB, 18 sheets,
macro-enabled). **Not** SDevTech/Mambu legacy production data — this is MIS Nomer's own,
separately hand-built Excel/VBA tool for running the same lending business day-to-day. Treated
here as a **second, independently-built reference implementation** of the business's rules, useful
for cross-validation and for spotting features this project hasn't built yet — not as a primary
source of truth on its own (per `CLAUDE.md`: legacy evidence must be validated, never assumed).

**Analysis method (2026-07-11):** the workbook's actual computation logic lives in a ~32MB
`vbaProject.bin` macro project, not live cell formulas — of the columns inspected, only 2 had a
live formula (`Processing Fee % = Amount / Principal`, `Account Management Fee % = Amount /
Principal`); everything else (Monthly Amortization, Net Proceeds, EIR, interest/principal splits)
is a pasted, macro-computed value. The VBA was **not decompiled** (would need `oletools`/Python or
LibreOffice, neither installed on this machine). Findings below come from (a) sheet/column
structure, which is directly readable, and (b) reverse-deriving formulas from worked-example
values in `TempAmort` and cross-checking against `Rate_details` — not from reading macro source.

---

## 1. Sheet inventory

| Sheet | Rows | What it is |
|---|---|---|
| `Loans_details` | 261 | Loan-account-creation record — one row per loan, the closest analog to our `LoanAccount` |
| `Client_details` | 1,657 | Borrower KYC profile — analog to our `Borrower` |
| `CoBorrower_details` | 84 | Co-borrower profile — analog to our `CoBorrower` |
| `Reference_details` | 12 | Character references (contacts, not co-borrowers) |
| `Product_details` | 10 | Product catalog (name + short code) — analog to our `LoanProduct` |
| `Rate_details` | 140 | **Term → interest rate lookup table** (Add-On % and Contractual % per term) |
| `Master_Schedules` | 6,826 | Per-installment amortization + payment tracking — analog to our `RepaymentSchedule` |
| `Payment_History` | 3,097 | Payment ledger — analog to our `LoanTransaction` (type=REPAYMENT) |
| `Requirements_Setup` | 154 | **Per-product list of required KYC/loan documents** |
| `Checklist_Database` | 23 | Per-application checklist tracking which documents were actually submitted, with remarks |
| `Expected` | 31,129 | Portfolio-wide "as of [date]" balance summary (Expected/Paid/Due per component, per client) — formulas are broken (`#REF!`), unreliable as a live report but the structure is informative |
| `Activity_Logs`, `Change_Log` | 33 / 176 | Audit trail — analog to our `AuditLog`/`ActivityLog` |
| `Checklist_Database`, `TempAmort`, `TempSearch`, `TempLedger`, `TempLogView`, `Schedule`, `Sheet5` | small | Scratch/working sheets, some with broken `#REF!` formulas — not reliable evidence on their own |

---

## 2. Confirmed: formula cross-validation

**Declining-balance interest and level-payment (`PMT`) amortization now match two independently
built systems, not just one legacy source.** Full write-up, worked numbers, and the exact
evidence trail are in `CALCULATION_ENGINE_SPEC.md` §1–§2 (updated 2026-07-11) — not repeated here.
Summary: `TempAmort`'s 5-period worked example (₱102,912.36 principal, 5-month term, 4.85% rate
from `Rate_details`) reproduces this project's own `AmortizationScheduleGenerator` /
`DecliningBalanceInterestCalculator` output exactly, to the centavo, including the final-
installment rounding-remainder behavior.

**`Master_Schedules`'s column structure independently validates this project's `RepaymentSchedule`
design.** Its `Expected → Paid → Due` per-component pattern (Principal/Interest/Penalty/Fees) is
the same shape as `InstallmentAmounts`/`RepaymentInstallment.due/paid` — built independently,
arriving at the same structure.

**Add-On rate vs. Contractual rate usage matches `ADR-046`.** `Rate_details` stores both a flat
Add-On rate (constant 3% across every term sampled) and a term-varying Contractual rate — this
project's `ADR-046-advance-interest-fee-extended-first-repayment-gap.md` §3.2 already found
("confirmed two ways") that Add-On Rate, not Contractual Rate, is the basis for advance-interest
computation on an extended first-repayment gap. This workbook's Add-On/Contractual split is
consistent with that finding, though the exact Advance Interest formula was not re-derived here —
see `ADR-046` for that research; this doc doesn't duplicate it.

---

## 3. Features this workbook has that this project doesn't (yet)

Checked directly against the current backend (`app/backend/src`) as of 2026-07-11 — not assumed.

### 3.1 Missing entirely

| Feature (from the Excel) | Evidence | Status in this project |
|---|---|---|
| **Per-product document/KYC requirements checklist** | `Requirements_Setup` (list of required docs per product, e.g. DTI/BIR/Mayor's Permit for Business Loan, OEC/Seaman's Book/Allotment Slip for Seaman's Loan) + `Checklist_Database` (per-application tracking of which were submitted, with a True/False + remarks per document) | **Missing.** `LoanApplication.submittedDocuments` (`prisma/schema.prisma`) is a flat `String[]` of document names typed in at intake — no per-product *required* list, no per-document status/remarks, no link to a document library. This is the single biggest gap found — matches `CLAUDE.md`'s "Document Management" as a required system component that isn't built yet. |
| **Official Receipt / Acknowledgment Receipt numbers on payments** | `Payment_History` columns `OR#`, `AR#` | **Missing.** No `LoanTransaction` field for a receipt number of any kind — a real audit/compliance gap for a lending company that issues receipts. |
| **Bank/ATM disbursement details on the loan account** | `Loans_details` columns `Bank Name`, `ATM Card Number`, `Bank Account Number`, `Name on Card/Account` | **Missing.** `LoanAccount` has no disbursement-channel fields at all. |
| **EIR Monthly / EIR Annual** | `Loans_details` columns `EIR Monthly`, `EIR Annual` | **Missing.** No effective-interest-rate calculation exists anywhere in the calculation engine — regulatory-disclosure-relevant, not just informational. |
| **Net Proceeds** (principal minus total fees, what the borrower actually receives) | `Loans_details` column `Net Proceeds` | **Missing as an explicit field/calculation**, though derivable today from `principalAmount` minus the sum of configured `Fee` records — not currently computed or surfaced anywhere. |
| **Penalty Waived flag per installment** | `Master_Schedules` column `Penalty Waived` | **Missing.** No waiver concept on `RepaymentInstallment`/`InstallmentAmounts`. |
| **Anticipated Disbursement Date, distinct from First Repayment Date** | `Loans_details` column `Anticipated Disbursement Date` | **Missing as a distinct field.** `LoanAccount` has `activatedAt` (actual) and `firstRepaymentDate` (contractual), but no separate "planned/anticipated disbursement" concept for the pre-activation stage. |

### 3.2 Exists in the backend, but not surfaced in the frontend

| Feature | Backend status | Frontend status |
|---|---|---|
| **Character References** (`Reference_details` sheet: 3 contact persons per client, with relationship — Friend/Relative/Employer/etc.) | **Already built end-to-end** — `CharacterReference` domain type, `characterReferences` on `Borrower`, Prisma model, repository, presenter (`app/backend/src/modules/borrower/domain/Borrower.ts`, `PrismaBorrowerRepository.ts`, `BorrowerPresenter.ts`). | **Not fetched or displayed anywhere.** `app/frontend/src/lib/loanApiTypes.ts`'s `Borrower` type doesn't even include this field — the frontend doesn't know it exists. |
| **Government ID (SSS/TIN) and Identification Documents** | Already built end-to-end (`BorrowerGovernmentId`, `IdentificationDocument`, same files as above). | **Not displayed.** `governmentId` is in the frontend `Borrower` type but `ClientProfilePage.tsx` never renders `sssNumber`/`tinNumber`; `identificationDocuments` isn't in the frontend type at all — confirmed by direct search, not assumed. |
| **Dual-address structure with Length-of-Stay and Ownership Status** (`Client_details`: present + permanent address, years/months at address, Rented/Owned) | Already built — `Address` value object has `lengthOfStayMonths` and `ownershipStatus`. | **Not displayed.** `ClientProfilePage.tsx` never renders `lengthOfStay`/`ownershipStatus` — confirmed by direct search. |
| **Itemized fee types** (Doc Stamp, Notarial Fee, Web Fee, Insurance Fee, Account Management Fee) | Already generically supported — `Fee` model with `calculationMethod`/`triggerEvent`/`applicationType` (`FeeCalculationMethod`, `FeeTriggerEvent` enums, `prisma/schema.prisma`). Each named fee from the Excel is representable as one configured `Fee` record — **this needs product configuration data entry, not new code.** | N/A (configuration, not a UI feature per se — depends on whether `LoanProductsPage` exposes fee editing). |
| **Basic document checklist at application intake** | Partially exists — `LoanApplication.submittedDocuments: String[]` (flat list, no per-product required set, no per-document status). A simpler ancestor of §3.1's missing full checklist feature, not a duplicate of it. | Entered in `LoanApplicationCreatePage.tsx` and displayed (as a plain list, count + names) in `LoanApplicationDetailPage.tsx` — confirmed wired, just simpler than the Excel's per-product/per-document version. |

### 3.3 Open question, not resolved by this analysis

- **Processing Fee % source rule.** Two sampled `Loans_details` rows showed different Processing
  Fee percentages (3% and 10%) for different products — not conclusively traceable to a single
  rule (didn't match the flat 3% Add-On rate for both). **STATUS: UNKNOWN** — needs more samples
  before assuming a per-product fixed percentage or any other rule. Not guessed at here, per
  `CLAUDE.md`.

---

## 4. Suggested next step

Of everything above, **the per-product document/KYC requirements checklist (§3.1)** is the
largest, most clearly-evidenced gap — it has real worked structure in both `Requirements_Setup`
(what's required, per product) and `Checklist_Database` (what was actually tracked, per real
application), directly reusable as a design reference. It's also a named requirement in
`CLAUDE.md` ("Document Management") that has no implementation yet.

This doc doesn't recommend building it now — that's a scoping decision for the team, and (per
`CLAUDE.md`'s development workflow) any new feature still needs its own analyze → design → explain
→ implement → test → document → approval cycle, not folded into this reference doc.
