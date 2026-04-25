// src/controllers/authController.ts

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDB, run, get, all, persistDB } from '../config/db';
import { registrarLog } from '../utils/logger';

interface UsuarioRow {
  id: number; nombre: string; correo: string; contrasena: string;
  tipo: string; telefono: string | null; foto: string | null;
  local_id: number | null; empresa_id: number; activo: number;
}

interface PermisoRow {
  modulo: string; ver: number; crear: number; editar: number; borrar: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getUserPermisos(db: any, userId: number, tipo: string) {
  if (tipo === 'root' || tipo === 'admin') {
    // Permisos completos implícitos
    return { servicios: { ver: 1, crear: 1, editar: 1, borrar: 1 },
             clientes: { ver: 1, crear: 1, editar: 1, borrar: 1 },
             personas: { ver: 1, crear: 1, editar: 1, borrar: 1 },
             productos: { ver: 1, crear: 1, editar: 1, borrar: 1 },
             ventas: { ver: 1, crear: 1, editar: 1, borrar: 1 },
             cortes: { ver: 1, crear: 1, editar: 1, borrar: 1 },
             costos: { ver: 1, crear: 1, editar: 1, borrar: 1 },
             descuentos: { ver: 1, crear: 1, editar: 1, borrar: 1 },
             reportes: { ver: 1, crear: 1, editar: 1, borrar: 1 },
             usuarios: { ver: 1, crear: 1, editar: 1, borrar: 1 },
             empresas: { ver: 1, crear: 1, editar: 1, borrar: 1 },
             locales: { ver: 1, crear: 1, editar: 1, borrar: 1 },
             auditoria: { ver: 1, crear: 1, editar: 1, borrar: 1 },
             wa_notificaciones: { ver: 1, crear: 1, editar: 1, borrar: 1 } };
  }
  const rows = all<PermisoRow>(db, 'SELECT modulo, ver, crear, editar, borrar FROM permisos WHERE usuario_id = ?', [userId]);
  const permisos: Record<string, { ver: number; crear: number; editar: number; borrar: number }> = {};
  for (const r of rows) {
    permisos[r.modulo] = { ver: r.ver, crear: r.crear, editar: r.editar, borrar: r.borrar };
  }
  return permisos;
}

export const login = async (req: Request, res: Response): Promise<void> => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) { res.status(400).json({ error: 'Correo y contraseña requeridos' }); return; }

  const db = await getDB();
  const usuario = get<UsuarioRow>(db, 'SELECT * FROM personas WHERE correo = ? AND activo = 1 AND tipo IS NOT NULL', [correo]);

  if (!usuario || !bcrypt.compareSync(contrasena, usuario.contrasena)) {
    // Log failed login attempt
    if (usuario) {
      registrarLog({ db, usuarioId: usuario.id, usuarioNombre: usuario.nombre, usuarioTipo: usuario.tipo,
        accion: 'login_fallido', modulo: 'auth', descripcion: `Intento de login fallido para ${correo}`,
        ip: req.ip, empresaId: usuario.empresa_id });
    }
    res.status(401).json({ error: 'Credenciales incorrectas' }); return;
  }

  const token = jwt.sign(
    { userId: usuario.id, correo: usuario.correo, tipo: usuario.tipo, localId: usuario.local_id, empresaId: usuario.empresa_id },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '24h' }
  );

  // Obtener datos extra para la respuesta
  const empresa = get<{ nombre: string }>(db, 'SELECT nombre FROM empresa WHERE id = ?', [usuario.empresa_id]);
  const local = get<{ nombre_local: string }>(db, 'SELECT nombre_local FROM locales WHERE id = ?', [usuario.local_id]);
  const permisos = getUserPermisos(db, usuario.id, usuario.tipo);

  registrarLog({ db, usuarioId: usuario.id, usuarioNombre: usuario.nombre, usuarioTipo: usuario.tipo,
    accion: 'login', modulo: 'auth', descripcion: `Inicio de sesión exitoso`,
    ip: req.ip, empresaId: usuario.empresa_id });

  const { contrasena: _, ...userData } = usuario;
  res.json({
    token,
    usuario: {
      ...userData,
      empresa_nombre: empresa?.nombre || '',
      local_nombre: local?.nombre_local || '',
    },
    permisos,
  });
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const usuario = get<UsuarioRow>(db,
    'SELECT id, nombre, correo, tipo, telefono, foto, local_id, empresa_id FROM personas WHERE id = ?',
    [req.user!.userId]
  );
  if (!usuario) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

  const empresa = get<{ nombre: string }>(db, 'SELECT nombre FROM empresa WHERE id = ?', [usuario.empresa_id]);
  const local = get<{ nombre_local: string }>(db, 'SELECT nombre_local FROM locales WHERE id = ?', [usuario.local_id]);
  const permisos = getUserPermisos(db, usuario.id, usuario.tipo);

  res.json({
    ...usuario,
    empresa_nombre: empresa?.nombre || '',
    local_nombre: local?.nombre_local || '',
    permisos,
  });
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const { nombre, telefono, foto, correo } = req.body;
  const db = await getDB();

  // Si quiere cambiar correo, verificar unicidad
  if (correo) {
    const existing = get<{ id: number }>(db, 'SELECT id FROM personas WHERE correo = ? AND id != ?', [correo, req.user!.userId]);
    if (existing) {
      res.status(400).json({ error: 'El correo ya está en uso por otro usuario' }); return;
    }
  }

  run(db, 'UPDATE personas SET nombre = ?, telefono = ?, foto = ?, correo = ? WHERE id = ?',
    [nombre, telefono ?? null, foto ?? null, correo ?? req.user!.correo, req.user!.userId]);
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: nombre ?? req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'editar', modulo: 'auth', entidadId: req.user!.userId, descripcion: 'Actualizó su perfil',
    ip: req.ip, empresaId: req.user!.empresaId });
  res.json({ ok: true, message: 'Perfil actualizado' });
};

