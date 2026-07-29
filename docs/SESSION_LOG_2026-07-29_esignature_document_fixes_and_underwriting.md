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

## 11. Real bug found and fixed: co-borrower signature/audit block misaligned on Promissory Note

User shared a real signed PDF (`SML-Self_00058_Promissory_Note_signed.pdf`) - exactly the visual
confirmation §6/§10 were both waiting on. Read it directly (native PDF support) and found the
co-borrower's signature image and "Signed by (Co-Borrower).../Sent OTP to.../Date/IP address" block
sat noticeably higher than the borrower's, overlapping the co-borrower's own printed name and the
"Co-Borrower's Signature over printed name/Date" label - not level with the borrower's row as
intended.

**Root cause, measured (not guessed)**: copied the file into the backend container and ran
`pdf2json` directly against it (this environment's earlier attempts to self-test the stamper hung
outside Docker - running the *same* tool standalone, without going through the full
`PdfLibDocumentSignatureStamper.stamp()` pipeline, worked fine). Found the co-borrower's raw
`[[SIGNATURE_ANCHOR_CO_BORROWER]]` anchor sits exactly **38.2pt higher** on the page than the
borrower's `[[SIGNATURE_ANCHOR]]`, in pdf-lib's bottom-origin coordinates - almost certainly because
the co-borrower's long printed name wraps to a second line in this template's narrower right
column, and the anchor (placed just above the name) ends up a full line higher relative to where it
"should" sit to look level with the borrower's side.

**A second, independent bug found while investigating**: the audit-trail text block's Y position
(`auditY = anchor.y - AUDIT_BELOW_ANCHOR_OFFSET`) used the **raw, un-nudged** `anchor.y` - it never
applied the per-template `TEMPLATE_OFFSETS`/`CO_BORROWER_TEMPLATE_OFFSETS` `dy` correction the
signature *image* already respected. So even a template with a correctly-tuned image offset would
still have had its audit text floating at the wrong height. Fixed by hoisting the `offset` lookup
out of the image-positioning `if` block so both the image draw and the audit-text draw apply the
same `dy`.

**Fix**: added `PROMISSORY_NOTE: { dy: -38 }` to the previously-empty `CO_BORROWER_TEMPLATE_OFFSETS`
table.

**Verification**: rather than trust the arithmetic alone, generated a **fresh** Promissory Note for
the same real loan (`SML-Self_00058`) using the user's own just-edited template (see §12) by
requiring the compiled `LoanDocumentMergeDataResolver`/`DocxtemplaterDocumentFiller`/
`LibreOfficeDocxToPdfConverter` classes directly inside the running backend container (a disposable
script, deleted after use) - real merge data from the real database, real LibreOffice conversion,
same pipeline production uses. Re-measured both anchors on the fresh output: **raw gap was still
exactly 38.208pt** (confirming the template edits in §12 didn't change this template's structural
layout), and with the `dy: -38` fix applied, borrower vs co-borrower `imageY` differ by only
**0.21pt** - effectively perfectly level. `tsc --noEmit` clean, 897 backend tests still passing,
backend rebuilt (`--no-cache`) and verified healthy.

**Not yet re-confirmed against a real freshly-signed PDF** - the math and the actual anchor
positions are now verified directly, but nobody has re-signed a real Promissory Note through the
live app since this fix shipped. Should be quick to confirm next time e-signature testing comes up.

### 11b. Second round: raise both blocks one more step (level-preserving) + a real wrap-overlap bug

