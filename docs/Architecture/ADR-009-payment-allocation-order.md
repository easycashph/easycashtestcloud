# ADR-009 — Payment Allocation Order

**Status:** Accepted, with named open sub-questions (Milestone 9 design review, 2026-07-03)
**Context documents:** `docs/Legacy Analysis/2026-07-03-milestone9-financial-rules-verification.md`
§3.2, §7.3, §7.6–§7.8, §8.10 (evidence); `docs/Architecture/FINANCIAL_INVARIANTS.md` §8 (prior
open-item listing); `prisma/schema.prisma` (`LoanProductVersion.repaymentAllocationOrder: Json?`).
**Evidence sources:** `legacy/reports/201 Loan Docs Generator/201 Loan Docs PN Template.docx`
(Promissory Note — the primary, highest-authority evidence for this ADR);
`legacy/mongodb/.../loan_transactions.bson`, `repayments.bson`.

---

## 1. Decision

**A payment is allocated, in order, to: (1) collection charges and other fees, (2) penalties,
(3) interest, (4) principal.** Within a single installment period, each tier is filled completely
before any amount moves to the next tier; any remainder after all tiers are satisfied is either
unapplied (returned/held) or applied to the next unpaid installment, per §5.

This order is sourced from **legally binding contractual text**, not inferred from transaction
patterns:

> *"Any payments made by me/us shall be applied first to collection charges and other fees, then
> penalties, interest, and principal in that order."*
> — `201 Loan Docs PN Template.docx` (Promissory Note), clause 4.

This is the single highest-authority evidence source examined in the entire Milestone 9
investigation: a legal document every borrower signs, not a pattern reverse-engineered from
system behavior. It is treated as authoritative for the order itself; each tier's confidence
level below additionally reflects whether real transaction data corroborates it.

---

## 2. Evidence and confidence, per tier

| Tier | Evidence | Confidence |
|---|---|---|
| **Fees before penalties/interest/principal** | Promissory Note clause 4 (above) | **CONFIRMED (contractual)**; **UNVERIFIED (transactional)** — no sampled real `REPAYMENT` transaction had a nonzero `fees_amount` component alongside a nonzero interest/principal/penalty component in the same event, across every loan examined in this investigation. Fees were always observed either fully deducted at disbursement or paid via a dedicated fee-only transaction (`FEE`/`FEE_CHARGED`/`FEE_REPAYMENT`), never in contention with other components in one event. |
| **Penalties before interest/principal** | Promissory Note clause 4, **plus** direct transactional confirmation: loan `SML-MAX_K5W8S` (`uid: 8a8e8e0f6e48d150016e49b9c410166b`), `entry_date 2020-05-18`, a `REPAYMENT` of `amount=6518.95` was posted with `principal=0, interest=0, fees=0, penalty=6518.95` — the entire payment absorbed by penalty despite nonzero interest/principal balances at that point | **CONFIRMED** by two independent evidence types (contract text + observed transaction) — though the transactional confirmation is a single sample, not cross-checked against a second penalty-bearing loan |
| **Interest before principal** | Promissory Note clause 4, **plus** direct transactional confirmation: loan `SL-REG_U1V1J` (`uid: 8a8e8e3d8a866fae018a87f45dc63dee`), verified on **3 separate installments** — each period's first partial `REPAYMENT` allocated 100% of that period's `interest_due` before any amount reached principal (e.g. installment 1: `interest_due=880.24`, first payment `i=880.24, p=868.70` — interest exactly satisfied, remainder to principal) | **CONFIRMED** — the strongest-evidenced tier, both contractually and transactionally, verified on multiple independent installments |
| **Cross-installment order (oldest due first)** | Every sampled multi-installment loan's `REPAYMENT` transactions occur in the same order as the `repayments` schedule's `due_date` ordering — no case found where a later-due installment was paid while an earlier one remained open | **PARTIALLY CONFIRMED** — consistent pattern, but no sampled case tested an out-of-order or simultaneous multi-installment payment, so the *rule* (as opposed to the *observed pattern*) is not stress-tested |

---

## 3. A related, contractually-sourced rule: capitalization on maturity

The same Promissory Note clause continues:

> *"Upon maturity, all unpaid penalties and unpaid interests shall automatically become part of
> the principal and shall bear interest at the same rate stipulated above."*

**Decision: this capitalization rule is accepted as a documented business rule**, to be
implemented once the calculation engine's write path exists — unpaid penalty and interest, at
loan maturity, are added to the outstanding principal balance and thereafter accrue interest
(per ADR-010's formula) on that increased principal.

**Confidence: CONFIRMED (contractual text); UNVERIFIED (transactional).** This is a plausible,
evidence-consistent explanation for why some loans in arrears show `balance` growing without
bound over years (e.g. `SML-MAX_K5W8S`, `SL-CORP_A7G0T` — both examined in the Legacy Analysis
document) — but no discrete transaction type in the legacy system's full type vocabulary (34
distinct types catalogued) is named anything resembling `CAPITALIZATION`, so the *mechanism* by
which this rule is executed in the legacy system was not directly observed, only its plausible
downstream effect. **This ADR accepts the rule as stated in the contract; the new system's
implementation of it (as a discrete transaction/event, or as an implicit recalculation) is left to
Milestone 9.1's design, not mandated here.**

---

## 4. What was found but is explicitly out of scope for this decision

**Two structurally distinct reversal conventions coexist in the legacy system**, and this ADR
does not decide which (or whether both) the new schema's `LoanTransaction.reversesTransactionId`
design should model:
- `DISBURSMENT` and `WRITE_OFF` transactions use an explicit, bidirectional link
  (`reversal_transaction_key` on the original transaction, pointing forward to whichever
  transaction reverses it).
