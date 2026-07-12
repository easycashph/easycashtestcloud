import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Bell, CheckCircle2, Circle, Clock, FileCheck2, Mail, MessageSquareText, MonitorSmartphone, Paperclip, Sparkles, Trash2, Upload } from 'lucide-react';
import { apiClient, ApiError, fetchAllPages } from '@/lib/apiClient';
import type { Borrower as RealBorrower, LoanAccount, LoanDocumentListItem, LoanNote, LoanTransaction, PaginatedResponse, RepaymentInstallment } from '@/lib/loanApiTypes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { LoanStatusBadge, InstallmentStatusBadge } from '@/components/StatusBadge';
import { ComingSoonButton } from '@/components/ComingSoonButton';
import { PaymentMethodBadge } from '@/components/PaymentMethodBadge';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useSortableTable } from '@/lib/useSortableTable';
import {
  activateLoanAccount,
  approveLoanAccount,
  buildReminderMessage,
  getGeneratedDocumentsForLoan,
  getMockBorrowerForLoan,
  getMockLoan,
  getMockRiskAssessment,
  logActivity,
  MOCK_ACTIVITY_LOGS,
  MOCK_INSTALLMENTS,
  MOCK_PAYMENT_REMINDERS,
  MOCK_TIMELINES,
  MOCK_TRANSACTIONS,
  REMINDER_TYPE_LABELS,
  type MockLoanTransaction,
  type MockRepaymentInstallment,
  type MockRiskLevel,
} from '@/lib/mockData';
import { cn, formatDate, formatPeso } from '@/lib/utils';

function getInstallmentSortValue(inst: MockRepaymentInstallment, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'installmentNumber':
      return inst.installmentNumber;
    case 'dueDate':
      return new Date(inst.dueDate);
    case 'principalDue':
      return inst.due.principal;
    case 'interestDue':
      return inst.due.interest;
    case 'paid':
      return inst.paid.principal + inst.paid.interest;
    case 'status':
      return inst.status;
    default:
      return undefined;
  }
}

function getPaymentHistorySortValue(txn: MockLoanTransaction, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'entryDate':
      return new Date(txn.entryDate);
    case 'amount':
      return txn.amount;
    case 'paymentMethod':
      return txn.paymentMethod ?? '';
    default:
      return undefined;
  }
}

const RISK_BADGE_VARIANT: Record<MockRiskLevel, 'success' | 'warning' | 'destructive'> = {
  'Low Risk': 'success',
  'Medium Risk': 'warning',
  'High Risk': 'destructive',
};

/**
 * Static/mock panel only — no real AI/ML API call is made anywhere in this
 * preview. `getMockRiskAssessment()` is a deterministic lookup over
 * hand-written mock data (`src/lib/mockData.ts`), not a model inference.
 */
function AiRiskAssessmentCard({ loanId }: { loanId: string }) {
  const assessment = getMockRiskAssessment(loanId);
  if (!assessment) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle>AI Risk Assessment</CardTitle>
        </div>
        <Badge variant={RISK_BADGE_VARIANT[assessment.level]}>{assessment.level}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{assessment.explanation}</p>
        <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
          AI-Assisted — Loan Officer pa rin ang gumagawa ng huling desisyon. Mock output lang ito; walang totoong AI/ML na tumatakbo sa
          preview build na ito.
        </p>
      </CardContent>
    </Card>
  );
}

function BalanceRow({ label, value, emphasize }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={cn('text-muted-foreground', emphasize && 'font-medium text-foreground')}>{label}</span>
      <span className={cn('tabular-nums', emphasize && 'font-semibold')}>{formatPeso(value)}</span>
    </div>
  );
}

/** Mock-only shape used by the legacy hand-authored-loans NotesPanel below — distinct from the real `LoanNote` API type (`@/lib/loanApiTypes`) used by `RealLoanDetailView`. */
interface MockLoanNote {
  id: string;
  author: string;
  text: string;
  at: string;
}

/**
 * Notes are held in local component state only, seeded per loan — added
 * notes disappear on page reload. Nothing here is sent anywhere.
 */
function NotesPanel({ loanId, loanCode }: { loanId: string; loanCode: string }) {
  const { currentAccount } = useRole();
  const [notes, setNotes] = React.useState<MockLoanNote[]>(() => [
    {
      id: `${loanId}-note-seed`,
      author: 'M. Santos (Loan Officer)',
      text: 'Borrower confirmed employment details over the phone; proceeding as scheduled.',
      at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    },
  ]);
  const [draft, setDraft] = React.useState('');

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    setNotes((prev) => [{ id: `note-${Date.now()}`, author: currentAccount.name, text, at: new Date().toISOString() }, ...prev]);
    setDraft('');
    logActivity({ userName: currentAccount.name, action: 'ADD_NOTE', entityType: 'LoanAccount', entityId: loanCode, at: new Date().toISOString() });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-note">Add a note</Label>
        <Textarea id="new-note" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a note about this loan account..." rows={3} />
        <Button size="sm" onClick={addNote} disabled={!draft.trim()}>
          Add Note
        </Button>
        <p className="text-xs text-muted-foreground">Notes are stored in this browser tab only for this preview — nothing is saved to a database.</p>
      </div>
      <Separator />
      <ul className="space-y-3">
        {notes.map((note) => (
          <li key={note.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{note.author}</p>
              <p className="text-xs text-muted-foreground">{formatDate(note.at)}</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{note.text}</p>
          </li>
        ))}
        {notes.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No notes yet.</p>}
      </ul>
    </div>
  );
}

interface LoanAttachment {
  id: string;
  fileName: string;
  sizeKb: number;
  uploadedAt: string;
}

/**
 * Attachment UI flow works for real (pick a file, see it listed, delete it)
 * — only the actual file storage is not implemented, per this checkpoint's
 * instruction to mark real storage as Coming Soon rather than fake it.
 */
