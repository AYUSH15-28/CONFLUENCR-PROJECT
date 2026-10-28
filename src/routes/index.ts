import { Router } from 'express';
import { accountRoutes } from './accountRoutes';
import { transferRoutes } from './transferRoutes';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'transaction-ledger-api',
  });
});

// Accounts & Nested Transactions routes
router.use('/accounts', accountRoutes);

// Bonus: Money Transfers routes
router.use('/transfers', transferRoutes);

export const apiRoutes = router;

