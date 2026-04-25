// src/middleware/permisos.ts
// Middleware de verificación de permisos granulares

import { Request, Response, NextFunction } from 'express';
import { getDB, get } from '../config/db';

type Accion = 'ver' | 'crear' | 'editar' | 'borrar';

interface PermisoRow {
  ver: number;
  crear: number;
  editar: number;
  borrar: number;
  scope: string;
}

export function checkPermiso(modulo: string, accion: Accion) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tipo = req.user?.tipo;

    // Root y admin tienen todos los permisos implícitamente
    if (tipo === 'root' || tipo === 'admin') {
      req.permisoScope = 'empresa';
      next();
      return;
    }

    const db = await getDB();
    const permiso = get<PermisoRow>(
      db,
      'SELECT ver, crear, editar, borrar, scope FROM permisos WHERE usuario_id = ? AND modulo = ?',
      [req.user!.userId, modulo]
    );

    if (!permiso || !permiso[accion]) {
      res.status(403).json({ error: `No tienes permiso para ${accion} en ${modulo}` });
      return;
    }

    req.permisoScope = permiso.scope || 'empresa';
    next();
  };
}
