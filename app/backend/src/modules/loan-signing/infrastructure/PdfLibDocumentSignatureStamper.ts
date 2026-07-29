import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import PDFParser from 'pdf2json';
import type { IDocumentSignatureStamper, StampSignatureInput } from '../application/ports/IDocumentSignatureStamper';

function decodeBase64Png(signatureImagePng: string): Buffer {
  const base64 = signatureImagePng.startsWith('data:') ? signatureImagePng.split(',')[1] ?? '' : signatureImagePng;
  return Buffer.from(base64, 'base64');
}

/** 2026-07-29 (user-confirmed): the "Sent OTP to:" audit line masks the recipient rather than
 * printing it in full, since a signed PDF may be downloaded/printed/shared. Mobile: first 4 +
 * `****` + last 3 (`0917****567`). Email: first character + `***` + the full `@domain`
 * (`j***@email.com`) - the domain is left visible since it identifies the provider, not the
 * person. Falls back to the raw string unmasked if it's too short to mask meaningfully. */
function maskOtpRecipient(recipient: string, channel: 'SMS' | 'EMAIL'): string {
  if (channel === 'EMAIL') {
    const atIndex = recipient.indexOf('@');
    if (atIndex <= 0) return recipient;
    return `${recipient[0]}***${recipient.slice(atIndex)}`;
  }
  if (recipient.length < 7) return recipient;
  return `${recipient.slice(0, 4)}****${recipient.slice(-3)}`;
}

/** 1 pdf2json "unit" is always 1/16 inch, whatever the page's actual point size - confirmed
 * empirically (a Letter-width page reports Width=38.25 units, and 612pt / 38.25 = 16 exactly). */
const PDF2JSON_UNITS_PER_POINT = 16;

const SIGNATURE_ANCHOR_TEXT = '[[SIGNATURE_ANCHOR]]';
const SIGNATURE_ANCHOR_CO_BORROWER_TEXT = '[[SIGNATURE_ANCHOR_CO_BORROWER]]';

/** 2026-07-22 - small hand-tuned per-template nudges on top of the generic anchor position, from
 * direct visual review of signed output (user feedback, several rounds). `dx`/`dy` position the
 * SIGNATURE IMAGE (`dx` positive = right, `dy` positive = up - pdf-lib's y already increases
 * upward, same sense here). `auditDy` independently positions the AUDIT TEXT block ("Signed by...")
 * - defaults to reusing `dy` when omitted (the common case: a genuinely mispositioned anchor throws
 * off both the image and the text by the same amount), but can be set explicitly when only the
 * audit text needs its own nudge (e.g. it's overlapping the content below it while the signature
 * image itself already looks fine). Keep these modest - they're corrections for that one
 * template's specific layout quirk, not a substitute for the anchor itself being roughly right. */
