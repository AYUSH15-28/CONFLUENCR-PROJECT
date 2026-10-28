import { z } from 'zod';

export const createTransactionSchema = z.object({
  params: z.object({
    id: z
      .string({
        required_error: 'Account ID parameter is required',
      })
      .trim()
      .min(1, 'Account ID must not be empty'),
  }),
  body: z
    .object({
      type: z.enum(['credit', 'debit'], {
        errorMap: () => ({ message: "Transaction type must be either 'credit' or 'debit'" }),
      }),
      amount: z
        .number({
          required_error: 'Transaction amount is required',
          invalid_type_error: 'Transaction amount must be a number',
        })
        .positive('Transaction amount must be greater than 0')
        .refine(
          (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
          'Transaction amount must have at most 2 decimal places'
        ),
      description: z
        .string({
          required_error: 'Transaction description is required',
          invalid_type_error: 'Transaction description must be a string',
        })
        .trim()
        .min(1, 'Transaction description cannot be empty')
        .max(500, 'Transaction description must not exceed 500 characters'),
      reference_id: z
        .string({
          required_error: 'Transaction reference_id is required',
          invalid_type_error: 'Transaction reference_id must be a string',
        })
        .trim()
        .min(1, 'Transaction reference_id cannot be empty')
        .max(100, 'Transaction reference_id must not exceed 100 characters'),
    })
    .strict(),
});

export const getTransactionsQuerySchema = z.object({
  params: z.object({
    id: z
      .string({
        required_error: 'Account ID parameter is required',
      })
      .trim()
      .min(1, 'Account ID must not be empty'),
  }),
  query: z.object({
    type: z
      .enum(['credit', 'debit'], {
        errorMap: () => ({ message: "Filter type must be either 'credit' or 'debit'" }),
      })
      .optional(),
    page: z
      .string()
      .optional()
      .default('1')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val >= 1, {
        message: 'Page must be an integer greater than or equal to 1',
      }),
    limit: z
      .string()
      .optional()
      .default('10')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val >= 1 && val <= 100, {
        message: 'Limit must be an integer between 1 and 100',
      }),
  }),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>['body'];
export type GetTransactionsQuery = z.infer<typeof getTransactionsQuerySchema>['query'];

