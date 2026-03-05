// src/controllers/clientesController.ts

import { Request, Response } from 'express';
import { getDB, run, get, all, persistDB } from '../config/db';

export const getClientes = async (req: Request, res: Response): Promise<void> => {
  const { q, tipo } = req.query;
  const empresaId = req.user!.empresaId;
  const db = await getDB();

  let sql = 'SELECT * FROM clientes WHERE empresa_id = ?';
  const params: (string | number | null)[] = [empresaId];

  if (q) {
    sql += ' AND (nombre LIKE ? OR telefono LIKE ? OR correo LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (tipo) { sql += ' AND tipo_cliente = ?'; params.push(tipo as string); }
  sql += ' ORDER BY nombre ASC';

  res.json(all(db, sql, params));
};

export const getClienteById = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const cliente = get(db, 'SELECT * FROM clientes WHERE id = ? AND empresa_id = ?', [Number(req.params.id), req.user!.empresaId]);
  if (!cliente) { res.status(404).json({ error: 'Cliente no encontrado' }); return; }

  const servicios = all(db, 'SELECT id, folio, modelo, falla, estado, fecha_entrada, costo_total FROM servicios WHERE cliente_id = ? ORDER BY fecha_entrada DESC LIMIT 20', [Number(req.params.id)]);
  const ventas = all(db, 'SELECT id, folio_venta, fecha, total, metodo_pago FROM ventas WHERE cliente_id = ? ORDER BY fecha DESC LIMIT 20', [Number(req.params.id)]);
  const creditos = all(db, "SELECT id, monto_total, saldo_pendiente, estado FROM creditos WHERE cliente_id = ? AND estado = 'activo'", [Number(req.params.id)]);

  res.json({ ...cliente, servicios, ventas, creditos });
};

export const createCliente = async (req: Request, res: Response): Promise<void> => {
  const { nombre, telefono, correo, direccion, imagen, notas, tipo_cliente } = req.body;
  const { empresaId, localId } = req.user!;

  if (!nombre) { res.status(400).json({ error: 'El nombre es requerido' }); return; }

  const db = await getDB();
  const result = run(db,
    'INSERT INTO clientes (nombre, telefono, correo, direccion, imagen, notas, tipo_cliente, empresa_id, local_id) VALUES (?,?,?,?,?,?,?,?,?)',
    [nombre, telefono ?? null, correo ?? null, direccion ?? null, imagen ?? null, notas ?? null, tipo_cliente ?? 'regular', empresaId, localId]
  );
  persistDB();
  res.status(201).json(get(db, 'SELECT * FROM clientes WHERE id = ?', [result.lastInsertRowid]));
};

export const updateCliente = async (req: Request, res: Response): Promise<void> => {
  const { nombre, telefono, correo, direccion, imagen, notas, tipo_cliente } = req.body;
  const { id } = req.params;
  const db = await getDB();

  if (!get(db, 'SELECT id FROM clientes WHERE id = ? AND empresa_id = ?', [Number(id), req.user!.empresaId])) {
    res.status(404).json({ error: 'Cliente no encontrado' }); return;
  }

  run(db, "UPDATE clientes SET nombre=?, telefono=?, correo=?, direccion=?, imagen=?, notas=?, tipo_cliente=?, fecha_actualizacion=datetime('now') WHERE id=?",
    [nombre, telefono ?? null, correo ?? null, direccion ?? null, imagen ?? null, notas ?? null, tipo_cliente ?? 'regular', Number(id)]);
  persistDB();
  res.json(get(db, 'SELECT * FROM clientes WHERE id = ?', [Number(id)]));
};

export const deleteCliente = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const activos = get<{ c: number }>(db, "SELECT COUNT(*) as c FROM servicios WHERE cliente_id = ? AND estado NOT IN ('Entregado','Cancelado')", [Number(req.params.id)]);
  if (activos && activos.c > 0) { res.status(400).json({ error: 'El cliente tiene servicios activos' }); return; }

  const result = run(db, 'DELETE FROM clientes WHERE id = ? AND empresa_id = ?', [Number(req.params.id), req.user!.empresaId]);
  if (result.changes === 0) { res.status(404).json({ error: 'Cliente no encontrado' }); return; }
  persistDB();
  res.json({ ok: true });
};

