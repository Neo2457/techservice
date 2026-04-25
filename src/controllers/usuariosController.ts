// src/controllers/usuariosController.ts

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDB, run, get, all, persistDB } from '../config/db';
import { registrarLog } from '../utils/logger';

const MODULOS = ['servicios', 'clientes', 'productos', 'ventas', 'cortes', 'costos', 'descuentos', 'reportes', 'empresas', 'locales', 'auditoria', 'wa_notificaciones'];

interface UsuarioRow {
  id: number; nombre: string; correo: string; tipo: string;
  telefono: string | null; foto: string | null;
  local_id: number | null; empresa_id: number; activo: number;
  fecha_creacion: string;
}

interface PermisoRow {
  id: number; usuario_id: number; modulo: string;
  ver: number; crear: number; editar: number; borrar: number;
  scope: string;
}

// GET /api/usuarios?empresa_id=N&local_id=N&tipo=admin|empleado&page=1&limit=20
export const getUsuarios = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const { empresa_id, local_id, tipo, q, page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);
  const offset = (pageNum - 1) * limitNum;

  const baseSelect = `SELECT u.id, u.nombre, u.correo, u.tipo, u.telefono, u.foto,
                    u.local_id, u.empresa_id, u.activo, u.fecha_creacion,
                    l.nombre_local AS local_nombre, e.nombre AS empresa_nombre
             FROM personas u
             LEFT JOIN locales l ON u.local_id = l.id
             LEFT JOIN empresa e ON u.empresa_id = e.id`;
  let where = '';
  const params: (string | number)[] = [];

  if (req.user!.tipo === 'root') {
    where = ' WHERE u.tipo IS NOT NULL';
    if (empresa_id) { where += ' AND u.empresa_id = ?'; params.push(Number(empresa_id)); }
    if (local_id) { where += ' AND u.local_id = ?'; params.push(Number(local_id)); }
    if (tipo) { where += ' AND u.tipo = ?'; params.push(tipo as string); }
  } else {
    where = ' WHERE u.empresa_id = ? AND u.tipo IS NOT NULL';
    params.push(req.user!.empresaId);
    where += " AND u.tipo != 'root'";
    if (local_id) { where += ' AND u.local_id = ?'; params.push(Number(local_id)); }
    if (tipo) { where += ' AND u.tipo = ?'; params.push(tipo as string); }
  }

  if (q) {
    where += ' AND (u.nombre LIKE ? OR u.correo LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  const total = (get(db, `SELECT COUNT(*) as total FROM personas u${where}`, params) as any)?.total ?? 0;
  const data = all(db, `${baseSelect}${where} ORDER BY u.fecha_creacion DESC LIMIT ? OFFSET ?`, [...params, limitNum, offset]);
  res.json({ data, total, page: pageNum });
};

// GET /api/usuarios/:id
export const getUsuarioById = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const targetId = Number(req.params.id);

  let sql = `SELECT u.id, u.nombre, u.correo, u.tipo, u.telefono, u.foto,
                    u.local_id, u.empresa_id, u.activo, u.fecha_creacion,
                    l.nombre_local AS local_nombre, e.nombre AS empresa_nombre
             FROM personas u
             LEFT JOIN locales l ON u.local_id = l.id
             LEFT JOIN empresa e ON u.empresa_id = e.id
             WHERE u.id = ? AND u.tipo IS NOT NULL`;
  const params: (string | number)[] = [targetId];

  // Admin can only see users in their empresa
  if (req.user!.tipo !== 'root') {
    sql += ' AND u.empresa_id = ?';
    params.push(req.user!.empresaId);
  }

  const usuario = get(db, sql, params);
  if (!usuario) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

  const permisos = all<PermisoRow>(db, 'SELECT * FROM permisos WHERE usuario_id = ?', [targetId]);
  res.json({ ...(usuario as any), permisos });
};

