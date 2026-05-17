// src/controllers/productosController.ts

import { Request, Response } from 'express';
import { getDB, run, get, all, persistDB } from '../config/db';
import { registrarLog } from '../utils/logger';
import { generarFolioProducto } from '../utils/folio';

// GET /api/productos — list with search, filters, sort, pagination
export const getProductos = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const { q, empresa_id, local_id, tipo, stock, sort, page = '1', limit = '20', notif } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 20;
  const offset = (pageNum - 1) * limitNum;

  let where = 'WHERE 1=1';
  const params: (string | number)[] = [];

  // Role-based filtering
  if (req.user!.tipo === 'root') {
    if (empresa_id) { where += ' AND p.empresa_id = ?'; params.push(Number(empresa_id)); }
    if (local_id) { where += ' AND p.local_id = ?'; params.push(Number(local_id)); }
  } else {
    where += ' AND p.empresa_id = ?';
    params.push(req.user!.empresaId);
    if (req.user!.tipo === 'empleado' && req.user!.localId) {
      where += ' AND p.local_id = ?';
      params.push(req.user!.localId);
    } else if (local_id) {
      where += ' AND p.local_id = ?';
      params.push(Number(local_id));
    }
  }

  // Search by folio, sku, codigo or nombre
  if (q) {
    where += ' AND (p.folio LIKE ? OR p.sku LIKE ? OR p.codigo LIKE ? OR p.nombre LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  // Filter by tipo de producto
  if (tipo) { where += ' AND p.tipo = ?'; params.push(tipo as string); }

  // Filter by stock level
  if (stock === 'con_stock')  { where += ' AND p.existencia > 0'; }
  else if (stock === 'sin_stock')  { where += ' AND p.existencia <= 0'; }
  else if (stock === 'bajo_stock') { where += ' AND p.existencia > 0 AND p.existencia <= 5'; }

  if (notif === 'stock_bajo') {
    const cfgRow = get<any>(db, 'SELECT notificaciones_config FROM configuracion WHERE empresa_id = ?', [req.user!.empresaId]);
    let umbral = 5;
    if (cfgRow?.notificaciones_config) {
      try { umbral = JSON.parse(cfgRow.notificaciones_config).stock_bajo?.umbral ?? 5; } catch(e) {}
    }
    where += ' AND p.existencia <= ?';
    params.push(umbral);
  }

  // Sort
  const sortMap: Record<string, string> = {
    folio_asc:        'p.folio ASC',
    folio_desc:       'p.folio DESC',
    nombre_asc:       'p.nombre ASC',
    nombre_desc:      'p.nombre DESC',
    venta_asc:        'p.venta ASC',
    venta_desc:       'p.venta DESC',
    existencia_asc:   'p.existencia ASC',
    existencia_desc:  'p.existencia DESC',
    reciente:         'p.id DESC',
    antiguo:          'p.id ASC',
  };
  const orderBy = sortMap[sort as string] || 'p.nombre ASC';

  // Count total
  const countRow = get<{ total: number }>(db,
    `SELECT COUNT(*) as total FROM productos p ${where}`, params
  );
  const total = countRow?.total ?? 0;

  // Fetch page
  const data = all(db,
    `SELECT p.id, p.folio, p.sku, p.codigo, p.tipo, p.nombre, p.compra, p.venta, p.existencia, p.local_id, p.empresa_id, p.fecha_creacion, p.precios, e.nombre as empresa_nombre, l.nombre_local as local_nombre
     FROM productos p
     LEFT JOIN empresa e ON p.empresa_id = e.id
     LEFT JOIN locales l ON p.local_id = l.id
     ${where}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  res.json({ data, total, page: pageNum });
};

// GET /api/productos/:id
export const getProductoById = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  let sql = `SELECT p.id, p.folio, p.sku, p.codigo, p.tipo, p.nombre, p.compra, p.venta,
                    p.existencia, p.local_id, p.empresa_id, p.fecha_creacion, p.precios,
                    e.nombre as empresa_nombre, l.nombre_local as local_nombre
             FROM productos p
             LEFT JOIN empresa e ON p.empresa_id = e.id
             LEFT JOIN locales l ON p.local_id = l.id
             WHERE p.id = ?`;
  const params: (string | number)[] = [Number(req.params.id)];

  if (req.user!.tipo !== 'root') {
    sql += ' AND p.empresa_id = ?';
    params.push(req.user!.empresaId);
  }

  const producto = get(db, sql, params);
  if (!producto) { res.status(404).json({ error: 'Producto no encontrado' }); return; }
  res.json(producto);
};

// POST /api/productos
export const createProducto = async (req: Request, res: Response): Promise<void> => {
  const { sku, codigo, tipo: tipoProducto, nombre, compra, venta, existencia, local_id } = req.body;
  const { empresaId, localId, tipo } = req.user!;

  if (!nombre || !nombre.trim()) {
    res.status(400).json({ error: 'El nombre es requerido' }); return;
  }
  if (venta === undefined || venta === null || isNaN(Number(venta))) {
    res.status(400).json({ error: 'El precio de venta es requerido' }); return;
  }

  const effectiveLocalId = (tipo === 'root' || tipo === 'admin') ? (local_id || localId) : localId;
  if (!effectiveLocalId) {
    res.status(400).json({ error: 'El local es requerido' }); return;
  }

  const db = await getDB();

  const result = run(db,
    `INSERT INTO productos (codigo, sku, tipo, nombre, compra, venta, existencia, local_id, empresa_id)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    ['TEMP', sku?.trim() || null, tipoProducto || null, nombre.trim(), Number(compra) || 0,
     Number(venta), Number(existencia) || 0, effectiveLocalId, empresaId]
  );

  const newId = result.lastInsertRowid;
  const folio = generarFolioProducto(db, empresaId);
  const finalCodigo = codigo?.trim() || '';

  run(db, 'UPDATE productos SET folio = ?, codigo = ? WHERE id = ?', [folio, finalCodigo, newId]);

  persistDB();
  const created = get(db,
    `SELECT p.id, p.folio, p.sku, p.codigo, p.tipo, p.nombre, p.compra, p.venta, p.existencia, p.local_id, p.empresa_id, p.fecha_creacion, p.precios, e.nombre as empresa_nombre, l.nombre_local as local_nombre
     FROM productos p
     LEFT JOIN empresa e ON p.empresa_id = e.id
     LEFT JOIN locales l ON p.local_id = l.id
     WHERE p.id = ?`, [newId]
  );
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'crear', modulo: 'productos', entidadId: Number(newId),
    descripcion: `Creó producto: ${nombre.trim()} | Folio: ${folio}`, ip: req.ip, empresaId: empresaId });
  res.status(201).json(created);
};

