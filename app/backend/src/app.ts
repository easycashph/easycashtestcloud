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
import { CreateCoBorrowerUseCase } from '@modules/borrower/application/use-cases/CreateCoBorrowerUseCase';
import { GetCoBorrowerUseCase } from '@modules/borrower/application/use-cases/GetCoBorrowerUseCase';
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
import { GetLoanAccountUseCase } from '@modules/loan-account/application/use-cases/GetLoanAccountUseCase';
import { ListLoanAccountsUseCase } from '@modules/loan-account/application/use-cases/ListLoanAccountsUseCase';
import { ApproveLoanUseCase } from '@modules/loan-account/application/use-cases/ApproveLoanUseCase';
import { RejectLoanUseCase } from '@modules/loan-account/application/use-cases/RejectLoanUseCase';
import { ActivateLoanUseCase } from '@modules/loan-account/application/use-cases/ActivateLoanUseCase';
import { ProcessPaymentUseCase } from '@modules/loan-account/application/use-cases/ProcessPaymentUseCase';
import { PrismaLoanAccountRepository } from '@modules/loan-account/infrastructure/PrismaLoanAccountRepository';
import { createLedgerRouter } from '@modules/ledger/interface/http/ledgerRouter';
import { ListLoanTransactionsForAccountUseCase } from '@modules/ledger/application/use-cases/ListLoanTransactionsForAccountUseCase';
import { GetLoanTransactionUseCase } from '@modules/ledger/application/use-cases/GetLoanTransactionUseCase';
import { PrismaLoanTransactionRepository } from '@modules/ledger/infrastructure/PrismaLoanTransactionRepository';
import { createRepaymentRouter } from '@modules/repayment/interface/http/repaymentRouter';
import { ListRepaymentInstallmentsForLoanUseCase } from '@modules/repayment/application/use-cases/ListRepaymentInstallmentsForLoanUseCase';
import { GetRepaymentInstallmentUseCase } from '@modules/repayment/application/use-cases/GetRepaymentInstallmentUseCase';
import { PrismaRepaymentInstallmentRepository } from '@modules/repayment/infrastructure/PrismaRepaymentInstallmentRepository';
import { PrismaUnitOfWork } from '@shared/infrastructure/PrismaUnitOfWork';
import { PrismaFinancialAuditLogger } from '@shared/infrastructure/PrismaFinancialAuditLogger';
import { PrismaIdempotencyKeyStore } from '@shared/infrastructure/PrismaIdempotencyKeyStore';

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
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
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

  // --- borrower module wiring (Milestone 8: HTTP API layer) ---
  const borrowerRepository = new PrismaBorrowerRepository();
  const coBorrowerRepository = new PrismaCoBorrowerRepository();
  const borrowerRouter = createBorrowerRouter(
    {
      createBorrowerUseCase: new CreateBorrowerUseCase({ borrowerRepository }),
      getBorrowerUseCase: new GetBorrowerUseCase({ borrowerRepository }),
      listBorrowersUseCase: new ListBorrowersUseCase({ borrowerRepository }),
      createCoBorrowerUseCase: new CreateCoBorrowerUseCase({ coBorrowerRepository }),
      getCoBorrowerUseCase: new GetCoBorrowerUseCase({ coBorrowerRepository }),
    },
    tokenService,
  );
  app.use('/api/v1', borrowerRouter);

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
  const loanAccountRouter = createLoanAccountRouter(
    {
      createLoanAccountUseCase: new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository }),
      getLoanAccountUseCase,
      listLoanAccountsUseCase: new ListLoanAccountsUseCase({ loanAccountRepository }),
      approveLoanUseCase: new ApproveLoanUseCase({ loanAccountRepository }),
      rejectLoanUseCase: new RejectLoanUseCase({ loanAccountRepository }),
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
      }),
      processPaymentUseCase: new ProcessPaymentUseCase({
        loanAccountRepository,
        repaymentInstallmentRepository,
        loanTransactionRepository,
        financialAuditLogger,
        unitOfWork,
      }),
      idempotencyKeyStore,
    },
    tokenService,
  );
  app.use('/api/v1', loanAccountRouter);

  // --- ledger module wiring (Milestone 8: HTTP API layer, READ-ONLY per D-2) ---
  const ledgerRouter = createLedgerRouter(
    {
      listLoanTransactionsForAccountUseCase: new ListLoanTransactionsForAccountUseCase({ loanTransactionRepository }),
      getLoanTransactionUseCase: new GetLoanTransactionUseCase({ loanTransactionRepository }),
    },
    tokenService,
  );
  app.use('/api/v1', ledgerRouter);

  // --- repayment module wiring (Milestone 8: HTTP API layer, READ-ONLY per D-2) ---
  const repaymentRouter = createRepaymentRouter(
    {
      listRepaymentInstallmentsForLoanUseCase: new ListRepaymentInstallmentsForLoanUseCase({ repaymentInstallmentRepository }),
      getRepaymentInstallmentUseCase: new GetRepaymentInstallmentUseCase({ repaymentInstallmentRepository }),
      getLoanAccountUseCase, // H-1: branch check via the parent loan account.
    },
    tokenService,
  );
  app.use('/api/v1', repaymentRouter);

  // Further module routers are mounted under /api/v1/* as each is built out.

  app.use(errorHandler);

  return app;
}
