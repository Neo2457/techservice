// src/controllers/cortesController.ts

import { Request, Response } from 'express';
import { getDB, run, get, all, persistDB } from '../config/db';
import { registrarLog } from '../utils/logger';

// Helper: compute combined totals from both ventas and pagos_servicio
function calcTotales(db: any, localId: number, empresaId: number, desde: string) {
  const v = (get<any>(db, `
    SELECT
      COALESCE(SUM(CASE WHEN pv.metodo='efectivo'      THEN pv.monto ELSE 0 END),0) as total_efectivo,
      COALESCE(SUM(CASE WHEN pv.metodo='tarjeta'       THEN pv.monto ELSE 0 END),0) as total_tarjeta,
      COALESCE(SUM(CASE WHEN pv.metodo='transferencia' THEN pv.monto ELSE 0 END),0) as total_transferencia,
      COALESCE(SUM(CASE WHEN pv.metodo='credito'       THEN pv.monto ELSE 0 END),0) as total_credito,
      COALESCE(SUM(v.total),0) as total_ventas,
      COUNT(DISTINCT v.id) as num_ventas
    FROM ventas v
    JOIN pagos_venta pv ON pv.venta_id = v.id
    WHERE v.local_id=? AND v.empresa_id=?
      AND v.estado='completada' AND v.fecha_finalizacion>=?`,
    [localId, empresaId, desde])) || {};

  const s = (get<any>(db, `
    SELECT
      COALESCE(SUM(CASE WHEN metodo='efectivo'      THEN monto ELSE 0 END),0) as total_efectivo,
      COALESCE(SUM(CASE WHEN metodo='tarjeta'       THEN monto ELSE 0 END),0) as total_tarjeta,
      COALESCE(SUM(CASE WHEN metodo='transferencia' THEN monto ELSE 0 END),0) as total_transferencia,
      COALESCE(SUM(CASE WHEN metodo='credito'       THEN monto ELSE 0 END),0) as total_credito,
      COALESCE(SUM(monto),0) as total_servicios,
      COUNT(*) as num_servicios
    FROM pagos_servicio
    WHERE local_id=? AND empresa_id=? AND fecha>=?`,
    [localId, empresaId, desde])) || {};

  return {
    total_efectivo:      (v.total_efectivo||0) + (s.total_efectivo||0),
    total_tarjeta:       (v.total_tarjeta||0)  + (s.total_tarjeta||0),
    total_transferencia: (v.total_transferencia||0) + (s.total_transferencia||0),
    total_credito:       (v.total_credito||0)  + (s.total_credito||0),
    total_ventas:        (v.total_ventas||0)   + (s.total_servicios||0),
    num_ventas:          v.num_ventas  || 0,
    num_servicios:       s.num_servicios || 0,
  };
}

// POST /api/cortes/apertura — open a new corte (cash drawer)
export const abrirCorte = async (req: Request, res: Response): Promise<void> => {
  const { fondo_apertura = 0 } = req.body;
  const db = await getDB();

  if (!req.user!.localId) {
    res.status(400).json({ error: 'Se requiere un local asignado para abrir un corte' }); return;
  }

  const existing = get(db,
    'SELECT id FROM cortes WHERE estado = ? AND local_id = ? AND empresa_id = ?',
    ['abierto', req.user!.localId, req.user!.empresaId]
  );
  if (existing) {
    res.status(409).json({ error: 'Ya existe un corte abierto en este local' }); return;
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const lastC = get<any>(db,
    'SELECT folio_corte FROM cortes WHERE empresa_id = ? ORDER BY id DESC LIMIT 1',
    [req.user!.empresaId]
  );
  let seq = 1;
  if (lastC?.folio_corte) {
    const parts = lastC.folio_corte.split('-');
    seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
  }
  const folio = `CRT-${today}-${String(seq).padStart(4, '0')}`;

  const result = run(db,
    'INSERT INTO cortes (folio_corte, fondo_apertura, usuario_id, local_id, empresa_id) VALUES (?,?,?,?,?)',
    [folio, Number(fondo_apertura), req.user!.userId, req.user!.localId, req.user!.empresaId]
  );
  persistDB();
  registrarLog({
    db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo,
    usuarioTipo: req.user!.tipo, accion: 'crear', modulo: 'cortes',
    entidadId: Number(result.lastInsertRowid),
    descripcion: `Apertura de caja ${folio} — Fondo: $${fondo_apertura}`,
    ip: req.ip, empresaId: req.user!.empresaId
  });
  res.status(201).json(get(db, 'SELECT * FROM cortes WHERE id = ?', [result.lastInsertRowid]));
};

// GET /api/cortes/activo — get open corte with live totals
export const getCorteActivo = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();

  if (!req.user!.localId) { res.json(null); return; }

  const corte = get<any>(db,
    'SELECT * FROM cortes WHERE estado = ? AND local_id = ? AND empresa_id = ?',
    ['abierto', req.user!.localId, req.user!.empresaId]
  );
  if (!corte) { res.json(null); return; }

  const totals = calcTotales(db, corte.local_id, corte.empresa_id, corte.fecha_apertura);

  res.json({ ...corte, ...totals });
};