// POST /api/usuarios
export const createUsuario = async (req: Request, res: Response): Promise<void> => {
  const { nombre, correo, contrasena, tipo, telefono, local_id, empresa_id } = req.body;

  if (!nombre || !correo || !contrasena) {
    res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos' }); return;
  }

  // Determine empresa: root can specify any, admin uses their own
  const empresaId = (req.user!.tipo === 'root' && empresa_id) ? empresa_id : req.user!.empresaId;

  // Admin solo puede crear empleados, root puede crear admin y empleados
  const tipoFinal = tipo || 'empleado';
  if (req.user!.tipo === 'admin' && tipoFinal !== 'empleado') {
    res.status(403).json({ error: 'Solo root puede crear usuarios admin' }); return;
  }
  if (tipoFinal === 'root') {
    res.status(403).json({ error: 'No se puede crear otro usuario root' }); return;
  }

  // Determine local_id based on tipo
  let finalLocalId: number | null = null;
  if (tipoFinal === 'empleado') {
    if (!local_id) {
      res.status(400).json({ error: 'Los empleados deben ser asignados a un local' }); return;
    }
    finalLocalId = local_id;
  }
  // admin and root: local_id stays null

  const db = await getDB();

  // Verificar correo único
  if (get(db, 'SELECT id FROM personas WHERE correo = ?', [correo])) {
    res.status(400).json({ error: 'El correo ya está registrado' }); return;
  }

  const hash = bcrypt.hashSync(contrasena, 10);
  const rolesVal = Array.isArray(req.body.roles) ? req.body.roles.join(',') : (req.body.roles || tipoFinal);
  const result = run(db,
    'INSERT INTO personas (nombre, correo, contrasena, tipo, telefono, local_id, empresa_id, roles) VALUES (?,?,?,?,?,?,?,?)',
    [nombre, correo, hash, tipoFinal, telefono ?? null, finalLocalId, empresaId, rolesVal]
  );

  // Crear permisos por defecto para empleados (todo en 0)
  if (tipoFinal === 'empleado') {
    for (const modulo of MODULOS) {
      run(db, 'INSERT INTO permisos (usuario_id, modulo) VALUES (?, ?)', [result.lastInsertRowid, modulo]);
    }
  }

  persistDB();

  const nuevo = get(db,
    `SELECT u.id, u.nombre, u.correo, u.tipo, u.telefono, u.foto, u.local_id, u.empresa_id, u.activo, u.fecha_creacion,
            l.nombre_local AS local_nombre, e.nombre AS empresa_nombre
     FROM personas u LEFT JOIN locales l ON u.local_id = l.id LEFT JOIN empresa e ON u.empresa_id = e.id
     WHERE u.id = ?`,
    [result.lastInsertRowid]
  );
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'crear', modulo: 'usuarios', entidadId: Number(result.lastInsertRowid),
    descripcion: `Creó usuario: ${nombre} (${correo}) tipo: ${tipoFinal}`, ip: req.ip, empresaId: Number(empresaId) });
  res.status(201).json(nuevo);
};

// PUT /api/usuarios/:id
export const updateUsuario = async (req: Request, res: Response): Promise<void> => {
  const { nombre, correo, tipo, telefono, activo, contrasena, local_id } = req.body;
  const db = await getDB();
  const targetId = Number(req.params.id);

  let findSql = 'SELECT id, tipo, empresa_id, local_id FROM personas WHERE id = ? AND tipo IS NOT NULL';
  const findParams: (string | number)[] = [targetId];
  if (req.user!.tipo !== 'root') {
    findSql += ' AND empresa_id = ?';
    findParams.push(req.user!.empresaId);
  }

  const target = get<UsuarioRow>(db, findSql, findParams);
  if (!target) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

  // Protecciones de tipo
  if (target.tipo === 'root' && req.user!.tipo !== 'root') {
    res.status(403).json({ error: 'No puedes modificar un usuario root' }); return;
  }
  if (tipo === 'root') {
    res.status(403).json({ error: 'No se puede asignar tipo root' }); return;
  }

  // Verificar correo único si cambió
  if (correo) {
    const existing = get<{ id: number }>(db, 'SELECT id FROM personas WHERE correo = ? AND id != ?', [correo, targetId]);
    if (existing) { res.status(400).json({ error: 'El correo ya está registrado' }); return; }
  }

  // Determine local_id: admin/root type → null, empleado → required
  const tipoFinal = tipo ?? target.tipo;
  let finalLocalId: number | null = target.local_id;
  if (tipoFinal === 'admin' || tipoFinal === 'root') {
    finalLocalId = null;
  } else if (local_id !== undefined) {
    finalLocalId = local_id;
  }

  let sql = "UPDATE personas SET nombre=?, correo=?, tipo=?, telefono=?, activo=?, local_id=? WHERE id=?";
  let params: (string | number | null)[] = [
    nombre ?? target.nombre, correo ?? target.correo, tipoFinal,
    telefono ?? null, activo ?? 1, finalLocalId, targetId
  ];

  if (contrasena) {
    const hash = bcrypt.hashSync(contrasena, 10);
    sql = "UPDATE personas SET nombre=?, correo=?, tipo=?, telefono=?, activo=?, local_id=?, contrasena=? WHERE id=?";
    params = [nombre ?? target.nombre, correo ?? target.correo, tipoFinal, telefono ?? null, activo ?? 1, finalLocalId, hash, targetId];
  }

  run(db, sql, params);
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'editar', modulo: 'usuarios', entidadId: targetId,
    descripcion: `Editó usuario ID ${targetId} (${correo ?? target.correo})`, ip: req.ip, empresaId: req.user!.empresaId });

  res.json(get(db,
    `SELECT u.id, u.nombre, u.correo, u.tipo, u.telefono, u.foto, u.local_id, u.empresa_id, u.activo, u.fecha_creacion,
            l.nombre_local AS local_nombre, e.nombre AS empresa_nombre
     FROM personas u LEFT JOIN locales l ON u.local_id = l.id LEFT JOIN empresa e ON u.empresa_id = e.id
     WHERE u.id = ?`,
    [targetId]
  ));
};

