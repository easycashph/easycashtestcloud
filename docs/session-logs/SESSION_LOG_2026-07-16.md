# Session Log — 2026-07-16

**Purpose:** plain-language record of this session, continuing from
`docs/SESSION_LOG_2026-07-15.md`. Written per the project's standing convention
(`CLAUDE.md` §Session Logs) so context is never lost between conversations.

---

## Loan document generation was showing "no documents configured"

Traced to `document_templates`/`document_template_mappings` being empty on this machine's local
database - re-ran `prisma db seed` (11 required/conditional templates) and the existing
`map-sml-document-templates.ts` script (75 SML mappings), confirming this was a per-machine seed
gap, not a code bug. Verified end to end against a real SML-QC loan account.

## Create Loan Account form: Add-On Rate, Term, Contractual Rate

- Add-On Rate is now a dropdown sourced live from the Interest Rate Chart, instead of a free-typed
  number that could not match anything on file.
- Contractual Rate made read-only (grayed out) since it's derived from the Add-On Rate/Term lookup
  - staff were able to accidentally overwrite an auto-computed value.
- Term (months) now prefills from the client's requested term when the dialog is opened from an
  approved Loan Application or an existing client's profile.

## Loan Account Detail: repayment schedule preview before Activation

A Pending Approval / For Disbursement loan has no real repayment schedule yet (that's only
generated at Activation) - the Repayment Schedule tab used to just say "No repayment schedule
found," which read like an error. It now shows a clearly-labeled live preview computed from the
loan's current Principal/Rate/Term, with a banner explaining it isn't the final, persisted
schedule yet.

## Status relabeling: "For Disbursement" and "Disbursed"

- A Loan Account's Approved status (waiting to be Activated/disbursed) is now labeled **"For
  Disbursement"** in green, instead of a plain "Approved" badge.
- A Loan Application whose loan account has been created but not yet Activated now also shows
  **"For Disbursement"**; once that loan account is Activated, the application shows
  **"Disbursed"** - both List of Loan Applications and the application's own detail page, plus a
  matching filter option.

## Live number formatting across financial/contact/ID fields

Added thousand-separator commas (financial amounts), phone formatting ("09XX XXX XXXX"), and
grouped-digit formatting ("XXXX XXXX XXXX" for SSS/TIN) that update live while typing, not just
after leaving the field - across Payment Recording, Create Loan Account, Create/Edit Loan
Application, Client Profile, and Settings. Fixed a real bug found immediately after the first
version shipped: reformatting on every keystroke was resetting the cursor to the end of the field
and silently dropping a decimal point mid-type - rebuilt with cursor-position tracking so typing,
including decimals, works normally while the formatting still updates live.

## Dialog forms no longer close themselves when dismissing a dropdown

Reported bug: opening any dialogue form, clicking a dropdown field, then clicking elsewhere in the
form (not selecting an option) closed the entire dialog, losing whatever had been filled in. Fixed
once in the shared dialog component, so it applies automatically to every dialogue form across the
platform, not just the ones it was first reported on.

## Co-Borrower Details on Loan Application intake

Trimmed the Co-Borrower section down to exactly what's needed: name, relationship to applicant,
contact number, email address, and address (dropped the old employer field). When starting a Loan
Application from an existing client, co-borrower name is now a dropdown of that client's previous
co-borrowers - picking one auto-fills the rest of the fields, still fully editable, or a brand-new
co-borrower can be typed in instead. This dropdown only appears for an existing client, never on
the walk-in intake form.

## Address auto-fill bug on "Create Client Profile"

An approved Loan Application's saved address wasn't carrying over into the Region/Province/City/
Barangay dropdowns on "Create Client Profile," even though the plain text fields (house number,
street, ZIP) did - staff could mistake a filled-in address for an empty one, and touching the
Region dropdown to "fill it in" would have wiped the already-correct city/barangay. Added a
reverse address lookup so the dropdowns now pre-select correctly. Also fixed the Barangay dropdown
never visibly reflecting a selection at all, a separate bug found while investigating.

## Loan Application "Assign Product" dropdown was missing active product classes

The product-class list offered when approving a Loan Application was a hand-maintained list that
had gone stale - several newer active products (and a few marked "discontinued" that are actually
still offered) never appeared. Replaced with a live list drawn from the real product catalog, so it
can't go stale again.

## List pages: filters were silently showing fewer than a full page of results

List of Loan Applications, List of Clients, and List of Loan Accounts show 25 rows per page - but
applying a status/category/product/loan-presence filter used to only narrow within whatever 25 (or
100) rows had already loaded, so a filtered view could show far fewer real matches than actually
exist. Moved all of these filters server-side so a full page of up to 25 matching rows is shown
regardless of filters applied.

## "Matured" is now its own status filter on Loan Accounts

Filtering Loan Accounts by "In Arrears" was including loans actually badged "Matured" - Matured
isn't a real status column, it's a computed overlay the badge shows instead of the raw status, so
the filter matched the underlying (unchanged) status while the badge showed something else. Added
"Matured" as its own filter option, and Active/In Arrears now correctly exclude matured loans to
match what their badges already show.

## Record Payment now opens in place on the Loan Account profile

"Record Payment" used to navigate away to a separate Payment Recording page and lose the loan
context, requiring staff to search for the same client and loan again. It now opens the same
payment form as an in-page dialog, already locked to the loan being viewed. Found and fixed a real
bug while wiring this up: the Loan Account page's own balance/status display wasn't refreshing
immediately after a payment was recorded through it - it now updates right away.

## About page: duplicate changelog entries, layout cut off under the Windows taskbar

- Two changelog entries had landed under the same release date - merged into one, and the version
  number corrected since one of the two was never really a separate release.
- Fixed the About page (and every other page) sometimes rendering with its bottom content hidden
  behind the Windows taskbar at 100% browser zoom - the page layout was sized off the browser's
  reported 100vh, which can report more height than is actually visible on Windows at certain zoom/
  DPI combinations; switched to the dynamic-viewport-height unit that tracks the real visible area.

## Docker disk cleanup

Cleared unused Docker build cache and stray containers/images to free up local disk space, and
explained the separate, larger reclaim available by compacting Docker Desktop's WSL2 virtual disk
(requires an administrator step the user needs to run themselves).

## Current state

- All work in this log is committed and pushed to `origin/main`.
- Known follow-ups carried over, unresolved (see `docs/SESSION_LOG_2026-07-15.md` for the fuller
  list): two coexisting Note systems still need a canonical-choice decision; ~954 loans with
  legitimate legacy-snapshot-vs-schedule disagreement still need a business decision before any
  further balance recomputation; `DocumentTemplateMapping` still empty for ~28 non-SML/SL/BL
  products; report generation (Excel) still not started, waiting on which report to build first.
- New follow-up from this session: the Docker Desktop WSL2 virtual disk compaction (~19GB
  reclaimable) is still pending - needs the user to run the provided script from an elevated
  PowerShell prompt.
