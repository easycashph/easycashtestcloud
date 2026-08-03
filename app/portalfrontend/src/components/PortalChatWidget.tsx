import * as React from 'react';
import { MessageCircle, Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient, fetchFileBlob } from '@/lib/apiClient';
import type { ChatConversation, ChatMessage, PortalChatView } from '@/lib/portalApiTypes';

const POLL_INTERVAL_MS = 4000;

async function downloadAttachment(conversationId: string, attachmentId: string, fileName: string): Promise<void> {
  try {
    const blob = await fetchFileBlob(`/portal/chat/${conversationId}/attachments/${attachmentId}/download`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    // Best-effort - nothing to recover into if the download itself fails.
  }
}

function statusLabel(conversation: ChatConversation): string {
  if (conversation.status === 'CLOSED') return 'This conversation has ended.';
  if (conversation.status === 'WAITING') return "Waiting for a loan officer - we'll be with you shortly.";
  return `Chatting with ${conversation.claimedByUserName ?? 'a loan officer'}`;
}

/** Portal<->LMS support chat widget (2026-07-31 user request) - a floating button/panel available
 * on every authenticated page (mounted once in App.tsx). Deliberately polling, not WebSockets -
 * a few seconds of latency is fine for support chat, and it needs no new infrastructure. Resumes
 * the client's own existing open conversation rather than starting a new one every time the
 * widget is opened. */
export function PortalChatWidget() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [conversation, setConversation] = React.useState<ChatConversation | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [isStarting, setIsStarting] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const poll = React.useCallback((conversationId: string) => {
    apiClient
      .get<PortalChatView>(`/portal/chat/${conversationId}`)
      .then((view) => {
        setConversation(view.conversation);
        setMessages(view.messages);
      })
      .catch(() => {});
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    if (conversation) {
      poll(conversation.id);
      return;
    }
    setIsStarting(true);
    apiClient
      .post<ChatConversation>('/portal/chat/start', undefined, true)
      .then((started) => {
        setConversation(started);
        poll(started.id);
      })
      .catch(() => {})
      .finally(() => setIsStarting(false));
  };

  React.useEffect(() => {
    if (!isOpen || !conversation || conversation.status === 'CLOSED') return;
    const timer = window.setInterval(() => poll(conversation.id), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isOpen, conversation, poll]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversation || (!draft.trim() && !file) || isSending) return;
    setIsSending(true);
    try {
      if (file) {
        await apiClient.postFile(`/portal/chat/${conversation.id}/messages`, file, { body: draft.trim() });
      } else {
        await apiClient.post(`/portal/chat/${conversation.id}/messages`, { body: draft.trim() }, true);
      }
      setDraft('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      poll(conversation.id);
    } catch {
      // Best-effort - the next poll will reflect reality either way.
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Open chat with a loan officer"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col rounded-2xl border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Chat with Easycash</p>
          <p className="text-xs text-muted-foreground">{conversation ? statusLabel(conversation) : 'Starting…'}</p>
        </div>
        <button type="button" onClick={() => setIsOpen(false)} aria-label="Close chat" className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {isStarting && <p className="text-center text-xs text-muted-foreground">Connecting…</p>}
        {messages.map((message) => (
          <div key={message.id} className={message.senderType === 'SYSTEM' ? 'text-center' : message.senderType === 'PORTAL_ACCOUNT' ? 'flex justify-end' : 'flex justify-start'}>
            {message.senderType === 'SYSTEM' ? (
              <p className="text-xs italic text-muted-foreground">{message.body}</p>
            ) : (
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  message.senderType === 'PORTAL_ACCOUNT' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {message.senderType === 'STAFF' && <p className="mb-0.5 text-xs font-semibold opacity-80">{message.senderUserName}</p>}
                {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
                {message.attachment && conversation && (
                  <button
                    type="button"
                    onClick={() => downloadAttachment(conversation.id, message.attachment!.id, message.attachment!.fileName)}
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

      {conversation && conversation.status !== 'CLOSED' && (
        <form onSubmit={handleSend} className="border-t border-border p-3">
          {file && (
            <p className="mb-2 flex items-center justify-between rounded-md bg-secondary px-2 py-1 text-xs">
              <span className="truncate">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="ml-2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
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
            <Button type="submit" size="sm" disabled={isSending || (!draft.trim() && !file)} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
