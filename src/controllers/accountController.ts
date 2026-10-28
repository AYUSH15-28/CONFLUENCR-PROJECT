import { Request, Response, NextFunction } from 'express';
import { accountService } from '../services/accountService';
import { HttpStatus } from '../constants/httpStatus';

export class AccountController {
  /**
   * POST /api/v1/accounts
   * Create a new account with zero initial balance
   */
  async createAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const account = await accountService.createAccount(req.body);
      res.status(HttpStatus.CREATED).json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/accounts/:id/balance
   * Retrieve current balance of an account
   */
  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const balanceData = await accountService.getAccountBalance(id);
      res.status(HttpStatus.OK).json({
        success: true,
        data: balanceData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/accounts/:id
   * Retrieve full account info
   */
  async getAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const account = await accountService.getAccountById(id);
      res.status(HttpStatus.OK).json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const accountController = new AccountController();
