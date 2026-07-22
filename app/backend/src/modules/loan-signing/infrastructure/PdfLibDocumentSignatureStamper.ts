import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { IDocumentSignatureStamper, StampSignatureInput } from '../application/ports/IDocumentSignatureStamper';

function decodeBase64Png(signatureImagePng: string): Buffer {
  const base64 = signatureImagePng.startsWith('data:') ? signatureImagePng.split(',')[1] ?? '' : signatureImagePng;
  return Buffer.from(base64, 'base64');
}

/** 2026-07-22 (e-signature, phase 1). `pdf-lib` is pure JS with no native/shell dependency
 * (unlike the docx→PDF conversion step, which shells out to LibreOffice) - a good fit for a
 * lightweight overlay onto an already-rendered PDF. Draws onto the LAST page: the signature image
 * plus a short audit line (signer name, timestamp, IP) - never touches the original document's
 * own content. */
export class PdfLibDocumentSignatureStamper implements IDocumentSignatureStamper {
  async stamp(input: StampSignatureInput): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(input.pdfBuffer);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    if (!lastPage) throw new Error('PDF has no pages to stamp.');

    const { width } = lastPage.getSize();
    const signatureImageBytes = decodeBase64Png(input.signatureImagePng);
    const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

    const maxImageWidth = 200;
    const scale = Math.min(1, maxImageWidth / signatureImage.width);
    const imageWidth = signatureImage.width * scale;
    const imageHeight = signatureImage.height * scale;

    const marginLeft = 48;
    const marginBottom = 72;

    lastPage.drawImage(signatureImage, {
      x: marginLeft,
      y: marginBottom,
      width: imageWidth,
      height: imageHeight,
    });

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const auditLines = [
      `Signed by: ${input.signerName}`,
      `Date: ${input.signedAtIso}`,
      input.ipAddress ? `IP address: ${input.ipAddress}` : undefined,
    ].filter((line): line is string => Boolean(line));

    let textY = marginBottom - 12;
    for (const line of auditLines) {
      lastPage.drawText(line, {
        x: marginLeft,
        y: textY,
        size: 8,
        font,
        color: rgb(0.35, 0.35, 0.35),
        maxWidth: width - marginLeft * 2,
      });
      textY -= 10;
    }

    const stampedBytes = await pdfDoc.save();
    return Buffer.from(stampedBytes);
  }
}
