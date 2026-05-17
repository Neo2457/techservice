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

// Lista de campos que la plantilla puede personalizar (espejo de configuración).
// Mantener en un solo lugar evita errores al agregar nuevos toggles a futuro.
const PLANTILLA_CAMPOS = [
  // Toggles base (existentes)
  'ticket_mostrar_logo', 'ticket_mostrar_firma_cliente', 'ticket_mostrar_firma_tecnico',
  'ticket_mostrar_telefono', 'ticket_mostrar_direccion', 'ticket_mostrar_gracias',
  // Toggles granulares nuevos
  'ticket_mostrar_folio', 'ticket_mostrar_cliente_nombre', 'ticket_mostrar_cliente_telefono',
  'ticket_mostrar_dispositivo', 'ticket_mostrar_num_serie', 'ticket_mostrar_falla',
  'ticket_mostrar_observaciones', 'ticket_mostrar_estado', 'ticket_mostrar_garantia',
  'ticket_mostrar_fecha_entrada', 'ticket_mostrar_fecha_salida', 'ticket_mostrar_anticipo',
  'ticket_mostrar_refacciones', 'ticket_mostrar_costo_total', 'ticket_mostrar_restante',
  'ticket_mostrar_ubicacion', 'ticket_mostrar_fecha_emision',
] as const;
const PLANTILLA_TEXTOS = [
  'ticket_politica_garantia', 'ticket_politica_revision', 'ticket_texto_extra',
] as const;

function leerPlantillaPayload(body: any) {
  const toggles: Record<string, number> = {};
  for (const k of PLANTILLA_CAMPOS) {
    // Para 'direccion' el default es 0, para todos los demás es 1
    const def = (k === 'ticket_mostrar_direccion') ? 0 : 1;
    toggles[k] = body[k] ?? def;
  }
  const textos: Record<string, string | null> = {};
  for (const k of PLANTILLA_TEXTOS) textos[k] = body[k] ?? null;
  return {
    toggles, textos,
    ticket_imagen_extra:      body.ticket_imagen_extra ?? null,
    ticket_imagen_extra_size: body.ticket_imagen_extra_size ?? 60,
    ticket_imagen_extra_pos:  body.ticket_imagen_extra_pos ?? 'final',
  };
}

export const createPlantilla = async (req: Request, res: Response): Promise<void> => {
  const { nombre, ticket_titulo } = req.body;
  if (!nombre || !nombre.trim()) {
    res.status(400).json({ error: 'El nombre de la plantilla es requerido' }); return;
  }
  const empresaId = (req.user!.tipo === 'root' && req.body.empresa_id)
    ? Number(req.body.empresa_id) : req.user!.empresaId;

  const p = leerPlantillaPayload(req.body);
  const db = await getDB();

  const colNames = ['nombre', 'empresa_id', 'ticket_titulo',
    ...Object.keys(p.toggles), ...Object.keys(p.textos),
    'ticket_imagen_extra', 'ticket_imagen_extra_size', 'ticket_imagen_extra_pos'];
  const colVals = [nombre.trim(), empresaId, ticket_titulo ?? 'TICKET DE SERVICIO',
    ...Object.values(p.toggles), ...Object.values(p.textos),
    p.ticket_imagen_extra, p.ticket_imagen_extra_size, p.ticket_imagen_extra_pos];

  const result = run(db,
    `INSERT INTO ticket_plantillas (${colNames.join(',')}) VALUES (${colNames.map(()=>'?').join(',')})`,
    colVals);

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

  const { nombre, ticket_titulo } = req.body;
  const p = leerPlantillaPayload(req.body);

  const setCols = ['nombre=?', 'ticket_titulo=?',
    ...Object.keys(p.toggles).map(k => k + '=?'),
    ...Object.keys(p.textos).map(k => k + '=?'),
    'ticket_imagen_extra=?', 'ticket_imagen_extra_size=?', 'ticket_imagen_extra_pos=?',
    "fecha_actualizacion=datetime('now')"];
  const setVals = [nombre, ticket_titulo ?? 'TICKET DE SERVICIO',
    ...Object.values(p.toggles), ...Object.values(p.textos),
    p.ticket_imagen_extra, p.ticket_imagen_extra_size, p.ticket_imagen_extra_pos, id];

  run(db, `UPDATE ticket_plantillas SET ${setCols.join(', ')} WHERE id=?`, setVals);

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
