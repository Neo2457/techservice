// src/controllers/personasController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDB, run, get, all, persistDB } from '../config/db';
import { registrarLog } from '../utils/logger';

// GET /api/personas
export const getPersonas = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const { q, rol, tipo, empresa_id, local_id, page = '1', limit = '20', sort, notif } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 200);
  const offset = (pageNum - 1) * limitNum;

  let where = 'WHERE 1=1';
  const params: (string | number | null)[] = [];

  if (req.user!.tipo === 'root') {
    if (empresa_id) { where += ' AND p.empresa_id = ?'; params.push(Number(empresa_id)); }
    if (local_id)   { where += ' AND p.local_id = ?';   params.push(Number(local_id)); }
  } else {
    where += ' AND p.empresa_id = ?';
    params.push(req.user!.empresaId);
  }

  // Exclude root users for non-root viewers
  if (req.user!.tipo !== 'root') {
    where += " AND (p.tipo IS NULL OR p.tipo != 'root')";
  }

  if (q) {
    where += ' AND (p.nombre LIKE ? OR p.correo LIKE ? OR p.telefono LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (rol) {
    if (rol === 'otros') {
      where += " AND (',' || p.roles || ',') NOT LIKE '%,cliente,%' AND (',' || p.roles || ',') NOT LIKE '%,empleado,%' AND (',' || p.roles || ',') NOT LIKE '%,proveedor,%'";
    } else {
      where += " AND (',' || p.roles || ',') LIKE ?";
      params.push(`%,${rol},%`);
    }
  }
  if (tipo) { where += ' AND p.tipo = ?'; params.push(tipo as string); }

  // --- Filtros especiales por notificación ---
  if (notif === 'empleados_sin_actividad') {
    const cfgRow = get<any>(db, 'SELECT notificaciones_config FROM configuracion WHERE empresa_id = ?', [req.user!.empresaId]);
    let dias = 3;
    if (cfgRow?.notificaciones_config) {
      try { dias = JSON.parse(cfgRow.notificaciones_config).empleados_sin_actividad?.dias ?? 3; } catch(e) {}
    }
    where += ` AND p.id IN (
      SELECT u.id FROM personas u
      LEFT JOIN servicios s ON s.usuario_id = u.id AND s.empresa_id = u.empresa_id
      WHERE u.empresa_id = p.empresa_id AND u.tipo = 'empleado' AND u.activo = 1
      GROUP BY u.id
      HAVING MAX(s.fecha_actualizacion) IS NULL OR julianday('now') - julianday(MAX(s.fecha_actualizacion)) > ?
    )`;
    params.push(dias);
  }

  const total = (get(db, `SELECT COUNT(*) as total FROM personas p ${where}`, params) as any)?.total ?? 0;
  const data = all(db, `
    SELECT p.id, p.nombre, p.correo, p.telefono, p.foto, p.roles, p.tipo, p.tipo_cliente,
           p.activo, p.local_id, p.empresa_id, p.fecha_creacion,
           l.nombre_local, e.nombre as empresa_nombre
    FROM personas p
    LEFT JOIN locales l ON p.local_id = l.id
    LEFT JOIN empresa e ON p.empresa_id = e.id
    ${where}
    ORDER BY ${{ nombre_asc:'p.nombre ASC', nombre_desc:'p.nombre DESC', correo_asc:'p.correo ASC', correo_desc:'p.correo DESC', telefono_asc:'p.telefono ASC', telefono_desc:'p.telefono DESC', fecha_asc:'p.fecha_creacion ASC', fecha_desc:'p.fecha_creacion DESC' }[sort as string] ?? 'p.nombre ASC'}
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  res.json({ data, total, page: pageNum });
};

// GET /api/personas/:id
export const getPersonaById = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);

  let findWhere = 'WHERE p.id = ?';
  const findParams: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') {
    findWhere += ' AND p.empresa_id = ?';
    findParams.push(req.user!.empresaId);
  }

  const p = get(db, `
    SELECT p.*, l.nombre_local, e.nombre as empresa_nombre
    FROM personas p
    LEFT JOIN locales l ON p.local_id = l.id
    LEFT JOIN empresa e ON p.empresa_id = e.id
    ${findWhere}`, findParams) as any;

  if (!p) { res.status(404).json({ error: 'Persona no encontrada' }); return; }

  // Attach history
  const servicios = all(db, 'SELECT id, folio, modelo, estado, fecha_entrada, costo_total FROM servicios WHERE cliente_id = ? ORDER BY fecha_entrada DESC LIMIT 20', [id]);
  const ventas    = all(db, 'SELECT id, folio_venta, fecha, total, metodo_pago FROM ventas WHERE cliente_id = ? ORDER BY fecha DESC LIMIT 20', [id]);
  const permisos  = p.tipo ? all(db, 'SELECT modulo, ver, crear, editar, borrar, scope FROM permisos WHERE usuario_id = ?', [id]) : [];
  const listas    = all(db, `SELECT lp.id, lp.nombre, lp.descuento_porcentaje FROM clientes_listas cl JOIN listas_precios lp ON cl.lista_id = lp.id WHERE cl.cliente_id = ?`, [id]);

  const { contrasena: _, ...persona } = p as any;
  res.json({ ...persona, servicios, ventas, permisos, listas });
};

// POST /api/personas
export const createPersona = async (req: Request, res: Response): Promise<void> => {
  const { nombre, correo, telefono, direccion, notas, tipo_cliente, roles, foto,
          // System access fields (optional)
          tipo: tipoAcceso, local_id, contrasena } = req.body;

  if (!nombre) { res.status(400).json({ error: 'El nombre es requerido' }); return; }

  const { empresaId, tipo } = req.user!;
  const targetEmpresa = (tipo === 'root' && req.body.empresa_id) ? Number(req.body.empresa_id) : empresaId;

  const db = await getDB();

  // If assigning system access, validate
  if (tipoAcceso) {
    if (!correo) { res.status(400).json({ error: 'El correo es requerido para acceso al sistema' }); return; }
    if (!contrasena) { res.status(400).json({ error: 'La contraseña es requerida para acceso al sistema' }); return; }
    const existing = get(db, 'SELECT id FROM personas WHERE correo = ? AND tipo IS NOT NULL', [correo]);
    if (existing) { res.status(400).json({ error: 'Ya existe un usuario con ese correo' }); return; }
  }

  const rolesVal = Array.isArray(roles) ? roles.join(',') : (roles as string ?? 'cliente');
  const hash = contrasena ? bcrypt.hashSync(contrasena, 10) : null;
  const effectiveLocalId = local_id ?? req.user!.localId ?? null;

  const result = run(db, `
    INSERT INTO personas (nombre, correo, contrasena, tipo, telefono, foto, direccion, notas,
                          tipo_cliente, roles, local_id, empresa_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [nombre, correo ?? null, hash, tipoAcceso ?? null, telefono ?? null, foto ?? null,
     direccion ?? null, notas ?? null, tipo_cliente ?? 'regular', rolesVal,
     effectiveLocalId, targetEmpresa]
  );
  persistDB();
  const created = get(db, 'SELECT id, nombre, correo, tipo, roles, tipo_cliente, telefono, activo FROM personas WHERE id = ?', [result.lastInsertRowid]) as any;
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'crear', modulo: 'personas', entidadId: Number(result.lastInsertRowid),
    descripcion: `Creó persona: ${nombre}`, ip: req.ip, empresaId: targetEmpresa });
  res.status(201).json(created);
};

