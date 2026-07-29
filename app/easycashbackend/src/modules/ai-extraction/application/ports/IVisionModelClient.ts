/**
 * Abstraction over the local vision/completion model (Ollama + moondream today) — kept as a port
 * so a different local model, or a future cloud provider, could implement the same interface
 * without touching the use case that calls it (same abstraction precedent as IFileStorage).
 */
export interface IVisionModelClient {
  /** Sends an image + prompt, returns the model's raw text response. */
  describeImage(imageData: Buffer, prompt: string): Promise<string>;
  /** Text-only completion — used for text extracted from PDFs/DOCX rather than an image. */
  complete(prompt: string): Promise<string>;
}
