/**
 * Custom duotone vector icons for the homepage/Requirements "How it works" and "Before you apply"
 * sections (2026-09-11 user request, "use a more advanced icon, a more vector one" - lucide's
 * uniform 2px-stroke outlines read as thin/generic against the bold gradient panels those sections
 * use). Each icon is a small flat-vector illustration - a solid base shape plus a lighter accent
 * layer (`opacity`) for depth - built by hand instead of pulling in a second icon library, per this
 * project's "avoid unnecessary dependencies" standard (a single-purpose icon set for 7 glyphs isn't
 * worth a new package). All draw in `currentColor` so they inherit color/size exactly like the
 * lucide icons they replace - swap-in compatible, same `className="h-8 w-8"` usage.
 *
 * 2026-09-11 bug fix: internal detail lines (form rows, a checkmark badge) were originally drawn
 * with a literal `fill="#fff"`, on the assumption the icon's own base shape would render in a
 * colored `currentColor`. In actual use (`.step__img` sets `color: #fff` so the icon reads as a
 * clean white silhouette against the gradient panel), `currentColor` IS white - so every "#fff on
 * white" detail was invisible, and each icon rendered as a featureless blob. Fixed by drawing all
 * internal detail with `ETCH` (a fixed translucent dark tone) instead - it reads as an "engraved"
 * line on the white silhouette regardless of what `currentColor` resolves to.
 */
import * as React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  viewBox: '0 0 48 48',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  ...props,
});

/** Fixed tone for "engraved" detail on top of the icon's own solid shape - deliberately not `#fff`
 * or `currentColor`, since either can match the base fill exactly depending on context and vanish
 * entirely (see this file's own 2026-09-11 doc comment). */
const ETCH = 'rgba(15, 23, 42, 0.42)';

/** Step 1: Create an account - a person silhouette with a plus badge. */
export function AccountIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="20" cy="16" r="8" fill="currentColor" opacity="0.35" />
      <path d="M6 40c0-8.837 6.268-14 14-14s14 5.163 14 14" fill="currentColor" opacity="0.35" />
      <circle cx="20" cy="15" r="6.5" fill="currentColor" />
      <path d="M8 39c0.6-7.2 5.8-11.5 12-11.5s11.4 4.3 12 11.5" fill="currentColor" />
      <circle cx="35" cy="33" r="9" fill="currentColor" opacity="0.35" />
      <circle cx="35" cy="33" r="7.5" fill="currentColor" />
      <path d="M35 29.5v7M31.5 33h7" stroke={ETCH} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Step 2 (How it works): Apply online - a form/document with a filled checkmark. */
export function ApplyFormIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="10" y="6" width="24" height="32" rx="3" fill="currentColor" opacity="0.35" />
      <rect x="8" y="8" width="24" height="32" rx="3" fill="currentColor" />
      <rect x="13" y="14" width="14" height="2.4" rx="1.2" fill={ETCH} />
      <rect x="13" y="19.5" width="14" height="2.4" rx="1.2" fill={ETCH} />
      <rect x="13" y="25" width="9" height="2.4" rx="1.2" fill={ETCH} />
      <circle cx="33" cy="34" r="9" fill="currentColor" opacity="0.35" />
      <circle cx="33" cy="34" r="7.5" fill="currentColor" />
      <path d="M29.5 34.2l2.4 2.4 5-5.2" stroke={ETCH} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Step 3 (How it works): Track your status - a document with a magnifying glass. */
export function TrackStatusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="8" y="6" width="22" height="30" rx="3" fill="currentColor" opacity="0.35" />
      <rect x="6" y="8" width="22" height="30" rx="3" fill="currentColor" />
      <rect x="10.5" y="14" width="13" height="2.2" rx="1.1" fill={ETCH} />
      <rect x="10.5" y="19" width="13" height="2.2" rx="1.1" fill={ETCH} />
      <rect x="10.5" y="24" width="8" height="2.2" rx="1.1" fill={ETCH} />
      <circle cx="32" cy="30" r="8.5" fill="currentColor" opacity="0.35" />
      <circle cx="32" cy="30" r="7.5" fill="currentColor" />
      <circle cx="30.5" cy="28.5" r="4.2" stroke={ETCH} strokeWidth="2.2" fill="none" />
      <path d="M33.5 31.5l3 3" stroke={ETCH} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Tip 1 (Before you apply): a valid, unexpired government ID card. */
