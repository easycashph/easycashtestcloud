# Session Log — 2026-07-29: E-signature document fixes, conditional Deed of Assignment, Underwriting account-owner field, UI polish

## TL;DR for a fresh Claude session picking this up cold

- **Real bug fixed twice in one day, same root cause, two different call sites**: the
  co-borrower dual-linkage lookup gap (loan-level `LoanAccountCoBorrower` join vs the per-Borrower
  `CoBorrower.borrowerId` FK — see 2026-07-28's log §7 for the original discovery) was ALSO present
  in `LoanDocumentMergeDataResolver.ts` (§6 below), independently of the e-signature session fix
  from yesterday. Symptom: `{CoBorrowerName}`/`{CoBorrowerAddress}` silently rendered blank on
  generated documents whenever the co-borrower was added via the newer per-Borrower flow. Fixed
  with the identical loan-join-then-per-Borrower-FK fallback pattern.
- **Three .docx templates were missing `[[SIGNATURE_ANCHOR_CO_BORROWER]]`** (Disclosure Statement,
  Promissory Note, Data Privacy and Consent Form) — the co-borrower's signature was silently
  falling back to a fixed bottom-of-page placement instead of landing next to their printed name.
  Patched all three directly (binary .docx edits via a Node/jszip script, validated by a real
  LibreOffice conversion before replacing the live template files — see §6).
- **Business rule expansion (user-confirmed)**: co-borrower must now also sign Disclosure
  Statement, Promissory Note, and Data Privacy and Consent Form (previously borrower-only) — NOT
  Acknowledgement Receipt, Manulife, or Deed of Assignment - Borrower. Two small data-only Prisma
  migrations flip `DocumentTemplate.requiresCoBorrowerSignature`. See §5.
- **New conditional logic (user-confirmed)**: "Deed of Assignment - Co-Borrower" only belongs in
  the co-borrower's e-signature batch when the surrendered ATM/allotment account is actually under
  the co-borrower's name — not merely because a co-borrower exists on the loan. Mirror rule: "Deed
  of Assignment - Borrower" is excluded from the borrower's batch in that same case (mutually
  exclusive per loan). Driven by a new required Underwriting field, `mitigation.accountOwner`
  (`BORROWER` | `CO_BORROWER`) — see §3/§4.
- **New audit-trail placement**: the "Signed by / Date / IP address" text on generated PDFs now
  sits directly under each signer's own printed name (when the template has an anchor), replacing
  the old single shared block at the page's bottom margin. See §7. **Not yet visually verified by
  the user as of this log** — my own attempt to test it via a disposable script hung (pdf2json's
  internal worker setup appears to break outside the Docker container, likely path-with-spaces
  related); asked the user to sign a real session in the live app and share the resulting PDF next.
- **This machine's Docker-rebuild-required workflow** (see 2026-07-28's log) applied to nearly
  every change today — `docker compose build --no-cache <service> && docker compose up -d
  --force-recreate <service>` after almost every backend/frontend edit.
- **Excel template generated and delivered** (§9) as groundwork for a future "upload Excel, autofill
  Loan Application form" feature — not yet implemented, just the template artifact.
- **11 test signing sessions deleted from the live database** for `SML-Self_00058` per explicit
  user confirmation (§8) — a real, deliberate destructive action, not a bug/rollback.

## Context

Direct continuation of `SESSION_LOG_2026-07-28_penalty_formula_and_soa_reuse.md`, which had already
logged the OTP-follows-link-channel feature and the Dashboard 2-column layout (§9/§10 there,
committed as `60df0a0`) as its last entries. Today's session picked up immediately after that with
a live-testing pass on the e-signature feature (OTP toggle, email delivery), which surfaced a long
chain of real bugs and follow-on feature requests — a per-account UI fix pass, a full
Underwriting/e-signature conditional-logic feature, and finally a document-generation bug hunt that
traced two separate templating/merge-data defects back to their root causes.

## 1. Reminder-settings activity log (per-toggle audit trail)

User asked for an Activity Log on the System page specifically showing who toggled which
Messaging & Alerts switch, mockup shown and approved (5 entries, on the System page itself) before
implementing.

