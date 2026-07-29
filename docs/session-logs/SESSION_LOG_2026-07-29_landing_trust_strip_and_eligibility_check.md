# Session Log — 2026-07-29 — Landing Page Trust Strip + Basic Eligibility Self-Check

**Goal (user):** asked for suggestions on the Portal landing page; picked two: a trust-signal strip
near the hero CTA, and a quick pre-qualification-style check.

## 1. Trust strip

Added a slim row of 3 trust signals directly under the hero's Apply/Log In buttons - the moment a
first-time visitor is deciding whether to trust the site, not just in the footer they may never
scroll to. All three values come from `companyInfo.ts` (same single source of truth as
`SiteFooter`): SEC-registered badge, a "never asks for a fee" line linking to `/security-tips`, and
a data-protected line. Added EN/FIL translation keys (`landing.trustSecRegistered` etc.).

## 2. Basic Eligibility Self-Check (scoped down from "pre-qualification")

The original suggestion (from `docs/PORTAL_WEBSITE_STRATEGY.md` §3.2) was a pre-qualification check
that estimates a loan amount range. **Deliberately did not build that** - it would need a real
income-to-loan-amount formula, which is not confirmed anywhere in the codebase or by management,
and inventing one would violate `CLAUDE.md`'s "never invent business rules." Built a narrower,
honest version instead: a 4-question Yes/No self-check against `ELIGIBILITY_CRITERIA` in
`loanRequirements.ts` (the same 4 published facts the Requirements page already uses - age 18+,
Filipino citizen/resident, valid ID, stable income) - all-yes shows a pass state with an Apply Now
CTA, any-no shows a non-discouraging fail state with a Contact link, never a dead end.

Entirely client-side: no network request, nothing stored or transmitted. A visitor checking basic
eligibility hasn't decided to apply yet and shouldn't have to hand over data to find out.

New file: `src/components/EligibilityCheckWidget.tsx`. Placed on the landing page between Products
and How-it-works. New translation namespace `eligibilityCheck` (EN/FIL).

## Verification

`tsc -b` and `eslint` clean (portal). `vite build` succeeds. Live-tested in the dev server: all-Yes
→ pass state with working Apply Now link; changing one answer to No live-clears the stale result
(no manual reset needed); all-No → fail state with working Contact link; Start Over fully resets
answers and re-disables the Check button; no horizontal overflow on mobile (375px); Filipino
translation renders correctly via the existing language toggle. Some stale HMR error entries
appeared in the console message buffer from mid-edit reloads; confirmed not live via a hard
navigation reload (DOM inspected directly) and a clean production build.

## Current state

Both features implemented, verified, and live in the local dev/build. Not yet committed at the time
of writing this log - see the commit that includes this file for the actual commit/push/mirror-sync
record.