const TEMPLATE_OFFSETS: Record<string, { dx?: number; dy?: number; auditDy?: number }> = {
  // 2026-07-29 (user-reported, real signed PDF review, second round): raised the Borrower's audit
  // text block one more step (it was overlapping "With marital consent:" below it) - `auditDy: 10`
  // independent of the signature image's `dx: 30` (not flagged as wrong). See
  // CO_BORROWER_TEMPLATE_OFFSETS.PROMISSORY_NOTE below for the matching co-borrower raise that keeps
  // both blocks level with each other.
  PROMISSORY_NOTE: { dx: 30, auditDy: 10 },
  // 2026-07-29 (user-reported, real signed PDF review): the audit text block ("Signed by
  // (Borrower)...") overlapped the "AMORTIZATION SCHEDULE" heading below it - raised via its own
  // `auditDy`, independent of the signature image's `dy` (which the user did not flag as wrong).
  DISCLOSURE_STATEMENT: { dy: -8, auditDy: 2 },
  // 2026-07-29 (user-reported, real signed PDF review): raised the Borrower's audit text block to
  // level with the Co-Borrower's - measured via pdf2json against a freshly-regenerated document:
  // both raw anchors sit at the SAME y here, so the audit blocks were only misaligned because the
  // Co-Borrower had no `auditDy` (defaulting to 0) while the Borrower inherited this `dy: -10`.
  // Pinning `auditDy: 0` here removes that inherited -10 and levels both blocks. See
  // CO_BORROWER_TEMPLATE_OFFSETS.DATA_PRIVACY_CONSENT below for the matching signature-image fix.
  DATA_PRIVACY_CONSENT: { dy: -10, auditDy: 0 },
  LOAN_AGREEMENT_SALARY: { dx: 30 },
  // 2026-07-25 (user visual review round, e-signature phase 2 templates) - first-pass nudges
  // toward centering the signature over the printed borrower name on each of these 5 templates;
  // may need a further round after the user reviews this regeneration, same as the pass above.
  ACKNOWLEDGEMENT_RECEIPT: { dx: 20, dy: -20 },
  // 2026-07-29 (user-reported, measured via pdf2json against a FRESHLY regenerated document for
  // SML-Self_00058, using the user's own just-edited Loan Agreement - Seafarer template - the
  // template edit shifted the anchor's absolute x position from an earlier measurement against an
  // already-signed PDF, so this was re-measured against the current template rather than reused).
  // The borrower's printed name starts ~11pt right of its raw anchor and spans roughly 150pt at
  // this template's font/size - dx centers the (up to 90pt wide) signature image's left edge on
  // the name's estimated horizontal midpoint instead of its very start. First-pass estimate (font
  // metrics approximated, not measured glyph-by-glyph) - may need a further nudge after the user
  // reviews this regeneration.
  // 2026-07-29 (user-reported, real signed PDF review, second round): raised the Borrower's audit
  // text block up to sit just below the printed name - measured via pdf2json against a freshly
  // regenerated document: this template's anchor sits INLINE with the printed name (not on its own
  // line above it, unlike other templates), so the audit block previously landed far below (near
  // "Conforme / Certified by:") instead of right under the name. `auditDy: 22` lands it ~12pt below
  // the anchor - a modest single-line gap. See CO_BORROWER_TEMPLATE_OFFSETS.LOAN_AGREEMENT_SEAFARER
  // below for the matching co-borrower raise (same target y, since both anchors sit at the same
  // height here) and the co-borrower signature-image lower that levels the two signatures.
  LOAN_AGREEMENT_SEAFARER: { dx: 41, dy: -10, auditDy: 22 },
  // 2026-07-29 (user-reported, real signed PDF review): the audit text block overlapped
  // "With Marital consent" below it - measured via pdf2json against a freshly-regenerated document
  // (audit block's last line landed at y=388.99, but "With Marital consent" sits at y=393.46, a
  // ~4.5pt overlap). `auditDy: 10` raises it clear, ending ~5.5pt above that line instead.
  DEED_OF_ASSIGNMENT_BORROWER: { dx: 30, auditDy: 10 },
  // 2026-07-29 (user-reported, real signed PDF review): raised the Borrower's audit text block one
  // step up, to sit closer under the printed name instead of floating further down toward the
  // "With conformity:" section. Image `dx: 30` unchanged (not flagged as wrong).
  SPECIAL_POWER_OF_ATTORNEY: { dx: 30, auditDy: 10 },
  MANULIFE: { dx: 30 },
};

/** Same idea as TEMPLATE_OFFSETS, but for the `[[SIGNATURE_ANCHOR_CO_BORROWER]]` marker (2026-07-25,
 * two-party signing) - the co-borrower's own anchor sits at a different spot in each template's
 * layout than the borrower's, so it needs its own (initially empty, i.e. trust the raw anchor
 * position) set of nudges, tuned the same way after visual review. */
