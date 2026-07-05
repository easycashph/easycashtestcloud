# ADR-049 — Employee Loan Fee Waiver

**Status:** ACCEPTED — existence and scope of the waiver confirmed by both legacy evidence and
direct business testimony; exact implementation mechanism specified below. Does not block any
implemented Milestone 9.1 checkpoint (CP1–CP10) — this is a new, standalone feature for a future
checkpoint, not a correction to existing work.

**Context documents:** `legacy/reports/Fields in Google Spreadsheet.xlsx` (`MLR Master List`
sheet, `Agency / Company` and fee columns — the evidence source for this ADR);
`app/backend/prisma/schema.prisma` (`FeeRule`, `AppliedFee`, `LoanProductVersion` — the existing
fee-configuration structures this ADR extends); `CLAUDE.md` ("Support configurable... Processing
Fees... Service Fees... All financial rules must be configurable rather than hard-coded").

---

## 1. The gap

During this session, the project owner disclosed that some loan accounts — specifically loans
taken out by Easycash's own employees, and (separately, see §5) loans connected to personal
relationships with the loan manager — are exempted from "other fees." No ADR, schema field, or
`FeeRule`/`AppliedFee` structure currently models any such exemption; every fee in the current
domain model is either charged per its `FeeRule` configuration or not charged at all, with no
per-loan override concept.

---

## 2. What was searched and found

`Fields in Google Spreadsheet.xlsx` → `MLR Master List` (3,708-row historical export, the same
sheet already used as evidence for `ADR-046`) has an `Agency / Company` column recording the
borrower's employer. Filtering for rows where this field is `"Easycash"` or `"Easycash Lending"`
— i.e., loans taken out by the company's own staff — found **45 such loans**, 41 of them on the
`SL-Regular` product.

**Baseline comparison, `SL-Regular` product, zero-`Processing Fee` rate:**

| Population | Zero-fee rate |
|---|---|
| All `SL-Regular` loans (188 total) | 67.6% |
| `SL-Regular` loans with `Agency/Company = Easycash*` (41 total) | **97.6%** (40 of 41) |

Critically, the Easycash-employee loans don't merely show a zero `Processing Fee` more often —
**every one of the 40 zero-processing-fee rows also shows zero `Documentation Fee`, zero
`Account Management Fee`, zero `Notarial Fee`, and zero `Insurance Fee` simultaneously**, a
combination far more specific than the general population's per-product fee-waiver patterns
(which vary fee-by-fee, not as an all-or-nothing bundle). **Interest rates (Add-On) on these same
loans are NOT zero** (observed values: 1.5%, 0%, 2.63%) — the waiver is confirmed to be scoped to
ancillary fees only, never to interest itself.

**Confidence:** this pattern — "Easycash-employee loans have all ancillary fees waived, interest
unaffected" — is **CONFIRMED** by direct population-level evidence (40/41 vs. 67.6% baseline) and
is consistent with the project owner's direct account of the practice.

---

## 3. Decision

**A loan account may be flagged, at origination, as fee-exempt for a specific, named reason. When
so flagged, none of the loan's applicable `FeeRule`s produce an `AppliedFee` at origination or
disbursement — every fee amount is zero. Interest calculation is entirely unaffected; this
mechanism never touches `interestRate`/`addOnInterestRate`/`contractualInterestRate` or the
amortization schedule.**

Concretely:

- **`LoanAccount` gains an optional `feeWaiverReason` field** (e.g. an enum:
  `EMPLOYEE_LOAN`, extensible later if a second evidenced reason emerges — do not add speculative
  values not yet evidenced or approved), captured **explicitly at origination**, alongside the
  loan's other already-captured origination fields. `null`/absent means no waiver — the default,
  unexempted path, unchanged from current behavior.
- **When `feeWaiverReason` is set, `ActivateLoanUseCase` (or a future fee-application step) skips
  creating any `AppliedFee` row** for that loan's `FeeRule`s, rather than creating them with a
  zero amount — this keeps `AppliedFee`'s existing invariant (a row means a fee was actually
  charged) intact, rather than inventing a new "charged-but-zero" state that would need its own
  handling everywhere `AppliedFee` is read.
