-- CIC monthly report: permanent "Provider Subject No" identifier per borrower.
ALTER TABLE "borrowers" ADD COLUMN "cicProviderSubjectNo" TEXT;
CREATE UNIQUE INDEX "borrowers_cicProviderSubjectNo_key" ON "borrowers"("cicProviderSubjectNo");

-- Backing sequence for auto-generating NEW borrowers' Provider Subject No going forward
-- (format: 'ELCS' || lpad(nextval, 9, '0')) - see Borrower.cicProviderSubjectNo's doc comment.
CREATE SEQUENCE "cic_provider_subject_no_seq" START WITH 1;