const CO_BORROWER_TEMPLATE_OFFSETS: Record<string, { dx?: number; dy?: number; auditDy?: number }> = {
  // 2026-07-29 (user-reported, measured from a real signed PDF via pdf2json against
  // SML-Self_00058's Promissory Note): the co-borrower's raw anchor sits ~38pt higher on the page
  // than its own printed name/label line - the long co-borrower name wraps to a second line in
  // this template's narrower right column, pushing the anchor paragraph (placed just above the
  // name) up relative to where it visually reads as "next to the borrower's row". Without this,
  // the co-borrower's signature and audit text floated well above the borrower's, overlapping the
  // printed name and the "Co-Borrower's Signature..." label instead of sitting level with it.
  // 2026-07-29 (second round): user asked to raise BOTH audit blocks one more step and keep them
  // level with each other. The signature image's own `dy: -38` (compensating for the mispositioned
  // anchor, see above) is unchanged - only the audit text gets the extra step, via its own
  // `auditDy: -28` (= the same -38 base, + the same +10 step the Borrower's `auditDy` above got),
  // so both blocks move up by an equal 10pt and stay level.
  PROMISSORY_NOTE: { dy: -38, auditDy: -28 },
  // 2026-07-29 (user-reported, re-measured via pdf2json against a FRESHLY regenerated document
  // using the user's own just-edited template - see the borrower entry's own doc comment above for
  // why this was re-measured rather than reused from an earlier already-signed PDF). Unlike
  // Promissory Note, both anchors sit at the SAME height here (no dy needed) - purely a horizontal
  // centering nudge for the co-borrower's (longer) printed name and its own anchor position.
  // First-pass estimate - may need a further nudge.
  // 2026-07-29 (second round): raised the Co-Borrower's audit text to the same target y as the
  // Borrower's (both anchors sit at the same height on this template, so the same `auditDy: 22`
  // lands them level). Also lowered the Co-Borrower's SIGNATURE IMAGE by matching the Borrower's own
  // `dy: -10` - previously unset (0), so the co-borrower's signature sat 10pt higher than the
  // borrower's.
  LOAN_AGREEMENT_SEAFARER: { dx: 87, dy: -10, auditDy: 22 },
  // 2026-07-29 (user-reported, measured via pdf2json against a freshly regenerated document): the
  // co-borrower's printed name starts at x=57.90 and spans a measured 167.85pt - `dx: 59` centers
  // the (up to 90pt-wide) signature image's left edge on the name's midpoint, same convention as
  // LOAN_AGREEMENT_SEAFARER above. `auditDy: 10` raises the co-borrower's audit text one step, same
  // amount as the Borrower's own raise in TEMPLATE_OFFSETS above (this template is a single stacked
  // column, not side-by-side, so there's no "level with the borrower" requirement here - each
  // party's own audit block just needed to sit closer under its own name).
  SPECIAL_POWER_OF_ATTORNEY: { dx: 59, auditDy: 10 },
  // 2026-07-29 (user-reported, real signed PDF review): lowered the co-borrower's SIGNATURE IMAGE
  // to align with the borrower's, level on the same row - the user did NOT flag the co-borrower's
  // own audit text as wrong, so `auditDy: 0` pins it at its current (already correct) position
  // instead of inheriting this `dy` the way PROMISSORY_NOTE's entry above deliberately does.
  DISCLOSURE_STATEMENT: { dy: -10, auditDy: 0 },
  // 2026-07-29 (user-reported, real signed PDF review): lowered the Co-Borrower's SIGNATURE IMAGE
  // to align with the Borrower's - measured via pdf2json against a freshly-regenerated document:
  // both raw anchors sit at the SAME y here, so matching the Borrower's own `dy: -10` levels the two
  // signature images exactly. `auditDy: 0` pins the Co-Borrower's own audit text in place (it was
  // already level with the Borrower's after the TEMPLATE_OFFSETS fix above; the user did not flag it
  // as wrong, so it must not inherit this new `dy`).
  DATA_PRIVACY_CONSENT: { dy: -10, auditDy: 0 },
};

interface AnchorLocation {
  pageIndex: number;
  /** PDF points, bottom-left origin (pdf-lib's coordinate system). */
  x: number;
  y: number;
}

/** Locates the invisible `[[SIGNATURE_ANCHOR]]` marker (see `templates/*.docx` - a tiny, white-on-
 * white run placed just above each template's own "Borrower's Signature over printed name" line by
 * hand, per-template, since every template lays out its signature block differently) inside an
 * already-rendered PDF, converting pdf2json's top-left/16-units-per-inch coordinates into pdf-lib's
 * bottom-left/point coordinate system. Returns `null` if a template has no anchor yet (older
 * templates not yet updated) - the caller falls back to the old fixed bottom-of-page placement. */
