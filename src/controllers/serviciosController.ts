// src/controllers/serviciosController.ts

import { Request, Response } from 'express';
import { getDB, run, get, all, persistDB } from '../config/db';
import { generarFolio } from '../utils/folio';

export const getServicios = async (req: Request, res: Response): Promise<void> => {
  const { q, estado, garantia, desde, hasta, page = '1', limit = '20' } = req.query;
  const empresaId = req.user!.empresaId;
  const db = await getDB();
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  let sql = `SELECT s.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono
             FROM servicios s LEFT JOIN clientes c ON s.cliente_id = c.id
             WHERE s.empresa_id = ?`;
  const params: (string | number | null)[] = [empresaId];

  if (q) { sql += ` AND (s.folio LIKE ? OR c.nombre LIKE ? OR s.modelo LIKE ? OR s.falla LIKE ?)`; const l = `%${q}%`; params.push(l,l,l,l); }
  if (estado) { sql += ' AND s.estado = ?'; params.push(estado as string); }
  if (garantia) { sql += ' AND s.garantia = ?'; params.push(garantia as string); }
  if (desde) { sql += ' AND s.fecha_entrada >= ?'; params.push(desde as string); }
  if (hasta) { sql += ' AND s.fecha_entrada <= ?'; params.push(hasta as string); }

  const total = (get<{ total: number }>(db, sql.replace('SELECT s.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono', 'SELECT COUNT(*) as total'), params) as { total: number })?.total ?? 0;

  sql += ' ORDER BY s.fecha_creacion DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit as string), offset);

  res.json({ data: all(db, sql, params), total, page: parseInt(page as string) });
};

export const getServicioById = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const s = get(db, `SELECT s.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono,
    c.correo as cliente_correo, c.direccion as cliente_direccion
    FROM servicios s LEFT JOIN clientes c ON s.cliente_id = c.id
    WHERE s.id = ? AND s.empresa_id = ?`, [Number(req.params.id), req.user!.empresaId]);
  if (!s) { res.status(404).json({ error: 'Servicio no encontrado' }); return; }
  res.json(s);
};

