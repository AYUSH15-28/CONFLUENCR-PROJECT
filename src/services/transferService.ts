import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { AccountModel } from '../models/Account';
import { TransactionModel } from '../models/Transaction';
import { TransferModel, ITransfer } from '../models/Transfer';
import { NotFoundError, InsufficientBalanceError, ConflictError, AppError } from '../errors/AppError';
import { isReplicaSet } from '../config/database';
import { CreateTransferInput } from '../schemas/transferSchema';

export interface TransferResult {
  transfer: ITransfer;
  source_account: {
    id: string;
    previous_balance: number;
    new_balance: number;
  };
  destination_account: {
    id: string;
    previous_balance: number;
    new_balance: number;
  };
}

export class TransferService {
  /**
   * Transfer funds atomically between two accounts.
   */
  async transferFunds(input: CreateTransferInput): Promise<TransferResult> {
    const { source_account_id, destination_account_id, amount, reference_id, description } = input;
    const roundedAmount = Math.round(amount * 100) / 100;
    const transferDescription = description || `Transfer of ${roundedAmount.toFixed(2)} from ${source_account_id} to ${destination_account_id}`;

    // 1. Verify transfer reference_id uniqueness
    const existingTransfer = await TransferModel.findOne({ reference_id }).lean();
    if (existingTransfer) {
      throw new ConflictError(`Transfer with reference_id '${reference_id}' already exists.`);
    }

    // 2. Verify both accounts exist
    const [sourceAccount, destAccount] = await Promise.all([
      AccountModel.findOne({ id: source_account_id }),
      AccountModel.findOne({ id: destination_account_id }),
    ]);

    if (!sourceAccount) {
      throw new NotFoundError(`Source account with ID '${source_account_id}' was not found.`);
    }
    if (!destAccount) {
      throw new NotFoundError(`Destination account with ID '${destination_account_id}' was not found.`);
    }

    // 3. Verify source has sufficient balance
    if (sourceAccount.balance < roundedAmount) {
      throw new InsufficientBalanceError(
        `Insufficient balance in source account. Available: ${sourceAccount.balance.toFixed(2)}, Required: ${roundedAmount.toFixed(2)}.`
      );
    }

    if (isReplicaSet()) {
      return this.executeInReplicaSet(
        source_account_id,
        destination_account_id,
        roundedAmount,
        reference_id,
        transferDescription
      );
    }

    return this.executeInStandalone(
      source_account_id,
      destination_account_id,
      roundedAmount,
      reference_id,
      transferDescription
    );
  }

  private async executeInReplicaSet(
    sourceId: string,
    destId: string,
    amount: number,
    referenceId: string,
    description: string
  ): Promise<TransferResult> {
    const session = await mongoose.startSession();
    try {
      let result: TransferResult | null = null;

      await session.withTransaction(async () => {
        const source = await AccountModel.findOne({ id: sourceId }).session(session);
        const dest = await AccountModel.findOne({ id: destId }).session(session);

        if (!source || !dest) {
          throw new NotFoundError('One or both accounts were not found during the transfer.');
        }

        if (source.balance < amount) {
          throw new InsufficientBalanceError('Insufficient balance in source account.');
        }

        const sourcePrevBalance = source.balance;
        const destPrevBalance = dest.balance;

        source.balance = Math.round((source.balance - amount) * 100) / 100;
        dest.balance = Math.round((dest.balance + amount) * 100) / 100;

        await source.save({ session });
        await dest.save({ session });

        const transferId = uuidv4();
        const sourceTxId = uuidv4();
        const destTxId = uuidv4();

        // Create debit transaction for source
        const [sourceTx] = await TransactionModel.create(
          [
            {
              id: sourceTxId,
              account_id: sourceId,
              type: 'debit',
              amount,
              description: `Debit: ${description}`,
              reference_id: `transfer_${referenceId}_debit`,
              created_at: new Date(),
            },
          ],
          { session }
        );

        // Create credit transaction for destination
        const [destTx] = await TransactionModel.create(
          [
            {
              id: destTxId,
              account_id: destId,
              type: 'credit',
              amount,
              description: `Credit: ${description}`,
              reference_id: `transfer_${referenceId}_credit`,
              created_at: new Date(),
            },
          ],
          { session }
        );

        // Create transfer record
        const [transferDoc] = await TransferModel.create(
          [
            {
              id: transferId,
              source_account_id: sourceId,
              destination_account_id: destId,
              amount,
              description,
              reference_id: referenceId,
              source_transaction_id: sourceTx.id,
              destination_transaction_id: destTx.id,
              created_at: new Date(),
            },
          ],
          { session }
        );

        result = {
          transfer: transferDoc,
          source_account: {
            id: sourceId,
            previous_balance: sourcePrevBalance,
            new_balance: source.balance,
          },
          destination_account: {
            id: destId,
            previous_balance: destPrevBalance,
            new_balance: dest.balance,
          },
        };
      });

      if (!result) {
        throw new AppError('Transfer failed', 500);
      }

      return result;
    } finally {
      await session.endSession();
    }
  }