// PUT /api/productos/:id
export const updateProducto = async (req: Request, res: Response): Promise<void> => {
  const { sku, codigo, tipo: tipoProducto, nombre, compra, venta, existencia, local_id } = req.body;
  const { tipo, localId } = req.user!;
  const db = await getDB();
  const id = Number(req.params.id);

  let findSql = 'SELECT id, local_id FROM productos WHERE id = ?';
  const findParams: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') {
    findSql += ' AND empresa_id = ?';
    findParams.push(req.user!.empresaId);
  }
  const existing = get<{ id: number; local_id: number }>(db, findSql, findParams);
  if (!existing) {
    res.status(404).json({ error: 'Producto no encontrado' }); return;
  }

  if (!nombre || !nombre.trim()) {
    res.status(400).json({ error: 'El nombre es requerido' }); return;
  }

  const effectiveLocalId = (tipo === 'root' || tipo === 'admin') ? (local_id || existing.local_id) : (localId || existing.local_id);

  run(db,
    `UPDATE productos SET sku=?, codigo=?, tipo=?, nombre=?, compra=?, venta=?, existencia=?, local_id=?
     WHERE id=?`,
    [sku?.trim() || null, codigo?.trim() || '', tipoProducto || null, nombre.trim(),
     Number(compra) || 0, Number(venta) || 0,
     Number(existencia) || 0, effectiveLocalId, id]
  );

  persistDB();
  const updated = get(db,
    `SELECT p.id, p.folio, p.sku, p.codigo, p.tipo, p.nombre, p.compra, p.venta, p.existencia, p.local_id, p.empresa_id, p.fecha_creacion, p.precios, e.nombre as empresa_nombre, l.nombre_local as local_nombre
     FROM productos p
     LEFT JOIN empresa e ON p.empresa_id = e.id
     LEFT JOIN locales l ON p.local_id = l.id
     WHERE p.id = ?`, [id]
  );
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'editar', modulo: 'productos', entidadId: id,
    descripcion: `Editó producto: ${nombre.trim()}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json(updated);
};

// DELETE /api/productos/:id
export const deleteProducto = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);

  // Check if used in ventas_detalle
  const inUse = get<{ c: number }>(db,
    'SELECT COUNT(*) as c FROM ventas_detalle WHERE producto_id = ?', [id]
  );
  if (inUse && inUse.c > 0) {
    res.status(400).json({ error: 'No se puede eliminar: el producto tiene ventas registradas' }); return;
  }

  let delSql = 'DELETE FROM productos WHERE id = ?';
  const delParams: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') {
    delSql += ' AND empresa_id = ?';
    delParams.push(req.user!.empresaId);
  }

  const result = run(db, delSql, delParams);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Producto no encontrado' }); return;
  }

  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'borrar', modulo: 'productos', entidadId: id,
    descripcion: `Eliminó producto ID ${id}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json({ ok: true });
};
