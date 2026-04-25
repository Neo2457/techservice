// src/controllers/ticketPlantillasController.ts

import { Request, Response } from 'express';
import { getDB, run, get, all, persistDB } from '../config/db';

export const getPlantillas = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = (req.user!.tipo === 'root' && req.query.empresa_id)
    ? Number(req.query.empresa_id) : req.user!.empresaId;
  res.json(all(db, 'SELECT * FROM ticket_plantillas WHERE empresa_id = ? ORDER BY nombre ASC', [empresaId]));
};

export const getPlantillaById = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  let sql = 'SELECT * FROM ticket_plantillas WHERE id = ?';
  const params: (string | number)[] = [Number(req.params.id)];
  if (req.user!.tipo !== 'root') {
    sql += ' AND empresa_id = ?';
    params.push(req.user!.empresaId);
  }
  const p = get(db, sql, params);
  if (!p) { res.status(404).json({ error: 'Plantilla no encontrada' }); return; }
  res.json(p);
};

export const createPlantilla = async (req: Request, res: Response): Promise<void> => {
  const { nombre, ticket_titulo, ticket_mostrar_logo, ticket_mostrar_firma_cliente,
    ticket_mostrar_firma_tecnico, ticket_mostrar_telefono, ticket_mostrar_direccion,
    ticket_mostrar_gracias, ticket_politica_garantia, ticket_politica_revision,
    ticket_texto_extra } = req.body;

  if (!nombre || !nombre.trim()) {
    res.status(400).json({ error: 'El nombre de la plantilla es requerido' }); return;
  }

  const empresaId = (req.user!.tipo === 'root' && req.body.empresa_id)
    ? Number(req.body.empresa_id) : req.user!.empresaId;

  const db = await getDB();
  const result = run(db,
    `INSERT INTO ticket_plantillas (nombre, empresa_id, ticket_titulo, ticket_mostrar_logo,
      ticket_mostrar_firma_cliente, ticket_mostrar_firma_tecnico, ticket_mostrar_telefono,
      ticket_mostrar_direccion, ticket_mostrar_gracias, ticket_politica_garantia,
      ticket_politica_revision, ticket_texto_extra)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [nombre.trim(), empresaId, ticket_titulo ?? 'TICKET DE SERVICIO',
     ticket_mostrar_logo ?? 1, ticket_mostrar_firma_cliente ?? 1,
     ticket_mostrar_firma_tecnico ?? 1, ticket_mostrar_telefono ?? 1,
     ticket_mostrar_direccion ?? 0, ticket_mostrar_gracias ?? 1,
     ticket_politica_garantia ?? null, ticket_politica_revision ?? null,
     ticket_texto_extra ?? null]);

  persistDB();
  res.status(201).json(get(db, 'SELECT * FROM ticket_plantillas WHERE id = ?', [result.lastInsertRowid]));
};

export const updatePlantilla = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);

  let checkSql = 'SELECT id FROM ticket_plantillas WHERE id = ?';
  const checkParams: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') {
    checkSql += ' AND empresa_id = ?';
    checkParams.push(req.user!.empresaId);
  }
  if (!get(db, checkSql, checkParams)) {
    res.status(404).json({ error: 'Plantilla no encontrada' }); return;
  }

  const { nombre, ticket_titulo, ticket_mostrar_logo, ticket_mostrar_firma_cliente,
    ticket_mostrar_firma_tecnico, ticket_mostrar_telefono, ticket_mostrar_direccion,
    ticket_mostrar_gracias, ticket_politica_garantia, ticket_politica_revision,
    ticket_texto_extra } = req.body;

  run(db,
    `UPDATE ticket_plantillas SET nombre=?, ticket_titulo=?, ticket_mostrar_logo=?,
      ticket_mostrar_firma_cliente=?, ticket_mostrar_firma_tecnico=?, ticket_mostrar_telefono=?,
      ticket_mostrar_direccion=?, ticket_mostrar_gracias=?, ticket_politica_garantia=?,
      ticket_politica_revision=?, ticket_texto_extra=?, fecha_actualizacion=datetime('now')
    WHERE id=?`,
    [nombre, ticket_titulo ?? 'TICKET DE SERVICIO',
     ticket_mostrar_logo ?? 1, ticket_mostrar_firma_cliente ?? 1,
     ticket_mostrar_firma_tecnico ?? 1, ticket_mostrar_telefono ?? 1,
     ticket_mostrar_direccion ?? 0, ticket_mostrar_gracias ?? 1,
     ticket_politica_garantia ?? null, ticket_politica_revision ?? null,
     ticket_texto_extra ?? null, id]);

  persistDB();
  res.json(get(db, 'SELECT * FROM ticket_plantillas WHERE id = ?', [id]));
};

export const deletePlantilla = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);

  let sql = 'DELETE FROM ticket_plantillas WHERE id = ?';
  const params: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') {
    sql += ' AND empresa_id = ?';
    params.push(req.user!.empresaId);
  }
  const result = run(db, sql, params);
  if (result.changes === 0) { res.status(404).json({ error: 'Plantilla no encontrada' }); return; }
  persistDB();
  res.json({ ok: true });
};
