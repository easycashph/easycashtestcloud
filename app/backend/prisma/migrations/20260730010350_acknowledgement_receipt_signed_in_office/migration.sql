-- Data: 2026-07-30 user-confirmed business rule - the Acknowledgement Receipt is signed physically
-- when the client visits the office, not through the remote e-signature flow. It stays a required
-- generated document (isRequired unchanged), but is removed from BOTH the Borrower's and
-- Co-Borrower's e-signature batches (CreateLoanSigningSessionUseCase filters on these two flags).
UPDATE "document_templates"
SET "requiresBorrowerSignature" = false, "requiresCoBorrowerSignature" = false
WHERE "code" = 'ACKNOWLEDGEMENT_RECEIPT';
