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
async function findSignatureAnchor(pdfBuffer: Buffer): Promise<AnchorLocation | null> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on('pdfParser_dataError', (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));
    parser.on('pdfParser_dataReady', (pdfData: { Pages: { Height: number; Texts: { x: number; y: number; R: { T: string }[] }[] }[] }) => {
      for (let pageIndex = 0; pageIndex < pdfData.Pages.length; pageIndex++) {
        const page = pdfData.Pages[pageIndex];
        if (!page) continue;
        const match = page.Texts.find((t) => t.R.some((run) => run.T === SIGNATURE_ANCHOR_TEXT));
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

/** 2026-07-22 (e-signature, phase 1). Draws onto the page the signature image plus a short audit
 * line (signer name, timestamp, IP) - never touches the original document's own content.
 *
 * Placement: if the template has a `[[SIGNATURE_ANCHOR]]` marker (see `findSignatureAnchor` above),
 * the signature is drawn directly above it - i.e. above the printed name / "Signature over printed
 * name" line, matching where a physically-signed copy would actually be signed. Templates that
 * don't have an anchor yet fall back to the original fixed bottom-left-of-last-page placement. */
export class PdfLibDocumentSignatureStamper implements IDocumentSignatureStamper {
  async stamp(input: StampSignatureInput): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(input.pdfBuffer);
    const pages = pdfDoc.getPages();
    if (pages.length === 0) throw new Error('PDF has no pages to stamp.');

    const anchor = await findSignatureAnchor(input.pdfBuffer);
    const targetPage = anchor ? pages[anchor.pageIndex] : pages[pages.length - 1];
    if (!targetPage) throw new Error('PDF has no pages to stamp.');

    const { width } = targetPage.getSize();
    const signatureImageBytes = decodeBase64Png(input.signatureImagePng);
    const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

    const maxImageWidth = anchor ? 100 : 200;
    const scale = Math.min(1, maxImageWidth / signatureImage.width);
    const imageWidth = signatureImage.width * scale;
    const imageHeight = signatureImage.height * scale;

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const auditLines = [
      `Signed by: ${input.signerName}`,
      `Date: ${input.signedAtIso}`,
      input.ipAddress ? `IP address: ${input.ipAddress}` : undefined,
    ].filter((line): line is string => Boolean(line));

    let imageX: number;
    let imageY: number;
    const lineHeight = 10;

    if (anchor) {
      // Stack (bottom to top): the anchor/name line, then the audit text (Signed by / Date / IP -
      // closest to the anchor so it reads naturally as a caption right under the signature), then
      // the signature image on top. Left-aligned starting at the anchor's own x (not centered on
      // it) - centering pushed the image's left edge past the printed name's own left edge in
      // narrower 2-column templates (Borrower/Co-Borrower side by side), bleeding into the margin
      // or the neighboring column.
      const gapAboveAnchor = 4;
      const gapBetweenTextAndImage = 6;
      imageX = anchor.x;
      const auditBlockHeight = auditLines.length * lineHeight;
      imageY = anchor.y + gapAboveAnchor + auditBlockHeight + gapBetweenTextAndImage;
    } else {
      imageX = 48;
      imageY = 72;
    }

    targetPage.drawImage(signatureImage, { x: imageX, y: imageY, width: imageWidth, height: imageHeight });

    // Anchored case: text sits BELOW the image, immediately above the anchor line - drawn top to
    // bottom in natural reading order (Signed by / Date / IP), ending closest to the anchor.
    // Fallback (no anchor) case: unchanged, text below the image growing downward.
    let textY = anchor ? imageY - lineHeight : imageY - 12;
    const textX = anchor ? imageX : 48;
    const textDirection = -1;
    // `width - textX * 2` (the original formula) assumes textX sits near the left margin - it goes
    // negative once an anchor lands in a right-hand column (e.g. a Co-Borrower/Assignor block),
    // which made pdf-lib wrap the audit lines into garbled, overlapping fragments. These lines are
    // always short (~30-45 chars at 8pt), so a fixed budget clamped to whatever room is actually
    // left before the page's right edge is enough, and never goes negative.
    const auditTextMaxWidth = Math.max(100, Math.min(220, width - textX - 24));
    for (const line of auditLines) {
      targetPage.drawText(line, {
        x: textX,
        y: textY,
        size: 8,
        font,
        color: rgb(0.35, 0.35, 0.35),
        maxWidth: auditTextMaxWidth,
      });
      textY += textDirection * lineHeight;
    }

    const stampedBytes = await pdfDoc.save();
    return Buffer.from(stampedBytes);
  }
}