User shared an ACTUAL freshly-signed Promissory Note this time (not a mockup/regeneration) and
asked to raise both audit blocks one more step while keeping them level with each other. Reading the
PDF directly also surfaced a real, previously-unnoticed bug: the Co-Borrower's long name
(`TEST2COBORR TEST2COBORR TEST2`) wraps to a second line at its new x-position (from §14's
name-alignment fix - shifting the name right by `SIGNED_BY_NAME_X_OFFSET` left less room before the
page's right margin than the name needs), but every subsequent audit line was still advanced by a
fixed single `AUDIT_LINE_HEIGHT` regardless of the wrap - so `IP address: ::ffff:172.18.0.1` ended
up rendered with the wrapped name fragment ("TEST2") drawn directly on top of it, reading as
`::ffff:172.18.0.TEST2` in the shared PDF.

**Raise + level fix**: `TEMPLATE_OFFSETS.PROMISSORY_NOTE` → `{ dx: 30, auditDy: 10 }` (Borrower's
audit text raised 10pt, image `dx` untouched); `CO_BORROWER_TEMPLATE_OFFSETS.PROMISSORY_NOTE` →
`{ dy: -38, auditDy: -28 }` (Co-Borrower's audit text raised the same 10pt from its existing -38
base, image `dy` untouched) - both blocks move up by an equal amount and stay level (same pattern as
§14's `auditDy` mechanism).

**Wrap-overlap fix (real bug, not a cosmetic nudge)**: added a `countWrappedLines()` helper that
word-wraps the signer's name against the same `maxWidth` pdf-lib will use, so the exact number of
lines the name will take is known BEFORE drawing the lines below it. The audit block's Y cursor now
advances by `AUDIT_LINE_HEIGHT * nameLines` after the name line instead of a hardcoded single line -
fixes this for any signer name length going forward, not just this specific test name.

**Verification**: `tsc --noEmit` clean, 897 backend tests passing, backend rebuilt (`--no-cache`)
and recreated, confirmed healthy. Verified against a freshly-regenerated real Promissory Note for
`SML-Self_00058`, stamped via the actual `stamp()` function, measured with `pdf2json`: Borrower's
"Signed by (Borrower):" at y=348.99, Co-Borrower's at y=349.20 (0.21pt apart - level, as before, now
both raised). Co-Borrower's audit lines below the wrapped name now step by 16pt instead of 8pt (
`Sent OTP to:` at y=333.20, 16pt below the name start) with no overlap, vs. the previous fixed-8pt
step that caused the collision in the user's shared PDF.

**Not yet re-confirmed against a real freshly-signed PDF** - same caveat as the first round; next
signed Promissory Note from the live app should be checked to confirm both fixes together.

## 12. User's own template content edits (8 templates) - confirmed baked into the running backend

User edited `DATA_PRIVACY_CONSENT`, `DEED_OF_ASSIGNMENT_BORROWER`, `DEED_OF_ASSIGNMENT_CO_BORROWER`,
`DEED_OF_ASSIGNMENT_SALARY`, `LOAN_AGREEMENT_SALARY`, `LOAN_AGREEMENT_SEAFARER`, `PROMISSORY_NOTE`,
and `SPECIAL_POWER_OF_ATTORNEY` directly (content, not code - the actual `.docx` files on disk) and
asked whether a rebuild was needed. Confirmed yes (this machine bakes `templates/` into the backend
image at build time, doesn't bind-mount it), and - since a `--no-cache` rebuild for §11's fix was
already in flight when these edits landed - verified via `md5sum` (host vs. inside the running
container, same technique already used earlier the same day for `DISCLOSURE_STATEMENT.docx`) that
all 8 files matched exactly post-rebuild, confirming every edit is live. No content of these edits
was reviewed/authored by me - purely a "is it deployed" check.

## 13. Loan Agreement - Seafarer: centered both signatures over their printed names

User shared a second real signed PDF (`SML-Self_00058_Loan_Agreement_-_Seafarer_signed.pdf`) and
asked to center both parties' signatures over their printed names (unlike Promissory Note, this
template's Borrower and Co-Borrower anchors sit at the exact same page height - `pdf2json`
confirmed no `dy` issue here, purely a horizontal `dx` centering request).

**First measurement pass**: copied the signed PDF into the backend container, ran `pdf2json`
directly to get exact anchor/printed-name x-coordinates, and estimated each name's rendered width
using `pdf-lib`'s `HelveticaBold.widthOfTextAtSize()` as an approximation (corrected down ~28%
after noticing the raw estimate for the co-borrower's name would have overflowed the page's right
margin - the template's actual font is narrower than Helvetica Bold). Computed candidate `dx`
values to land the (up to 90pt-wide) signature image's horizontal center on each name's estimated
midpoint: borrower `dx: 56`, co-borrower `dx: 102`.