export function ValidIdIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="12" width="34" height="24" rx="4" fill="currentColor" opacity="0.35" />
      <rect x="4" y="10" width="34" height="24" rx="4" fill="currentColor" />
      <circle cx="12.5" cy="22" r="4.2" fill={ETCH} />
      <path d="M7 30c1-3.4 3-5 5.5-5s4.5 1.6 5.5 5" fill={ETCH} />
      <rect x="21" y="16" width="13" height="2.1" rx="1" fill={ETCH} />
      <rect x="21" y="20.5" width="10" height="2.1" rx="1" fill={ETCH} opacity="0.75" />
      <circle cx="32" cy="30" r="8.5" fill="currentColor" opacity="0.35" />
      <circle cx="32" cy="30" r="7" fill="currentColor" />
      <path d="M28.7 30.1l2.3 2.3 4.8-5" stroke={ETCH} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Tip 2: clear, complete photos/scans of every document - a stack of photos with a corner fold. */
export function DocumentsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="10" y="8" width="22" height="28" rx="3" fill="currentColor" opacity="0.3" transform="rotate(-6 21 22)" />
      <rect x="7" y="7" width="22" height="28" rx="3" fill="currentColor" opacity="0.55" transform="rotate(4 18 21)" />
      <rect x="8" y="10" width="24" height="28" rx="3" fill="currentColor" />
      <circle cx="20" cy="21" r="5.2" fill={ETCH} />
      <path d="M12 32c1.4-4.6 4.4-7 8-7s6.6 2.4 8 7" fill={ETCH} />
      <circle cx="34" cy="32" r="8.5" fill="currentColor" opacity="0.35" />
      <circle cx="34" cy="32" r="7" fill="currentColor" />
      <path d="M30.7 32.1l2.3 2.3 4.8-5" stroke={ETCH} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Tip 3: an actively-checked phone number and email - a phone with a notification badge. */
export function ContactIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="8" y="4" width="18" height="32" rx="4" fill="currentColor" opacity="0.35" />
      <rect x="6" y="6" width="18" height="32" rx="4" fill="currentColor" />
      <rect x="10" y="10" width="10" height="18" rx="1.5" fill={ETCH} opacity="0.9" />
      <circle cx="15" cy="32" r="1.8" fill={ETCH} />
      <circle cx="32" cy="18" r="10" fill="currentColor" opacity="0.35" />
      <path
        d="M25 15a3 3 0 013-3h8a3 3 0 013 3v6a3 3 0 01-3 3h-6l-4 3.5V21h-1a3 3 0 01-3-3v-3z"
        fill="currentColor"
      />
      <circle cx="29.5" cy="17.5" r="1.3" fill={ETCH} />
      <circle cx="33.5" cy="17.5" r="1.3" fill={ETCH} />
      <circle cx="37.5" cy="17.5" r="1.3" fill={ETCH} />
    </svg>
  );
}

/** Tip 4: know your preferred loan amount and term - a document with a peso amount badge. */
export function LoanAmountIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="8" y="6" width="22" height="30" rx="3" fill="currentColor" opacity="0.35" />
      <rect x="6" y="8" width="22" height="30" rx="3" fill="currentColor" />
      <rect x="9.5" y="12" width="15" height="6" rx="1.4" fill={ETCH} />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <circle key={`${row}-${col}`} cx={12.5 + col * 4.5} cy={24 + row * 4.5} r="1.5" fill={ETCH} />
        )),
      )}
      <circle cx="34" cy="31" r="9" fill="currentColor" opacity="0.35" />
      <circle cx="34" cy="31" r="7.5" fill="currentColor" />
      <text x="34" y="35" textAnchor="middle" fontSize="10" fontWeight="700" fill={ETCH} fontFamily="Georgia, serif">
        &#8369;
      </text>
    </svg>
  );
}
