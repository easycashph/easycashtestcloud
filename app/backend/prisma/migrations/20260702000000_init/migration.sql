-- EasyCash Digital Lending Platform — Initial Schema Migration
-- Generated via `prisma migrate diff --from-empty --to-schema-datamodel` against
-- prisma/schema.prisma (no live PostgreSQL instance was available in the dev
-- environment this was authored in). Content is deterministic and identical to
-- what `prisma migrate dev` would produce from the same schema.
--
-- Action item before first real deployment: run `npx prisma migrate dev` once
-- against a live Postgres instance to have Prisma verify/re-derive this
-- migration through its normal shadow-database workflow, per Milestone 5's
-- plan note. Should be a no-op confirmation, not a functional change.

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BorrowerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AddressOwnerType" AS ENUM ('BORROWER', 'CO_BORROWER');

-- CreateEnum
CREATE TYPE "AttachmentOwnerType" AS ENUM ('BORROWER', 'LOAN_ACCOUNT');

-- CreateEnum
CREATE TYPE "InterestCalculationMethod" AS ENUM ('FLAT', 'DECLINING_BALANCE', 'DECLINING_BALANCE_DISCOUNTED');

-- CreateEnum
CREATE TYPE "InterestType" AS ENUM ('SIMPLE_INTEREST');

-- CreateEnum
CREATE TYPE "RepaymentScheduleMethod" AS ENUM ('FIXED');

-- CreateEnum
CREATE TYPE "RepaymentPeriodUnit" AS ENUM ('MONTHS');

-- CreateEnum
CREATE TYPE "SettlementOption" AS ENUM ('FULL_DUE_AMOUNTS');

-- CreateEnum
CREATE TYPE "RoundingMethod" AS ENUM ('NO_ROUNDING', 'ROUND_REMAINDER_INTO_LAST_REPAYMENT');

-- CreateEnum
CREATE TYPE "PenaltyCalculationMethod" AS ENUM ('NONE', 'OVERDUE_BALANCE_AND_INTEREST', 'ON_REPAYMENT');

-- CreateEnum
CREATE TYPE "FeeCalculationMethod" AS ENUM ('FLAT', 'PERCENTAGE_OF_LOAN_AMOUNT');

-- CreateEnum
CREATE TYPE "FeeTriggerEvent" AS ENUM ('DISBURSEMENT', 'MANUAL', 'CAPITALIZED_DISBURSEMENT');

