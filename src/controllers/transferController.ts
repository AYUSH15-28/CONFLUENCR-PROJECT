import { Request, Response, NextFunction } from 'express';
import { transferService } from '../services/transferService';
import { HttpStatus } from '../constants/httpStatus';

export class TransferController {
  /**
   * POST /api/v1/transfers
   * Atomically transfer money from one account to another
   */
  async transferFunds(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await transferService.transferFunds(req.body);
      res.status(HttpStatus.CREATED).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const transferController = new TransferController();