**Implementation:**
- `UpdateReminderSettingsUseCase` now fetches the row's state *before* updating, diffs it against
  the result, and writes one `TOGGLE_REMINDER_SETTING` audit entry per field that actually changed
  (not one entry for the whole PATCH) — via the existing `IAuditLogger`/`PrismaAuditLogger`
  (identity module), newly injected as a dependency. `previousValue`/`newValue` carry `{ label,
  value }` so the frontend doesn't need its own field-name-to-label map.
- `reminderSettingsController.update()` now passes `ipAddress`/`userAgent` through to the command.
- New `ReminderSettingsActivityLog` component in `SystemPage.tsx`, fetching
  `GET /audit-logs?entityType=ReminderSettings&limit=5` (the existing MIS-only endpoint — this
  whole tab is already MIS-only, so showing `previousValue`/`newValue` here is fine, unlike the
  all-roles `RecentSystemActivityPanel` which deliberately omits that detail). Shows initials
  avatar, "{user} turned {toggle} on/off", an Off→On/On→Off badge pair, and relative time.
- New tests in `ReminderSettingsUseCases.test.ts` covering the diff-and-log behavior. 891 backend
  tests passing (up from 890 the prior session).

Committed as `3178b8d`.

## 2. Client Profile UI polish (equal-height cards, missing-number warnings, all-caps)

Three small, independently-requested fixes bundled into one commit:

- **Equal-height cards**: Co-Borrower and Risk & Payment Summary cards in Client Profile's 2-column
  grid rendered at different heights (grid's default `align-items: stretch` was defeated because
  neither the `SortableSection` wrapper div nor `RiskPaymentSummaryCard`'s own `Card` had `h-full`
  to actually fill the stretched grid cell — `CoBorrowersCard` already had `h-full` on its `Card`,
  which is what exposed the asymmetry). Fixed by adding `h-full` to `SortableSection`'s wrapper div
  (harmless for every other page using it) and `flex h-full flex-col` +
  `CardContent className="flex-1"` to `RiskPaymentSummaryCard`.
- **Missing-number warnings**: the e-signature panel's SMS phone input showed no explanation when
  blank (just a disabled Send button) — user pointed out the field is auto-filled from the profile,
  so a truly blank field means "no number on file," not "hasn't loaded yet." Added an inline amber
  warning ("No mobile number on file for the borrower/co-borrower. Enter one above to send via
  SMS.") for both Borrower and Co-Borrower cards in `LoanDetailPage.tsx`.
- **All-caps on Add/Edit Co-Borrower**: First/Middle/Last Name, Relationship, and Employer fields
  now `.toUpperCase()` on input, matching the existing convention already used in
  `LoanApplicationCreatePage.tsx`'s name fields. Phone/Email left untouched (not name-style fields).

Committed as `56e9a9b`.

## 3. Print button + a real borrower-phone-prefill race condition

- Added a **Print** button to `LoanDocumentPreviewModal.tsx` (shared by Statement of Account, Loan
  Documents, and signed e-signature document previews) — an `iframeRef` + `contentWindow.print()`
  next to the existing Download button. One shared component change covers all three preview
  contexts.
- **Real bug found and fixed**: the e-signature panel's Borrower phone field showed "no mobile
  number on file" for `SML-Self_00058` even though the borrower's `mobilePhone1` was confirmed
  present in the database. Root cause: `phoneNumber`'s `useState(defaultPhoneNumber ?? '')` only
  reads the prop **once**, at first render — if the parent's `borrower` query hadn't resolved yet
  by then, it permanently stuck at `''`. The Co-Borrower field had a `useEffect` to sync in a
  late-arriving default; the Borrower field never got the same treatment. Added the identical
  `hasAppliedBorrowerDefault` ref + effect pattern.

Committed as `830ceb7`.

## 4. Underwriting: mitigation account-owner field, editable past UNDER_REVIEW

User asked why only 3 documents get sent to the co-borrower for signing, then, in a follow-up,
specifically asked for a NEW conditional rule: "If the ATM details are under the name of
Co-Borrower, send this form Deed of Assignment - Co-Borrower" — i.e., that document should be
conditional on account ownership, not automatic whenever a co-borrower exists.

Traced where ATM/mitigation details are captured (`LoanApplication.reviewReport.mitigation` —
`MitigationDetails.accountName` is free text, entered during Underwriting) and asked the user how
to determine ownership: free-text name matching (fragile) vs. an explicit field. User chose the
explicit field, mockup approved, then implemented:

- `MitigationDetails` gained `accountOwner?: 'BORROWER' | 'CO_BORROWER'` (domain interface + zod
  schema + frontend type) — no schema migration needed since `reviewReport` is a single opaque
  `Json` column.
- New required (when a co-borrower exists and any mitigation field is filled) "Whose name is this
  account under?" toggle in `LoanApplicationDetailPage.tsx`'s Underwriting card.
- `CreateLoanSigningSessionUseCase` now fetches the loan account's source `LoanApplication` (via
  the pre-existing `LoanAccount.sourceApplicationId`) and reads `mitigation.accountOwner` to filter
  the applicable-templates list: `DEED_OF_ASSIGNMENT_CO_BORROWER` is excluded unless
  `accountOwner === 'CO_BORROWER'`; **mirror rule added on the same day**, after the user pointed
  out the converse also needed handling — `DEED_OF_ASSIGNMENT_BORROWER` is excluded from the
  borrower's own batch in that same case (the two Deeds are mutually exclusive per loan). New
  `loanApplicationRepository` dependency wired into `CreateLoanSigningSessionUseCase`'s
  construction in `app.ts` (a fresh `PrismaLoanApplicationRepository()` instance, since the
  existing named `loanApplicationRepository` local variable is declared later in the same function
  — order-of-declaration issue, not worth restructuring the whole file for).
