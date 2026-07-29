-- Data: 2026-07-29 user-confirmed business rule expansion - the co-borrower must also sign every
-- borrower document except Deed of Assignment - Borrower (mutually exclusive per loan with Deed of
-- Assignment - Co-Borrower, based on whose name the surrendered ATM/allotment account is under -
-- see CreateLoanSigningSessionUseCase) and Manulife (insurance-specific, borrower only).
UPDATE "document_templates" SET "requiresCoBorrowerSignature" = true
WHERE "code" IN ('DISCLOSURE_STATEMENT', 'PROMISSORY_NOTE', 'ACKNOWLEDGEMENT_RECEIPT', 'DATA_PRIVACY_CONSENT');
