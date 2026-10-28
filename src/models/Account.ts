import { Schema, model, Document } from 'mongoose';

export interface IAccount extends Document {
  id: string;
  name: string;
  balance: number;
  created_at: Date;
}

const accountSchema = new Schema<IAccount>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Account holder name is required'],
      trim: true,
      minlength: [1, 'Account name cannot be empty'],
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Account balance cannot be negative'],
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

export const AccountModel = model<IAccount>('Account', accountSchema);
