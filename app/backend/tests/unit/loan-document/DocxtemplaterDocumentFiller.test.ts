import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import PizZip from 'pizzip';
import { DocxtemplaterDocumentFiller } from '@modules/loan-document/infrastructure/DocxtemplaterDocumentFiller';
import { TemplateFileNotConfiguredError } from '@modules/loan-document/domain/errors/LoanDocumentDomainErrors';

/** Minimal but valid `.docx` (OOXML WordprocessingML) package — just enough for docxtemplater to parse and render, not a real Word-authored file. */
function buildSyntheticDocx(bodyText: string): Buffer {
  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>',
  );
  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:body><w:p><w:r><w:t>${bodyText}</w:t></w:r></w:p></w:body>` +
      '</w:document>',
  );
  return zip.generate({ type: 'nodebuffer' });
}

describe('DocxtemplaterDocumentFiller', () => {
  let templatesDir: string;

  beforeEach(() => {
    templatesDir = mkdtempSync(join(tmpdir(), 'loan-doc-templates-'));
  });

  afterEach(() => {
    rmSync(templatesDir, { recursive: true, force: true });
  });

  it('fills {Placeholder} fields with the supplied data', async () => {
    writeFileSync(join(templatesDir, 'TEST_TEMPLATE.docx'), buildSyntheticDocx('Hello {Name}, your amount is {Amount}.'));
    const filler = new DocxtemplaterDocumentFiller(templatesDir);

    const resultBuffer = await filler.fill('TEST_TEMPLATE', { Name: 'Juan Dela Cruz', Amount: '10,000.00' });

    const resultZip = new PizZip(resultBuffer);
    const documentXml = resultZip.file('word/document.xml')?.asText();
    expect(documentXml).toContain('Hello Juan Dela Cruz, your amount is 10,000.00.');
  });

  it('throws TemplateFileNotConfiguredError when the .docx file does not exist yet', async () => {
    const filler = new DocxtemplaterDocumentFiller(templatesDir);

    await expect(filler.fill('NOT_UPLOADED_YET', {})).rejects.toThrow(TemplateFileNotConfiguredError);
  });
});
