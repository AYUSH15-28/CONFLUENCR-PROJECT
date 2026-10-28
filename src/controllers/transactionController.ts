import { Request, Response, NextFunction } from 'express';
import { transactionService } from '../services/transactionService';
import { HttpStatus } from '../constants/httpStatus';
import { GetTransactionsQuery } from '../schemas/transactionSchema';

export class TransactionController {
  /**
   * POST /api/v1/accounts/:id/transactions
   * Add a credit or debit transaction to an account
   */
  async addTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const transaction = await transactionService.addTransaction(id, req.body);
      res.status(HttpStatus.CREATED).json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/accounts/:id/transactions
   * Fetch transaction history for an account with filtering, pagination, and latest-first sorting
   */
  async getTransactionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const query = req.query as unknown as GetTransactionsQuery;
      const result = await transactionService.getTransactionHistory(id, query);
      res.status(HttpStatus.OK).json({
        success: true,
        data: result.data,
        pagination: {
          current_page: result.current_page,
          page_size: result.page_size,
          total_records: result.total_records,
          total_pages: result.total_pages,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const transactionController = new TransactionController();
