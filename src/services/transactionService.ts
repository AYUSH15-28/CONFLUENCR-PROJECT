import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { AccountModel } from '../models/Account';
import { TransactionModel, ITransaction, TransactionType } from '../models/Transaction';
import { NotFoundError, ConflictError, InsufficientBalanceError, AppError } from '../errors/AppError';
import { isReplicaSet } from '../config/database';
import { CreateTransactionInput, GetTransactionsQuery } from '../schemas/transactionSchema';

export interface PaginatedTransactionsResult {
  current_page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
  data: ITransaction[];
}

export class TransactionService {
  /**
   * Add a transaction to an account atomically.
   * Handles Credit and Debit rules, duplicate reference_id checks, and balance consistency.
   */
  async addTransaction(
    accountId: string,
    input: CreateTransactionInput
  ): Promise<ITransaction> {
    const { type, amount, description, reference_id } = input;
    const roundedAmount = Math.round(amount * 100) / 100;

    // Fast check: verify account exists before doing work
    const accountExists = await AccountModel.exists({ id: accountId });
    if (!accountExists) {
      throw new NotFoundError(`Account with ID '${accountId}' was not found.`);
    }

    // Fast check: duplicate transaction within same account
    const existingTx = await TransactionModel.findOne({
      account_id: accountId,
      reference_id,
    }).lean();

    if (existingTx) {
      throw new ConflictError(
        `Transaction with reference_id '${reference_id}' already exists for account '${accountId}'.`
      );
    }

    // Execute with ACID multi-document transaction if MongoDB replica set is available
    if (isReplicaSet()) {
      return this.executeInReplicaSetTransaction(accountId, {
        type,
        amount: roundedAmount,
        description,
        reference_id,
      });
    }

    // Standalone MongoDB mode: atomic findOneAndUpdate with compensating rollback on failure
    return this.executeInStandaloneMode(accountId, {
      type,
      amount: roundedAmount,
      description,
      reference_id,
    });
  }

  /**
   * ACID transaction execution for MongoDB Replica Sets / Atlas
   */
  private async executeInReplicaSetTransaction(
    accountId: string,
    data: { type: TransactionType; amount: number; description: string; reference_id: string }
  ): Promise<ITransaction> {
    const session = await mongoose.startSession();
    try {
      let createdTransaction: ITransaction | null = null;

      await session.withTransaction(async () => {
        // 1. Fetch account with lock in session
        const account = await AccountModel.findOne({ id: accountId }).session(session);
        if (!account) {
          throw new NotFoundError(`Account with ID '${accountId}' was not found.`);
        }

        // 2. Validate balance for debit
        if (data.type === 'debit' && account.balance < data.amount) {
          throw new InsufficientBalanceError(
            `Insufficient balance. Current balance is ${account.balance.toFixed(2)}, attempted debit is ${data.amount.toFixed(2)}.`
          );
        }

        // 3. Update account balance
        const balanceDelta = data.type === 'credit' ? data.amount : -data.amount;
        account.balance = Math.round((account.balance + balanceDelta) * 100) / 100;
        await account.save({ session });

        // 4. Create transaction
        const [tx] = await TransactionModel.create(
          [
            {
              id: uuidv4(),
              account_id: accountId,
              type: data.type,
              amount: data.amount,
              description: data.description,
              reference_id: data.reference_id,
              created_at: new Date(),
            },
          ],
          { session }
        );

        createdTransaction = tx;
      });

      if (!createdTransaction) {
        throw new AppError('Transaction could not be completed', 500);
      }

      return createdTransaction;
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictError(
          `Transaction with reference_id '${data.reference_id}' already exists for account '${accountId}'.`
        );
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Atomicity execution for Standalone MongoDB
   * Uses conditional atomic update with compensation rollback
   */
  private async executeInStandaloneMode(
    accountId: string,
    data: { type: TransactionType; amount: number; description: string; reference_id: string }
  ): Promise<ITransaction> {
    // 1. Update balance atomically using conditional query
    let updatedAccount;
    if (data.type === 'debit') {
      updatedAccount = await AccountModel.findOneAndUpdate(
        { id: accountId, balance: { $gte: data.amount } },
        { $inc: { balance: -data.amount } },
        { new: true }
      );

      if (!updatedAccount) {
        // Check whether account exists or balance is insufficient
        const account = await AccountModel.findOne({ id: accountId });
        if (!account) {
          throw new NotFoundError(`Account with ID '${accountId}' was not found.`);
        }
        throw new InsufficientBalanceError(
          `Insufficient balance. Current balance is ${account.balance.toFixed(2)}, attempted debit is ${data.amount.toFixed(2)}.`
        );
      }
    } else {
      updatedAccount = await AccountModel.findOneAndUpdate(
        { id: accountId },
        { $inc: { balance: data.amount } },
        { new: true }
      );

      if (!updatedAccount) {
        throw new NotFoundError(`Account with ID '${accountId}' was not found.`);
      }
    }

    // 2. Persist transaction record
    try {
      const transaction = new TransactionModel({
        id: uuidv4(),
        account_id: accountId,
        type: data.type,
        amount: data.amount,
        description: data.description,
        reference_id: data.reference_id,
        created_at: new Date(),
      });

      await transaction.save();
      return transaction;
    } catch (saveError: unknown) {
      // 3. Compensating rollback to maintain strict balance consistency
      const revertDelta = data.type === 'credit' ? -data.amount : data.amount;
      await AccountModel.updateOne({ id: accountId }, { $inc: { balance: revertDelta } });

      if ((saveError as { code?: number }).code === 11000) {
        throw new ConflictError(
          `Transaction with reference_id '${data.reference_id}' already exists for account '${accountId}'.`
        );
      }

      throw saveError;
    }
  }

  /**
   * Retrieve transaction history for an account with filtering, pagination, and sorting.
   */
  async getTransactionHistory(
    accountId: string,
    query: GetTransactionsQuery
  ): Promise<PaginatedTransactionsResult> {
    // 1. Verify account exists
    const accountExists = await AccountModel.exists({ id: accountId });
    if (!accountExists) {
      throw new NotFoundError(`Account with ID '${accountId}' was not found.`);
    }

    const { type, page, limit } = query;
    const filter: Record<string, unknown> = { account_id: accountId };

    if (type) {
      filter.type = type;
    }

    const skip = (page - 1) * limit;

    // 2. Execute count and find queries with latest-first sorting
    const [total_records, transactions] = await Promise.all([
      TransactionModel.countDocuments(filter),
      TransactionModel.find(filter)
        .sort({ created_at: -1 }) // Latest-first order
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const total_pages = Math.ceil(total_records / limit) || 1;

    return {
      current_page: page,
      page_size: limit,
      total_records,
      total_pages,
      data: transactions as unknown as ITransaction[],
    };
  }
}

export const transactionService = new TransactionService();

