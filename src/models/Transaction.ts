import { Schema, model, Document } from 'mongoose';

export type TransactionType = 'credit' | 'debit';

export interface ITransaction extends Document {
  id: string;
  account_id: string;
  type: TransactionType;
  amount: number;
  description: string;
  reference_id: string;
  created_at: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },
    account_id: {
      type: String,
      required: true,
      index: true,
      immutable: true,
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: ['credit', 'debit'],
        message: "Transaction type must be either 'credit' or 'debit'",
      },
      immutable: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Amount must be greater than 0'],
      immutable: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    reference_id: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as Record<string, unknown>)._id;
        return ret;
      },
    },
  }
);

// Database constraints:
// 1. Compound unique index: reference_id must be unique per account
transactionSchema.index({ account_id: 1, reference_id: 1 }, { unique: true });

// 2. Sorting & pagination index: latest-first order by created_at
transactionSchema.index({ account_id: 1, created_at: -1 });

// 3. Filtered sorting index: account_id + type + created_at
transactionSchema.index({ account_id: 1, type: 1, created_at: -1 });

export const TransactionModel = model<ITransaction>('Transaction', transactionSchema);
