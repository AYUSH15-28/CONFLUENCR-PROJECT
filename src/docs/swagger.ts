export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Transaction Ledger API',
    version: '1.0.0',
    description:
      'A robust, production-grade Transaction Ledger Backend API with MongoDB. Supports account creation, credit and debit transactions, balance retrieval, paginated and filtered transaction history, and atomic multi-account transfers.',
    contact: {
      name: 'WalnutFolks / Confluencr Assessment',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000/api/v1',
      description: 'Local Development Server',
    },
  ],
  tags: [
    { name: 'Accounts', description: 'Account lifecycle and balance management' },
    { name: 'Transactions', description: 'Atomic credit and debit ledger transactions' },
    { name: 'Transfers', description: 'Bonus: Atomic inter-account money transfers' },
  ],
  paths: {
    '/accounts': {
      post: {
        tags: ['Accounts'],
        summary: 'Create a new account',
        description:
          'Creates a new account with a unique system-generated ID, timestamp, and an initial balance strictly set to 0. Clients cannot set the initial balance.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateAccountRequest',
              },
              example: {
                name: 'John Doe',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Account created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AccountResponse',
                },
              },
            },
          },
          '400': {
            description: 'Validation Error (e.g. name missing, or client attempted to set balance)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/accounts/{id}': {
      get: {
        tags: ['Accounts'],
        summary: 'Get account details',
        description: 'Retrieves full account information by account ID.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Unique account identifier',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Account details retrieved',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AccountResponse',
                },
              },
            },
          },
          '404': {
            description: 'Account not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/accounts/{id}/balance': {
      get: {
        tags: ['Accounts'],
        summary: 'Get account balance',
        description: 'Retrieves the current balance of an account.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Unique account identifier',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Balance retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/BalanceResponse',
                },
              },
            },
          },
          '404': {
            description: 'Account not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/accounts/{id}/transactions': {
      post: {
        tags: ['Transactions'],
        summary: 'Add a transaction to an account',
        description:
          'Adds a credit or debit transaction to the account atomically. Ensures idempotency via unique reference_id per account. Rejects debits if balance is insufficient.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Unique account identifier',
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateTransactionRequest',
              },
              example: {
                type: 'credit',
                amount: 150.5,
                description: 'Salary Deposit',
                reference_id: 'TXN-REF-1001',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Transaction recorded successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TransactionResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input or validation error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '404': {
            description: 'Account not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate reference_id for this account',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '422': {
            description: 'Insufficient balance for debit transaction',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
      get: {
        tags: ['Transactions'],
        summary: 'Get transaction history',
        description:
          'Fetches transaction history for an account. Supports optional filtering by transaction type (credit/debit), pagination, and results sorted in latest-first order.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Account ID',
            schema: { type: 'string' },
          },
          {
            name: 'type',
            in: 'query',
            required: false,
            description: 'Filter by transaction type (credit or debit)',
            schema: { type: 'string', enum: ['credit', 'debit'] },
          },
          {
            name: 'page',
            in: 'query',
            required: false,
            description: 'Page number (>= 1, default: 1)',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Items per page (1-100, default: 10)',
            schema: { type: 'integer', default: 10 },
          },
        ],
        responses: {
          '200': {
            description: 'Transaction history retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TransactionHistoryResponse',
                },
              },
            },
          },
          '404': {
            description: 'Account not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/transfers': {
      post: {
        tags: ['Transfers'],
        summary: 'Bonus: Transfer money between accounts',
        description:
          'Atomically transfers funds from a source account to a destination account. Generates two corresponding ledger records and rolls back completely if any step fails.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TransferRequest',
              },
              example: {
                source_account_id: 'acc-uuid-1',
                destination_account_id: 'acc-uuid-2',
                amount: 50.0,
                reference_id: 'TRF-REF-9001',
                description: 'Payment for services',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Transfer completed successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TransferResponse',
                },
              },
            },
          },
          '400': {
            description: 'Validation error (e.g. source and destination are identical)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '404': {
            description: 'Source or destination account not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '409': {
            description: 'Duplicate transfer reference_id',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '422': {
            description: 'Insufficient balance in source account',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      CreateAccountRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            example: 'Alice Johnson',
            description: 'Name of the account holder',
          },
        },
      },
      Account: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'd3b07384-d113-46fb-a0fb-b939c09c2a21' },
          name: { type: 'string', example: 'Alice Johnson' },
          balance: { type: 'number', example: 0 },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      AccountResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/Account' },
        },
      },
      BalanceResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              account_id: { type: 'string', example: 'd3b07384-d113-46fb-a0fb-b939c09c2a21' },
              balance: { type: 'number', example: 150.5 },
            },
          },
        },
      },
      CreateTransactionRequest: {
        type: 'object',
        required: ['type', 'amount', 'description', 'reference_id'],
        properties: {
          type: {
            type: 'string',
            enum: ['credit', 'debit'],
            example: 'credit',
          },
          amount: {
            type: 'number',
            minimum: 0.01,
            example: 100.0,
          },
          description: {
            type: 'string',
            example: 'Direct deposit',
          },
          reference_id: {
            type: 'string',
            example: 'TXN-REF-1001',
          },
        },
      },
      Transaction: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '7d69b4c0-f8a4-4a57-b087-7323b7b4a20b' },
          account_id: { type: 'string', example: 'd3b07384-d113-46fb-a0fb-b939c09c2a21' },
          type: { type: 'string', enum: ['credit', 'debit'], example: 'credit' },
          amount: { type: 'number', example: 100.0 },
          description: { type: 'string', example: 'Direct deposit' },
          reference_id: { type: 'string', example: 'TXN-REF-1001' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      TransactionResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/Transaction' },
        },
      },
      TransactionHistoryResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Transaction' },
          },
          pagination: {
            type: 'object',
            properties: {
              current_page: { type: 'integer', example: 1 },
              page_size: { type: 'integer', example: 10 },
              total_records: { type: 'integer', example: 25 },
              total_pages: { type: 'integer', example: 3 },
            },
          },
        },
      },
      TransferRequest: {
        type: 'object',
        required: ['source_account_id', 'destination_account_id', 'amount', 'reference_id'],
        properties: {
          source_account_id: { type: 'string', example: 'acc-uuid-1' },
          destination_account_id: { type: 'string', example: 'acc-uuid-2' },
          amount: { type: 'number', minimum: 0.01, example: 50.0 },
          reference_id: { type: 'string', example: 'TRF-REF-9001' },
          description: { type: 'string', example: 'Dinner share' },
        },
      },
      TransferResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              transfer: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  source_account_id: { type: 'string' },
                  destination_account_id: { type: 'string' },
                  amount: { type: 'number' },
                  reference_id: { type: 'string' },
                  created_at: { type: 'string' },
                },
              },
              source_account: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  previous_balance: { type: 'number' },
                  new_balance: { type: 'number' },
                },
              },
              destination_account: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  previous_balance: { type: 'number' },
                  new_balance: { type: 'number' },
                },
              },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INSUFFICIENT_BALANCE' },
              message: { type: 'string', example: 'Insufficient balance for this debit transaction.' },
              details: { type: 'object' },
            },
          },
        },
      },
    },
  },
};
