import { z } from 'zod';
import { decimalStringSchema } from '@shared/http/decimalValidation';

/** 2026-07-15 (Reduce Penalty feature) — `reason` required per the user-confirmed rule that this captures the external approval reference. Range validation (must not exceed the current penalty, installment not already paid) happens in the domain entity, not here. */
export const reducePenaltySchema = z.object({
  newAmount: decimalStringSchema,
  reason: z.string().trim().min(1),
});

export type ReducePenaltyRequestBody = z.infer<typeof reducePenaltySchema>;

/** 2026-07-16 (Adjust Fees feature) — same shape/rationale as `reducePenaltySchema`; bidirectional range validation (non-negative, installment not already paid) happens in the domain entity, not here. */
export const adjustFeesSchema = z.object({
  newAmount: decimalStringSchema,
  reason: z.string().trim().min(1),
});

export type AdjustFeesRequestBody = z.infer<typeof adjustFeesSchema>;
