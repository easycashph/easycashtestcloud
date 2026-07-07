import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bell, CheckCircle2, Circle, Clock, Mail, MessageSquareText, MonitorSmartphone, Paperclip, Sparkles, Trash2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  buildReminderMessage,
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

interface LoanNote {
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
  const [notes, setNotes] = React.useState<LoanNote[]>(() => [
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" /> Choose File to Upload
        </Button>
        <ComingSoonButton size="sm">Actual File Storage</ComingSoonButton>
      </div>
      <p className="text-xs text-muted-foreground">
        Picking a file adds it to the list below for this preview session — the file itself is never uploaded or stored anywhere.
      </p>
      <ul className="space-y-2">
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

export function LoanDetailPage() {
  const { loanId } = useParams<{ loanId: string }>();
  const navigate = useNavigate();
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
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Sample loan not found: {loanId}</p>
      </div>
    );
  }

  const timeline = MOCK_TIMELINES[loan.id] ?? [];
  const canRecordPayment = loan.status === 'ACTIVE' || loan.status === 'ACTIVE_IN_ARREARS';
  const borrower = getMockBorrowerForLoan(loan);

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
          {loan.status === 'APPROVED' && <ComingSoonButton>Activate Loan</ComingSoonButton>}
          {loan.status === 'PENDING_APPROVAL' && <ComingSoonButton>Approve Loan</ComingSoonButton>}
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
                  Discontinued channels (e.g. DragonPay, ECPay) may still appear here as historical reference even though they are no
                  longer offered for new payments.
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
    </div>
  );
}
