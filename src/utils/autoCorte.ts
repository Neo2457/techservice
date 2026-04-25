// src/utils/autoCorte.ts
// Automatic cash register cut at configured time

import { getDB, get, all, run, persistDB } from '../config/db';
import { registrarLog } from './logger';

export async function checkAutoCortes(): Promise<void> {
  try {
    const db = await getDB();
    const now = new Date();

    // Get all empresas with auto-corte enabled
    const configs = all<{ empresa_id: number; corte_hora: string }>(
      db,
      "SELECT empresa_id, corte_hora FROM configuracion WHERE corte_automatico = 1"
    );

    for (const cfg of configs) {
      const [hh, mm] = (cfg.corte_hora || '22:00').split(':').map(Number);

      // Build today's cut datetime in local time
      const cutTime = new Date();
      cutTime.setHours(hh, mm, 0, 0);

      // Only process if we're past cut time
      if (now < cutTime) continue;

      // Find all open cortes for this empresa that opened before the cut time
      const openCortes = all<{
        id: number; folio_corte: string;
        local_id: number; empresa_id: number; fecha_apertura: string;
      }>(
        db,
        "SELECT id, folio_corte, local_id, empresa_id, fecha_apertura FROM cortes WHERE estado = 'abierto' AND empresa_id = ?",
        [cfg.empresa_id]
      );

      let closed = 0;
      for (const corte of openCortes) {
        // Parse fecha_apertura — SQLite stores UTC without 'Z', add it for correct parsing
        const aperturaStr = corte.fecha_apertura.includes('T')
          ? corte.fecha_apertura
          : corte.fecha_apertura.replace(' ', 'T') + 'Z';
        const apertura = new Date(aperturaStr);

        // Skip cortes that opened after the cut time (e.g. opened at 23:00, cut at 22:00)
        if (apertura >= cutTime) continue;

        // Calculate totals for this corte
        const totals = get<any>(db, `
          SELECT
            COALESCE(SUM(CASE WHEN pv.metodo = 'efectivo'      THEN pv.monto ELSE 0 END), 0) as total_efectivo,
            COALESCE(SUM(CASE WHEN pv.metodo = 'tarjeta'       THEN pv.monto ELSE 0 END), 0) as total_tarjeta,
            COALESCE(SUM(CASE WHEN pv.metodo = 'transferencia' THEN pv.monto ELSE 0 END), 0) as total_transferencia,
            COALESCE(SUM(CASE WHEN pv.metodo = 'credito'       THEN pv.monto ELSE 0 END), 0) as total_credito,
            COALESCE(SUM(v.total), 0) as total_ventas
          FROM ventas v
          JOIN pagos_venta pv ON pv.venta_id = v.id
          WHERE v.local_id = ? AND v.empresa_id = ?
            AND v.estado = 'completada'
            AND v.fecha_finalizacion >= ?`,
          [corte.local_id, corte.empresa_id, corte.fecha_apertura]
        );

        const t = totals || {
          total_efectivo: 0, total_tarjeta: 0,
          total_transferencia: 0, total_credito: 0, total_ventas: 0,
        };

        run(db, `
          UPDATE cortes SET
            estado = 'cerrado',
            total_efectivo = ?, total_tarjeta = ?, total_transferencia = ?, total_credito = ?,
            total_ventas = ?, fecha_cierre = datetime('now')
          WHERE id = ?`,
          [t.total_efectivo, t.total_tarjeta, t.total_transferencia,
           t.total_credito, t.total_ventas, corte.id]
        );

        registrarLog({
          db,
          usuarioId: null,
          usuarioNombre: 'Sistema',
          usuarioTipo: 'sistema',
          accion: 'editar',
          modulo: 'cortes',
          entidadId: corte.id,
          descripcion: `Cierre automático ${corte.folio_corte} (${cfg.corte_hora}) — Total: $${t.total_ventas}`,
          ip: '::1',
          empresaId: cfg.empresa_id,
        });

        console.log(`[AutoCorte] Cerró automáticamente: ${corte.folio_corte} (empresa ${cfg.empresa_id})`);
        closed++;
      }

      if (closed > 0) persistDB();
    }
  } catch (e) {
    console.error('[AutoCorte] Error en corte automático:', e);
  }
}

/** Start the scheduler — checks every minute */
export function startAutoCorteScheduler(): void {
  // Run immediately on startup (catches overdue cortes after a restart)
  checkAutoCortes();
  setInterval(checkAutoCortes, 60 * 1000);
  console.log('  ⏰  Corte automático de caja activo (verificación cada minuto)');
}
