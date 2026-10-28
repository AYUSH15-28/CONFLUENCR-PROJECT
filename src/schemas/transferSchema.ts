import { z } from 'zod';

export const createTransferSchema = z.object({
  body: z
    .object({
      source_account_id: z
        .string({
          required_error: 'source_account_id is required',
        })
        .trim()
        .min(1, 'source_account_id cannot be empty'),
      destination_account_id: z
        .string({
          required_error: 'destination_account_id is required',
        })
        .trim()
        .min(1, 'destination_account_id cannot be empty'),
      amount: z
        .number({
          required_error: 'Transfer amount is required',
          invalid_type_error: 'Transfer amount must be a number',
        })
        .positive('Transfer amount must be greater than 0')
        .refine(
          (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
          'Transfer amount must have at most 2 decimal places'
        ),
      reference_id: z
        .string({
          required_error: 'Transfer reference_id is required',
        })
        .trim()
        .min(1, 'Transfer reference_id cannot be empty')
        .max(100, 'Transfer reference_id must not exceed 100 characters'),
      description: z
        .string()
        .trim()
        .max(500, 'Transfer description must not exceed 500 characters')
        .optional(),
    })
    .refine((data) => data.source_account_id !== data.destination_account_id, {
      message: 'Source account and destination account cannot be the same',
      path: ['destination_account_id'],
    }),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>['body'];
