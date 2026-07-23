# ADR-007 §4 Follow-up — Loans Flagged for Non-Reconciling Closed Balance

Generated 2026-07-22T22:23:06.811Z by `scripts/flag-non-reconciling-closed-loans.ts`.

79 loan accounts have `legacyNonReconcilingClosedBalance = true` — each is
marked CLOSED (legacy-migrated, believed fully settled) but its migrated balance columns
(principal + interest + fees + penalty) sum to a non-zero amount. Per ADR-007 §4's decision
(Option A, confirmed by Nomer Perez, MIS Manager, 2026-07-08), these are migrated as-is - no
balance figure here was corrected or invented - and flagged for manual accounting review.

## Full list (loan code, balance sum that should be ₱0.00)

| Loan Code | Balance Sum |
|---|---|
| 15001185 | ₱35580.65 |
| 15001715 | ₱495252.10 |
| 15001716 | ₱495252.10 |
| 15001776 | ₱160000.00 |
| 15001906 | ₱126000.00 |
| 15001907 | ₱127848.21 |
| 15001908 | ₱127848.21 |
| 15001921 | ₱129000.00 |
| 15001922 | ₱129000.00 |
| 16002090 | ₱56537.37 |
| 16002731 | ₱51468.00 |
| 17003125 | ₱22376.36 |
| 20100114 | ₱15141.00 |
| 2051 | ₱51455.65 |
| 805 | ₱344.55 |
| BL-REG_B1X4F | ₱215832.93 |
| BL-SPEC_M2F1U | ₱88431.87 |
| PFL-GAD_Y5C6H | ₱54822.04 |
| PFL-GAD_Z7V6I | ₱1312.84 |
| SL-CORP_A5D5W | ₱10831.57 |
| SL-CORP_A7G0T | ₱137044.93 |
| SL-CORP_E1V9O | ₱37502.82 |
| SL-CORP_G9W6A | ₱17086.93 |
| SL-CORP_K8M5V | ₱3756.24 |
| SL-CORP_Q3X8U | ₱40000.00 |
| SL-CORP_S6Q0E | ₱14381.54 |
| SL-CORP_U0U6O | ₱51260.78 |
| SL-CORP_X1G0I | ₱34173.83 |
| SL-LAZ_A6J8E | ₱1249.90 |
| SL-LAZ_E3M7I | ₱20.00 |
| SL-LAZ_G4M8L | ₱20.00 |
| SL-LAZ_G8Q4H | ₱19.80 |
| SL-LAZ_J3W2Q | ₱19.80 |
| SL-LAZ_O7Z4A | ₱20.80 |
| SL-LAZ_P4L2A | ₱20.00 |
| SL-LAZ_X7G5O | ₱20.00 |
| SL-OL_Q3G3T | ₱4250.00 |
| SL-REG_B6I7B | ₱29063.59 |
| SL-REG_H0W4I | ₱4622.49 |
| SL-REG_I4A8W | ₱23528.04 |
| SL-REG_P8V2B | ₱11728.93 |
| SL-REG_U1V1J | ₱13032.44 |
| SL-REG_Y6W8Q | ₱3450.81 |
| SML-Co-Borrower_C4J8P | ₱104432.58 |
| SML-Co-Borrower_H0O2G | ₱80874.16 |
| SML-Co-Borrower_I3H5S | ₱26604.12 |
| SML-Co-Borrower_O6J4W | ₱122644.94 |
| SML-Co-Borrower_R0H2R | ₱30187.04 |
| SML-Co-Borrower_S2U7P | ₱192303.64 |
| SML-Co-Borrower_U7Q9S | ₱27113.47 |
| SML-Co-Borrower_Y5D1V | ₱68929.21 |
| SML-DELUXE_Y5L2I | ₱1003488.34 |
| SML-MAX_C8G7K | ₱509519.45 |
| SML-MAX_C9E6F | ₱25356.07 |
| SML-MAX_E3D1Q | ₱138118.56 |
| SML-MAX_I3O9P | ₱67095.00 |
| SML-MAX_K5W8S | ₱634189.30 |
| SML-MAX_N2R3T | ₱490974.91 |
| SML-MAX_N7O4E | ₱33299.82 |
| SML-MAX_Q4V0M | ₱54609.18 |
| SML-MAX_S8I7Z | ₱19837.36 |
| SML-MAX_T7L2L | ₱895956.87 |
| SML-MAX_W4D8K | ₱38115.00 |
| SML-MAX_X3X4O | ₱59516.49 |
| SML-MAX_Y1L5R | ₱131420.85 |
| SML-PDC_U5C3I | ₱121769.30 |
| SML-REG_F3E7Z | ₱52837.06 |
| SML-REG_H3C2M | ₱2778.47 |
| SML-REG_P1L6W | ₱23106.83 |
| SML-Self_C2Z8V | ₱71135.96 |
| SML-Self_G9C7U | ₱61308.36 |
| SML-Self_I9D0N | ₱10000.45 |
| SML-Self_P3V8O | ₱219256.02 |
| SML-Self_Q3D0S | ₱72762.43 |
| SML-Self_S7F2V | ₱18500.21 |
| SML-Self_W0E3O | ₱74348.71 |
| SML-Self_X7D2M | ₱94746.07 |
| SML-SPEC_N1U3L | ₱315353.81 |
| SP-Easy_W2W7M | ₱61.57 |
