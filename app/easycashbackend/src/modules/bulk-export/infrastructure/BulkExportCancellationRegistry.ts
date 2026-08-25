/**
 * In-process cancellation signal for a running `BulkExportJob` (2026-08-25, Cancel Export, user
 * request). Mirrors this module's existing "no queue, same Node process" posture
 * (`ProcessBulkExportJobUseCase`'s own doc comment) - a job is cancelled by aborting an
 * `AbortController` the running job itself registered, not by messaging a separate worker that
 * doesn't exist here. If the backend restarts, every entry is gone along with the in-process job
 * it belonged to - same "left stuck forever, re-request instead" reality this module already
 * accepts for an unexpected restart, not a new gap this introduces.
 */
export class BulkExportCancellationRegistry {
  private readonly controllers = new Map<string, AbortController>();

  /** Called once, right before a job starts running - the returned signal is threaded through the
   * job's own work so it can check `signal.aborted` between records/files. */
  register(jobId: string): AbortController {
    const controller = new AbortController();
    this.controllers.set(jobId, controller);
    return controller;
  }

  /** Always called when a job finishes, however it finishes - a stale entry would otherwise leak
   * for the lifetime of the process and could (harmlessly, but pointlessly) linger for a
   * long-since-completed job. */
  unregister(jobId: string): void {
    this.controllers.delete(jobId);
  }

  /** Returns true if a running job was actually signalled - false means the job either isn't
   * running (already finished) or never started (still PENDING, nothing to abort yet; the caller
   * handles that case directly against the DB row instead). */
  requestCancel(jobId: string): boolean {
    const controller = this.controllers.get(jobId);
    if (!controller) return false;
    controller.abort();
    return true;
  }
}
