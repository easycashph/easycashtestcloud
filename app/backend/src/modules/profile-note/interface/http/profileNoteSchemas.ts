import { z } from 'zod';

export const profileNoteOwnerTypeSchema = z.enum(['BORROWER', 'LOAN_ACCOUNT', 'LOAN_APPLICATION']);

export const listProfileNotesQuerySchema = z.object({
  ownerType: profileNoteOwnerTypeSchema,
  ownerId: z.string().min(1),
});

export const createProfileNoteSchema = z.object({
  ownerType: profileNoteOwnerTypeSchema,
  ownerId: z.string().min(1),
  text: z.string().min(1),
});

export type CreateProfileNoteRequestBody = z.infer<typeof createProfileNoteSchema>;