- **Editability past UNDER_REVIEW (separate follow-up)**: the whole Review Report (including this
  new field) is normally locked once the application leaves `UNDER_REVIEW`
  (`LoanApplication.updateReviewReport()` throws `InvalidLoanApplicationTransitionError` otherwise).
  User needed to set `accountOwner` retroactively on `SML-Self_00058`, an already-Active loan. Asked
  whether to special-case just this field or unlock the whole card; user chose the narrow
  exception. Added `LoanApplication.setMitigationAccountOwner()` — a new domain method deliberately
  NOT gated by the `UNDER_REVIEW` check, merging only `mitigation.accountOwner` into whatever
  `reviewReport` already exists (never clobbers the rest) — plus `SetMitigationAccountOwnerUseCase`,
  a new `PATCH /loan-applications/:id/mitigation-account-owner` endpoint (same
  `requireApplicationAccess` gate as `/review-report`, but no status restriction), and a new
  `canEditAccountOwner` prop on `UnderwritingCard` (= `canReviewLoanApplication`, NOT ANDed with
  `isUnderReview` the way `canEditReview` is). The frontend toggle now auto-saves immediately
  through this dedicated endpoint (no separate "Save" button needed for this one field) via a new
  `setAccountOwnerMutation`.
- **Business rule expansion (separate follow-up, same conversation)**: user then asked for the
  co-borrower to also sign Disclosure Statement, Promissory Note, Data Privacy and Consent Form,
  and Special Power of Attorney — confirmed exceptions: NOT Deed of Assignment - Borrower (mutually
  exclusive per the rule above) and NOT Manulife (insurance-specific). Also, in a still-later
  correction, Acknowledgement Receipt was pulled back OUT (user initially said "lahat" / all, then
  corrected to exclude it). Implemented as two small data-only Prisma migrations (no schema
  changes, since `requiresCoBorrowerSignature` already existed as a column from 2026-07-25):
  `20260729054356_expand_co_borrower_signature_requirement` (sets it `true` for
  `DISCLOSURE_STATEMENT`, `PROMISSORY_NOTE`, `ACKNOWLEDGEMENT_RECEIPT`, `DATA_PRIVACY_CONSENT`) and
  `20260729055055_exclude_acknowledgement_receipt_from_coborrower` (reverts just
  `ACKNOWLEDGEMENT_RECEIPT` back to `false`). **Final state**: co-borrower signs Disclosure
  Statement, Promissory Note, Data Privacy and Consent Form, Loan Agreement - Seafarer, Special
  Power of Attorney, and (conditionally) Deed of Assignment - Co-Borrower. Does NOT sign
  Acknowledgement Receipt, Manulife, or Deed of Assignment - Borrower.

891 backend tests passing throughout (pure data migrations + one new use case, no regressions).
Committed as `9fc0443`.

## 5. Real bug: co-borrower name/signature blank on generated documents (root cause + fix)

