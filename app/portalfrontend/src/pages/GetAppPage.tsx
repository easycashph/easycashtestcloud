import * as React from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Share2, Smartphone } from 'lucide-react';
import { PublicPageLayout } from '@/components/PublicPageLayout';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * Public "Get the app" page (2026-09-06, user request, mockup-approved: "Install App Mockup").
 *
 * Lets a client scan a QR code or share a link so someone else can open the Portal on their own
 * phone and save it to their home screen (the Portal is a PWA-ish site, not a native app store
 * listing - see index.html's manifest/apple-touch-icon, already in place before this page existed).
 *
 * The QR code and link both encode `window.location.origin` - NOT a hardcoded domain. Per user
 * confirmation ("Cloudflare tunnel URL muna, temporary lang"), the Portal is currently only
 * reachable via a Cloudflare Quick Tunnel URL that changes on restart; encoding the current origin
 * dynamically means this page keeps working with zero code changes once a permanent domain
 * replaces the tunnel later.
 */
function useCurrentOrigin(): string {
  // location.href (not just .origin) so a HashRouter deep link to this exact page round-trips
  // correctly if someone scans the code, closes the tab, and reopens the saved link later.
  return typeof window !== 'undefined' ? window.location.href : '';
}

function QrCodeCanvas({ value }: { value: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: 176,
      margin: 1,
      color: { dark: '#22316a', light: '#ffffff' },
    }).catch(() => {
      // Swallowed deliberately: an encoding failure just leaves the canvas blank - the copyable
      // link right below still works as a fallback, so there's nothing actionable to show the user.
    });
  }, [value]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}

export function GetAppPage() {
  const { t } = useLanguage();
  const origin = useCurrentOrigin();
  const [copied, setCopied] = React.useState(false);
  const [tab, setTab] = React.useState<'android' | 'iphone'>('android');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be denied/unavailable - the link is already selectable as plain text.
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Easycash Client Portal', url: origin });
      } catch {
        // User cancelled the native share sheet, or it's unsupported mid-call - no error to show.
      }
    } else {
      handleCopy();
    }
  };

  const steps = tab === 'android' ? t.getApp.androidSteps : t.getApp.iphoneSteps;

  return (
    <PublicPageLayout title={t.getApp.title} intro={t.getApp.intro}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{t.getApp.eyebrow}</p>

      <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="flex h-[152px] w-[152px] shrink-0 items-center justify-center rounded-xl border border-border bg-white p-2.5">
            <QrCodeCanvas value={origin} />
          </div>
          <div className="text-center sm:text-left">
            <h3 className="text-sm font-bold">{t.getApp.scanHeading}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.getApp.scanBody}</p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <div className="flex-1 truncate rounded-lg border border-border bg-secondary/40 px-3 py-2.5 font-mono text-xs text-muted-foreground">
            {origin}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t.getApp.copied : t.getApp.copy}
          </Button>
        </div>

        <Button type="button" onClick={handleShare} className="mt-3 w-full">
          <Share2 className="h-4 w-4" />
          {t.getApp.share}
        </Button>
      </div>

      <h2 className="mt-8 flex items-center gap-2 text-sm font-bold">
        <Smartphone className="h-4 w-4 text-primary" />
        {t.getApp.installHeading}
      </h2>
      <div className="mt-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex gap-1 rounded-lg border border-border bg-secondary/40 p-1">
          {(['android', 'iphone'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 rounded-md py-2 text-xs font-bold transition-colors ${
                tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {key === 'android' ? t.getApp.androidTab : t.getApp.iphoneTab}
            </button>
          ))}
        </div>

        <ol className="mt-4 flex flex-col">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3 border-b border-border py-2.5 last:border-none">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-extrabold text-primary-foreground">
                {index + 1}
              </span>
              <span className="pt-px text-sm leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </PublicPageLayout>
  );
}
