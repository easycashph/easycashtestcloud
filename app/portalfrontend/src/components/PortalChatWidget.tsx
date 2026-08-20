import * as React from 'react';
import { CheckCheck, ChevronDown, MessageCircle, Paperclip, Send, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient, fetchFileBlob } from '@/lib/apiClient';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { ChatAgentStatus, ChatConversation, ChatMessage, PortalChatView } from '@/lib/portalApiTypes';

const POLL_INTERVAL_MS = 4000;
/** How long after the last typing heartbeat we still show "typing…" (2026-08-20 user request,
 * BPO-style UX) - a bit longer than POLL_INTERVAL_MS so a heartbeat lost to one missed poll doesn't
 * flicker the indicator off and back on. */
const TYPING_INDICATOR_TTL_MS = 6000;
const TYPING_HEARTBEAT_THROTTLE_MS = 2500;

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

/** Two-tone "beep" via the Web Audio API (2026-08-20 user request: notification sound when a
 * reply arrives while the widget is minimized) - no external asset file needed. Best-effort: a
 * browser that blocks audio without a prior user gesture just stays silent. */
function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    [880, 1108].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.15, now + i * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.18);
    });
    window.setTimeout(() => ctx.close(), 500);
  } catch {
    // Best-effort.
  }
}

function isRecentlyActive(timestamp: string | null, ttlMs: number): boolean {
  if (!timestamp) return false;
  return Date.now() - new Date(timestamp).getTime() < ttlMs;
}

function presenceDotClass(status: ChatAgentStatus | null): string {
  if (status === 'ONLINE') return 'bg-success';
  if (status === 'AWAY') return 'bg-warning';
  return 'bg-muted-foreground/40';
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

/** Post-chat CSAT rating (2026-08-20 user request, BPO-style support) - shown once, only after
 * the conversation is CLOSED and not yet rated. */
function RatingPrompt({ conversationId, onSubmitted }: { conversationId: string; onSubmitted: () => void }) {
  const [hovered, setHovered] = React.useState(0);
  const [selected, setSelected] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const submit = async () => {
    if (selected === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await apiClient.post(`/portal/chat/${conversationId}/rating`, { rating: selected, comment: comment.trim() || undefined }, true);
      onSubmitted();
    } catch {
      // Best-effort - leave the prompt open so they can try again.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs font-medium">How was your experience?</p>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setSelected(n)}
            aria-label={`Rate ${n} star${n === 1 ? '' : 's'}`}
          >
            <Star className={`h-6 w-6 ${(hovered || selected) >= n ? 'fill-warning text-warning' : 'text-muted-foreground/40'}`} />
          </button>
        ))}
      </div>
      {selected > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Anything else you'd like to share? (optional)"
            rows={2}
            className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          />
          <Button type="button" size="sm" className="mt-2 w-full" onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit Rating'}
          </Button>
        </>
      )}
    </div>
  );
}

/** Portal<->LMS support chat widget (2026-07-31 user request, revised 2026-08-03, BPO-style pass
 * 2026-08-20) - a floating button/panel available on every authenticated page (mounted once in
 * App.tsx). Deliberately polling, not WebSockets - a few seconds of latency is fine for support
 * chat, and it needs no new infrastructure; every "real-time" feature below (typing indicator,
 * read receipts, unread badge) is built on top of that same poll rather than a push channel.
 *
 * 2026-08-03 (user request): opening the widget no longer creates/activates a chat session by
 * itself - it only peeks at an existing one (GET /portal/chat/active, no side effect). A brand-new
 * visit shows an automated greeting + FAQ; clicking "Request Loan Officer Support" only opens a
 * message composer - the conversation STILL isn't created yet at that point either (2026-08-03
 * follow-up: a click with no message typed/sent must not flood the LMS Waiting queue). It's only
 * created, and only then enters Waiting, the moment the client actually sends their first message.
 */
