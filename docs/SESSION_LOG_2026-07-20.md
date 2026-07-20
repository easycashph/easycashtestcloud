# Session Log — 2026-07-20

## Summary

Continuation of the SOA (Statement of Account) work from 2026-07-19, plus a new compliance
initiative: read the actual BSP Circular 1133 / SEC MC 3 text (user-supplied PDFs) and began
building the foundation for interest-rate/penalty/EIR/total-cost ceiling compliance.

## What was done, in order

1. **Docker rebuild for the SOA feature.** The user hit 404s testing "Create SOA" — root cause:
   the backend runs in Docker, and a container restart alone doesn't pick up new source code (the
   image needs an actual rebuild). First rebuild attempt failed with a transient `ETXTBSY` error
   (Windows file-lock during `npm install`); retried and succeeded. Explained the diagnosis process
   (`docker logs` inspection) to the user.
2. **Verified the Accrued Interest formula against real data.** User asked how a specific loan's
   ₱69,419.59 Accrued Interest figure was computed. Queried the live database directly (read-only)
   for loan `SP-Easy_00001`'s real installments/balances, hand-traced the exact formula, and
   confirmed every intermediate figure matched what the dialog showed (Interest Past Due, Penalty,
   Total Past Due, and the final Accrued Interest) — the large amount was correct given the loan
   matured in 2021 and the As Of Date was 2026.
3. **Corrected the "matured only" rule for Accrued Interest** (user clarification): the section
   should be visibly locked/disabled with an explanation (not just silently show ₱0.00) until the
   loan's real Maturity Date has actually passed — mockup shown and approved, then implemented as
   a client-side gate (`soaPreview.isMatured`) in the Create SOA dialog.
4. **Full SOA dialog redesign** (mockup shown and approved first): added read-only Account
   Information and Balances cards (Loan ID, Loan Date, Term, Maturity Date, PN Amount, Current
   Amortization, Principal/Interest/Total Past Due — all live-computed client-side, mirroring the
   backend formula), the maturity-gated Accrued Interest section, and a Total Amount Due summary
   at the bottom. Frontend-only change (no backend/API changes), verified with `tsc`/build.
5. **BSP Circular 1133 / SEC MC 3 compliance — new initiative.** User supplied the actual
   regulation PDFs (`legacy/SEC/BSP1133.pdf`, `legacy/SEC/2022FAQs_...pdf`). Read both in full,
   extracted the exact coverage criteria (4 concurrent conditions) and the 4 ceilings (6% nominal,
   15% EIR, 5% penalty, 100% total cost). Queried the live database and found **43 real loan
   accounts** (several currently ACTIVE/ACTIVE_IN_ARREARS) matching 3 of the 4 coverage criteria
   (≤₱10,000 principal, ≤4-month tenor, originated on/after 2022-03-03); user confirmed the 4th
   criterion (unsecured/general-purpose) for the relevant products (`SP-Flash`, `SL-LAZ`,
   `SML-REG`, `PFL-GAD`). Identified real gaps: ADR-050's penalty formula compounds monthly instead
   of the regulation's simple 5%/month; no Total Cost Cap (100%) enforcement anywhere; no EIR
   validation anywhere. Documented the full analysis in `docs/Architecture/ADR-053-bsp-1133-sec-mc3-compliance.md`
   and started **Phase 1 only** (per explicit user instruction "simulan mo" — start it):
   - New `LoanProduct.isUnsecuredGeneralPurpose` column (migration
     `20260720022158_add_loan_product_sec_mc3_classification`), defaulting `false`, set `true` only
     for the 4 user-confirmed products — every other product (including similarly-named ones like
     `SL-LAZ-NEW`/`SL-LAZ-PRM`/`SL-OL`) deliberately left unclassified pending explicit review, not
     guessed from name similarity.
   - `isSecMc3Covered()` pure function (`src/shared/domain/compliance/SecMc3Coverage.ts`),
     evaluating all 4 criteria concurrently, plus the 4 ceiling constants for later phases to
     consume. 10 unit tests.
   - Not yet wired into any actual behavior (penalty calc, origination validation, etc.) — Phases
     2-5 (penalty formula, EIR check, total cost cap, historical remediation review) are explicitly
     scoped but deferred in the ADR, pending further instruction.

## Verification

Backend: `tsc --noEmit` clean, full suite 753/753 passed (up from 743 baseline). Frontend: `tsc
--noEmit` and `npm run build` both clean. No commits made yet this session — all work is pending
the user's review before committing.

## Current state / known follow-up work

- SOA feature (from 2026-07-19 + today's dialog redesign) is functionally complete and
  Docker-deployed; user still needs to insert the `.docx` placeholder tags in Word (unchanged from
  2026-07-19's ADR-052 §6) before the actual PDF body will render non-blank.
- SEC MC3 compliance is at Phase 1 of 5 — classification data and the coverage predicate exist, but
  no actual penalty/EIR/total-cost behavior has changed yet. The 43 real covered loans are still
  being charged under the old (potentially non-compliant) formulas until Phase 2+ is built.
- Still need: confirmation of LC vs. FC entity type (changes the SEC MC3 non-compliance penalty
  schedule); classification review for the remaining ~24 unclassified loan products; a decision on
  whether Phase 5 (historical remediation) is even in scope or a separate legal/compliance-led
  effort.
