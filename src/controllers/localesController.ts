// src/controllers/localesController.ts

import { Request, Response } from 'express';
import { getDB, run, get, all, persistDB } from '../config/db';
import { registrarLog } from '../utils/logger';

// GET /api/locales?empresa_id=N&page=1&limit=20
export const getLocales = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const { empresa_id, page = '1', limit = '20' } = req.query;
  const empresaFilter = empresa_id ? Number(empresa_id) : null;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);
  const offset = (pageNum - 1) * limitNum;

  let where = '';
  const params: number[] = [];

  if (req.user!.tipo === 'root') {
    if (empresaFilter) { where = ' WHERE l.empresa_id = ?'; params.push(empresaFilter); }
  } else {
    where = ' WHERE l.empresa_id = ?';
    params.push(req.user!.empresaId);
  }

  const total = (get(db,
    `SELECT COUNT(*) as total FROM locales l JOIN empresa e ON l.empresa_id = e.id${where}`,
    params
  ) as any)?.total ?? 0;
  const data = all(db,
    `SELECT l.*, e.nombre AS empresa_nombre,
            (SELECT COUNT(*) FROM personas WHERE local_id = l.id AND activo = 1 AND tipo IS NOT NULL) AS usuarios_count
     FROM locales l JOIN empresa e ON l.empresa_id = e.id${where}
     ORDER BY e.nombre ASC, l.nombre_local ASC LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );
  res.json({ data, total, page: pageNum });
};

// GET /api/locales/:id
export const getLocalById = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);

  let sql = `SELECT l.*, e.nombre AS empresa_nombre
             FROM locales l JOIN empresa e ON l.empresa_id = e.id
             WHERE l.id = ?`;
  const params: number[] = [id];

  if (req.user!.tipo !== 'root') {
    sql += ' AND l.empresa_id = ?';
    params.push(req.user!.empresaId);
  }

  const local = get(db, sql, params);
  if (!local) { res.status(404).json({ error: 'Local no encontrado' }); return; }
  res.json(local);
};

// POST /api/locales
export const createLocal = async (req: Request, res: Response): Promise<void> => {
  const { nombre_local, ubicacion_interna, ciudad, estado_local, telefono,
          correo_contacto, gerente_encargado, fecha_apertura, empresa_id } = req.body;

  if (!nombre_local) {
    res.status(400).json({ error: 'El nombre del local es requerido' }); return;
  }

  // Root can specify empresa_id, admin uses own
  const empresaId = (req.user!.tipo === 'root' && empresa_id) ? empresa_id : req.user!.empresaId;

  const db = await getDB();

  // Verify empresa exists
  if (!get(db, 'SELECT id FROM empresa WHERE id = ?', [empresaId])) {
    res.status(400).json({ error: 'La empresa no existe' }); return;
  }

  const result = run(db,
    `INSERT INTO locales (nombre_local, ubicacion_interna, ciudad, estado_local, telefono,
                          correo_contacto, gerente_encargado, fecha_apertura, empresa_id)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [nombre_local, ubicacion_interna ?? null, ciudad ?? null, estado_local ?? null,
     telefono ?? null, correo_contacto ?? null, gerente_encargado ?? null,
     fecha_apertura ?? null, empresaId]
  );

  persistDB();
  const nuevo = get(db,
    `SELECT l.*, e.nombre AS empresa_nombre FROM locales l
     JOIN empresa e ON l.empresa_id = e.id WHERE l.id = ?`,
    [result.lastInsertRowid]
  );
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'crear', modulo: 'locales', entidadId: Number(result.lastInsertRowid),
    descripcion: `Creó local: ${nombre_local}`, ip: req.ip, empresaId: Number(empresaId) });
  res.status(201).json(nuevo);
};

