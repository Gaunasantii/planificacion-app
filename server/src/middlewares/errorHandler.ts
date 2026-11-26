import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { UniqueConstraintViolationException } from '@mikro-orm/core';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Error de validación en los datos enviados',
      details: err.errors.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof UniqueConstraintViolationException) {
    res.status(409).json({
      error: 'Conflicto: ya existe un registro con esos datos únicos',
    });
    return;
  }

  console.error('[Unhandled Error]:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
  });
};
