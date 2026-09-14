/**
 * Payment channels shown in the "Ways to pay" marquee (2026-09-11 user request - "add a horizontal
 * marquee/infinite scrolling logo strip showing major Philippine banks and digital wallets").
 *
 * Rendered as brand-colored lettermark chips, not downloaded logo image files: this environment has
 * no vetted way to source official bank/e-wallet artwork under license for a live commercial
 * lending site, and CLAUDE.md's "never fabricate" principle extends to not quietly shipping
 * scraped trademarked logos. `accent` is a close visual approximation of each brand's public color,
 * not a verified brand-guideline hex - swap in real licensed SVG/PNG logo files later (drop them in
 * `public/images/banks/` and replace the lettermark markup below) and this list/order can stay the
 * same. Split into two rows so the marquee can scroll in opposite directions - a common "trusted by"
 * treatment that reads as more dynamic than one long single-direction strip.
 */
const ROW_1 = [
  { name: 'BDO', mark: 'BDO', accent: '#00337f' },
  { name: 'BPI', mark: 'BPI', accent: '#c8102e' },
  { name: 'Metrobank', mark: 'MB', accent: '#002d72' },
  { name: 'UnionBank', mark: 'UB', accent: '#ff6600' },
  { name: 'RCBC', mark: 'RCBC', accent: '#00558c' },
  { name: 'LandBank', mark: 'LBP', accent: '#00703c' },
  { name: 'China Bank', mark: 'CBC', accent: '#0033a0' },
  { name: 'CIMB', mark: 'CIMB', accent: '#ed1c24' },
] as const;

const ROW_2 = [
  { name: 'Security Bank', mark: 'SB', accent: '#f7931e' },
  { name: 'PNB', mark: 'PNB', accent: '#7a1f2b' },
  { name: 'Maya', mark: 'M', accent: '#00c56d' },
  { name: 'GCash', mark: 'G', accent: '#0074e4' },
  { name: 'GoTyme', mark: 'GT', accent: '#6c2eb5' },
  { name: 'SeaBank', mark: 'SEA', accent: '#0a1f44' },
  { name: 'MariBank', mark: 'MARI', accent: '#0a1f44' },
  { name: 'Tonik', mark: 'T', accent: '#ff4d6d' },
] as const;

function MarqueeRow({ channels, reverse }: { channels: ReadonlyArray<{ name: string; mark: string; accent: string }>; reverse?: boolean }) {
  // Duplicated once so the track can loop seamlessly at translateX(-50%) with no visible seam.
  const track = [...channels, ...channels];
  return (
    <div className={`marquee__row ${reverse ? 'marquee__row--reverse' : ''}`}>
      <div className="marquee__track" aria-hidden="true">
        {track.map((ch, i) => (
          <span className="marquee__chip" key={`${ch.name}-${i}`}>
            <span className="marquee__mark" style={{ background: ch.accent }}>
              {ch.mark}
            </span>
            <span className="marquee__name">{ch.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function PaymentChannelsMarquee() {
  return (
    <div className="marquee" role="group" aria-label={`Supported banks and e-wallets: ${[...ROW_1, ...ROW_2].map((c) => c.name).join(', ')}`}>
      <div className="marquee__fade marquee__fade--l" aria-hidden="true" />
      <div className="marquee__fade marquee__fade--r" aria-hidden="true" />
      <MarqueeRow channels={ROW_1} />
      <MarqueeRow channels={ROW_2} reverse />
    </div>
  );
}
