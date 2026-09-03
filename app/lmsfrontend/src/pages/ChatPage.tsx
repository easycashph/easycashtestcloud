import * as React from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck, Copy, MessageSquareText, Paperclip, Plus, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiClient, downloadFile, uploadFile } from '@/lib/apiClient';
import { playChatNotificationSound } from '@/lib/chatNotificationSound';
import { useRole } from '@/lib/roleContext';

/** How long after the last typing heartbeat we still show "typing…" (2026-08-20 user request,
 * BPO-style support) - matches the Portal widget's own constant. */
const TYPING_INDICATOR_TTL_MS = 6000;
const TYPING_HEARTBEAT_THROTTLE_MS = 2500;
/** How often this tab re-asserts its current presence status while open (2026-08-20) - keeps
 * "Online" from silently going stale if the agent just leaves the tab open without switching
 * away; a closed tab simply stops heartbeating and reads as stale to anyone checking timestamps. */
const PRESENCE_HEARTBEAT_MS = 60000;

function isRecentlyActive(timestamp: string | null, ttlMs: number): boolean {
  if (!timestamp) return false;
  return Date.now() - new Date(timestamp).getTime() < ttlMs;
}

/** Standardized display labels for the real, short role names stored in the database
 * (2026-08-03 user request) - shown everywhere a role type appears in the chat feature. The
 * underlying stored role names (MIS, CRM, Collection Officer, ...) are unchanged - this is
 * display-only, scoped to this page. */
const ROLE_TYPE_LABELS: Record<string, string> = {
  Accounting: 'Accounting',
  'Collection Officer': 'Collection',
  CRM: 'Customer Relation Management',
  Finance: 'Finance',
  'Loan Operation Manager': 'Loan Operation Management',
  MIS: 'Management Information System',
};

function roleTypeLabel(name: string): string {
  return ROLE_TYPE_LABELS[name] ?? name;
}

interface ChatParticipant {
  userId: string;
  userName: string;
  joinedAt: string;
  leftAt: string | null;
  leftReason: 'TRANSFERRED' | 'CLOSED' | null;
}

interface ChatConversation {
  id: string;
  portalAccountId: string;
  /** 2026-08-03 (user request) - groups "My Chats" per client instead of a flat list. */
  portalAccountEmail: string | null;
  status: 'WAITING' | 'CLAIMED' | 'PENDING_TRANSFER' | 'CLOSED';
  claimedByUserId: string | null;
  claimedByUserName: string | null;
  originalClaimedByUserId: string | null;
  originalClaimedByUserName: string | null;
  pendingTransferToUserId: string | null;
  pendingTransferToUserName: string | null;
  pendingTransferFromUserId: string | null;
  pendingTransferFromUserName: string | null;
  pendingTransferPin: string | null;
  /** Full hand-off chain, oldest first (2026-08-03 user request, "trackable chat logs"). */
  participants: ChatParticipant[];
  createdAt: string;
  claimedAt: string | null;
  closedAt: string | null;
  /** BPO-style UX (2026-08-20 user request). */
  portalLastReadAt: string | null;
  staffLastReadAt: string | null;
  portalTypingAt: string | null;
  staffTypingAt: string | null;
  rating: number | null;
  ratingComment: string | null;
  ratedAt: string | null;
}

interface ChatCannedResponse {
  id: string;
  title: string;
  body: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: 'PORTAL_ACCOUNT' | 'STAFF' | 'SYSTEM';
  senderUserId: string | null;
  senderUserName: string | null;
  body: string | null;
  attachment: { id: string; fileName: string } | null;
  createdAt: string;
}

interface ChatClientLoanApplication {
  id: string;
  applicantName: string;
  requestedCategory: string;
  status: string;
}

interface ChatClientInfo {
  portalAccountEmail: string | null;
  loanApplications: ChatClientLoanApplication[];
}

interface StaffChatView {
  conversation: ChatConversation;
  messages: ChatMessage[];
  isReadOnly: boolean;
  client: ChatClientInfo;
}

interface ChatOversightStaffSummary {
  id: string;
  name: string;
  roles: string[];
}

interface RoleTypeRecord {
  id: string;
  name: string;
}

interface RoleClassRecord {
  id: string;
  roleId: string;
  roleName: string;
  name: string;
}