**Correction found before shipping**: regenerating a fresh, unsigned Seafarer document for the same
loan (via the actual `LoanDocumentMergeDataResolver`/`DocxtemplaterDocumentFiller`/
`LibreOfficeDocxToPdfConverter` pipeline, run directly inside the backend container) revealed the
anchor's **absolute** x-position had shifted from the earlier signed-PDF measurement - because
`LOAN_AGREEMENT_SEAFARER.docx` was one of the 8 templates the user had just edited (§12). Re-derived
the correct `dx` values against the current template's actual layout instead of the stale
already-signed one: borrower `dx: 30 → 41`, co-borrower (new entry) `dx: 87`. **Lesson for next
time**: always re-measure against a freshly-regenerated document when the underlying template may
have changed, never trust coordinates pulled from an older signed PDF at face value.

**Verification**: recomputed the final stamped image bounds against each name's estimated midpoint
using the corrected `dx` values and the freshly-measured anchor/name positions - borrower off by
~0.3pt, co-borrower off by ~0.2pt from perfectly centered. Also ran the actual
`PdfLibDocumentSignatureStamper.stamp()` function (not just the arithmetic) against the fresh
document with a synthetic 90pt-wide test signature image (hand-rolled a minimal PNG encoder in the
verification script since neither `canvas`, `jimp`, nor `sharp` are installed in this environment)
to confirm the real code path completes without error end-to-end. `tsc --noEmit` clean, 897 backend
tests still passing throughout both rounds, backend rebuilt (`--no-cache`) twice (once per `dx`
correction) and verified healthy each time.

**Not yet visually confirmed against a real signed PDF** - same open item as §11, now covering a
second template; next session should confirm both together (Promissory Note + Loan Agreement -
Seafarer) against fresh real signatures from the user.

## 14. Disclosure Statement: audit-text/signature-image alignment + name x-alignment (2 rounds)

User shared a third real signed PDF (`SML-Self_00058_Disclosure_Statement_signed.pdf`) with two
itemized requests, then a follow-up request after reviewing that fix's output.

**Round 1 (two independent requests in one message)**:
1. Raise the Borrower's audit text block up once - it overlapped the "AMORTIZATION SCHEDULE"
   heading below it.
2. Lower the Co-Borrower's signature IMAGE (not audit text) once, to align with the Borrower's row
   - the audit text was NOT flagged as wrong for the co-borrower.

