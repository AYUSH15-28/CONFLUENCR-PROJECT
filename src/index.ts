import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';

const startServer = async () => {
  try {
    await connectDatabase(env.MONGODB_URI);

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 Transaction Ledger API running on http://localhost:${env.PORT}`);
      console.log(`📖 Swagger Documentation available at http://localhost:${env.PORT}/api-docs`);
      console.log(`🩺 Health Check endpoint at http://localhost:${env.PORT}/api/v1/health`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await disconnectDatabase();
        console.log('Server process terminated.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Fatal error during startup:', error);
    process.exit(1);
  }
};

startServer();

