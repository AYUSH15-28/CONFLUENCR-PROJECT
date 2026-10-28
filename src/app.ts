import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { apiRoutes } from './routes';
import { errorHandler } from './errors/errorHandler';
import { HttpStatus } from './constants/httpStatus';
import { swaggerDocument } from './docs/swagger';

export const createApp = (): Application => {
  const app = express();

  // Security & Utility Middlewares
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Swagger Interactive Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get('/swagger.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocument);
  });

  // Root redirect to docs
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      message: 'Transaction Ledger API is running.',
      documentation: '/api-docs',
      health: '/api/v1/health',
    });
  });

  // API v1 Routes
  app.use('/api/v1', apiRoutes);

  // 404 Handler for undefined routes
  app.use((req: Request, res: Response) => {
    res.status(HttpStatus.NOT_FOUND).json({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} not found. Refer to /api-docs for documentation.`,
      },
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};

