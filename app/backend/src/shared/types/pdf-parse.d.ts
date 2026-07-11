/** `pdf-parse@1.x` ships no bundled types and has no maintained `@types` package — minimal ambient
 * declaration covering only what this codebase calls. Declared against `pdf-parse/lib/pdf-parse.js`
 * (the inner implementation), not the package root `pdf-parse` — the root `index.js` wrapper has a
 * long-standing bug where `!module.parent` incorrectly evaluates true under some module loaders
 * (including Vitest's), triggering a leftover self-test that crashes trying to read a fixture file
 * this project doesn't have. Importing the inner file directly skips that wrapper entirely. */
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PDFParseResult {
    text: string;
    numpages: number;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PDFParseResult>;
  export = pdfParse;
}