// PUT /api/personas/:id
export const updatePersona = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);
  const { nombre, correo, telefono, direccion, notas, tipo_cliente, roles, foto, local_id, activo } = req.body;

  let findSql = 'SELECT id, tipo FROM personas WHERE id = ?';
  const findParams: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') { findSql += ' AND empresa_id = ?'; findParams.push(req.user!.empresaId); }
  if (!get(db, findSql, findParams)) { res.status(404).json({ error: 'Persona no encontrada' }); return; }

  const rolesVal = roles !== undefined
    ? (Array.isArray(roles) ? roles.join(',') : roles as string)
    : undefined;

  const setParts: string[] = ['nombre=?', 'telefono=?', 'direccion=?', 'notas=?', 'tipo_cliente=?', "fecha_actualizacion=datetime('now')"];
  const setParams: any[] = [nombre, telefono ?? null, direccion ?? null, notas ?? null, tipo_cliente ?? 'regular'];

  if (correo !== undefined) { setParts.push('correo=?'); setParams.push(correo ?? null); }
  if (foto    !== undefined) { setParts.push('foto=?');   setParams.push(foto ?? null); }
  if (rolesVal !== undefined) { setParts.push('roles=?'); setParams.push(rolesVal); }
  if (local_id !== undefined) { setParts.push('local_id=?'); setParams.push(local_id ?? null); }
  if (activo   !== undefined) { setParts.push('activo=?'); setParams.push(activo ? 1 : 0); }

  run(db, `UPDATE personas SET ${setParts.join(', ')} WHERE id = ?`, [...setParams, id]);
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'editar', modulo: 'personas', entidadId: id,
    descripcion: `Editó persona: ${nombre}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json(get(db, 'SELECT id, nombre, correo, tipo, roles, tipo_cliente, telefono, activo, local_id FROM personas WHERE id = ?', [id]));
};

// DELETE /api/personas/:id
export const deletePersona = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);
  const activos = get<{ c: number }>(db, "SELECT COUNT(*) as c FROM servicios WHERE cliente_id = ? AND estado NOT IN ('Entregado','Cancelado')", [id]);
  if (activos && activos.c > 0) { res.status(400).json({ error: 'La persona tiene servicios activos' }); return; }

  let sql = 'DELETE FROM personas WHERE id = ? AND tipo IS NULL';
  const params: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') { sql += ' AND empresa_id = ?'; params.push(req.user!.empresaId); }
  const result = run(db, sql, params);
  if (result.changes === 0) {
    // Maybe they have system access — check
    const p = get<{ tipo: string | null }>(db, 'SELECT tipo FROM personas WHERE id = ?', [id]);
    if (p?.tipo) { res.status(400).json({ error: 'No se puede eliminar un usuario con acceso al sistema. Primero desactiva el acceso.' }); return; }
    res.status(404).json({ error: 'Persona no encontrada' }); return;
  }
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'borrar', modulo: 'personas', entidadId: id,
    descripcion: `Eliminó persona ID ${id}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json({ ok: true });
};

