import express, { type Express } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from '@shared/config/env';
import { logger } from '@shared/logger/logger';
import { errorHandler } from '@shared/middleware/errorHandler';
import { parseTrustProxy } from '@shared/config/trustProxy';
import { getBuildInfo } from '@shared/config/buildInfo';
import { createAuthRouter } from '@modules/identity/interface/http/authRouter';
import { LoginUseCase } from '@modules/identity/application/use-cases/LoginUseCase';
import { RefreshTokenUseCase } from '@modules/identity/application/use-cases/RefreshTokenUseCase';
import { LogoutUseCase } from '@modules/identity/application/use-cases/LogoutUseCase';
import { LogoutAllUseCase } from '@modules/identity/application/use-cases/LogoutAllUseCase';
import { GetCurrentUserUseCase } from '@modules/identity/application/use-cases/GetCurrentUserUseCase';
import { PrismaPermissionCodesRepository } from '@modules/identity/infrastructure/PrismaPermissionCodesRepository';
import { ListSessionsUseCase } from '@modules/identity/application/use-cases/ListSessionsUseCase';
import { RevokeSessionUseCase } from '@modules/identity/application/use-cases/RevokeSessionUseCase';
import { VerifyLoginOtpUseCase } from '@modules/identity/application/use-cases/VerifyLoginOtpUseCase';
import { RequestPasswordResetUseCase as StaffRequestPasswordResetUseCase } from '@modules/identity/application/use-cases/RequestPasswordResetUseCase';
import { ConfirmPasswordResetUseCase as StaffConfirmPasswordResetUseCase } from '@modules/identity/application/use-cases/ConfirmPasswordResetUseCase';
import { RequestTwoFactorSetupUseCase } from '@modules/identity/application/use-cases/RequestTwoFactorSetupUseCase';
import { ConfirmTwoFactorSetupUseCase } from '@modules/identity/application/use-cases/ConfirmTwoFactorSetupUseCase';
import { DisableTwoFactorUseCase } from '@modules/identity/application/use-cases/DisableTwoFactorUseCase';
import { BcryptPasswordHasher } from '@modules/identity/infrastructure/BcryptPasswordHasher';
import { JwtTokenService } from '@modules/identity/infrastructure/JwtTokenService';
import { PrismaUserRepository } from '@modules/identity/infrastructure/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '@modules/identity/infrastructure/PrismaRefreshTokenRepository';
import { PrismaTwoFactorChallengeRepository } from '@modules/identity/infrastructure/PrismaTwoFactorChallengeRepository';
import { PrismaTrustedDeviceRepository } from '@modules/identity/infrastructure/PrismaTrustedDeviceRepository';
import { OtpSender } from '@modules/identity/infrastructure/OtpSender';
import { PrismaAuditLogger } from '@modules/identity/infrastructure/PrismaAuditLogger';
import { M360SmsGateway } from '@modules/sms-reminder/infrastructure/M360SmsGateway';
import { NodemailerEmailGateway } from '@modules/email-reminder/infrastructure/NodemailerEmailGateway';
import { createPortalAuthRouter } from '@modules/client-portal/interface/http/portalAuthRouter';
import { SignUpUseCase } from '@modules/client-portal/application/use-cases/SignUpUseCase';
import { VerifySignUpUseCase } from '@modules/client-portal/application/use-cases/VerifySignUpUseCase';
import { PortalLoginUseCase } from '@modules/client-portal/application/use-cases/PortalLoginUseCase';
import { VerifyPortalLoginOtpUseCase } from '@modules/client-portal/application/use-cases/VerifyPortalLoginOtpUseCase';
import { ResendPortalLoginOtpUseCase } from '@modules/client-portal/application/use-cases/ResendPortalLoginOtpUseCase';
import { ResendSignUpOtpUseCase } from '@modules/client-portal/application/use-cases/ResendSignUpOtpUseCase';
import { RequestEnablePortalTwoFactorUseCase } from '@modules/client-portal/application/use-cases/RequestEnablePortalTwoFactorUseCase';
import { ConfirmEnablePortalTwoFactorUseCase } from '@modules/client-portal/application/use-cases/ConfirmEnablePortalTwoFactorUseCase';
import { DisablePortalTwoFactorUseCase } from '@modules/client-portal/application/use-cases/DisablePortalTwoFactorUseCase';
import { ListPortalTrustedDevicesUseCase } from '@modules/client-portal/application/use-cases/ListPortalTrustedDevicesUseCase';
import { RevokePortalTrustedDeviceUseCase } from '@modules/client-portal/application/use-cases/RevokePortalTrustedDeviceUseCase';
import { RequestPasswordResetUseCase } from '@modules/client-portal/application/use-cases/RequestPasswordResetUseCase';
import { ConfirmPasswordResetUseCase } from '@modules/client-portal/application/use-cases/ConfirmPasswordResetUseCase';
import { GetPortalAccountUseCase } from '@modules/client-portal/application/use-cases/GetPortalAccountUseCase';
import { SubmitLoanApplicationUseCase } from '@modules/client-portal/application/use-cases/SubmitLoanApplicationUseCase';
import { ListPortalLoanApplicationsUseCase } from '@modules/client-portal/application/use-cases/ListPortalLoanApplicationsUseCase';
import { GetPortalLoanApplicationUseCase } from '@modules/client-portal/application/use-cases/GetPortalLoanApplicationUseCase';
import { GetPortalLoanApplicationStatusTimelineUseCase } from '@modules/client-portal/application/use-cases/GetPortalLoanApplicationStatusTimelineUseCase';
import { createPortalLoanAccountRouter } from '@modules/client-portal/interface/http/portalLoanAccountRouter';
import { ListPortalLoanAccountsUseCase } from '@modules/client-portal/application/use-cases/ListPortalLoanAccountsUseCase';
import { UploadPortalPaymentProofUseCase } from '@modules/client-portal/application/use-cases/UploadPortalPaymentProofUseCase';
import { ListPortalLoanAccountInstallmentsUseCase } from '@modules/client-portal/application/use-cases/ListPortalLoanAccountInstallmentsUseCase';
import { PrismaChatRepository } from '@modules/chat/infrastructure/PrismaChatRepository';
import { StartOrResumePortalChatUseCase } from '@modules/chat/application/use-cases/StartOrResumePortalChatUseCase';
import { GetActivePortalChatUseCase } from '@modules/chat/application/use-cases/GetActivePortalChatUseCase';
import { GetPortalChatUseCase } from '@modules/chat/application/use-cases/GetPortalChatUseCase';
import { SendPortalChatMessageUseCase } from '@modules/chat/application/use-cases/SendPortalChatMessageUseCase';
import { createPortalChatRouter } from '@modules/chat/interface/http/portalChatRouter';
import { ListChatQueueUseCase } from '@modules/chat/application/use-cases/ListChatQueueUseCase';
import { ClaimChatConversationUseCase } from '@modules/chat/application/use-cases/ClaimChatConversationUseCase';
import { InitiateChatTransferUseCase } from '@modules/chat/application/use-cases/InitiateChatTransferUseCase';
import { CompleteChatTransferUseCase } from '@modules/chat/application/use-cases/CompleteChatTransferUseCase';
import { CancelChatTransferUseCase } from '@modules/chat/application/use-cases/CancelChatTransferUseCase';
import { ListChatTransferCandidatesUseCase } from '@modules/chat/application/use-cases/ListChatTransferCandidatesUseCase';
import { ListIncomingChatTransfersUseCase } from '@modules/chat/application/use-cases/ListIncomingChatTransfersUseCase';
import { SendStaffChatMessageUseCase } from '@modules/chat/application/use-cases/SendStaffChatMessageUseCase';
import { CloseChatConversationUseCase } from '@modules/chat/application/use-cases/CloseChatConversationUseCase';
import { ListMyClaimedChatConversationsUseCase } from '@modules/chat/application/use-cases/ListMyClaimedChatConversationsUseCase';
import { GetChatConversationForStaffUseCase } from '@modules/chat/application/use-cases/GetChatConversationForStaffUseCase';
import { DownloadPortalChatAttachmentUseCase } from '@modules/chat/application/use-cases/DownloadPortalChatAttachmentUseCase';
import { DownloadChatAttachmentForStaffUseCase } from '@modules/chat/application/use-cases/DownloadChatAttachmentForStaffUseCase';
import { ListChatOversightStaffUseCase } from '@modules/chat/application/use-cases/ListChatOversightStaffUseCase';
import { ListChatConversationsForStaffUseCase } from '@modules/chat/application/use-cases/ListChatConversationsForStaffUseCase';
import { GetChatConversationForMisUseCase } from '@modules/chat/application/use-cases/GetChatConversationForMisUseCase';
import { SetPortalChatTypingUseCase } from '@modules/chat/application/use-cases/SetPortalChatTypingUseCase';
import { SetStaffChatTypingUseCase } from '@modules/chat/application/use-cases/SetStaffChatTypingUseCase';
import { SubmitChatRatingUseCase } from '@modules/chat/application/use-cases/SubmitChatRatingUseCase';
import { UpdateAgentPresenceUseCase } from '@modules/chat/application/use-cases/UpdateAgentPresenceUseCase';
import { ListAgentPresenceUseCase } from '@modules/chat/application/use-cases/ListAgentPresenceUseCase';
import { ListChatCannedResponsesUseCase } from '@modules/chat/application/use-cases/ListChatCannedResponsesUseCase';
import { CreateChatCannedResponseUseCase } from '@modules/chat/application/use-cases/CreateChatCannedResponseUseCase';
import { UpdateChatCannedResponseUseCase } from '@modules/chat/application/use-cases/UpdateChatCannedResponseUseCase';
import { DeleteChatCannedResponseUseCase } from '@modules/chat/application/use-cases/DeleteChatCannedResponseUseCase';
import { createChatRouter } from '@modules/chat/interface/http/chatRouter';
import { UpdatePortalLoanApplicationUseCase } from '@modules/client-portal/application/use-cases/UpdatePortalLoanApplicationUseCase';
import { ListPortalBranchesUseCase } from '@modules/client-portal/application/use-cases/ListPortalBranchesUseCase';
import { UploadPortalLoanApplicationDocumentUseCase } from '@modules/client-portal/application/use-cases/UploadPortalLoanApplicationDocumentUseCase';
import { createPortalLoanApplicationRouter } from '@modules/client-portal/interface/http/portalLoanApplicationRouter';
import { ListPortalLoanApplicationDocumentsUseCase } from '@modules/client-portal/application/use-cases/ListPortalLoanApplicationDocumentsUseCase';
import { DownloadPortalLoanApplicationDocumentUseCase } from '@modules/client-portal/application/use-cases/DownloadPortalLoanApplicationDocumentUseCase';
import { createPortalNotificationRouter } from '@modules/client-portal/interface/http/portalNotificationRouter';
import { createPortalProfileRouter } from '@modules/client-portal/interface/http/portalProfileRouter';
import { GetPortalProfileUseCase } from '@modules/client-portal/application/use-cases/GetPortalProfileUseCase';
import { UpdatePortalProfileUseCase } from '@modules/client-portal/application/use-cases/UpdatePortalProfileUseCase';
import { createPortalSecurityRouter } from '@modules/client-portal/interface/http/portalSecurityRouter';
import { ChangePortalPasswordUseCase } from '@modules/client-portal/application/use-cases/ChangePortalPasswordUseCase';
import { ChangePortalEmailUseCase } from '@modules/client-portal/application/use-cases/ChangePortalEmailUseCase';
import { createPortalPsgcRouter } from '@modules/client-portal/interface/http/portalPsgcRouter';
import { createExternalNewsLinkRouter } from '@modules/finance-news/interface/http/externalNewsLinkRouter';
import { ListExternalNewsLinksUseCase } from '@modules/finance-news/application/use-cases/ListExternalNewsLinksUseCase';
import { PrismaExternalNewsLinkRepository } from '@modules/finance-news/infrastructure/PrismaExternalNewsLinkRepository';
import { PortalOtpSender } from '@modules/client-portal/infrastructure/PortalOtpSender';
import { PrismaPortalAccountRepository } from '@modules/client-portal/infrastructure/PrismaPortalAccountRepository';
import { PrismaPortalAccountChallengeRepository } from '@modules/client-portal/infrastructure/PrismaPortalAccountChallengeRepository';
import { PrismaPortalTrustedDeviceRepository } from '@modules/client-portal/infrastructure/PrismaPortalTrustedDeviceRepository';
import { PrismaPortalNotificationRepository } from '@modules/client-portal/infrastructure/PrismaPortalNotificationRepository';
import { PortalNotificationService } from '@modules/client-portal/application/PortalNotificationService';
import { ListPortalNotificationsUseCase } from '@modules/client-portal/application/use-cases/ListPortalNotificationsUseCase';
import { MarkPortalNotificationReadUseCase } from '@modules/client-portal/application/use-cases/MarkPortalNotificationReadUseCase';
import { MarkAllPortalNotificationsReadUseCase } from '@modules/client-portal/application/use-cases/MarkAllPortalNotificationsReadUseCase';
import { JwtPortalTokenService } from '@modules/client-portal/infrastructure/JwtPortalTokenService';
import { createBorrowerRouter } from '@modules/borrower/interface/http/borrowerRouter';
import { CreateBorrowerUseCase } from '@modules/borrower/application/use-cases/CreateBorrowerUseCase';
import { GetBorrowerPortalAccountStatusUseCase } from '@modules/client-portal/application/use-cases/GetBorrowerPortalAccountStatusUseCase';
import { CreatePortalAccountForBorrowerUseCase } from '@modules/client-portal/application/use-cases/CreatePortalAccountForBorrowerUseCase';
import { ResetPortalAccountPasswordUseCase } from '@modules/client-portal/application/use-cases/ResetPortalAccountPasswordUseCase';
import { BindPortalAccountToBorrowerUseCase } from '@modules/client-portal/application/use-cases/BindPortalAccountToBorrowerUseCase';
import { RequestPortalAccountDeletionUseCase } from '@modules/client-portal/application/use-cases/RequestPortalAccountDeletionUseCase';
import { GetPortalNextPaymentDueUseCase } from '@modules/client-portal/application/use-cases/GetPortalNextPaymentDueUseCase';
import { ListPortalRecentPaymentsUseCase } from '@modules/client-portal/application/use-cases/ListPortalRecentPaymentsUseCase';
import { ListPortalStatementsOfAccountUseCase } from '@modules/client-portal/application/use-cases/ListPortalStatementsOfAccountUseCase';
import { DownloadPortalStatementOfAccountUseCase } from '@modules/client-portal/application/use-cases/DownloadPortalStatementOfAccountUseCase';
import { GetPortalAssignedLoanOfficerUseCase } from '@modules/client-portal/application/use-cases/GetPortalAssignedLoanOfficerUseCase';
import { GetBorrowerUseCase } from '@modules/borrower/application/use-cases/GetBorrowerUseCase';
import { ListBorrowersUseCase } from '@modules/borrower/application/use-cases/ListBorrowersUseCase';
import { UpdateBorrowerUseCase } from '@modules/borrower/application/use-cases/UpdateBorrowerUseCase';
import { createPsgcRouter } from '@modules/psgc/interface/http/psgcRouter';
import { ListPsgcOptionsUseCase } from '@modules/psgc/application/use-cases/ListPsgcOptionsUseCase';
import { PrismaPsgcRepository } from '@modules/psgc/infrastructure/PrismaPsgcRepository';
import { CreateCoBorrowerUseCase } from '@modules/borrower/application/use-cases/CreateCoBorrowerUseCase';
import { UpdateCoBorrowerUseCase } from '@modules/borrower/application/use-cases/UpdateCoBorrowerUseCase';
import { GetCoBorrowerUseCase } from '@modules/borrower/application/use-cases/GetCoBorrowerUseCase';
import { ListCoBorrowersUseCase } from '@modules/borrower/application/use-cases/ListCoBorrowersUseCase';
import { GetBorrowerRiskSummaryUseCase } from '@modules/borrower/application/use-cases/GetBorrowerRiskSummaryUseCase';
import { GetBorrowerMitigationDetailsUseCase } from '@modules/borrower/application/use-cases/GetBorrowerMitigationDetailsUseCase';
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
import { ManualPaymentAdjustmentUseCase } from '@modules/loan-account/application/use-cases/ManualPaymentAdjustmentUseCase';
import { GetLoanRiskAssessmentUseCase } from '@modules/loan-account/application/use-cases/GetLoanRiskAssessmentUseCase';
import { RestructureLoanUseCase } from '@modules/loan-account/application/use-cases/RestructureLoanUseCase';
import { UndoRestructureLoanUseCase } from '@modules/loan-account/application/use-cases/UndoRestructureLoanUseCase';
import { CompromiseSettleLoanUseCase } from '@modules/loan-account/application/use-cases/CompromiseSettleLoanUseCase';
import { GetLoanCompromiseSettlementUseCase } from '@modules/loan-account/application/use-cases/GetLoanCompromiseSettlementUseCase';
import { UndoAdjustLoanUseCase } from '@modules/loan-account/application/use-cases/UndoAdjustLoanUseCase';
import { GetLoanRestructureUseCase } from '@modules/loan-account/application/use-cases/GetLoanRestructureUseCase';
import { AdjustLoanUseCase } from '@modules/loan-account/application/use-cases/AdjustLoanUseCase';
import { GetLoanAdjustmentUseCase } from '@modules/loan-account/application/use-cases/GetLoanAdjustmentUseCase';
import { GetAccruedInterestUseCase } from '@modules/loan-account/application/use-cases/GetAccruedInterestUseCase';
import { LoanRiskAssessmentService } from '@modules/loan-account/application/services/LoanRiskAssessmentService';
import { PrismaLoanAccountRepository } from '@modules/loan-account/infrastructure/PrismaLoanAccountRepository';
import { PrismaLoanRestructureRepository } from '@modules/loan-account/infrastructure/PrismaLoanRestructureRepository';
import { PrismaLoanCompromiseSettlementRepository } from '@modules/loan-account/infrastructure/PrismaLoanCompromiseSettlementRepository';
import { PrismaLoanAdjustmentRepository } from '@modules/loan-account/infrastructure/PrismaLoanAdjustmentRepository';
import { createLedgerRouter } from '@modules/ledger/interface/http/ledgerRouter';
import { ListLoanTransactionsForAccountUseCase } from '@modules/ledger/application/use-cases/ListLoanTransactionsForAccountUseCase';
import { GetLoanTransactionUseCase } from '@modules/ledger/application/use-cases/GetLoanTransactionUseCase';
import { ListPaymentAllocationsForTransactionUseCase } from '@modules/ledger/application/use-cases/ListPaymentAllocationsForTransactionUseCase';
import { PrismaLoanTransactionRepository } from '@modules/ledger/infrastructure/PrismaLoanTransactionRepository';
import { PrismaPaymentAllocationRepository } from '@modules/ledger/infrastructure/PrismaPaymentAllocationRepository';
import { PrismaPaymentAdjustmentRepository } from '@modules/ledger/infrastructure/PrismaPaymentAdjustmentRepository';
import { createNotificationRouter } from '@modules/notification/interface/http/notificationRouter';
import { NotificationService } from '@modules/notification/application/NotificationService';
import { ListNotificationsUseCase } from '@modules/notification/application/use-cases/ListNotificationsUseCase';
import { MarkNotificationReadUseCase } from '@modules/notification/application/use-cases/MarkNotificationReadUseCase';
import { MarkAllNotificationsReadUseCase } from '@modules/notification/application/use-cases/MarkAllNotificationsReadUseCase';
import { PrismaNotificationRepository } from '@modules/notification/infrastructure/PrismaNotificationRepository';
import { createRepaymentRouter } from '@modules/repayment/interface/http/repaymentRouter';
import { ListRepaymentInstallmentsForLoanUseCase } from '@modules/repayment/application/use-cases/ListRepaymentInstallmentsForLoanUseCase';
import { GetRepaymentInstallmentUseCase } from '@modules/repayment/application/use-cases/GetRepaymentInstallmentUseCase';
import { PrismaRepaymentInstallmentRepository } from '@modules/repayment/infrastructure/PrismaRepaymentInstallmentRepository';
import { PrismaPenaltyReductionRepository } from '@modules/repayment/infrastructure/PrismaPenaltyReductionRepository';
import { PrismaFeeAdjustmentRepository } from '@modules/repayment/infrastructure/PrismaFeeAdjustmentRepository';
import { PrismaFeeChargeRepository } from '@modules/repayment/infrastructure/PrismaFeeChargeRepository';
import { PrismaPenaltyChargeRepository } from '@modules/repayment/infrastructure/PrismaPenaltyChargeRepository';
import { ReducePenaltyUseCase } from '@modules/repayment/application/use-cases/ReducePenaltyUseCase';
import { AdjustFeesUseCase } from '@modules/repayment/application/use-cases/AdjustFeesUseCase';
import { AddFeeUseCase } from '@modules/repayment/application/use-cases/AddFeeUseCase';
import { AddPenaltyUseCase } from '@modules/repayment/application/use-cases/AddPenaltyUseCase';
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
import { RevertLoanApplicationToPreApprovalUseCase } from '@modules/loan-application/application/use-cases/RevertLoanApplicationToPreApprovalUseCase';
import { DeleteLoanApplicationUseCase } from '@modules/loan-application/application/use-cases/DeleteLoanApplicationUseCase';
import { GenerateLoanApplicationFormUseCase } from '@modules/loan-application/application/use-cases/GenerateLoanApplicationFormUseCase';
import { GenerateCrmReportUseCase } from '@modules/loan-application/application/use-cases/GenerateCrmReportUseCase';
import { GetLoanApplicationRiskSummaryUseCase } from '@modules/loan-application/application/use-cases/GetLoanApplicationRiskSummaryUseCase';
import { StartLoanApplicationReviewUseCase } from '@modules/loan-application/application/use-cases/StartLoanApplicationReviewUseCase';
import { SubmitLoanApplicationReviewReportUseCase } from '@modules/loan-application/application/use-cases/SubmitLoanApplicationReviewReportUseCase';
import { SetMitigationAccountOwnerUseCase } from '@modules/loan-application/application/use-cases/SetMitigationAccountOwnerUseCase';
import { SetMitigationDetailsUseCase } from '@modules/loan-application/application/use-cases/SetMitigationDetailsUseCase';
import { GenerateAiDocumentReviewUseCase } from '@modules/loan-application/application/use-cases/GenerateAiDocumentReviewUseCase';
import { TagLoanApplicationPreApprovalUseCase } from '@modules/loan-application/application/use-cases/TagLoanApplicationPreApprovalUseCase';
import { UndoLoanApplicationPreApprovalUseCase } from '@modules/loan-application/application/use-cases/UndoLoanApplicationPreApprovalUseCase';
import { UpdateLoanApplicationUseCase } from '@modules/loan-application/application/use-cases/UpdateLoanApplicationUseCase';
import { UpdateLoanApplicationIntakeUseCase } from '@modules/loan-application/application/use-cases/UpdateLoanApplicationIntakeUseCase';
import { UpdateLoanApplicationSelfServiceUseCase } from '@modules/loan-application/application/use-cases/UpdateLoanApplicationSelfServiceUseCase';
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
import { DownloadAllBorrowerDocumentsUseCase } from '@modules/document/application/use-cases/DownloadAllBorrowerDocumentsUseCase';
import { PrismaBulkExportJobRepository } from '@modules/bulk-export/infrastructure/PrismaBulkExportJobRepository';
import { ProcessBulkExportJobUseCase } from '@modules/bulk-export/application/use-cases/ProcessBulkExportJobUseCase';
import { CreateBulkExportJobUseCase } from '@modules/bulk-export/application/use-cases/CreateBulkExportJobUseCase';
import { ListMyBulkExportJobsUseCase } from '@modules/bulk-export/application/use-cases/ListMyBulkExportJobsUseCase';
import { DownloadBulkExportJobUseCase } from '@modules/bulk-export/application/use-cases/DownloadBulkExportJobUseCase';
import { GetBulkExportDefaultRangeUseCase } from '@modules/bulk-export/application/use-cases/GetBulkExportDefaultRangeUseCase';
import { CancelBulkExportJobUseCase } from '@modules/bulk-export/application/use-cases/CancelBulkExportJobUseCase';
import { BulkExportCancellationRegistry } from '@modules/bulk-export/infrastructure/BulkExportCancellationRegistry';
import { createBulkExportRouter } from '@modules/bulk-export/interface/http/bulkExportRouter';
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
import { DeleteRoleClassUseCase } from '@modules/role-class/application/use-cases/DeleteRoleClassUseCase';
import { createAccessControlRouter } from '@modules/access-control/interface/http/AccessControlRouter';
import { AccessControlController } from '@modules/access-control/interface/http/AccessControlController';
import { PrismaAccessControlRepository } from '@modules/access-control/infrastructure/PrismaAccessControlRepository';
import { ListRolesAndPermissionsUseCase } from '@modules/access-control/application/use-cases/ListRolesAndPermissionsUseCase';
import { UpdateRolePermissionsUseCase } from '@modules/access-control/application/use-cases/UpdateRolePermissionsUseCase';
import { createProductTypeLabelRouter } from '@modules/product-type-label/interface/http/ProductTypeLabelRouter';
import { ProductTypeLabelController } from '@modules/product-type-label/interface/http/ProductTypeLabelController';
import { ListProductTypeLabelsUseCase } from '@modules/product-type-label/application/use-cases/ListProductTypeLabelsUseCase';
import { UpdateProductTypeLabelUseCase } from '@modules/product-type-label/application/use-cases/UpdateProductTypeLabelUseCase';
import { PrismaProductTypeLabelRepository } from '@modules/product-type-label/infrastructure/PrismaProductTypeLabelRepository';
import { PrismaRoleClassRepository } from '@modules/role-class/infrastructure/PrismaRoleClassRepository';
import { ListUsersUseCase } from '@modules/identity/application/use-cases/ListUsersUseCase';
import { CreateUserUseCase } from '@modules/identity/application/use-cases/CreateUserUseCase';
import { UpdateUserUseCase } from '@modules/identity/application/use-cases/UpdateUserUseCase';
import { UpdateOwnProfileUseCase } from '@modules/identity/application/use-cases/UpdateOwnProfileUseCase';
import { ChangeOwnPasswordUseCase } from '@modules/identity/application/use-cases/ChangeOwnPasswordUseCase';
import { createPaymentReminderRouter } from '@modules/payment-reminder/interface/http/paymentReminderRouter';
import { ListPaymentRemindersUseCase } from '@modules/payment-reminder/application/use-cases/ListPaymentRemindersUseCase';
import { PrismaPaymentReminderRepository } from '@modules/payment-reminder/infrastructure/PrismaPaymentReminderRepository';
import { createSmsReminderDlrRouter } from '@modules/sms-reminder/interface/http/smsReminderDlrRouter';
import { createSmsReminderLogRouter } from '@modules/sms-reminder/interface/http/smsReminderLogRouter';
import { ListSmsReminderLogsUseCase } from '@modules/sms-reminder/application/use-cases/ListSmsReminderLogsUseCase';
import { PrismaSmsReminderRepository } from '@modules/sms-reminder/infrastructure/PrismaSmsReminderRepository';
import { createEmailReminderLogRouter } from '@modules/email-reminder/interface/http/emailReminderLogRouter';
import { ListEmailReminderLogsUseCase } from '@modules/email-reminder/application/use-cases/ListEmailReminderLogsUseCase';
import { PrismaEmailReminderRepository } from '@modules/email-reminder/infrastructure/PrismaEmailReminderRepository';
import { createReminderSettingsRouter } from '@modules/reminder-settings/interface/http/reminderSettingsRouter';
import { createSystemAnnouncementRouter } from '@modules/system-announcement/interface/http/systemAnnouncementRouter';
import { createPublicAnnouncementRouter } from '@modules/system-announcement/interface/http/publicAnnouncementRouter';
import { CreateSystemAnnouncementUseCase } from '@modules/system-announcement/application/use-cases/CreateSystemAnnouncementUseCase';
import { ListSystemAnnouncementsUseCase } from '@modules/system-announcement/application/use-cases/ListSystemAnnouncementsUseCase';
import { UpdateSystemAnnouncementUseCase } from '@modules/system-announcement/application/use-cases/UpdateSystemAnnouncementUseCase';
import { DeleteSystemAnnouncementUseCase } from '@modules/system-announcement/application/use-cases/DeleteSystemAnnouncementUseCase';
import { GetActiveSystemAnnouncementUseCase } from '@modules/system-announcement/application/use-cases/GetActiveSystemAnnouncementUseCase';
import { PrismaSystemAnnouncementRepository } from '@modules/system-announcement/infrastructure/PrismaSystemAnnouncementRepository';
import { createMisPostRouter } from '@modules/mis-post/interface/http/misPostRouter';
import { createPublicMisPostRouter } from '@modules/mis-post/interface/http/publicMisPostRouter';
import { CreateManualMisPostUseCase } from '@modules/mis-post/application/use-cases/CreateManualMisPostUseCase';
import { WithdrawManualMisPostUseCase } from '@modules/mis-post/application/use-cases/WithdrawManualMisPostUseCase';
import { ListMisPostsForAdminUseCase } from '@modules/mis-post/application/use-cases/ListMisPostsForAdminUseCase';
import { GetActivePortalPostsUseCase } from '@modules/mis-post/application/use-cases/GetActivePortalPostsUseCase';
import { GetMisPostImageUseCase } from '@modules/mis-post/application/use-cases/GetMisPostImageUseCase';
import { PrismaMisPostRepository } from '@modules/mis-post/infrastructure/PrismaMisPostRepository';
import { GetReminderSettingsUseCase } from '@modules/reminder-settings/application/use-cases/GetReminderSettingsUseCase';
import { UpdateReminderSettingsUseCase } from '@modules/reminder-settings/application/use-cases/UpdateReminderSettingsUseCase';
import { PrismaReminderSettingsRepository } from '@modules/reminder-settings/infrastructure/PrismaReminderSettingsRepository';
import { createSecuritySettingsRouter } from '@modules/security-settings/interface/http/securitySettingsRouter';
import { GetSecuritySettingsUseCase } from '@modules/security-settings/application/use-cases/GetSecuritySettingsUseCase';
import { UpdateSecuritySettingsUseCase } from '@modules/security-settings/application/use-cases/UpdateSecuritySettingsUseCase';
import { PrismaSecuritySettingsRepository } from '@modules/security-settings/infrastructure/PrismaSecuritySettingsRepository';
import { createInterestRateChartRouter } from '@modules/interest-rate-chart/interface/http/interestRateChartRouter';
import { ListInterestRateChartUseCase } from '@modules/interest-rate-chart/application/use-cases/ListInterestRateChartUseCase';
import { PrismaInterestRateChartRepository } from '@modules/interest-rate-chart/infrastructure/PrismaInterestRateChartRepository';
import { createReportingRouter } from '@modules/reporting/interface/http/reportingRouter';
import { GetLoanOriginationReportUseCase } from '@modules/reporting/application/use-cases/GetLoanOriginationReportUseCase';
import { GetCollectionReportUseCase } from '@modules/reporting/application/use-cases/GetCollectionReportUseCase';
import { ListReportTransactionsUseCase } from '@modules/reporting/application/use-cases/ListReportTransactionsUseCase';
import { GetLoanReleasesReportUseCase } from '@modules/reporting/application/use-cases/GetLoanReleasesReportUseCase';
import { GetCicMonthlyReportUseCase } from '@modules/reporting/application/use-cases/GetCicMonthlyReportUseCase';
import { CicCsdfReportWriter } from '@modules/reporting/infrastructure/CicCsdfReportWriter';
import { CicExcelReportWriter } from '@modules/reporting/infrastructure/CicExcelReportWriter';
import { GetAgingReportUseCase } from '@modules/reporting/application/use-cases/GetAgingReportUseCase';
import { GetEndingBalanceReportUseCase } from '@modules/reporting/application/use-cases/GetEndingBalanceReportUseCase';
import { GetAccountsWithPastDueReportUseCase } from '@modules/reporting/application/use-cases/GetAccountsWithPastDueReportUseCase';
import { GetCollectionHistoryReportUseCase } from '@modules/reporting/application/use-cases/GetCollectionHistoryReportUseCase';
import { GetExpectedCollectionReportUseCase } from '@modules/reporting/application/use-cases/GetExpectedCollectionReportUseCase';
import { GetFirstAmortizationReportUseCase } from '@modules/reporting/application/use-cases/GetFirstAmortizationReportUseCase';
import { GetDailyCollectionReportUseCase } from '@modules/reporting/application/use-cases/GetDailyCollectionReportUseCase';
import { ListDistinctChannelsUseCase } from '@modules/reporting/application/use-cases/ListDistinctChannelsUseCase';
import { GetFullyPaidAccountsReportUseCase } from '@modules/reporting/application/use-cases/GetFullyPaidAccountsReportUseCase';
import { GetPortalAccountsReportUseCase } from '@modules/reporting/application/use-cases/GetPortalAccountsReportUseCase';
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
import { DownloadAllLoanAccountDocumentsUseCase } from '@modules/loan-document/application/use-cases/DownloadAllLoanAccountDocumentsUseCase';
import { createDocumentTemplateAdminRouter } from '@modules/loan-document/interface/http/documentTemplateAdminRouter';
import { ListDocumentTemplatesForAdminUseCase } from '@modules/loan-document/application/use-cases/ListDocumentTemplatesForAdminUseCase';
import { UpdateDocumentTemplateRequiredUseCase } from '@modules/loan-document/application/use-cases/UpdateDocumentTemplateRequiredUseCase';
import { SetDocumentTemplateProductMappingsUseCase } from '@modules/loan-document/application/use-cases/SetDocumentTemplateProductMappingsUseCase';
import { UpdateDocumentTemplateSignatureRequirementsUseCase } from '@modules/loan-document/application/use-cases/UpdateDocumentTemplateSignatureRequirementsUseCase';
import { PrismaDocumentTemplateRepository } from '@modules/loan-document/infrastructure/PrismaDocumentTemplateRepository';
import { PrismaGeneratedLoanDocumentRepository } from '@modules/loan-document/infrastructure/PrismaGeneratedLoanDocumentRepository';
import { LoanDocumentMergeDataResolver } from '@modules/loan-document/infrastructure/LoanDocumentMergeDataResolver';
import { DocxtemplaterDocumentFiller } from '@modules/loan-document/infrastructure/DocxtemplaterDocumentFiller';
import { LibreOfficeDocxToPdfConverter } from '@modules/loan-document/infrastructure/LibreOfficeDocxToPdfConverter';
import { createLoanSigningRouter } from '@modules/loan-signing/interface/http/loanSigningRouter';
import { createPublicLoanSigningRouter } from '@modules/loan-signing/interface/http/publicLoanSigningRouter';
import { CreateLoanSigningSessionUseCase } from '@modules/loan-signing/application/use-cases/CreateLoanSigningSessionUseCase';
import { ListLoanSigningSessionsUseCase } from '@modules/loan-signing/application/use-cases/ListLoanSigningSessionsUseCase';
import { RequestSigningOtpUseCase } from '@modules/loan-signing/application/use-cases/RequestSigningOtpUseCase';
import { VerifySigningOtpUseCase } from '@modules/loan-signing/application/use-cases/VerifySigningOtpUseCase';
import { GetLoanSigningSessionUseCase } from '@modules/loan-signing/application/use-cases/GetLoanSigningSessionUseCase';
import { GetLoanSigningDocumentFileUseCase } from '@modules/loan-signing/application/use-cases/GetLoanSigningDocumentFileUseCase';
import { GetSignedLoanSigningDocumentFileUseCase } from '@modules/loan-signing/application/use-cases/GetSignedLoanSigningDocumentFileUseCase';
import { SignLoanSigningDocumentUseCase } from '@modules/loan-signing/application/use-cases/SignLoanSigningDocumentUseCase';
import { createPortalLoanSigningRouter } from '@modules/loan-signing/interface/http/portalLoanSigningRouter';
import { ListPortalSigningSessionsUseCase } from '@modules/loan-signing/application/use-cases/portal/ListPortalSigningSessionsUseCase';
import { GetPortalSigningSessionUseCase } from '@modules/loan-signing/application/use-cases/portal/GetPortalSigningSessionUseCase';
import { RequestPortalSigningOtpUseCase } from '@modules/loan-signing/application/use-cases/portal/RequestPortalSigningOtpUseCase';
import { VerifyPortalSigningOtpUseCase } from '@modules/loan-signing/application/use-cases/portal/VerifyPortalSigningOtpUseCase';
import { GetPortalSigningDocumentFileUseCase } from '@modules/loan-signing/application/use-cases/portal/GetPortalSigningDocumentFileUseCase';
import { SignPortalLoanSigningDocumentUseCase } from '@modules/loan-signing/application/use-cases/portal/SignPortalLoanSigningDocumentUseCase';
import { PrismaLoanSigningSessionRepository } from '@modules/loan-signing/infrastructure/PrismaLoanSigningSessionRepository';
import { PrismaSigningNotificationLogRepository } from '@modules/loan-signing/infrastructure/PrismaSigningNotificationLogRepository';
import { ListSigningNotificationLogsUseCase } from '@modules/loan-signing/application/use-cases/ListSigningNotificationLogsUseCase';
import { PdfLibDocumentSignatureStamper } from '@modules/loan-signing/infrastructure/PdfLibDocumentSignatureStamper';
import { DryRunAwareSmsGateway } from '@modules/loan-signing/infrastructure/DryRunAwareSmsGateway';
import { DryRunAwareEmailGateway } from '@modules/loan-signing/infrastructure/DryRunAwareEmailGateway';
import { createStatementOfAccountRouter } from '@modules/statement-of-account/interface/http/statementOfAccountRouter';
import { GenerateStatementOfAccountUseCase } from '@modules/statement-of-account/application/use-cases/GenerateStatementOfAccountUseCase';
import { ListStatementsOfAccountUseCase } from '@modules/statement-of-account/application/use-cases/ListStatementsOfAccountUseCase';
import { GetGeneratedStatementOfAccountFileUseCase } from '@modules/statement-of-account/application/use-cases/GetGeneratedStatementOfAccountFileUseCase';
import { PrismaGeneratedStatementOfAccountRepository } from '@modules/statement-of-account/infrastructure/PrismaGeneratedStatementOfAccountRepository';
import { StatementOfAccountMergeDataResolver } from '@modules/statement-of-account/infrastructure/StatementOfAccountMergeDataResolver';
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
  // Performance (2026-08-06 user request): gzip/brotli-negotiated response compression at the
  // origin - previously left entirely to whatever sits in front (Cloudflare Tunnel), so a direct
  // hit (local dev, internal testing, or if the tunnel is ever bypassed) shipped every JSON/HTML
  // response uncompressed. `compression()`'s default threshold (1kb) already skips tiny responses
  // where the gzip framing overhead isn't worth it.
  app.use(compression());
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
      // 2026-09-02 (user-reported: CIC CSDF download kept using the frontend's stale hardcoded
      // fallback filename instead of the backend's real Content-Disposition header). Browsers only
      // expose the small CORS-safelisted response headers to JS by default (Cache-Control,
      // Content-Language, Content-Type, Expires, Last-Modified, Pragma) - Content-Disposition isn't
      // in that list, so `res.headers.get('content-disposition')` in `downloadFile()`
      // (apiClient.ts) silently returned null on every cross-origin download and always fell back.
      exposedHeaders: ['Content-Disposition'],
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

  // Unauthenticated, same reasoning as /health above - see buildInfo.ts's doc comment for why this
  // exists (cross-machine version drift detection).
  app.get('/api/v1/build-info', (_req, res) => {
    res.json(getBuildInfo());
  });

  // --- identity module wiring (Milestone 6: Authentication) ---
  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService();
  const userRepository = new PrismaUserRepository();
  const refreshTokenRepository = new PrismaRefreshTokenRepository();
  const auditLogger = new PrismaAuditLogger();
  const twoFactorChallengeRepository = new PrismaTwoFactorChallengeRepository();
  const trustedDeviceRepository = new PrismaTrustedDeviceRepository();
  // Settings > Security > Two-Factor Authentication (2026-07-22) - the same M360/SMTP gateways
  // Payment Reminders already uses, gated by the same SMS_ENABLED/EMAIL_ENABLED dry-run flags
  // (see OtpSender's own doc comment) - safe to enable 2FA on any account in every environment.
  //
  // 2026-08-18 (user request): "Your Easycash verification code" now sends from the same dedicated
  // no-reply address as the Portal's and e-signature's OTP mail (SIGNING_OTP_SMTP_FROM_ADDRESS,
  // noreply-verify@easycash.ph by default) instead of the generic collections@ mailbox - a
  // verification code isn't collections/payment-reminder mail, same reasoning that already put
  // PortalOtpSender and the e-signature OTP sender on this address (see their own wiring below).
  const otpSender = new OtpSender({
    smsGateway: new M360SmsGateway({
      apiUrl: env.M360_API_URL,
      username: env.M360_USERNAME ?? '',
      password: env.M360_PASSWORD ?? '',
      shortcodeMask: env.M360_SHORTCODE_MASK ?? '',
    }),
    emailGateway: new NodemailerEmailGateway({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      username: env.SMTP_USERNAME ?? '',
      password: env.SMTP_PASSWORD ?? '',
      fromAddress: env.SIGNING_OTP_SMTP_FROM_ADDRESS,
    }),
    smsEnabled: env.SMS_ENABLED,
    emailEnabled: env.EMAIL_ENABLED,
  });

  // --- notification module wiring (Notification Center, 2026-07-17) - built early, before other
  // modules, since `notificationService` is injected as an optional side-effect dep into several
  // of them below (mirrors `profileActivityLogService`'s own wiring position/pattern) ---
  const notificationRepository = new PrismaNotificationRepository();
  const notificationService = new NotificationService({ notificationRepository, userRepository });

  // Audit finding H-01: env.JWT_REFRESH_TTL_MS (pre-parsed, fail-fast in
  // env.ts) is now actually threaded through, instead of the use cases'
  // internal hardcoded fallback constants silently taking over.
  const permissionCodesRepository = new PrismaPermissionCodesRepository();
  const securitySettingsRepository = new PrismaSecuritySettingsRepository();
  const authRouter = createAuthRouter(
    {
      loginUseCase: new LoginUseCase({
        userRepository,
        passwordHasher,
        tokenService,
        refreshTokenRepository,
        auditLogger,
        twoFactorChallengeRepository,
        trustedDeviceRepository,
        otpSender,
        permissionCodesRepository,
        securitySettingsRepository,
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
      getCurrentUserUseCase: new GetCurrentUserUseCase({ userRepository, permissionCodesRepository, securitySettingsRepository }),
      listSessionsUseCase: new ListSessionsUseCase({ refreshTokenRepository }),
      revokeSessionUseCase: new RevokeSessionUseCase({ refreshTokenRepository }),
      verifyLoginOtpUseCase: new VerifyLoginOtpUseCase({
        userRepository,
        tokenService,
        refreshTokenRepository,
        auditLogger,
        twoFactorChallengeRepository,
        trustedDeviceRepository,
        permissionCodesRepository,
        securitySettingsRepository,
        refreshTokenTtlMs: env.JWT_REFRESH_TTL_MS,
      }),
      requestPasswordResetUseCase: new StaffRequestPasswordResetUseCase({
        userRepository,
        twoFactorChallengeRepository,
        otpSender,
      }),
      confirmPasswordResetUseCase: new StaffConfirmPasswordResetUseCase({
        userRepository,
        twoFactorChallengeRepository,
        passwordHasher,
        auditLogger,
      }),
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
      requestTwoFactorSetupUseCase: new RequestTwoFactorSetupUseCase({ userRepository, twoFactorChallengeRepository, otpSender }),
      confirmTwoFactorSetupUseCase: new ConfirmTwoFactorSetupUseCase({ userRepository, twoFactorChallengeRepository }),
      disableTwoFactorUseCase: new DisableTwoFactorUseCase({ userRepository, passwordHasher }),
      // Member Details > Active Sessions (2026-08-28) - same instances the auth router above
      // already uses for self-service; both use cases are generic over whichever userId they're
      // given, so no new wiring is needed beyond reusing them here.
      listSessionsUseCase: new ListSessionsUseCase({ refreshTokenRepository }),
      revokeSessionUseCase: new RevokeSessionUseCase({ refreshTokenRepository }),
    },
    tokenService,
  );
  app.use('/api/v1', userRouter);

  // --- Easycash Portal module wiring (2026-07-23, Phase 1: auth foundation only) - a fully
  // separate auth realm from the staff identity module above (own JwtPortalTokenService/
  // PORTAL_JWT_SECRET, own PortalAccount/PortalAccountChallenge tables) - only passwordHasher and
  // otpSender are shared, since both are already generic, stateless infrastructure. ---
  // Hoisted above this section's own wiring (2026-08-06, Bind existing Client data to Portal) -
  // VerifySignUpUseCase below needs it for signup auto-bind-by-email, ahead of the borrower
  // module's own wiring section (its canonical home) further down this file.
  const borrowerRepository = new PrismaBorrowerRepository();
  const portalAccountRepository = new PrismaPortalAccountRepository();
  const portalAccountChallengeRepository = new PrismaPortalAccountChallengeRepository();
  const portalTokenService = new JwtPortalTokenService();
  // Easycash Portal Notification Center (2026-07-24, Phase C) - reuses portalAccountRepository
  // above; own smsGateway/emailGateway instances (same pattern as portalOtpSender below) so portal
  // notification delivery never shares a gateway instance with staff-facing notifications. Hoisted
  // up to this earlier section (2026-08-14) so ApproveLoanUseCase's wiring further down (loan
  // account module, "Approve Loan Account" milestone) can use it too - originally lived right
  // before loanApplicationRouter, which is still where its own portal notification usage is wired.
  const portalNotificationRepository = new PrismaPortalNotificationRepository();
  const portalNotificationService = new PortalNotificationService({
    portalNotificationRepository,
    portalAccountRepository,
    reminderSettingsRepository: new PrismaReminderSettingsRepository(),
    smsGateway: new M360SmsGateway({
      apiUrl: env.M360_API_URL,
      username: env.M360_USERNAME ?? '',
      password: env.M360_PASSWORD ?? '',
      shortcodeMask: env.M360_SHORTCODE_MASK ?? '',
    }),
    emailGateway: new NodemailerEmailGateway({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      username: env.SMTP_USERNAME ?? '',
      password: env.SMTP_PASSWORD ?? '',
      fromAddress: env.SMTP_FROM_ADDRESS,
    }),
  });
  // Portal signup/password-reset OTP uses its OWN sender (portalOtpSender), NOT the shared
  // `otpSender` above - gated by the MIS-toggleable portalEmailEnabled/portalSmsEnabled switches
  // (Settings > System > Reminders) instead of the static SMS_ENABLED/EMAIL_ENABLED env vars, so
  // enabling real portal OTP delivery never also flips on staff 2FA delivery. See
  // PortalOtpSender's own doc comment.
  const portalOtpSender = new PortalOtpSender({
    smsGateway: new M360SmsGateway({
      apiUrl: env.M360_API_URL,
      username: env.M360_USERNAME ?? '',
      password: env.M360_PASSWORD ?? '',
      shortcodeMask: env.M360_SHORTCODE_MASK ?? '',
    }),
    // 2026-07-30 (user request): Portal verification emails (signup, login OTP, etc.) send from
    // this dedicated no-reply address, not the generic collections@ mailbox - same address/env var
    // Nomer's e-signature OTP already uses (SIGNING_OTP_SMTP_FROM_ADDRESS), since both are "here's
    // your code" mail with the same intent.
    emailGateway: new NodemailerEmailGateway({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      username: env.SMTP_USERNAME ?? '',
      password: env.SMTP_PASSWORD ?? '',
      fromAddress: env.SIGNING_OTP_SMTP_FROM_ADDRESS,
    }),
    reminderSettingsRepository: new PrismaReminderSettingsRepository(),
  });
  const portalTrustedDeviceRepository = new PrismaPortalTrustedDeviceRepository();
  const portalAuthRouter = createPortalAuthRouter(
    {
      signUpUseCase: new SignUpUseCase({ portalAccountRepository, portalAccountChallengeRepository, passwordHasher, otpSender: portalOtpSender }),
      verifySignUpUseCase: new VerifySignUpUseCase({ portalAccountRepository, portalAccountChallengeRepository, borrowerRepository, auditLogger }),
      resendSignUpOtpUseCase: new ResendSignUpOtpUseCase({ portalAccountRepository, portalAccountChallengeRepository, otpSender: portalOtpSender }),
      portalLoginUseCase: new PortalLoginUseCase({
        portalAccountRepository,
        passwordHasher,
        portalTokenService,
        portalAccountChallengeRepository,
        portalTrustedDeviceRepository,
        otpSender: portalOtpSender,
      }),
      verifyPortalLoginOtpUseCase: new VerifyPortalLoginOtpUseCase({
        portalAccountRepository,
        portalAccountChallengeRepository,
        portalTrustedDeviceRepository,
        portalTokenService,
      }),
      resendPortalLoginOtpUseCase: new ResendPortalLoginOtpUseCase({ portalAccountRepository, portalAccountChallengeRepository, otpSender: portalOtpSender }),
      requestPasswordResetUseCase: new RequestPasswordResetUseCase({ portalAccountRepository, portalAccountChallengeRepository, otpSender: portalOtpSender }),
      confirmPasswordResetUseCase: new ConfirmPasswordResetUseCase({ portalAccountRepository, portalAccountChallengeRepository, passwordHasher }),
      getPortalAccountUseCase: new GetPortalAccountUseCase({ portalAccountRepository }),
    },
    portalTokenService,
  );
  app.use('/api/v1/portal', portalAuthRouter);

  // --- role-class module wiring: organizational job-title labels under a Role (Administration > Member Details > Roles tab) ---
  const roleClassRepository = new PrismaRoleClassRepository();
  const roleClassController = new RoleClassController({
    listRoleClassesUseCase: new ListRoleClassesUseCase({ roleClassRepository }),
    createRoleClassUseCase: new CreateRoleClassUseCase({ roleClassRepository, auditLogger }),
    updateRoleClassUseCase: new UpdateRoleClassUseCase({ roleClassRepository, auditLogger }),
    deleteRoleClassUseCase: new DeleteRoleClassUseCase({ roleClassRepository, auditLogger }),
  });
  const roleClassRouter = createRoleClassRouter(roleClassController, tokenService);
  app.use('/api/v1', roleClassRouter);

  // --- access-control module wiring: Roles & Permissions screen (Administration > System, MIS-only) ---
  const accessControlRepository = new PrismaAccessControlRepository();
  const accessControlController = new AccessControlController({
    listRolesAndPermissionsUseCase: new ListRolesAndPermissionsUseCase({ accessControlRepository }),
    updateRolePermissionsUseCase: new UpdateRolePermissionsUseCase({ accessControlRepository, auditLogger }),
  });
  const accessControlRouter = createAccessControlRouter(accessControlController, tokenService);
  app.use('/api/v1', accessControlRouter);

  // --- product-type-label module wiring: renamable display labels for the Loan Products catalog's Product Type groupings ---
  const productTypeLabelRepository = new PrismaProductTypeLabelRepository();
  const productTypeLabelController = new ProductTypeLabelController({
    listProductTypeLabelsUseCase: new ListProductTypeLabelsUseCase({ productTypeLabelRepository }),
    updateProductTypeLabelUseCase: new UpdateProductTypeLabelUseCase({ productTypeLabelRepository, auditLogger }),
  });
  const productTypeLabelRouter = createProductTypeLabelRouter(productTypeLabelController, tokenService);
  app.use('/api/v1', productTypeLabelRouter);

  // --- profile-activity module wiring: ADR-050 — track loan officer actions on profiles ---
  // Instantiated here early so it can be injected into borrower, loan-account, and loan-application use cases.
  const profileActivityLogRepository = new PrismaProfileActivityLogRepository();
  const profileActivityLogService = new ProfileActivityLogService(profileActivityLogRepository);

  // --- borrower module wiring (Milestone 8: HTTP API layer) ---
  // borrowerRepository is hoisted above the Easycash Portal wiring section - see that section's own
  // comment for why.
  const coBorrowerRepository = new PrismaCoBorrowerRepository();
  // Hoisted above the loan-account module's own wiring section below (their canonical home) since
  // the borrower risk-summary use case, wired here, needs them too — same instances, not duplicated.
  const loanAccountRepositoryForBorrowerRisk = new PrismaLoanAccountRepository();
  const repaymentInstallmentRepositoryForBorrowerRisk = new PrismaRepaymentInstallmentRepository();
  const borrowerRiskSummaryService = new BorrowerRiskSummaryService(new LoanRiskAssessmentService());
  const borrowerRouter = createBorrowerRouter(
    {
      createBorrowerUseCase: new CreateBorrowerUseCase({
        borrowerRepository,
        profileActivityLogService,
        // Phase D (2026-07-24): links the source application's PortalAccount to the new Borrower,
        // if any - see CreateBorrowerUseCase's own doc comment. A fresh repository instance is
        // fine here (stateless Prisma wrapper, same pattern used for reminderSettingsRepository
        // elsewhere in this file) since loanApplicationRepository itself isn't declared until
        // further down this file.
        loanApplicationRepository: new PrismaLoanApplicationRepository(),
        portalAccountRepository,
      }),
      getBorrowerUseCase: new GetBorrowerUseCase({ borrowerRepository }),
      listBorrowersUseCase: new ListBorrowersUseCase({ borrowerRepository }),
      updateBorrowerUseCase: new UpdateBorrowerUseCase({ borrowerRepository, profileActivityLogService }),
      createCoBorrowerUseCase: new CreateCoBorrowerUseCase({ coBorrowerRepository, auditLogger }),
      getCoBorrowerUseCase: new GetCoBorrowerUseCase({ coBorrowerRepository }),
      listCoBorrowersUseCase: new ListCoBorrowersUseCase({ coBorrowerRepository }),
      updateCoBorrowerUseCase: new UpdateCoBorrowerUseCase({ coBorrowerRepository, auditLogger }),
      getBorrowerRiskSummaryUseCase: new GetBorrowerRiskSummaryUseCase({
        borrowerRepository,
        loanAccountRepository: loanAccountRepositoryForBorrowerRisk,
        repaymentInstallmentRepository: repaymentInstallmentRepositoryForBorrowerRisk,
        riskSummaryService: borrowerRiskSummaryService,
      }),
      // Client Profile "Bank / ATM details" view (2026-08-13) - loanApplicationRepository fresh
      // instance for the same reason as CreateBorrowerUseCase's own above (not declared yet at this
      // point in the file).
      getBorrowerMitigationDetailsUseCase: new GetBorrowerMitigationDetailsUseCase({
        borrowerRepository,
        loanApplicationRepository: new PrismaLoanApplicationRepository(),
      }),
      // Bind existing Client data to Portal (2026-08-06) - reuses the same portalAccountRepository/
      // passwordHasher instances as the Easycash Portal module above.
      getBorrowerPortalAccountStatusUseCase: new GetBorrowerPortalAccountStatusUseCase({ borrowerRepository, portalAccountRepository }),
      createPortalAccountForBorrowerUseCase: new CreatePortalAccountForBorrowerUseCase({
        borrowerRepository,
        portalAccountRepository,
        passwordHasher,
        profileActivityLogService,
      }),
      resetPortalAccountPasswordUseCase: new ResetPortalAccountPasswordUseCase({
        borrowerRepository,
        portalAccountRepository,
        passwordHasher,
        profileActivityLogService,
      }),
      bindPortalAccountToBorrowerUseCase: new BindPortalAccountToBorrowerUseCase({ borrowerRepository, portalAccountRepository, profileActivityLogService }),
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
  // 2026-08-14 (Manual Payment Adjustment feature): shared by ManualPaymentAdjustmentUseCase below,
  // same "declared once, alongside its sibling" reasoning as paymentAllocationRepository above.
  const paymentAdjustmentRepository = new PrismaPaymentAdjustmentRepository();
  const loanRiskAssessmentService = new LoanRiskAssessmentService();
  // 2026-07-24 (Loan Restructure feature)
  const loanRestructureRepository = new PrismaLoanRestructureRepository();
  // 2026-07-24 (Loan Adjustment feature)
  const loanAdjustmentRepository = new PrismaLoanAdjustmentRepository();
  // 2026-08-29 (Compromise Settlement feature)
  const loanCompromiseSettlementRepository = new PrismaLoanCompromiseSettlementRepository();
  const loanAccountRouter = createLoanAccountRouter(
    {
      createLoanAccountUseCase: new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository }),
      updateLoanAccountUseCase: new UpdateLoanAccountUseCase({ loanAccountRepository, loanProductRepository }),
      getLoanAccountUseCase,
      listLoanAccountsUseCase: new ListLoanAccountsUseCase({ loanAccountRepository }),
      listMaturedLoanAccountIdsUseCase: new ListMaturedLoanAccountIdsUseCase({ loanAccountRepository }),
      approveLoanUseCase: new ApproveLoanUseCase({
        loanAccountRepository,
        financialAuditLogger,
        unitOfWork,
        profileActivityLogService,
        portalAccountRepository,
        portalNotificationService,
        userRepository,
      }),
      undoApproveLoanUseCase: new UndoApproveLoanUseCase({ loanAccountRepository, financialAuditLogger, unitOfWork, profileActivityLogService }),
      rejectLoanUseCase: new RejectLoanUseCase({
        loanAccountRepository,
        financialAuditLogger,
        unitOfWork,
        profileActivityLogService,
        portalAccountRepository,
        portalNotificationService,
        userRepository,
      }),
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
        portalAccountRepository,
        portalNotificationService,
        userRepository,
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
        notificationService,
        borrowerRepository,
      }),
      reversePaymentUseCase: new ReversePaymentUseCase({
        loanAccountRepository,
        repaymentInstallmentRepository,
        loanTransactionRepository,
        paymentAllocationRepository,
        financialAuditLogger,
        unitOfWork,
      }),
      manualPaymentAdjustmentUseCase: new ManualPaymentAdjustmentUseCase({
        loanAccountRepository,
        repaymentInstallmentRepository,
        loanTransactionRepository,
        paymentAllocationRepository,
        paymentAdjustmentRepository,
        financialAuditLogger,
        unitOfWork,
      }),
      getLoanRiskAssessmentUseCase: new GetLoanRiskAssessmentUseCase({
        loanAccountRepository,
        repaymentInstallmentRepository,
        riskAssessmentService: loanRiskAssessmentService,
      }),
      // 2026-07-24 (Loan Restructure feature, user-confirmed): local repository instance here,
      // same "cheap, stateless, fine to construct locally" precedent as
      // undoActivateLoanUseCase's penaltyReductionRepository/feeAdjustmentRepository above.
      restructureLoanUseCase: new RestructureLoanUseCase({
        loanAccountRepository,
        loanProductRepository,
        repaymentInstallmentRepository,
        loanTransactionRepository,
        loanRestructureRepository,
        financialAuditLogger,
        unitOfWork,
        profileActivityLogService,
        notificationService,
        borrowerRepository,
      }),
      getLoanRestructureUseCase: new GetLoanRestructureUseCase({ loanRestructureRepository }),
      // 2026-08-07 (Undo Restructure feature, user-confirmed): same local-repository-instance
      // precedent as undoActivateLoanUseCase above.
      undoRestructureLoanUseCase: new UndoRestructureLoanUseCase({
        loanAccountRepository,
        loanRestructureRepository,
        loanTransactionRepository,
        repaymentInstallmentRepository,
        penaltyReductionRepository: new PrismaPenaltyReductionRepository(),
        feeAdjustmentRepository: new PrismaFeeAdjustmentRepository(),
        financialAuditLogger,
        unitOfWork,
        profileActivityLogService,
      }),
      // 2026-07-24 (Loan Adjustment feature, user-confirmed): same local-repository-instance
      // precedent as restructureLoanUseCase above.
      adjustLoanUseCase: new AdjustLoanUseCase({
        loanAccountRepository,
        loanProductRepository,
        repaymentInstallmentRepository,
        loanTransactionRepository,
        loanAdjustmentRepository,
        financialAuditLogger,
        unitOfWork,
        profileActivityLogService,
        notificationService,
        borrowerRepository,
      }),
      getLoanAdjustmentUseCase: new GetLoanAdjustmentUseCase({ loanAdjustmentRepository }),
      // 2026-08-07 (Undo Adjustment feature, user-confirmed): same local-repository-instance
      // precedent as undoRestructureLoanUseCase above.
      undoAdjustLoanUseCase: new UndoAdjustLoanUseCase({
        loanAccountRepository,
        loanAdjustmentRepository,
        loanTransactionRepository,
        repaymentInstallmentRepository,
        penaltyReductionRepository: new PrismaPenaltyReductionRepository(),
        feeAdjustmentRepository: new PrismaFeeAdjustmentRepository(),
        financialAuditLogger,
        unitOfWork,
        profileActivityLogService,
      }),
      getAccruedInterestUseCase: new GetAccruedInterestUseCase({ loanAccountRepository, repaymentInstallmentRepository, loanProductRepository }),
      // 2026-08-29 (Compromise Settlement feature, user-confirmed): same local-repository-instance
      // precedent as restructureLoanUseCase above.
      compromiseSettleLoanUseCase: new CompromiseSettleLoanUseCase({
        loanAccountRepository,
        loanProductRepository,
        repaymentInstallmentRepository,
        loanTransactionRepository,
        loanCompromiseSettlementRepository,
        financialAuditLogger,
        unitOfWork,
        profileActivityLogService,
        notificationService,
        borrowerRepository,
      }),
      getLoanCompromiseSettlementUseCase: new GetLoanCompromiseSettlementUseCase({ loanCompromiseSettlementRepository }),
      idempotencyKeyStore,
    },
    tokenService,
  );
  app.use('/api/v1', loanAccountRouter);

  // --- notification module wiring (Notification Center, 2026-07-17) ---
  const notificationRouter = createNotificationRouter(
    {
      listNotificationsUseCase: new ListNotificationsUseCase({ notificationRepository }),
      markNotificationReadUseCase: new MarkNotificationReadUseCase({ notificationRepository }),
      markAllNotificationsReadUseCase: new MarkAllNotificationsReadUseCase({ notificationRepository }),
    },
    tokenService,
  );
  app.use('/api/v1', notificationRouter);

  // --- loan-document module wiring (ADR-051, 2026-07-12: Loan Document Generation) ---
  const documentTemplateRepository = new PrismaDocumentTemplateRepository();
  const generatedLoanDocumentRepository = new PrismaGeneratedLoanDocumentRepository();
  // STORAGE_DRIVER=s3 is declared in env validation (ADR-051 §4's storage abstraction) but has no
  // implementation yet — fail fast rather than silently falling back to local.
  if (env.STORAGE_DRIVER !== 'local') {
    throw new Error(`STORAGE_DRIVER=${env.STORAGE_DRIVER} has no implementation yet — only "local" is supported.`);
  }
  const loanDocumentFileStorage = new SharedLocalFileStorage(env.STORAGE_LOCAL_PATH);
  // 2026-08-09 (Quit Claim auto-fill, user request): local instance since loanApplicationRepository
  // itself isn't declared until later in this file (loan-application module wiring) - same
  // "dedicated local repository instance" precedent used elsewhere in this file.
  const mergeDataResolver = new LoanDocumentMergeDataResolver({
    loanAccountRepository,
    borrowerRepository,
    coBorrowerRepository,
    loanProductRepository,
    repaymentInstallmentRepository,
    loanApplicationRepository: new PrismaLoanApplicationRepository(),
    prisma,
  });
  const documentFiller = new DocxtemplaterDocumentFiller();
  const docxToPdfConverter = new LibreOfficeDocxToPdfConverter(env.LIBREOFFICE_BINARY_PATH);
  // 2026-08-20 (MIS bulk-document-download, user request): dedicated local instances, since
  // attachmentRepository/loanSigningSessionRepository proper aren't declared until later in this
  // file (same "dedicated local repository instance" precedent as the Quit Claim mergeDataResolver
  // just above).
  const downloadAllLoanAccountDocumentsUseCase = new DownloadAllLoanAccountDocumentsUseCase({
    loanAccountRepository,
    attachmentRepository: new PrismaAttachmentRepository(),
    generatedLoanDocumentRepository,
    documentTemplateRepository,
    loanSigningSessionRepository: new PrismaLoanSigningSessionRepository(),
    attachmentFileStorage: new LocalFileStorage(),
    loanDocumentFileStorage,
  });
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
      downloadAllLoanAccountDocumentsUseCase,
      getLoanAccountUseCase,
      idempotencyKeyStore,
    },
    tokenService,
  );
  app.use('/api/v1', loanDocumentRouter);

  // 2026-08-09 (Document Templates admin config, user request): lets MIS configure required/
  // conditional status and per-product mapping without a developer re-editing prisma/seed.ts.
  // Reuses the same documentTemplateRepository/loanProductRepository/unitOfWork instances wired
  // above.
  const documentTemplateAdminRouter = createDocumentTemplateAdminRouter(
    {
      listDocumentTemplatesForAdminUseCase: new ListDocumentTemplatesForAdminUseCase({
        documentTemplateRepository,
        loanProductRepository,
      }),
      updateDocumentTemplateRequiredUseCase: new UpdateDocumentTemplateRequiredUseCase({
        documentTemplateRepository,
        unitOfWork,
      }),
      setDocumentTemplateProductMappingsUseCase: new SetDocumentTemplateProductMappingsUseCase({
        documentTemplateRepository,
      }),
      updateDocumentTemplateSignatureRequirementsUseCase: new UpdateDocumentTemplateSignatureRequirementsUseCase({
        documentTemplateRepository,
      }),
    },
    tokenService,
  );
  app.use('/api/v1', documentTemplateAdminRouter);

  // --- loan-signing module wiring (e-signature, 2026-07-22, phase 1: required documents only) ---
  // Reuses documentTemplateRepository/generatedLoanDocumentRepository/loanDocumentFileStorage/
  // loanAccountRepository/borrowerRepository from the loan-document wiring above and this file's
  // top-level borrower wiring - same underlying documents, just batched for signature.
  const loanSigningSessionRepository = new PrismaLoanSigningSessionRepository();
  const signingNotificationLogRepository = new PrismaSigningNotificationLogRepository();
  const signatureStamper = new PdfLibDocumentSignatureStamper();
  // Constructed directly here (not shared with server.ts's cron-scheduler instance) - app.ts is
  // the HTTP composition root, server.ts is the cron composition root; tests import createApp()
  // directly and must never depend on server.ts's own wiring, same reasoning as the SMS reminder
  // scheduler's own M360SmsGateway instance.
  const signingSmsGateway = new DryRunAwareSmsGateway(
    new M360SmsGateway({
      apiUrl: env.M360_API_URL,
      username: env.M360_USERNAME ?? '',
      password: env.M360_PASSWORD ?? '',
      shortcodeMask: env.M360_SHORTCODE_MASK ?? '',
    }),
    new PrismaReminderSettingsRepository(),
  );
  // 2026-07-28 (email delivery channel) - same dry-run-safety precedent as signingSmsGateway
  // above, added after confirming some Smart-network numbers silently filter link-containing SMS.
  const signingEmailGateway = new DryRunAwareEmailGateway(
    new NodemailerEmailGateway({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      username: env.SMTP_USERNAME ?? '',
      password: env.SMTP_PASSWORD ?? '',
      fromAddress: env.SIGNING_SMTP_FROM_ADDRESS,
    }),
    new PrismaReminderSettingsRepository(),
  );
  // 2026-07-30 (user request): OTP codes send from a different "From" address than the signing
  // link above (SIGNING_OTP_SMTP_FROM_ADDRESS), so recipients can tell the two apart - same SMTP
  // host/credentials, just a different verified "Send As" alias. Only wired into
  // RequestSigningOtpUseCase below; CreateLoanSigningSessionUseCase (the link send) keeps using
  // signingEmailGateway unchanged.
  const signingOtpEmailGateway = new DryRunAwareEmailGateway(
    new NodemailerEmailGateway({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      username: env.SMTP_USERNAME ?? '',
      password: env.SMTP_PASSWORD ?? '',
      fromAddress: env.SIGNING_OTP_SMTP_FROM_ADDRESS,
    }),
    new PrismaReminderSettingsRepository(),
  );
  const loanSigningRouter = createLoanSigningRouter(
    {
      createLoanSigningSessionUseCase: new CreateLoanSigningSessionUseCase({
        loanAccountRepository,
        loanProductRepository,
        documentTemplateRepository,
        generatedLoanDocumentRepository,
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
        loanSigningSessionRepository,
        signingNotificationLogRepository,
        borrowerRepository,
        coBorrowerRepository,
        loanApplicationRepository: new PrismaLoanApplicationRepository(),
        portalAccountRepository,
        portalNotificationService,
        smsGateway: signingSmsGateway,
        emailGateway: signingEmailGateway,
      }),
      listLoanSigningSessionsUseCase: new ListLoanSigningSessionsUseCase({
        loanSigningSessionRepository,
        generatedLoanDocumentRepository,
        documentTemplateRepository,
      }),
      getSignedLoanSigningDocumentFileUseCase: new GetSignedLoanSigningDocumentFileUseCase({
        loanSigningSessionRepository,
        fileStorage: loanDocumentFileStorage,
      }),
      listSigningNotificationLogsUseCase: new ListSigningNotificationLogsUseCase({ signingNotificationLogRepository }),
    },
    tokenService,
  );
  app.use('/api/v1', loanSigningRouter);

  const publicLoanSigningRouter = createPublicLoanSigningRouter({
    requestSigningOtpUseCase: new RequestSigningOtpUseCase({
      loanSigningSessionRepository,
      signingNotificationLogRepository,
      smsGateway: signingSmsGateway,
      emailGateway: signingOtpEmailGateway,
    }),
    verifySigningOtpUseCase: new VerifySigningOtpUseCase({ loanSigningSessionRepository, signingNotificationLogRepository }),
    getLoanSigningSessionUseCase: new GetLoanSigningSessionUseCase({
      loanSigningSessionRepository,
      loanAccountRepository,
      borrowerRepository,
      generatedLoanDocumentRepository,
      documentTemplateRepository,
    }),
    getLoanSigningDocumentFileUseCase: new GetLoanSigningDocumentFileUseCase({
      loanSigningSessionRepository,
      generatedLoanDocumentRepository,
      fileStorage: loanDocumentFileStorage,
    }),
    signLoanSigningDocumentUseCase: new SignLoanSigningDocumentUseCase({
      loanSigningSessionRepository,
      loanAccountRepository,
      borrowerRepository,
      coBorrowerRepository,
      generatedLoanDocumentRepository,
      documentTemplateRepository,
      fileStorage: loanDocumentFileStorage,
      signatureStamper,
    }),
  });
  app.use('/api/v1/public', publicLoanSigningRouter);

  // 2026-08-20 (Portal e-signature, user request): e-signature reachable from inside the Portal
  // for a logged-in borrower, no mailed link needed - see createPortalLoanSigningRouter's own doc
  // comment. Reuses every dependency already constructed above for the staff/public loan-signing
  // wiring (same repositories, file storage, SMS/email gateways, signature stamper) plus
  // portalAccountRepository/portalTokenService from the Portal Phase 1 wiring earlier in this file.
  const portalLoanSigningRouter = createPortalLoanSigningRouter(
    {
      listPortalSigningSessionsUseCase: new ListPortalSigningSessionsUseCase({
        loanSigningSessionRepository,
        portalAccountRepository,
        loanAccountRepository,
      }),
      getPortalSigningSessionUseCase: new GetPortalSigningSessionUseCase({
        loanSigningSessionRepository,
        portalAccountRepository,
        loanAccountRepository,
        borrowerRepository,
        generatedLoanDocumentRepository,
        documentTemplateRepository,
      }),
      requestPortalSigningOtpUseCase: new RequestPortalSigningOtpUseCase({
        loanSigningSessionRepository,
        portalAccountRepository,
        loanAccountRepository,
        signingNotificationLogRepository,
        smsGateway: signingSmsGateway,
        emailGateway: signingOtpEmailGateway,
      }),
      verifyPortalSigningOtpUseCase: new VerifyPortalSigningOtpUseCase({
        loanSigningSessionRepository,
        portalAccountRepository,
        loanAccountRepository,
        signingNotificationLogRepository,
      }),
      getPortalSigningDocumentFileUseCase: new GetPortalSigningDocumentFileUseCase({
        loanSigningSessionRepository,
        portalAccountRepository,
        loanAccountRepository,
        generatedLoanDocumentRepository,
        fileStorage: loanDocumentFileStorage,
      }),
      signPortalLoanSigningDocumentUseCase: new SignPortalLoanSigningDocumentUseCase({
        loanSigningSessionRepository,
        portalAccountRepository,
        loanAccountRepository,
        borrowerRepository,
        generatedLoanDocumentRepository,
        documentTemplateRepository,
        fileStorage: loanDocumentFileStorage,
        signatureStamper,
      }),
    },
    portalTokenService,
  );
  app.use('/api/v1/portal', portalLoanSigningRouter);

  // --- statement-of-account module wiring (ADR-052, 2026-07-19: Statement of Account Generation) ---
  // Deliberately separate from the loan-document module above — ADR-051 §1/§9 explicitly excluded
  // SOA from the required/conditional DocumentTemplate matrix (different lifecycle: on-demand at
  // any point in a loan's life, not once after approval), so it bypasses DocumentTemplate entirely
  // and calls IDocumentFiller with a hardcoded 'SOA' template code — reuses the same underlying
  // docxtemplater/LibreOffice/file-storage infrastructure, not the required/conditional gating.
  const generatedStatementOfAccountRepository = new PrismaGeneratedStatementOfAccountRepository();
  const statementOfAccountMergeDataResolver = new StatementOfAccountMergeDataResolver({
    loanAccountRepository,
    borrowerRepository,
    coBorrowerRepository,
    repaymentInstallmentRepository,
    loanProductRepository,
  });
  const statementOfAccountRouter = createStatementOfAccountRouter(
    {
      generateStatementOfAccountUseCase: new GenerateStatementOfAccountUseCase({
        loanAccountRepository,
        generatedStatementOfAccountRepository,
        mergeDataResolver: statementOfAccountMergeDataResolver,
        documentFiller,
        docxToPdfConverter,
        fileStorage: loanDocumentFileStorage,
      }),
      listStatementsOfAccountUseCase: new ListStatementsOfAccountUseCase({
        generatedStatementOfAccountRepository,
      }),
      getGeneratedStatementOfAccountFileUseCase: new GetGeneratedStatementOfAccountFileUseCase({
        generatedStatementOfAccountRepository,
        fileStorage: loanDocumentFileStorage,
      }),
      getLoanAccountUseCase,
      idempotencyKeyStore,
    },
    tokenService,
  );
  app.use('/api/v1', statementOfAccountRouter);

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
  const feeChargeRepository = new PrismaFeeChargeRepository();
  const penaltyChargeRepository = new PrismaPenaltyChargeRepository();
  const repaymentRouter = createRepaymentRouter(
    {
      listRepaymentInstallmentsForLoanUseCase: new ListRepaymentInstallmentsForLoanUseCase({ repaymentInstallmentRepository }),
      getRepaymentInstallmentUseCase: new GetRepaymentInstallmentUseCase({ repaymentInstallmentRepository }),
      reducePenaltyUseCase: new ReducePenaltyUseCase({
        repaymentInstallmentRepository,
        loanAccountRepository,
        loanProductRepository,
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
      addFeeUseCase: new AddFeeUseCase({
        repaymentInstallmentRepository,
        loanAccountRepository,
        loanTransactionRepository,
        feeChargeRepository,
        financialAuditLogger,
        unitOfWork,
      }),
      addPenaltyUseCase: new AddPenaltyUseCase({
        repaymentInstallmentRepository,
        loanAccountRepository,
        loanTransactionRepository,
        penaltyChargeRepository,
        financialAuditLogger,
        unitOfWork,
      }),
      listInstallmentAdjustmentsForLoanUseCase: new ListInstallmentAdjustmentsForLoanUseCase({
        penaltyReductionRepository,
        feeAdjustmentRepository,
      }),
      getLoanAccountUseCase, // H-1: branch check via the parent loan account.
      loanProductRepository,
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

  // 2026-08-21 ("Print Application" feature): the document module's shared attachmentRepository/
  // fileStorage/uploadAttachmentUseCase are wired further below (see "document module wiring"),
  // after this router is built - a separate instance here since PrismaAttachmentRepository and
  // LocalFileStorage are both stateless, matching the pattern already used for
  // portalUploadAttachmentUseCase elsewhere in this file.
  const loanApplicationUploadAttachmentUseCase = new UploadAttachmentUseCase({
    attachmentRepository: new PrismaAttachmentRepository(),
    fileStorage: new LocalFileStorage(),
    profileActivityLogService,
  });

  const loanApplicationRouter = createLoanApplicationRouter(
    {
      createLoanApplicationUseCase: new CreateLoanApplicationUseCase({
        loanApplicationRepository,
        preQualificationService,
        profileActivityLogService,
        loanAccountRepository,
        notificationService,
      }),
      getLoanApplicationUseCase: new GetLoanApplicationUseCase({ loanApplicationRepository }),
      listLoanApplicationsUseCase: new ListLoanApplicationsUseCase({ loanApplicationRepository }),
      assignLoanApplicationProductUseCase: new AssignLoanApplicationProductUseCase({ loanApplicationRepository, profileActivityLogService }),
      approveLoanApplicationUseCase: new ApproveLoanApplicationUseCase({
        loanApplicationRepository,
        auditLogger,
        profileActivityLogService,
        notificationService,
        portalNotificationService,
        userRepository,
      }),
      declineLoanApplicationUseCase: new DeclineLoanApplicationUseCase({
        loanApplicationRepository,
        auditLogger,
        profileActivityLogService,
        notificationService,
        portalNotificationService,
        userRepository,
      }),
      revertLoanApplicationDecisionUseCase: new RevertLoanApplicationDecisionUseCase({
        loanApplicationRepository,
        auditLogger,
        preQualificationService,
        profileActivityLogService,
      }),
      revertLoanApplicationToPreApprovalUseCase: new RevertLoanApplicationToPreApprovalUseCase({
        loanApplicationRepository,
        auditLogger,
        profileActivityLogService,
      }),
      startLoanApplicationReviewUseCase: new StartLoanApplicationReviewUseCase({
        loanApplicationRepository,
        auditLogger,
        profileActivityLogService,
      }),
      submitLoanApplicationReviewReportUseCase: new SubmitLoanApplicationReviewReportUseCase({ loanApplicationRepository, auditLogger }),
      setMitigationAccountOwnerUseCase: new SetMitigationAccountOwnerUseCase({ loanApplicationRepository, auditLogger }),
      setMitigationDetailsUseCase: new SetMitigationDetailsUseCase({ loanApplicationRepository, auditLogger }),
      generateAiDocumentReviewUseCase: new GenerateAiDocumentReviewUseCase({ loanApplicationRepository }),
      tagLoanApplicationPreApprovalUseCase: new TagLoanApplicationPreApprovalUseCase({
        loanApplicationRepository,
        auditLogger,
        profileActivityLogService,
        notificationService,
      }),
      undoLoanApplicationPreApprovalUseCase: new UndoLoanApplicationPreApprovalUseCase({
        loanApplicationRepository,
        auditLogger,
        profileActivityLogService,
      }),
      updateLoanApplicationUseCase: new UpdateLoanApplicationUseCase({ loanApplicationRepository, preQualificationService, profileActivityLogService }),
      updateLoanApplicationIntakeUseCase: new UpdateLoanApplicationIntakeUseCase({ loanApplicationRepository, preQualificationService }),
      deleteLoanApplicationUseCase: new DeleteLoanApplicationUseCase({ loanApplicationRepository, auditLogger }),
      generateLoanApplicationFormUseCase: new GenerateLoanApplicationFormUseCase({
        loanApplicationRepository,
        loanAccountRepository,
        userRepository,
        uploadAttachmentUseCase: loanApplicationUploadAttachmentUseCase,
      }),
      generateCrmReportUseCase: new GenerateCrmReportUseCase({
        loanApplicationRepository,
        uploadAttachmentUseCase: loanApplicationUploadAttachmentUseCase,
        attachmentRepository: new PrismaAttachmentRepository(),
        fileStorage: new LocalFileStorage(),
      }),
      getLoanApplicationRiskSummaryUseCase: new GetLoanApplicationRiskSummaryUseCase({ loanApplicationRepository }),
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

  // --- sms-reminder module wiring: M360 DLR webhook (no requireAuth - see controller's own doc comment) ---
  const smsReminderDlrRouter = createSmsReminderDlrRouter({ smsReminderRepository: new PrismaSmsReminderRepository() });
  app.use('/api/v1', smsReminderDlrRouter);

  // --- sms-reminder module wiring: Reports Hub visibility (who got texted, when, delivery status) ---
  const smsReminderLogRouter = createSmsReminderLogRouter(
    { listSmsReminderLogsUseCase: new ListSmsReminderLogsUseCase({ smsReminderRepository: new PrismaSmsReminderRepository() }) },
    tokenService,
  );
  app.use('/api/v1', smsReminderLogRouter);

  // --- email-reminder module wiring: Reports Hub visibility (mirrors sms-reminder, second channel) ---
  const emailReminderLogRouter = createEmailReminderLogRouter(
    { listEmailReminderLogsUseCase: new ListEmailReminderLogsUseCase({ emailReminderRepository: new PrismaEmailReminderRepository() }) },
    tokenService,
  );
  app.use('/api/v1', emailReminderLogRouter);

  // --- reminder-settings module wiring: MIS-only master switches for the SMS/Email cron jobs ---
  const reminderSettingsRouter = createReminderSettingsRouter(
    {
      getReminderSettingsUseCase: new GetReminderSettingsUseCase({ reminderSettingsRepository: new PrismaReminderSettingsRepository() }),
      updateReminderSettingsUseCase: new UpdateReminderSettingsUseCase({
        reminderSettingsRepository: new PrismaReminderSettingsRepository(),
        auditLogger,
      }),
    },
    tokenService,
  );
  app.use('/api/v1', reminderSettingsRouter);

  // --- security-settings module wiring (2026-08-28 user request): MIS-only "Require 2FA for all
  // users" toggle, checked by LoginUseCase/VerifyLoginOtpUseCase/GetCurrentUserUseCase above
  // (shares the same securitySettingsRepository instance) ---
  const securitySettingsRouter = createSecuritySettingsRouter(
    {
      getSecuritySettingsUseCase: new GetSecuritySettingsUseCase({ securitySettingsRepository }),
      updateSecuritySettingsUseCase: new UpdateSecuritySettingsUseCase({
        securitySettingsRepository,
        auditLogger,
      }),
    },
    tokenService,
  );
  app.use('/api/v1', securitySettingsRouter);

  // --- system-announcement module wiring (2026-08-14 user request): MIS-authored maintenance/news
  // popups shown to LMS staff and/or Portal clients. One repository instance shared by the
  // MIS-only admin router (mounted at /api/v1) and the public "what's active right now" router
  // (mounted at /api/v1/portal, no auth - see publicAnnouncementRouter's own doc comment). ---
  const systemAnnouncementRepository = new PrismaSystemAnnouncementRepository();
  const getActiveSystemAnnouncementUseCase = new GetActiveSystemAnnouncementUseCase({ systemAnnouncementRepository });
  const systemAnnouncementRouter = createSystemAnnouncementRouter(
    {
      createSystemAnnouncementUseCase: new CreateSystemAnnouncementUseCase({ systemAnnouncementRepository }),
      listSystemAnnouncementsUseCase: new ListSystemAnnouncementsUseCase({ systemAnnouncementRepository }),
      updateSystemAnnouncementUseCase: new UpdateSystemAnnouncementUseCase({ systemAnnouncementRepository }),
      deleteSystemAnnouncementUseCase: new DeleteSystemAnnouncementUseCase({ systemAnnouncementRepository }),
      getActiveSystemAnnouncementUseCase,
    },
    tokenService,
  );
  app.use('/api/v1', systemAnnouncementRouter);
  const publicAnnouncementRouter = createPublicAnnouncementRouter({ getActiveSystemAnnouncementUseCase });
  app.use('/api/v1/portal', publicAnnouncementRouter);

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
      listDistinctChannelsUseCase: new ListDistinctChannelsUseCase({ reportingRepository }),
      getFullyPaidAccountsReportUseCase: new GetFullyPaidAccountsReportUseCase({ reportingRepository }),
      getPortalAccountsReportUseCase: new GetPortalAccountsReportUseCase({ reportingRepository }),
      getCicMonthlyReportUseCase: new GetCicMonthlyReportUseCase({ reportingRepository }),
      cicCsdfReportWriter: new CicCsdfReportWriter(),
      cicExcelReportWriter: new CicExcelReportWriter(),
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
      downloadAllBorrowerDocumentsUseCase: new DownloadAllBorrowerDocumentsUseCase({ borrowerRepository, attachmentRepository, fileStorage }),
    },
    tokenService,
  );
  app.use('/api/v1', documentRouter);

  // --- mis-post module wiring (2026-08-20 user request): MIS-authored Facebook-style Portal
  // posts - a daily auto-rotating pool plus ad-hoc manual posts (e.g. typhoon advisories). Reuses
  // the `fileStorage` wired for the document module just above; needs its own repository since
  // `MisPost` is a distinct entity from `SystemAnnouncement` (see the Prisma model's doc comment). ---
  const misPostRepository = new PrismaMisPostRepository();
  const misPostRouter = createMisPostRouter(
    {
      createManualMisPostUseCase: new CreateManualMisPostUseCase({ misPostRepository, fileStorage }),
      withdrawManualMisPostUseCase: new WithdrawManualMisPostUseCase({ misPostRepository }),
      listMisPostsForAdminUseCase: new ListMisPostsForAdminUseCase({ misPostRepository }),
    },
    tokenService,
  );
  app.use('/api/v1', misPostRouter);
  const publicMisPostRouter = createPublicMisPostRouter({
    getActivePortalPostsUseCase: new GetActivePortalPostsUseCase({ misPostRepository }),
    getMisPostImageUseCase: new GetMisPostImageUseCase({ misPostRepository, fileStorage }),
  });
  app.use('/api/v1/portal', publicMisPostRouter);

  // --- Easycash Portal module wiring, Phase 2 (2026-07-23): loan application submission from the
  // portal. Reuses createLoanApplicationUseCase's own deps (loanApplicationRepository,
  // preQualificationService) plus attachmentRepository/fileStorage from the document module wiring
  // above, and portalAccountRepository/portalTokenService from the Phase 1 wiring earlier in this
  // file - a second router mounted at the same /api/v1/portal prefix as portalAuthRouter. ---
  const portalUploadAttachmentUseCase = new UploadAttachmentUseCase({ attachmentRepository, fileStorage, profileActivityLogService });
  const portalLoanApplicationRouter = createPortalLoanApplicationRouter(
    {
      submitLoanApplicationUseCase: new SubmitLoanApplicationUseCase({
        portalAccountRepository,
        createLoanApplicationUseCase: new CreateLoanApplicationUseCase({ loanApplicationRepository, preQualificationService, notificationService }),
      }),
      listPortalLoanApplicationsUseCase: new ListPortalLoanApplicationsUseCase({ loanApplicationRepository, attachmentRepository }),
      getPortalLoanApplicationUseCase: new GetPortalLoanApplicationUseCase({ loanApplicationRepository }),
      updatePortalLoanApplicationUseCase: new UpdatePortalLoanApplicationUseCase({
        loanApplicationRepository,
        updateLoanApplicationSelfServiceUseCase: new UpdateLoanApplicationSelfServiceUseCase({ loanApplicationRepository, preQualificationService }),
      }),
      listPortalBranchesUseCase: new ListPortalBranchesUseCase({ branchRepository }),
      uploadPortalLoanApplicationDocumentUseCase: new UploadPortalLoanApplicationDocumentUseCase({
        loanApplicationRepository,
        uploadAttachmentUseCase: portalUploadAttachmentUseCase,
      }),
      listPortalLoanApplicationDocumentsUseCase: new ListPortalLoanApplicationDocumentsUseCase({ loanApplicationRepository, attachmentRepository }),
      downloadPortalLoanApplicationDocumentUseCase: new DownloadPortalLoanApplicationDocumentUseCase({
        loanApplicationRepository,
        attachmentRepository,
        fileStorage,
      }),
      getPortalLoanApplicationStatusTimelineUseCase: new GetPortalLoanApplicationStatusTimelineUseCase({
        loanApplicationRepository,
        auditLogRepository: new PrismaAuditLogRepository(),
      }),
    },
    portalTokenService,
  );
  app.use('/api/v1/portal', portalLoanApplicationRouter);

  // Payment history / amortization schedule for a linked client's real, booked loan account(s)
  // (2026-07-31 user request) - reuses the same loanAccountRepository/repaymentInstallmentRepository
  // instances the staff-facing loan-account module already wires above.
  const portalLoanAccountRouter = createPortalLoanAccountRouter(
    {
      listPortalLoanAccountsUseCase: new ListPortalLoanAccountsUseCase({ portalAccountRepository, loanAccountRepository }),
      listPortalLoanAccountInstallmentsUseCase: new ListPortalLoanAccountInstallmentsUseCase({
        portalAccountRepository,
        loanAccountRepository,
        repaymentInstallmentRepository,
      }),
      // "Next Payment Due" / "Recent Payments" dashboard widgets (2026-08-06 user request) - reuse
      // the same loanAccountRepository/repaymentInstallmentRepository/loanTransactionRepository
      // instances the staff-facing modules already wire above.
      getPortalNextPaymentDueUseCase: new GetPortalNextPaymentDueUseCase({
        portalAccountRepository,
        loanAccountRepository,
        repaymentInstallmentRepository,
      }),
      listPortalRecentPaymentsUseCase: new ListPortalRecentPaymentsUseCase({
        portalAccountRepository,
        loanAccountRepository,
        loanTransactionRepository,
      }),
      // "My Statement of Account" (2026-08-06 user request) - view/download only, reusing the
      // same generatedStatementOfAccountRepository/loanDocumentFileStorage instances the
      // statement-of-account module wires above. No generate capability here - see the use case's
      // own doc comment for why.
      listPortalStatementsOfAccountUseCase: new ListPortalStatementsOfAccountUseCase({
        portalAccountRepository,
        loanAccountRepository,
        generatedStatementOfAccountRepository,
      }),
      downloadPortalStatementOfAccountUseCase: new DownloadPortalStatementOfAccountUseCase({
        portalAccountRepository,
        loanAccountRepository,
        generatedStatementOfAccountRepository,
        fileStorage: loanDocumentFileStorage,
      }),
      // "Upload Proof of Payment" (2026-08-14 user request) - reuses the same
      // portalUploadAttachmentUseCase instance the loan-application document upload above uses.
      uploadPortalPaymentProofUseCase: new UploadPortalPaymentProofUseCase({
        portalAccountRepository,
        loanAccountRepository,
        uploadAttachmentUseCase: portalUploadAttachmentUseCase,
      }),
    },
    portalTokenService,
  );
  app.use('/api/v1/portal', portalLoanAccountRouter);

  // Portal<->LMS support chat (2026-07-31 user request) - one shared repository, two separate
  // routers (Portal client side vs. LMS staff side), since the two auth realms and permission
  // models are genuinely different, matching every other cross-realm feature in this codebase.
  const chatRepository = new PrismaChatRepository();
  const portalChatRouter = createPortalChatRouter(
    {
      startOrResumePortalChatUseCase: new StartOrResumePortalChatUseCase({ chatRepository }),
      getActivePortalChatUseCase: new GetActivePortalChatUseCase({ chatRepository }),
      getPortalChatUseCase: new GetPortalChatUseCase({ chatRepository }),
      sendPortalChatMessageUseCase: new SendPortalChatMessageUseCase({
        chatRepository,
        uploadAttachmentUseCase: portalUploadAttachmentUseCase,
        notificationService,
      }),
      downloadPortalChatAttachmentUseCase: new DownloadPortalChatAttachmentUseCase({ chatRepository, attachmentRepository, fileStorage }),
      setPortalChatTypingUseCase: new SetPortalChatTypingUseCase({ chatRepository }),
      submitChatRatingUseCase: new SubmitChatRatingUseCase({ chatRepository }),
    },
    portalTokenService,
  );
  app.use('/api/v1/portal', portalChatRouter);

  const chatRouter = createChatRouter(
    {
      listChatQueueUseCase: new ListChatQueueUseCase({ userRepository, chatRepository }),
      listMyClaimedChatConversationsUseCase: new ListMyClaimedChatConversationsUseCase({ chatRepository }),
      getChatConversationForStaffUseCase: new GetChatConversationForStaffUseCase({ userRepository, chatRepository, portalAccountRepository, loanApplicationRepository, borrowerRepository }),
      claimChatConversationUseCase: new ClaimChatConversationUseCase({ userRepository, chatRepository }),
      initiateChatTransferUseCase: new InitiateChatTransferUseCase({ userRepository, chatRepository }),
      completeChatTransferUseCase: new CompleteChatTransferUseCase({ userRepository, chatRepository }),
      cancelChatTransferUseCase: new CancelChatTransferUseCase({ chatRepository }),
      listChatTransferCandidatesUseCase: new ListChatTransferCandidatesUseCase({ userRepository }),
      listIncomingChatTransfersUseCase: new ListIncomingChatTransfersUseCase({ chatRepository }),
      sendStaffChatMessageUseCase: new SendStaffChatMessageUseCase({ chatRepository, uploadAttachmentUseCase: portalUploadAttachmentUseCase }),
      closeChatConversationUseCase: new CloseChatConversationUseCase({ userRepository, chatRepository }),
      downloadChatAttachmentForStaffUseCase: new DownloadChatAttachmentForStaffUseCase({ userRepository, chatRepository, attachmentRepository, fileStorage }),
      listChatOversightStaffUseCase: new ListChatOversightStaffUseCase({ userRepository }),
      listChatConversationsForStaffUseCase: new ListChatConversationsForStaffUseCase({ userRepository, chatRepository }),
      getChatConversationForMisUseCase: new GetChatConversationForMisUseCase({ userRepository, chatRepository, portalAccountRepository, loanApplicationRepository, borrowerRepository }),
      setStaffChatTypingUseCase: new SetStaffChatTypingUseCase({ chatRepository }),
      updateAgentPresenceUseCase: new UpdateAgentPresenceUseCase({ chatRepository }),
      listAgentPresenceUseCase: new ListAgentPresenceUseCase({ chatRepository }),
      listChatCannedResponsesUseCase: new ListChatCannedResponsesUseCase({ chatRepository }),
      createChatCannedResponseUseCase: new CreateChatCannedResponseUseCase({ chatRepository }),
      updateChatCannedResponseUseCase: new UpdateChatCannedResponseUseCase({ chatRepository }),
      deleteChatCannedResponseUseCase: new DeleteChatCannedResponseUseCase({ chatRepository }),
    },
    tokenService,
  );
  app.use('/api/v1', chatRouter);

  // Easycash Portal Notification Center, Phase C (2026-07-24): bell notifications for Approved/
  // Declined decisions, mounted at the same /api/v1/portal prefix.
  const portalNotificationRouter = createPortalNotificationRouter(
    {
      listPortalNotificationsUseCase: new ListPortalNotificationsUseCase({ portalNotificationRepository }),
      markPortalNotificationReadUseCase: new MarkPortalNotificationReadUseCase({ portalNotificationRepository }),
      markAllPortalNotificationsReadUseCase: new MarkAllPortalNotificationsReadUseCase({ portalNotificationRepository }),
    },
    portalTokenService,
  );
  app.use('/api/v1/portal', portalNotificationRouter);

  // Easycash Portal client profile, Phase D (2026-07-24): view/edit own contact info once linked
  // to a real Borrower record (PortalAccount.borrowerId, set at "Create Client Profile" time).
  // Delegates writes to the same UpdateBorrowerUseCase staff uses (own instance here, same
  // stateless-Prisma-wrapper reuse pattern as elsewhere in this file) so both surfaces share one
  // write path and one activity-log trail.
  const getPortalProfileUseCase = new GetPortalProfileUseCase({ portalAccountRepository, borrowerRepository });
  const portalProfileRouter = createPortalProfileRouter(
    {
      getPortalProfileUseCase,
      updatePortalProfileUseCase: new UpdatePortalProfileUseCase({
        portalAccountRepository,
        updateBorrowerUseCase: new UpdateBorrowerUseCase({ borrowerRepository, profileActivityLogService }),
        getPortalProfileUseCase,
      }),
      // "Chat with your loan officer" dashboard card (2026-08-06 user request).
      getPortalAssignedLoanOfficerUseCase: new GetPortalAssignedLoanOfficerUseCase({ portalAccountRepository, borrowerRepository, userRepository }),
    },
    portalTokenService,
  );
  app.use('/api/v1/portal', portalProfileRouter);

  // Easycash Portal Security tab (2026-07-27 user request): self-service login-email and password
  // change, gated by the current password. Reuses the same passwordHasher/portalAccountRepository
  // instances as sign-up/login above.
  const portalSecurityRouter = createPortalSecurityRouter(
    {
      changePortalPasswordUseCase: new ChangePortalPasswordUseCase({ portalAccountRepository, passwordHasher }),
      changePortalEmailUseCase: new ChangePortalEmailUseCase({ portalAccountRepository, passwordHasher }),
      requestEnablePortalTwoFactorUseCase: new RequestEnablePortalTwoFactorUseCase({
        portalAccountRepository,
        portalAccountChallengeRepository,
        otpSender: portalOtpSender,
      }),
      confirmEnablePortalTwoFactorUseCase: new ConfirmEnablePortalTwoFactorUseCase({ portalAccountRepository, portalAccountChallengeRepository }),
      disablePortalTwoFactorUseCase: new DisablePortalTwoFactorUseCase({ portalAccountRepository, passwordHasher }),
      listPortalTrustedDevicesUseCase: new ListPortalTrustedDevicesUseCase({ portalTrustedDeviceRepository }),
      revokePortalTrustedDeviceUseCase: new RevokePortalTrustedDeviceUseCase({ portalTrustedDeviceRepository }),
      // Delete My Portal Account (2026-08-06) - reuses the same loanAccountRepository instance as
      // the loan-account module's own wiring above.
      requestPortalAccountDeletionUseCase: new RequestPortalAccountDeletionUseCase({
        portalAccountRepository,
        loanAccountRepository,
        passwordHasher,
        auditLogger,
      }),
    },
    portalTokenService,
  );
  app.use('/api/v1/portal', portalSecurityRouter);

  // Portal-facing PSGC address lookups (cascading region/province/city/barangay + ZIP auto-fill
  // on the loan application form) - see portalPsgcRouter.ts's doc comment for why this can't just
  // reuse the staff-facing psgcRouter mounted above.
  const portalPsgcRouter = createPortalPsgcRouter(
    { listPsgcOptionsUseCase: new ListPsgcOptionsUseCase({ psgcRepository: new PrismaPsgcRepository() }) },
    portalTokenService,
  );
  app.use('/api/v1/portal', portalPsgcRouter);

  // Automated PH Lending/Finance News + Road/Weather Advisory feed (2026-08-06 user request) -
  // public, unauthenticated - see externalNewsLinkRouter.ts's own doc comment.
  const externalNewsLinkRouter = createExternalNewsLinkRouter({
    listExternalNewsLinksUseCase: new ListExternalNewsLinksUseCase({
      externalNewsLinkRepository: new PrismaExternalNewsLinkRepository(),
    }),
  });
  app.use('/api/v1/portal', externalNewsLinkRouter);

  // --- profile-note module wiring: free-text notes on Borrower/LoanAccount/LoanApplication, same
  // polymorphic ownerType/ownerId shape as the document module above. Renamed from "note"
  // 2026-07-13 (the never-wired-to-any-frontend-page "loan-note" module it was distinguished from
  // at the time was removed entirely 2026-07-21 as dead code). ---
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

  // --- bulk-export module wiring (2026-08-24 user request): MIS "download all client/loan account
  // attachments in a date range" background export, plus a full-database `pg_dump` export. Reuses
  // attachmentRepository/fileStorage from the document module wiring above. ---
  const bulkExportJobRepository = new PrismaBulkExportJobRepository();
  // 2026-08-25 (Cancel Export, user request): one instance for the whole app - shared between the
  // job runner (registers/unregisters as jobs start/finish) and the cancel use case (signals it).
  const bulkExportCancellationRegistry = new BulkExportCancellationRegistry();
  const processBulkExportJobUseCase = new ProcessBulkExportJobUseCase({
    bulkExportJobRepository,
    borrowerRepository,
    loanAccountRepository,
    attachmentRepository,
    userRepository,
    fileStorage,
    notificationService,
    databaseUrl: env.DATABASE_URL,
    cancellationRegistry: bulkExportCancellationRegistry,
  });
  const bulkExportRouter = createBulkExportRouter(
    {
      createBulkExportJobUseCase: new CreateBulkExportJobUseCase({ bulkExportJobRepository, processBulkExportJobUseCase }),
      listMyBulkExportJobsUseCase: new ListMyBulkExportJobsUseCase({ bulkExportJobRepository }),
      downloadBulkExportJobUseCase: new DownloadBulkExportJobUseCase({ bulkExportJobRepository, fileStorage }),
      getBulkExportDefaultRangeUseCase: new GetBulkExportDefaultRangeUseCase({ borrowerRepository, loanAccountRepository }),
      cancelBulkExportJobUseCase: new CancelBulkExportJobUseCase({ bulkExportJobRepository, cancellationRegistry: bulkExportCancellationRegistry }),
    },
    tokenService,
  );
  app.use('/api/v1', bulkExportRouter);

  // Further module routers are mounted under /api/v1/* as each is built out.

  // Exposed via app.locals (not a changed return type - `createApp(): Express` is imported by
  // ~100 test files as-is) so `server.ts` can start the real overdue-notification scheduler
  // against the same wired instance, without duplicating its dependencies.
  app.locals.notificationService = notificationService;

  app.use(errorHandler);

  return app;
}