This was the first case where the image position and audit-text position needed to move
**independently** - the existing code (from the Promissory Note fix, §11) coupled them together via
a single shared `dy`. Added a new `auditDy?: number` field to `PdfLibDocumentSignatureStamper.ts`'s
offset types, used by the audit-text `auditY` calculation in preference to `dy`
(`offset?.auditDy ?? offset?.dy ?? 0`) when explicitly set, falling back to reusing `dy` otherwise -
zero behavior change for every other template/entry that doesn't set it (Promissory Note's
co-borrower fix in particular still needed the coupled behavior, since there BOTH the image and
audit text were off by the same anchor-position bug).
- `TEMPLATE_OFFSETS.DISCLOSURE_STATEMENT`: `{ dy: -8 }` → `{ dy: -8, auditDy: 2 }` (raises the
  Borrower's audit text only).
- `CO_BORROWER_TEMPLATE_OFFSETS.DISCLOSURE_STATEMENT` (new entry): `{ dy: -10, auditDy: 0 }` (lowers
  the Co-Borrower's signature image only; `auditDy: 0` explicitly pins the co-borrower's own audit
  text in place, since without it the fallback would have inherited the new `dy: -10` and moved text
  that wasn't flagged as wrong).

**Round 2** (after reviewing round 1's output): "i pantay din itong dalawa sa unang letra ng
pangalan ng Borrower at Co-borrower" - align the first letter of the Borrower's and Co-Borrower's
printed names in the audit text. Root cause: `"Signed by (Borrower): "` and
`"Signed by (Co-Borrower): "` are different lengths (the label itself, not a coordinate offset) -
each signer's full "label + name" line was drawn as ONE string, so the actual NAME started at a
different x for each signer even when the audit blocks were otherwise level. (First checked whether
this was a `dx`/anchor-position issue by measuring both anchors via `pdf2json` against a freshly
regenerated document - found the anchors sit ~265pt apart on this template, which is expected since
Borrower and Co-Borrower are in separate table columns; that ruled out a coordinate-offset fix and
confirmed the real cause was the label-length difference.) Fixed by splitting the "Signed by
(...): " label from the signer's name into two separate `drawText` calls, both signers' names now
starting from the same fixed x offset (`SIGNED_BY_NAME_X_OFFSET`, the width of the wider
`"Signed by (Co-Borrower): "` label) measured from their own label's start - so the name's first
letter lines up consistently relative to its own audit block regardless of which label preceded it.
This only changes the first audit line (`Signed by (...)`); the `Sent OTP to:` / `Date:` /
`IP address:` lines use the same label on both signers already and were left untouched.

**Verification**: `tsc --noEmit` clean and 897 backend tests passing after each round. Backend
rebuilt (`--no-cache`) twice (once per round) and recreated; confirmed healthy each time. Verified
by regenerating a fresh, unsigned Disclosure Statement for `SML-Self_00058` via the actual
`LoanDocumentMergeDataResolver`/`DocxtemplaterDocumentFiller`/`LibreOfficeDocxToPdfConverter`
pipeline, running the real `PdfLibDocumentSignatureStamper.stamp()` against it for both signers, then
dumping the resulting text positions with `pdf2json`:
- Borrower audit block at y=390.54, Co-Borrower's at y=388.54 (2pt higher for Borrower only, as
  requested - Co-Borrower unchanged).
- Borrower name starts at x=226.22 (its own label starts at x=157.10, gap 69.12pt); Co-Borrower name
  starts at x=491.66 (its own label starts at x=422.54, gap 69.12pt) - identical gap for both,
  confirming the name-alignment fix works as intended.

**Not yet visually confirmed against a real signed PDF** - same open-item pattern as §11/§13, now a
third template; next session should confirm all three together (Promissory Note, Loan Agreement -
Seafarer, Disclosure Statement) against fresh real signatures from the user.

## 15. Four more real signed PDFs reviewed: Data Privacy Consent, Loan Agreement - Seafarer (round 2),
Special Power of Attorney, Deed of Assignment - Borrower

User shared four more real signed PDFs for `SML-Self_00058` in quick succession, each with its own
alignment complaint, using the exact same "share a signed PDF → measure via pdf2json → apply the
minimal targeted offset → verify against a fresh regeneration" workflow established in §11/§13/§14.

**Data Privacy and Consent Form**: same "Co-Borrower's audit text and signature sit higher than the
Borrower's" pattern as §14's Disclosure Statement fix. Measured both raw anchors at the identical
y=106.75 - so the Co-Borrower was only higher because it lacked the Borrower's inherited `dy: -10`.
`TEMPLATE_OFFSETS.DATA_PRIVACY_CONSENT` → `{ dy: -10, auditDy: 0 }` (levels the Borrower's audit text
with the Co-Borrower's by removing the inherited offset); new
`CO_BORROWER_TEMPLATE_OFFSETS.DATA_PRIVACY_CONSENT` → `{ dy: -10, auditDy: 0 }` (lowers the
Co-Borrower's signature image to match the Borrower's, `auditDy: 0` keeps its own audit text where it
already was, since only the image was flagged as wrong).

**Loan Agreement - Seafarer, second round**: user asked to raise BOTH audit blocks up to sit just
below their printed names, and lower the Co-Borrower's signature image to align with the Borrower's.
This template's anchor is unusual - it sits INLINE with the printed name (not on its own line above
it), so the existing fixed `AUDIT_BELOW_ANCHOR_OFFSET` landed the audit block far below the name,
near "Conforme / Certified by:". Added `auditDy: 22` to both `TEMPLATE_OFFSETS.LOAN_AGREEMENT_SEAFARER`
(image `dx`/`dy` unchanged) and `CO_BORROWER_TEMPLATE_OFFSETS.LOAN_AGREEMENT_SEAFARER` (which also
got `dy: -10` added to lower its signature image level with the Borrower's, matching the Borrower's
own `dy`).

**Special Power of Attorney**: single-column, stacked layout (Borrower's block above the
Co-Borrower's "With conformity:" block - not side-by-side like the other templates), so no
"level with each other" requirement here, just each party's own block needing its own fix.
Borrower: `auditDy: 10` (raised one step, was floating too far down toward "With conformity:").
Co-Borrower: new entry `{ dx: 59, auditDy: 10 }` - `dx: 59` centers the (up to 90pt-wide) signature
image over the co-borrower's printed name (measured via pdf2json: name starts at x=57.90, spans a
measured 167.85pt), `auditDy: 10` raises its own audit text the same one step as the Borrower's.

**Deed of Assignment - Borrower**: a real, previously-unnoticed overlap bug, same shape as §14's
Disclosure Statement finding - the audit block's last line (`IP address:`) landed at y=388.99 but
"With Marital consent" sits at y=393.46, a ~4.5pt overlap. `TEMPLATE_OFFSETS.DEED_OF_ASSIGNMENT_BORROWER`
→ `{ dx: 30, auditDy: 10 }` raises the block 10pt, clearing the overlap with ~5.5pt to spare.

**Operational issue found and fixed**: this round's fixes were shipped across several consecutive
`docker compose build --no-cache backend` calls, each launched in the background while working on the
next template's fix. Two of these builds ended up overlapping in flight (the Special Power of
Attorney build was still running when the Deed of Assignment build was kicked off) - both reported
"completed, exit 0", but the OLDER build's image finished writing the `latest` tag AFTER the newer
one, silently reverting the Deed of Assignment fix in the running container while keeping the other
three. Caught this by inspecting the compiled `dist/*.js` inside the container directly (not just
trusting "build succeeded") and finding `DEED_OF_ASSIGNMENT_BORROWER: { dx: 30 }` (missing
`auditDy: 10`) despite the source file being correct. Fixed by running one final rebuild synchronously
(not backgrounded) and re-confirming all four templates' offsets in the compiled output before
re-verifying. **Lesson for next time**: don't launch a new background Docker rebuild while a prior one
for the same image may still be in flight - either wait for the notification first, or verify the
compiled output's actual content (not just "build succeeded") before trusting a rebuild landed.

**Verification**: `tsc --noEmit` clean and 897 backend tests passing throughout. After the clean
rebuild, regenerated fresh documents for all four templates via the real
`LoanDocumentMergeDataResolver`/`DocxtemplaterDocumentFiller`/`LibreOfficeDocxToPdfConverter` pipeline,
stamped with the real `PdfLibDocumentSignatureStamper.stamp()`, and confirmed via `pdf2json`:
- Data Privacy Consent: Borrower and Co-Borrower "Signed by (...):" both at y=84.75 - level.
- Loan Agreement - Seafarer: Borrower and Co-Borrower both at y=196.99 - level. (Note: this
  template's raw anchor y is not a fixed constant - it shifts slightly run-to-run based on
  dynamically-rendered content on that page, so the exact absolute y varies between verification runs;
  what matters and was confirmed is that both signers always land at the SAME y as each other.)
- Special Power of Attorney: each party's own block is present and populated correctly (Borrower
  y=526.85, Co-Borrower y=435.34 - expected to differ, single-column layout).
