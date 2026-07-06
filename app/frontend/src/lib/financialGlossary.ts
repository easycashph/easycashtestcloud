/**
 * Plain-language definitions of the lending-industry terms used across the
 * LMS UI — the Investopedia practice applied to this platform: every
 * industry-standard figure shown to staff carries its definition one hover
 * away (see `TermTip`). Definitions are paraphrased standard industry
 * definitions (delinquency rate, portfolio at risk, arrears, etc.), not
 * Easycash-specific business rules — nothing here overrides an ADR.
 */
export const FINANCIAL_GLOSSARY = {
  delinquencyRate: {
    term: 'Delinquency Rate',
    definition:
      'The percentage of active loan accounts with at least one overdue installment. A delinquent (in-arrears) account is late, not yet in default — most delinquent borrowers resume paying.',
  },
  portfolioAtRisk: {
    term: 'Portfolio at Risk (PAR)',
    definition:
      'The outstanding balance of all loans with at least one overdue installment, divided by the total outstanding balance of the active portfolio. Balance-weighted: one large late loan moves it more than several small ones — the most widely used loan portfolio quality measure.',
  },
  arrears: {
    term: 'In Arrears',
    definition:
      'A loan account with one or more overdue installment payments. Being in arrears is a payment-status condition — the account is still active and collectible, unlike a defaulted or written-off loan.',
  },
  averageLoanSize: {
    term: 'Average Loan Size',
    definition:
      'Total original principal of active loans divided by the number of active loan accounts — a basic scale and concentration indicator for the portfolio.',
  },
  writeOff: {
    term: 'Write-off',
    definition:
      'Removing a loan the lender no longer expects to collect from the active portfolio and recognizing it as a loss. Collection or legal recovery efforts may still continue after write-off.',
  },
  amortization: {
    term: 'Amortization',
    definition:
      'Paying off a loan through scheduled installments that each cover the interest due plus part of the principal, until the balance reaches zero at maturity.',
  },
  penaltyFee: {
    term: 'Penalty / Late Fee',
    definition:
      'A fee charged when an installment is paid after its due date (and past any grace period). For the lender it is income earned on top of contractual amortization interest.',
  },
} as const;