async function findSignatureAnchor(pdfBuffer: Buffer, anchorText: string): Promise<AnchorLocation | null> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on('pdfParser_dataError', (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));
    parser.on('pdfParser_dataReady', (pdfData: { Pages: { Height: number; Texts: { x: number; y: number; R: { T: string }[] }[] }[] }) => {
      for (let pageIndex = 0; pageIndex < pdfData.Pages.length; pageIndex++) {
        const page = pdfData.Pages[pageIndex];
        if (!page) continue;
        const match = page.Texts.find((t) => t.R.some((run) => run.T === anchorText));
        if (match) {
          const pageHeightPt = page.Height * PDF2JSON_UNITS_PER_POINT;
          resolve({
            pageIndex,
            x: match.x * PDF2JSON_UNITS_PER_POINT,
            y: pageHeightPt - match.y * PDF2JSON_UNITS_PER_POINT,
          });
          return;
        }
      }
      resolve(null);
    });
    parser.parseBuffer(pdfBuffer);
  });
}

/** 2026-07-22 (e-signature, phase 1). Draws onto the page the signature image, plus a short audit
 * line (signer name, timestamp, IP) tucked into the page's bottom margin - never touches the
 * original document's own content.
 *
 * Placement: if the template has a `[[SIGNATURE_ANCHOR]]` marker (see `findSignatureAnchor` above),
 * the signature is drawn directly AT that spot - the anchor marks the actual blank ink-signature
 * space the template already reserves (either its own blank line, or sitting right beside the
 * printed name), so the image is sized small and placed right on it rather than computed as an
 * offset above it. An offset-based stack (image + a multi-line audit block, both growing upward)
 * was tried first and consistently overshot into whatever paragraph happened to sit above the
 * signature line - tight legal-document line spacing rarely leaves 60-80pt of genuinely blank
 * space above a signature line. The audit text is therefore NOT stacked next to the signature at
 * all anymore - it's a single fixed spot in the page's bottom margin, which is always safely clear
 * of content regardless of where on the page the anchor sits. Templates without an anchor yet fall
 * back to the original fixed bottom-left-of-last-page placement for the image too. */
export class PdfLibDocumentSignatureStamper implements IDocumentSignatureStamper {
  async stamp(input: StampSignatureInput): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(input.pdfBuffer);
    const pages = pdfDoc.getPages();
    if (pages.length === 0) throw new Error('PDF has no pages to stamp.');

    const isCoBorrower = input.anchorTarget === 'CO_BORROWER';
    const anchorText = isCoBorrower ? SIGNATURE_ANCHOR_CO_BORROWER_TEXT : SIGNATURE_ANCHOR_TEXT;
    const anchor = await findSignatureAnchor(input.pdfBuffer, anchorText);
    const targetPage = anchor ? pages[anchor.pageIndex] : pages[pages.length - 1];
    if (!targetPage) throw new Error('PDF has no pages to stamp.');

    const { width } = targetPage.getSize();
    const signatureImageBytes = decodeBase64Png(input.signatureImagePng);
    const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

    // Constrained by height as much as width: these templates' signature lines/rows are often
    // tightly packed (as little as ~20pt of actual blank space in a compact form like the
    // Acknowledgement Receipt), so scaling by width alone let a wide-but-short canvas capture
    // still produce an image tall enough to bleed into the row above.
    const maxImageWidth = anchor ? 90 : 200;
    const maxImageHeight = anchor ? 22 : 200;
    const scale = Math.min(1, maxImageWidth / signatureImage.width, maxImageHeight / signatureImage.height);
    const imageWidth = signatureImage.width * scale;
    const imageHeight = signatureImage.height * scale;

    let imageX: number;
    let imageY: number;
    // 2026-07-29 bug fix: hoisted out of the `if (anchor)` block below so the audit-trail text
    // (drawn further down this function) can apply the SAME per-template dy nudge the signature
    // image already does - previously the audit block always used the raw, un-nudged `anchor.y`,
    // so a template needing a dy correction (e.g. PROMISSORY_NOTE's co-borrower anchor, which sits
    // ~38pt higher than it visually should due to the co-borrower's long printed name wrapping to
    // a second line) had its image moved but its audit text left floating at the old wrong height.
    const offsetTable = isCoBorrower ? CO_BORROWER_TEMPLATE_OFFSETS : TEMPLATE_OFFSETS;
    const offset = input.templateCode ? offsetTable[input.templateCode] : undefined;

