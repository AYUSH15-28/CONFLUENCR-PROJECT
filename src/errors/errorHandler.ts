import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from './AppError';
import { HttpStatus, ErrorCode } from '../constants/httpStatus';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Handle AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed for incoming request data',
        details: formattedErrors,
      },
    });
    return;
  }

  // Handle Mongo duplicate key error (code 11000)
  if ((err as { code?: number }).code === 11000) {
    res.status(HttpStatus.CONFLICT).json({
      success: false,
      error: {
        code: ErrorCode.DUPLICATE_TRANSACTION,
        message: 'A duplicate record already exists with the provided key or reference_id.',
      },
    });
    return;
  }

  // Handle JSON syntax error in request body
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Malformed JSON payload in request body',
      },
    });
    return;
  }

  // Fallback generic 500
  console.error('Unhandled Server Error:', err);
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An internal server error occurred. Please try again later.',
    },
  });
};

