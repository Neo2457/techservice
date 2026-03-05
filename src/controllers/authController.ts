// src/controllers/authController.ts

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDB, run, get, persistDB } from '../config/db';

interface UsuarioRow {
  id: number; nombre: string; correo: string; contrasena: string;
  tipo: string; telefono: string | null; foto: string | null;
  local_id: number; empresa_id: number; activo: number;
}

export const login = async (req: Request, res: Response): Promise<void> => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) { res.status(400).json({ error: 'Correo y contraseña requeridos' }); return; }

  const db = await getDB();
  const usuario = get<UsuarioRow>(db, 'SELECT * FROM usuario WHERE correo = ? AND activo = 1', [correo]);

  if (!usuario || !bcrypt.compareSync(contrasena, usuario.contrasena)) {
    res.status(401).json({ error: 'Credenciales incorrectas' }); return;
  }

  const token = jwt.sign(
    { userId: usuario.id, correo: usuario.correo, tipo: usuario.tipo, localId: usuario.local_id, empresaId: usuario.empresa_id },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '24h' }
  );

  const { contrasena: _, ...userData } = usuario;
  res.json({ token, usuario: userData });
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const usuario = get(db, 'SELECT id, nombre, correo, tipo, telefono, foto, local_id, empresa_id FROM usuario WHERE id = ?', [req.user!.userId]);
  if (!usuario) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
  res.json(usuario);
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const { nombre, telefono, foto } = req.body;
  const db = await getDB();
  run(db, 'UPDATE usuario SET nombre = ?, telefono = ?, foto = ? WHERE id = ?', [nombre, telefono ?? null, foto ?? null, req.user!.userId]);
  persistDB();
  res.json({ ok: true, message: 'Perfil actualizado' });
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  const { contrasena_actual, contrasena_nueva } = req.body;
  const db = await getDB();
  const usuario = get<{ contrasena: string }>(db, 'SELECT contrasena FROM usuario WHERE id = ?', [req.user!.userId]);

  if (!usuario || !bcrypt.compareSync(contrasena_actual, usuario.contrasena)) {
    res.status(400).json({ error: 'Contraseña actual incorrecta' }); return;
  }
  if (!contrasena_nueva || contrasena_nueva.length < 4) {
    res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres' }); return;
  }

  const hash = bcrypt.hashSync(contrasena_nueva, 10);
  run(db, 'UPDATE usuario SET contrasena = ? WHERE id = ?', [hash, req.user!.userId]);
  persistDB();
  res.json({ ok: true, message: 'Contraseña actualizada' });
};