function AttachmentsPanel({ loanId, loanCode }: { loanId: string; loanCode: string }) {
  const { currentAccount } = useRole();
  const generatedDocuments = getGeneratedDocumentsForLoan(loanId);
  const [attachments, setAttachments] = React.useState<LoanAttachment[]>(() => [
    { id: `${loanId}-att-seed`, fileName: 'Signed_Promissory_Note.pdf', sizeKb: 482, uploadedAt: new Date(Date.now() - 30 * 86_400_000).toISOString() },
    { id: `${loanId}-att-seed-2`, fileName: 'Valid_ID_Front.jpg', sizeKb: 214, uploadedAt: new Date(Date.now() - 30 * 86_400_000).toISOString() },
  ]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachments((prev) => [
      { id: `att-${Date.now()}`, fileName: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)), uploadedAt: new Date().toISOString() },
      ...prev,
    ]);
    e.target.value = '';
    logActivity({ userName: currentAccount.name, action: 'UPLOAD_ATTACHMENT', entityType: 'LoanAccount', entityId: loanCode, at: new Date().toISOString() });
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    logActivity({ userName: currentAccount.name, action: 'DELETE_ATTACHMENT', entityType: 'LoanAccount', entityId: loanCode, at: new Date().toISOString() });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium">Generated Loan Documents</p>
        <p className="text-xs text-muted-foreground">
          Official documents generated when this loan account was activated, per the loan product's document templates (see Loan
          Products). Names and metadata only — downloads are disabled in this preview build.
        </p>
        <ul className="mt-3 space-y-2">
          {generatedDocuments.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{doc.documentName}</p>
                  <p className="text-xs text-muted-foreground">
                    Generated by {doc.generatedBy} · {formatDate(doc.generatedAt)}
                  </p>
                </div>
              </div>
              <ComingSoonButton size="sm" variant="ghost">
                Download
              </ComingSoonButton>
            </li>
          ))}
          {generatedDocuments.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No documents generated yet — loan account is not yet activated.</p>
          )}
        </ul>
      </div>

      <Separator />

      <div>
        <p className="text-sm font-medium">Other Attachments</p>
        <div className="mt-2 flex items-center gap-3">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Choose File to Upload
          </Button>
          <ComingSoonButton size="sm">Actual File Storage</ComingSoonButton>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Picking a file adds it to the list below for this preview session — the file itself is never uploaded or stored anywhere.
        </p>
        <ul className="mt-3 space-y-2">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{att.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {att.sizeKb} KB · Uploaded {formatDate(att.uploadedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <ComingSoonButton size="sm" variant="ghost">
                  Download
                </ComingSoonButton>
                <Button variant="ghost" size="icon" onClick={() => removeAttachment(att.id)} aria-label="Delete attachment">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
          {attachments.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No attachments yet.</p>}
        </ul>
      </div>
    </div>
  );
}

/**
 * Automatic Payment Reminders for this loan only — see
 * `MOCK_PAYMENT_REMINDERS`/`buildReminderMessage()` in `src/lib/mockData.ts`
 * for the full 5/3/1-days-before, due-date, and weekly-past-due schedule.
 * No real SMS/email is sent from this preview.
 */
function RemindersPanel({ loanId }: { loanId: string }) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const reminders = MOCK_PAYMENT_REMINDERS.filter((r) => r.loanId === loanId);

  if (reminders.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No reminders scheduled — loan is fully paid or not yet due.</p>;
  }

  return (
    <div className="space-y-3">
      {reminders.map((r) => (
        <div key={r.id} className="rounded-md border">
          <button
            type="button"
            className="flex w-full items-center justify-between p-3 text-left"
            onClick={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
          >
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{REMINDER_TYPE_LABELS[r.reminderType]}</span>
              <span className="text-xs text-muted-foreground">Installment #{r.installmentNumber}</span>
            </div>
            <Badge variant={r.status === 'SENT' ? 'success' : 'outline'}>
              {r.status === 'SENT' ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Sent
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Scheduled
                </span>
              )}
            </Badge>
          </button>
          {expandedId === r.id && (
            <div className="space-y-3 border-t p-3">
              <pre className="whitespace-pre-wrap rounded-md border bg-secondary/40 p-3 text-sm">{buildReminderMessage(r)}</pre>
              <div className="grid gap-1.5 sm:grid-cols-3">
                {r.channels.map((c) => (
                  <div key={c.channel} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      {c.channel === 'SMS' ? <MessageSquareText className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                      {c.channel === 'SMS' ? 'SMS' : 'Email'}
                    </span>
                    <Badge variant={c.sent ? 'success' : 'outline'}>{c.sent ? 'Sent' : 'Scheduled'}</Badge>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <MonitorSmartphone className="h-4 w-4" /> Dashboard
                  </span>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Frontend↔Backend Wiring Pilot, extended 2026-07-08 after CP12. `getMockLoan()` only ever knows
 * about hand-authored mock loans — a loan from `LoanListPage`'s now-real list (a UUID, migrated
 * from legacy data) doesn't exist there and would otherwise hit this page's "not found" state.
 * This is a deliberately minimal real-data view (balances, borrower, repayment schedule, payment
 * history, approve/activate/record-payment actions — wired 2026-07-11) rather than a full
 * rewiring of every tab on this 700+-line page (notes, attachments, AI risk assessment,
 * reminders) — those stay mock-only for now; see
 * `docs/Architecture/FRONTEND_BACKEND_WIRING_PILOT_DESIGN.md` for the wiring pattern this follows.
 */
function RealLoanDetailView({ loanId }: { loanId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentAccount } = useRole();
  const [confirmAction, setConfirmAction] = React.useState<'APPROVE' | 'ACTIVATE' | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  // 2026-07-11 (Reverse Payment feature, user request): correcting a wrongly-entered payment.
  // MIS-only (matches the backend's requireRole('MIS') gate) — see reverseMutation below.
  const [reverseTarget, setReverseTarget] = React.useState<LoanTransaction | null>(null);
  const [reverseReason, setReverseReason] = React.useState('');

  const loanQuery = useQuery({
    queryKey: ['loan-account', loanId],
    queryFn: () => apiClient.get<LoanAccount>(`/loan-accounts/${loanId}`),
    retry: false,
  });
  const loan = loanQuery.data;

  const borrowerQuery = useQuery({
    queryKey: ['borrower', loan?.borrowerId],
    queryFn: () => apiClient.get<RealBorrower>(`/borrowers/${loan!.borrowerId}`),
    enabled: Boolean(loan?.borrowerId),
  });

  const installmentsQuery = useQuery({
    queryKey: ['repayment-schedule', loanId],
    queryFn: () => apiClient.get<PaginatedResponse<RepaymentInstallment>>(`/loan-accounts/${loanId}/repayment-schedule`),
  });

  const transactionsQuery = useQuery({
    queryKey: ['loan-transactions', loanId],
    queryFn: () => fetchAllPages<LoanTransaction>(`/loan-accounts/${loanId}/transactions`),
  });

  // 2026-07-11 (user request, Collections use case): free-text notes on this loan account.
  const notesQuery = useQuery({
    queryKey: ['loan-notes', loanId],
    queryFn: () => apiClient.get<{ items: LoanNote[] }>(`/loan-accounts/${loanId}/notes`),
  });
  const [noteDraft, setNoteDraft] = React.useState('');
  const addNoteMutation = useMutation({
    mutationFn: () => apiClient.post<LoanNote>(`/loan-accounts/${loanId}/notes`, { text: noteDraft.trim() }),
    onSuccess: () => {
      setNoteDraft('');
      void queryClient.invalidateQueries({ queryKey: ['loan-notes', loanId] });
    },
  });
  // 2026-07-11 (user request): MIS-only, permanent delete — the one truly-destructive action in
  // this app's data model (every other record is append-only/reversible). Confirmation dialog is
  // the accidental-click safety net, same as every other consequential action here.
  const [noteToDelete, setNoteToDelete] = React.useState<LoanNote | null>(null);
  const deleteNoteMutation = useMutation({
    mutationFn: () => apiClient.delete<void>(`/loan-accounts/${loanId}/notes/${noteToDelete!.id}`),
    onSuccess: () => {
      setNoteToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['loan-notes', loanId] });
    },
  });

  // ADR-051 (2026-07-12): loan document generation — Disclosure Statement, Promissory Note, and
  // other applicable legal documents, available once the loan is APPROVED.
  const documentsQuery = useQuery({
    queryKey: ['loan-documents', loanId],
    queryFn: () => apiClient.get<{ items: LoanDocumentListItem[] }>(`/loan-accounts/${loanId}/documents`),
  });
  const [selectedDocumentCodes, setSelectedDocumentCodes] = React.useState<Set<string>>(new Set());
  const [docsError, setDocsError] = React.useState<string | null>(null);
  // Tracks which template is mid-generation so its row/button can show progress — generation runs
  // one at a time (bulk actions loop sequentially) rather than firing every request in parallel,
  // since each one shells out to LibreOffice (ADR-051 §4) and doesn't need to race the others.
  const [generatingCode, setGeneratingCode] = React.useState<string | null>(null);

  const generateDocumentMutation = useMutation({
    mutationFn: (documentTemplateCode: string) =>
      apiClient.post(`/loan-accounts/${loanId}/documents`, { documentTemplateCode }, { 'Idempotency-Key': crypto.randomUUID() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loan-documents', loanId] });
    },
  });

  const generateDocuments = async (codes: string[]) => {
    setDocsError(null);
    for (const code of codes) {
      setGeneratingCode(code);
      try {
        await generateDocumentMutation.mutateAsync(code);
      } catch (error) {
        setDocsError(error instanceof ApiError ? error.message : 'Could not reach the server. Check your connection and try again.');
        break; // stop the batch on the first failure rather than piling up more errors
      }
    }
    setGeneratingCode(null);
    setSelectedDocumentCodes(new Set());
  };

  const downloadDocument = async (generatedDocumentId: string) => {
    try {
      const { blob, fileName } = await apiClient.downloadFile(`/loan-accounts/${loanId}/documents/${generatedDocumentId}/download`);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setDocsError('Could not download the file. Please try again.');
    }
  };

  const toggleDocumentSelected = (code: string) => {
    setSelectedDocumentCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const onActionSuccess = () => {
    setConfirmAction(null);
    setActionError(null);
    void queryClient.invalidateQueries({ queryKey: ['loan-account', loanId] });
    void queryClient.invalidateQueries({ queryKey: ['repayment-schedule', loanId] });
    void queryClient.invalidateQueries({ queryKey: ['loan-transactions', loanId] });
    void queryClient.invalidateQueries({ queryKey: ['loan-accounts'] });
  };
  // 2026-07-11 (Reverse Payment feature) — these three ReversePaymentUseCase rejections are also
  // HTTP 409 (see LedgerDomainErrors.ts), but they're permanent, expected business rules, not a
  // transient version conflict — showing the generic "just updated, try again" message for them
  // was actively misleading (a payment that predates this feature will NEVER become reversible by
  // refreshing and retrying). Surface the backend's own already-descriptive message instead.
  const PERMANENT_REVERSAL_REJECTION_CODES = new Set([
    'TRANSACTION_NOT_REVERSIBLE',
    'TRANSACTION_ALREADY_REVERSED',
    'NO_REVERSIBLE_ALLOCATION_DATA',
  ]);
  const onActionError = (error: unknown) => {
    if (error instanceof ApiError) {
      if (PERMANENT_REVERSAL_REJECTION_CODES.has(error.code)) {
        setActionError(error.message);
      } else if (error.status === 409) {
        setActionError('This loan was just updated by another action. Refresh and try again.');
      } else if (error.status === 403) {
        setActionError("You don't have permission to do this.");
      } else {
        setActionError(error.message);
      }
    } else {
      setActionError('Could not reach the server. Check your connection and try again.');
    }
  };

  const approveMutation = useMutation({
    mutationFn: () => apiClient.post<LoanAccount>(`/loan-accounts/${loanId}/approve`, {}),
    onSuccess: onActionSuccess,
    onError: onActionError,
  });
  const activateMutation = useMutation({
    mutationFn: () =>
      apiClient.post<LoanAccount>(`/loan-accounts/${loanId}/activate`, {}, { 'Idempotency-Key': crypto.randomUUID() }),
    onSuccess: onActionSuccess,
    onError: onActionError,
  });
  const actionPending = approveMutation.isPending || activateMutation.isPending;

  const reverseMutation = useMutation({
    mutationFn: () =>
      // Idempotency-Key is derived from the transaction id, not a fresh random one per click
      // (unlike activateMutation above) — a given transaction can only ever be successfully
      // reversed once, so two racing/duplicate attempts at reversing the SAME transaction share
      // this exact key and get deterministically caught by the idempotency layer, rather than one
      // of them hitting a confusing ConcurrencyConflictError. See the backend controller's own
      // doc comment on reversePayment for the full story.
      apiClient.post<LoanAccount>(
        `/loan-accounts/${loanId}/transactions/${reverseTarget!.id}/reverse`,
        { reason: reverseReason.trim() },
        { 'Idempotency-Key': `reverse-payment-${reverseTarget!.id}` },
      ),
    onSuccess: () => {
      setReverseTarget(null);
      setReverseReason('');
      onActionSuccess();
    },
    onError: onActionError,
  });

  const openConfirm = (action: 'APPROVE' | 'ACTIVATE') => {
    setActionError(null);
    setConfirmAction(action);
  };
  const openReverseConfirm = (transaction: LoanTransaction) => {
    setActionError(null);
    setReverseReason('');
    setReverseTarget(transaction);
  };
  const confirmLoanStatusChange = () => {
    if (confirmAction === 'APPROVE') approveMutation.mutate();
    else if (confirmAction === 'ACTIVATE') activateMutation.mutate();
  };

  if (loanQuery.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading loan account…</p>;
  }

  if (!loan) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Loan not found: {loanId}</p>
      </div>
    );
  }

  const borrower = borrowerQuery.data;
  const installments = installmentsQuery.data?.items ?? [];
  const num = (v: string) => Number.parseFloat(v) || 0;
  const paymentHistory = (transactionsQuery.data ?? [])
    .filter((t) => t.type === 'REPAYMENT')
    .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
  // 2026-07-11 (Reverse Payment feature): which REPAYMENT ids already have a REVERSAL pointing at
  // them — computed from the same already-fetched transaction list, no extra request needed.
  const reversedTransactionIds = new Set(
    (transactionsQuery.data ?? []).map((t) => t.reversesTransactionId).filter((id): id is string => id !== null),
  );
  const canRecordPayment = loan.status === 'ACTIVE' || loan.status === 'ACTIVE_IN_ARREARS';
  const canReversePayment = currentAccount.roles.includes('MIS');
  // 2026-07-11 (user request): only MIS may permanently delete a note.
  const canDeleteNotes = currentAccount.roles.includes('MIS');
  // ADR-051 §2: matches GenerateLoanDocumentUseCase's own GENERATABLE_STATUSES gate.
  const canGenerateDocuments = loan.status === 'APPROVED' || loan.status === 'ACTIVE' || loan.status === 'ACTIVE_IN_ARREARS';
  const documents = documentsQuery.data?.items ?? [];
  const requiredDocuments = documents.filter((d) => d.isRequired);
  const ungeneratedRequiredCodes = requiredDocuments.filter((d) => !d.latestGeneration).map((d) => d.documentTemplateCode);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{loan.loanCode}</h2>
          <p className="text-sm text-muted-foreground">
            {borrower ? `${borrower.firstName} ${borrower.lastName}` : 'Loading borrower…'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LoanStatusBadge status={loan.status} />
          {canRecordPayment && <Button onClick={() => navigate(`/payments?loanId=${loan.id}`)}>Record Payment</Button>}
          {loan.status === 'PENDING_APPROVAL' && <Button onClick={() => openConfirm('APPROVE')}>Approve Loan</Button>}
          {loan.status === 'APPROVED' && <Button onClick={() => openConfirm('ACTIVATE')}>Activate Loan</Button>}
        </div>
      </div>

      {actionError && !confirmAction && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
        Real loan account, migrated from legacy data (CP12) — balances and repayment schedule below
        are live. Notes, attachments, AI risk assessment, and approve/activate actions are not yet
        wired to real data for this screen.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Collections Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <BalanceRow label="Principal" value={num(loan.balances.principalBalance)} />
            <BalanceRow label="Interest" value={num(loan.balances.interestBalance)} />
            <BalanceRow label="Fees" value={num(loan.balances.feesBalance)} />
            <BalanceRow label="Penalty" value={num(loan.balances.penaltyBalance)} />
            <Separator className="my-1" />
            <BalanceRow label="Total (collections)" value={num(loan.collectionsBalance)} emphasize />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Loan Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <BalanceRow label="Principal Amount" value={num(loan.principalAmount)} emphasize />
            <div className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-muted-foreground">Interest Rate</span>
              <span className="tabular-nums">{loan.interestRate}%</span>
            </div>
            <div className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-muted-foreground">Installments</span>
              <span className="tabular-nums">{loan.installmentCount}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-muted-foreground">First Repayment</span>
              <span>{formatDate(loan.firstRepaymentDate)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Accounting Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <BalanceRow label="Total (accounting, excl. penalty)" value={num(loan.accountingBalance)} emphasize />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Repayment Schedule</CardTitle>
          <CardDescription>{installments.length} installments.</CardDescription>
        </CardHeader>
        <CardContent>
          {installmentsQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : installments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No repayment schedule found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground">#</TableCell>
                  <TableCell className="font-medium text-muted-foreground">Due Date</TableCell>
                  <TableCell className="text-right font-medium text-muted-foreground">Principal Due</TableCell>
                  <TableCell className="text-right font-medium text-muted-foreground">Interest Due</TableCell>
                  {/* 2026-07-11 (user request): display only — feesDue/penaltyDue are already
                      wired end-to-end (schema/API/DTO), but AmortizationScheduleGenerator never
                      populates them yet (no confirmed Penalty formula — CALCULATION_ENGINE_SPEC.md
                      §12, UNRESOLVED — and no recurring per-installment Fees rule either), so these
                      columns will read ₱0.00 for every installment until that engine exists. */}
                  <TableCell className="text-right font-medium text-muted-foreground">Fees Due</TableCell>
                  <TableCell className="text-right font-medium text-muted-foreground">Penalty Due</TableCell>
                  <TableCell className="text-right font-medium text-muted-foreground">Paid</TableCell>
                  <TableCell className="font-medium text-muted-foreground">Status</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map((i) => {
                  // ADR-050 / CALCULATION_ENGINE_SPEC.md §12: currentPenaltyOwed is a live "as of
                  // today" figure for a prospective (non-migrated) loan — null for a migrated loan,
                  // which falls back to due.penalty, its real historical (fixed) figure instead.
                  const isLivePenalty = i.currentPenaltyOwed !== null;
                  const penaltyDisplay = isLivePenalty ? num(i.currentPenaltyOwed!) : num(i.due.penalty);
                  return (
                    <TableRow key={i.id}>
                      <TableCell>{i.installmentNumber}</TableCell>
                      <TableCell>{formatDate(i.dueDate)}</TableCell>
                      <TableCell className="text-right">{formatPeso(num(i.due.principal))}</TableCell>
                      <TableCell className="text-right">{formatPeso(num(i.due.interest))}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatPeso(num(i.due.fees))}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatPeso(penaltyDisplay)}
                        {isLivePenalty && penaltyDisplay > 0 && (
                          <span className="ml-1 text-[10px] text-muted-foreground/70" title="Live penalty, computed as of today (ADR-050)">
                            (as of today)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatPeso(num(i.paid.principal) + num(i.paid.interest))}</TableCell>
                      <TableCell>
                        <InstallmentStatusBadge status={i.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right">
                    {formatPeso(installments.reduce((sum, i) => sum + num(i.due.principal), 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPeso(installments.reduce((sum, i) => sum + num(i.due.interest), 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPeso(installments.reduce((sum, i) => sum + num(i.paid.principal) + num(i.paid.interest), 0))}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>{paymentHistory.length} payment{paymentHistory.length === 1 ? '' : 's'} posted against this loan.</CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : paymentHistory.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground">Date</TableCell>
                  <TableCell className="font-medium text-muted-foreground">OR#</TableCell>
                  <TableCell className="font-medium text-muted-foreground">AR#</TableCell>
                  <TableCell className="text-right font-medium text-muted-foreground">Principal</TableCell>
                  <TableCell className="text-right font-medium text-muted-foreground">Interest</TableCell>
                  <TableCell className="text-right font-medium text-muted-foreground">Penalty</TableCell>
                  <TableCell className="text-right font-medium text-muted-foreground">Fees</TableCell>
                  <TableCell className="text-right font-medium text-muted-foreground">Amount Paid</TableCell>
                  <TableCell className="text-right font-medium text-muted-foreground">Balance After</TableCell>
                  {canReversePayment && <TableCell className="font-medium text-muted-foreground">&nbsp;</TableCell>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentHistory.map((t) => {
                  const isReversed = reversedTransactionIds.has(t.id);
                  return (
                    <TableRow key={t.id} className={isReversed ? 'opacity-60' : undefined}>
                      <TableCell>
                        {formatDate(t.entryDate)}
                        {isReversed && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            Reversed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.orNumber ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{t.arNumber ?? '—'}</TableCell>
                      <TableCell className="text-right">{formatPeso(num(t.principalComponent))}</TableCell>
                      <TableCell className="text-right">{formatPeso(num(t.interestComponent))}</TableCell>
                      <TableCell className="text-right">{formatPeso(num(t.penaltyComponent))}</TableCell>
                      <TableCell className="text-right">{formatPeso(num(t.feesComponent))}</TableCell>
                      <TableCell className="text-right font-semibold">{formatPeso(num(t.amount))}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatPeso(num(t.balanceAfter))}</TableCell>
                      {canReversePayment && (
                        <TableCell>
                          {!isReversed && (
                            <Button variant="outline" size="sm" onClick={() => openReverseConfirm(t)}>
                              Reverse
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Free-text notes on this loan account — e.g. what was discussed/agreed with the borrower.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-note">Add a note</Label>
            <Textarea
              id="new-note"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Type a note about this loan account..."
              rows={3}
              disabled={addNoteMutation.isPending}
            />
            <Button size="sm" onClick={() => addNoteMutation.mutate()} disabled={!noteDraft.trim() || addNoteMutation.isPending}>
              {addNoteMutation.isPending ? 'Adding…' : 'Add Note'}
            </Button>
          </div>
          <Separator />
          {notesQuery.isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (notesQuery.data?.items.length ?? 0) === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="space-y-3">
              {notesQuery.data!.items.map((note) => (
                <li key={note.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{note.authorName}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{formatDate(note.createdAt)}</p>
                      {canDeleteNotes && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive hover:text-destructive" onClick={() => setNoteToDelete(note)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{note.text}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Disclosure Statement, Promissory Note, and other legal documents applicable to this loan (ADR-051).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canGenerateDocuments ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Available once this loan is approved.</p>
          ) : documentsQuery.isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {docsError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{docsError}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {requiredDocuments.length - ungeneratedRequiredCodes.length} of {requiredDocuments.length} required documents generated
                </p>
                <Button
                  size="sm"
                  onClick={() => generateDocuments(ungeneratedRequiredCodes)}
                  disabled={ungeneratedRequiredCodes.length === 0 || generatingCode !== null}
                >
                  {generatingCode ? 'Generating…' : 'Generate all required'}
                </Button>
              </div>
              <ul className="space-y-2">
                {documents.map((doc) => {
                  const isBusy = generatingCode === doc.documentTemplateCode;
                  return (
                    <li
                      key={doc.documentTemplateId}
                      className={cn('flex items-center justify-between gap-2 rounded-md border p-3', !doc.latestGeneration && 'border-dashed')}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input"
                          checked={selectedDocumentCodes.has(doc.documentTemplateCode)}
                          onChange={() => toggleDocumentSelected(doc.documentTemplateCode)}
                          aria-label={`Select ${doc.documentTemplateName}`}
                        />
                        <FileCheck2 className={cn('h-4 w-4', doc.latestGeneration ? 'text-emerald-600' : 'text-muted-foreground')} />
                        <div>
                          <p className={cn('text-sm font-medium', !doc.latestGeneration && 'text-muted-foreground')}>{doc.documentTemplateName}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.latestGeneration
                              ? `Generated by ${doc.latestGeneration.generatedByName} · ${formatDate(doc.latestGeneration.generatedAt)}`
                              : doc.isRequired
                                ? 'Required · not generated yet'
                                : 'Optional · not generated yet'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {doc.latestGeneration && (
                          <Button variant="ghost" size="sm" onClick={() => downloadDocument(doc.latestGeneration!.id)}>
                            Download
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateDocuments([doc.documentTemplateCode])}
                          disabled={isBusy || generatingCode !== null}
                        >
                          {isBusy ? '…' : doc.latestGeneration ? 'Regenerate' : 'Generate'}
                        </Button>
                      </div>
                    </li>
                  );
                })}
                {documents.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No documents configured for this loan's product.</p>}
              </ul>
              {documents.length > 0 && (
                <div className="flex items-center justify-between border-t pt-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={selectedDocumentCodes.size === documents.length}
                      onChange={(e) =>
                        setSelectedDocumentCodes(e.target.checked ? new Set(documents.map((d) => d.documentTemplateCode)) : new Set())
                      }
                    />
                    Select all
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateDocuments([...selectedDocumentCodes])}
                    disabled={selectedDocumentCodes.size === 0 || generatingCode !== null}
                  >
                    Generate selected ({selectedDocumentCodes.size})
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && !actionPending && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Confirm {confirmAction === 'APPROVE' ? 'approval' : 'disbursement'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'APPROVE'
                ? `This will approve ${loan.loanCode} — the account moves from Pending Approval to Approved, ready to be activated/disbursed. This is a safety-net confirmation to prevent an accidental click.`
                : `This will activate ${loan.loanCode} — disbursing the loan, generating its repayment schedule (${loan.installmentCount} installments starting ${formatDate(loan.firstRepaymentDate)}), and moving it to Active. This is a safety-net confirmation to prevent an accidental click.`}
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={actionPending}>
              Cancel
            </Button>
            <Button onClick={confirmLoanStatusChange} disabled={actionPending}>
              {actionPending ? 'Processing…' : 'Yes, confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reverseTarget !== null}
        onOpenChange={(open) => !open && !reverseMutation.isPending && (setReverseTarget(null), setReverseReason(''))}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Reverse this payment?
            </DialogTitle>
            <DialogDescription>
              {reverseTarget &&
                `This creates a new REVERSAL transaction undoing the ${formatPeso(num(reverseTarget.amount))} payment from ${formatDate(reverseTarget.entryDate)} — the original entry is never edited or deleted, only corrected. After reversing, record the correct payment as a new entry. A reason is required.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reverse-reason">Reason</Label>
            <Textarea
              id="reverse-reason"
              placeholder="e.g. Cashier entered the wrong amount"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              disabled={reverseMutation.isPending}
            />
          </div>
          {actionError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReverseTarget(null);
                setReverseReason('');
              }}
              disabled={reverseMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => reverseMutation.mutate()}
              disabled={reverseMutation.isPending || reverseReason.trim().length === 0}
            >
              {reverseMutation.isPending ? 'Reversing…' : 'Yes, reverse this payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noteToDelete !== null} onOpenChange={(open) => !open && !deleteNoteMutation.isPending && setNoteToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Delete this note?
            </DialogTitle>
            <DialogDescription>
              This permanently deletes the note — unlike everything else in this system, it cannot be undone or reversed afterward.
              {noteToDelete && <span className="mt-2 block rounded-md border bg-secondary/40 p-2 text-xs italic">"{noteToDelete.text}"</span>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteToDelete(null)} disabled={deleteNoteMutation.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteNoteMutation.mutate()} disabled={deleteNoteMutation.isPending}>
              {deleteNoteMutation.isPending ? 'Deleting…' : 'Yes, delete this note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function LoanDetailPage() {
  const { loanId } = useParams<{ loanId: string }>();
  const navigate = useNavigate();
  const { currentAccount } = useRole();
  const [, forceRerender] = React.useState(0);
  const [confirmAction, setConfirmAction] = React.useState<'APPROVE' | 'ACTIVATE' | null>(null);
  useLogPageView('Loan Account Detail', loanId);
  const loan = loanId ? getMockLoan(loanId) : undefined;

  // Computed unconditionally, before the early return below, so both
  // useSortableTable hook calls are never skipped on some renders.
  const installments = MOCK_INSTALLMENTS[loan?.id ?? ''] ?? [];
  const paymentHistory = MOCK_TRANSACTIONS.filter((t) => t.loanAccountId === loan?.id && t.type === 'REPAYMENT');
  const { sorted: sortedInstallments, sort: scheduleSort, toggleSort: toggleScheduleSort } = useSortableTable(
    installments,
    getInstallmentSortValue,
    { key: 'dueDate', direction: 'desc' },
  );
  const { sorted: sortedPaymentHistory, sort: paymentsSort, toggleSort: togglePaymentsSort } = useSortableTable(
    paymentHistory,
    getPaymentHistorySortValue,
    { key: 'entryDate', direction: 'desc' },
  );

  if (!loan) {
    // Not a hand-authored mock loan — try the real backend (a UUID from LoanListPage's now-real
    // list, migrated via CP12). See RealLoanDetailView's own doc comment for scope.
    return loanId ? <RealLoanDetailView loanId={loanId} /> : (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Loan not found.</p>
      </div>
    );
  }

  const timeline = MOCK_TIMELINES[loan.id] ?? [];
  const canRecordPayment = loan.status === 'ACTIVE' || loan.status === 'ACTIVE_IN_ARREARS';
  const borrower = getMockBorrowerForLoan(loan);

  const confirmLoanStatusChange = () => {
    if (confirmAction === 'APPROVE') approveLoanAccount(loan, currentAccount.name);
    else if (confirmAction === 'ACTIVATE') activateLoanAccount(loan, currentAccount.name);
    setConfirmAction(null);
    forceRerender((n) => n + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-1 -ml-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">
              {borrower ? (
                <Link to={`/clients/${borrower.id}`} className="text-primary underline-offset-2 hover:underline">
                  {loan.borrowerName}
                </Link>
              ) : (
                loan.borrowerName
              )}
            </h2>
            <LoanStatusBadge status={loan.status} />
            {loan.isDiscontinuedProduct && <Badge variant="secondary">Discontinued Product</Badge>}
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {loan.loanCode} · {loan.productType} · {loan.branchName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(`/loans/${loan.id}/soa`)}>
            View Statement of Account
          </Button>
          {canRecordPayment ? (
            <Button onClick={() => navigate(`/payments?loanId=${loan.id}`)}>Record Payment</Button>
          ) : (
            <ComingSoonButton>Record Payment</ComingSoonButton>
          )}
          {loan.status === 'APPROVED' && <Button onClick={() => setConfirmAction('ACTIVATE')}>Activate Loan</Button>}
          {loan.status === 'PENDING_APPROVAL' && <Button onClick={() => setConfirmAction('APPROVE')}>Approve Loan</Button>}
        </div>
      </div>

      <AiRiskAssessmentCard loanId={loan.id} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Balance Summary</CardTitle>
            <CardDescription>Per ADR-007 §3 — two distinct totals, both shown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-secondary/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Collections Balance</p>
              <p className="text-xl font-bold">{formatPeso(loan.collectionsBalance)}</p>
              <p className="text-xs text-muted-foreground">Principal + Interest + Fees + Penalty</p>
            </div>
            <div className="mt-3 rounded-md border bg-secondary/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Accounting Balance</p>
              <p className="text-xl font-bold">{formatPeso(loan.accountingBalance)}</p>
              <p className="text-xs text-muted-foreground">Principal + Interest + Fees (penalty excluded)</p>
            </div>

            <Separator className="my-4" />

            <BalanceRow label="Principal balance" value={loan.balances.principalBalance} emphasize />
            <BalanceRow label="Principal paid" value={loan.balances.principalPaid} />
            <BalanceRow label="Principal due" value={loan.balances.principalDue} />
            <Separator className="my-2" />
            <BalanceRow label="Interest balance" value={loan.balances.interestBalance} emphasize />
            <BalanceRow label="Interest paid" value={loan.balances.interestPaid} />
            <BalanceRow label="Interest due" value={loan.balances.interestDue} />
            <Separator className="my-2" />
            <BalanceRow label="Fees balance" value={loan.balances.feesBalance} emphasize />
            <BalanceRow label="Penalty balance" value={loan.balances.penaltyBalance} emphasize />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Loan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="schedule">
              <TabsList>
                <TabsTrigger value="schedule">Repayment Schedule</TabsTrigger>
                <TabsTrigger value="timeline">Status Timeline</TabsTrigger>
                <TabsTrigger value="terms">Loan Terms</TabsTrigger>
                <TabsTrigger value="payments">Payment History</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
                <TabsTrigger value="reminders">Reminders</TabsTrigger>
              </TabsList>

              <TabsContent value="schedule">
                {installments.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No schedule yet — loan has not been activated.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead sortKey="installmentNumber" currentSort={scheduleSort} onSort={toggleScheduleSort}>
                          #
                        </SortableTableHead>
                        <SortableTableHead sortKey="dueDate" currentSort={scheduleSort} onSort={toggleScheduleSort} isDateColumn>
                          Due Date
                        </SortableTableHead>
                        <SortableTableHead
                          sortKey="principalDue"
                          currentSort={scheduleSort}
                          onSort={toggleScheduleSort}
                          className="text-right"
                        >
                          Principal Due
                        </SortableTableHead>
                        <SortableTableHead
                          sortKey="interestDue"
                          currentSort={scheduleSort}
                          onSort={toggleScheduleSort}
                          className="text-right"
                        >
                          Interest Due
                        </SortableTableHead>
                        <SortableTableHead sortKey="paid" currentSort={scheduleSort} onSort={toggleScheduleSort} className="text-right">
                          Paid
                        </SortableTableHead>
                        <SortableTableHead sortKey="status" currentSort={scheduleSort} onSort={toggleScheduleSort}>
                          Status
                        </SortableTableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedInstallments.map((inst) => (
                        <TableRow key={inst.id}>
                          <TableCell>{inst.installmentNumber}</TableCell>
                          <TableCell>{formatDate(inst.dueDate)}</TableCell>
                          <TableCell className="text-right">{formatPeso(inst.due.principal)}</TableCell>
                          <TableCell className="text-right">{formatPeso(inst.due.interest)}</TableCell>
                          <TableCell className="text-right">{formatPeso(inst.paid.principal + inst.paid.interest)}</TableCell>
                          <TableCell>
                            <InstallmentStatusBadge status={inst.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="timeline">
                <ol className="space-y-4 py-2">
                  {timeline.map((event, index) => (
                    <li key={`${event.status}-${event.at}`} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        {index === timeline.length - 1 ? (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                        {index < timeline.length - 1 && <div className="mt-1 h-full w-px flex-1 bg-border" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium">{event.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(event.at)} · {event.actor}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </TabsContent>

              <TabsContent value="terms">
                <dl className="grid grid-cols-2 gap-y-3 text-sm">
                  <dt className="text-muted-foreground">Principal amount</dt>
                  <dd className="text-right font-medium">{formatPeso(loan.principalAmount)}</dd>
                  <dt className="text-muted-foreground">Monthly contractual rate</dt>
                  <dd className="text-right font-medium">{loan.interestRate}%</dd>
                  <dt className="text-muted-foreground">Installment count</dt>
                  <dd className="text-right font-medium">{loan.installmentCount}</dd>
                  <dt className="text-muted-foreground">First repayment date</dt>
                  <dd className="text-right font-medium">{formatDate(loan.firstRepaymentDate)}</dd>
                  {loan.coBorrowerName && (
                    <>
                      <dt className="text-muted-foreground">Co-Borrower</dt>
                      <dd className="text-right font-medium">{loan.coBorrowerName}</dd>
                    </>
                  )}
                  {loan.disbursementBank && (
                    <>
                      <dt className="text-muted-foreground">Bank Name</dt>
                      <dd className="text-right font-medium">{loan.disbursementBank.bankName}</dd>
                      <dt className="text-muted-foreground">Bank Account Number</dt>
                      <dd className="text-right font-medium">{loan.disbursementBank.bankAccountNumber}</dd>
                      <dt className="text-muted-foreground">ATM Card Number</dt>
                      <dd className="text-right font-medium">{loan.disbursementBank.atmCardNumber}</dd>
                      <dt className="text-muted-foreground">Name on Card/Account</dt>
                      <dd className="text-right font-medium">{loan.disbursementBank.nameOnCardOrAccount}</dd>
                    </>
                  )}
                  {loan.sourceApplicationId && (
                    <>
                      <dt className="text-muted-foreground">Originated from</dt>
                      <dd className="text-right font-medium">
                        <Link
                          to={`/applications/${loan.sourceApplicationId}`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          Loan Application
                        </Link>
                      </dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">Loan officer</dt>
                  <dd className="text-right font-medium">{loan.loanOfficerName}</dd>
                  <dt className="text-muted-foreground">Approved at</dt>
                  <dd className="text-right font-medium">{loan.approvedAt ? formatDate(loan.approvedAt) : '—'}</dd>
                  <dt className="text-muted-foreground">Activated at</dt>
                  <dd className="text-right font-medium">{loan.activatedAt ? formatDate(loan.activatedAt) : '—'}</dd>
                  <dt className="text-muted-foreground">Mode of payment</dt>
                  <dd className="text-right">
                    <PaymentMethodBadge code={loan.paymentMethod} />
                  </dd>
                  {loan.collectionAgentName && (
                    <>
                      <dt className="text-muted-foreground">Assigned collection agent</dt>
                      <dd className="text-right font-medium">{loan.collectionAgentName}</dd>
                    </>
                  )}
                  {loan.atmCardOnFile && (
                    <>
                      <dt className="text-muted-foreground">ATM card on file</dt>
                      <dd className="text-right">
                        <Badge variant="outline">Client consent on file</Badge>
                      </dd>
                    </>
                  )}
                </dl>
              </TabsContent>

              <TabsContent value="payments">
                {paymentHistory.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead sortKey="entryDate" currentSort={paymentsSort} onSort={togglePaymentsSort} isDateColumn>
                          Date
                        </SortableTableHead>
                        <SortableTableHead sortKey="amount" currentSort={paymentsSort} onSort={togglePaymentsSort} className="text-right">
                          Amount
                        </SortableTableHead>
                        <SortableTableHead sortKey="paymentMethod" currentSort={paymentsSort} onSort={togglePaymentsSort}>
                          Mode of Payment
                        </SortableTableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedPaymentHistory.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell>{formatDate(txn.entryDate)}</TableCell>
                          <TableCell className="text-right">{formatPeso(txn.amount)}</TableCell>
                          <TableCell>
                            <PaymentMethodBadge code={txn.paymentMethod ?? loan.paymentMethod} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Discontinued channels (e.g. ECPay, Bayad Center) may still appear here as historical reference even though they are
                  no longer offered for new payments.
                </p>
              </TabsContent>

              <TabsContent value="notes">
                <NotesPanel loanId={loan.id} loanCode={loan.loanCode} />
              </TabsContent>

              <TabsContent value="attachments">
                <AttachmentsPanel loanId={loan.id} loanCode={loan.loanCode} />
              </TabsContent>

              <TabsContent value="reminders">
                <RemindersPanel loanId={loan.id} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <RecentActivityPanel
        entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityId === loan.loanCode || l.entityId === loan.id)}
        title="Recent Activity — This Loan Account"
      />

      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Confirm {confirmAction === 'APPROVE' ? 'approval' : 'disbursement'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'APPROVE'
                ? `This will approve ${loan.loanCode} — the account moves from Pending Approval to Approved, ready to be activated/disbursed. This is a safety-net confirmation to prevent an accidental click.`
                : `This will activate ${loan.loanCode} — disbursing the loan, generating its repayment schedule (${loan.installmentCount} installments starting ${formatDate(loan.firstRepaymentDate)}), and moving it to Active. This is a safety-net confirmation to prevent an accidental click.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button onClick={confirmLoanStatusChange}>Yes, confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
