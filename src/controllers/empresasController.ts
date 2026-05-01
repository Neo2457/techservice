// src/controllers/empresasController.ts

import { Request, Response } from 'express';
import { getDB, run, get, all, persistDB } from '../config/db';
import { registrarLog } from '../utils/logger';

// GET /api/empresas?page=1&limit=20
export const getEmpresas = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const { page = '1', limit = '20', q, sort } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);
  const offset = (pageNum - 1) * limitNum;

  if (req.user!.tipo === 'root') {
    let where = ' WHERE 1=1';
    const params: (string | number)[] = [];
    if (q) { where += ' AND (e.nombre LIKE ? OR e.iniciales LIKE ?)'; const like = `%${q}%`; params.push(like, like); }
    const total = (get(db, `SELECT COUNT(*) as total FROM empresa e${where}`, params) as any)?.total ?? 0;
    const empSortMap: Record<string, string> = {
      nombre_asc: 'e.nombre ASC', nombre_desc: 'e.nombre DESC',
      iniciales_asc: 'e.iniciales ASC', iniciales_desc: 'e.iniciales DESC',
      rfc_asc: 'e.rfc ASC', rfc_desc: 'e.rfc DESC',
      ciudad_asc: 'e.ciudad ASC', ciudad_desc: 'e.ciudad DESC',
    };
    const empOrder = empSortMap[sort as string] ?? 'e.nombre ASC';
    const data = all(db,
      `SELECT e.*, (SELECT COUNT(*) FROM locales WHERE empresa_id = e.id) AS locales_count
       FROM empresa e${where} ORDER BY ${empOrder} LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({ data, total, page: pageNum });
  } else {
    // Admin/empleado: solo su empresa (always 1 result, no pagination needed)
    const data = all(db,
      `SELECT e.*, (SELECT COUNT(*) FROM locales WHERE empresa_id = e.id) AS locales_count
       FROM empresa e WHERE e.id = ?`,
      [req.user!.empresaId]
    );
    res.json({ data, total: data.length, page: 1 });
  }
};

// GET /api/empresas/:id
export const getEmpresaById = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);

  // Non-root can only see own empresa
  if (req.user!.tipo !== 'root' && id !== req.user!.empresaId) {
    res.status(403).json({ error: 'No tienes acceso a esta empresa' }); return;
  }

  const empresa = get(db,
    `SELECT e.*, (SELECT COUNT(*) FROM locales WHERE empresa_id = e.id) AS locales_count
     FROM empresa e WHERE e.id = ?`,
    [id]
  );
  if (!empresa) { res.status(404).json({ error: 'Empresa no encontrada' }); return; }
  res.json(empresa);
};

// POST /api/empresas (rootOnly)
export const createEmpresa = async (req: Request, res: Response): Promise<void> => {
  const { nombre, iniciales, rfc, telefono, correo, calle, cp, ciudad, estado_rep,
          tipo_empresa, nombre_encargado, cobro } = req.body;

  if (!nombre || !iniciales) {
    res.status(400).json({ error: 'Nombre e iniciales son requeridos' }); return;
  }

  const db = await getDB();
  const result = run(db,
    `INSERT INTO empresa (nombre, iniciales, rfc, telefono, correo, calle, cp, ciudad, estado_rep,
                          tipo_empresa, nombre_encargado, cobro)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [nombre, iniciales, rfc ?? null, telefono ?? null, correo ?? null,
     calle ?? null, cp ?? null, ciudad ?? null, estado_rep ?? null,
     tipo_empresa || 'servicio', nombre_encargado ?? null, cobro ?? 0]
  );

  persistDB();
  const nueva = get(db, 'SELECT * FROM empresa WHERE id = ?', [result.lastInsertRowid]);
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'crear', modulo: 'empresas', entidadId: Number(result.lastInsertRowid),
    descripcion: `Creó empresa: ${nombre}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.status(201).json(nueva);
};

// PUT /api/empresas/:id
export const updateEmpresa = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);

  // Admin can only edit own empresa
  if (req.user!.tipo !== 'root' && id !== req.user!.empresaId) {
    res.status(403).json({ error: 'No tienes acceso a esta empresa' }); return;
  }

  const existing = get(db, 'SELECT id FROM empresa WHERE id = ?', [id]);
  if (!existing) { res.status(404).json({ error: 'Empresa no encontrada' }); return; }

  const { nombre, iniciales, rfc, telefono, correo, calle, cp, ciudad, estado_rep,
          tipo_empresa, nombre_encargado, cobro, estatus } = req.body;

  run(db,
    `UPDATE empresa SET nombre=?, iniciales=?, rfc=?, telefono=?, correo=?, calle=?, cp=?,
            ciudad=?, estado_rep=?, tipo_empresa=?, nombre_encargado=?, cobro=?, estatus=?,
            fecha_actualizacion=datetime('now')
     WHERE id=?`,
    [nombre, iniciales, rfc ?? null, telefono ?? null, correo ?? null,
     calle ?? null, cp ?? null, ciudad ?? null, estado_rep ?? null,
     tipo_empresa || 'servicio', nombre_encargado ?? null, cobro ?? 0,
     estatus || 'activo', id]
  );

  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'editar', modulo: 'empresas', entidadId: id,
    descripcion: `Editó empresa ID ${id}: ${nombre}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json(get(db, 'SELECT * FROM empresa WHERE id = ?', [id]));
};

// DELETE /api/empresas/:id (rootOnly — soft delete)
export const deleteEmpresa = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);

  const existing = get(db, 'SELECT id, estatus FROM empresa WHERE id = ?', [id]);
  if (!existing) { res.status(404).json({ error: 'Empresa no encontrada' }); return; }

  // Check for active users
  const activeUsers = get<{ c: number }>(db, 'SELECT COUNT(*) as c FROM personas WHERE empresa_id = ? AND activo = 1 AND tipo IS NOT NULL', [id]);
  if (activeUsers && activeUsers.c > 0) {
    res.status(400).json({ error: `No se puede eliminar: hay ${activeUsers.c} usuario(s) activo(s) en esta empresa` }); return;
  }

  run(db, "UPDATE empresa SET estatus = 'inactivo', fecha_actualizacion = datetime('now') WHERE id = ?", [id]);
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'borrar', modulo: 'empresas', entidadId: id,
    descripcion: `Desactivó empresa ID ${id}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json({ ok: true, message: 'Empresa desactivada' });
};
