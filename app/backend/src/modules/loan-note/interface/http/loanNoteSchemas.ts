import { z } from 'zod';

export const createLoanNoteSchema = z.object({
  text: z.string().min(1),
});

export type CreateLoanNoteRequestBody = z.infer<typeof createLoanNoteSchema>;
