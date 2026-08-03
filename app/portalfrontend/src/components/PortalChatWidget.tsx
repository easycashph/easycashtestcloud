import * as React from 'react';
import { ChevronDown, MessageCircle, Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient, fetchFileBlob } from '@/lib/apiClient';
import { useLanguage } from '@/lib/i18n/LanguageContext';
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

/** Self-service FAQ accordion, shown before a real conversation exists (2026-08-03 user request:
 * an empty "just opened the widget" moment must never itself count as a waiting chat request) -
 * reuses the SAME FAQ content already published on the landing page (t.landing.faqs), never
 * invented answers. */
function FaqAccordion() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  return (
    <div className="space-y-1.5">
      {t.landing.faqs.map((faq, index) => (
        <div key={faq.question} className="rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium"
          >
            {faq.question}
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${openIndex === index ? 'rotate-180' : ''}`} />
          </button>
          {openIndex === index && <p className="px-3 pb-2 text-xs text-muted-foreground">{faq.answer}</p>}
        </div>
      ))}
    </div>
  );
}

/** Portal<->LMS support chat widget (2026-07-31 user request, revised 2026-08-03) - a floating
 * button/panel available on every authenticated page (mounted once in App.tsx). Deliberately
 * polling, not WebSockets - a few seconds of latency is fine for support chat, and it needs no new
 * infrastructure.
 *
 * 2026-08-03 (user request): opening the widget no longer creates/activates a chat session by
 * itself - it only peeks at an existing one (GET /portal/chat/active, no side effect). A brand-new
 * visit shows an automated greeting + FAQ; the conversation only enters the real Waiting queue
 * once the client explicitly clicks "Request Loan Officer Support".
 */
export function PortalChatWidget() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [mode, setMode] = React.useState<'preChat' | 'chatting'>('preChat');
  const [conversation, setConversation] = React.useState<ChatConversation | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
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
      setMode('chatting');
      poll(conversation.id);
      return;
    }
    setIsLoading(true);
    apiClient
      .get<ChatConversation | null>('/portal/chat/active')
      .then((active) => {
        if (active) {
          setConversation(active);
          setMode('chatting');
          poll(active.id);
        } else {
          setMode('preChat');
        }
      })
      .catch(() => setMode('preChat'))
      .finally(() => setIsLoading(false));
  };

  const handleRequestSupport = () => {
    setIsLoading(true);
    apiClient
      .post<ChatConversation>('/portal/chat/start', undefined, true)
      .then((started) => {
        setConversation(started);
        setMode('chatting');
        poll(started.id);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  React.useEffect(() => {
    if (!isOpen || mode !== 'chatting' || !conversation || conversation.status === 'CLOSED') return;
    const timer = window.setInterval(() => poll(conversation.id), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isOpen, mode, conversation, poll]);

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
          <p className="text-xs text-muted-foreground">
            {mode === 'preChat' ? 'Automated assistant' : conversation ? statusLabel(conversation) : 'Starting…'}
          </p>
        </div>
        <button type="button" onClick={() => setIsOpen(false)} aria-label="Close chat" className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>

      {mode === 'preChat' ? (
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <p className="text-center text-xs text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl bg-secondary px-3 py-2 text-sm text-secondary-foreground">
                  Hi! I'm the Easycash automated assistant. Check the FAQ below for quick answers, or request a loan officer if you need
                  more help.
                </div>
              </div>
              <FaqAccordion />
              <Button type="button" className="w-full" onClick={handleRequestSupport} disabled={isLoading}>
                Request Loan Officer Support
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {isLoading && <p className="text-center text-xs text-muted-foreground">Connecting…</p>}
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
        </>
      )}
    </div>
  );
}
