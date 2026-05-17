// src/controllers/serviciosController.ts

import { Request, Response } from 'express';
import { getDB, run, get, all, persistDB } from '../config/db';
import { generarFolio } from '../utils/folio';
import { registrarLog } from '../utils/logger';

export const getServicios = async (req: Request, res: Response): Promise<void> => {
  const { q, estado, garantia, desde, hasta, page = '1', limit = '20', empresa_id, local_id, sort, notif, notif_param } = req.query;
  const db = await getDB();
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  let sql = `SELECT s.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono,
                    e.nombre as empresa_nombre, l.nombre_local as local_nombre
             FROM servicios s LEFT JOIN personas c ON s.cliente_id = c.id
             LEFT JOIN empresa e ON s.empresa_id = e.id
             LEFT JOIN locales l ON s.local_id = l.id
             WHERE 1=1`;
  const params: (string | number | null)[] = [];

  if (req.user!.tipo === 'root') {
    // Root puede filtrar manualmente por empresa/local desde la UI
    if (empresa_id) { sql += ' AND s.empresa_id = ?'; params.push(Number(empresa_id)); }
    if (local_id)   { sql += ' AND s.local_id = ?';   params.push(Number(local_id)); }
  } else {
    // No-root: siempre limitados a su empresa
    sql += ' AND s.empresa_id = ?';
    params.push(req.user!.empresaId);
    // Admin ve TODOS los servicios de la empresa (no se restringe por su localId).
    // Solo empleados se restringen según su scope efectivo.
    if (req.user!.tipo === 'empleado') {
      const scope = req.permisoScope || 'local';
      if (scope === 'propio') {
        sql += ' AND s.usuario_id = ?';
        params.push(req.user!.userId);
      } else if (scope === 'local' && req.user!.localId) {
        sql += ' AND s.local_id = ?';
        params.push(req.user!.localId);
      }
    }
  }

  if (q) { sql += ` AND (s.folio LIKE ? OR c.nombre LIKE ? OR s.modelo LIKE ? OR s.falla LIKE ?)`; const l = `%${q}%`; params.push(l,l,l,l); }
  if (estado) { sql += ' AND s.estado = ?'; params.push(estado as string); }
  
  if (notif === 'servicio_estado' && notif_param) {
    const cfgRow = get<any>(db, 'SELECT notificaciones_config FROM configuracion WHERE empresa_id = ?', [req.user!.empresaId]);
    let horas = 0;
    if (cfgRow?.notificaciones_config) {
      try {
        const conf = JSON.parse(cfgRow.notificaciones_config);
        horas = conf.estados_alerta?.[notif_param as string]?.horas ?? 0;
      } catch(e) {}
    }
    if (horas > 0) {
      // Forzamos que coincida el estado y el límite de horas
      sql += " AND s.estado = ? AND datetime(COALESCE(s.fecha_estado, s.fecha_actualizacion)) <= datetime('now', ?)";
      params.push(notif_param as string, `-${horas} hours`);
    } else {
      // Si no hay horas configuradas, al menos filtramos por el estado
      sql += " AND s.estado = ?";
      params.push(notif_param as string);
    }
  }

  if (garantia) { sql += ' AND s.garantia = ?'; params.push(garantia as string); }
  if (desde) { sql += ' AND s.fecha_entrada >= ?'; params.push(desde as string); }
  if (hasta) { sql += ' AND s.fecha_entrada <= ?'; params.push(hasta as string); }

  const total = (get<{ total: number }>(db, sql.replace('SELECT s.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono', 'SELECT COUNT(*) as total'), params) as { total: number })?.total ?? 0;

  const srvSortMap: Record<string, string> = {
    folio_asc: 's.folio ASC', folio_desc: 's.folio DESC',
    nombre_asc: 'c.nombre ASC', nombre_desc: 'c.nombre DESC',
    modelo_asc: 's.modelo ASC', modelo_desc: 's.modelo DESC',
    estado_asc: 's.estado ASC', estado_desc: 's.estado DESC',
    fecha_entrada_asc: 's.fecha_entrada ASC', fecha_entrada_desc: 's.fecha_entrada DESC',
    costo_total_asc: 's.costo_total ASC', costo_total_desc: 's.costo_total DESC',
    anticipo_asc: 's.anticipo ASC', anticipo_desc: 's.anticipo DESC',
    fecha_salida_asc: 's.fecha_salida ASC', fecha_salida_desc: 's.fecha_salida DESC',
    falla_asc: 's.falla ASC', falla_desc: 's.falla DESC',
    garantia_asc: 's.garantia ASC', garantia_desc: 's.garantia DESC',
  };
  const orderBy = srvSortMap[sort as string] ?? 's.fecha_entrada DESC';
  // Tiebreaker por id DESC: cuando hay empate de fecha (común en datos migrados),
  // el registro más recientemente ingresado al sistema queda arriba.
  sql += ` ORDER BY ${orderBy}, s.id DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit as string), offset);

  res.json({ data: all(db, sql, params), total, page: parseInt(page as string) });
};

export const getServicioById = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  let sql = `SELECT s.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono,
    c.correo as cliente_correo, c.direccion as cliente_direccion
    FROM servicios s LEFT JOIN personas c ON s.cliente_id = c.id
    WHERE s.id = ?`;
  const params: (string | number)[] = [Number(req.params.id)];
  if (req.user!.tipo !== 'root') {
    // Restricción por empresa. Para empleados aplicamos también scope local/propio.
    sql += ' AND s.empresa_id = ?';
    params.push(req.user!.empresaId);
    if (req.user!.tipo === 'empleado') {
      const scope = req.permisoScope || 'local';
      if (scope === 'propio') {
        sql += ' AND s.usuario_id = ?';
        params.push(req.user!.userId);
      } else if (scope === 'local' && req.user!.localId) {
        sql += ' AND s.local_id = ?';
        params.push(req.user!.localId);
      }
    }
  }
  const s = get(db, sql, params);
  if (!s) { res.status(404).json({ error: 'Servicio no encontrado' }); return; }
  res.json(s);
};

export const createServicio = async (req: Request, res: Response): Promise<void> => {
  const { cliente_id, modelo, num_serie, falla, descripcion, observaciones,
    imagen, garantia, estado, fecha_entrada, fecha_salida,
    anticipo, costo_refaccion, costo_total, local_id } = req.body;
  const { userId, localId, empresaId, tipo } = req.user!;

  if (!cliente_id || !modelo || !falla) {
    res.status(400).json({ error: 'cliente_id, modelo y falla son requeridos' }); return;
  }

  // Admin/Root can choose local; empleados always use their own
  const effectiveLocalId = (tipo === 'root' || tipo === 'admin') ? (local_id || localId) : localId;

  const db = await getDB();
  if (!get(db, 'SELECT id FROM personas WHERE id = ? AND empresa_id = ?', [cliente_id, empresaId])) {
    res.status(400).json({ error: 'Cliente no encontrado' }); return;
  }

  const result = run(db, `INSERT INTO servicios
    (folio, cliente_id, modelo, num_serie, falla, descripcion, observaciones, imagen,
     garantia, estado, fecha_entrada, fecha_salida, anticipo, costo_refaccion, costo_total,
     usuario_id, local_id, empresa_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ['TEMP', cliente_id, modelo, num_serie ?? null, falla, descripcion ?? null,
     observaciones ?? null, imagen ?? null, garantia ?? 'Sin garantia',
     estado ?? 'Recibido', fecha_entrada ?? new Date().toISOString(),
     fecha_salida ?? null, anticipo ?? 0, costo_refaccion ?? 0, costo_total ?? 0,
     userId, effectiveLocalId, empresaId]);

  const newId = result.lastInsertRowid;
  const folio = generarFolio(db, empresaId);
  run(db, 'UPDATE servicios SET folio = ? WHERE id = ?', [folio, newId]);

  // Si hay anticipo, registrar como pago (con flag fuera_caja si no hay corte abierto)
  if (anticipo && Number(anticipo) > 0) {
    const corteAbierto = get(db,
      'SELECT id FROM cortes WHERE estado = ? AND local_id = ? AND empresa_id = ?',
      ['abierto', effectiveLocalId, empresaId]
    );
    run(db,
      `INSERT INTO pagos_servicio (servicio_id, monto, metodo, concepto, usuario_id, local_id, empresa_id, fuera_caja)
       VALUES (?,?,?,?,?,?,?,?)`,
      [Number(newId), Number(anticipo), 'efectivo', 'anticipo',
       userId, effectiveLocalId, empresaId, corteAbierto ? 0 : 1]
    );
  }

  persistDB();
  registrarLog({ db, usuarioId: userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'crear', modulo: 'servicios', entidadId: Number(newId),
    descripcion: `Creó servicio folio ${folio} - ${modelo}`, ip: req.ip, empresaId: empresaId });

  res.status(201).json(get(db, `SELECT s.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono FROM servicios s
    LEFT JOIN personas c ON s.cliente_id = c.id WHERE s.id = ?`, [newId]));
};