// PUT /api/personas/:id/acceso — activate or update system access
export const activarAcceso = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);
  const { tipo, local_id, contrasena } = req.body;

  if (!tipo || !['admin', 'empleado'].includes(tipo)) {
    res.status(400).json({ error: 'tipo debe ser admin o empleado' }); return;
  }

  let findSql = 'SELECT id, correo, tipo FROM personas WHERE id = ?';
  const findParams: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') { findSql += ' AND empresa_id = ?'; findParams.push(req.user!.empresaId); }
  const persona = get<{ id: number; correo: string | null; tipo: string | null }>(db, findSql, findParams);
  if (!persona) { res.status(404).json({ error: 'Persona no encontrada' }); return; }
  if (!persona.correo) { res.status(400).json({ error: 'La persona necesita correo para tener acceso al sistema' }); return; }

  // Check correo uniqueness among system users (excluding self)
  const dup = get(db, 'SELECT id FROM personas WHERE correo = ? AND tipo IS NOT NULL AND id != ?', [persona.correo, id]);
  if (dup) { res.status(400).json({ error: 'Ya existe otro usuario con ese correo' }); return; }

  const setParts: string[] = ['tipo=?', 'local_id=?'];
  const setParams: any[] = [tipo, local_id ?? null];

  if (contrasena) { setParts.push('contrasena=?'); setParams.push(bcrypt.hashSync(contrasena, 10)); }
  else if (!persona.tipo) {
    // New system user — must provide password
    res.status(400).json({ error: 'Se requiere contraseña para activar el acceso' }); return;
  }

  run(db, `UPDATE personas SET ${setParts.join(', ')} WHERE id = ?`, [...setParams, id]);
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'editar', modulo: 'personas', entidadId: id,
    descripcion: `Activó acceso al sistema (${tipo}) para persona ID ${id}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json({ ok: true });
};

// DELETE /api/personas/:id/acceso — remove system access
export const desactivarAcceso = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);

  // Root puede desactivar acceso de cualquier empresa; los demás solo dentro de la suya.
  // (La jerarquía adicional ya fue validada por el middleware verificarJerarquiaPersona.)
  let findSql = 'SELECT tipo FROM personas WHERE id = ?';
  const findParams: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') {
    findSql += ' AND empresa_id = ?';
    findParams.push(req.user!.empresaId);
  }
  const persona = get<{ tipo: string | null }>(db, findSql, findParams);
  if (!persona) { res.status(404).json({ error: 'Persona no encontrada' }); return; }
  if (!persona.tipo || persona.tipo === 'root') {
    res.status(400).json({ error: 'No se puede desactivar este acceso' }); return;
  }

  run(db, 'UPDATE personas SET tipo=NULL, contrasena=NULL WHERE id=?', [id]);
  // Remove permissions too
  run(db, 'DELETE FROM permisos WHERE usuario_id=?', [id]);
  persistDB();
  res.json({ ok: true });
};

// PUT /api/personas/:id/estado — activar / desactivar usuario sin borrarlo
// Solo aplica a personas con `tipo` (es decir, con acceso al sistema).
// Si se desactiva, el usuario no podrá volver a loguearse hasta reactivarse,
// pero todos sus registros (servicios, ventas, etc.) quedan intactos.
export const toggleEstadoPersona = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);
  const activoNuevo = req.body.activo ? 1 : 0;

  // Root puede tocar cualquier empresa; los demás solo dentro de la suya.
  // (Jerarquía adicional ya validada por el middleware verificarJerarquiaPersona.)
  let findSql = 'SELECT id, tipo, activo FROM personas WHERE id = ?';
  const findParams: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') {
    findSql += ' AND empresa_id = ?';
    findParams.push(req.user!.empresaId);
  }
  const persona = get<{ id: number; tipo: string | null; activo: number }>(db, findSql, findParams);
  if (!persona) { res.status(404).json({ error: 'Persona no encontrada' }); return; }
  if (!persona.tipo) {
    res.status(400).json({ error: 'Esta persona no tiene acceso al sistema, no aplica activar/desactivar' }); return;
  }
  if (persona.tipo === 'root' && activoNuevo === 0) {
    res.status(400).json({ error: 'No se puede desactivar a un usuario root' }); return;
  }
  // No permitir auto-desactivarse (te quedarías fuera del sistema)
  if (id === req.user!.userId && activoNuevo === 0) {
    res.status(400).json({ error: 'No puedes desactivarte a ti mismo' }); return;
  }

  run(db, 'UPDATE personas SET activo=? WHERE id=?', [activoNuevo, id]);
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: activoNuevo ? 'editar' : 'borrar', modulo: 'personas', entidadId: id,
    descripcion: activoNuevo ? `Reactivó usuario ID ${id}` : `Desactivó usuario ID ${id}`,
    ip: req.ip, empresaId: req.user!.empresaId });
  res.json({ ok: true, activo: activoNuevo });
};

// GET /api/personas/:id/permisos
export const getPermisos = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const rows = all(db, 'SELECT modulo, ver, crear, editar, borrar, scope FROM permisos WHERE usuario_id = ?', [Number(req.params.id)]);
  res.json(rows);
};

// PUT /api/personas/:id/permisos
export const updatePermisos = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);
  const { permisos } = req.body;
  if (!Array.isArray(permisos)) { res.status(400).json({ error: 'permisos debe ser array' }); return; }

  for (const p of permisos) {
    const existing = get(db, 'SELECT id FROM permisos WHERE usuario_id = ? AND modulo = ?', [id, p.modulo]);
    if (existing) {
      run(db, 'UPDATE permisos SET ver=?, crear=?, editar=?, borrar=?, scope=? WHERE usuario_id=? AND modulo=?',
        [p.ver ? 1 : 0, p.crear ? 1 : 0, p.editar ? 1 : 0, p.borrar ? 1 : 0, p.scope ?? 'empresa', id, p.modulo]);
    } else {
      run(db, 'INSERT INTO permisos (usuario_id, modulo, ver, crear, editar, borrar, scope) VALUES (?,?,?,?,?,?,?)',
        [id, p.modulo, p.ver ? 1 : 0, p.crear ? 1 : 0, p.editar ? 1 : 0, p.borrar ? 1 : 0, p.scope ?? 'empresa']);
    }
  }
  persistDB();
  res.json({ ok: true });
};
