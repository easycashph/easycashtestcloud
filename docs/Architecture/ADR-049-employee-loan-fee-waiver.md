# ADR-049 — Employee Loan Fee Waiver and Preferential Rate

**Status:** ACCEPTED — existence and scope confirmed by both legacy evidence (including named,
individually-verified loan accounts) and direct business testimony; exact implementation
mechanism specified below. Does not block any implemented Milestone 9.1 checkpoint (CP1–CP10) —
this is a new, standalone feature for a future checkpoint, not a correction to existing work.

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
(which vary fee-by-fee, not as an all-or-nothing bundle).

**Named individuals directly confirmed** (project owner named these as sample employee accounts;
each was independently located and verified in `MLR Master List` with `Agency/Company` =
`"Easycash"`/`"Easycash Lending Company Inc."` and zero on every ancillary fee column): Nomer
Perez (`SL-REG_O8O8Y`), Rosan Cruz Cinco (`SL-REG_J3M6C`, `SL-REG_Y3J4R`, `SL-REG_00100`), Liezel
Juban Pentecostes (`SL-REG_Y8Y7U`, `SL-REG_Y6W8Q`, `SL-REG_R2C8V`, `SL-REG_00101`, `SL-REG_00047`),
Mariel Ramos De Guzman (`SL-REG_I4A8W`, `SL-REG_00043`), Joseph Dela Cruz De Galicia
(`SL-REG_00104`), and Alfredo Desabille Ogana (`SL-REG_H0W4I`, `SL-REG_00021`, `SL-REG_R6K4E`,
`SL-REG_00045`).

**A second finding, beyond fee waiver: interest rate is also discounted, not left untouched.**
Several of the accounts above appear twice in the export — once as an uncorrected/raw record with
`Agency` = `N/A` and once as a corrected record with `Agency` = `"Easycash"`, for the same
`account_id` and loan amount. In the general population, this same raw/corrected pairing pattern
exists but the Add-On rate differs only by rounding noise (e.g. `25.0%` vs `24.99%` — same rate
tier). **For the named employees, the corrected (`Easycash`-agency) record's rate is
substantially lower than the raw record's** — a real tier change, not rounding:

| Account | Raw record rate | Corrected (`Easycash`-agency) rate |
|---|---|---|
| `SL-REG_Y6W8Q` (Pentecostes) | 3.0% | **1.5%** |
| `SL-REG_I4A8W` (De Guzman) | 3.0% | **1.5%** |
| `SL-REG_P8V2B` (Ramil Torres) | 2.59% | **1.5%** |
| `SL-REG_B6I7B` (Janine Mergal) | 3.0% | **1.5%** |

**1.5% is the lowest Add-On rate tier in the company's own Interest Rate Chart** (per `ADR-010`
§1 item 4's evidenced lookup table) — employee loans are consistently priced at the cheapest
available tier, not merely "some lower number." This corrects the original version of this ADR's
claim that "interest rates on these loans are NOT zero... the waiver is confirmed to be scoped to
ancillary fees only, never to interest itself" — that remains true (rate is never literally zero,
except for two `SL-Lazada-Promo` loans where 0% is that product's own baseline for everyone), but
incomplete: interest is not exempted, but it is preferentially discounted, alongside the fee
waiver.

**BL products (a second, separately-alleged category — "friends of the loan manager or company
CEO"): NO supporting evidence found.** 54 of 93 (58%) of all `BL-*` product loans in the
population show zero `Processing Fee`, regardless of borrower — this is that product family's own
common baseline, not a marker of favoritism. No `BL` row anywhere in the export carries `Easycash`
(or any other identifiable staff/relationship marker) as its `Agency/Company`. There is no field
in this or any other examined legacy source that records a borrower's personal relationship to
the loan manager or CEO — this category remains **entirely unverifiable from available evidence**,
distinct from the employee category above, which is fully confirmed.

**Confidence:** "Easycash-employee loans have all ancillary fees waived AND receive the lowest
Add-On rate tier" is **CONFIRMED** — population-level evidence (40/41 vs. 67.6% baseline) plus six
individually-named, individually-verified accounts, plus the raw-vs-corrected rate-tier evidence
above. The separately-alleged "friend of the manager/CEO" category for `BL` products remains
**UNCONFIRMED, no evidence found** — see §5's unchanged decision not to model it.

---

## 3. Decision

**A loan account may be flagged, at origination, as receiving employee-tier concessions for a
specific, named reason. When so flagged: (a) none of the loan's applicable `FeeRule`s produce an
`AppliedFee` at origination or disbursement — every fee amount is zero; (b) the loan is expected
to be originated at the company's lowest evidenced Add-On rate tier (1.5%, per §2) — but this
requires no new mechanism, since `interestRate` is already a free-form, explicit, human-supplied
value at origination (`CreateLoanAccountUseCase`, unchanged by this ADR); the flag's role for
rate is documentation/audit, not enforcement.**

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
- **No new mechanism is introduced for the rate discount.** The loan officer originating an
  employee's loan simply supplies the discounted rate (1.5%, or whatever the currently-lowest
  tier is) as `interestRate` at origination, exactly as for any other loan — `CreateLoanAccountUseCase`
  does not need a special path. `feeWaiverReason = EMPLOYEE_LOAN` on the same loan documents *why*
  that rate was chosen, for a future auditor/reviewer, without the system enforcing or validating
  the rate value itself (no ADR establishes a hard validation rule tying rate to
  `feeWaiverReason`, and none is invented here).
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
- **Specifically checked and not found for `BL` products** (§2): 58% of all `BL-*` loans already
  show zero `Processing Fee` regardless of borrower — that is the product family's own normal
  baseline, not a marker of favoritism — and no `BL` row anywhere in the export carries any
  staff/relationship-identifying marker. The data neither confirms nor is even suggestive of this
  category; it is silent on it entirely.
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