export const updateServicio = async (req: Request, res: Response): Promise<void> => {
  const { cliente_id, modelo, num_serie, falla, descripcion, observaciones,
    imagen, garantia, estado, fecha_entrada, fecha_salida,
    anticipo, costo_refaccion, costo_total, local_id } = req.body;
  const { tipo, localId } = req.user!;
  const db = await getDB();
  const id = Number(req.params.id);

  // Root puede editar servicios de cualquier empresa; los demás solo dentro de la suya.
  let findSql = 'SELECT id, local_id, estado FROM servicios WHERE id = ?';
  const findParams: (string | number)[] = [id];
  if (tipo !== 'root') { findSql += ' AND empresa_id = ?'; findParams.push(req.user!.empresaId); }
  const existing = get<{ id: number; local_id: number; estado: string }>(db, findSql, findParams);
  if (!existing) {
    res.status(404).json({ error: 'Servicio no encontrado' }); return;
  }

  // Admin/Root can change local; empleados keep the original
  const effectiveLocalId = (tipo === 'root' || tipo === 'admin') ? (local_id || existing.local_id) : (localId || existing.local_id);

  // Reset fecha_estado when state changes
  const estadoCambia = estado && estado !== existing.estado;

  run(db, `UPDATE servicios SET cliente_id=?, modelo=?, num_serie=?, falla=?, descripcion=?,
    observaciones=?, imagen=?, garantia=?, estado=?, fecha_entrada=?, fecha_salida=?,
    anticipo=?, costo_refaccion=?, costo_total=?, local_id=?,
    fecha_actualizacion=datetime('now'),
    fecha_estado = CASE WHEN ? THEN datetime('now') ELSE fecha_estado END
    WHERE id=?`,
    [cliente_id, modelo, num_serie ?? null, falla, descripcion ?? null, observaciones ?? null,
     imagen ?? null, garantia ?? 'Sin garantia', estado ?? 'Recibido',
     fecha_entrada, fecha_salida ?? null, anticipo ?? 0, costo_refaccion ?? 0,
     costo_total ?? 0, effectiveLocalId, estadoCambia ? 1 : 0, id]);
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'editar', modulo: 'servicios', entidadId: id,
    descripcion: `Editó servicio ID ${id} - ${modelo} (estado: ${estado ?? 'Recibido'})`, ip: req.ip, empresaId: req.user!.empresaId });

  res.json(get(db, 'SELECT s.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono FROM servicios s LEFT JOIN personas c ON s.cliente_id = c.id WHERE s.id = ?', [Number(req.params.id)]));
};

