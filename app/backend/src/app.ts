import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from '@shared/config/env';
import { logger } from '@shared/logger/logger';
import { errorHandler } from '@shared/middleware/errorHandler';
import { parseTrustProxy } from '@shared/config/trustProxy';
import { createAuthRouter } from '@modules/identity/interface/http/authRouter';
import { LoginUseCase } from '@modules/identity/application/use-cases/LoginUseCase';
import { RefreshTokenUseCase } from '@modules/identity/application/use-cases/RefreshTokenUseCase';
import { LogoutUseCase } from '@modules/identity/application/use-cases/LogoutUseCase';
import { LogoutAllUseCase } from '@modules/identity/application/use-cases/LogoutAllUseCase';
import { GetCurrentUserUseCase } from '@modules/identity/application/use-cases/GetCurrentUserUseCase';
import { BcryptPasswordHasher } from '@modules/identity/infrastructure/BcryptPasswordHasher';
import { JwtTokenService } from '@modules/identity/infrastructure/JwtTokenService';
import { PrismaUserRepository } from '@modules/identity/infrastructure/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '@modules/identity/infrastructure/PrismaRefreshTokenRepository';
import { PrismaAuditLogger } from '@modules/identity/infrastructure/PrismaAuditLogger';
import { createBorrowerRouter } from '@modules/borrower/interface/http/borrowerRouter';
import { CreateBorrowerUseCase } from '@modules/borrower/application/use-cases/CreateBorrowerUseCase';
import { GetBorrowerUseCase } from '@modules/borrower/application/use-cases/GetBorrowerUseCase';
import { ListBorrowersUseCase } from '@modules/borrower/application/use-cases/ListBorrowersUseCase';
import { UpdateBorrowerUseCase } from '@modules/borrower/application/use-cases/UpdateBorrowerUseCase';
import { createPsgcRouter } from '@modules/psgc/interface/http/psgcRouter';
import { ListPsgcOptionsUseCase } from '@modules/psgc/application/use-cases/ListPsgcOptionsUseCase';
import { PrismaPsgcRepository } from '@modules/psgc/infrastructure/PrismaPsgcRepository';
import { CreateCoBorrowerUseCase } from '@modules/borrower/application/use-cases/CreateCoBorrowerUseCase';
import { GetCoBorrowerUseCase } from '@modules/borrower/application/use-cases/GetCoBorrowerUseCase';
import { GetBorrowerRiskSummaryUseCase } from '@modules/borrower/application/use-cases/GetBorrowerRiskSummaryUseCase';
import { BorrowerRiskSummaryService } from '@modules/borrower/application/services/BorrowerRiskSummaryService';
import { PrismaBorrowerRepository } from '@modules/borrower/infrastructure/PrismaBorrowerRepository';
import { PrismaCoBorrowerRepository } from '@modules/borrower/infrastructure/PrismaCoBorrowerRepository';
import { createLoanProductRouter } from '@modules/loan-product/interface/http/loanProductRouter';
import { CreateLoanProductUseCase } from '@modules/loan-product/application/use-cases/CreateLoanProductUseCase';
import { GetLoanProductUseCase } from '@modules/loan-product/application/use-cases/GetLoanProductUseCase';
import { ListLoanProductsUseCase } from '@modules/loan-product/application/use-cases/ListLoanProductsUseCase';
import { CreateLoanProductVersionUseCase } from '@modules/loan-product/application/use-cases/CreateLoanProductVersionUseCase';
import { ActivateLoanProductVersionUseCase } from '@modules/loan-product/application/use-cases/ActivateLoanProductVersionUseCase';
import { PrismaLoanProductRepository } from '@modules/loan-product/infrastructure/PrismaLoanProductRepository';
import { createLoanAccountRouter } from '@modules/loan-account/interface/http/loanAccountRouter';
import { CreateLoanAccountUseCase } from '@modules/loan-account/application/use-cases/CreateLoanAccountUseCase';
import { UpdateLoanAccountUseCase } from '@modules/loan-account/application/use-cases/UpdateLoanAccountUseCase';
import { GetLoanAccountUseCase } from '@modules/loan-account/application/use-cases/GetLoanAccountUseCase';
import { ListLoanAccountsUseCase } from '@modules/loan-account/application/use-cases/ListLoanAccountsUseCase';
import { ListMaturedLoanAccountIdsUseCase } from '@modules/loan-account/application/use-cases/ListMaturedLoanAccountIdsUseCase';
import { ApproveLoanUseCase } from '@modules/loan-account/application/use-cases/ApproveLoanUseCase';
import { UndoApproveLoanUseCase } from '@modules/loan-account/application/use-cases/UndoApproveLoanUseCase';
import { UndoActivateLoanUseCase } from '@modules/loan-account/application/use-cases/UndoActivateLoanUseCase';
import { RejectLoanUseCase } from '@modules/loan-account/application/use-cases/RejectLoanUseCase';
import { ActivateLoanUseCase } from '@modules/loan-account/application/use-cases/ActivateLoanUseCase';
import { ProcessPaymentUseCase } from '@modules/loan-account/application/use-cases/ProcessPaymentUseCase';
import { ReversePaymentUseCase } from '@modules/loan-account/application/use-cases/ReversePaymentUseCase';
import { GetLoanRiskAssessmentUseCase } from '@modules/loan-account/application/use-cases/GetLoanRiskAssessmentUseCase';
import { LoanRiskAssessmentService } from '@modules/loan-account/application/services/LoanRiskAssessmentService';
import { PrismaLoanAccountRepository } from '@modules/loan-account/infrastructure/PrismaLoanAccountRepository';
import { createLedgerRouter } from '@modules/ledger/interface/http/ledgerRouter';
import { ListLoanTransactionsForAccountUseCase } from '@modules/ledger/application/use-cases/ListLoanTransactionsForAccountUseCase';
import { GetLoanTransactionUseCase } from '@modules/ledger/application/use-cases/GetLoanTransactionUseCase';
import { ListPaymentAllocationsForTransactionUseCase } from '@modules/ledger/application/use-cases/ListPaymentAllocationsForTransactionUseCase';
import { PrismaLoanTransactionRepository } from '@modules/ledger/infrastructure/PrismaLoanTransactionRepository';
import { PrismaPaymentAllocationRepository } from '@modules/ledger/infrastructure/PrismaPaymentAllocationRepository';
import { createLoanNoteRouter } from '@modules/loan-note/interface/http/loanNoteRouter';
import { CreateLoanNoteUseCase } from '@modules/loan-note/application/use-cases/CreateLoanNoteUseCase';
import { ListLoanNotesUseCase } from '@modules/loan-note/application/use-cases/ListLoanNotesUseCase';
import { DeleteLoanNoteUseCase } from '@modules/loan-note/application/use-cases/DeleteLoanNoteUseCase';
import { PrismaLoanNoteRepository } from '@modules/loan-note/infrastructure/PrismaLoanNoteRepository';
import { createRepaymentRouter } from '@modules/repayment/interface/http/repaymentRouter';
import { ListRepaymentInstallmentsForLoanUseCase } from '@modules/repayment/application/use-cases/ListRepaymentInstallmentsForLoanUseCase';
import { GetRepaymentInstallmentUseCase } from '@modules/repayment/application/use-cases/GetRepaymentInstallmentUseCase';
import { PrismaRepaymentInstallmentRepository } from '@modules/repayment/infrastructure/PrismaRepaymentInstallmentRepository';
import { PrismaPenaltyReductionRepository } from '@modules/repayment/infrastructure/PrismaPenaltyReductionRepository';
import { PrismaFeeAdjustmentRepository } from '@modules/repayment/infrastructure/PrismaFeeAdjustmentRepository';
import { ReducePenaltyUseCase } from '@modules/repayment/application/use-cases/ReducePenaltyUseCase';
import { AdjustFeesUseCase } from '@modules/repayment/application/use-cases/AdjustFeesUseCase';
import { ListInstallmentAdjustmentsForLoanUseCase } from '@modules/repayment/application/use-cases/ListInstallmentAdjustmentsForLoanUseCase';
import { createDashboardRouter } from '@modules/dashboard/interface/http/dashboardRouter';
import { GetDashboardSummaryUseCase } from '@modules/dashboard/application/use-cases/GetDashboardSummaryUseCase';
import { PrismaDashboardRepository } from '@modules/dashboard/infrastructure/PrismaDashboardRepository';
import { createLoanApplicationRouter } from '@modules/loan-application/interface/http/loanApplicationRouter';
import { CreateLoanApplicationUseCase } from '@modules/loan-application/application/use-cases/CreateLoanApplicationUseCase';
import { GetLoanApplicationUseCase } from '@modules/loan-application/application/use-cases/GetLoanApplicationUseCase';
import { ListLoanApplicationsUseCase } from '@modules/loan-application/application/use-cases/ListLoanApplicationsUseCase';
import { AssignLoanApplicationProductUseCase } from '@modules/loan-application/application/use-cases/AssignLoanApplicationProductUseCase';
import { ApproveLoanApplicationUseCase } from '@modules/loan-application/application/use-cases/ApproveLoanApplicationUseCase';
import { DeclineLoanApplicationUseCase } from '@modules/loan-application/application/use-cases/DeclineLoanApplicationUseCase';
import { RevertLoanApplicationDecisionUseCase } from '@modules/loan-application/application/use-cases/RevertLoanApplicationDecisionUseCase';
import { StartLoanApplicationReviewUseCase } from '@modules/loan-application/application/use-cases/StartLoanApplicationReviewUseCase';
import { SubmitLoanApplicationReviewReportUseCase } from '@modules/loan-application/application/use-cases/SubmitLoanApplicationReviewReportUseCase';
import { TagLoanApplicationPreApprovalUseCase } from '@modules/loan-application/application/use-cases/TagLoanApplicationPreApprovalUseCase';
import { UpdateLoanApplicationUseCase } from '@modules/loan-application/application/use-cases/UpdateLoanApplicationUseCase';
import { PrismaLoanApplicationRepository } from '@modules/loan-application/infrastructure/PrismaLoanApplicationRepository';
import { PrismaBranchRepository } from '@modules/loan-application/infrastructure/PrismaBranchRepository';
import { LoanApplicationPreQualificationService } from '@modules/loan-application/application/services/LoanApplicationPreQualificationService';
import { NominatimGeocodingService } from '@shared/geo/NominatimGeocodingService';
import { createAuditLogRouter } from '@modules/audit/interface/http/auditLogRouter';
import { ListAuditLogsUseCase } from '@modules/audit/application/use-cases/ListAuditLogsUseCase';
import { LogSectionViewUseCase } from '@modules/audit/application/use-cases/LogSectionViewUseCase';
import { PrismaAuditLogRepository } from '@modules/audit/infrastructure/PrismaAuditLogRepository';
import { createDocumentRouter } from '@modules/document/interface/http/documentRouter';
import { createProfileNoteRouter } from '@modules/profile-note/interface/http/profileNoteRouter';
import { createAiExtractionRouter } from '@modules/ai-extraction/interface/http/aiExtractionRouter';
import { ExtractLoanApplicationFieldsUseCase } from '@modules/ai-extraction/application/use-cases/ExtractLoanApplicationFieldsUseCase';
import { OllamaVisionModelClient } from '@modules/ai-extraction/infrastructure/OllamaVisionModelClient';
import { UploadAttachmentUseCase } from '@modules/document/application/use-cases/UploadAttachmentUseCase';
import { ListAttachmentsForOwnerUseCase } from '@modules/document/application/use-cases/ListAttachmentsForOwnerUseCase';
import { DownloadAttachmentUseCase } from '@modules/document/application/use-cases/DownloadAttachmentUseCase';
import { PrismaAttachmentRepository } from '@modules/document/infrastructure/PrismaAttachmentRepository';
import { PrismaProfileNoteRepository } from '@modules/profile-note/infrastructure/PrismaProfileNoteRepository';
import { CreateProfileNoteUseCase } from '@modules/profile-note/application/use-cases/CreateProfileNoteUseCase';
import { ListProfileNotesForOwnerUseCase } from '@modules/profile-note/application/use-cases/ListProfileNotesForOwnerUseCase';
import { LocalFileStorage } from '@modules/document/infrastructure/LocalFileStorage';
import { createUserRouter } from '@modules/identity/interface/http/userRouter';
import { createRoleClassRouter } from '@modules/role-class/interface/http/RoleClassRouter';
import { RoleClassController } from '@modules/role-class/interface/http/RoleClassController';
import { ListRoleClassesUseCase } from '@modules/role-class/application/use-cases/ListRoleClassesUseCase';
import { CreateRoleClassUseCase } from '@modules/role-class/application/use-cases/CreateRoleClassUseCase';
import { UpdateRoleClassUseCase } from '@modules/role-class/application/use-cases/UpdateRoleClassUseCase';
import { PrismaRoleClassRepository } from '@modules/role-class/infrastructure/PrismaRoleClassRepository';
import { ListUsersUseCase } from '@modules/identity/application/use-cases/ListUsersUseCase';
import { CreateUserUseCase } from '@modules/identity/application/use-cases/CreateUserUseCase';
import { UpdateUserUseCase } from '@modules/identity/application/use-cases/UpdateUserUseCase';
import { UpdateOwnProfileUseCase } from '@modules/identity/application/use-cases/UpdateOwnProfileUseCase';
import { ChangeOwnPasswordUseCase } from '@modules/identity/application/use-cases/ChangeOwnPasswordUseCase';
import { createPaymentReminderRouter } from '@modules/payment-reminder/interface/http/paymentReminderRouter';
import { ListPaymentRemindersUseCase } from '@modules/payment-reminder/application/use-cases/ListPaymentRemindersUseCase';
import { PrismaPaymentReminderRepository } from '@modules/payment-reminder/infrastructure/PrismaPaymentReminderRepository';
import { createInterestRateChartRouter } from '@modules/interest-rate-chart/interface/http/interestRateChartRouter';
import { ListInterestRateChartUseCase } from '@modules/interest-rate-chart/application/use-cases/ListInterestRateChartUseCase';
import { PrismaInterestRateChartRepository } from '@modules/interest-rate-chart/infrastructure/PrismaInterestRateChartRepository';
import { createReportingRouter } from '@modules/reporting/interface/http/reportingRouter';
import { GetLoanOriginationReportUseCase } from '@modules/reporting/application/use-cases/GetLoanOriginationReportUseCase';
import { GetCollectionReportUseCase } from '@modules/reporting/application/use-cases/GetCollectionReportUseCase';
import { ListReportTransactionsUseCase } from '@modules/reporting/application/use-cases/ListReportTransactionsUseCase';
import { GetLoanReleasesReportUseCase } from '@modules/reporting/application/use-cases/GetLoanReleasesReportUseCase';
import { GetAgingReportUseCase } from '@modules/reporting/application/use-cases/GetAgingReportUseCase';
import { GetEndingBalanceReportUseCase } from '@modules/reporting/application/use-cases/GetEndingBalanceReportUseCase';
import { GetAccountsWithPastDueReportUseCase } from '@modules/reporting/application/use-cases/GetAccountsWithPastDueReportUseCase';
import { GetCollectionHistoryReportUseCase } from '@modules/reporting/application/use-cases/GetCollectionHistoryReportUseCase';
import { GetExpectedCollectionReportUseCase } from '@modules/reporting/application/use-cases/GetExpectedCollectionReportUseCase';
import { GetFirstAmortizationReportUseCase } from '@modules/reporting/application/use-cases/GetFirstAmortizationReportUseCase';
import { GetDailyCollectionReportUseCase } from '@modules/reporting/application/use-cases/GetDailyCollectionReportUseCase';
import { GetFullyPaidAccountsReportUseCase } from '@modules/reporting/application/use-cases/GetFullyPaidAccountsReportUseCase';
import { PrismaReportingRepository } from '@modules/reporting/infrastructure/PrismaReportingRepository';
import { ExcelJsLoanReleasesReportWriter } from '@modules/reporting/infrastructure/ExcelJsLoanReleasesReportWriter';
import { PrismaUnitOfWork } from '@shared/infrastructure/PrismaUnitOfWork';
import { PrismaFinancialAuditLogger } from '@shared/infrastructure/PrismaFinancialAuditLogger';
import { PrismaIdempotencyKeyStore } from '@shared/infrastructure/PrismaIdempotencyKeyStore';
// Naming collision (2026-07-13 merge): Jomer's document module has its own LocalFileStorage
// (@modules/document/infrastructure/LocalFileStorage, imported above) - aliased here rather than
// consolidated, since the two were built independently against possibly-different IFileStorage
// port shapes. Worth reconciling into one canonical implementation later, not as part of this merge.
import { LocalFileStorage as SharedLocalFileStorage } from '@shared/infrastructure/LocalFileStorage';
import { prisma } from '@shared/database/prismaClient';
import { createLoanDocumentRouter } from '@modules/loan-document/interface/http/loanDocumentRouter';
import { GenerateLoanDocumentUseCase } from '@modules/loan-document/application/use-cases/GenerateLoanDocumentUseCase';
import { ListLoanDocumentsUseCase } from '@modules/loan-document/application/use-cases/ListLoanDocumentsUseCase';
import { GetGeneratedLoanDocumentFileUseCase } from '@modules/loan-document/application/use-cases/GetGeneratedLoanDocumentFileUseCase';
import { PrismaDocumentTemplateRepository } from '@modules/loan-document/infrastructure/PrismaDocumentTemplateRepository';
import { PrismaGeneratedLoanDocumentRepository } from '@modules/loan-document/infrastructure/PrismaGeneratedLoanDocumentRepository';
import { LoanDocumentMergeDataResolver } from '@modules/loan-document/infrastructure/LoanDocumentMergeDataResolver';
import { DocxtemplaterDocumentFiller } from '@modules/loan-document/infrastructure/DocxtemplaterDocumentFiller';
import { LibreOfficeDocxToPdfConverter } from '@modules/loan-document/infrastructure/LibreOfficeDocxToPdfConverter';
import { createProfileActivityLogRouter } from '@modules/profile-activity/interface/http/ProfileActivityLogRouter';
import { GetProfileActivityUseCase } from '@modules/profile-activity/application/use-cases/GetProfileActivityUseCase';
import { DeleteProfileActivityUseCase } from '@modules/profile-activity/application/use-cases/DeleteProfileActivityUseCase';
import { PrismaProfileActivityLogRepository } from '@modules/profile-activity/infrastructure/PrismaProfileActivityLogRepository';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import { ProfileActivityLogController } from '@modules/profile-activity/interface/http/ProfileActivityLogController';

