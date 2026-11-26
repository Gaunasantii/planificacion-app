import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export interface JwtPayloadData {
  userId: string;
  email?: string;
}

export const getJwtSecret = (): string => {
  return process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production';
};

export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError(401, 'Token de autenticación no proporcionado'));
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    next(new AppError(401, 'Token de autenticación vacío'));
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayloadData;
    if (!decoded || !decoded.userId) {
      next(new AppError(401, 'Token de autenticación inválido'));
      return;
    }
    req.userId = decoded.userId;
    next();
  } catch {
    next(new AppError(401, 'Token de autenticación inválido o expirado'));
  }
};
