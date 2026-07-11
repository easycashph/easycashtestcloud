/** No official/community types package exists for `mammoth` — minimal ambient declaration
 * covering only the function this codebase actually calls. */
declare module 'mammoth' {
  export function extractRawText(input: { buffer: Buffer }): Promise<{ value: string; messages: unknown[] }>;
}
