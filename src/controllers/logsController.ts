// src/controllers/logsController.ts

import { Request, Response } from 'express';
import { getDB, get, all } from '../config/db';

// GET /api/logs — paginated audit log (admin/root only)
export const getLogs = async (req: Request, res: Response): Promise<void> => {
  const { desde, hasta, modulo, accion, usuario_id, empresa_id, q, page = '1', limit = '50' } = req.query;
  const db = await getDB();

  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 50, 200);
  const offset = (pageNum - 1) * limitNum;

  let where = 'WHERE 1=1';
  const params: (string | number | null)[] = [];

  // Scope by empresa: root can see all or filter, admin sees own (excluding root actions)
  if (req.user!.tipo === 'admin') {
    where += ' AND empresa_id = ? AND usuario_tipo != ?';
    params.push(req.user!.empresaId, 'root');
  } else if (req.user!.tipo !== 'root') {
    // empleado u otros — no deberían llegar aquí (ruta protegida con adminOnly)
    where += ' AND empresa_id = ? AND usuario_tipo != ?';
    params.push(req.user!.empresaId, 'root');
  } else if (empresa_id) {
    where += ' AND empresa_id = ?';
    params.push(Number(empresa_id));
  }

  if (desde) { where += ' AND fecha >= ?'; params.push(desde as string); }
  if (hasta) { where += ' AND fecha <= ?'; params.push((hasta as string) + ' 23:59:59'); }
  if (modulo) { where += ' AND modulo = ?'; params.push(modulo as string); }
  if (accion) { where += ' AND accion = ?'; params.push(accion as string); }
  if (usuario_id) { where += ' AND usuario_id = ?'; params.push(Number(usuario_id)); }
  if (q) {
    where += ' AND (usuario_nombre LIKE ? OR descripcion LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like);
  }

  const total = (get<{ total: number }>(db, `SELECT COUNT(*) as total FROM logs ${where}`, params) as { total: number })?.total ?? 0;
  const data = all(db, `SELECT * FROM logs ${where} ORDER BY fecha DESC LIMIT ? OFFSET ?`, [...params, limitNum, offset]);

  res.json({ data, total, page: pageNum });
};
