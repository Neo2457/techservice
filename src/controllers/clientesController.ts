// src/controllers/clientesController.ts

import { Request, Response } from 'express';
import { getDB, run, get, all, persistDB } from '../config/db';
import { registrarLog } from '../utils/logger';

export const getClientes = async (req: Request, res: Response): Promise<void> => {
  const { q, tipo, roles, empresa_id, local_id, page = '1', limit = '20' } = req.query;
  const db = await getDB();
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);
  const offset = (pageNum - 1) * limitNum;

  let where = " WHERE ((',' || c.roles || ',') LIKE '%,cliente,%' OR c.tipo IS NULL)";
  const params: (string | number | null)[] = [];

  if (req.user!.tipo === 'root') {
    if (empresa_id) { where += ' AND c.empresa_id = ?'; params.push(Number(empresa_id)); }
    if (local_id) { where += ' AND c.local_id = ?'; params.push(Number(local_id)); }
  } else {
    where += ' AND c.empresa_id = ?';
    params.push(req.user!.empresaId);
    if (req.user!.tipo === 'empleado') {
      const scope = req.permisoScope || 'local';
      if (scope === 'local' && req.user!.localId) {
        where += ' AND c.local_id = ?';
        
        params.push(req.user!.localId);
      }
      // scope === 'empresa': sees all empresa clients
    }
  }

  if (q) {
    where += ' AND (c.nombre LIKE ? OR c.telefono LIKE ? OR c.correo LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (tipo) { where += ' AND c.tipo_cliente = ?'; params.push(tipo as string); }
  if (roles) { where += " AND (',' || c.roles || ',') LIKE ?"; params.push(`%,${roles},%`); }

  const total = (get(db, `SELECT COUNT(*) as total FROM personas c${where}`, params) as any)?.total ?? 0;
  const clientes = all(db,
    `SELECT c.*, e.nombre as empresa_nombre FROM personas c LEFT JOIN empresa e ON c.empresa_id = e.id${where} ORDER BY c.nombre ASC LIMIT ? OFFSET ?`,

    [...params, limitNum, offset]
  );

  // Attach assigned price lists only to the paginated subset
  const data = clientes.map((c: any) => {
    const listas = all(db,
      `SELECT lp.id, lp.nombre, lp.descuento_porcentaje, lp.precio_n
       FROM clientes_listas cl JOIN listas_precios lp ON cl.lista_id = lp.id
       WHERE cl.cliente_id = ? ORDER BY lp.nombre ASC`,
      [c.id as number]
    );
    return { ...c, listas };
  });

  res.json({ data, total, page: pageNum });
};

export const getClienteById = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  let cSql = 'SELECT * FROM personas WHERE id = ?';
  const cParams: (string | number)[] = [Number(req.params.id)];
  if (req.user!.tipo !== 'root') { cSql += ' AND empresa_id = ?'; cParams.push(req.user!.empresaId); }
  const cliente = get(db, cSql, cParams);
  if (!cliente) { res.status(404).json({ error: 'Cliente no encontrado' }); return; }

  const servicios = all(db, 'SELECT id, folio, modelo, falla, estado, fecha_entrada, costo_total FROM servicios WHERE cliente_id = ? ORDER BY fecha_entrada DESC LIMIT 20', [Number(req.params.id)]);
  const ventas = all(db, 'SELECT id, folio_venta, fecha, total, metodo_pago FROM ventas WHERE cliente_id = ? ORDER BY fecha DESC LIMIT 20', [Number(req.params.id)]);
  const creditos = all(db, "SELECT id, monto_total, saldo_pendiente, estado FROM creditos WHERE cliente_id = ? AND estado = 'activo'", [Number(req.params.id)]);

  res.json({ ...cliente, servicios, ventas, creditos });
};

