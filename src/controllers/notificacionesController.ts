// src/controllers/notificacionesController.ts

import { Request, Response } from 'express';
import { getDB, run, get, all, persistDB } from '../config/db';

const ESTADOS_ACTIVOS = ['Recibido', 'Diagnóstico', 'En proceso', 'Esperando refacción', 'Listo'];

// GET /api/notificaciones — returns active alerts for the authenticated user
export const getNotificaciones = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const { empresaId, localId, tipo, userId } = req.user!;

  const configRow = get<{ notificaciones_config: string | null }>(
    db, 'SELECT notificaciones_config FROM configuracion WHERE empresa_id = ?', [empresaId]
  );

  if (!configRow?.notificaciones_config) {
    res.json({ notifs: [], total: 0 }); return;
  }

  let cfg: any = {};
  try { cfg = JSON.parse(configRow.notificaciones_config); } catch(e) {}

  const notifs: any[] = [];

  // === 1. Service-state SLA alerts (all roles) ===
  const estadosAlerta: Record<string, { activo: boolean; horas: number }> = cfg.estados_alerta || {};
  for (const estado of ESTADOS_ACTIVOS) {
    const ec = estadosAlerta[estado];
    if (!ec?.activo) continue;
    const horas = ec.horas || 24;
    const timeFilter = `-${horas} hours`;

    let sql = `
      SELECT s.id, s.folio, s.modelo, s.estado, s.fecha_estado, s.fecha_actualizacion,
             c.nombre as cliente, u.nombre as tecnico
      FROM servicios s
      LEFT JOIN personas c ON s.cliente_id = c.id
      LEFT JOIN personas u ON s.usuario_id = u.id
      WHERE s.estado = ? AND s.empresa_id = ?
        AND datetime(COALESCE(s.fecha_estado, s.fecha_actualizacion)) <= datetime('now', ?)`;
    const params: any[] = [estado, empresaId, timeFilter];

    if (tipo === 'empleado') {
      if (localId) { sql += ' AND s.local_id = ?'; params.push(localId); }
      else         { sql += ' AND s.usuario_id = ?'; params.push(userId); }
    }
    sql += ' ORDER BY s.fecha_estado ASC LIMIT 20';

    const overdue = all(db, sql, params) as any[];
    if (overdue.length > 0) {
      notifs.push({
        id: `estado_${estado.replace(/[^a-zA-Z0-9]/g, '_')}`,
        tipo: 'servicio_estado',
        estado,
        horas,
        urgencia: overdue.length >= 5 ? 'alta' : 'media',
        titulo: `${overdue.length} servicio${overdue.length > 1 ? 's' : ''} en "${estado}"`,
        detalle: `Sin cambio por más de ${horas >= 24 ? (Math.floor(horas / 24) + ' día' + (horas >= 48 ? 's' : '')) : (horas + ' h')}`,
        count: overdue.length,
        items: overdue.slice(0, 5),
      });
    }
  }

  // === 2. Low stock (admin/root) ===
  if ((tipo === 'root' || tipo === 'admin') && cfg.stock_bajo?.activo) {
    const umbral = cfg.stock_bajo.umbral ?? 5;
    const lowStock = all(db,
      'SELECT id, nombre, codigo, existencia FROM productos WHERE empresa_id = ? AND existencia <= ? ORDER BY existencia ASC LIMIT 10',
      [empresaId, umbral]
    ) as any[];
    if (lowStock.length > 0) {
      const sinExistencia = lowStock.filter((p: any) => p.existencia === 0).length;
      notifs.push({
        id: 'stock_bajo',
        tipo: 'stock_bajo',
        urgencia: sinExistencia > 0 ? 'alta' : 'media',
        titulo: `${lowStock.length} producto${lowStock.length > 1 ? 's' : ''} con stock bajo`,
        detalle: sinExistencia > 0 ? `${sinExistencia} sin existencia` : `Todos ≤ ${umbral} unidades`,
        count: lowStock.length,
        items: lowStock,
      });
    }
  }

  // === 3. Overdue credits (admin/root) ===
  if ((tipo === 'root' || tipo === 'admin') && cfg.creditos_vencidos?.activo) {
    const dias = cfg.creditos_vencidos.dias ?? 7;
    const overdue = all(db,
      `SELECT v.id, v.folio_venta, v.total, v.fecha, c.nombre as cliente
       FROM ventas v LEFT JOIN personas c ON v.cliente_id = c.id
       WHERE v.empresa_id = ? AND v.estado = 'credito_pendiente'
         AND julianday('now') - julianday(v.fecha) > ?
       ORDER BY v.fecha ASC LIMIT 10`,
      [empresaId, dias]
    ) as any[];
    if (overdue.length > 0) {
      const total = overdue.reduce((s: number, v: any) => s + (v.total || 0), 0);
      notifs.push({
        id: 'credito_vencido',
        tipo: 'credito_vencido',
        urgencia: 'alta',
        titulo: `${overdue.length} crédito${overdue.length > 1 ? 's' : ''} vencido${overdue.length > 1 ? 's' : ''}`,
        detalle: `Sin cobrar más de ${dias} días — Total: $${total.toFixed(2)}`,
        count: overdue.length,
        items: overdue,
      });
    }
  }

  // === 4. All pending payments (admin/root only) ===
  if ((tipo === 'root' || tipo === 'admin') && cfg.pagos_pendientes?.activo) {
    const all_pending = all(db,
      `SELECT v.id, v.folio_venta, v.total, v.fecha, c.nombre as cliente
       FROM ventas v LEFT JOIN personas c ON v.cliente_id = c.id
       WHERE v.empresa_id = ? AND v.estado = 'credito_pendiente'
       ORDER BY v.total DESC LIMIT 10`,
      [empresaId]
    ) as any[];
    if (all_pending.length > 0) {
      const totalPend = all_pending.reduce((s: number, v: any) => s + (v.total || 0), 0);
      notifs.push({
        id: 'pago_pendiente',
        tipo: 'pago_pendiente',
        urgencia: all_pending.length >= 5 ? 'alta' : 'baja',
        titulo: `${all_pending.length} cobro${all_pending.length > 1 ? 's' : ''} pendiente${all_pending.length > 1 ? 's' : ''}`,
        detalle: `Total por cobrar: $${totalPend.toFixed(2)}`,
        count: all_pending.length,
        items: all_pending,
      });
    }
  }

  // === 5. No open corte today (employees with local + admins) ===
  if (cfg.corte_sin_apertura?.activo && (localId || tipo === 'admin' || tipo === 'root')) {
    const hora = cfg.corte_sin_apertura.hora || '10:00';
    const [hh, mm] = hora.split(':').map(Number);
    const now = new Date();
    const cutTime = new Date();
    cutTime.setHours(hh, mm, 0, 0);
    if (now >= cutTime) {
      const whereLocal = localId ? ' AND local_id = ?' : '';
      const localParam = localId ? [localId] : [];
      const row = get<{ c: number }>(db,
        `SELECT COUNT(*) as c FROM cortes WHERE empresa_id = ? AND estado = 'abierto'${whereLocal}`,
        [empresaId, ...localParam]
      );
      if (!row || row.c === 0) {
        notifs.push({
          id: 'corte_sin_apertura',
          tipo: 'corte_sin_apertura',
          urgencia: 'media',
          titulo: 'Caja sin abrir',
          detalle: `Se esperaba apertura a las ${hora}`,
          count: 1,
          items: [],
        });
      }
    }
  }

  // === 6. Employees without activity (root only) ===
  if (tipo === 'root' && cfg.empleados_sin_actividad?.activo) {
    const dias = cfg.empleados_sin_actividad.dias ?? 3;
    const inactivos = all(db,
      `SELECT u.id, u.nombre, u.correo, MAX(s.fecha_actualizacion) as ultimo_servicio
       FROM personas u
       LEFT JOIN servicios s ON s.usuario_id = u.id AND s.empresa_id = u.empresa_id
       WHERE u.empresa_id = ? AND u.tipo = 'empleado' AND u.activo = 1
       GROUP BY u.id
       HAVING ultimo_servicio IS NULL
          OR julianday('now') - julianday(ultimo_servicio) > ?
       LIMIT 10`,
      [empresaId, dias]
    ) as any[];
    if (inactivos.length > 0) {
      notifs.push({
        id: 'empleados_sin_actividad',
        tipo: 'empleados_sin_actividad',
        urgencia: 'baja',
        titulo: `${inactivos.length} empleado${inactivos.length > 1 ? 's' : ''} sin actividad`,
        detalle: `Sin registrar servicios por más de ${dias} días`,
        count: inactivos.length,
        items: inactivos,
      });
    }
  }

  res.json({ notifs, total: notifs.length });
};

// PUT /api/configuracion/notificaciones — save notificaciones_config
export const updateNotificacionesConfig = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = req.user!.empresaId;
  const { notificaciones_config } = req.body;

  let config = get(db, 'SELECT id FROM configuracion WHERE empresa_id = ?', [empresaId]);
  if (!config) { run(db, 'INSERT INTO configuracion (empresa_id) VALUES (?)', [empresaId]); }

  run(db, 'UPDATE configuracion SET notificaciones_config = ? WHERE empresa_id = ?',
    [notificaciones_config
      ? (typeof notificaciones_config === 'string' ? notificaciones_config : JSON.stringify(notificaciones_config))
      : null,
    empresaId]);
  persistDB();
  res.json({ ok: true });
};
