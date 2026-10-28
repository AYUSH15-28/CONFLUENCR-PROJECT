import { Router } from 'express';
import { transferController } from '../controllers/transferController';
import { validateRequest } from '../middlewares/validateRequest';
import { createTransferSchema } from '../schemas/transferSchema';

const router = Router();

// Bonus: Atomic money transfer endpoint
router.post(
  '/',
  validateRequest(createTransferSchema),
  transferController.transferFunds.bind(transferController)
);

export const transferRoutes = router;

