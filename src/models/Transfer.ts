import { Schema, model, Document } from 'mongoose';

export interface ITransfer extends Document {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  description: string;
  reference_id: string;
  source_transaction_id: string;
  destination_transaction_id: string;
  created_at: Date;
}

const transferSchema = new Schema<ITransfer>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },
    source_account_id: {
      type: String,
      required: true,
      index: true,
      immutable: true,
    },
    destination_account_id: {
      type: String,
      required: true,
      index: true,
      immutable: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Transfer amount must be greater than 0'],
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
      unique: true,
      trim: true,
      immutable: true,
    },
    source_transaction_id: {
      type: String,
      required: true,
      immutable: true,
    },
    destination_transaction_id: {
      type: String,
      required: true,
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

export const TransferModel = model<ITransfer>('Transfer', transferSchema);