/**
 * Composition root. Module routers are mounted here as they're built out
 * — infrastructure implementations are wired into use cases at this single
 * point, per the Clean Architecture dependency direction:
 * interface -> application -> domain <- infrastructure.
 */
export function createApp(): Express {
  const app = express();

  // Audit finding C-02: must be set correctly for the deployment topology
  // BEFORE anything that reads req.ip (rate limiters, audit logging) is
  // registered. See shared/config/trustProxy.ts and app/README.md.
  app.set('trust proxy', parseTrustProxy(env.TRUST_PROXY));

  // Secure-by-default baseline (CLAUDE.md §Security).
  app.use(helmet());
  // CORS_ORIGIN may be a comma-separated list (e.g. multiple local dev ports
  // running side by side) — split rather than assume a single origin.
  const corsOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  // In development, the browser-preview tool assigns Vite a random free port on every
  // restart (5173 is frequently already taken), so a fixed allow-list constantly falls
  // out of date. Accept any http(s)://localhost:<port> / 127.0.0.1:<port> origin in dev
  // only — production still enforces the exact CORS_ORIGIN allow-list below.
  //
  // 2026-07-11 (user request): also accept private-LAN IPv4 origins (192.168.x.x, 10.x.x.x,
  // 172.16-31.x.x) so a second device on the same office WiFi can reach this dev server via
  // http://<this-machine's-LAN-IP>:<port> instead of localhost, which only ever means "this same
  // device" and can never resolve to another machine. Dev-only, same as the localhost pattern —
  // production still enforces the exact CORS_ORIGIN allow-list below.
  const devOriginPattern =
    /^https?:\/\/(localhost|127\.0\.0\.1|192\.168(?:\.\d{1,3}){2}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(:\d+)?$/;
  app.use(
    cors({
      origin:
        env.NODE_ENV === 'development'
          ? (origin, callback) => {
              if (!origin || devOriginPattern.test(origin) || corsOrigins.includes(origin)) {
                callback(null, true);
              } else {
                callback(new Error('Not allowed by CORS'));
              }
            }
          : corsOrigins,
      credentials: true,
    }),
  );
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      // Kept tight in production (300/15min covers real traffic without being
      // a meaningful brute-force throttle by itself — the per-endpoint
      // limiters in authRouter.ts do that job). Relaxed in development only,
      // matching loginRateLimiter's precedent: this global limiter counts
      // every request app-wide (dashboard polling, list pages, health
      // checks, manual testing), so it was getting exhausted by normal local
      // development activity and locking developers out for up to 15
      // minutes — not the threat this limiter exists to stop.
      limit: env.NODE_ENV === 'development' ? 5000 : 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'easycash-backend', timestamp: new Date().toISOString() });
  });

  // --- identity module wiring (Milestone 6: Authentication) ---
  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService();
  const userRepository = new PrismaUserRepository();
  const refreshTokenRepository = new PrismaRefreshTokenRepository();
  const auditLogger = new PrismaAuditLogger();

  // Audit finding H-01: env.JWT_REFRESH_TTL_MS (pre-parsed, fail-fast in
  // env.ts) is now actually threaded through, instead of the use cases'
  // internal hardcoded fallback constants silently taking over.
  const authRouter = createAuthRouter(
    {
      loginUseCase: new LoginUseCase({
        userRepository,
        passwordHasher,
        tokenService,
        refreshTokenRepository,
        auditLogger,
        refreshTokenTtlMs: env.JWT_REFRESH_TTL_MS,
      }),
      refreshTokenUseCase: new RefreshTokenUseCase({
        userRepository,
        tokenService,
        refreshTokenRepository,
        refreshTokenTtlMs: env.JWT_REFRESH_TTL_MS,
      }),
      logoutUseCase: new LogoutUseCase({ refreshTokenRepository }),
      logoutAllUseCase: new LogoutAllUseCase({ refreshTokenRepository }),
      getCurrentUserUseCase: new GetCurrentUserUseCase({ userRepository }),
    },
    tokenService,
  );
  app.use('/api/v1/auth', authRouter);

  // --- identity module wiring: staff/user administration (Member Details) ---
  const userRouter = createUserRouter(
    {
      listUsersUseCase: new ListUsersUseCase({ userRepository }),
      createUserUseCase: new CreateUserUseCase({ userRepository, passwordHasher, auditLogger }),
      updateUserUseCase: new UpdateUserUseCase({ userRepository, passwordHasher, auditLogger }),
      updateOwnProfileUseCase: new UpdateOwnProfileUseCase({ userRepository }),
      changeOwnPasswordUseCase: new ChangeOwnPasswordUseCase({ userRepository, passwordHasher, auditLogger }),
    },
    tokenService,
  );
  app.use('/api/v1', userRouter);

  // --- role-class module wiring: organizational job-title labels under a Role (Administration > Member Details > Roles tab) ---
  const roleClassRepository = new PrismaRoleClassRepository();
  const roleClassController = new RoleClassController({
    listRoleClassesUseCase: new ListRoleClassesUseCase({ roleClassRepository }),
    createRoleClassUseCase: new CreateRoleClassUseCase({ roleClassRepository, auditLogger }),
    updateRoleClassUseCase: new UpdateRoleClassUseCase({ roleClassRepository, auditLogger }),
  });
  const roleClassRouter = createRoleClassRouter(roleClassController, tokenService);
  app.use('/api/v1', roleClassRouter);

  // --- profile-activity module wiring: ADR-050 — track loan officer actions on profiles ---
  // Instantiated here early so it can be injected into borrower, loan-account, and loan-application use cases.
  const profileActivityLogRepository = new PrismaProfileActivityLogRepository();
  const profileActivityLogService = new ProfileActivityLogService(profileActivityLogRepository);

  // --- borrower module wiring (Milestone 8: HTTP API layer) ---
  const borrowerRepository = new PrismaBorrowerRepository();
  const coBorrowerRepository = new PrismaCoBorrowerRepository();
  // Hoisted above the loan-account module's own wiring section below (their canonical home) since
  // the borrower risk-summary use case, wired here, needs them too — same instances, not duplicated.
  const loanAccountRepositoryForBorrowerRisk = new PrismaLoanAccountRepository();
  const repaymentInstallmentRepositoryForBorrowerRisk = new PrismaRepaymentInstallmentRepository();
  const borrowerRiskSummaryService = new BorrowerRiskSummaryService(new LoanRiskAssessmentService());
  const borrowerRouter = createBorrowerRouter(
    {
      createBorrowerUseCase: new CreateBorrowerUseCase({ borrowerRepository, profileActivityLogService }),
      getBorrowerUseCase: new GetBorrowerUseCase({ borrowerRepository }),
      listBorrowersUseCase: new ListBorrowersUseCase({ borrowerRepository }),
      updateBorrowerUseCase: new UpdateBorrowerUseCase({ borrowerRepository, profileActivityLogService }),
      createCoBorrowerUseCase: new CreateCoBorrowerUseCase({ coBorrowerRepository, auditLogger }),
      getCoBorrowerUseCase: new GetCoBorrowerUseCase({ coBorrowerRepository }),
      getBorrowerRiskSummaryUseCase: new GetBorrowerRiskSummaryUseCase({
        borrowerRepository,
        loanAccountRepository: loanAccountRepositoryForBorrowerRisk,
        repaymentInstallmentRepository: repaymentInstallmentRepositoryForBorrowerRisk,
        riskSummaryService: borrowerRiskSummaryService,
      }),
    },
    tokenService,
  );
  app.use('/api/v1', borrowerRouter);

  // --- psgc module wiring: read-only Philippine address reference data (Region/Province/City/Barangay) ---
  const psgcRouter = createPsgcRouter(
    { listPsgcOptionsUseCase: new ListPsgcOptionsUseCase({ psgcRepository: new PrismaPsgcRepository() }) },
    tokenService,
  );
  app.use('/api/v1', psgcRouter);

  // --- loan-product module wiring (Milestone 8: HTTP API layer) ---
  const loanProductRepository = new PrismaLoanProductRepository();
  const loanProductRouter = createLoanProductRouter(
    {
      createLoanProductUseCase: new CreateLoanProductUseCase({ loanProductRepository }),
      getLoanProductUseCase: new GetLoanProductUseCase({ loanProductRepository }),
      listLoanProductsUseCase: new ListLoanProductsUseCase({ loanProductRepository }),
      createLoanProductVersionUseCase: new CreateLoanProductVersionUseCase({ loanProductRepository }),
      activateLoanProductVersionUseCase: new ActivateLoanProductVersionUseCase({ loanProductRepository }),
    },
    tokenService,
  );
  app.use('/api/v1', loanProductRouter);

  // --- shared cross-module infrastructure (Milestone 9.1 CP1/CP2, wired to
  // a real HTTP caller for the first time by CP13 below) ---
  const unitOfWork = new PrismaUnitOfWork();
  const financialAuditLogger = new PrismaFinancialAuditLogger();
  const idempotencyKeyStore = new PrismaIdempotencyKeyStore();

  // --- loan-account module wiring (Milestone 8: HTTP API layer) ---
  const loanAccountRepository = new PrismaLoanAccountRepository();
  // Shared across loan-account's own router and repayment's H-1 branch
  // check below (RepaymentInstallment has no branchId of its own — see
  // repaymentController.ts). Also needed by CP8/CP9's use cases below.
  const getLoanAccountUseCase = new GetLoanAccountUseCase({ loanAccountRepository });
  // Declared here (rather than at the ledger/repayment sections below,
  // where they were previously first introduced) because CP8/CP9's use
  // cases need them too — same repository instances, not duplicated ones.
  const loanTransactionRepository = new PrismaLoanTransactionRepository();
  const repaymentInstallmentRepository = new PrismaRepaymentInstallmentRepository();
  // 2026-07-11 (Reverse Payment feature): shared by ProcessPaymentUseCase (writes the breakdown)
  // and ReversePaymentUseCase (reads it back) below — see PaymentAllocation's own doc comment.
  const paymentAllocationRepository = new PrismaPaymentAllocationRepository();
  const loanRiskAssessmentService = new LoanRiskAssessmentService();
  const loanAccountRouter = createLoanAccountRouter(
    {
      createLoanAccountUseCase: new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository }),
      updateLoanAccountUseCase: new UpdateLoanAccountUseCase({ loanAccountRepository, loanProductRepository }),
      getLoanAccountUseCase,
      listLoanAccountsUseCase: new ListLoanAccountsUseCase({ loanAccountRepository }),
      listMaturedLoanAccountIdsUseCase: new ListMaturedLoanAccountIdsUseCase({ loanAccountRepository }),
      approveLoanUseCase: new ApproveLoanUseCase({ loanAccountRepository, financialAuditLogger, unitOfWork, profileActivityLogService }),
      undoApproveLoanUseCase: new UndoApproveLoanUseCase({ loanAccountRepository, financialAuditLogger, unitOfWork, profileActivityLogService }),
      rejectLoanUseCase: new RejectLoanUseCase({ loanAccountRepository, financialAuditLogger, unitOfWork, profileActivityLogService }),
      // Milestone 9.1/9.2 CP13: first real HTTP callers of CP8/CP9's use
      // cases (previously built with zero routes, per the D-2 precedent —
      // see ActivateLoanUseCase's/ProcessPaymentUseCase's own doc comments).
      activateLoanUseCase: new ActivateLoanUseCase({
        loanAccountRepository,
        loanProductRepository,
        repaymentInstallmentRepository,
        loanTransactionRepository,
        financialAuditLogger,
        unitOfWork,
        profileActivityLogService,
      }),
      // 2026-07-16 (Undo Activate, user request, MIS-only): local repository instances here
      // (rather than reusing the module-scoped ones defined later in this file for the repayment
      // router) since this block runs before that point — both are stateless, cheap to construct.
      undoActivateLoanUseCase: new UndoActivateLoanUseCase({
        loanAccountRepository,
        repaymentInstallmentRepository,
        loanTransactionRepository,
        penaltyReductionRepository: new PrismaPenaltyReductionRepository(),
        feeAdjustmentRepository: new PrismaFeeAdjustmentRepository(),
        financialAuditLogger,
        unitOfWork,
        profileActivityLogService,
      }),
      processPaymentUseCase: new ProcessPaymentUseCase({
        loanAccountRepository,
        profileActivityLogService,
        repaymentInstallmentRepository,
        loanTransactionRepository,
        paymentAllocationRepository,
        financialAuditLogger,
        unitOfWork,
      }),
      reversePaymentUseCase: new ReversePaymentUseCase({
        loanAccountRepository,
        repaymentInstallmentRepository,
        loanTransactionRepository,
        paymentAllocationRepository,
        financialAuditLogger,
        unitOfWork,
      }),
      getLoanRiskAssessmentUseCase: new GetLoanRiskAssessmentUseCase({
        loanAccountRepository,
        repaymentInstallmentRepository,
        riskAssessmentService: loanRiskAssessmentService,
      }),
      idempotencyKeyStore,
    },
    tokenService,
  );
  app.use('/api/v1', loanAccountRouter);

  // --- loan-note module wiring (2026-07-11, Collections use case) ---
  const loanNoteRepository = new PrismaLoanNoteRepository();
  const loanNoteRouter = createLoanNoteRouter(
    {
      createLoanNoteUseCase: new CreateLoanNoteUseCase({ loanNoteRepository, loanAccountRepository }),
      listLoanNotesUseCase: new ListLoanNotesUseCase({ loanNoteRepository }),
      deleteLoanNoteUseCase: new DeleteLoanNoteUseCase({ loanNoteRepository, auditLogger }),
      getLoanAccountUseCase,
    },
    tokenService,
  );
  app.use('/api/v1', loanNoteRouter);

  // --- loan-document module wiring (ADR-051, 2026-07-12: Loan Document Generation) ---
  const documentTemplateRepository = new PrismaDocumentTemplateRepository();
  const generatedLoanDocumentRepository = new PrismaGeneratedLoanDocumentRepository();
  // STORAGE_DRIVER=s3 is declared in env validation (ADR-051 §4's storage abstraction) but has no
  // implementation yet — fail fast rather than silently falling back to local.
  if (env.STORAGE_DRIVER !== 'local') {
    throw new Error(`STORAGE_DRIVER=${env.STORAGE_DRIVER} has no implementation yet — only "local" is supported.`);
  }
  const loanDocumentFileStorage = new SharedLocalFileStorage(env.STORAGE_LOCAL_PATH);
  const mergeDataResolver = new LoanDocumentMergeDataResolver({
    loanAccountRepository,
    borrowerRepository,
    coBorrowerRepository,
    loanProductRepository,
    repaymentInstallmentRepository,
    prisma,
  });
  const documentFiller = new DocxtemplaterDocumentFiller();
  const docxToPdfConverter = new LibreOfficeDocxToPdfConverter();
  const loanDocumentRouter = createLoanDocumentRouter(
    {
      generateLoanDocumentUseCase: new GenerateLoanDocumentUseCase({
        loanAccountRepository,
        loanProductRepository,
        documentTemplateRepository,
        generatedLoanDocumentRepository,
        mergeDataResolver,
        documentFiller,
        docxToPdfConverter,
        fileStorage: loanDocumentFileStorage,
      }),
      listLoanDocumentsUseCase: new ListLoanDocumentsUseCase({
        loanAccountRepository,
        loanProductRepository,
        documentTemplateRepository,
        generatedLoanDocumentRepository,
      }),
      getGeneratedLoanDocumentFileUseCase: new GetGeneratedLoanDocumentFileUseCase({
        generatedLoanDocumentRepository,
        documentTemplateRepository,
        fileStorage: loanDocumentFileStorage,
      }),
      getLoanAccountUseCase,
      idempotencyKeyStore,
    },
    tokenService,
  );
  app.use('/api/v1', loanDocumentRouter);

  // --- ledger module wiring (Milestone 8: HTTP API layer, READ-ONLY per D-2) ---
  const ledgerRouter = createLedgerRouter(
    {
      listLoanTransactionsForAccountUseCase: new ListLoanTransactionsForAccountUseCase({ loanTransactionRepository }),
      getLoanTransactionUseCase: new GetLoanTransactionUseCase({ loanTransactionRepository }),
      listPaymentAllocationsForTransactionUseCase: new ListPaymentAllocationsForTransactionUseCase({
        loanTransactionRepository,
        paymentAllocationRepository,
        repaymentInstallmentRepository,
      }),
    },
    tokenService,
  );
  app.use('/api/v1', ledgerRouter);

  // --- repayment module wiring (Milestone 8: HTTP API layer, mostly READ-ONLY per D-2) ---
  const penaltyReductionRepository = new PrismaPenaltyReductionRepository();
  const feeAdjustmentRepository = new PrismaFeeAdjustmentRepository();
  const repaymentRouter = createRepaymentRouter(
    {
      listRepaymentInstallmentsForLoanUseCase: new ListRepaymentInstallmentsForLoanUseCase({ repaymentInstallmentRepository }),
      getRepaymentInstallmentUseCase: new GetRepaymentInstallmentUseCase({ repaymentInstallmentRepository }),
      reducePenaltyUseCase: new ReducePenaltyUseCase({
        repaymentInstallmentRepository,
        loanAccountRepository,
        penaltyReductionRepository,
        financialAuditLogger,
        unitOfWork,
      }),
      adjustFeesUseCase: new AdjustFeesUseCase({
        repaymentInstallmentRepository,
        loanAccountRepository,
        feeAdjustmentRepository,
        financialAuditLogger,
        unitOfWork,
      }),
      listInstallmentAdjustmentsForLoanUseCase: new ListInstallmentAdjustmentsForLoanUseCase({
        penaltyReductionRepository,
        feeAdjustmentRepository,
      }),
      getLoanAccountUseCase, // H-1: branch check via the parent loan account.
    },
    tokenService,
  );
  app.use('/api/v1', repaymentRouter);

  // --- profile-activity module router mount (controller instantiated below after dashboard) ---

  // --- dashboard module wiring (Milestone 9.2: read-only portfolio aggregates) ---
  const dashboardRouter = createDashboardRouter(
    {
      getDashboardSummaryUseCase: new GetDashboardSummaryUseCase({ dashboardRepository: new PrismaDashboardRepository() }),
    },
    tokenService,
  );
  app.use('/api/v1', dashboardRouter);

  // --- loan-application module wiring (Milestone 9.2: intake/decision workflow, plus the
  // system-computed PREAPPROVED/PREDECLINED pre-qualification added 2026-07-11 — the
  // approved-application-to-Borrower/LoanAccount conversion itself lives in the borrower/
  // loan-account modules' own create flows; this module only reads the resulting linkage back
  // via Borrower.sourceApplicationId, see LoanApplicationController.buildLinkage) ---
  const loanApplicationRepository = new PrismaLoanApplicationRepository();
  const branchRepository = new PrismaBranchRepository();
  const geocodingService = new NominatimGeocodingService();
  const preQualificationService = new LoanApplicationPreQualificationService({ branchRepository, geocodingService });
  const loanApplicationRouter = createLoanApplicationRouter(
    {
      createLoanApplicationUseCase: new CreateLoanApplicationUseCase({
        loanApplicationRepository,
        preQualificationService,
        profileActivityLogService,
        loanAccountRepository,
      }),
      getLoanApplicationUseCase: new GetLoanApplicationUseCase({ loanApplicationRepository }),
      listLoanApplicationsUseCase: new ListLoanApplicationsUseCase({ loanApplicationRepository }),
      assignLoanApplicationProductUseCase: new AssignLoanApplicationProductUseCase({ loanApplicationRepository, profileActivityLogService }),
      approveLoanApplicationUseCase: new ApproveLoanApplicationUseCase({
        loanApplicationRepository,
        auditLogger,
        profileActivityLogService,
      }),
      declineLoanApplicationUseCase: new DeclineLoanApplicationUseCase({
        loanApplicationRepository,
        auditLogger,
        profileActivityLogService,
      }),
      revertLoanApplicationDecisionUseCase: new RevertLoanApplicationDecisionUseCase({
        loanApplicationRepository,
        auditLogger,
        preQualificationService,
        profileActivityLogService,
      }),
      startLoanApplicationReviewUseCase: new StartLoanApplicationReviewUseCase({
        loanApplicationRepository,
        auditLogger,
        profileActivityLogService,
      }),
      submitLoanApplicationReviewReportUseCase: new SubmitLoanApplicationReviewReportUseCase({ loanApplicationRepository, auditLogger }),
      tagLoanApplicationPreApprovalUseCase: new TagLoanApplicationPreApprovalUseCase({
        loanApplicationRepository,
        auditLogger,
        profileActivityLogService,
      }),
      updateLoanApplicationUseCase: new UpdateLoanApplicationUseCase({ loanApplicationRepository, preQualificationService, profileActivityLogService }),
      preQualificationService,
      borrowerRepository,
      loanAccountRepository,
    },
    tokenService,
  );
  app.use('/api/v1', loanApplicationRouter);

  // --- audit module wiring (Milestone 9.2: read-only Activity Logs API, MIS only —
  // the audit trail itself is written by identity/loan-application use cases via IAuditLogger) ---
  const auditLogRouter = createAuditLogRouter(
    {
      listAuditLogsUseCase: new ListAuditLogsUseCase({ auditLogRepository: new PrismaAuditLogRepository() }),
      logSectionViewUseCase: new LogSectionViewUseCase({ auditLogger }),
    },
    tokenService,
  );
  app.use('/api/v1', auditLogRouter);

  // --- payment-reminder module wiring: cross-loan "next due installment" list (Payment Reminders) ---
  const paymentReminderRouter = createPaymentReminderRouter(
    {
      listPaymentRemindersUseCase: new ListPaymentRemindersUseCase({ paymentReminderRepository: new PrismaPaymentReminderRepository() }),
    },
    tokenService,
  );
  app.use('/api/v1', paymentReminderRouter);

  // --- interest-rate-chart module wiring: Add-On Rate + Term -> Contractual Rate lookup (Create Loan Account) ---
  const interestRateChartRouter = createInterestRateChartRouter(
    {
      listInterestRateChartUseCase: new ListInterestRateChartUseCase({
        interestRateChartRepository: new PrismaInterestRateChartRepository(),
      }),
    },
    tokenService,
  );
  app.use('/api/v1', interestRateChartRouter);

  // --- reporting module wiring: Loan/Collection/Transaction Report pages ---
  const reportingRepository = new PrismaReportingRepository();
  const reportingRouter = createReportingRouter(
    {
      getLoanOriginationReportUseCase: new GetLoanOriginationReportUseCase({ reportingRepository }),
      getCollectionReportUseCase: new GetCollectionReportUseCase({ reportingRepository }),
      listReportTransactionsUseCase: new ListReportTransactionsUseCase({ reportingRepository }),
      getLoanReleasesReportUseCase: new GetLoanReleasesReportUseCase({ reportingRepository }),
      loanReleasesReportWriter: new ExcelJsLoanReleasesReportWriter(),
      getAgingReportUseCase: new GetAgingReportUseCase({ reportingRepository }),
      getEndingBalanceReportUseCase: new GetEndingBalanceReportUseCase({ reportingRepository }),
      getAccountsWithPastDueReportUseCase: new GetAccountsWithPastDueReportUseCase({ reportingRepository }),
      getCollectionHistoryReportUseCase: new GetCollectionHistoryReportUseCase({ reportingRepository }),
      getExpectedCollectionReportUseCase: new GetExpectedCollectionReportUseCase({ reportingRepository }),
      getFirstAmortizationReportUseCase: new GetFirstAmortizationReportUseCase({ reportingRepository }),
      getDailyCollectionReportUseCase: new GetDailyCollectionReportUseCase({ reportingRepository }),
      getFullyPaidAccountsReportUseCase: new GetFullyPaidAccountsReportUseCase({ reportingRepository }),
    },
    tokenService,
  );
  app.use('/api/v1', reportingRouter);

  // --- document module wiring: attachment upload/list/download (Loan Application intake, and the
  // pre-existing legacy-migrated Borrower/LoanAccount attachment rows) ---
  const attachmentRepository = new PrismaAttachmentRepository();
  const fileStorage = new LocalFileStorage();
  const documentRouter = createDocumentRouter(
    {
      uploadAttachmentUseCase: new UploadAttachmentUseCase({ attachmentRepository, fileStorage, profileActivityLogService }),
      listAttachmentsForOwnerUseCase: new ListAttachmentsForOwnerUseCase({ attachmentRepository }),
      downloadAttachmentUseCase: new DownloadAttachmentUseCase({ attachmentRepository, fileStorage }),
    },
    tokenService,
  );
  app.use('/api/v1', documentRouter);

  // --- profile-note module wiring: free-text notes on Borrower/LoanAccount/LoanApplication, same
  // polymorphic ownerType/ownerId shape as the document module above. Distinct from the loan-note
  // module above (loan-account-only, MIS-deletable, audit-trailed) - renamed from "note" 2026-07-13
  // to make that distinction unmistakable. ---
  const profileNoteRepository = new PrismaProfileNoteRepository();
  const profileNoteRouter = createProfileNoteRouter(
    {
      createProfileNoteUseCase: new CreateProfileNoteUseCase({ profileNoteRepository }),
      listProfileNotesForOwnerUseCase: new ListProfileNotesForOwnerUseCase({ profileNoteRepository }),
    },
    tokenService,
  );
  app.use('/api/v1', profileNoteRouter);

  // --- ai-extraction module wiring: local Ollama (moondream) — auto-fill suggestions for the
  // Loan Application intake form from an uploaded ID/payslip/PDF/DOCX, never persisted here ---
  const aiExtractionRouter = createAiExtractionRouter(
    {
      extractLoanApplicationFieldsUseCase: new ExtractLoanApplicationFieldsUseCase({
        visionModelClient: new OllamaVisionModelClient(),
      }),
    },
    tokenService,
  );
  app.use('/api/v1', aiExtractionRouter);

  // --- profile-activity module router mount: ADR-050 ---
  const profileActivityLogController = new ProfileActivityLogController(
    new GetProfileActivityUseCase(profileActivityLogRepository, userRepository),
    new DeleteProfileActivityUseCase(profileActivityLogRepository),
  );
  const profileActivityLogRouter = createProfileActivityLogRouter(profileActivityLogController, tokenService);
  app.use('/api/v1', profileActivityLogRouter);

  // Further module routers are mounted under /api/v1/* as each is built out.

  app.use(errorHandler);

  return app;
}
