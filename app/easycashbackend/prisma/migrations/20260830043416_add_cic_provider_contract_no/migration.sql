-- CIC monthly report: permanent "Provider Contract No" identifier per loan account.
ALTER TABLE "loan_accounts" ADD COLUMN "cicProviderContractNo" TEXT;
CREATE UNIQUE INDEX "loan_accounts_cicProviderContractNo_key" ON "loan_accounts"("cicProviderContractNo");

CREATE SEQUENCE "cic_provider_contract_no_seq" START WITH 1;
