import * as React from 'react';
import { Paperclip, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiClient, downloadFile, uploadFile } from '@/lib/apiClient';
import { useRole } from '@/lib/roleContext';

interface ChatConversation {
  id: string;
  portalAccountId: string;
  status: 'WAITING' | 'CLAIMED' | 'CLOSED';
  claimedByUserId: string | null;
  claimedByUserName: string | null;
  requiresManager: boolean;
  createdAt: string;
  claimedAt: string | null;
  closedAt: string | null;
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

interface StaffChatView {
  conversation: ChatConversation;
  messages: ChatMessage[];
}

interface ChatOversightStaffSummary {
  id: string;
  name: string;
  roles: string[];
}

const POLL_INTERVAL_MS = 4000;

/**
 * Portal<->LMS support chat, staff side (2026-07-31 user request) - a call-center-style claim
 * queue: "Waiting" lists every unclaimed request this staff member is eligible to answer (server
 * decides eligibility - Collection Officer/Loan Operation Manager for the plain queue, only
 * manager-eligible staff for anything transferred up); "My Chats" is whatever they've already
 * claimed. Polling, not WebSockets - matches the Portal widget's own tradeoff (see its doc
 * comment).
 */
export function ChatPage() {
  const { canManageMembers: isMis } = useRole();

  const [queue, setQueue] = React.useState<ChatConversation[] | null>(null);
  const [mine, setMine] = React.useState<ChatConversation[] | null>(null);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [view, setView] = React.useState<StaffChatView | null>(null);
  const [draft, setDraft] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // MIS-only "Staff Chat Oversight" (2026-07-31 user request) - a read-only window into any
  // staff member's chat history, any status. `oversightMode` marks the currently-open thread as
  // one loaded through this path (hides the reply box/Transfer/Close - a real conversation
  // action still has to come from its actual claimant, not from someone just reviewing it).
  const [oversightStaff, setOversightStaff] = React.useState<ChatOversightStaffSummary[] | null>(null);
  const [oversightStaffId, setOversightStaffId] = React.useState<string | null>(null);
  const [oversightConversations, setOversightConversations] = React.useState<ChatConversation[] | null>(null);
  const [oversightMode, setOversightMode] = React.useState(false);

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
  }, []);

  React.useEffect(() => {
    refreshLists();
    const timer = window.setInterval(refreshLists, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refreshLists]);

  const loadConversation = React.useCallback((id: string, viaOversight: boolean) => {
    apiClient
      .get<StaffChatView>(viaOversight ? `/chat/oversight/conversations/${id}` : `/chat/${id}`)
      .then(setView)
      .catch(() => setView(null));
  }, []);

  React.useEffect(() => {
    if (!activeConversationId) return;
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

  const handleTransfer = async () => {
    if (!activeConversationId) return;
    await apiClient.post(`/chat/${activeConversationId}/transfer`);
    setActiveConversationId(null);
    setView(null);
    refreshLists();
  };

  const handleClose = async () => {
    if (!activeConversationId) return;
    await apiClient.post(`/chat/${activeConversationId}/close`);
    loadConversation(activeConversationId, false);
    refreshLists();
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
                  <p className="text-xs text-muted-foreground">
                    {new Date(conversation.createdAt).toLocaleTimeString()}
                    {conversation.requiresManager && (
                      <Badge variant="outline" className="ml-1.5">
                        Transferred
                      </Badge>
                    )}
                  </p>
                </div>
                <Button size="sm" onClick={() => handleClaim(conversation.id)}>
                  Answer
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">My Chats ({mine?.length ?? '…'})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mine?.length === 0 && <p className="text-xs text-muted-foreground">Nothing claimed right now.</p>}
            {mine?.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {
                  setOversightMode(false);
                  setActiveConversationId(conversation.id);
                }}
                className={`w-full rounded-md border p-2 text-left text-sm hover:bg-accent ${!oversightMode && activeConversationId === conversation.id ? 'border-primary bg-accent' : ''}`}
              >
                <p className="font-medium">Active conversation</p>
                <p className="text-xs text-muted-foreground">Claimed {new Date(conversation.claimedAt ?? conversation.createdAt).toLocaleTimeString()}</p>
              </button>
            ))}
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
                    {staff.name} ({staff.roles.join(', ')})
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
      </div>

      <Card className="flex flex-col overflow-hidden">
        {!view ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a waiting request or one of your active chats.
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
                      : 'Client conversation'}
                </CardTitle>
                {actionError && <p className="text-xs text-destructive">{actionError}</p>}
              </div>
              {!oversightMode && view.conversation.status === 'CLAIMED' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleTransfer}>
                    Transfer to Manager
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                </div>
              )}
            </CardHeader>
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {view.messages.map((message) => (
                <div
                  key={message.id}
                  className={message.senderType === 'SYSTEM' ? 'text-center' : message.senderType === 'STAFF' ? 'flex justify-end' : 'flex justify-start'}
                >
                  {message.senderType === 'SYSTEM' ? (
                    <p className="text-xs italic text-muted-foreground">{message.body}</p>
                  ) : (
                    <div
                      className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                        message.senderType === 'STAFF' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
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
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!oversightMode && view.conversation.status === 'CLAIMED' && (
              <form onSubmit={handleSend} className="border-t p-3">
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
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message…" className="flex-1" />
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