// PUT /api/locales/:id
export const updateLocal = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);

  // Check access
  let findSql = 'SELECT id, empresa_id FROM locales WHERE id = ?';
  const findParams: number[] = [id];
  if (req.user!.tipo !== 'root') {
    findSql += ' AND empresa_id = ?';
    findParams.push(req.user!.empresaId);
  }

  const existing = get<{ id: number; empresa_id: number }>(db, findSql, findParams);
  if (!existing) { res.status(404).json({ error: 'Local no encontrado' }); return; }

  const { nombre_local, ubicacion_interna, ciudad, estado_local, telefono,
          correo_contacto, gerente_encargado, fecha_apertura, estatus } = req.body;

  run(db,
    `UPDATE locales SET nombre_local=?, ubicacion_interna=?, ciudad=?, estado_local=?,
            telefono=?, correo_contacto=?, gerente_encargado=?, fecha_apertura=?, estatus=?
     WHERE id=?`,
    [nombre_local, ubicacion_interna ?? null, ciudad ?? null, estado_local ?? null,
     telefono ?? null, correo_contacto ?? null, gerente_encargado ?? null,
     fecha_apertura ?? null, estatus || 'A', id]
  );

  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'editar', modulo: 'locales', entidadId: id,
    descripcion: `Editó local ID ${id}: ${nombre_local}`, ip: req.ip, empresaId: existing.empresa_id });
  res.json(get(db,
    `SELECT l.*, e.nombre AS empresa_nombre FROM locales l
     JOIN empresa e ON l.empresa_id = e.id WHERE l.id = ?`,
    [id]
  ));
};

// DELETE /api/locales/:id
export const deleteLocal = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);

  let findSql = 'SELECT id FROM locales WHERE id = ?';
  const findParams: number[] = [id];
  if (req.user!.tipo !== 'root') {
    findSql += ' AND empresa_id = ?';
    findParams.push(req.user!.empresaId);
  }

  if (!get(db, findSql, findParams)) {
    res.status(404).json({ error: 'Local no encontrado' }); return;
  }

  // Check for assigned users
  const users = get<{ c: number }>(db, 'SELECT COUNT(*) as c FROM personas WHERE local_id = ? AND activo = 1 AND tipo IS NOT NULL', [id]);
  if (users && users.c > 0) {
    res.status(400).json({ error: `No se puede eliminar: hay ${users.c} usuario(s) asignado(s) a este local` }); return;
  }

  run(db, "UPDATE locales SET estatus = 'I' WHERE id = ?", [id]);
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'borrar', modulo: 'locales', entidadId: id,
    descripcion: `Desactivó local ID ${id}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json({ ok: true, message: 'Local desactivado' });
};

// PUT /api/locales/:id/wa-config — update only wa_config for a local
export const updateLocalWaConfig = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);
  const { wa_config } = req.body;

  let findSql = 'SELECT id FROM locales WHERE id = ?';
  const findParams: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') {
    findSql += ' AND empresa_id = ?';
    findParams.push(req.user!.empresaId);
  }
  if (!get(db, findSql, findParams)) {
    res.status(404).json({ error: 'Local no encontrado' }); return;
  }

  run(db, 'UPDATE locales SET wa_config = ? WHERE id = ?',
    [wa_config ? (typeof wa_config === 'string' ? wa_config : JSON.stringify(wa_config)) : null, id]);
  persistDB();
  res.json({ ok: true });
};

// GET /api/empresas/:empresaId/locales (convenience for dropdowns)
export const getLocalesByEmpresa = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = Number(req.params.empresaId);

  // Non-root can only see locales of their empresa
  if (req.user!.tipo !== 'root' && empresaId !== req.user!.empresaId) {
    res.status(403).json({ error: 'No tienes acceso a los locales de esta empresa' }); return;
  }

  const locales = all(db,
    `SELECT l.*, e.nombre AS empresa_nombre FROM locales l
     JOIN empresa e ON l.empresa_id = e.id
     WHERE l.empresa_id = ? AND l.estatus = 'A'
     ORDER BY l.nombre_local ASC`,
    [empresaId]
  );
  res.json(locales);
};
