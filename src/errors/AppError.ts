import { HttpStatus, ErrorCodeType } from '../constants/httpStatus';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCodeType | string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = HttpStatus.BAD_REQUEST,
    code: ErrorCodeType | string = 'APPLICATION_ERROR',
    details?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code: ErrorCodeType = 'ACCOUNT_NOT_FOUND', details?: unknown) {
    super(message, HttpStatus.NOT_FOUND, code, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: ErrorCodeType = 'DUPLICATE_TRANSACTION', details?: unknown) {
    super(message, HttpStatus.CONFLICT, code, details);
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(message: string = 'Insufficient account balance for this transaction', details?: unknown) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, 'INSUFFICIENT_BALANCE', details);
  }
}