  private async executeInStandalone(
    sourceId: string,
    destId: string,
    amount: number,
    referenceId: string,
    description: string
  ): Promise<TransferResult> {
    // 1. Atomic conditional debit from source
    const updatedSource = await AccountModel.findOneAndUpdate(
      { id: sourceId, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true }
    );

    if (!updatedSource) {
      throw new InsufficientBalanceError('Insufficient balance in source account.');
    }

    const sourcePrevBalance = Math.round((updatedSource.balance + amount) * 100) / 100;

    // 2. Atomic credit to destination
    const updatedDest = await AccountModel.findOneAndUpdate(
      { id: destId },
      { $inc: { balance: amount } },
      { new: true }
    );

    if (!updatedDest) {
      // Rollback source account
      await AccountModel.updateOne({ id: sourceId }, { $inc: { balance: amount } });
      throw new NotFoundError(`Destination account with ID '${destId}' was not found.`);
    }

    const destPrevBalance = Math.round((updatedDest.balance - amount) * 100) / 100;

    const transferId = uuidv4();
    const sourceTxId = uuidv4();
    const destTxId = uuidv4();

    try {
      // 3. Create debit ledger transaction
      await TransactionModel.create({
        id: sourceTxId,
        account_id: sourceId,
        type: 'debit',
        amount,
        description: `Debit: ${description}`,
        reference_id: `transfer_${referenceId}_debit`,
        created_at: new Date(),
      });

      // 4. Create credit ledger transaction
      await TransactionModel.create({
        id: destTxId,
        account_id: destId,
        type: 'credit',
        amount,
        description: `Credit: ${description}`,
        reference_id: `transfer_${referenceId}_credit`,
        created_at: new Date(),
      });

      // 5. Create transfer record
      const transferDoc = await TransferModel.create({
        id: transferId,
        source_account_id: sourceId,
        destination_account_id: destId,
        amount,
        description,
        reference_id: referenceId,
        source_transaction_id: sourceTxId,
        destination_transaction_id: destTxId,
        created_at: new Date(),
      });

      return {
        transfer: transferDoc,
        source_account: {
          id: sourceId,
          previous_balance: sourcePrevBalance,
          new_balance: updatedSource.balance,
        },
        destination_account: {
          id: destId,
          previous_balance: destPrevBalance,
          new_balance: updatedDest.balance,
        },
      };
    } catch (err) {
      // Full compensating rollback on failure
      await AccountModel.updateOne({ id: sourceId }, { $inc: { balance: amount } });
      await AccountModel.updateOne({ id: destId }, { $inc: { balance: -amount } });
      await TransactionModel.deleteMany({ id: { $in: [sourceTxId, destTxId] } });
      throw err;
    }
  }
}

export const transferService = new TransferService();

