import { z } from 'zod';

export const createAccountSchema = z.object({
  body: z
    .object({
      name: z
        .string({
          required_error: 'Account holder name is required',
          invalid_type_error: 'Account holder name must be a string',
        })
        .trim()
        .min(1, 'Account holder name cannot be empty')
        .max(100, 'Account holder name must not exceed 100 characters'),
      balance: z.undefined({
        invalid_type_error: 'Client is not allowed to set initial balance. Initial balance is always 0.',
      }),
      initial_balance: z.undefined({
        invalid_type_error: 'Client is not allowed to set initial balance. Initial balance is always 0.',
      }),
    })
    .strict({
      message: 'Unexpected fields provided in request body. Setting initial balance is not allowed.',
    }),
});

export const accountIdParamSchema = z.object({
  params: z.object({
    id: z
      .string({
        required_error: 'Account ID parameter is required',
      })
      .trim()
      .min(1, 'Account ID must not be empty'),
  }),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>['body'];