- Deed of Assignment - Borrower: audit block's last line at y=410.99, clear of "With Marital consent"
  at y=393.46 (17.5pt gap).

**Not yet visually confirmed against real freshly-signed PDFs** - same open-item pattern as every
prior alignment fix this session; next session should confirm all six templates fixed today
(Promissory Note, Disclosure Statement, Loan Agreement - Seafarer, Data Privacy Consent, Special Power
of Attorney, Deed of Assignment - Borrower) against fresh real signatures from the user.

## 16. Real bug found and properly fixed: Co-Borrower name wrap broke the "same spacing as Borrower"
rhythm on Disclosure Statement (and any other template with a long Co-Borrower name)

User shared ANOTHER real signed Disclosure Statement and flagged that the gap under "Signed by
(Co-Borrower): ..." didn't match the Borrower's block - the Co-Borrower's name was wrapping to a
second line (same underlying cause as §11b's Promissory Note wrap bug: shifting the name right by
`SIGNED_BY_NAME_X_OFFSET` for §14's name-alignment fix left less room before the page's right margin),
pushing "Sent OTP to:"/"Date:"/"IP address:" an extra 8pt lower than the Borrower's matching lines.
§11b's fix only prevented the OVERLAP that wrapping caused - it didn't stop the wrap itself, so the
visual rhythm mismatch the user is now describing was still there even after that fix.

