/**
 * Profile Activity Module
 *
 * Exports the public API for profile activity logging and retrieval.
 * ADR-050: Track loan officer actions on profiles for compliance and auditability.
 */

export * from './domain/ProfileActivityLog';
export * from './application/ProfileActivityLogService';
export * from './application/ports/IProfileActivityLogRepository';
export * from './application/use-cases/GetProfileActivityUseCase';
export * from './application/use-cases/DeleteProfileActivityUseCase';
export * from './infrastructure/PrismaProfileActivityLogRepository';
export * from './interface/http/ProfileActivityLogController';
export * from './interface/http/ProfileActivityLogRouter';
export * from './interface/http/presenters/ProfileActivityPresenter';