- **This is an explicit, visible, per-loan decision made by the person originating the loan — not
  an automatic inference from the borrower's identity, employer, or any relationship.** The
  system does not detect "is this borrower an Easycash employee" or "is this borrower connected to
  a staff member" on its own; a human sets `feeWaiverReason` deliberately, the same way
  `firstRepaymentDate` is a deliberate human input (`ADR-045`), not a derived one.
- **Audit requirement:** setting `feeWaiverReason` is itself a financial-consequence action and
  must go through the fail-closed financial audit logger (`ADR-047`), recording who set it, on
  which loan, and the reason — no waiver may be applied without an attributable, logged actor.

---

## 4. What this ADR does NOT decide

- **The exact set of `LoanProductVersion`s or fee types this applies to** — the evidence covers
  `SL-Regular`; whether the same treatment should extend to every product is a business decision
  not made here. Implementation should apply the waiver generically to whatever `FeeRule`s exist
  on the loan's product, since the evidenced pattern is "all ancillary fees," not a
  product-specific subset.
- **Who is authorized to set `feeWaiverReason`** (loan officer, branch manager, admin only) — an
  RBAC/permission question deferred to `ADR-038` (still open) or a narrower interim rule, not
  invented here.
- **Retroactive application to existing/migrated loans** — out of scope; this ADR governs new
  loan origination going forward only.

---

## 5. Explicitly rejected: "personal relationship with the loan manager" as a system feature

The project owner also described a second, informally-recounted category: loans connected to
personal relationships with the loan manager receiving similar treatment. **This is deliberately
NOT modeled by this ADR, and should not be modeled by any future one without a separate,
explicit business decision, for the following reasons:**

- **No evidence supports it.** Unlike the employee case, there is no field in any legacy data
  source (`Agency/Company`, or any other) that records personal relationships to staff. This
  category cannot be verified, quantified, or scoped the way the employee case was.
- **Building an automatic "who is a friend of the manager" rule into the system would formalize
  a discretionary, unaccountable practice into permanent infrastructure** — the opposite of this
  project's audit and governance goals (`FINANCIAL_INVARIANTS.md` §4's fail-closed audit
  principle exists precisely to make financial exceptions attributable, not to make them
  systematic).
- **If a case like this legitimately needs a fee exception in the future, the correct mechanism
  is the same `feeWaiverReason` field, set explicitly by an authorized person, with a real,
  named reason and full audit trail** — not a hidden or automatic rule. This ADR's mechanism
  already supports that path generically (§3's enum is extensible); it does not need a
  relationship-detection feature to accommodate a one-off, human-authorized exception.

**Decision: no code, schema, or rule is introduced for this category. Any individual exception of
this kind must go through the same explicit, audited, human-authorized `feeWaiverReason` path as
any other reason — never an automatic or identity-based inference.**

---

## 6. Disposition

This ADR does not block any in-progress or completed checkpoint. Implementation is a future,
separate checkpoint (not yet numbered in `MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md`) — adding
`feeWaiverReason` to `LoanAccount`, wiring the skip-logic into fee application once fee
application itself is built (no `ActivateLoanUseCase` code currently creates any `AppliedFee`
row — CP8/CP9 as built do not apply fees at all, per `ADR-046`'s exclusion and CP7's
`feesDue`-stays-zero design), and the accompanying audit-log wiring. Recommended sequencing: build
this alongside, or immediately after, whichever future checkpoint first introduces real
`FeeRule`-driven fee application to `ActivateLoanUseCase`, since a waiver mechanism is meaningless
before there's a fee-application mechanism for it to skip.