export const switchLocal = async (req: Request, res: Response): Promise<void> => {
  const { local_id } = req.body;
  if (!local_id) { res.status(400).json({ error: 'local_id es requerido' }); return; }

  const db = await getDB();

  // Verify the local belongs to the user's company (or any company if root)
  let sql = 'SELECT id, nombre_local, empresa_id FROM locales WHERE id = ? AND estatus = ?';
  const params: (string | number)[] = [local_id, 'A'];
  if (req.user!.tipo !== 'root') {
    sql += ' AND empresa_id = ?';
    params.push(req.user!.empresaId);
  }
  const local = get<{ id: number; nombre_local: string; empresa_id: number }>(db, sql, params);
  if (!local) { res.status(400).json({ error: 'Local no encontrado o no pertenece a tu empresa' }); return; }

  // Determine empresaId (for root switching to a different company's local)
  const empresaId = req.user!.tipo === 'root' ? local.empresa_id : req.user!.empresaId;

  // Update user's local_id in the DB
  run(db, 'UPDATE personas SET local_id = ? WHERE id = ?', [local_id, req.user!.userId]);
  persistDB();

  // Generate new JWT with updated localId and empresaId
  const newToken = jwt.sign(
    { userId: req.user!.userId, correo: req.user!.correo, tipo: req.user!.tipo, localId: local_id, empresaId },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '24h' }
  );

  const empresa = get<{ nombre: string }>(db, 'SELECT nombre FROM empresa WHERE id = ?', [empresaId]);

  res.json({
    ok: true,
    token: newToken,
    local_id: local.id,
    local_nombre: local.nombre_local,
    empresa_id: empresaId,
    empresa_nombre: empresa?.nombre || '',
  });
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  const { contrasena_actual, contrasena_nueva } = req.body;
  const db = await getDB();
  const usuario = get<{ contrasena: string }>(db, 'SELECT contrasena FROM personas WHERE id = ?', [req.user!.userId]);

  if (!usuario || !bcrypt.compareSync(contrasena_actual, usuario.contrasena)) {
    res.status(400).json({ error: 'Contraseña actual incorrecta' }); return;
  }
  if (!contrasena_nueva || contrasena_nueva.length < 4) {
    res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres' }); return;
  }

  const hash = bcrypt.hashSync(contrasena_nueva, 10);
  run(db, 'UPDATE personas SET contrasena = ? WHERE id = ?', [hash, req.user!.userId]);
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'cambio_contrasena', modulo: 'auth', entidadId: req.user!.userId, descripcion: 'Cambió su contraseña',
    ip: req.ip, empresaId: req.user!.empresaId });
  res.json({ ok: true, message: 'Contraseña actualizada' });
};