export const createCliente = async (req: Request, res: Response): Promise<void> => {
  const { nombre, telefono, correo, direccion, foto, imagen, notas, tipo_cliente, roles } = req.body;
  const { empresaId, localId } = req.user!;

  if (!nombre) { res.status(400).json({ error: 'El nombre es requerido' }); return; }

  const db = await getDB();
  const rolesVal = Array.isArray(roles) ? roles.join(',') : (roles as string ?? 'cliente');
  const fotoVal = foto ?? imagen ?? null;
  const result = run(db,
    'INSERT INTO personas (nombre, telefono, correo, direccion, foto, notas, tipo_cliente, empresa_id, local_id, roles) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [nombre, telefono ?? null, correo ?? null, direccion ?? null, fotoVal, notas ?? null, tipo_cliente ?? 'regular', empresaId, localId, rolesVal]
  );
  persistDB();
  const created = get(db, 'SELECT * FROM personas WHERE id = ?', [result.lastInsertRowid]) as any;
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'crear', modulo: 'clientes', entidadId: Number(result.lastInsertRowid),
    descripcion: `Creó cliente: ${nombre}`, ip: req.ip, empresaId: empresaId });
  res.status(201).json(created);
};

export const updateCliente = async (req: Request, res: Response): Promise<void> => {
  const { nombre, telefono, correo, direccion, foto, imagen, notas, tipo_cliente, roles } = req.body;
  const { id } = req.params;
  const db = await getDB();

  let findSql = 'SELECT id FROM personas WHERE id = ?';
  const findParams: (string | number)[] = [Number(id)];
  if (req.user!.tipo !== 'root') { findSql += ' AND empresa_id = ?'; findParams.push(req.user!.empresaId); }
  if (!get(db, findSql, findParams)) {
    res.status(404).json({ error: 'Cliente no encontrado' }); return;
  }

  const rolesVal = roles !== undefined
    ? (Array.isArray(roles) ? roles.join(',') : roles as string)
    : undefined;
  const fotoVal = foto ?? imagen ?? null;
  const updateParams: any[] = [nombre, telefono ?? null, correo ?? null, direccion ?? null, fotoVal, notas ?? null, tipo_cliente ?? 'regular'];
  let updateSql = "UPDATE personas SET nombre=?, telefono=?, correo=?, direccion=?, foto=?, notas=?, tipo_cliente=?";
  if (rolesVal !== undefined) { updateSql += ', roles=?'; updateParams.push(rolesVal); }
  updateSql += ", fecha_actualizacion=datetime('now') WHERE id=?";
  updateParams.push(Number(id));
  run(db, updateSql, updateParams);
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'editar', modulo: 'clientes', entidadId: Number(id),
    descripcion: `Editó cliente: ${nombre}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json(get(db, 'SELECT * FROM personas WHERE id = ?', [Number(id)]));
};

export const deleteCliente = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const activos = get<{ c: number }>(db, "SELECT COUNT(*) as c FROM servicios WHERE cliente_id = ? AND estado NOT IN ('Entregado','Cancelado')", [Number(req.params.id)]);
  if (activos && activos.c > 0) { res.status(400).json({ error: 'El cliente tiene servicios activos' }); return; }

  let delSql = 'DELETE FROM personas WHERE id = ?';
  const delParams: (string | number)[] = [Number(req.params.id)];
  if (req.user!.tipo !== 'root') { delSql += ' AND empresa_id = ?'; delParams.push(req.user!.empresaId); }
  const result = run(db, delSql, delParams);
  if (result.changes === 0) { res.status(404).json({ error: 'Cliente no encontrado' }); return; }
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'borrar', modulo: 'clientes', entidadId: Number(req.params.id),
    descripcion: `Eliminó cliente ID ${req.params.id}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json({ ok: true });
};

export const updateRoles = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const { id } = req.params;
  const { roles } = req.body;
  if (!roles || !Array.isArray(roles)) { res.status(400).json({ error: 'roles debe ser un array' }); return; }

  let findSql = 'SELECT id FROM personas WHERE id = ?';
  const findParams: (string | number)[] = [Number(id)];
  if (req.user!.tipo !== 'root') { findSql += ' AND empresa_id = ?'; findParams.push(req.user!.empresaId); }
  if (!get(db, findSql, findParams)) { res.status(404).json({ error: 'Persona no encontrada' }); return; }

  const rolesVal = roles.join(',');
  run(db, 'UPDATE personas SET roles=? WHERE id=?', [rolesVal, Number(id)]);
  persistDB();
  res.json({ ok: true, roles: rolesVal });
};

