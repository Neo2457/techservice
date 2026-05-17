// src/controllers/searchController.ts
//
// GET /api/search?q=<query>
// Búsqueda global multi-entidad. Devuelve hasta `LIMIT_PER_CAT` resultados
// por categoría (servicios, productos, personas).
//
// Respeta:
//   • Scope del usuario: mismo patrón que las tablas (empresa + local).
//   • Permisos: omite categorías para las que el usuario no tiene 'ver'.
//
// El scoring fuzzy y reordenamiento final lo hace el frontend.

import { Request, Response } from 'express';
import { getDB, get, all } from '../config/db';

const LIMIT_PER_CAT = 20;

interface PermisoFila { ver: number; }

function hasPerm(db: any, userId: number, modulo: string): boolean {
  const r = get<PermisoFila>(db,
    'SELECT ver FROM permisos WHERE usuario_id = ? AND modulo = ?',
    [userId, modulo]);
  return !!(r && r.ver);
}

/** Construye el WHERE clause + params para empresa/local del usuario. */
function buildScopeWhere(req: Request, alias: string): { where: string; params: (string | number)[] } {
  const params: (string | number)[] = [];
  if (req.user!.tipo === 'root') return { where: '', params };
  let where = ` AND ${alias}.empresa_id = ?`;
  params.push(req.user!.empresaId);
  if (req.user!.localId) {
    where += ` AND ${alias}.local_id = ?`;
    params.push(req.user!.localId);
  }
  return { where, params };
}

export const globalSearch = async (req: Request, res: Response): Promise<void> => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    res.json({ servicios: [], productos: [], personas: [], q });
    return;
  }
  const like = `%${q}%`;
  const db = await getDB();
  const tipo = req.user!.tipo;
  const isAdmin = tipo === 'root' || tipo === 'admin';

  const result: { servicios: any[]; productos: any[]; personas: any[]; q: string } = {
    servicios: [], productos: [], personas: [], q,
  };

  // ── Servicios ────────────────────────────────────────────
  if (isAdmin || hasPerm(db, req.user!.userId, 'servicios')) {
    const scope = buildScopeWhere(req, 's');
    const sql = `
      SELECT s.id, s.folio, s.modelo, s.falla, s.estado, s.fecha_entrada,
             c.nombre as cliente_nombre, c.telefono as cliente_telefono
      FROM servicios s
      LEFT JOIN personas c ON s.cliente_id = c.id
      WHERE 1=1 ${scope.where}
        AND (s.folio LIKE ? OR s.modelo LIKE ? OR s.falla LIKE ?
             OR c.nombre LIKE ? OR c.telefono LIKE ?)
      ORDER BY s.id DESC
      LIMIT ?`;
    const params = [...scope.params, like, like, like, like, like, LIMIT_PER_CAT];
    try { result.servicios = all(db, sql, params); } catch (e) { /* ignore */ }
  }

  // ── Productos ────────────────────────────────────────────
  if (isAdmin || hasPerm(db, req.user!.userId, 'productos')) {
    const scope = buildScopeWhere(req, 'p');
    const sql = `
      SELECT p.id, p.folio, p.codigo, p.sku, p.nombre, p.venta, p.existencia
      FROM productos p
      WHERE 1=1 ${scope.where}
        AND (p.nombre LIKE ? OR p.codigo LIKE ? OR p.sku LIKE ? OR p.folio LIKE ?)
      ORDER BY p.id DESC
      LIMIT ?`;
    const params = [...scope.params, like, like, like, like, LIMIT_PER_CAT];
    try { result.productos = all(db, sql, params); } catch (e) { /* ignore */ }
  }

  // ── Personas (clientes + usuarios) ───────────────────────
  if (isAdmin || hasPerm(db, req.user!.userId, 'personas') || hasPerm(db, req.user!.userId, 'clientes')) {
    // Personas no tiene scope por local_id estrictamente (las personas son globales por empresa)
    let where = '';
    const params: (string | number)[] = [];
    if (tipo !== 'root') {
      where = ' AND p.empresa_id = ?';
      params.push(req.user!.empresaId);
    }
    const sql = `
      SELECT p.id, p.nombre, p.correo, p.telefono, p.tipo, p.roles, p.activo,
             l.nombre_local
      FROM personas p
      LEFT JOIN locales l ON p.local_id = l.id
      WHERE 1=1 ${where}
        AND (p.nombre LIKE ? OR p.correo LIKE ? OR p.telefono LIKE ?)
      ORDER BY p.id DESC
      LIMIT ?`;
    params.push(like, like, like, LIMIT_PER_CAT);
    try { result.personas = all(db, sql, params); } catch (e) { /* ignore */ }
  }

  res.json(result);
};
