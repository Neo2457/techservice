// src/controllers/permisosController.ts
// Endpoints para el catálogo de permisos del sistema.

import { Request, Response } from 'express';
import { getDB, all } from '../config/db';

interface ModuloFila {
  key: string;
  nombre: string;
  descripcion: string | null;
  grupo: string;
  acciones: string;
  scope_aplica: number;
  orden: number;
  sistema: number;
}

/**
 * GET /api/permisos/catalogo
 * Devuelve el catálogo completo de módulos permisables, agrupados por grupo.
 * Útil para que el frontend renderice la UI de gestión de permisos.
 */
export const getCatalogoPermisos = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const filas = all<ModuloFila>(
    db,
    'SELECT key, nombre, descripcion, grupo, acciones, scope_aplica, orden, sistema FROM permisos_modulos ORDER BY grupo, orden, nombre',
  );
  // Agrupar para facilitar el render del frontend
  const grupos: Record<string, ModuloFila[]> = {};
  for (const f of filas) {
    if (!grupos[f.grupo]) grupos[f.grupo] = [];
    grupos[f.grupo].push({
      ...f,
      // Normalizar acciones a array
      acciones: f.acciones,
    });
  }
  res.json({
    grupos,
    flat: filas,
    total: filas.length,
  });
};
