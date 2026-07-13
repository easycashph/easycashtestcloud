import { z } from 'zod';

export const noteOwnerTypeSchema = z.enum(['BORROWER', 'LOAN_ACCOUNT', 'LOAN_APPLICATION']);

export const listNotesQuerySchema = z.object({
  ownerType: noteOwnerTypeSchema,
  ownerId: z.string().min(1),
});

export const createNoteSchema = z.object({
  ownerType: noteOwnerTypeSchema,
  ownerId: z.string().min(1),
  text: z.string().min(1),
});

export type CreateNoteRequestBody = z.infer<typeof createNoteSchema>;
