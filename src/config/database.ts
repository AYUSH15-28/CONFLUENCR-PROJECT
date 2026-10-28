import mongoose from 'mongoose';
import { env } from './env';

let isReplicaSetActive = false;

export const connectDatabase = async (uri: string = env.MONGODB_URI): Promise<typeof mongoose> => {
  try {
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB connected successfully to: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

    // Detect if connected cluster supports replica set transactions
    try {
      const adminDb = conn.connection.db?.admin();
      if (adminDb) {
        const serverStatus = await adminDb.command({ serverStatus: 1 });
        isReplicaSetActive = Boolean(serverStatus.repl && serverStatus.repl.setName);
      }
    } catch {
      // In constrained environments or non-admin privileges, assume standalone
      isReplicaSetActive = false;
    }

    console.log(`ℹ️ MongoDB Transaction Support (Replica Set): ${isReplicaSetActive ? 'Enabled' : 'Standalone Mode'}`);

    return conn;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected successfully');
  } catch (error) {
    console.error('Error disconnecting MongoDB:', error);
  }
};

export const isReplicaSet = (): boolean => isReplicaSetActive;

export const setReplicaSet = (value: boolean): void => {
  isReplicaSetActive = value;
};

