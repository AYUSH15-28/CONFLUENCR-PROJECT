import { Router } from 'express';
import { accountController } from '../controllers/accountController';
import { transactionController } from '../controllers/transactionController';
import { validateRequest } from '../middlewares/validateRequest';
import { createAccountSchema, accountIdParamSchema } from '../schemas/accountSchema';
import { createTransactionSchema, getTransactionsQuerySchema } from '../schemas/transactionSchema';
import { HttpStatus } from '../constants/httpStatus';

const router = Router();

// Account endpoints
router.post(
  '/',
  validateRequest(createAccountSchema),
  accountController.createAccount.bind(accountController)
);

router.get(
  '/:id',
  validateRequest(accountIdParamSchema),
  accountController.getAccount.bind(accountController)
);

router.get(
  '/:id/balance',
  validateRequest(accountIdParamSchema),
  accountController.getBalance.bind(accountController)
);

// Transaction endpoints nested under accounts
router.post(
  '/:id/transactions',
  validateRequest(createTransactionSchema),
  transactionController.addTransaction.bind(transactionController)
);

router.get(
  '/:id/transactions',
  validateRequest(getTransactionsQuerySchema),
  transactionController.getTransactionHistory.bind(transactionController)
);

// Enforce transaction immutability: block modification and deletion attempts
router.all('/:id/transactions/:txId', (req, res) => {
  res.status(HttpStatus.BAD_REQUEST).json({
    success: false,
    error: {
      code: 'TRANSACTION_IMMUTABLE',
      message: 'Transactions are immutable once created. Updating or deleting transactions through the API is strictly prohibited.',
    },
  });
});

export const accountRoutes = router;