export const deleteServicio = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  let sql = 'DELETE FROM servicios WHERE id = ?';
  const params: (string | number)[] = [Number(req.params.id)];
  if (req.user!.tipo !== 'root') {
    sql += ' AND empresa_id = ?';
    params.push(req.user!.empresaId);
  }
  const result = run(db, sql, params);
  if (result.changes === 0) { res.status(404).json({ error: 'Servicio no encontrado' }); return; }
  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'borrar', modulo: 'servicios', entidadId: Number(req.params.id),
    descripcion: `Eliminó servicio ID ${req.params.id}`, ip: req.ip, empresaId: req.user!.empresaId });
  res.json({ ok: true });
};

export const getReporte = async (req: Request, res: Response): Promise<void> => {
  const { desde, hasta, estado, empresa_id, local_id } = req.query;
  const db = await getDB();

  let sql = `SELECT s.*, c.nombre as cliente_nombre, e.nombre as empresa_nombre,
             (s.costo_total - s.costo_refaccion) as utilidad
             FROM servicios s LEFT JOIN personas c ON s.cliente_id = c.id
             LEFT JOIN empresa e ON s.empresa_id = e.id
             WHERE 1=1`;
  const params: (string | number | null)[] = [];

  if (req.user!.tipo === 'root') {
    if (empresa_id) { sql += ' AND s.empresa_id = ?'; params.push(Number(empresa_id)); }
    if (local_id)   { sql += ' AND s.local_id = ?';   params.push(Number(local_id)); }
  } else {
    // Admin ve todos los servicios de su empresa; solo empleados se restringen por scope.
    sql += ' AND s.empresa_id = ?';
    params.push(req.user!.empresaId);
    if (req.user!.tipo === 'empleado') {
      const scope = req.permisoScope || 'local';
      if (scope === 'propio') {
        sql += ' AND s.usuario_id = ?';
        params.push(req.user!.userId);
      } else if (scope === 'local' && req.user!.localId) {
        sql += ' AND s.local_id = ?';
        params.push(req.user!.localId);
      }
    }
  }

  if (desde) { sql += ' AND s.fecha_entrada >= ?'; params.push(desde as string); }
  if (hasta) { sql += ' AND s.fecha_entrada <= ?'; params.push(hasta as string); }
  if (estado) { sql += ' AND s.estado = ?'; params.push(estado as string); }
  sql += ' ORDER BY s.fecha_entrada ASC';

  const servicios = all<Record<string, unknown>>(db, sql, params);
  const resumen = {
    total_servicios: servicios.length,
    ingresos_totales: servicios.reduce((a, s) => a + (Number(s.costo_total) || 0), 0),
    costo_refacciones: servicios.reduce((a, s) => a + (Number(s.costo_refaccion) || 0), 0),
    utilidad_neta: servicios.reduce((a, s) => a + (Number(s.utilidad) || 0), 0),
  };
  res.json({ resumen, servicios });
};

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const { empresa_id, local_id, usuario_id } = req.query;
  const { tipo, empresaId, userId } = req.user!;

  // ── Scoping helpers ──────────────────────────────────────────────
  // Resolve effective empresa
  const effEmpresa = (tipo === 'root' && empresa_id) ? Number(empresa_id) : empresaId;

  // Build WHERE for servicios (flat table, no alias)
  const buildServiciosWhere = () => {
    const conds: string[] = [];
    const p: (string | number)[] = [];
    if (tipo === 'root') {
      if (empresa_id) { conds.push('empresa_id = ?'); p.push(Number(empresa_id)); }
      if (local_id)   { conds.push('local_id = ?');   p.push(Number(local_id)); }
    } else {
      conds.push('empresa_id = ?'); p.push(empresaId);
      if (tipo === 'empleado') { conds.push('usuario_id = ?'); p.push(userId); }
      else if (local_id)       { conds.push('local_id = ?');   p.push(Number(local_id)); }
    }
    if (usuario_id && tipo !== 'empleado') { conds.push('usuario_id = ?'); p.push(Number(usuario_id)); }
    return { clause: conds.length ? 'WHERE ' + conds.join(' AND ') : '', params: p };
  };

  // Build WHERE for ventas (flat table)
  const buildVentasWhere = (extraConds: string[] = []) => {
    const conds: string[] = ["estado = 'completada'", ...extraConds];
    const p: (string | number)[] = [];
    if (tipo === 'root') {
      if (empresa_id) { conds.push('empresa_id = ?'); p.push(Number(empresa_id)); }
      if (local_id)   { conds.push('local_id = ?');   p.push(Number(local_id)); }
    } else {
      conds.push('empresa_id = ?'); p.push(empresaId);
      if (tipo === 'empleado') { conds.push('usuario_id = ?'); p.push(userId); }
      else if (local_id)       { conds.push('local_id = ?');   p.push(Number(local_id)); }
    }
    if (usuario_id && tipo !== 'empleado') { conds.push('usuario_id = ?'); p.push(Number(usuario_id)); }
    return { clause: 'WHERE ' + conds.join(' AND '), params: p };
  };

  const sw = buildServiciosWhere();
  const vw = buildVentasWhere();

  // ── Service stats ────────────────────────────────────────────────
  const stats = get<any>(db, `
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(costo_total), 0) as ingresos_totales,
      COUNT(CASE WHEN strftime('%Y-%m', fecha_entrada) = strftime('%Y-%m', 'now') THEN 1 END) as total_mes,
      COALESCE(SUM(CASE WHEN strftime('%Y-%m', fecha_entrada) = strftime('%Y-%m', 'now') THEN costo_total ELSE 0 END), 0) as ingresos_mes,
      COUNT(CASE WHEN strftime('%Y-%m', fecha_entrada) = strftime('%Y-%m', date('now','-1 month')) THEN 1 END) as total_mes_ant,
      COALESCE(SUM(CASE WHEN strftime('%Y-%m', fecha_entrada) = strftime('%Y-%m', date('now','-1 month')) THEN costo_total ELSE 0 END), 0) as ingresos_mes_ant,
      COUNT(CASE WHEN estado NOT IN ('Entregado','Finalizado','Cancelado') THEN 1 END) as activos,
      COUNT(CASE WHEN estado = 'Entregado' AND date(fecha_salida) = date('now') THEN 1 END) as entregados_hoy,
      COUNT(CASE WHEN estado = 'Entregado' THEN 1 END) as entregados,
      COUNT(CASE WHEN estado = 'Listo' THEN 1 END) as listos,
      COUNT(CASE WHEN estado IN ('Recibido','Diagnóstico','En proceso','Esperando refacción') THEN 1 END) as en_proceso,
      COUNT(CASE WHEN estado = 'Cancelado' THEN 1 END) as cancelados,
      COUNT(CASE WHEN estado = 'Finalizado' THEN 1 END) as finalizados
    FROM servicios ${sw.clause}`, sw.params);

  // Ventas all-estado WHERE (for credit count + all-time totals)
  const buildVentasAllWhere = () => {
    const conds: string[] = [];
    const p: (string | number)[] = [];
    if (tipo === 'root') {
      if (empresa_id) { conds.push('empresa_id = ?'); p.push(Number(empresa_id)); }
      if (local_id)   { conds.push('local_id = ?');   p.push(Number(local_id)); }
    } else {
      conds.push('empresa_id = ?'); p.push(empresaId);
      if (tipo === 'empleado') { conds.push('usuario_id = ?'); p.push(userId); }
      else if (local_id)       { conds.push('local_id = ?');   p.push(Number(local_id)); }
    }
    if (usuario_id && tipo !== 'empleado') { conds.push('usuario_id = ?'); p.push(Number(usuario_id)); }
    return { clause: conds.length ? 'WHERE ' + conds.join(' AND ') : '', params: p };
  };
  const vwAll = buildVentasAllWhere();

  // ── Ventas stats ─────────────────────────────────────────────────
  const ventasStats = get<any>(db, `
    SELECT
      COUNT(CASE WHEN estado='completada' AND date(fecha_finalizacion) = date('now') THEN 1 END) as ventas_hoy,
      COALESCE(SUM(CASE WHEN estado='completada' AND date(fecha_finalizacion) = date('now') THEN total ELSE 0 END), 0) as ingresos_hoy,
      COUNT(CASE WHEN estado='completada' AND strftime('%Y-%m', fecha_finalizacion) = strftime('%Y-%m', 'now') THEN 1 END) as ventas_mes,
      COALESCE(SUM(CASE WHEN estado='completada' AND strftime('%Y-%m', fecha_finalizacion) = strftime('%Y-%m', 'now') THEN total ELSE 0 END), 0) as ingresos_ventas_mes,
      COUNT(CASE WHEN estado='completada' AND strftime('%Y-%m', fecha_finalizacion) = strftime('%Y-%m', date('now','-1 month')) THEN 1 END) as ventas_mes_ant,
      COALESCE(SUM(CASE WHEN estado='completada' AND strftime('%Y-%m', fecha_finalizacion) = strftime('%Y-%m', date('now','-1 month')) THEN total ELSE 0 END), 0) as ingresos_ventas_mes_ant,
      COUNT(CASE WHEN estado='completada' THEN 1 END) as ventas_total,
      COUNT(CASE WHEN estado = 'credito_pendiente' THEN 1 END) as creditos_activos
    FROM ventas ${vwAll.clause}`, vwAll.params);

  // ── Monthly series (last 12 months) ──────────────────────────────
  const porMes = all(db, `
    SELECT strftime('%m', fecha_entrada) as mes, strftime('%Y', fecha_entrada) as anio,
           COUNT(*) as cantidad, COALESCE(SUM(costo_total),0) as ingresos
    FROM servicios ${sw.clause} ${sw.clause ? 'AND' : 'WHERE'} fecha_entrada >= date('now','-12 months')
    GROUP BY anio, mes ORDER BY anio, mes`, sw.params);

  const ventasPorMes = all(db, `
    SELECT strftime('%m', fecha_finalizacion) as mes, strftime('%Y', fecha_finalizacion) as anio,
           COUNT(*) as cantidad, COALESCE(SUM(total),0) as ingresos
    FROM ventas ${vw.clause} AND fecha_finalizacion >= date('now','-12 months')
    GROUP BY anio, mes ORDER BY anio, mes`, vw.params);

  // Build aliased WHERE for JOIN queries (prefix each column ref with table alias)
  const aliasWhere = (clause: string, alias: string) =>
    clause.replace(/WHERE\s+/g, `WHERE ${alias}.`).replace(/\s+AND\s+/g, ` AND ${alias}.`);

  // ── Recent items ─────────────────────────────────────────────────
  const recientes = all(db, `
    SELECT s.id, s.folio, s.modelo, s.estado, s.costo_total, s.fecha_entrada,
           c.nombre as cliente_nombre, u.nombre as tecnico_nombre, l.nombre_local
    FROM servicios s
    LEFT JOIN personas c ON s.cliente_id = c.id
    LEFT JOIN personas u ON s.usuario_id = u.id
    LEFT JOIN locales  l ON s.local_id   = l.id
    ${aliasWhere(sw.clause, 's')} ORDER BY s.fecha_creacion DESC LIMIT 6`,
    sw.params);

  const recientesVentas = all(db, `
    SELECT v.id, v.folio_venta, v.total, v.metodo_pago, v.fecha_finalizacion,
           c.nombre as cliente_nombre, u.nombre as vendedor_nombre
    FROM ventas v
    LEFT JOIN personas c ON v.cliente_id = c.id
    LEFT JOIN personas u ON v.usuario_id = u.id
    ${aliasWhere(vw.clause, 'v')} ORDER BY v.fecha_finalizacion DESC LIMIT 6`,
    vw.params);

  // ── Top products this month ──────────────────────────────────────
  // Build alias-prefixed conditions manually (aliasWhere breaks on strftime() calls)
  const topConds: string[] = [
    "v.estado = 'completada'",
    "strftime('%Y-%m', v.fecha_finalizacion) = strftime('%Y-%m', 'now')",
  ];
  const topParams: (string | number)[] = [];
  if (tipo === 'root') {
    if (empresa_id) { topConds.push('v.empresa_id = ?'); topParams.push(Number(empresa_id)); }
    if (local_id)   { topConds.push('v.local_id = ?');   topParams.push(Number(local_id)); }
  } else {
    topConds.push('v.empresa_id = ?'); topParams.push(empresaId);
    if (tipo === 'empleado') { topConds.push('v.usuario_id = ?'); topParams.push(userId); }
    else if (local_id)       { topConds.push('v.local_id = ?');   topParams.push(Number(local_id)); }
  }
  if (usuario_id && tipo !== 'empleado') { topConds.push('v.usuario_id = ?'); topParams.push(Number(usuario_id)); }

  const topProductos = all(db, `
    SELECT p.id, p.nombre, p.codigo,
           COALESCE(SUM(vd.cantidad),0) as unidades,
           COALESCE(SUM(vd.subtotal),0) as ingreso
    FROM ventas_detalle vd
    JOIN productos p ON vd.producto_id = p.id
    JOIN ventas v ON vd.venta_id = v.id
    WHERE ${topConds.join(' AND ')}
    GROUP BY p.id ORDER BY unidades DESC LIMIT 5`, topParams);

  // ── Por local (admin/root, general view only) ────────────────────
  let porLocal: any[] = [];
  if (tipo !== 'empleado' && !usuario_id) {
    porLocal = all(db, `
      SELECT l.id, l.nombre_local,
        (SELECT COUNT(*) FROM servicios WHERE local_id=l.id AND empresa_id=?) as total_servicios,
        (SELECT COALESCE(SUM(costo_total),0) FROM servicios WHERE local_id=l.id AND empresa_id=?) as ing_servicios,
        (SELECT COUNT(*) FROM servicios WHERE local_id=l.id AND empresa_id=? AND estado NOT IN ('Entregado','Finalizado','Cancelado')) as activos,
        (SELECT COUNT(*) FROM ventas WHERE local_id=l.id AND empresa_id=? AND estado='completada' AND strftime('%Y-%m',fecha_finalizacion)=strftime('%Y-%m','now')) as ventas_mes,
        (SELECT COALESCE(SUM(total),0) FROM ventas WHERE local_id=l.id AND empresa_id=? AND estado='completada' AND strftime('%Y-%m',fecha_finalizacion)=strftime('%Y-%m','now')) as ing_ventas_mes
      FROM locales l WHERE l.empresa_id = ?`,
      [effEmpresa, effEmpresa, effEmpresa, effEmpresa, effEmpresa, effEmpresa]);
  }

  // ── Por empleado (admin/root) ─────────────────────────────────────
  let porEmpleado: any[] = [];
  if (tipo !== 'empleado') {
    porEmpleado = all(db, `
      SELECT u.id, u.nombre, u.correo, l.nombre_local,
        COUNT(DISTINCT s.id) as total_servicios,
        COALESCE(SUM(s.costo_total),0) as ing_servicios,
        (SELECT COUNT(*) FROM servicios WHERE usuario_id=u.id AND empresa_id=u.empresa_id AND estado NOT IN ('Entregado','Finalizado','Cancelado')) as activos,
        (SELECT COUNT(*) FROM ventas WHERE usuario_id=u.id AND empresa_id=u.empresa_id AND estado='completada' AND strftime('%Y-%m',fecha_finalizacion)=strftime('%Y-%m','now')) as ventas_mes,
        (SELECT COALESCE(SUM(total),0) FROM ventas WHERE usuario_id=u.id AND empresa_id=u.empresa_id AND estado='completada' AND strftime('%Y-%m',fecha_finalizacion)=strftime('%Y-%m','now')) as ing_ventas_mes
      FROM personas u
      LEFT JOIN servicios s ON s.usuario_id = u.id AND s.empresa_id = u.empresa_id
      LEFT JOIN locales l ON u.local_id = l.id
      WHERE u.empresa_id = ? AND u.tipo = 'empleado'
      GROUP BY u.id ORDER BY total_servicios DESC`,
      [effEmpresa]);
  }

  res.json({
    // creditos_activos viene de ventasStats que YA respeta el scope del usuario
    // (empleado ve solo sus créditos; admin/root ve los de la empresa).
    stats: { ...stats, ...ventasStats, creditos_activos: ventasStats?.creditos_activos ?? 0 },
    porMes,
    ventasPorMes,
    recientes,
    recientesVentas,
    topProductos,
    porLocal,
    porEmpleado,
  });
};