export const createServicio = async (req: Request, res: Response): Promise<void> => {
  const { cliente_id, modelo, num_serie, falla, descripcion, observaciones,
    imagen, garantia, estado, fecha_entrada, fecha_salida,
    anticipo, costo_refaccion, costo_total } = req.body;
  const { userId, localId, empresaId } = req.user!;

  if (!cliente_id || !modelo || !falla) {
    res.status(400).json({ error: 'cliente_id, modelo y falla son requeridos' }); return;
  }

  const db = await getDB();
  if (!get(db, 'SELECT id FROM clientes WHERE id = ? AND empresa_id = ?', [cliente_id, empresaId])) {
    res.status(400).json({ error: 'Cliente no encontrado' }); return;
  }

  const result = run(db, `INSERT INTO servicios
    (folio, cliente_id, modelo, num_serie, falla, descripcion, observaciones, imagen,
     garantia, estado, fecha_entrada, fecha_salida, anticipo, costo_refaccion, costo_total,
     usuario_id, local_id, empresa_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ['TEMP', cliente_id, modelo, num_serie ?? null, falla, descripcion ?? null,
     observaciones ?? null, imagen ?? null, garantia ?? 'Sin garantia',
     estado ?? 'Recibido', fecha_entrada ?? new Date().toISOString(),
     fecha_salida ?? null, anticipo ?? 0, costo_refaccion ?? 0, costo_total ?? 0,
     userId, localId, empresaId]);

  const newId = result.lastInsertRowid;
  const folio = generarFolio(db, empresaId, newId);
  run(db, 'UPDATE servicios SET folio = ? WHERE id = ?', [folio, newId]);
  persistDB();

  res.status(201).json(get(db, `SELECT s.*, c.nombre as cliente_nombre FROM servicios s
    LEFT JOIN clientes c ON s.cliente_id = c.id WHERE s.id = ?`, [newId]));
};

export const updateServicio = async (req: Request, res: Response): Promise<void> => {
  const { cliente_id, modelo, num_serie, falla, descripcion, observaciones,
    imagen, garantia, estado, fecha_entrada, fecha_salida,
    anticipo, costo_refaccion, costo_total } = req.body;
  const db = await getDB();

  if (!get(db, 'SELECT id FROM servicios WHERE id = ? AND empresa_id = ?', [Number(req.params.id), req.user!.empresaId])) {
    res.status(404).json({ error: 'Servicio no encontrado' }); return;
  }

  run(db, `UPDATE servicios SET cliente_id=?, modelo=?, num_serie=?, falla=?, descripcion=?,
    observaciones=?, imagen=?, garantia=?, estado=?, fecha_entrada=?, fecha_salida=?,
    anticipo=?, costo_refaccion=?, costo_total=?, fecha_actualizacion=datetime('now') WHERE id=?`,
    [cliente_id, modelo, num_serie ?? null, falla, descripcion ?? null, observaciones ?? null,
     imagen ?? null, garantia ?? 'Sin garantia', estado ?? 'Recibido',
     fecha_entrada, fecha_salida ?? null, anticipo ?? 0, costo_refaccion ?? 0,
     costo_total ?? 0, Number(req.params.id)]);
  persistDB();

  res.json(get(db, 'SELECT s.*, c.nombre as cliente_nombre FROM servicios s LEFT JOIN clientes c ON s.cliente_id = c.id WHERE s.id = ?', [Number(req.params.id)]));
};

export const deleteServicio = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const result = run(db, 'DELETE FROM servicios WHERE id = ? AND empresa_id = ?', [Number(req.params.id), req.user!.empresaId]);
  if (result.changes === 0) { res.status(404).json({ error: 'Servicio no encontrado' }); return; }
  persistDB();
  res.json({ ok: true });
};

export const getReporte = async (req: Request, res: Response): Promise<void> => {
  const { desde, hasta, estado } = req.query;
  const db = await getDB();
  const empresaId = req.user!.empresaId;

  let sql = `SELECT s.*, c.nombre as cliente_nombre, (s.costo_total - s.costo_refaccion) as utilidad
             FROM servicios s LEFT JOIN clientes c ON s.cliente_id = c.id WHERE s.empresa_id = ?`;
  const params: (string | number | null)[] = [empresaId];

  if (desde) { sql += ' AND s.fecha_entrada >= ?'; params.push(desde as string); }
  if (hasta) { sql += ' AND s.fecha_entrada <= ?'; params.push(hasta as string); }
  if (estado) { sql += ' AND s.estado = ?'; params.push(estado as string); }
  sql += ' ORDER BY s.fecha_entrada ASC';

  const servicios = all<Record<string, unknown>>(db, sql, params);
  const resumen = {
    total_servicios: servicios.length,
    ingresos_totales: servicios.reduce((a, s) => a + (Number(s.costo_total) || 0), 0),
    costo_refacciones: servicios.reduce((a, s) => a + (Number(s.costo_refaccion) || 0), 0),
    utilidad_neta: servicios.reduce((a, s) => a + (Number(s.utilidad) || 0), 0),
  };
  res.json({ resumen, servicios });
};

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = req.user!.empresaId;

  const stats = get(db, `SELECT COUNT(*) as total,
    SUM(costo_total) as ingresos_totales,
    SUM(CASE WHEN estado IN ('Recibido','Diagnostico','En proceso','Esperando refaccion') THEN 1 ELSE 0 END) as en_proceso,
    SUM(CASE WHEN estado = 'Entregado' THEN 1 ELSE 0 END) as entregados,
    SUM(CASE WHEN estado = 'Listo' THEN 1 ELSE 0 END) as listos,
    SUM(CASE WHEN estado = 'Cancelado' THEN 1 ELSE 0 END) as cancelados
    FROM servicios WHERE empresa_id = ?`, [empresaId]);

  const porMes = all(db, `SELECT strftime('%m', fecha_entrada) as mes, strftime('%Y', fecha_entrada) as anio,
    COUNT(*) as cantidad, SUM(costo_total) as ingresos
    FROM servicios WHERE empresa_id = ? AND fecha_entrada >= date('now', '-12 months')
    GROUP BY mes, anio ORDER BY anio, mes`, [empresaId]);

  const recientes = all(db, `SELECT s.id, s.folio, s.modelo, s.estado, s.costo_total, s.fecha_entrada, c.nombre as cliente_nombre
    FROM servicios s LEFT JOIN clientes c ON s.cliente_id = c.id
    WHERE s.empresa_id = ? ORDER BY s.fecha_creacion DESC LIMIT 5`, [empresaId]);

  res.json({ stats, porMes, recientes });
};