export function PortalChatWidget() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [mode, setMode] = React.useState<'preChat' | 'composing' | 'chatting'>('preChat');
  const [conversation, setConversation] = React.useState<ChatConversation | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [waitingPosition, setWaitingPosition] = React.useState<number | null>(null);
  const [officerPresence, setOfficerPresence] = React.useState<ChatAgentStatus | null>(null);
  const [draft, setDraft] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isOpenRef = React.useRef(isOpen);
  const lastMessageIdRef = React.useRef<string | null>(null);
  const lastTypingSentAtRef = React.useRef(0);

  React.useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  const poll = React.useCallback((conversationId: string) => {
    apiClient
      .get<PortalChatView>(`/portal/chat/${conversationId}`)
      .then((view) => {
        setConversation(view.conversation);
        setMessages(view.messages);
        setWaitingPosition(view.waitingPosition);
        setOfficerPresence(view.officerPresence);

        // Unread badge + notification sound (2026-08-20 user request) - only for a genuinely NEW
        // staff message arriving while the widget is minimized, never on the first load of an
        // already-seen history.
        const lastStaffMessage = [...view.messages].reverse().find((m) => m.senderType === 'STAFF');
        if (lastStaffMessage && lastStaffMessage.id !== lastMessageIdRef.current) {
          const isFirstCheck = lastMessageIdRef.current === null;
          lastMessageIdRef.current = lastStaffMessage.id;
          if (!isFirstCheck && !isOpenRef.current) {
            setUnreadCount((n) => n + 1);
            playNotificationSound();
          }
        }
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
    // Already mid-composing a first message (nothing sent/created yet) - just reopen into that,
    // no need to re-check the backend.
    if (mode === 'composing') return;
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

  /** Just opens the composer - deliberately does NOT call /portal/chat/start yet (see the
   * component's own doc comment). */
  const handleRequestSupport = () => {
    setMode('composing');
  };

  const sendTypingHeartbeat = (conversationId: string) => {
    const now = Date.now();
    if (now - lastTypingSentAtRef.current < TYPING_HEARTBEAT_THROTTLE_MS) return;
    lastTypingSentAtRef.current = now;
    apiClient.post(`/portal/chat/${conversationId}/typing`, undefined, true).catch(() => {});
  };

  /** The actual moment a conversation gets created and enters the real Waiting queue - only once
   * the client has typed/attached something and hit Send. */
  const handleComposeSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!draft.trim() && !file) || isSending) return;
    setIsSending(true);
    try {
      const started = await apiClient.post<ChatConversation>('/portal/chat/start', undefined, true);
      if (file) {
        await apiClient.postFile(`/portal/chat/${started.id}/messages`, file, { body: draft.trim() });
      } else {
        await apiClient.post(`/portal/chat/${started.id}/messages`, { body: draft.trim() }, true);
      }
      setDraft('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setConversation(started);
      setMode('chatting');
      poll(started.id);
    } catch {
      // Best-effort - the composer stays open so they can just try Send again.
    } finally {
      setIsSending(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen || mode !== 'chatting' || !conversation) return;
    poll(conversation.id);
    if (conversation.status === 'CLOSED') return;
    const timer = window.setInterval(() => poll(conversation.id), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, conversation?.id, conversation?.status, poll]);

  // Keeps polling in the background even while minimized (so the unread badge/sound actually
  // fire) - a shorter-lived effect scoped to "have an active conversation at all", independent of
  // the widget being open.
  React.useEffect(() => {
    if (!conversation || conversation.status === 'CLOSED' || mode !== 'chatting') return;
    const timer = window.setInterval(() => poll(conversation.id), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id, conversation?.status, mode, poll]);

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

  const staffIsTyping = conversation ? isRecentlyActive(conversation.staffTypingAt, TYPING_INDICATOR_TTL_MS) : false;
  const lastOwnMessage = [...messages].reverse().find((m) => m.senderType === 'PORTAL_ACCOUNT');
  const lastOwnMessageSeen =
    lastOwnMessage && conversation?.staffLastReadAt
      ? new Date(conversation.staffLastReadAt).getTime() >= new Date(lastOwnMessage.createdAt).getTime()
      : false;
  const showRatingPrompt = conversation?.status === 'CLOSED' && !conversation.ratedAt;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Open chat with a loan officer"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90"
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col rounded-2xl border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Chat with Easycash</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {mode === 'chatting' && conversation?.status === 'CLAIMED' && (
              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${presenceDotClass(officerPresence)}`} />
            )}
            {mode === 'preChat'
              ? 'Automated assistant'
              : mode === 'composing'
                ? 'Type your message to reach a loan officer'
                : conversation
                  ? staffIsTyping
                    ? `${conversation.claimedByUserName ?? 'Agent'} is typing…`
                    : statusLabel(conversation)
                  : 'Starting…'}
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
      ) : mode === 'composing' ? (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-2xl bg-secondary px-3 py-2 text-sm text-secondary-foreground">
                Type your question or concern below and send it - a loan officer will be notified once you do.
              </div>
            </div>
            <button type="button" onClick={() => setMode('preChat')} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
              ← Back to FAQ
            </button>
          </div>
          <form onSubmit={handleComposeSend} className="border-t border-border p-3">
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
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message…" className="flex-1" autoFocus />
              <Button type="submit" size="sm" disabled={isSending || (!draft.trim() && !file)} aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {isLoading && <p className="text-center text-xs text-muted-foreground">Connecting…</p>}
            {mode === 'chatting' && conversation?.status === 'WAITING' && waitingPosition !== null && (
              <div className="rounded-lg bg-secondary/70 px-3 py-2 text-center text-xs text-muted-foreground">
                {waitingPosition === 0
                  ? "You're next in line - a loan officer will be with you shortly."
                  : `${waitingPosition} ${waitingPosition === 1 ? 'person is' : 'people are'} ahead of you in the queue.`}
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={message.senderType === 'SYSTEM' ? 'text-center' : message.senderType === 'PORTAL_ACCOUNT' ? 'flex justify-end' : 'flex justify-start'}>
                {message.senderType === 'SYSTEM' ? (
                  <p className="text-xs italic text-muted-foreground">
                    {message.body}{' '}
                    <span className="opacity-70">({new Date(message.createdAt).toLocaleString()})</span>
                  </p>
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
                    <p className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {/* Read receipt (2026-08-20 user request) - only on this client's own last
                          message, and only once the agent's read watermark has caught up to it. */}
                      {message.senderType === 'PORTAL_ACCOUNT' && lastOwnMessage?.id === message.id && lastOwnMessageSeen && (
                        <CheckCheck className="h-3 w-3" aria-label="Seen" />
                      )}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {staffIsTyping && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl bg-secondary px-3 py-2">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </div>
              </div>
            )}
            {showRatingPrompt && conversation && (
              <RatingPrompt conversationId={conversation.id} onSubmitted={() => poll(conversation.id)} />
            )}
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
                <Input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (conversation) sendTypingHeartbeat(conversation.id);
                  }}
                  placeholder="Type a message…"
                  className="flex-1"
                />
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