// POST /api/servicios/:id/cobrar — register a cash-register payment for a service
export const cobrarServicio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { monto, metodo = 'efectivo', concepto = 'saldo', descripcion, costo_refaccion } = req.body;
    const db = await getDB();
    const id = Number(req.params.id);

    if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) {
      res.status(400).json({ error: 'Monto inválido' }); return;
    }

    let findSql = 'SELECT id FROM servicios WHERE id = ?';
    const findParams: (string | number)[] = [id];
    if (req.user!.tipo !== 'root') {
      findSql += ' AND empresa_id = ?';
      findParams.push(req.user!.empresaId);
    }
    const servicio = get(db, findSql, findParams);
    if (!servicio) { res.status(404).json({ error: 'Servicio no encontrado' }); return; }

    const localId = req.user!.localId ?? 0;

    const result = run(db,
      `INSERT INTO pagos_servicio (servicio_id, monto, metodo, concepto, descripcion, usuario_id, local_id, empresa_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [id, Number(monto), metodo, concepto, descripcion || null,
       req.user!.userId, localId, req.user!.empresaId]
    );

    // Sync anticipo on the service with the total of all payments
    run(db,
      'UPDATE servicios SET anticipo = (SELECT COALESCE(SUM(monto),0) FROM pagos_servicio WHERE servicio_id = ?) WHERE id = ?',
      [id, id]
    );
    // Update costo_refaccion if provided (internal cost — not charged to client)
    if (costo_refaccion !== undefined && costo_refaccion !== null && !isNaN(Number(costo_refaccion))) {
      run(db, 'UPDATE servicios SET costo_refaccion = ? WHERE id = ?', [Number(costo_refaccion), id]);
    }

    persistDB();
    registrarLog({
      db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo,
      usuarioTipo: req.user!.tipo, accion: 'crear', modulo: 'servicios',
      entidadId: id,
      descripcion: `Cobro servicio ID ${id}: $${Number(monto).toFixed(2)} (${concepto} - ${metodo})${descripcion ? ' — ' + descripcion : ''}`,
      ip: req.ip, empresaId: req.user!.empresaId
    });

    res.status(201).json(get(db, 'SELECT * FROM pagos_servicio WHERE id = ?', [result.lastInsertRowid]));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Error al registrar cobro' });
  }
};

// GET /api/servicios/pagos — all pagos_servicio filtered by date range (for report)
export const getPagosServicioReporte = async (req: Request, res: Response): Promise<void> => {
  try {
    const { desde, hasta, empresa_id, local_id } = req.query;
    const db = await getDB();

    let sql = `SELECT ps.*, s.folio as servicio_folio, s.modelo, s.falla,
               c.nombre as cliente_nombre, u.nombre as usuario_nombre
               FROM pagos_servicio ps
               JOIN servicios s ON ps.servicio_id = s.id
               LEFT JOIN personas c ON s.cliente_id = c.id
               LEFT JOIN personas u ON ps.usuario_id = u.id
               WHERE 1=1`;
    const params: (string | number | null)[] = [];

    if (req.user!.tipo !== 'root') {
      // Admin ve todos los pagos de su empresa; solo empleados se restringen por scope.
      sql += ' AND ps.empresa_id = ?';
      params.push(req.user!.empresaId);
      if (req.user!.tipo === 'empleado') {
        const scope = req.permisoScope || 'local';
        if (scope === 'propio') {
          sql += ' AND ps.usuario_id = ?';
          params.push(req.user!.userId);
        } else if (scope === 'local' && req.user!.localId) {
          sql += ' AND ps.local_id = ?';
          params.push(req.user!.localId);
        }
      }
    } else {
      if (empresa_id) { sql += ' AND ps.empresa_id = ?'; params.push(Number(empresa_id)); }
      if (local_id)   { sql += ' AND ps.local_id = ?';   params.push(Number(local_id)); }
    }

    if (desde) { sql += ' AND ps.fecha >= ?'; params.push(desde as string); }
    if (hasta) { sql += ' AND ps.fecha <= ?'; params.push((hasta as string) + ' 23:59:59'); }

    sql += ' ORDER BY ps.fecha DESC';

    const pagos = all<any>(db, sql, params);
    const resumen = {
      total_cobros: pagos.length,
      total_monto: pagos.reduce((s: number, p: any) => s + (Number(p.monto) || 0), 0),
      total_efectivo: pagos.filter((p: any) => p.metodo === 'efectivo').reduce((s: number, p: any) => s + Number(p.monto), 0),
      total_tarjeta: pagos.filter((p: any) => p.metodo === 'tarjeta').reduce((s: number, p: any) => s + Number(p.monto), 0),
      total_transferencia: pagos.filter((p: any) => p.metodo === 'transferencia').reduce((s: number, p: any) => s + Number(p.monto), 0),
    };
    res.json({ resumen, pagos });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Error al obtener cobros' });
  }
};

// GET /api/servicios/:id/pagos — list payments for a service
export const getPagosServicio = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    const id = Number(req.params.id);

    let findSql = 'SELECT id FROM servicios WHERE id = ?';
    const findParams: (string | number)[] = [id];
    if (req.user!.tipo !== 'root') {
      findSql += ' AND empresa_id = ?';
      findParams.push(req.user!.empresaId);
    }
    if (!get(db, findSql, findParams)) {
      res.status(404).json({ error: 'Servicio no encontrado' }); return;
    }

    const pagos = all(db,
      `SELECT ps.*, u.nombre as usuario_nombre
       FROM pagos_servicio ps
       LEFT JOIN personas u ON ps.usuario_id = u.id
       WHERE ps.servicio_id = ?
       ORDER BY ps.fecha ASC`,
      [id]
    );
    res.json(pagos);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Error al obtener cobros' });
  }
};

