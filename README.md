# Transaction Ledger API

A robust, enterprise-grade backend API for a simple financial transaction ledger system built with **Node.js**, **Express**, **TypeScript**, and **MongoDB**.

---

## 📋 Table of Contents
- [Objective & Features](#-objective--features)
- [Tech Stack](#-tech-stack)
- [Project Architecture](#-project-architecture)
- [Key Business Rules & Integrity Guarantees](#-key-business-rules--integrity-guarantees)
- [Quick Start Guide](#-quick-start-guide)
  - [Prerequisites](#prerequisites)
  - [Environment Setup](#environment-setup)
  - [Local Installation & Run](#local-installation--run)
  - [Running with Docker Compose](#running-with-docker-compose)
- [API Endpoints & Documentation](#-api-endpoints--documentation)
- [Automated Testing](#-automated-testing)
- [Postman Collection](#-postman-collection)
- [Assumptions & Design Choices](#-assumptions--design-choices)

---

## 🎯 Objective & Features

The system implements a double-entry capable transaction ledger with high data integrity, strict immutability, and zero tolerance for inconsistent account balances:

1. **Account Management**:
   - Create accounts with unique system-generated UUIDs and server timestamps.
   - Initial balance is strictly initialized to `0.00`.
   - Rejects any client attempt to set initial balance.
   - Fetch real-time account balances and account metadata.

2. **Atomic Transactions**:
   - **Credit**: Atomically credits funds and records an immutable ledger entry.
   - **Debit**: Validates sufficient balance, decreases balance atomically, or rejects overdrafts without altering the balance.
   - **Idempotency & Duplicate Handling**: Compound unique database constraint on `(account_id, reference_id)`. Re-submitting the same reference_id returns `409 Conflict` and prevents duplicate debits/credits. The same reference_id is permissible across *different* accounts.
   - **Dual-Mode Atomicity**: Leverages MongoDB Replica Set ACID multi-document transactions (`session.withTransaction`) when available, and atomic conditional operations with compensating rollbacks on standalone instances.

3. **Transaction History**:
   - Paginated transaction records (`page`, `limit`) with comprehensive pagination metadata (`current_page`, `page_size`, `total_records`, `total_pages`).
   - Filtering by type (`credit`, `debit`, or all if omitted).
   - Strict latest-first sorting based on `created_at` timestamp.

4. **Transaction Immutability**:
   - Ledger entries cannot be updated (`PUT`/`PATCH`) or deleted (`DELETE`).
   - Calling update or delete endpoints returns explicit `400` errors (`TRANSACTION_IMMUTABLE`).

5. **🌟 Bonus: Atomic Money Transfer**:
   - Atomically transfers money from Account A to Account B.
   - Creates paired debit and credit ledger transactions with cross-referenced transfer IDs.
   - Strict all-or-nothing rollback if any step fails.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (v18+)
- **Language**: TypeScript (Strict Mode)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Zod (type-safe runtime validation)
- **Security & Utilities**: Helmet, CORS, Morgan, dotenv, UUID v4
- **Documentation**: Swagger UI & OpenAPI 3.0
- **Testing**: Built-in test runner with Supertest / Integration tests
- **Containerization**: Docker & Docker Compose

---

## 🏗️ Project Architecture

```
├── src/
│   ├── config/             # Database connection & env variable validation
│   ├── constants/          # HTTP status codes & standard error codes
│   ├── controllers/        # Express route request handlers
│   ├── docs/               # OpenAPI 3.0 specification & Swagger UI
│   ├── errors/             # Custom error hierarchy & centralized error handler
│   ├── middlewares/        # Zod validation middleware
│   ├── models/             # Mongoose schemas with compound indexes & constraints
│   ├── routes/             # RESTful API route definitions
│   ├── schemas/            # Zod validation schemas
│   ├── services/           # Business logic & atomic ledger operations
│   ├── app.ts              # Express application factory
│   └── index.ts            # Server entrypoint with graceful shutdown
├── docs/
│   ├── API_DOCUMENTATION.md # Complete Markdown API reference
│   └── ASSUMPTIONS.md       # Documented assumptions & architectural decisions
├── tests/                  # End-to-end and integration test suites
├── postman_collection.json # Ready-to-import Postman collection
├── Dockerfile              # Multi-stage optimized Docker build
├── docker-compose.yml      # Multi-container setup with MongoDB
└── package.json            # Scripts & dependencies
```

---

## 🔒 Key Business Rules & Integrity Guarantees

| Rule | Implementation & Guarantee |
|---|---|
| **Account Initial Balance** | Enforced as `0.00`. Payload `balance` or `initial_balance` is rejected with `400 Bad Request`. |
| **Balance Non-Negativity** | Debit operations enforce `balance >= amount`. Overdraft attempts return `422 Unprocessable Entity`. |
| **Duplicate Transaction** | Database compound unique index on `{ account_id: 1, reference_id: 1 }`. Returns `409 Conflict`. |
| **Cross-Account References** | Allowed. `{ account_id: 'A', reference_id: 'X' }` and `{ account_id: 'B', reference_id: 'X' }` are both valid. |
| **Atomicity** | MongoDB transactions or atomic conditional updates guarantee balance and ledger persist together or not at all. |
| **Immutability** | No mutation routes. Any attempt to modify or delete a transaction returns `400 TRANSACTION_IMMUTABLE`. |
| **Precision** | All amounts rounded to 2 decimal places to avoid floating-point drift. |

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18.x or later)
- MongoDB (Local instance, Atlas URI, or Docker)
- pnpm or npm

### Environment Setup
Create a `.env` file in the root directory (or copy from `.env.example`):
```bash
cp .env.example .env
```

Default configuration:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/transaction_ledger
CORS_ORIGIN=*
```

### Local Installation & Run

1. **Install dependencies**:
   ```bash
   pnpm install
   # or
   npm install
   ```

2. **Start MongoDB**:
   Ensure MongoDB is running locally on port 27017.

3. **Run in Development Mode**:
   ```bash
   pnpm run dev
   # or
   npm run dev
   ```

4. **Build & Run Production Mode**:
   ```bash
   pnpm run build
   pnpm start
   ```

The server will start at `http://localhost:3000`.
- **Interactive Swagger Documentation**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **Health Check**: [http://localhost:3000/api/v1/health](http://localhost:3000/api/v1/health)

---

### Running with Docker Compose

To start the API and a dedicated MongoDB instance with zero manual setup:

```bash
docker compose up --build
```

To stop:
```bash
docker compose down -v
```

---

## 📚 API Endpoints & Documentation

Interactive documentation is available via **Swagger UI** at `/api-docs`.

For detailed request and response payload examples, refer to [docs/API_DOCUMENTATION.md](file:///c:/Users/Ayush/OneDrive/Desktop/Confluencr%20Project/docs/API_DOCUMENTATION.md).

### Summary Table

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Health check endpoint |
| `POST` | `/api/v1/accounts` | Create account (starts with 0 balance) |
| `GET` | `/api/v1/accounts/:id` | Get account details |
| `GET` | `/api/v1/accounts/:id/balance` | Get current account balance |
| `POST` | `/api/v1/accounts/:id/transactions` | Add credit or debit transaction |
| `GET` | `/api/v1/accounts/:id/transactions` | Query history (filtered, paginated, latest-first) |
| `POST` | `/api/v1/transfers` | **Bonus**: Transfer money between two accounts |

---

## 🧪 Automated Testing

Run the automated test suite covering all functional requirements, edge cases, overdraft prevention, duplicate detection, pagination, sorting, and atomicity:

```bash
pnpm test
# or
npm test
```

---

## 📬 Postman Collection

A complete Postman collection is included in the root directory: [`postman_collection.json`](file:///c:/Users/Ayush/OneDrive/Desktop/Confluencr%20Project/postman_collection.json).
Import it into Postman or Insomnia to execute the pre-configured workflow from account creation to transfers.
