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

/** 2026-08-15 (Add Fee feature) — `amount` (not `newAmount`: this adds a new charge, it doesn't
 * replace an existing figure like `adjustFeesSchema`'s does) must be a positive decimal string;
 * the entity itself is what actually enforces "greater than zero" (`InvalidFeeChargeAmountError`),
 * this schema just rejects a non-decimal string early. `reason` required, same convention as
 * every other financial-action schema in this file. */
export const addFeeSchema = z.object({
  amount: decimalStringSchema,
  reason: z.string().trim().min(1),
});

export type AddFeeRequestBody = z.infer<typeof addFeeSchema>;