interface ChatTransferCandidate {
  id: string;
  name: string;
  roles: string[];
  roleClassName: string | null;
}

const POLL_INTERVAL_MS = 4000;

/**
 * Portal<->LMS support chat, staff side (2026-07-31 user request, transfer redesign) - a
 * call-center-style claim queue for brand-new requests ("Waiting", eligibility server-decided -
 * see ChatEligibility.ts), but a DIRECT hand-off for transfers: the current claimant picks any LMS
 * user (Role -> Role Class -> person) and sets a 4-digit PIN; the recipient sees the pending
 * transfer (PIN included) under "Incoming Transfers" and pastes it back to take over. Polling,
 * not WebSockets - matches the Portal widget's own tradeoff (see its doc comment).
 */
export function ChatPage() {
  const { canManageMembers: isMis, hasPermission } = useRole();
  const canManageCannedResponses = hasPermission('chat_canned_response.manage');

  const [queue, setQueue] = React.useState<ChatConversation[] | null>(null);
  const [mine, setMine] = React.useState<ChatConversation[] | null>(null);
  const [incomingTransfers, setIncomingTransfers] = React.useState<ChatConversation[] | null>(null);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [view, setView] = React.useState<StaffChatView | null>(null);
  const [draft, setDraft] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // MIS-only "Staff Chat Oversight" (2026-07-31 user request) - a read-only window into any
  // staff member's chat history, any status.
  const [oversightStaff, setOversightStaff] = React.useState<ChatOversightStaffSummary[] | null>(null);
  const [oversightStaffId, setOversightStaffId] = React.useState<string | null>(null);
  const [oversightConversations, setOversightConversations] = React.useState<ChatConversation[] | null>(null);
  const [oversightMode, setOversightMode] = React.useState(false);

  // Transfer redesign state - Role -> Role Class -> person, plus the 4-digit PIN.
  const [roleTypes, setRoleTypes] = React.useState<RoleTypeRecord[]>([]);
  const [roleClasses, setRoleClasses] = React.useState<RoleClassRecord[]>([]);
  const [transferCandidates, setTransferCandidates] = React.useState<ChatTransferCandidate[]>([]);
  const [showTransferPanel, setShowTransferPanel] = React.useState(false);
  const [transferRole, setTransferRole] = React.useState('');
  const [transferRoleClass, setTransferRoleClass] = React.useState('');
  const [transferToUserId, setTransferToUserId] = React.useState('');
  const [transferPin, setTransferPin] = React.useState('');
  const [transferError, setTransferError] = React.useState<string | null>(null);
  const [isTransferring, setIsTransferring] = React.useState(false);
  const [confirmPinDrafts, setConfirmPinDrafts] = React.useState<Record<string, string>>({});
  const [confirmError, setConfirmError] = React.useState<string | null>(null);

  // BPO-style presence (2026-08-20 user request) - the agent's own explicit Online/Away/Offline
  // toggle, re-asserted periodically while this tab stays open. No reliable way to detect the tab
  // actually closing while still able to send an authenticated request, so a status just goes
  // stale (readable from its own `updatedAt`) rather than flipping to Offline automatically.
  const [myStatus, setMyStatus] = React.useState<'ONLINE' | 'AWAY' | 'OFFLINE'>('ONLINE');
  const lastTypingSentAtRef = React.useRef(0);

  // Canned/quick responses (2026-08-20 user request) - shared library, MIS-managed.
  const [cannedResponses, setCannedResponses] = React.useState<ChatCannedResponse[]>([]);
  const [showCannedPicker, setShowCannedPicker] = React.useState(false);
  const [showCannedManager, setShowCannedManager] = React.useState(false);
  const [cannedDraftTitle, setCannedDraftTitle] = React.useState('');
  const [cannedDraftBody, setCannedDraftBody] = React.useState('');
  const [editingCannedId, setEditingCannedId] = React.useState<string | null>(null);

  const refreshCannedResponses = React.useCallback(() => {
    apiClient
      .get<ChatCannedResponse[]>('/chat/canned-responses')
      .then(setCannedResponses)
      .catch(() => setCannedResponses([]));
  }, []);

  React.useEffect(() => {
    refreshCannedResponses();
  }, [refreshCannedResponses]);

  const sendPresence = React.useCallback((status: 'ONLINE' | 'AWAY' | 'OFFLINE') => {
    apiClient.post('/chat/presence', { status }).catch(() => {});
  }, []);

  React.useEffect(() => {
    sendPresence(myStatus);
    if (myStatus === 'OFFLINE') return;
    const timer = window.setInterval(() => sendPresence(myStatus), PRESENCE_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStatus]);

  const resetCannedDraft = () => {
    setCannedDraftTitle('');
    setCannedDraftBody('');
    setEditingCannedId(null);
  };

  const handleSaveCannedResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cannedDraftTitle.trim() || !cannedDraftBody.trim()) return;
    try {
      if (editingCannedId) {
        await apiClient.patch(`/chat/canned-responses/${editingCannedId}`, { title: cannedDraftTitle, body: cannedDraftBody });
      } else {
        await apiClient.post('/chat/canned-responses', { title: cannedDraftTitle, body: cannedDraftBody });
      }
      resetCannedDraft();
      refreshCannedResponses();
    } catch {
      // Best-effort - the form stays open so they can retry.
    }
  };

  const handleDeleteCannedResponse = async (id: string) => {
    await apiClient.delete(`/chat/canned-responses/${id}`);
    refreshCannedResponses();
  };

  React.useEffect(() => {
    apiClient
      .get<{ roleTypes: RoleTypeRecord[]; roleClasses: RoleClassRecord[] }>('/role-classes')
      .then((res) => {
        setRoleTypes(res.roleTypes);
        setRoleClasses(res.roleClasses);
      })
      .catch(() => {});
    apiClient
      .get<ChatTransferCandidate[]>('/chat/transfer-candidates')
      .then(setTransferCandidates)
      .catch(() => setTransferCandidates([]));
  }, []);

  React.useEffect(() => {
    if (!isMis) return;
    apiClient
      .get<ChatOversightStaffSummary[]>('/chat/oversight/staff')
      .then(setOversightStaff)
      .catch(() => setOversightStaff([]));
  }, [isMis]);

  const handleSelectOversightStaff = (staffId: string) => {
    setOversightStaffId(staffId);
    setOversightConversations(null);
    apiClient
      .get<ChatConversation[]>(`/chat/oversight/staff/${staffId}/conversations`)
      .then(setOversightConversations)
      .catch(() => setOversightConversations([]));
  };

  const handleSelectOversightConversation = (id: string) => {
    setOversightMode(true);
    setActiveConversationId(id);
  };

  const refreshLists = React.useCallback(() => {
    apiClient
      .get<ChatConversation[]>('/chat/queue')
      .then(setQueue)
      .catch(() => setQueue([]));
    apiClient
      .get<ChatConversation[]>('/chat/mine')
      .then(setMine)
      .catch(() => setMine([]));
    apiClient
      .get<ChatConversation[]>('/chat/incoming-transfers')
      .then(setIncomingTransfers)
      .catch(() => setIncomingTransfers([]));
  }, []);

  React.useEffect(() => {
    refreshLists();
    const timer = window.setInterval(refreshLists, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refreshLists]);

  // 2026-09-03 (user request, chat notification sound): the message count last seen for whichever
  // conversation is currently active - null right after switching conversations, so opening one
  // never chimes for messages that were already there. Set from every load below.
  const lastSeenMessageCountRef = React.useRef<number | null>(null);

  const loadConversation = React.useCallback((id: string, viaOversight: boolean) => {
    apiClient
      .get<StaffChatView>(viaOversight ? `/chat/oversight/conversations/${id}` : `/chat/${id}`)
      .then((next) => {
        const previousCount = lastSeenMessageCountRef.current;
        const newestMessage = next.messages[next.messages.length - 1];
        if (previousCount !== null && next.messages.length > previousCount && newestMessage?.senderType === 'PORTAL_ACCOUNT') {
          playChatNotificationSound();
        }
        lastSeenMessageCountRef.current = next.messages.length;
        setView(next);
      })
      .catch(() => setView(null));
  }, []);

  React.useEffect(() => {
    if (!activeConversationId) return;
    lastSeenMessageCountRef.current = null;
    loadConversation(activeConversationId, oversightMode);
    const timer = window.setInterval(() => loadConversation(activeConversationId, oversightMode), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeConversationId, oversightMode, loadConversation]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [view?.messages]);

  const handleClaim = async (id: string) => {
    setActionError(null);
    try {
      await apiClient.post(`/chat/${id}/claim`);
      refreshLists();
      setOversightMode(false);
      setActiveConversationId(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not claim this conversation - someone else may have just taken it.');
      refreshLists();
    }
  };

  const openTransferPanel = () => {
    setTransferRole('');
    setTransferRoleClass('');
    setTransferToUserId('');
    setTransferPin('');
    setTransferError(null);
    setShowTransferPanel(true);
  };

  const candidatesForSelection = transferCandidates.filter(
    (c) => c.roles.includes(transferRole) && (!transferRoleClass || c.roleClassName === transferRoleClass),
  );

  const handleInitiateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversationId || !transferToUserId || !/^\d{4}$/.test(transferPin)) return;
    setIsTransferring(true);
    setTransferError(null);
    try {
      await apiClient.post(`/chat/${activeConversationId}/transfer/initiate`, { toUserId: transferToUserId, pin: transferPin });
      setShowTransferPanel(false);
      loadConversation(activeConversationId, false);
      refreshLists();
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Could not start the transfer.');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!activeConversationId) return;
    await apiClient.post(`/chat/${activeConversationId}/transfer/cancel`);
    loadConversation(activeConversationId, false);
    refreshLists();
  };

  const handleCompleteTransfer = async (conversationId: string) => {
    setConfirmError(null);
    const pin = confirmPinDrafts[conversationId] ?? '';
    try {
      await apiClient.post(`/chat/${conversationId}/transfer/complete`, { pin });
      setConfirmPinDrafts((prev) => ({ ...prev, [conversationId]: '' }));
      refreshLists();
      setOversightMode(false);
      setActiveConversationId(conversationId);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'That PIN did not match - try copying it again.');
    }
  };

  const handleClose = async () => {
    if (!activeConversationId) return;
    await apiClient.post(`/chat/${activeConversationId}/close`);
    loadConversation(activeConversationId, false);
    refreshLists();
  };

  const sendTypingHeartbeat = () => {
    if (!activeConversationId) return;
    const now = Date.now();
    if (now - lastTypingSentAtRef.current < TYPING_HEARTBEAT_THROTTLE_MS) return;
    lastTypingSentAtRef.current = now;
    apiClient.post(`/chat/${activeConversationId}/typing`).catch(() => {});
  };

  const insertCannedResponse = (response: ChatCannedResponse) => {
    setDraft((prev) => (prev.trim() ? `${prev}\n${response.body}` : response.body));
    setShowCannedPicker(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversationId || (!draft.trim() && !file) || isSending) return;
    setIsSending(true);
    try {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('body', draft.trim());
        await uploadFile(`/chat/${activeConversationId}/messages`, formData);
      } else {
        await apiClient.post(`/chat/${activeConversationId}/messages`, { body: draft.trim() });
      }
      setDraft('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadConversation(activeConversationId, false);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
      <div className="flex flex-col gap-4 overflow-y-auto">
        {/* BPO-style presence (2026-08-20 user request) - the agent's own status, visible to the
            Portal widget for whichever client they're currently claimed by. */}
        <Card>
          <CardContent className="flex items-center justify-between gap-2 py-3">
            <span className="text-xs font-medium text-muted-foreground">My status</span>
            <div className="flex gap-1.5">
              {(['ONLINE', 'AWAY', 'OFFLINE'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setMyStatus(status)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                    myStatus === status ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      status === 'ONLINE' ? 'bg-success' : status === 'AWAY' ? 'bg-warning' : 'bg-muted-foreground/50'
                    }`}
                  />
                  {status === 'ONLINE' ? 'Online' : status === 'AWAY' ? 'Away' : 'Offline'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Waiting ({queue?.length ?? '…'})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {queue === null && <p className="text-xs text-muted-foreground">Loading…</p>}
            {queue?.length === 0 && <p className="text-xs text-muted-foreground">No one is waiting right now.</p>}
            {queue?.map((conversation) => (
              <div key={conversation.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div>
                  <p className="font-medium">Chat request</p>
                  <p className="text-xs text-muted-foreground">{new Date(conversation.createdAt).toLocaleTimeString()}</p>
                </div>
                <Button size="sm" onClick={() => handleClaim(conversation.id)}>
                  Answer
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {incomingTransfers && incomingTransfers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Incoming Transfers ({incomingTransfers.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {confirmError && <p className="text-xs text-destructive">{confirmError}</p>}
              {incomingTransfers.map((conversation) => (
                <div key={conversation.id} className="space-y-2 rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">From {conversation.pendingTransferFromUserName}</p>
                  <div className="flex items-center justify-between gap-2 rounded bg-muted px-2 py-1">
                    <span className="font-mono text-sm tracking-widest">{conversation.pendingTransferPin}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Copy PIN"
                      onClick={() => navigator.clipboard?.writeText(conversation.pendingTransferPin ?? '')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste PIN"
                      maxLength={4}
                      value={confirmPinDrafts[conversation.id] ?? ''}
                      onChange={(e) => setConfirmPinDrafts((prev) => ({ ...prev, [conversation.id]: e.target.value }))}
                    />
                    <Button size="sm" onClick={() => handleCompleteTransfer(conversation.id)}>
                      Take Over
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">My Chats ({mine?.length ?? '…'})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mine?.length === 0 && <p className="text-xs text-muted-foreground">Nothing here yet.</p>}
            {/* 2026-08-03 (user request): grouped per client instead of a flat list, so
                backtracking through a specific person's chat history isn't confusing. */}
            {mine && mine.length > 0 && (
              <>
                {Object.entries(
                  mine.reduce<Record<string, ChatConversation[]>>((groups, conversation) => {
                    const key = conversation.portalAccountEmail ?? conversation.portalAccountId;
                    (groups[key] ??= []).push(conversation);
                    return groups;
                  }, {}),
                ).map(([clientKey, conversations]) => (
                  <div key={clientKey} className="space-y-1.5">
                    <p className="truncate text-xs font-semibold text-muted-foreground">{clientKey}</p>
                    <div className="space-y-1.5">
                      {conversations.map((conversation) => {
                        const isActive = conversation.status === 'CLAIMED';
                        return (
                          <button
                            key={conversation.id}
                            type="button"
                            onClick={() => {
                              setOversightMode(false);
                              setActiveConversationId(conversation.id);
                            }}
                            className={`w-full rounded-md border p-2 text-left text-sm hover:bg-accent ${!isActive ? 'opacity-60 grayscale' : ''} ${!oversightMode && activeConversationId === conversation.id ? 'border-primary bg-accent' : ''}`}
                          >
                            <p className="font-medium">
                              {conversation.status === 'CLOSED'
                                ? 'Closed conversation'
                                : conversation.status === 'PENDING_TRANSFER'
                                  ? 'Transfer pending'
                                  : isActive
                                    ? 'Active conversation'
                                    : 'Transferred away (read-only)'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Started {new Date(conversation.createdAt).toLocaleString()}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {isMis && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Staff Chat Oversight</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">MIS-only. Review any staff member's chat history.</p>
              <select
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={oversightStaffId ?? ''}
                onChange={(e) => (e.target.value ? handleSelectOversightStaff(e.target.value) : setOversightStaffId(null))}
              >
                <option value="">Select a staff member…</option>
                {oversightStaff?.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} ({staff.roles.map(roleTypeLabel).join(', ')})
                  </option>
                ))}
              </select>
              {oversightStaffId && (
                <div className="space-y-2">
                  {oversightConversations === null && <p className="text-xs text-muted-foreground">Loading…</p>}
                  {oversightConversations?.length === 0 && <p className="text-xs text-muted-foreground">No chats for this staff member yet.</p>}
                  {oversightConversations?.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => handleSelectOversightConversation(conversation.id)}
                      className={`w-full rounded-md border p-2 text-left text-sm hover:bg-accent ${oversightMode && activeConversationId === conversation.id ? 'border-primary bg-accent' : ''}`}
                    >
                      <p className="font-medium">{conversation.status === 'CLOSED' ? 'Closed conversation' : 'Active conversation'}</p>
                      <p className="text-xs text-muted-foreground">{new Date(conversation.createdAt).toLocaleString()}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {canManageCannedResponses && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Canned Responses</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  resetCannedDraft();
                  setShowCannedManager((v) => !v);
                }}
              >
                {showCannedManager ? 'Close' : <Plus className="h-3.5 w-3.5" />}
              </Button>
            </CardHeader>
            {showCannedManager && (
              <CardContent className="space-y-3">
                <form onSubmit={handleSaveCannedResponse} className="space-y-2 rounded-md border p-2.5">
                  <Input placeholder="Title (e.g. Application Status)" value={cannedDraftTitle} onChange={(e) => setCannedDraftTitle(e.target.value)} />
                  <textarea
                    placeholder="Response text"
                    value={cannedDraftBody}
                    onChange={(e) => setCannedDraftBody(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={!cannedDraftTitle.trim() || !cannedDraftBody.trim()}>
                      {editingCannedId ? 'Save' : 'Add'}
                    </Button>
                    {editingCannedId && (
                      <Button type="button" size="sm" variant="outline" onClick={resetCannedDraft}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
                <div className="space-y-1.5">
                  {cannedResponses.length === 0 && <p className="text-xs text-muted-foreground">No canned responses yet.</p>}
                  {cannedResponses.map((response) => (
                    <div key={response.id} className="flex items-start justify-between gap-2 rounded-md border p-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          setEditingCannedId(response.id);
                          setCannedDraftTitle(response.title);
                          setCannedDraftBody(response.body);
                        }}
                      >
                        <p className="truncate text-xs font-medium">{response.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{response.body}</p>
                      </button>
                      <button
                        type="button"
                        aria-label="Delete canned response"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteCannedResponse(response.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>

      <Card className="flex flex-col overflow-hidden">
        {!view ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a waiting request or one of your chats.
          </div>
        ) : (
          <>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b py-3">
              <div>
                <CardTitle className="text-sm">
                  {oversightMode
                    ? 'Oversight view (read-only)'
                    : view.conversation.status === 'CLOSED'
                      ? 'Closed conversation'
                      : view.isReadOnly
                        ? 'Transferred away (read-only)'
                        : view.conversation.status === 'PENDING_TRANSFER'
                          ? 'Transfer pending confirmation'
                          : 'Client conversation'}
                </CardTitle>
                {view.client.portalAccountEmail && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Chatting with: {view.client.portalAccountEmail}
                    {isRecentlyActive(view.conversation.portalTypingAt, TYPING_INDICATOR_TTL_MS) && (
                      <span className="ml-2 italic text-primary">typing…</span>
                    )}
                  </p>
                )}
                {view.client.loanApplications.length > 0 && (
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs">
                    {view.client.loanApplications.map((application) => (
                      <Link
                        key={application.id}
                        to={`/applications/${application.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {application.requestedCategory} - {application.applicantName} ({application.status})
                      </Link>
                    ))}
                  </p>
                )}
                {view.conversation.participants.length > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {view.conversation.participants
                      .map((p) => `${p.userName}${p.leftAt ? ` (${p.leftReason === 'TRANSFERRED' ? 'transferred' : 'closed'})` : ''}`)
                      .join(' → ')}
                  </p>
                )}
                {actionError && <p className="text-xs text-destructive">{actionError}</p>}
              </div>
              {!oversightMode && !view.isReadOnly && view.conversation.status === 'CLAIMED' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={openTransferPanel}>
                    Transfer
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                </div>
              )}
              {!oversightMode && !view.isReadOnly && view.conversation.status === 'PENDING_TRANSFER' && (
                <Button size="sm" variant="outline" onClick={handleCancelTransfer}>
                  Cancel Transfer
                </Button>
              )}
            </CardHeader>

            {showTransferPanel && (
              <form onSubmit={handleInitiateTransfer} className="space-y-3 border-b bg-muted/40 p-4">
                <p className="text-sm font-medium">Transfer this conversation</p>
                {transferError && <p className="text-xs text-destructive">{transferError}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={transferRole}
                    onChange={(e) => {
                      setTransferRole(e.target.value);
                      setTransferRoleClass('');
                      setTransferToUserId('');
                    }}
                    required
                  >
                    <option value="">Select role type…</option>
                    {roleTypes.map((role) => (
                      <option key={role.id} value={role.name}>
                        {roleTypeLabel(role.name)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={transferRoleClass}
                    onChange={(e) => {
                      setTransferRoleClass(e.target.value);
                      setTransferToUserId('');
                    }}
                    disabled={!transferRole}
                    required
                  >
                    <option value="">Select role class…</option>
                    {roleClasses.filter((rc) => rc.roleName === transferRole).map((rc) => (
                      <option key={rc.id} value={rc.name}>
                        {rc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <select
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={transferToUserId}
                  onChange={(e) => setTransferToUserId(e.target.value)}
                  disabled={!transferRoleClass}
                  required
                >
                  <option value="">Select staff member…</option>
                  {candidatesForSelection.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Set a 4-digit PIN"
                  inputMode="numeric"
                  maxLength={4}
                  value={transferPin}
                  onChange={(e) => setTransferPin(e.target.value.replace(/\D/g, ''))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Share this PIN with them however you normally would (in person, call, etc.) - they'll also see it themselves under
                  "Incoming Transfers" and need to paste it back to confirm.
                </p>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={isTransferring || !transferToUserId || !/^\d{4}$/.test(transferPin)}>
                    {isTransferring ? 'Starting…' : 'Start Transfer'}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowTransferPanel(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            <div ref={scrollRef} className={`flex-1 space-y-3 overflow-y-auto p-4 ${view.isReadOnly || oversightMode ? 'opacity-70 grayscale' : ''}`}>
              {(() => {
                const lastStaffMessage = [...view.messages].reverse().find((m) => m.senderType === 'STAFF');
                const lastStaffMessageSeen =
                  lastStaffMessage && view.conversation.portalLastReadAt
                    ? new Date(view.conversation.portalLastReadAt).getTime() >= new Date(lastStaffMessage.createdAt).getTime()
                    : false;
                return view.messages.map((message) => (
                <div
                  key={message.id}
                  className={message.senderType === 'SYSTEM' ? 'text-center' : message.senderType === 'STAFF' ? 'flex justify-end' : 'flex justify-start'}
                >
                  {message.senderType === 'SYSTEM' ? (
                    <p className="text-xs italic text-muted-foreground">
                      {message.body}{' '}
                      <span className="opacity-70">({new Date(message.createdAt).toLocaleString()})</span>
                    </p>
                  ) : (
                    <div
                      className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                        message.senderType === 'STAFF' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
                      {message.senderType === 'STAFF' && message.senderUserName && (
                        <p className="mb-0.5 text-xs font-semibold opacity-80">{message.senderUserName}</p>
                      )}
                      {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
                      {message.attachment && (
                        <button
                          type="button"
                          onClick={() => downloadFile(`/chat/${view.conversation.id}/attachments/${message.attachment!.id}/download`, message.attachment!.fileName)}
                          className="mt-1 flex items-center gap-1 text-xs underline"
                        >
                          <Paperclip className="h-3 w-3" /> {message.attachment.fileName}
                        </button>
                      )}
                      <p className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {message.senderType === 'STAFF' && lastStaffMessage?.id === message.id && lastStaffMessageSeen && (
                          <CheckCheck className="h-3 w-3" aria-label="Seen" />
                        )}
                      </p>
                    </div>
                  )}
                </div>
                ));
              })()}
            </div>
            {!oversightMode && !view.isReadOnly && view.conversation.status === 'CLAIMED' && (
              <form onSubmit={handleSend} className="relative border-t p-3">
                {showCannedPicker && (
                  <div className="absolute bottom-full left-3 right-3 z-10 mb-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1.5 shadow-md">
                    {cannedResponses.length === 0 ? (
                      <p className="p-2 text-xs text-muted-foreground">No canned responses yet.</p>
                    ) : (
                      cannedResponses.map((response) => (
                        <button
                          key={response.id}
                          type="button"
                          onClick={() => insertCannedResponse(response)}
                          className="block w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                        >
                          <p className="font-medium">{response.title}</p>
                          <p className="truncate text-muted-foreground">{response.body}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {file && (
                  <p className="mb-2 flex items-center justify-between rounded-md bg-muted px-2 py-1 text-xs">
                    <span className="truncate">{file.name}</span>
                    <button type="button" onClick={() => setFile(null)} className="ml-2 text-muted-foreground hover:text-foreground">
                      &times;
                    </button>
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} aria-label="Attach a file">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCannedPicker((v) => !v)}
                    aria-label="Insert a canned response"
                  >
                    <MessageSquareText className="h-4 w-4" />
                  </Button>
                  <Input
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      sendTypingHeartbeat();
                    }}
                    placeholder="Type a message…"
                    className="flex-1"
                  />
                  <Button type="submit" size="sm" disabled={isSending || (!draft.trim() && !file)}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