-- CreateEnum
CREATE TYPE "FeeApplicationType" AS ENUM ('REQUIRED', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "LoanAccountStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'ACTIVE_IN_ARREARS', 'CLOSED', 'CLOSED_WRITTEN_OFF', 'CLOSED_REJECTED');

-- CreateEnum
CREATE TYPE "LoanTransactionType" AS ENUM ('DISBURSEMENT', 'REPAYMENT', 'FEE_CHARGED', 'PENALTY_APPLIED', 'INTEREST_APPLIED', 'DEFERRED_INTEREST_APPLIED', 'DEFERRED_INTEREST_PAID', 'TRANSFER', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "RepaymentInstallmentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'LATE');

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdByIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_products" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_product_versions" (
    "id" TEXT NOT NULL,
    "loanProductId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "previousVersionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "interestCalculationMethod" "InterestCalculationMethod" NOT NULL,
    "interestType" "InterestType" NOT NULL DEFAULT 'SIMPLE_INTEREST',
    "daysInYearConvention" TEXT NOT NULL DEFAULT 'E30_360',
    "repaymentScheduleMethod" "RepaymentScheduleMethod" NOT NULL DEFAULT 'FIXED',
    "repaymentPeriodUnit" "RepaymentPeriodUnit" NOT NULL DEFAULT 'MONTHS',
    "settlementOption" "SettlementOption" NOT NULL DEFAULT 'FULL_DUE_AMOUNTS',
    "loanAmountMin" DECIMAL(14,2) NOT NULL,
    "loanAmountMax" DECIMAL(14,2),
    "loanAmountDefault" DECIMAL(14,2),
    "installmentCountMin" INTEGER NOT NULL,
    "installmentCountMax" INTEGER,
    "installmentCountDefault" INTEGER,
    "gracePeriodType" TEXT NOT NULL DEFAULT 'NONE',
    "gracePeriodDefaultDays" INTEGER NOT NULL DEFAULT 0,
    "roundingMethod" "RoundingMethod" NOT NULL DEFAULT 'NO_ROUNDING',
    "repaymentAllocationOrder" JSONB,
    "defaultInterestRate" DECIMAL(6,3),
    "minInterestRate" DECIMAL(6,3),
    "maxInterestRate" DECIMAL(6,3),
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_product_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_rules" (
    "id" TEXT NOT NULL,
    "loanProductVersionId" TEXT NOT NULL,
    "calculationMethod" "PenaltyCalculationMethod" NOT NULL DEFAULT 'NONE',
    "ratePercent" DECIMAL(6,3),
    "capPercent" DECIMAL(6,3),
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "penalty_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_rules" (
    "id" TEXT NOT NULL,
    "loanProductVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calculationMethod" "FeeCalculationMethod" NOT NULL,
    "triggerEvent" "FeeTriggerEvent" NOT NULL,
    "applicationType" "FeeApplicationType" NOT NULL DEFAULT 'REQUIRED',
    "flatAmount" DECIMAL(14,2),
    "percentage" DECIMAL(6,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrowers" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "assignedLoanOfficerId" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "gender" TEXT,
    "birthDate" TIMESTAMP(3),
    "civilStatus" TEXT,
    "mobilePhone1" TEXT,
    "mobilePhone2" TEXT,
    "email" TEXT,
    "status" "BorrowerStatus" NOT NULL DEFAULT 'ACTIVE',
    "loanCycle" INTEGER NOT NULL DEFAULT 0,
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borrowers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_income_details" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "employmentType" TEXT,
    "employerName" TEXT,
    "employerAddress" TEXT,
    "natureOfBusiness" TEXT,
    "position" TEXT,
    "yearsEmployed" INTEGER,

    CONSTRAINT "borrower_income_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_government_ids" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "sssNumber" TEXT,
    "tinNumber" TEXT,

    CONSTRAINT "borrower_government_ids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "ownerType" "AddressOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "addressType" TEXT,
    "houseUnitNumber" TEXT,
    "street" TEXT,
    "barangay" TEXT,
    "cityMunicipality" TEXT,
    "province" TEXT,
    "zipCode" TEXT,
    "lengthOfStayMonths" INTEGER,
    "ownershipStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identification_documents" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "issuingAuthority" TEXT,
    "validUntil" TIMESTAMP(3),

    CONSTRAINT "identification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_references" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "relationship" TEXT,
    "phoneNumber" TEXT,
    "emailAddress" TEXT,

    CONSTRAINT "character_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "co_borrowers" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" TEXT,
    "civilStatus" TEXT,
    "birthDate" TIMESTAMP(3),
    "phoneNumber" TEXT,
    "emailAddress" TEXT,
    "relationship" TEXT,
    "legacyId" TEXT,

    CONSTRAINT "co_borrowers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_account_co_borrowers" (
    "loanAccountId" TEXT NOT NULL,
    "coBorrowerId" TEXT NOT NULL,

    CONSTRAINT "loan_account_co_borrowers_pkey" PRIMARY KEY ("loanAccountId","coBorrowerId")
);

-- CreateTable
CREATE TABLE "loan_accounts" (
    "id" TEXT NOT NULL,
    "loanCode" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "loanProductVersionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "loanOfficerId" TEXT,
    "status" "LoanAccountStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "principalAmount" DECIMAL(14,2) NOT NULL,
    "principalBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "principalPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "principalDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interestRate" DECIMAL(6,3) NOT NULL,
    "addOnInterestRate" DECIMAL(6,3),
    "contractualInterestRate" DECIMAL(6,3),
    "interestBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interestPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interestDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "feesBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "feesPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "feesDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "penaltyBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "penaltyPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "penaltyDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "installmentCount" INTEGER NOT NULL,
    "repaymentPeriodUnit" "RepaymentPeriodUnit" NOT NULL DEFAULT 'MONTHS',
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_transactions" (
    "id" TEXT NOT NULL,
    "loanAccountId" TEXT NOT NULL,
    "type" "LoanTransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "principalComponent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interestComponent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "feesComponent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "penaltyComponent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "postedByUserId" TEXT,
    "branchId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "reversesTransactionId" TEXT,
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repayment_schedules" (
    "id" TEXT NOT NULL,
    "loanAccountId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interestDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "feesDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "penaltyDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "principalPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interestPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "feesPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "penaltyPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "RepaymentInstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "lastPaidAt" TIMESTAMP(3),
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repayment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applied_fees" (
    "id" TEXT NOT NULL,
    "loanAccountId" TEXT NOT NULL,
    "feeRuleId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" TEXT,
    "legacyId" TEXT,

    CONSTRAINT "applied_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "ownerType" "AttachmentOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacyId" TEXT,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_template_mappings" (
    "loanProductId" TEXT NOT NULL,
    "documentTemplateId" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_template_mappings_pkey" PRIMARY KEY ("loanProductId","documentTemplateId")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_legacyId_key" ON "users"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "loan_products_code_key" ON "loan_products"("code");

-- CreateIndex
CREATE UNIQUE INDEX "loan_product_versions_previousVersionId_key" ON "loan_product_versions"("previousVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_product_versions_legacyId_key" ON "loan_product_versions"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_product_versions_loanProductId_versionNumber_key" ON "loan_product_versions"("loanProductId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "penalty_rules_loanProductVersionId_key" ON "penalty_rules"("loanProductVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_rules_legacyId_key" ON "fee_rules"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "borrowers_legacyId_key" ON "borrowers"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_income_details_borrowerId_key" ON "borrower_income_details"("borrowerId");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_government_ids_borrowerId_key" ON "borrower_government_ids"("borrowerId");

-- CreateIndex
CREATE INDEX "addresses_ownerType_ownerId_idx" ON "addresses"("ownerType", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "co_borrowers_legacyId_key" ON "co_borrowers"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_accounts_loanCode_key" ON "loan_accounts"("loanCode");

-- CreateIndex
CREATE UNIQUE INDEX "loan_accounts_legacyId_key" ON "loan_accounts"("legacyId");

-- CreateIndex
CREATE INDEX "loan_accounts_borrowerId_idx" ON "loan_accounts"("borrowerId");

-- CreateIndex
CREATE INDEX "loan_accounts_status_idx" ON "loan_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "loan_transactions_reversesTransactionId_key" ON "loan_transactions"("reversesTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_transactions_legacyId_key" ON "loan_transactions"("legacyId");

-- CreateIndex
CREATE INDEX "loan_transactions_loanAccountId_idx" ON "loan_transactions"("loanAccountId");

-- CreateIndex
CREATE INDEX "loan_transactions_type_idx" ON "loan_transactions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "repayment_schedules_legacyId_key" ON "repayment_schedules"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "repayment_schedules_loanAccountId_installmentNumber_key" ON "repayment_schedules"("loanAccountId", "installmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "applied_fees_legacyId_key" ON "applied_fees"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_legacyId_key" ON "attachments"("legacyId");

-- CreateIndex
CREATE INDEX "attachments_ownerType_ownerId_idx" ON "attachments"("ownerType", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_legacyId_key" ON "document_templates"("legacyId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_product_versions" ADD CONSTRAINT "loan_product_versions_loanProductId_fkey" FOREIGN KEY ("loanProductId") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_product_versions" ADD CONSTRAINT "loan_product_versions_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "loan_product_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_rules" ADD CONSTRAINT "penalty_rules_loanProductVersionId_fkey" FOREIGN KEY ("loanProductVersionId") REFERENCES "loan_product_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_loanProductVersionId_fkey" FOREIGN KEY ("loanProductVersionId") REFERENCES "loan_product_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_assignedLoanOfficerId_fkey" FOREIGN KEY ("assignedLoanOfficerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_income_details" ADD CONSTRAINT "borrower_income_details_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrowers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_government_ids" ADD CONSTRAINT "borrower_government_ids_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrowers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identification_documents" ADD CONSTRAINT "identification_documents_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrowers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_references" ADD CONSTRAINT "character_references_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrowers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_account_co_borrowers" ADD CONSTRAINT "loan_account_co_borrowers_loanAccountId_fkey" FOREIGN KEY ("loanAccountId") REFERENCES "loan_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_account_co_borrowers" ADD CONSTRAINT "loan_account_co_borrowers_coBorrowerId_fkey" FOREIGN KEY ("coBorrowerId") REFERENCES "co_borrowers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrowers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_loanProductVersionId_fkey" FOREIGN KEY ("loanProductVersionId") REFERENCES "loan_product_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_loanOfficerId_fkey" FOREIGN KEY ("loanOfficerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_transactions" ADD CONSTRAINT "loan_transactions_loanAccountId_fkey" FOREIGN KEY ("loanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_transactions" ADD CONSTRAINT "loan_transactions_postedByUserId_fkey" FOREIGN KEY ("postedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_transactions" ADD CONSTRAINT "loan_transactions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_transactions" ADD CONSTRAINT "loan_transactions_reversesTransactionId_fkey" FOREIGN KEY ("reversesTransactionId") REFERENCES "loan_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayment_schedules" ADD CONSTRAINT "repayment_schedules_loanAccountId_fkey" FOREIGN KEY ("loanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_fees" ADD CONSTRAINT "applied_fees_loanAccountId_fkey" FOREIGN KEY ("loanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_fees" ADD CONSTRAINT "applied_fees_feeRuleId_fkey" FOREIGN KEY ("feeRuleId") REFERENCES "fee_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_fees" ADD CONSTRAINT "applied_fees_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "loan_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_template_mappings" ADD CONSTRAINT "document_template_mappings_loanProductId_fkey" FOREIGN KEY ("loanProductId") REFERENCES "loan_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_template_mappings" ADD CONSTRAINT "document_template_mappings_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "document_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

