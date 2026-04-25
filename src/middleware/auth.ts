// src/middleware/auth.ts
// Middleware de autenticación JWT

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: number;
  correo: string;
  tipo: string;
  localId: number | null;
  empresaId: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      permisoScope?: string; // 'propio' | 'local' | 'empresa'
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' });
    return;
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.tipo !== 'admin' && req.user?.tipo !== 'root') {
    res.status(403).json({ error: 'Solo administradores pueden realizar esta acción' });
    return;
  }
  next();
}

export function rootOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.tipo !== 'root') {
    res.status(403).json({ error: 'Solo el desarrollador (root) puede realizar esta acción' });
    return;
  }
  next();
}