**First attempt (wrong)**: shrink the name's font size to fit within `nameMaxWidth`, sizing the shrink
ratio off `font.widthOfTextAtSize(fullString, size)` (a single kerned measurement of the whole name).
Verified via pdf2json against a fresh regeneration - the name STILL wrapped, just at the smaller size.

**Root cause of the first attempt's failure**: pdf-lib's actual word-wrap engine (used internally by
`drawText`'s `maxWidth` option, and mirrored by this codebase's own `countWrappedLines` helper from
§11b) measures width per-word, summing each word's individual width - it does NOT use a single
whole-string measurement. For `"TEST2COBORR TEST2COBORR TEST2"` at the relevant size, the per-word sum
measured ~2pt wider than the single whole-string measurement. My shrink ratio was computed from the
whole-string number, so the "shrunk" text still measured over the limit by the wrap engine's own
(per-word) yardstick, and wrapped anyway.

**Correct fix**: added `measureUnwrappedWidth()`, which sums per-word widths (`font.widthOfTextAtSize
(word + ' ', size)` per word) - the exact same method `countWrappedLines` already used - and switched
the shrink-ratio calculation to use it instead of the whole-string measurement, so the "does this need
shrinking" and "will this actually wrap" decisions are now measured identically. Also added a small
0.98 safety margin to the shrink ratio to absorb any residual floating-point rounding at the exact
boundary.

**Verification**: `tsc --noEmit` clean, 897 tests passing. Backend rebuilt (`--no-cache`, run
synchronously this time per §15's lesson) and recreated, confirmed healthy. Verified against a fresh
Disclosure Statement regeneration, stamped via the real `stamp()`: the Co-Borrower's full name
`"TEST2COBORR TEST2COBORR TEST2"` now renders on ONE line (y=388.54), and "Sent OTP to:" for the
Co-Borrower sits exactly 8pt below it (y=380.54) - matching the Borrower's own 8pt gap
(y=390.54 → y=382.54) exactly, as requested.

This fix is template-agnostic (lives in the shared stamping code, not a per-template offset), so it
also resolves the same wrap-rhythm issue on the Promissory Note and any other template where a long
Co-Borrower name would otherwise wrap.

**Not yet visually confirmed against a real signed PDF.**

## 17. Loan Agreement - Seafarer: audit text was too close to the printed name (§15's round-2 fix
overcorrected)

User shared another real signed Loan Agreement - Seafarer and flagged the audit trail text as now
sitting "naka-dikit" (stuck/glued) to the printed name - §15's round 2 had raised both audit blocks
via `auditDy: 22` (landing ~12pt below the anchor) specifically to address the opposite problem (audit
text floating too far down near "Conforme / Certified by:"), but 12pt turned out too tight once
measured against the printed name's actual rendered size.

**Measured (not guessed) via pdf2json against a fresh regeneration**: this template's printed name
renders at **10pt** font size. At only 12pt total gap between the name's baseline and the audit text's
baseline, there's very little visual clearance once the name's own glyph height is accounted for -
close enough to read as "touching" even without literal pixel overlap.

**Fix**: backed `auditDy` off from `22` to `14` on both `TEMPLATE_OFFSETS.LOAN_AGREEMENT_SEAFARER` and
`CO_BORROWER_TEMPLATE_OFFSETS.LOAN_AGREEMENT_SEAFARER` (kept in sync so both signers stay level with
each other, per §15's requirement) - lands the audit text ~20pt below the anchor instead of ~12pt,
giving comfortable breathing room while staying well above the pre-§15 position that was too far away
in the first place.

**Verification**: `tsc --noEmit` clean, 897 tests passing. Backend rebuilt (`--no-cache`, run
synchronously) and recreated, confirmed healthy. Verified via a fresh regeneration stamped with the
real `stamp()`: printed name at y=196.99, audit text now starts at y=188.99 (20pt gap, up from the
previous 12pt), Borrower and Co-Borrower both still land at the same y as each other (188.99) -
level, as required.

**Not yet visually confirmed against a real signed PDF.**

## 18. Architecture change: audit text now left-aligns to the printed name's own x, not the signature
image's x

User asked a design question - showed a mockup request first (per this repo's own workflow
convention: mockup before implementing) - about whether the audit trail text could always align to
wherever the Borrower's/Co-Borrower's printed name itself starts, rather than reusing the signature
image's x (which is a per-template `dx` hand-tuned for CENTERING the image over the name, and often
doesn't coincide with the name's own left edge). Explicitly scoped down to text-only: the signature
image's position/sizing was left completely untouched.

