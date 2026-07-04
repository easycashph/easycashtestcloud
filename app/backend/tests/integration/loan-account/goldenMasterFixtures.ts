/**
 * Milestone 9.1 checkpoint 10 (Decision Log #20, `MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md`):
 * every figure below is transcribed ONCE, directly from
 * `docs/Legacy Analysis/2026-07-03-milestone9-financial-rules-verification.md`
 * (§3.2, §8.3, §8.9) and `docs/Architecture/ADR-007-outstanding-balance-formula.md`
 * §1 — never re-derived or invented. `GoldenMasterReplay.test.ts` imports these
 * constants rather than hand-copying numbers a second time, so a future
 * transcription error can only happen in one place.
 *
 * `firstRepaymentDate` assumption, documented per this checkpoint's explicit
 * instruction not to invent a date silently:
 *   - `SL_REG_U1V1J`: taken directly from the evidence table's installment-1
 *     `due_date` (`2023-10-24`, Legacy Analysis §3.2) — NOT invented, no
 *     disbursement-date proxy needed here since the schedule's own first due
 *     date is already in evidence.
 *   - `SL_LAZ_V5N0R` / `SL_LAZ_A6J8E`: both are single-installment loans with
 *     no distinct schedule due date recorded anywhere in the evidence (only
 *     `entry_date`s of ledger transactions are shown). Per this checkpoint's
 *     instruction, the loan's own `DISBURSMENT` `entry_date` is used as a
 *     proxy where one exists (`SL_LAZ_V5N0R`: `2021-08-03`, Legacy Analysis
 *     §3.1 Case A); no disbursement date is recorded at all for
 *     `SL_LAZ_A6J8E` (Legacy Analysis §3.1 Case B lists no dates), so an
 *     arbitrary placeholder date is used for it instead. In both cases this
 *     value only affects the installment row's stored `dueDate` metadata —
 *     it has no effect on any interest/principal/balance figure asserted
 *     below, since `DecliningBalanceInterestCalculator` (CALC-SPEC §1) is a
 *     pure function of `Balance × MonthlyRate`, not of dates.
 */

export const SL_REG_U1V1J = {
  legacyUid: '8a8e8e3d8a866fae018a87f45dc63dee',
  principal: '17782.61',
  monthlyContractualRate: '4.95',
  installmentCount: 6,
  interestCalculationMethod: 'DECLINING_BALANCE_DISCOUNTED' as const,
  // Legacy Analysis §3.2 evidence table, installment 1's `repayments` row.
  firstRepaymentDate: new Date('2023-10-24T00:00:00.000Z'),
  // §8.3: `17782.61 × 0.0495 = 880.24` — matches real `iDue` exactly.
  installment1InterestDue: '880.24',
  // §8.3: balance after installment 1's principal is paid = `15164.97`;
  // `15164.97 × 0.0495 = 750.67` — matches real `iDue` exactly.
  installment2BeginningPrincipal: '15164.97',
  installment2InterestDue: '750.67',
  // CALC-SPEC §5 Examples table, `SL-REG_U1V1J` installment 1's first
  // partial `REPAYMENT` (§3.2: `entry_date 2023-10-31`, `p=868.70, i=880.24`).
  installment1Payment: {
    paymentAmount: '1748.94',
    expectedInterestApplied: '880.24',
    expectedPrincipalApplied: '868.70',
  },
} as const;

export const SL_LAZ_V5N0R = {
  legacyUid: '8a8e8eee7af176a3017b0570fbf127ba',
  principal: '2000.00',
  // §8.9: every plain `DECLINING_BALANCE` loan in the population uses this
  // single uniform rate; independently re-confirmed for this exact loan's
  // own `INTEREST_APPLIED` transaction (`2000 × 0.2499 = 499.8`).
  monthlyContractualRate: '24.99',
  installmentCount: 1,
  interestCalculationMethod: 'DECLINING_BALANCE' as const,
  // Legacy Analysis §3.1 Case A: `DISBURSMENT entry_date 2021-08-03` — used
  // as the firstRepaymentDate proxy per this fixture file's header note.
  firstRepaymentDate: new Date('2021-08-03T00:00:00.000Z'),
  // §3.1 Case A: `INTEREST_APPLIED amt=499.8` following disbursement of 2000.
  installment1InterestDue: '499.80',
  // §3.1 Case A: the final `REPAYMENT` drives `balance` to exactly 0. The
  // intervening `FEE` (0.2) is deliberately excluded from this replay — no
  // fee-application logic exists yet (ADR-046 excluded per this
  // checkpoint's scope), so only the principal+interest portion of that
  // payment (2000 + 499.8 = 2499.80) is replayed here.
  fullRepaymentAmount: '2499.80',
} as const;

export const SL_LAZ_A6J8E = {
  legacyUid: '8a8e8f257f44e02f017f44ec045a047d',
  principal: '1000.00',
  // Not itself labeled with a rate in the evidence; derived here from the
  // observed `INTEREST_APPLIED` amount (`249.9 = 1000 × 0.2499`), which is
  // the same uniform rate independently confirmed for every plain
  // `DECLINING_BALANCE` loan in §8.9 (including `SL_LAZ_V5N0R` above) — not
  // an invented figure, a reproduction of the one rate this population is
  // already shown to use.
  monthlyContractualRate: '24.99',
  installmentCount: 1,
  interestCalculationMethod: 'DECLINING_BALANCE' as const,
  // No disbursement (or any other) date is recorded anywhere in the
  // evidence for this loan (Legacy Analysis §3.1 Case B lists no dates at
  // all) — an arbitrary placeholder is used per this fixture file's header
  // note; it has no bearing on any asserted figure.
  firstRepaymentDate: new Date('2020-01-01T00:00:00.000Z'),
  // §3.1 Case B: `interest applied (249.9)` following disbursement of 1000.
  installment1InterestDue: '249.90',
  // §3.1 Case B: `a REPAYMENT of exactly 1249.9 drives balance to 0` — the
  // clean, reconciled state. The two further anomalous transactions
  // (`FEES_DUE_REDUCED`, `PENALTY_APPLIED`) that reopen the balance
  // afterward are explicitly flagged `STATUS: UNRESOLVED` (§3.1.1) and are
  // deliberately NOT replayed here — inventing a resolution for that
  // anomaly is out of this checkpoint's scope.
  fullRepaymentAmount: '1249.90',
} as const;
