import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, MessageSquareText, MonitorSmartphone, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import {
  buildReminderMessage,
  MOCK_ACTIVITY_LOGS,
  MOCK_PAYMENT_REMINDERS,
  REMINDER_TYPE_LABELS,
  type MockPaymentReminder,
  type PaymentReminderType,
} from '@/lib/mockData';
import { formatDate, formatPeso } from '@/lib/utils';

const TYPE_OPTIONS: { value: PaymentReminderType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All reminder types' },
  { value: 'FIVE_DAYS_BEFORE', label: REMINDER_TYPE_LABELS.FIVE_DAYS_BEFORE },
  { value: 'THREE_DAYS_BEFORE', label: REMINDER_TYPE_LABELS.THREE_DAYS_BEFORE },
  { value: 'ONE_DAY_BEFORE', label: REMINDER_TYPE_LABELS.ONE_DAY_BEFORE },
  { value: 'DUE_DATE', label: REMINDER_TYPE_LABELS.DUE_DATE },
  { value: 'PAST_DUE_WEEKLY', label: REMINDER_TYPE_LABELS.PAST_DUE_WEEKLY },
];

const STATUS_OPTIONS = ['ALL', 'SENT', 'SCHEDULED'] as const;

function MessagePreviewDialog({ reminder, onClose }: { reminder: MockPaymentReminder | null; onClose: () => void }) {
  if (!reminder) return null;
  return (
    <Dialog open={!!reminder} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reminder Message Preview</DialogTitle>
          <DialogDescription>
            {reminder.loanCode} · {REMINDER_TYPE_LABELS[reminder.reminderType]} · {reminder.status === 'SENT' ? 'Sent' : 'Scheduled'}{' '}
            {formatDate(reminder.triggerDate)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <pre className="whitespace-pre-wrap rounded-md border bg-secondary/40 p-3 text-sm">{buildReminderMessage(reminder)}</pre>
          <div className="space-y-1.5">
            {reminder.channels.map((c) => (
              <div key={c.channel} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {c.channel === 'SMS' ? <MessageSquareText className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  <span>{c.channel === 'SMS' ? 'SMS' : 'Email'}</span>
                  <span className="text-xs text-muted-foreground">{c.recipient}</span>
                </div>
                <Badge variant={c.sent ? 'success' : 'outline'}>
                  {c.sent ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Sent
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Scheduled
                    </span>
                  )}
                </Badge>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4" />
                <span>Client Easycash Account Dashboard</span>
              </div>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Preview only — no real SMS/email is sent from this build. "Sent" simply means this reminder's trigger date has already
            passed; a real notification service is future work (see CP13+).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Automatic Payment Reminders — system-generated schedule (5/3/1 days
 * before due, on the due date, and weekly while past due), sent via SMS and
 * Email. Fully mock: no real notification service runs here. See
 * `MOCK_PAYMENT_REMINDERS` in `src/lib/mockData.ts` for the generation
 * logic and `buildReminderMessage()` for the exact message content.
 */
export function PaymentRemindersPage() {
  useLogPageView('Payment Reminders');
  const navigate = useNavigate();
  const [status, setStatus] = React.useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [type, setType] = React.useState<PaymentReminderType | 'ALL'>('ALL');
  const [previewing, setPreviewing] = React.useState<MockPaymentReminder | null>(null);

  const filtered = MOCK_PAYMENT_REMINDERS.filter((r) => {
    const matchesStatus = status === 'ALL' || r.status === status;
    const matchesType = type === 'ALL' || r.reminderType === type;
    return matchesStatus && matchesType;
  });

  const sentCount = MOCK_PAYMENT_REMINDERS.filter((r) => r.status === 'SENT').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Payment Reminders</h2>
        <p className="text-sm text-muted-foreground">
          {MOCK_PAYMENT_REMINDERS.length} sample reminders across active loan accounts ({sentCount} sent) — automatic schedule: 5 days
          before due, 3 days before, 1 day before, due date, and weekly while past due. Sent via SMS and Email; client dashboard channel
          is Coming Soon.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Reminder Schedule</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={status} onValueChange={(v) => setStatus(v as (typeof STATUS_OPTIONS)[number])}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'ALL' ? 'All statuses' : s === 'SENT' ? 'Sent' : 'Scheduled'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => setType(v as PaymentReminderType | 'ALL')}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan Account</TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>Reminder</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount Due</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="cursor-pointer font-mono text-xs" onClick={() => navigate(`/loans/${r.loanId}`)}>
                    {r.loanCode}
                  </TableCell>
                  <TableCell className="font-medium">{r.borrowerName}</TableCell>
                  <TableCell>
                    <Badge variant={r.reminderType === 'PAST_DUE_WEEKLY' ? 'destructive' : 'outline'}>
                      {REMINDER_TYPE_LABELS[r.reminderType]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(r.dueDate)}</TableCell>
                  <TableCell className="text-right">{formatPeso(r.installmentAmountDue + r.penaltyDue)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setPreviewing(r)}>
                      Preview Message
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No sample reminders match your filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Payment Reminders')} title="Recent Activity — Payment Reminders" />

      <MessagePreviewDialog reminder={previewing} onClose={() => setPreviewing(null)} />
    </div>
  );
}