**Design shown as a mockup** (two-card before/after comparison) before writing any code, confirmed by
the user, then implemented.

**Implementation**: extended `findSignatureAnchor()`'s return value (`AnchorLocation`) with an
optional `nameX` field - after locating the anchor's own text run inside the already-parsed pdf2json
page data, it also searches the SAME page for the actual printed-name text run and returns its x.
`auditX` (previously always `= imageX`) now reads `anchor.nameX ?? imageX`, falling back to the old
behavior if no plausible name text is found.

**Real bug found during first-pass verification**: the initial name-detection heuristic only looked
to the RIGHT of the anchor, assuming the name always sits at or after the anchor's own x (true for
several templates - Loan Agreement - Seafarer, Special Power of Attorney, where the anchor is placed
immediately before the name on the same line). Verified against Disclosure Statement, though, and
found the printed name there actually starts ~54pt to the LEFT of its own anchor (the anchor is
placed after the blank ink-signature space, not before the name) - the right-only search missed the
real name entirely and instead matched the OTHER signer's name column, which happened to fall within
the (too generous) x window on the same line.

**Fix**: switched the candidate window to filter by absolute horizontal distance from the anchor
(`Math.abs(nameCandidate.x - anchor.x) <= 90`) instead of a one-sided range, correctly covering both
"name after anchor" (Seafarer, SPOA) and "name before anchor" (Disclosure Statement) cases while still
excluding the other signer's name column, which sits 200pt+ away regardless of direction. Tie-breaks
(when a candidate matches on vertical distance) now prefer the smallest horizontal distance, so a
same-y candidate from the other signer's side never wins over the further-but-still-nearby real name.

