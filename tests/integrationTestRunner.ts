import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { AccountModel } from '../src/models/Account';
import { TransactionModel } from '../src/models/Transaction';
import { TransferModel } from '../src/models/Transfer';

let mongodProc: ChildProcess | null = null;
let server: http.Server | null = null;
let baseUrl = '';

// Helper to wait until a port is accepting connections
const waitForPort = async (port: number, maxRetries = 30): Promise<void> => {
  const net = await import('net');
  for (let i = 0; i < maxRetries; i++) {
    const success = await new Promise<boolean>((resolve) => {
      const sock = net.createConnection({ port, host: '127.0.0.1' }, () => {
        sock.end();
        resolve(true);
      });
      sock.on('error', () => {
        sock.destroy();
        resolve(false);
      });
    });
    if (success) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for port ${port}`);
};

const apiRequest = async (path: string, options: RequestInit = {}) => {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
};

const runAllTests = async () => {
  console.log('====================================================');
  console.log('🚀 STARTING TRANSACTION LEDGER API INTEGRATION TESTS');
  console.log('====================================================\n');

  const mongodPath = 'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe';
  const mongoPort = 27017;
  const dbPath = './data/db';

  console.log('⏳ Starting embedded MongoDB Server 8.2...');
  mongodProc = spawn(mongodPath, ['--dbpath', dbPath, '--port', String(mongoPort)], {
    stdio: 'ignore',
  });

  await waitForPort(mongoPort);
  console.log('✅ MongoDB daemon is ready.');

  // Connect Mongoose
  await connectDatabase(`mongodb://127.0.0.1:${mongoPort}/transaction_ledger_test`);

  // Start Express API server on ephemeral port
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server?.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
      }
      resolve();
    });
  });
  console.log(`✅ Test API Server listening at ${baseUrl}\n`);

  let passed = 0;
  let failed = 0;

  const test = async (name: string, fn: () => Promise<void>) => {
    // Clear database before each test
    await Promise.all([
      AccountModel.deleteMany({}),
      TransactionModel.deleteMany({}),
      TransferModel.deleteMany({}),
    ]);

    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: unknown) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  };

  // 1. Account Creation Tests
  await test('POST /accounts - creates account with 0 initial balance and unique UUID', async () => {
    const res = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice Smith' }),
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.name, 'Alice Smith');
    assert.equal(res.data.data.balance, 0);
    assert.ok(typeof res.data.data.id === 'string' && res.data.data.id.length > 10);
    assert.ok(res.data.data.created_at);
  });

  await test('POST /accounts - rejects request when name is missing or empty', async () => {
    const res1 = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.equal(res1.status, 400);
    assert.equal(res1.data.success, false);

    const res2 = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: '   ' }),
    });
    assert.equal(res2.status, 400);
    assert.equal(res2.data.success, false);
  });

  await test('POST /accounts - rejects request if client attempts to set initial balance', async () => {
    const res = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice Smith', balance: 500 }),
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
  });

  // 2. Account Balance Retrieval Tests
  await test('GET /accounts/:id/balance - returns current account balance', async () => {
    const createRes = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bob Roberts' }),
    });
    const accountId = createRes.data.data.id;

    const balanceRes = await apiRequest(`/accounts/${accountId}/balance`);
    assert.equal(balanceRes.status, 200);
    assert.deepEqual(balanceRes.data.data, {
      account_id: accountId,
      balance: 0,
    });
  });

  await test('GET /accounts/:id/balance - returns 404 for non-existent account', async () => {
    const res = await apiRequest('/accounts/non-existent-account-id/balance');
    assert.equal(res.status, 404);
    assert.equal(res.data.error.code, 'ACCOUNT_NOT_FOUND');
  });

  // 3. Credit Transaction Tests
  await test('POST /accounts/:id/transactions - credit increases account balance', async () => {
    const acc = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Charlie Brown' }),
    });
    const accountId = acc.data.data.id;

    // Credit 100
    const credRes1 = await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'credit',
        amount: 100,
        description: 'First deposit',
        reference_id: 'ref-01',
      }),
    });
    assert.equal(credRes1.status, 201);
    assert.equal(credRes1.data.data.type, 'credit');
    assert.equal(credRes1.data.data.amount, 100);

    // Credit 50 (PDF example: current 100 + credit 50 = new balance 150)
    const credRes2 = await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'credit',
        amount: 50,
        description: 'Second deposit',
        reference_id: 'ref-02',
      }),
    });
    assert.equal(credRes2.status, 201);

    const bal = await apiRequest(`/accounts/${accountId}/balance`);
    assert.equal(bal.data.data.balance, 150);
  });

  // 4. Debit Transaction Tests
  await test('POST /accounts/:id/transactions - debit decreases account balance (100 - 30 = 70)', async () => {
    const acc = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Diana Prince' }),
    });
    const accountId = acc.data.data.id;

    await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'credit',
        amount: 100,
        description: 'Initial deposit',
        reference_id: 'ref-init',
      }),
    });

    // Debit 30 (PDF example: balance 100 - debit 30 = new balance 70)
    const debitRes = await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'debit',
        amount: 30,
        description: 'Purchase',
        reference_id: 'ref-purchase',
      }),
    });
    assert.equal(debitRes.status, 201);
    assert.equal(debitRes.data.data.type, 'debit');
    assert.equal(debitRes.data.data.amount, 30);

    const bal = await apiRequest(`/accounts/${accountId}/balance`);
    assert.equal(bal.data.data.balance, 70);
  });

  await test('POST /accounts/:id/transactions - debit rejected if insufficient balance (100 - 150 rejected, balance remains 100)', async () => {
    const acc = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Evan Wright' }),
    });
    const accountId = acc.data.data.id;

    await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'credit',
        amount: 100,
        description: 'Initial deposit',
        reference_id: 'ref-init-evan',
      }),
    });

    // Debit 150 when balance is 100 (PDF example)
    const debitRes = await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'debit',
        amount: 150,
        description: 'Overdraft attempt',
        reference_id: 'ref-overdraft',
      }),
    });

    assert.equal(debitRes.status, 422);
    assert.equal(debitRes.data.error.code, 'INSUFFICIENT_BALANCE');

    // Balance must strictly remain 100
    const bal = await apiRequest(`/accounts/${accountId}/balance`);
    assert.equal(bal.data.data.balance, 100);
  });

  // 5. Duplicate Transaction Rules
  await test('Duplicate reference_id for same account rejected with 409 Conflict, balance unchanged', async () => {
    const acc = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Frank Castle' }),
    });
    const accountId = acc.data.data.id;

    // First transaction
    const res1 = await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'credit',
        amount: 75,
        description: 'First load',
        reference_id: 'UNIQUE-REF-X',
      }),
    });
    assert.equal(res1.status, 201);

    // Second submission with identical reference_id
    const res2 = await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'credit',
        amount: 75,
        description: 'Duplicate load attempt',
        reference_id: 'UNIQUE-REF-X',
      }),
    });
    assert.equal(res2.status, 409);
    assert.equal(res2.data.error.code, 'DUPLICATE_TRANSACTION');

    // Balance remains 75 (not 150)
    const bal = await apiRequest(`/accounts/${accountId}/balance`);
    assert.equal(bal.data.data.balance, 75);
  });

  await test('Same reference_id CAN be used across DIFFERENT accounts', async () => {
    const acc1 = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'User One' }),
    });
    const acc2 = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'User Two' }),
    });

    const res1 = await apiRequest(`/accounts/${acc1.data.data.id}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'credit',
        amount: 50,
        description: 'Shared ref test',
        reference_id: 'COMMON-GATEWAY-ID-99',
      }),
    });
    assert.equal(res1.status, 201);

    const res2 = await apiRequest(`/accounts/${acc2.data.data.id}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'credit',
        amount: 50,
        description: 'Shared ref test on different account',
        reference_id: 'COMMON-GATEWAY-ID-99',
      }),
    });
    assert.equal(res2.status, 201);
  });

  // 6. Transaction Validations
  await test('Rejects amount <= 0, negative amount, and invalid type', async () => {
    const acc = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Grace Hopper' }),
    });
    const accountId = acc.data.data.id;

    // Zero amount
    const r1 = await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'credit',
        amount: 0,
        description: 'Zero',
        reference_id: 'ref-0',
      }),
    });
    assert.equal(r1.status, 400);

    // Negative amount
    const r2 = await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'credit',
        amount: -25,
        description: 'Negative',
        reference_id: 'ref-neg',
      }),
    });
    assert.equal(r2.status, 400);

    // Invalid type
    const r3 = await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'refund',
        amount: 25,
        description: 'Invalid type',
        reference_id: 'ref-invalid-type',
      }),
    });
    assert.equal(r3.status, 400);
  });

  // 7. Transaction History, Filtering, Pagination, Sorting
  await test('GET /accounts/:id/transactions - returns history sorted latest-first with pagination', async () => {
    const acc = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Hank Pym' }),
    });
    const accountId = acc.data.data.id;

    // Initial sequence: Initial: 0, Credit: 100, Credit: 50, Debit: 30, Debit: 20 (Final: 100) from PDF Page 3
    await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'credit', amount: 100, description: 'Credit 100', reference_id: 'tx-1' }),
    });
    await new Promise((r) => setTimeout(r, 20));
    await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'credit', amount: 50, description: 'Credit 50', reference_id: 'tx-2' }),
    });
    await new Promise((r) => setTimeout(r, 20));
    await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'debit', amount: 30, description: 'Debit 30', reference_id: 'tx-3' }),
    });
    await new Promise((r) => setTimeout(r, 20));
    await apiRequest(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'debit', amount: 20, description: 'Debit 20', reference_id: 'tx-4' }),
    });

    // Check final balance is 100
    const balRes = await apiRequest(`/accounts/${accountId}/balance`);
    assert.equal(balRes.data.data.balance, 100);

    // Retrieve full history
    const hist = await apiRequest(`/accounts/${accountId}/transactions`);
    assert.equal(hist.status, 200);
    assert.equal(hist.data.data.length, 4);
    // Latest first: tx-4 should be index 0, tx-1 should be index 3
    assert.equal(hist.data.data[0].reference_id, 'tx-4');
    assert.equal(hist.data.data[3].reference_id, 'tx-1');

    // Filter by type=credit
    const credOnly = await apiRequest(`/accounts/${accountId}/transactions?type=credit`);
    assert.equal(credOnly.data.data.length, 2);
    assert.ok(credOnly.data.data.every((tx: { type: string }) => tx.type === 'credit'));

    // Filter by type=debit
    const debOnly = await apiRequest(`/accounts/${accountId}/transactions?type=debit`);
    assert.equal(debOnly.data.data.length, 2);
    assert.ok(debOnly.data.data.every((tx: { type: string }) => tx.type === 'debit'));

    // Pagination test (page 1, limit 2)
    const page1 = await apiRequest(`/accounts/${accountId}/transactions?page=1&limit=2`);
    assert.equal(page1.data.data.length, 2);
    assert.deepEqual(page1.data.pagination, {
      current_page: 1,
      page_size: 2,
      total_records: 4,
      total_pages: 2,
    });
  });

  // 8. Transaction Immutability Test
  await test('Transactions are immutable - reject PUT and DELETE requests', async () => {
    const acc = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ian Malcolm' }),
    });
    const accountId = acc.data.data.id;

    const putRes = await apiRequest(`/accounts/${accountId}/transactions/some-tx-id`, {
      method: 'PUT',
      body: JSON.stringify({ amount: 9999 }),
    });
    assert.equal(putRes.status, 400);
    assert.equal(putRes.data.error.code, 'TRANSACTION_IMMUTABLE');

    const delRes = await apiRequest(`/accounts/${accountId}/transactions/some-tx-id`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 400);
    assert.equal(delRes.data.error.code, 'TRANSACTION_IMMUTABLE');
  });

  // 9. Bonus Feature: Money Transfer Tests
  await test('POST /transfers - transfers money atomically from Account A to B (A: 100->70, B: 50->80)', async () => {
    // Setup Account A (100) and Account B (50) from PDF Page 4
    const accA = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Account A' }),
    });
    const idA = accA.data.data.id;
    await apiRequest(`/accounts/${idA}/transactions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'credit', amount: 100, description: 'Initial 100', reference_id: 'ref-a' }),
    });

    const accB = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Account B' }),
    });
    const idB = accB.data.data.id;
    await apiRequest(`/accounts/${idB}/transactions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'credit', amount: 50, description: 'Initial 50', reference_id: 'ref-b' }),
    });

    // Transfer: 30 from A to B
    const trfRes = await apiRequest('/transfers', {
      method: 'POST',
      body: JSON.stringify({
        source_account_id: idA,
        destination_account_id: idB,
        amount: 30,
        reference_id: 'TRF-TRANSFER-001',
        description: 'Transfer 30 from A to B',
      }),
    });

    assert.equal(trfRes.status, 201);
    assert.equal(trfRes.data.success, true);
    assert.equal(trfRes.data.data.source_account.new_balance, 70);
    assert.equal(trfRes.data.data.destination_account.new_balance, 80);

    // Verify balances via GET
    const balA = await apiRequest(`/accounts/${idA}/balance`);
    assert.equal(balA.data.data.balance, 70);

    const balB = await apiRequest(`/accounts/${idB}/balance`);
    assert.equal(balB.data.data.balance, 80);
  });

  await test('POST /transfers - rejects transfer when source has insufficient funds, balances unchanged', async () => {
    const accA = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Account A' }),
    });
    const idA = accA.data.data.id;
    await apiRequest(`/accounts/${idA}/transactions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'credit', amount: 50, description: 'Initial 50', reference_id: 'ref-a2' }),
    });

    const accB = await apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Account B' }),
    });
    const idB = accB.data.data.id;

    // Attempt transfer 200 (source only has 50)
    const trfRes = await apiRequest('/transfers', {
      method: 'POST',
      body: JSON.stringify({
        source_account_id: idA,
        destination_account_id: idB,
        amount: 200,
        reference_id: 'TRF-FAIL-001',
      }),
    });

    assert.equal(trfRes.status, 422);
    assert.equal(trfRes.data.error.code, 'INSUFFICIENT_BALANCE');

    // Balance A remains 50
    const balA = await apiRequest(`/accounts/${idA}/balance`);
    assert.equal(balA.data.data.balance, 50);

    // Balance B remains 0
    const balB = await apiRequest(`/accounts/${idB}/balance`);
    assert.equal(balB.data.data.balance, 0);
  });

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  // Tear down
  await disconnectDatabase();
  if (server) server.close();
  if (mongodProc) {
    mongodProc.kill('SIGINT');
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runAllTests().catch(async (err) => {
  console.error('Fatal Test Runner Error:', err);
  if (mongodProc) mongodProc.kill();
  if (server) server.close();
  await disconnectDatabase();
  process.exit(1);
});
