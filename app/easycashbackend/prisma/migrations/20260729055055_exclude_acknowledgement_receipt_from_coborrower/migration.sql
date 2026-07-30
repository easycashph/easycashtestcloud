-- Data: 2026-07-29 user correction to the same-day expand_co_borrower_signature_requirement
-- migration - Acknowledgement Receipt is borrower-only after all.
UPDATE "document_templates" SET "requiresCoBorrowerSignature" = false WHERE "code" = 'ACKNOWLEDGEMENT_RECEIPT';