**Verification**: `tsc --noEmit` clean, 897 tests passing throughout both rounds. Backend rebuilt
(`--no-cache`, synchronous) and recreated, confirmed healthy each time. Verified against fresh
regenerations of 4 templates spanning every anchor/name layout this codebase has (side-by-side
same-y, side-by-side anchor-above-name, inline-same-line, and Promissory Note's mixed case) -
Disclosure Statement, Special Power of Attorney, Loan Agreement - Seafarer, Promissory Note - and
confirmed each signer's audit text now lands close to their own name's actual start x (small ~4-8pt
run-to-run variance observed, consistent with the same dynamic-content-drift behavior already
documented for Loan Agreement - Seafarer's anchor position in §17 - not a bug), and no longer locks
onto the other signer's name in any of the 4 templates tested.

**Signature image position/sizing is completely unchanged** - this only affects where the audit text
block starts horizontally.

**Not yet visually confirmed against a real signed PDF** - and unlike the per-template offset fixes
above, this is a change to the shared detection logic itself, so it's worth a broader spot-check
across a few different templates (not just one) when real signed PDFs are available next.

## 19. Real bug found and fixed: re-signing the same document as the same party stamped on top of
that party's OWN prior signature instead of the pristine original

User shared a screenshot showing badly overlapping, doubled audit text and signature ink on a
Disclosure Statement - two "Signed by (Borrower)"/"Sent OTP to"/"Date"/"IP address" blocks and two
signature strokes stacked directly on top of each other for BOTH Borrower and Co-Borrower.

**Root cause**: `SignLoanSigningDocumentUseCase.execute()` picks a "base PDF" to stamp onto - either
the pristine original, or (2026-07-25, two-party signing) the OTHER party's already-signed copy, so
Borrower's and Co-Borrower's ink end up on ONE final PDF instead of two separate single-signature
copies. The lookup filtered out only the CURRENT session (`s.id !== session.id`) but never checked
whether a candidate "prior signed" entry belonged to the SAME party. `SML-Self_00058` has been
signed and re-signed many times this session for testing (a fresh signing session each time a
position fix needed checking) - so when a NEW Borrower session signed the document, the lookup found
an EARLIER Borrower session's already-signed copy (not the Co-Borrower's, which is what it should
look for) and stamped a second Borrower signature directly on top of the first, at the identical
anchor position - producing exactly the doubled/overlapping look in the screenshot.

**Fix**: `app/backend/src/modules/loan-signing/application/use-cases/SignLoanSigningDocumentUseCase.ts`
- added `s.partyType !== session.partyType` to the "prior signed entry" filter, so only the OPPOSITE
party's signed copy is ever used as the base; a same-party re-sign now always starts fresh from the
pristine original.

**New regression test**: `tests/unit/loan-signing/SignLoanSigningDocumentUseCase.test.ts` (new file,
3 tests) - confirms (1) stamping onto the opposite party's signed copy still works as designed, (2) the
exact bug scenario (a same-party prior signed session must NOT be used as the base - regression test
for this fix), (3) falls back to the pristine original when nothing has been signed yet.

**Verification**: `tsc --noEmit` clean, 900 backend tests passing (897 + 3 new). Backend rebuilt
(`--no-cache`, synchronous) and recreated, confirmed healthy.

**Live-data cleanup (user-confirmed)**: with explicit confirmation, deleted all 24 `LoanSigningSession`
rows for `SML-Self_00058` (cascades to their `LoanSigningDocument` and `SigningNotificationLog` rows)
and removed their corresponding `storage/loan-signing/{sessionId}/` signed-PDF directories from disk.
Confirmed 0 remaining sessions and notification logs for this loan afterward. This loan's signing
history and e-signature logs are now completely clean - the next real sign-through will be the first
data point since today's fixes, with no leftover doubled-up PDFs to confuse future testing.

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
- **Audit-trail repositioning + "Sent OTP to:" line + Promissory Note co-borrower alignment fix**:
  the user's real signed PDF (§11) confirmed the Promissory Note's co-borrower block was
  misaligned; root-caused and fixed (`CO_BORROWER_TEMPLATE_OFFSETS.PROMISSORY_NOTE = { dy: -38 }`
  plus the audit-text-ignoring-the-offset bug), verified via a freshly-generated real document
  (0.21pt final gap). `AUDIT_BELOW_ANCHOR_OFFSET = 34` is still a first-pass guess for every OTHER
  template though — expect the same per-template `dy` tuning to be needed elsewhere once the user
  signs and shares PDFs from other templates (Acknowledgement Receipt especially, being the
  tightest-space one). Not yet re-confirmed with a fresh real signature after this exact fix
  shipped.
- **Loan Agreement - Seafarer signature centering** (§13): both `TEMPLATE_OFFSETS` and
  `CO_BORROWER_TEMPLATE_OFFSETS` entries added/corrected (`dx: 41` borrower, `dx: 87`
  co-borrower), verified mathematically against a freshly-regenerated real document to within
  ~0.3pt of centered. Same "not yet confirmed against an actual freshly-signed PDF" caveat as the
  Promissory Note fix above.
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
- **Disclosure Statement audit-text/signature alignment + name x-alignment** (§14): `auditDy` field
  added to decouple image position from audit-text position; Borrower audit text raised, Co-Borrower
  signature image lowered, both signer names now start from a consistent x offset regardless of
  label length. Verified mathematically against a freshly-regenerated real document. Same "not yet
  confirmed against an actual freshly-signed PDF" caveat as the Promissory Note and Loan Agreement -
  Seafarer fixes above - next session should confirm all three together.
- **Four more template alignment fixes** (§15): Data Privacy Consent, Loan Agreement - Seafarer
  (round 2), Special Power of Attorney, Deed of Assignment - Borrower. All verified mathematically
  against freshly-regenerated real documents after a clean (non-overlapping) Docker rebuild. Same
  "not yet confirmed against an actual freshly-signed PDF" caveat as every other alignment fix this
  session - six templates total now pending that real-signature confirmation.
- **Docker rebuild lesson** (§15): don't launch overlapping background `--no-cache` rebuilds for the
  same image - the older one can finish last and silently win the tag, reverting newer fixes. Verify
  compiled `dist/*.js` content directly when in doubt, not just the "build succeeded" notification.
- Still open from earlier sessions, untouched today: whether to widen Accrued Interest to
  legacy/migrated loans; sidebar brand header redesign mockups; the SOA docx template's literal
  `{PenaltyFromDate} / {PenaltyToDate}` copy for prospective loans.
