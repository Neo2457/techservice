// src/controllers/listasController.ts
import { Request, Response } from 'express';
import { getDB, run, get, all, persistDB } from '../config/db';
import { registrarLog } from '../utils/logger';

// ── Listas de Precios CRUD ──────────────────────────────────────

export const getListasPrecios = async (req: Request, res: Response): Promise<void> => {
  const { q, empresa_id, page = '1', limit = '20', sort } = req.query;
  const db = await getDB();
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);
  const offset = (pageNum - 1) * limitNum;

  let where = ' WHERE 1=1';
  const params: (string | number | null)[] = [];

  if (req.user!.tipo === 'root') {
    if (empresa_id) { where += ' AND lp.empresa_id = ?'; params.push(Number(empresa_id)); }
  } else {
    where += ' AND lp.empresa_id = ?';
    params.push(req.user!.empresaId);
  }

  if (q) {
    where += ' AND (lp.nombre LIKE ? OR lp.descripcion LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like);
  }

  const total = (get(db, `SELECT COUNT(*) as total FROM listas_precios lp${where}`, params) as any)?.total ?? 0;
  const data = all(db,
    `SELECT lp.*, e.nombre as empresa_nombre,
            (SELECT COUNT(*) FROM clientes_listas cl WHERE cl.lista_id = lp.id) as total_clientes
     FROM listas_precios lp LEFT JOIN empresa e ON lp.empresa_id = e.id${where} ORDER BY ${{ nombre_asc:'lp.nombre ASC', nombre_desc:'lp.nombre DESC', descuento_asc:'lp.descuento_porcentaje ASC', descuento_desc:'lp.descuento_porcentaje DESC', fecha_asc:'lp.fecha_creacion ASC', fecha_desc:'lp.fecha_creacion DESC' }[sort as string] ?? 'lp.nombre ASC'} LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );
  res.json({ data, total, page: pageNum });
};

export const createListaPrecio = async (req: Request, res: Response): Promise<void> => {
  const { nombre, descripcion, descuento_porcentaje } = req.body;
  if (!nombre) { res.status(400).json({ error: 'El nombre es requerido' }); return; }

  const db = await getDB();
  const result = run(db,
    'INSERT INTO listas_precios (nombre, descripcion, descuento_porcentaje, empresa_id) VALUES (?,?,?,?)',
    [nombre, descripcion ?? null, Number(descuento_porcentaje) || 0, req.user!.empresaId]
  );
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'crear', modulo: 'listas', entidadId: Number(result.lastInsertRowid),
    descripcion: `Creó lista de precios: ${nombre}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.status(201).json(get(db, 'SELECT * FROM listas_precios WHERE id = ?', [result.lastInsertRowid]));
};

export const updateListaPrecio = async (req: Request, res: Response): Promise<void> => {
  const { nombre, descripcion, descuento_porcentaje } = req.body;
  const { id } = req.params;
  const db = await getDB();

  let findSql = 'SELECT id FROM listas_precios WHERE id = ?';
  const findParams: (string | number)[] = [Number(id)];
  if (req.user!.tipo !== 'root') { findSql += ' AND empresa_id = ?'; findParams.push(req.user!.empresaId); }
  if (!get(db, findSql, findParams)) { res.status(404).json({ error: 'Lista no encontrada' }); return; }

  run(db,
    'UPDATE listas_precios SET nombre=?, descripcion=?, descuento_porcentaje=? WHERE id=?',
    [nombre, descripcion ?? null, Number(descuento_porcentaje) || 0, Number(id)]
  );
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'editar', modulo: 'listas', entidadId: Number(id),
    descripcion: `Editó lista de precios ID ${id}: ${nombre}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json(get(db, 'SELECT * FROM listas_precios WHERE id = ?', [Number(id)]));
};

export const deleteListaPrecio = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();

  let delSql = 'DELETE FROM listas_precios WHERE id = ?';
  const delParams: (string | number)[] = [Number(req.params.id)];
  if (req.user!.tipo !== 'root') { delSql += ' AND empresa_id = ?'; delParams.push(req.user!.empresaId); }

  const result = run(db, delSql, delParams);
  if (result.changes === 0) { res.status(404).json({ error: 'Lista no encontrada' }); return; }
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'borrar', modulo: 'listas', entidadId: Number(req.params.id),
    descripcion: `Eliminó lista de precios ID ${req.params.id}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json({ ok: true });
};

// ── Clientes ↔ Listas ──────────────────────────────────────────

export const getClienteListas = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const listas = all(db,
    `SELECT lp.id, lp.nombre, lp.descripcion, lp.descuento_porcentaje, cl.fecha_asignacion
     FROM clientes_listas cl
     JOIN listas_precios lp ON cl.lista_id = lp.id
     WHERE cl.cliente_id = ?
     ORDER BY lp.nombre ASC`,
    [Number(req.params.id)]
  );
  res.json(listas);
};

export const asignarLista = async (req: Request, res: Response): Promise<void> => {
  const { lista_id } = req.body;
  if (!lista_id) { res.status(400).json({ error: 'lista_id es requerido' }); return; }

  const db = await getDB();
  run(db, 'INSERT OR IGNORE INTO clientes_listas (cliente_id, lista_id) VALUES (?,?)',
    [Number(req.params.id), Number(lista_id)]);
  persistDB();
  res.json({ ok: true });
};

export const quitarLista = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  run(db, 'DELETE FROM clientes_listas WHERE cliente_id = ? AND lista_id = ?',
    [Number(req.params.id), Number(req.params.listaId)]);
  persistDB();
  res.json({ ok: true });
};

export const getListaPrecioById = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  let sql = `SELECT lp.*, e.nombre as empresa_nombre,
             (SELECT COUNT(*) FROM clientes_listas cl WHERE cl.lista_id = lp.id) as total_clientes
             FROM listas_precios lp LEFT JOIN empresa e ON lp.empresa_id = e.id WHERE lp.id = ?`;
  const params: (string | number)[] = [Number(req.params.id)];
  if (req.user!.tipo !== 'root') { sql += ' AND lp.empresa_id = ?'; params.push(req.user!.empresaId); }
  const lista = get(db, sql, params);
  if (!lista) { res.status(404).json({ error: 'Lista no encontrada' }); return; }
  res.json(lista);
};

export const getListaClientes = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const clientes = all(db,
    `SELECT c.id, c.nombre, c.telefono, c.correo, c.tipo_cliente, cl.fecha_asignacion
     FROM clientes_listas cl
     JOIN personas c ON cl.cliente_id = c.id
     WHERE cl.lista_id = ?
     ORDER BY c.nombre ASC`,
    [Number(req.params.id)]
  );
  res.json(clientes);
};

export const syncClienteListas = async (req: Request, res: Response): Promise<void> => {
  const { lista_ids } = req.body; // array of lista IDs to assign
  if (!Array.isArray(lista_ids)) { res.status(400).json({ error: 'lista_ids debe ser un array' }); return; }

  const clienteId = Number(req.params.id);
  const db = await getDB();

  // Replace all assignments: delete existing and insert new ones
  run(db, 'DELETE FROM clientes_listas WHERE cliente_id = ?', [clienteId]);
  for (const lid of lista_ids) {
    run(db, 'INSERT OR IGNORE INTO clientes_listas (cliente_id, lista_id) VALUES (?,?)',
      [clienteId, Number(lid)]);
  }
  persistDB();
  res.json({ ok: true });
};