- `REPAYMENT_UNDO` (213 occurrences in the full transaction history) does **not** use this
  convention in any sample checked — it is a same-shaped, oppositely-signed correction with no
  formal back-reference to what it corrects.

**STATUS: UNRESOLVED** — this is a real design question for the ledger module, not this ADR.

**At least 11 distinct `*_ADJUSTMENT` transaction-type variants exist in the legacy system**
(`REPAYMENT_ADJUSTMENT`, `PENALTY_ADJUSTMENT`, `FEE_ADJUSTMENT`, `INTEREST_APPLIED_ADJUSTMENT`,
`DISBURSMENT_ADJUSTMENT`, `DEFERRED_INTEREST_PAID_ADJUSTMENT`,
`DEFERRED_INTEREST_APPLIED_ADJUSTMENT`, `TRANSFER_ADJUSTMENT`, `PENALTY_REDUCTION_ADJUSTMENT`,
`INTEREST_REDUCTION_ADJUSTMENT`, `FEE_REDUCTION_ADJUSTMENT`, `WRITE_OFF_ADJUSTMENT`), versus the
new schema's single `LoanTransactionType.ADJUSTMENT` value. **STATUS: UNRESOLVED** whether this
granularity needs to be preserved — a design question, not decided by this ADR.

**Two dedicated, single-component repayment types exist** (`FEE_REPAYMENT`, `PENALTY_REPAYMENT`
— 6 occurrences each, all within the final days of the export period, suggesting a recently
introduced feature), which appear to be a manual/operator-directed payment channel distinct from
the general `REPAYMENT` type's algorithmic allocation. **STATUS: UNRESOLVED** whether the new
system needs an equivalent manual-override channel — not decided here.

**Overpayment handling** — two targeted full-collection searches (`redraw_balance`/
`advance_deposition` nonzero; `balance < 0`) found **zero matches across all 524,463 legacy
transactions**. `PROJECT_RULES.md §Payments` requires the system to support overpayments as a
valid state, and the schema's `Money` value object deliberately does not encode "negative is
illegal" (`FINANCIAL_INVARIANTS.md §3`) — but this investigation found **no legacy evidence of
how an actual overpayment was recorded** when the allocation order above is exhausted and a
remainder is left over. **STATUS: UNRESOLVED — no evidence found**, not "overpayments don't
happen." The calculation engine's overpayment handling (§5.6 of
`docs/Architecture/CALCULATION_ENGINE_SPEC.md`) proceeds from `PROJECT_RULES.md`'s stated
requirement, not from legacy transactional precedent, since none was found.

---

## 5. Behavior after all tiers are satisfied within an installment (open)

This ADR decides the **order** in which a single payment fills fees → penalties → interest →
principal. It does **not** decide:
- What happens to a payment amount that exceeds everything currently due on the oldest open
  installment (does it advance to the next installment automatically, per the "oldest due first"
  pattern in §2, or does it require a separate, explicit "advance payment" designation)?
- The exact mechanics of the manual `FEE_REPAYMENT`/`PENALTY_REPAYMENT` override channel noted
  in §4.

Both are **STATUS: UNRESOLVED**, left to the `PaymentAllocationService` domain service's detailed
design in Milestone 9.1 (per `docs/Architecture/ADR-042-aggregate-boundaries.md` §7, which already
anticipates this service and its statelessness).

---

## 6. Confidence summary

| Element | Confidence |
|---|---|
| Order: fees → penalties → interest → principal | **CONFIRMED (contractual)** |
| Penalties before interest/principal | **CONFIRMED (contractual + transactional)** |
| Interest before principal | **CONFIRMED (contractual + transactional)**, strongest-evidenced tier |
| Fees-first specifically | **CONFIRMED (contractual)**; **UNVERIFIED (transactional)** |
| Cross-installment (oldest-first) order | **PARTIALLY CONFIRMED** |
| Capitalization of unpaid interest/penalty into principal at maturity | **CONFIRMED (contractual)**; **UNVERIFIED (transactional mechanism)** |
| Reversal-convention unification (`reversesTransactionId` vs. unlinked `*_UNDO`) | **UNRESOLVED** — design question |
| Adjustment-type granularity preservation | **UNRESOLVED** — design question |
| Manual fee/penalty-only payment channel | **UNRESOLVED** — design question |
| Overpayment recording mechanism | **UNRESOLVED — no legacy evidence found** |

---

## 7. Implementation notes

- The allocation algorithm belongs in a stateless domain service (`PaymentAllocationService`),
  not inside the `LoanAccount` or `RepaymentInstallment` aggregates, per
  `docs/Architecture/ADR-042-aggregate-boundaries.md` §7 — this ADR's decision is exactly the
  policy that service will implement.
- `RecordInstallmentPaymentUseCase` (already built, structurally, in Milestone 7 — see
  `app/backend/src/modules/repayment/application/use-cases/RecordInstallmentPaymentUseCase.ts`)
  applies an *already-decided* split to a single installment; this ADR's allocation order is what
  a new, calling use case must compute *before* invoking it.
- `LoanProductVersion.repaymentAllocationOrder: Json?` (schema field, currently unpopulated per
  design, `FINANCIAL_INVARIANTS.md §8`) may now be populated to reflect this ADR's fixed order —
  whether it should be configurable per product (as the field's `Json?` type suggests it was
  designed to allow) or fixed platform-wide (as this ADR's evidence, sourced from one uniform
  Promissory Note template used company-wide, suggests) is **UNRESOLVED** and should be decided
  during Milestone 9.1's implementation, informed by whether any product uses a different
  Promissory Note template with different allocation language (not checked in this investigation
  — only one PN template was found in the `201 Loan Docs Generator` folder).
