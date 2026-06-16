import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 20) {
    throw new Error('JWT_SECRET precisa ter pelo menos 20 caracteres.');
  }
  return secret;
};

export const createToken = (email: string) => jwt.sign({ email }, getJwtSecret(), { expiresIn: '7d' });

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.finance_token;
  if (!token) return res.status(401).json({ message: 'Não autenticado.' });

  try {
    jwt.verify(token, getJwtSecret());
    next();
  } catch {
    res.status(401).json({ message: 'Sessão expirada.' });
  }
};