User inspected an actual signed Disclosure Statement PDF (via the Read tool's native PDF support —
useful for directly reading a user-supplied PDF's real text/layout without needing OCR) and asked
two questions: (1) why is the Co-Borrower's printed name blank, and (2) why does the co-borrower's
signature land at the very bottom of the page instead of above their name.

**Root cause #1 (blank name)**: `LoanDocumentMergeDataResolver.ts` had the EXACT SAME dual-linkage
co-borrower lookup gap that was fixed in `CreateLoanSigningSessionUseCase` the day before (see
2026-07-28's log §7) — it only checked `loanAccount.coBorrowerIds[0]` (the legacy per-loan join),
never falling back to `coBorrowerRepository.findByBorrowerId()` (the per-Borrower FK the real,
currently-active "Add Co-Borrower" button actually writes to). This is a genuinely separate call
site from the e-signature session fix — fixing one didn't fix the other. Applied the identical
fallback pattern. The docx template itself already had a correctly-placed `{CoBorrowerName}` merge
tag (confirmed by extracting and inspecting the template's raw `word/document.xml`) — the bug was
purely in the data resolver, not the template.

**Root cause #2 (signature at page bottom)**: `PdfLibDocumentSignatureStamper.ts`'s own doc comment
already explained the mechanism — it looks for a `[[SIGNATURE_ANCHOR_CO_BORROWER]]` marker in the
rendered PDF and falls back to a fixed bottom-of-page placement when the marker isn't found.
Extracted `DISCLOSURE_STATEMENT.docx`'s XML directly (no Python available on this machine — used
Node + `jszip` instead, npm-installed into the session scratchpad) and confirmed only
`[[SIGNATURE_ANCHOR]]` (borrower's) existed; the co-borrower marker was simply never added when
this template was authored. Checked `PROMISSORY_NOTE.docx` and `DATA_PRIVACY_CONSENT.docx` too
(the two other templates newly requiring a co-borrower signature per §4 above) — same gap in both.

**Fix — binary .docx template edits**, done carefully to avoid corruption:
1. Extracted each template's `word/document.xml` via `jszip`.
2. Located the `{CoBorrowerName}` (or equivalent) merge-tag paragraph in the raw XML and inserted a
   new invisible anchor paragraph immediately before it — `<w:color w:val="FFFFFF"/><w:sz
   w:val="2"/>` white-on-white, `[[SIGNATURE_ANCHOR_CO_BORROWER]]` — mirroring the exact run
   properties the existing `[[SIGNATURE_ANCHOR]]` marker already used in the same file, verified
   unique-insertion-point-string before replacing.
3. **Critical lesson learned mid-task**: PowerShell's `Compress-Archive` produces a docx zip
   LibreOffice cannot open ("source file could not be loaded") — re-zipping a docx by hand doesn't
   preserve OOXML's zip conventions correctly. Switched to `jszip`'s `loadAsync()` on the ORIGINAL
   file + `zip.file('word/document.xml', newXml)` + `generateAsync()`, which preserves every other
   original zip entry byte-for-byte and only overwrites the one XML part — this round-tripped
   cleanly.
4. **Validated before touching the real template**: converted each patched docx to PDF via the
   machine's actual LibreOffice install (`soffice --headless --convert-to pdf`) and read the
   resulting PDF back with the Read tool to visually confirm the anchor sat in the right spot and
   the file wasn't corrupted, before copying over `app/backend/templates/*.docx`.

**Aside — a pre-existing mystery, now resolved**: earlier in the session (and noted as an
unexplained finding in the prior session's log), `app/backend/templates/DISCLOSURE_STATEMENT.docx`
appeared already modified in the working tree (3.3MB → 1.6MB) with a same-day
`templates-backup-preanchor/` folder sitting alongside it. This turned out to be genuine, relevant
prior work-in-progress from earlier in this same conversation (before the mid-session compaction
this log's own summary was generated from) — someone/something had already started an
anchor-adding pass and made a "preanchor" backup of the original templates first. This session's
own anchor edit for Disclosure Statement is on top of that already-shrunk file, not a fresh
regression.

891 backend tests passing (no code test coverage exists for the .docx binaries themselves — visual
verification only, via the LibreOffice round-trip above).

## 6. Audit-trail repositioning (Signed by / Date / IP address)

Immediately after fixing §5, user asked to also move the "Signed by (Borrower/Co-Borrower) / Date
and Time / IP Address" audit text from its old single shared position (fixed bottom-margin block,
same spot for every signer, offset only by a hardcoded `isCoBorrower ? 55 : 20` to avoid literal
overlap) to sit directly under EACH signer's own printed name — since these templates already
reserve blank "Date:" space there. Asked whether to keep both old-and-new placements or replace;
user chose replace (no duplication).

**Implementation** (`PdfLibDocumentSignatureStamper.ts`): when an anchor is found, the audit lines
now draw starting at `anchor.y - AUDIT_BELOW_ANCHOR_OFFSET` (34pt below the anchor, first-pass
constant — flagged as likely needing a per-template nudge after visual review, same convention as
the existing `TEMPLATE_OFFSETS`/`CO_BORROWER_TEMPLATE_OFFSETS` tables), at `imageX` (aligned under
the signature image itself), 6pt font. Templates without an anchor keep the original fixed
bottom-margin fallback unchanged.

**Not yet visually verified**: attempted to self-test via a disposable script (fetch the latest
regenerated `GeneratedLoanDocument` for `SML-Self_00058` from local storage — bind-mounted into
Docker at `app/backend/storage`, confirmed readable from a local script too — and call
`PdfLibDocumentSignatureStamper.stamp()` directly, twice, simulating both signers). The script hung
indefinitely inside `pdf2json`'s anchor-location step (`Warning: Setting up fake worker.` followed
by no further output, even after 2+ minutes) — suspected environment-specific issue running outside
the Docker container (possibly the path-with-spaces `C:\ECLC CLAUDE CODE\...` tripping up
`pdf2json`'s internal worker resolution; the exact same code runs fine inside the container per
every other UI-driven test this session). Killed the attempt rather than debug an
environment-quirk tangent, and asked the user to sign a real session in the live app and share the
resulting PDF instead — **this is the actual open item for next session**: confirm the new
audit-trail position looks right, and nudge `AUDIT_BELOW_ANCHOR_OFFSET` (or the per-template offset
tables) if it doesn't.

Also in the same pass: exposed `session.channel` on both the public `GetLoanSigningSessionUseCase`
(client-facing signing page) and the staff-facing `ListLoanSigningSessionsUseCase` /
`StaffSigningSessionView`. `LoanSigningPage.tsx`'s OTP screen now says "Send code to my email" /
"we emailed you" instead of always assuming SMS; `LoanDetailPage.tsx`'s signing-session history
list now shows "Sent to {email}" instead of the (unused-for-delivery) phone number when the
channel is EMAIL.

891 backend tests passing. Committed as `d977c37`, pushed (`56e9a9b..d977c37`).

## 7. Live-data cleanup: deleted 11 test signing sessions

User asked to remove the test signing-session history entries visible in the UI for
`SML-Self_00058`. Listed all 11 sessions for the loan first (most unsigned, 2 with real signed
test documents) and explicitly confirmed scope via a multiple-choice question before deleting —
user chose "all 11, including the ones with signed documents." Deleted via a disposable script
(`prisma.loanSigningSession.deleteMany({ where: { loanAccountId } })`) — cascades to
`LoanSigningDocument` rows automatically (`onDelete: Cascade` in schema). A real, deliberate,
user-confirmed destructive action on live data, not a rollback or accidental deletion.

## 8. Loan Application Form Excel template (groundwork, not yet a real feature)

User asked whether an Excel-upload → autofill-Loan-Application-form feature was feasible;
recommended it as easier than the existing AI-reads-a-PDF/image feature (structured data, no OCR
needed) but flagged that column-format consistency across loan officers would determine how
much mapping flexibility the actual import logic needs. Asked for a template file first.

No Python available on this machine (confirmed again, same as prior sessions) — used Node +
`exceljs` (npm-installed into the scratchpad) instead. Built and delivered two candidate template
files matching the real `LoanApplicationCreatePage.tsx` form fields: a form-style (label/value
pairs, sectioned) version and, per a follow-up request, a row-based (one row = one application,
header row + example row + blank rows) version with a legend, required-field styling, and a
`Dependant 1/2` column pair. **Neither wired into any actual import feature yet** — purely a
delivered artifact for the user to review the intended column layout before scoping the real
backend/frontend work.

## 9. New feature: centralized E-signature Logs (proof of every OTP/link send)

Continuation of this same day's session (picked back up after a context-window compaction — the
prior §1-8 above cover the same day's earlier work). User asked directly: "may OTP sms and email
log ba tayo? proof na send sa borrower and co-borrower ang OTP via sms or email?" Investigated
before answering — confirmed via code reading (not assumption) that **neither the OTP send nor the
signing-link send left any persistent record anywhere**: `RequestSigningOtpUseCase` and
`CreateLoanSigningSessionUseCase` call `smsGateway.send()`/`emailGateway.send()` directly with no
DB write; `DryRunAwareSmsGateway`/`DryRunAwareEmailGateway`/`M360SmsGateway`/`NodemailerEmailGateway`
write nothing either (only ephemeral `logger.info` on the dry-run branch); and
`LoanSigningSession.otpCodeHash`/`otpExpiresAt` get overwritten on every resend, so even the
session record itself has no history, just the current pending code (if any).

Proposed building a real log, mockup shown and approved (inline per-session expandable list first,
then the user suggested and I agreed a better design: **centralize it in Reports** — a new page
alongside the existing "Reminder Logs", covering both OTP sends AND signing-link sends across every
loan, rather than adding more density to the Loan Detail page's already-busy e-signature panel).
Second mockup (matching the real Reports Hub / table-page visual pattern) shown and approved.

**Implementation:**
- New Prisma model `SigningNotificationLog` (migration `20260729083058_add_signing_notification_log`)
  — immutable, append-only, one row per LINK or OTP send, FK to both `LoanSigningSession` (cascade
  delete) and `LoanAccount`. `verifiedAt` is set only on the specific OTP row that was actually
  verified (`LoanSigningSession.verifyOtp` always checks the latest-issued code, so "most recent OTP
  row for this session" unambiguously identifies which one).
- `ISigningNotificationLogRepository` (port) + `PrismaSigningNotificationLogRepository` (infra,
  using the module's existing `resolveClient(ctx)` transaction-context convention, not a plain
  singleton).
- Logging calls added to `CreateLoanSigningSessionUseCase` (after a LINK send succeeds) and
  `RequestSigningOtpUseCase` (after an OTP send succeeds) — both wrapped in `.catch(() => undefined)`
  (best-effort; a logging failure must never block the actual send the client is waiting on).
  `VerifySigningOtpUseCase` calls `markLatestOtpVerified()` only when the code actually matched.
- New `ListSigningNotificationLogsUseCase`, presenter, `signingNotificationLogController`, and a
  `GET /signing-notification-logs` route added to the existing `loanSigningRouter` (branch-scoped,
  any authenticated role — same access posture as `GET /sms-reminder-logs`).
- New frontend page `EsignatureLogsPage.tsx` (`/reports/esignature-logs`), mirroring
  `ReminderLogsPage.tsx`'s structure: search + Type/Channel/Party filters, sortable table
  (Sent At / Type / Channel / Loan / Borrower / Party / Sent To / Status), click-through to the loan
  account, pagination. Added to `ReportsHubPage.tsx`'s Operation section next to "Reminder logs".
- 6 new unit tests (`RequestSigningOtpUseCase.test.ts`, `VerifySigningOtpUseCase.test.ts` — neither
  use case had any prior test coverage) covering: SMS vs Email logging branches, that a logging
  failure never blocks the real send/verify result, and that `markLatestOtpVerified` is called only
  on a successful match. 897 backend tests passing (up from 891), `tsc --noEmit` clean on both apps.

**Verification**: no login credentials available in this environment to click through the actual
UI, so verified as much as possible without one — confirmed `GET /signing-notification-logs`
returns `401` (not `404`, proving the route is registered and auth-gated) via `curl`; inserted two
real rows directly against the live Postgres database (tied to a genuine existing
`LoanSigningSession`) and re-ran the exact join query `PrismaSigningNotificationLogRepository.
listLogs()` uses, confirming `loanCode`/`borrowerName` resolve correctly and `verifiedAt` is
`null`/populated as expected on the LINK/OTP rows respectively — then deleted the test rows.
Docker `--no-cache` rebuild completed and containers verified healthy afterward.

## 10. "Sent OTP to:" line added to the signed-document audit trail

Immediate follow-up in the same conversation: user asked to add a "Sent OTP to: [email/mobile]"
line to the same audit-trail block already being repositioned per §6 above (Signed by / Date / IP
address), so the specific document itself carries proof of which channel/recipient the OTP for
that signature went to - not just the new centralized log from §9. Agreed this was easy to add
(the data - `LoanSigningSession.channel`/`email`/`phoneNumber` - is already captured at send time),
but raised a privacy question before implementing: the PDF is a real legal document that can be
downloaded/printed/shared, so should the full contact info print, or a masked version? User chose
masked, with the exact format from the two examples I offered.

**Implementation:**
- New `maskOtpRecipient()` helper in `PdfLibDocumentSignatureStamper.ts`: mobile numbers show first
  4 + `****` + last 3 (`0917****567`); emails show the first character + `***` + the full
  `@domain` (`j***@email.com` - domain left visible since it identifies the provider, not the
  person).
- `StampSignatureInput` gained optional `otpChannel`/`otpRecipient` fields.
  `SignLoanSigningDocumentUseCase` passes `session.channel` and (email if channel is EMAIL and one
  is on file, else the phone number) - same value `SigningNotificationLog` already records for the
  OTP send itself, so the two stay consistent by construction.
- New line inserted into the existing `auditLines` array (both the anchor-based and legacy
  fixed-bottom-margin drawing branches already iterate this array and space lines automatically, so
  no separate layout code was needed) between "Signed by" and "Date".

`tsc --noEmit` clean, 897 backend tests still passing (no existing test coverage for this stamper
module at all - consistent with the rest of it, per §6's own note; visual verification is this
codebase's established pattern here). Backend rebuilt (`--no-cache`) and verified healthy.
**Not yet visually confirmed against a real signed PDF** - same open item as §6's own repositioning
work, now compounded with this addition; next session should confirm both together against one
real signed document from the user.

## Current state / open items for the next session

- **E-signature document generation**: co-borrower name/address now populate correctly on every
  document type (fixed at the merge-data-resolver level, so it's not template-specific). Signature
  anchors now exist for all 4 templates the co-borrower signs that previously lacked one
  (Disclosure Statement, Promissory Note, Data Privacy and Consent Form — Loan Agreement -
  Seafarer, Special Power of Attorney, and Deed of Assignment - Co-Borrower already had anchors
  from 2026-07-25). Both fixes are committed and deployed, but **not yet visually confirmed against
  a real signed PDF** — the user was asked to generate fresh documents, sign both parties in the
  live app, and share the resulting PDF next session (or later this same session, if picked back
  up soon).
- **Audit-trail repositioning + new "Sent OTP to:" line**: both implemented, deployed, same
  unverified-against-a-real-PDF status as above (§10 added the OTP line on top of §6's
  repositioning, same day). `AUDIT_BELOW_ANCHOR_OFFSET = 34` is a first-pass guess — expect a
  follow-up visual-tuning round once the user shares a real signed PDF, likely per-template like the
  existing offset tables. With 4 lines now instead of 3, tight-space templates (e.g. Acknowledgement
  Receipt) are more likely to need that tuning sooner rather than later.
- **New E-signature Logs report** (§9): centralized record of every signing-link and OTP send
  (SMS/Email) at `/reports/esignature-logs`, verified against the real database (route registration
  + a real join-query check) but not yet clicked through in the live UI (no login credentials
  available in this environment) — worth a quick live confirmation next session.
- **Conditional Deed of Assignment / expanded co-borrower signatures**: fully implemented, tested
  against real data changes (`SML-Self_00058`'s own mitigation.accountOwner), and already
  confirmed working correctly by the user mid-session (they directly observed the co-borrower
  batch shrink from 3→2 documents when `accountOwner` was set to `BORROWER`, matching the new
  rule).
- **Underwriting account-owner field**: fully implemented and already used live by the user on
  `SML-Self_00058` via the new past-UNDER_REVIEW edit exception.
- **Excel template**: delivered as a file only. If the user wants to proceed with the actual
  upload-and-autofill feature, next steps would be: confirm final column layout/format from the
  delivered template, design the backend parsing endpoint (likely `exceljs` or similar on the
  backend side too, given no Python on this machine), and wire it into
  `LoanApplicationCreatePage.tsx`'s existing "AI reads a document" panel as a second upload option.
- **11 test signing sessions deleted** for `SML-Self_00058` — the loan's signing history is clean
  as of this log; expect fresh entries once the user signs the newly-regenerated documents to
  verify §6/§7 above.
- Still open from earlier sessions, untouched today: whether to widen Accrued Interest to
  legacy/migrated loans; sidebar brand header redesign mockups; the SOA docx template's literal
  `{PenaltyFromDate} / {PenaltyToDate}` copy for prospective loans.
