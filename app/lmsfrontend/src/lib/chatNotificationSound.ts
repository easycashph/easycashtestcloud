/**
 * 2026-09-03 (user request): a short chime for "may incoming chat" - a new unclaimed request
 * entering the queue, or a new borrower message in the conversation currently open. Synthesized
 * with the Web Audio API rather than an audio file - no asset to source/license, and the whole
 * sound is a few lines of oscillator code.
 *
 * Browsers block audio autoplay until the page has had at least one real user gesture (a click, a
 * keypress) - since this fires from a background poll, not a click, the very first notification of
 * a session may be silently swallowed if nobody has interacted with the page yet. This is normal
 * browser behavior, not a bug: `AudioContext` construction is deferred to the first call (never at
 * module load) so it always picks up whatever gesture has already happened by then, and every
 * failure is caught and ignored (a blocked chime should never surface as an app error).
 */
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  return audioContext;
}

/** Two quick ascending tones (a friendly "ding-ding", ~300ms total) - deliberately short and soft
 * (low gain, fast decay) so it doesn't feel alarming in a quiet office when it fires repeatedly
 * over a shift. */
export function playChatNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const playTone = (frequencyHz: number, startOffsetSec: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequencyHz;
      const startAt = ctx.currentTime + startOffsetSec;
      const endAt = startAt + 0.16;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.02);
    };

    playTone(880, 0); // A5
    playTone(1108.73, 0.12); // C#6 - a quick, pleasant upward interval
  } catch {
    // A blocked/unsupported chime should never surface as an app error - see this file's own doc comment.
  }
}
