import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { IAuditLogRepository } from '@modules/audit/application/ports/IAuditLogRepository';
import { PortalLoanApplicationNotFoundError } from '../../domain/errors/PortalAuthErrors';

export interface PortalLoanApplicationTimelineEntry {
  label: string;
  occurredAt: Date;
}

export interface GetPortalLoanApplicationStatusTimelineUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogRepository: IAuditLogRepository;
}

/** Backs the Portal dashboard's application status timeline (2026-07-31 user request, "top
 * reputable lending site" checklist item). Built ONLY from real, already-recorded events - never
 * a fabricated per-stage date. `createdAt` covers "Submitted" (always known); every later stage
 * comes from the same AuditLog entries the internal LMS's own review actions already write
 * (ApproveLoanApplicationUseCase/DeclineLoanApplicationUseCase/StartLoanApplicationReviewUseCase/
 * TagLoanApplicationPreApprovalUseCase). An application that skipped a stage (e.g. declined
 * without ever being tagged pre-approval) simply has fewer entries - never a gap filled in. */
const STAGE_LABELS: Record<string, string> = {
  START_LOAN_APPLICATION_REVIEW: 'Under review',
  TAG_LOAN_APPLICATION_PRE_APPROVAL: 'Pre-approval',
  APPROVE_LOAN_APPLICATION: 'Approved',
  DECLINE_LOAN_APPLICATION: 'Declined',
};

export class GetPortalLoanApplicationStatusTimelineUseCase {
  constructor(private readonly deps: GetPortalLoanApplicationStatusTimelineUseCaseDeps) {}

  async execute(portalAccountId: string, loanApplicationId: string): Promise<PortalLoanApplicationTimelineEntry[]> {
    const application = await this.deps.loanApplicationRepository.findById(loanApplicationId);
    if (!application || application.portalAccountId !== portalAccountId) {
      throw new PortalLoanApplicationNotFoundError();
    }
    const props = application.toProps();

    const logs = await this.deps.auditLogRepository.findMany({
      limit: 20,
      entityTypes: ['LoanApplication'],
      entityId: loanApplicationId,
      actions: Object.keys(STAGE_LABELS),
    });

    const entries: PortalLoanApplicationTimelineEntry[] = [{ label: 'Submitted', occurredAt: props.createdAt }];
    for (const log of logs) {
      const label = STAGE_LABELS[log.action];
      if (label) entries.push({ label, occurredAt: log.createdAt });
    }

    return entries.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }
}
