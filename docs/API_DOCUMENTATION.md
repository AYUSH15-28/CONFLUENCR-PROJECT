# Transaction Ledger API Documentation

The **Transaction Ledger API** provides a backend service for managing accounts, recording financial ledger transactions (credits and debits), retrieving balances, and inspecting transaction histories with filtering, pagination, and sorting.

Base URL: `http://localhost:3000/api/v1`  
Interactive Swagger UI: `http://localhost:3000/api-docs`  
OpenAPI Specification: `http://localhost:3000/swagger.json`

---

## Standard Error Response Format
All errors return a consistent JSON schema:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable explanation of error.",
    "details": {}
  }
}
```

Common Error Codes:
- `VALIDATION_ERROR` (400) - Request payload or parameter validation failed.
- `ACCOUNT_NOT_FOUND` (404) - Account identifier does not exist.
- `INSUFFICIENT_BALANCE` (422) - Debit requested exceeds current available balance.
- `DUPLICATE_TRANSACTION` (409) - A transaction with the specified `reference_id` already exists for this account.
- `TRANSACTION_IMMUTABLE` (400) - Modifying or deleting ledger records is forbidden.
- `INTERNAL_ERROR` (500) - Internal server error.

---

## Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `POST` | `/accounts` | Create a new account (initial balance = 0) |
| `GET` | `/accounts/:id` | Fetch account details |
| `GET` | `/accounts/:id/balance` | Fetch current account balance |
| `POST` | `/accounts/:id/transactions` | Create a credit or debit transaction |
| `GET` | `/accounts/:id/transactions` | Get paginated, filtered transaction history |
| `POST` | `/transfers` | Transfer money between two accounts (Bonus) |

---

## 1. Create Account
Creates a new account holder.

- **Method**: `POST`
- **Path**: `/api/v1/accounts`
- **Request Body**:
```json
{
  "name": "Jane Doe"
}
```
> **Note**: Clients are not allowed to set `balance` or `initial_balance`. Passing them results in `400 Bad Request`.

- **Success Response** (`201 Created`):
```json
{
  "success": true,
  "data": {
    "id": "3587b140-5e3a-4467-8cfb-640fae41846b",
    "name": "Jane Doe",
    "balance": 0,
    "created_at": "2026-10-28T09:30:00.000Z"
  }
}
```

---

## 2. Get Account Balance
Retrieves current balance for a specified account.

- **Method**: `GET`
- **Path**: `/api/v1/accounts/:id/balance`
- **Success Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "account_id": "3587b140-5e3a-4467-8cfb-640fae41846b",
    "balance": 150.00
  }
}
```
- **Error Response** (`404 Not Found`):
```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_NOT_FOUND",
    "message": "Account with ID '...' was not found."
  }
}
```

---

## 3. Add Transaction (Credit / Debit)
Adds an immutable credit or debit transaction to the account and atomically updates the account balance.

- **Method**: `POST`
- **Path**: `/api/v1/accounts/:id/transactions`
- **Request Body**:
```json
{
  "type": "credit",
  "amount": 100.50,
  "description": "Consulting invoice payout",
  "reference_id": "INV-2026-001"
}
```

### Parameters
- `type`: `'credit'` | `'debit'` (required)
- `amount`: Number `> 0`, up to 2 decimal places (required)
- `description`: String (required)
- `reference_id`: Unique identifier string for this transaction within this account (required)

- **Success Response** (`201 Created`):
```json
{
  "success": true,
  "data": {
    "id": "8d3ea094-1b15-46f9-bbbf-670d8a571650",
    "account_id": "3587b140-5e3a-4467-8cfb-640fae41846b",
    "type": "credit",
    "amount": 100.5,
    "description": "Consulting invoice payout",
    "reference_id": "INV-2026-001",
    "created_at": "2026-10-28T09:35:00.000Z"
  }
}
```

### Error Responses
- **422 Unprocessable Entity** (Insufficient balance for debit):
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance. Current balance is 70.00, attempted debit is 150.00."
  }
}
```
- **409 Conflict** (Duplicate reference_id for same account):
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_TRANSACTION",
    "message": "Transaction with reference_id 'INV-2026-001' already exists for account '3587b140-5e3a-4467-8cfb-640fae41846b'."
  }
}
```

---

## 4. Get Transaction History
Retrieves all transactions for an account with optional filtering by type, pagination, and latest-first sorting.

- **Method**: `GET`
- **Path**: `/api/v1/accounts/:id/transactions`
- **Query Parameters**:
  - `type` (optional): `'credit'` or `'debit'` (omitted returns both)
  - `page` (optional): Page number (integer `>= 1`, default: `1`)
  - `limit` (optional): Page size (integer `1-100`, default: `10`)

- **Success Response** (`200 OK`):
```json
{
  "success": true,
  "data": [
    {
      "id": "e67e3bf8-a579-4bc7-9a4f-561bcf7047ab",
      "account_id": "3587b140-5e3a-4467-8cfb-640fae41846b",
      "type": "debit",
      "amount": 30.0,
      "description": "Office Supplies",
      "reference_id": "REF-SUPPLIES-02",
      "created_at": "2026-10-28T09:40:00.000Z"
    },
    {
      "id": "8d3ea094-1b15-46f9-bbbf-670d8a571650",
      "account_id": "3587b140-5e3a-4467-8cfb-640fae41846b",
      "type": "credit",
      "amount": 100.5,
      "description": "Consulting invoice payout",
      "reference_id": "INV-2026-001",
      "created_at": "2026-10-28T09:35:00.000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "page_size": 10,
    "total_records": 2,
    "total_pages": 1
  }
}
```

---

## 5. Bonus: Transfer Money
Atomically transfers money from one account to another account.

- **Method**: `POST`
- **Path**: `/api/v1/transfers`
- **Request Body**:
```json
{
  "source_account_id": "3587b140-5e3a-4467-8cfb-640fae41846b",
  "destination_account_id": "993c16e1-955a-4bb3-a337-375ad56a9394",
  "amount": 30.00,
  "reference_id": "TRF-2026-001",
  "description": "Split trip cost"
}
```

- **Success Response** (`201 Created`):
```json
{
  "success": true,
  "data": {
    "transfer": {
      "id": "c1f7a6f2-8924-4fc6-bfe0-559d8fa9e564",
      "source_account_id": "3587b140-5e3a-4467-8cfb-640fae41846b",
      "destination_account_id": "993c16e1-955a-4bb3-a337-375ad56a9394",
      "amount": 30,
      "reference_id": "TRF-2026-001",
      "description": "Split trip cost",
      "created_at": "2026-10-28T09:45:00.000Z"
    },
    "source_account": {
      "id": "3587b140-5e3a-4467-8cfb-640fae41846b",
      "previous_balance": 100,
      "new_balance": 70
    },
    "destination_account": {
      "id": "993c16e1-955a-4bb3-a337-375ad56a9394",
      "previous_balance": 50,
      "new_balance": 80
    }
  }
}
```