// DELETE /api/usuarios/:id (desactivar)
export const deleteUsuario = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const targetId = Number(req.params.id);

  let findSql = 'SELECT tipo FROM personas WHERE id = ? AND tipo IS NOT NULL';
  const findParams: (string | number)[] = [targetId];
  if (req.user!.tipo !== 'root') {
    findSql += ' AND empresa_id = ?';
    findParams.push(req.user!.empresaId);
  }

  const target = get<{ tipo: string }>(db, findSql, findParams);
  if (!target) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
  if (target.tipo === 'root') { res.status(403).json({ error: 'No se puede eliminar un usuario root' }); return; }
  if (targetId === req.user!.userId) { res.status(400).json({ error: 'No puedes desactivarte a ti mismo' }); return; }

  run(db, 'UPDATE personas SET activo = 0 WHERE id = ?', [targetId]);
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'borrar', modulo: 'usuarios', entidadId: targetId,
    descripcion: `Desactivó usuario ID ${targetId}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json({ ok: true });
};

// GET /api/usuarios/:id/permisos
export const getPermisos = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const targetId = Number(req.params.id);

  let findSql = 'SELECT id FROM personas WHERE id = ? AND tipo IS NOT NULL';
  const findParams: (string | number)[] = [targetId];
  if (req.user!.tipo !== 'root') {
    findSql += ' AND empresa_id = ?';
    findParams.push(req.user!.empresaId);
  }

  if (!get(db, findSql, findParams)) {
    res.status(404).json({ error: 'Usuario no encontrado' }); return;
  }

  const permisos = all<PermisoRow>(db, 'SELECT * FROM permisos WHERE usuario_id = ?', [targetId]);

  // Completar módulos faltantes
  const existentes = permisos.map(p => p.modulo);
  const resultado = [...permisos];
  for (const modulo of MODULOS) {
    if (!existentes.includes(modulo)) {
      resultado.push({ id: 0, usuario_id: targetId, modulo, ver: 0, crear: 0, editar: 0, borrar: 0, scope: 'empresa' });
    }
  }

  res.json(resultado);
};

// PUT /api/usuarios/:id/permisos
export const updatePermisos = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const targetId = Number(req.params.id);
  const { permisos } = req.body as { permisos: { modulo: string; ver: number; crear: number; editar: number; borrar: number; scope?: string }[] };

  let findSql = 'SELECT id FROM personas WHERE id = ? AND tipo IS NOT NULL';
  const findParams: (string | number)[] = [targetId];
  if (req.user!.tipo !== 'root') {
    findSql += ' AND empresa_id = ?';
    findParams.push(req.user!.empresaId);
  }

  if (!get(db, findSql, findParams)) {
    res.status(404).json({ error: 'Usuario no encontrado' }); return;
  }

  if (!Array.isArray(permisos)) {
    res.status(400).json({ error: 'Se requiere un array de permisos' }); return;
  }

  for (const p of permisos) {
    if (!MODULOS.includes(p.modulo)) continue;
    const existing = get(db, 'SELECT id FROM permisos WHERE usuario_id = ? AND modulo = ?', [targetId, p.modulo]);
    const scope = p.scope || 'empresa';
    if (existing) {
      run(db, 'UPDATE permisos SET ver=?, crear=?, editar=?, borrar=?, scope=? WHERE usuario_id=? AND modulo=?',
        [p.ver ? 1 : 0, p.crear ? 1 : 0, p.editar ? 1 : 0, p.borrar ? 1 : 0, scope, targetId, p.modulo]);
    } else {
      run(db, 'INSERT INTO permisos (usuario_id, modulo, ver, crear, editar, borrar, scope) VALUES (?,?,?,?,?,?,?)',
        [targetId, p.modulo, p.ver ? 1 : 0, p.crear ? 1 : 0, p.editar ? 1 : 0, p.borrar ? 1 : 0, scope]);
    }
  }

  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'editar', modulo: 'usuarios', entidadId: targetId,
    descripcion: `Actualizó permisos de usuario ID ${targetId}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json(all<PermisoRow>(db, 'SELECT * FROM permisos WHERE usuario_id = ?', [targetId]));
};