    if (anchor) {
      // Left-aligned at the anchor's own x (not centered on it) - centering pushed the image's
      // left edge past the printed name's own left edge in narrower 2-column templates
      // (Borrower/Co-Borrower side by side), bleeding into the margin or the neighboring column.
      // A small lift (not a large computed gap) keeps it sitting on/around the anchor's own line -
      // the blank ink space the template already reserves - rather than floating well above it.
      imageX = anchor.x + (offset?.dx ?? 0);
      imageY = anchor.y + 2 + (offset?.dy ?? 0);
    } else {
      imageX = 48;
      imageY = 72;
    }

    targetPage.drawImage(signatureImage, { x: imageX, y: imageY, width: imageWidth, height: imageHeight });

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const signedByLabel = `Signed by (${isCoBorrower ? 'Co-Borrower' : 'Borrower'}): `;
    const auditLines = [
      `${signedByLabel}${input.signerName}`,
      input.otpChannel && input.otpRecipient
        ? `Sent OTP to: ${maskOtpRecipient(input.otpRecipient, input.otpChannel)}`
        : undefined,
      `Date: ${input.signedAtIso}`,
      input.ipAddress ? `IP address: ${input.ipAddress}` : undefined,
    ].filter((line): line is string => Boolean(line));
    const AUDIT_FONT_SIZE = 6;
    // 2026-07-29 (user request): "Signed by (Borrower):" and "Signed by (Co-Borrower):" are
    // different lengths, so drawing the whole "label + name" line as one string starts the printed
    // NAME at a different x for each signer even when both audit blocks are otherwise aligned. Both
    // signer names are drawn from this same fixed offset (the wider "Co-Borrower" label's width) so
    // the first letter of each name lines up regardless of which label preceded it.
    const SIGNED_BY_NAME_X_OFFSET = font.widthOfTextAtSize('Signed by (Co-Borrower): ', AUDIT_FONT_SIZE);
    const AUDIT_LINE_HEIGHT = 8;
    // 2026-07-29 (real bug, found from a user-shared signed Promissory Note): a long co-borrower
    // name shifted right by SIGNED_BY_NAME_X_OFFSET can run out of room before the page's right
    // margin and wrap to a second line - but every OTHER audit line was still advanced by a fixed
    // single AUDIT_LINE_HEIGHT regardless, so "Sent OTP to:"/"Date:"/"IP address:" ended up drawn
    // on top of the wrapped name text instead of below it. Word-wrap the name ourselves first so we
    // know exactly how many lines it will take, and advance past all of them before the next line.
    function countWrappedLines(text: string, size: number, maxLineWidth: number): number {
      const words = text.split(' ');
      let lines = 1;
      let currentWidth = 0;
      for (const word of words) {
        const wordWidth = font.widthOfTextAtSize(`${word} `, size);
        if (currentWidth > 0 && currentWidth + wordWidth > maxLineWidth) {
          lines += 1;
          currentWidth = wordWidth;
        } else {
          currentWidth += wordWidth;
        }
      }
      return lines;
    }

    // 2026-07-29: measures width the SAME way `countWrappedLines`'s per-word wrap check does
    // (summing each word's own width, not a single kerned measurement of the full string) - pdf-lib's
    // real word-wrap engine (used by `drawText`'s `maxWidth` option) also measures per-word, and it
    // can disagree with a plain `font.widthOfTextAtSize(fullString, size)` call by a couple of points.
    // Using a DIFFERENT measurement to decide "does this need shrinking" than the one used to decide
    // "will this actually wrap" let a shrunk name still overflow onto a second line by a hair - this
    // keeps both decisions consistent with each other.
    function measureUnwrappedWidth(text: string, size: number): number {
      return text.split(' ').reduce((sum, word) => sum + font.widthOfTextAtSize(`${word} `, size), 0);
    }

