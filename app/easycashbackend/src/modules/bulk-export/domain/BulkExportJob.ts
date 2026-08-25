import { randomUUID } from 'node:crypto';

export type BulkExportType = 'BORROWER_ATTACHMENTS' | 'LOAN_ACCOUNT_ATTACHMENTS' | 'DATABASE_DUMP';
export type BulkExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface BulkExportJobProps {
  id: string;
  requestedByUserId: string;
  branchId: string | null;
  exportType: BulkExportType;
  startDate: Date;
  endDate: Date;
  status: BulkExportStatus;
  recordCount: number | null;
  fileCount: number | null;
  resultStorageKey: string | null;
  resultFileSize: number | null;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CreateBulkExportJobProps {
  requestedByUserId: string;
  branchId: string | null;
  exportType: BulkExportType;
  startDate: Date;
  endDate: Date;
}

/**
 * MIS bulk document export (2026-08-24 user request): tracks one "download all client/loan account
 * attachments in this date range" background job from PENDING through PROCESSING to COMPLETED/
 * FAILED. Runs in-process (see `BulkExportProcessor.ts`'s own doc comment for why there's no real
 * job queue behind this) - if the server restarts mid-job, the row is simply left stuck at
 * PROCESSING forever (user-confirmed acceptable; re-request rather than auto-resume/retry).
 */
export class BulkExportJob {
  private constructor(private readonly props: BulkExportJobProps) {}

  static create(input: CreateBulkExportJobProps): BulkExportJob {
    return new BulkExportJob({
      id: randomUUID(),
      requestedByUserId: input.requestedByUserId,
      branchId: input.branchId,
      exportType: input.exportType,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'PENDING',
      recordCount: null,
      fileCount: null,
      resultStorageKey: null,
      resultFileSize: null,
      errorMessage: null,
      createdAt: new Date(),
      completedAt: null,
    });
  }

  static reconstitute(props: BulkExportJobProps): BulkExportJob {
    return new BulkExportJob(props);
  }

  markProcessing(recordCount: number): void {
    this.props.status = 'PROCESSING';
    this.props.recordCount = recordCount;
  }

  markCompleted(input: { resultStorageKey: string; resultFileSize: number; fileCount: number }): void {
    this.props.status = 'COMPLETED';
    this.props.resultStorageKey = input.resultStorageKey;
    this.props.resultFileSize = input.resultFileSize;
    this.props.fileCount = input.fileCount;
    this.props.completedAt = new Date();
  }

  markFailed(errorMessage: string): void {
    this.props.status = 'FAILED';
    this.props.errorMessage = errorMessage;
    this.props.completedAt = new Date();
  }

  /** 2026-08-25 (Cancel Export, user request): staff explicitly stopped this job - either before
   * it started running (still PENDING) or mid-run (PROCESSING, signalled via
   * `BulkExportCancellationRegistry`). Distinct from `markFailed` so the UI can read "stopped on
   * purpose" rather than "something went wrong." */
  markCancelled(): void {
    this.props.status = 'CANCELLED';
    this.props.errorMessage = 'Cancelled by staff';
    this.props.completedAt = new Date();
  }

  /** Only a job that's still running (or about to) can be stopped - a finished job has nothing
   * left to interrupt. */
  get isCancellable(): boolean {
    return this.props.status === 'PENDING' || this.props.status === 'PROCESSING';
  }

  get id(): string {
    return this.props.id;
  }
  get requestedByUserId(): string {
    return this.props.requestedByUserId;
  }
  get branchId(): string | null {
    return this.props.branchId;
  }
  get exportType(): BulkExportType {
    return this.props.exportType;
  }
  get startDate(): Date {
    return this.props.startDate;
  }
  get endDate(): Date {
    return this.props.endDate;
  }
  get status(): BulkExportStatus {
    return this.props.status;
  }
  get recordCount(): number | null {
    return this.props.recordCount;
  }
  get fileCount(): number | null {
    return this.props.fileCount;
  }
  get resultStorageKey(): string | null {
    return this.props.resultStorageKey;
  }
  get resultFileSize(): number | null {
    return this.props.resultFileSize;
  }
  get errorMessage(): string | null {
    return this.props.errorMessage;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get completedAt(): Date | null {
    return this.props.completedAt;
  }
}
