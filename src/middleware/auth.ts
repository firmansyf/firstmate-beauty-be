// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token tidak ditemukan', code: 'TOKEN_MISSING' });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret'
    ) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return res.status(401).json({
        message: 'Sesi login telah berakhir. Silakan login kembali.',
        code: 'TOKEN_EXPIRED'
      });
    }
    if (error instanceof JsonWebTokenError) {
      return res.status(401).json({
        message: 'Token tidak valid',
        code: 'TOKEN_INVALID'
      });
    }
    return res.status(401).json({ message: 'Token tidak valid', code: 'TOKEN_ERROR' });
  }
};

export const authorizeRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Anda tidak memiliki akses ke resource ini' 
      });
    }

    next();
  };
};