    if (anchor) {
      // 2026-07-29 (user request) - draw the audit trail directly under this signer's own printed
      // name/anchor instead of a shared bottom-margin block, since these templates already reserve
      // blank space there for a "Date:" line. AUDIT_BELOW_ANCHOR_OFFSET is a first-pass distance
      // below the anchor (image height + the template's own "Signature/printed name" line) - may
      // need per-template tuning after visual review, same as TEMPLATE_OFFSETS above.
      const auditX = imageX;
      const AUDIT_BELOW_ANCHOR_OFFSET = 34;
      let auditY = anchor.y - AUDIT_BELOW_ANCHOR_OFFSET + (offset?.auditDy ?? offset?.dy ?? 0);
      const maxWidth = Math.max(80, width - auditX - 20);
      for (const [index, line] of auditLines.entries()) {
        if (index === 0) {
          const nameMaxWidth = Math.max(80, maxWidth - SIGNED_BY_NAME_X_OFFSET);
          // 2026-07-29 (user request): a long Co-Borrower name that just barely overflows
          // `nameMaxWidth` (common now that the name is shifted right by SIGNED_BY_NAME_X_OFFSET to
          // align with the Borrower's) previously wrapped to a second line, pushing "Sent OTP
          // to:"/"Date:"/"IP address:" an extra line down and breaking the "same spacing rhythm as
          // the Borrower's block" look the user wants. Shrink the name's OWN font size just enough
          // to keep it on one line instead - a fixed extra margin would only work for this one test
          // name's exact length, not real (possibly longer) co-borrower names.
          const MIN_NAME_FONT_SIZE = 4;
          let nameFontSize = AUDIT_FONT_SIZE;
          const nameWidthAtDefault = measureUnwrappedWidth(input.signerName, AUDIT_FONT_SIZE);
          if (nameWidthAtDefault > nameMaxWidth) {
            // A small safety margin (0.98) absorbs any residual floating-point rounding at the exact
            // boundary, so the shrunk size lands safely under the limit instead of right on it.
            nameFontSize = Math.max(MIN_NAME_FONT_SIZE, AUDIT_FONT_SIZE * (nameMaxWidth / nameWidthAtDefault) * 0.98);
          }
          targetPage.drawText(signedByLabel, { x: auditX, y: auditY, size: AUDIT_FONT_SIZE, font, color: rgb(0.45, 0.45, 0.45) });
          targetPage.drawText(input.signerName, {
            x: auditX + SIGNED_BY_NAME_X_OFFSET,
            y: auditY,
            size: nameFontSize,
            font,
            color: rgb(0.45, 0.45, 0.45),
            maxWidth: nameMaxWidth,
          });
          const nameLines = countWrappedLines(input.signerName, nameFontSize, nameMaxWidth);
          auditY -= AUDIT_LINE_HEIGHT * nameLines;
        } else {
          targetPage.drawText(line, { x: auditX, y: auditY, size: AUDIT_FONT_SIZE, font, color: rgb(0.45, 0.45, 0.45), maxWidth });
          auditY -= AUDIT_LINE_HEIGHT;
        }
      }
    } else {
      // Templates without an anchor yet - fall back to the original fixed bottom-margin block.
      // 2026-07-25 (two-party signing): a document that requires both signatures gets stamped
      // twice onto the SAME evolving PDF (see SignLoanSigningDocumentUseCase) - if both audit
      // blocks sat at the same bottom-margin position, the second stamp would draw directly on top
      // of the first, making both unreadable. The co-borrower's block sits higher up, clear of the
      // borrower's.
      const auditX = 40;
      let auditY = (isCoBorrower ? 55 : 20) + (auditLines.length - 1) * 9;
      for (const line of auditLines) {
        targetPage.drawText(line, {
          x: auditX,
          y: auditY,
          size: 7,
          font,
          color: rgb(0.45, 0.45, 0.45),
          maxWidth: width - auditX * 2,
        });
        auditY -= 9;
      }
    }

    const stampedBytes = await pdfDoc.save();
    return Buffer.from(stampedBytes);
  }
}
