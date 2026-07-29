import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import PDFParser from 'pdf2json';
import type { IDocumentSignatureStamper, StampSignatureInput } from '../application/ports/IDocumentSignatureStamper';

function decodeBase64Png(signatureImagePng: string): Buffer {
  const base64 = signatureImagePng.startsWith('data:') ? signatureImagePng.split(',')[1] ?? '' : signatureImagePng;
  return Buffer.from(base64, 'base64');
}

/** 1 pdf2json "unit" is always 1/16 inch, whatever the page's actual point size - confirmed
 * empirically (a Letter-width page reports Width=38.25 units, and 612pt / 38.25 = 16 exactly). */
const PDF2JSON_UNITS_PER_POINT = 16;

const SIGNATURE_ANCHOR_TEXT = '[[SIGNATURE_ANCHOR]]';
const SIGNATURE_ANCHOR_CO_BORROWER_TEXT = '[[SIGNATURE_ANCHOR_CO_BORROWER]]';

/** 2026-07-22 - small hand-tuned per-template nudges on top of the generic anchor position, from
 * direct visual review of signed output (user feedback, several rounds). `dx` positive = right,
 * `dy` positive = up (pdf-lib's y already increases upward, same sense here). Keep these modest -
 * they're corrections for that one template's specific layout quirk, not a substitute for the
 * anchor itself being roughly right. */
const TEMPLATE_OFFSETS: Record<string, { dx?: number; dy?: number }> = {
  PROMISSORY_NOTE: { dx: 30 },
  DISCLOSURE_STATEMENT: { dy: -8 },
  DATA_PRIVACY_CONSENT: { dy: -10 },
  LOAN_AGREEMENT_SALARY: { dx: 30 },
  // 2026-07-25 (user visual review round, e-signature phase 2 templates) - first-pass nudges
  // toward centering the signature over the printed borrower name on each of these 5 templates;
  // may need a further round after the user reviews this regeneration, same as the pass above.
  ACKNOWLEDGEMENT_RECEIPT: { dx: 20, dy: -20 },
  LOAN_AGREEMENT_SEAFARER: { dx: 30, dy: -10 },
  DEED_OF_ASSIGNMENT_BORROWER: { dx: 30 },
  SPECIAL_POWER_OF_ATTORNEY: { dx: 30 },
  MANULIFE: { dx: 30 },
};

/** Same idea as TEMPLATE_OFFSETS, but for the `[[SIGNATURE_ANCHOR_CO_BORROWER]]` marker (2026-07-25,
 * two-party signing) - the co-borrower's own anchor sits at a different spot in each template's
 * layout than the borrower's, so it needs its own (initially empty, i.e. trust the raw anchor
 * position) set of nudges, tuned the same way after visual review. */
const CO_BORROWER_TEMPLATE_OFFSETS: Record<string, { dx?: number; dy?: number }> = {};

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

    if (anchor) {
      // Left-aligned at the anchor's own x (not centered on it) - centering pushed the image's
      // left edge past the printed name's own left edge in narrower 2-column templates
      // (Borrower/Co-Borrower side by side), bleeding into the margin or the neighboring column.
      // A small lift (not a large computed gap) keeps it sitting on/around the anchor's own line -
      // the blank ink space the template already reserves - rather than floating well above it.
      const offsetTable = isCoBorrower ? CO_BORROWER_TEMPLATE_OFFSETS : TEMPLATE_OFFSETS;
      const offset = input.templateCode ? offsetTable[input.templateCode] : undefined;
      imageX = anchor.x + (offset?.dx ?? 0);
      imageY = anchor.y + 2 + (offset?.dy ?? 0);
    } else {
      imageX = 48;
      imageY = 72;
    }

    targetPage.drawImage(signatureImage, { x: imageX, y: imageY, width: imageWidth, height: imageHeight });

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const auditLines = [
      `Signed by (${isCoBorrower ? 'Co-Borrower' : 'Borrower'}): ${input.signerName}`,
      `Date: ${input.signedAtIso}`,
      input.ipAddress ? `IP address: ${input.ipAddress}` : undefined,
    ].filter((line): line is string => Boolean(line));

    if (anchor) {
      // 2026-07-29 (user request) - draw the audit trail directly under this signer's own printed
      // name/anchor instead of a shared bottom-margin block, since these templates already reserve
      // blank space there for a "Date:" line. AUDIT_BELOW_ANCHOR_OFFSET is a first-pass distance
      // below the anchor (image height + the template's own "Signature/printed name" line) - may
      // need per-template tuning after visual review, same as TEMPLATE_OFFSETS above.
      const auditX = imageX;
      const AUDIT_BELOW_ANCHOR_OFFSET = 34;
      let auditY = anchor.y - AUDIT_BELOW_ANCHOR_OFFSET;
      for (const line of auditLines) {
        targetPage.drawText(line, {
          x: auditX,
          y: auditY,
          size: 6,
          font,
          color: rgb(0.45, 0.45, 0.45),
          maxWidth: Math.max(80, width - auditX - 20),
        });
        auditY -= 8;
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