// POST /api/cortes/:id/cerrar — close a corte
export const cerrarCorte = async (req: Request, res: Response): Promise<void> => {
  const { efectivo_contado } = req.body;
  const db = await getDB();
  const id = Number(req.params.id);

  const corte = get<any>(db,
    'SELECT * FROM cortes WHERE id = ? AND empresa_id = ?',
    [id, req.user!.empresaId]
  );
  if (!corte) { res.status(404).json({ error: 'Corte no encontrado' }); return; }
  if (corte.estado !== 'abierto') { res.status(400).json({ error: 'El corte ya está cerrado' }); return; }

  const t = calcTotales(db, corte.local_id, corte.empresa_id, corte.fecha_apertura);
  const contado = efectivo_contado !== undefined && efectivo_contado !== null && efectivo_contado !== ''
    ? Number(efectivo_contado) : null;
  const esperado = corte.fondo_apertura + t.total_efectivo;
  const diferencia = contado !== null ? Math.round((contado - esperado) * 100) / 100 : null;

  run(db, `
    UPDATE cortes SET
      estado = 'cerrado',
      total_efectivo = ?, total_tarjeta = ?, total_transferencia = ?, total_credito = ?,
      total_ventas = ?, efectivo_contado = ?, diferencia = ?, fecha_cierre = datetime('now')
    WHERE id = ?`,
    [t.total_efectivo, t.total_tarjeta, t.total_transferencia, t.total_credito,
     t.total_ventas, contado, diferencia, id]
  );
  persistDB();
  registrarLog({
    db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo,
    usuarioTipo: req.user!.tipo, accion: 'editar', modulo: 'cortes',
    entidadId: id,
    descripcion: `Cierre de caja ${corte.folio_corte} — Total ventas: $${t.total_ventas}`,
    ip: req.ip, empresaId: req.user!.empresaId
  });
  res.json(get(db, 'SELECT * FROM cortes WHERE id = ?', [id]));
};

// GET /api/cortes — list (paginated, for report)
export const getCortes = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const { desde, hasta, page = '1', limit = '30' } = req.query;
  const pageNum  = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 30, 100);
  const offset   = (pageNum - 1) * limitNum;

  let where = 'WHERE 1=1';
  const params: (string | number | null)[] = [];

  if (req.user!.tipo !== 'root') {
    where += ' AND c.empresa_id = ?';
    params.push(req.user!.empresaId);
    // Aplicar scope efectivo (propio | local | empresa)
    if (req.user!.tipo === 'empleado') {
      const scope = req.permisoScope || 'local';
      if (scope === 'propio') {
        where += ' AND c.usuario_id = ?';
        params.push(req.user!.userId);
      } else if (scope === 'local' && req.user!.localId) {
        where += ' AND c.local_id = ?';
        params.push(req.user!.localId);
      }
      // scope === 'empresa' → sin filtro adicional, ve todos los de la empresa
    } else if (req.user!.localId) {
      // admin con local asignado: ver solo de su local por defecto
      where += ' AND c.local_id = ?';
      params.push(req.user!.localId);
    }
  }
  if (desde) { where += ' AND c.fecha_apertura >= ?'; params.push(desde as string); }
  if (hasta) { where += ' AND c.fecha_apertura <= ?'; params.push((hasta as string) + ' 23:59:59'); }

  const total = (get<any>(db,
    `SELECT COUNT(*) as total FROM cortes c ${where}`, params) as any)?.total ?? 0;

  const data = all(db, `
    SELECT c.*, l.nombre_local, u.nombre as usuario_nombre
    FROM cortes c
    LEFT JOIN locales  l ON c.local_id  = l.id
    LEFT JOIN personas u ON c.usuario_id = u.id
    ${where} ORDER BY c.fecha_apertura DESC LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );
  res.json({ data, total, page: pageNum });
};

// GET /api/cortes/:id/detalle — full detail: corte + ventas + pagos_servicio during that period
export const getCorteDetalle = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);

  const corte = get<any>(db,
    `SELECT c.*, l.nombre_local, u.nombre as usuario_nombre
     FROM cortes c
     LEFT JOIN locales  l ON c.local_id  = l.id
     LEFT JOIN personas u ON c.usuario_id = u.id
     WHERE c.id = ?`, [id]
  );
  if (!corte) { res.status(404).json({ error: 'Corte no encontrado' }); return; }
  if (req.user!.tipo !== 'root' && corte.empresa_id !== req.user!.empresaId) {
    res.status(403).json({ error: 'Sin acceso' }); return;
  }

  const hasta = corte.fecha_cierre || new Date().toISOString();

  const ventas = all<any>(db,
    `SELECT v.folio_venta, v.total, v.metodo_pago, v.fecha_finalizacion, c.nombre as cliente_nombre
     FROM ventas v LEFT JOIN personas c ON v.cliente_id = c.id
     WHERE v.local_id = ? AND v.empresa_id = ?
       AND v.estado = 'completada'
       AND v.fecha_finalizacion >= ? AND v.fecha_finalizacion <= ?
     ORDER BY v.fecha_finalizacion ASC`,
    [corte.local_id, corte.empresa_id, corte.fecha_apertura, hasta]
  );

  const pagosServicio = all<any>(db,
    `SELECT ps.monto, ps.metodo, ps.concepto, ps.fecha, ps.fuera_caja,
            s.folio as servicio_folio, s.modelo, c.nombre as cliente_nombre
     FROM pagos_servicio ps
     JOIN servicios s ON ps.servicio_id = s.id
     LEFT JOIN personas c ON s.cliente_id = c.id
     WHERE ps.local_id = ? AND ps.empresa_id = ?
       AND ps.fecha >= ? AND ps.fecha <= ?
     ORDER BY ps.fecha ASC`,
    [corte.local_id, corte.empresa_id, corte.fecha_apertura, hasta]
  );

  res.json({ corte, ventas, pagosServicio });
};
