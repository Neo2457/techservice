// src/controllers/ventasController.ts

import { Request, Response } from 'express';
import { getDB, run, get, all, persistDB } from '../config/db';
import { registrarLog } from '../utils/logger';

// POST /api/ventas — create a new sale
// If metodo_pago = 'credito' (single, non-split): sale is PENDING (no stock reduction)
// All other payment methods: sale is completed immediately
export const createVenta = async (req: Request, res: Response): Promise<void> => {
  const {
    items, cliente_id,
    metodo_pago = 'efectivo',
    split = false,
    pagos = []
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Se requieren productos en la venta' }); return;
  }

  if (!req.user!.localId) {
    res.status(400).json({ error: 'Tu usuario no tiene un local asignado. Ve a Usuarios, edita tu perfil y asigna un local.' }); return;
  }

  const db = await getDB();

  // Validate and price items
  let subtotalBruto = 0;
  const itemsOk: any[] = [];
  for (const item of items) {
    const prod = get<any>(db,
      'SELECT * FROM productos WHERE id = ? AND empresa_id = ?',
      [Number(item.producto_id), req.user!.empresaId]
    );
    if (!prod) {
      res.status(400).json({ error: `Producto ID ${item.producto_id} no encontrado` }); return;
    }
    const precio = Number(item.precio_unitario) >= 0 ? Number(item.precio_unitario) : prod.venta;
    const cant  = Math.max(1, Math.floor(Number(item.cantidad) || 1));
    const sub   = Math.round(precio * cant * 100) / 100;
    subtotalBruto += sub;
    itemsOk.push({ producto_id: Number(item.producto_id), precio, cant, sub });
  }

  const total = Math.round(subtotalBruto * 100) / 100;

  // Generate folio VTA-YYYYMMDD-NNNN
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const lastV = get<any>(db,
    'SELECT folio_venta FROM ventas WHERE empresa_id = ? ORDER BY id DESC LIMIT 1',
    [req.user!.empresaId]
  );
  let seq = 1;
  if (lastV?.folio_venta) {
    const parts = lastV.folio_venta.split('-');
    seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
  }
  const folio = `VTA-${today}-${String(seq).padStart(4, '0')}`;

  // Determine if this is a pending credit sale (full credito, no split)
  const esCreditoPendiente = !split && metodo_pago === 'credito';
  const estado = esCreditoPendiente ? 'credito_pendiente' : 'completada';

  const metodoPrincipal = split ? 'mixto' : metodo_pago;

  const result = run(db,
    `INSERT INTO ventas (folio_venta, subtotal, descuento, total, metodo_pago,
       estado, fecha_finalizacion, cliente_id, usuario_id, local_id, empresa_id)
     VALUES (?,?,?,?,?,?,${esCreditoPendiente ? 'NULL' : "datetime('now')"},?,?,?,?)`,
    [folio, total, 0, total, metodoPrincipal, estado,
     cliente_id || null, req.user!.userId, req.user!.localId, req.user!.empresaId]
  );
  const ventaId = Number(result.lastInsertRowid);

  // Insert detalle items
  for (const item of itemsOk) {
    run(db,
      `INSERT INTO ventas_detalle
         (venta_id, producto_id, cantidad, precio_unitario, descuento_item, subtotal)
       VALUES (?,?,?,?,?,?)`,
      [ventaId, item.producto_id, item.cant, item.precio, 0, item.sub]
    );
  }

  // Reduce stock only for completed (non-pending) sales
  if (!esCreditoPendiente) {
    for (const item of itemsOk) {
      run(db, 'UPDATE productos SET existencia = MAX(0, existencia - ?) WHERE id = ?',
        [item.cant, item.producto_id]);
    }
  }

  // Insert payment records in pagos_venta
  if (split && Array.isArray(pagos) && pagos.length > 0) {
    for (const p of pagos) {
      run(db, 'INSERT INTO pagos_venta (venta_id, metodo, monto) VALUES (?,?,?)',
        [ventaId, p.metodo, Number(p.monto)]);
    }
  } else {
    run(db, 'INSERT INTO pagos_venta (venta_id, metodo, monto) VALUES (?,?,?)',
      [ventaId, metodo_pago, total]);
  }

  persistDB();
  registrarLog({
    db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo,
    usuarioTipo: req.user!.tipo, accion: 'crear', modulo: 'ventas',
    entidadId: ventaId,
    descripcion: `${esCreditoPendiente ? '[CRÉDITO PENDIENTE] ' : ''}Venta ${folio} — Total: $${total}`,
    ip: req.ip, empresaId: req.user!.empresaId
  });

  res.status(201).json(get(db, 'SELECT * FROM ventas WHERE id = ?', [ventaId]));
};

// POST /api/ventas/:id/finalizar — finalize a pending credit sale
// Reduces stock + marks as completed + updates payment method to actual received
export const finalizarVenta = async (req: Request, res: Response): Promise<void> => {
  const { metodo_pago_final = 'efectivo' } = req.body;
  const db = await getDB();
  const id = Number(req.params.id);

  let sql = `SELECT v.* FROM ventas v WHERE v.id = ? AND v.estado = 'credito_pendiente'`;
  const params: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') { sql += ' AND v.empresa_id = ?'; params.push(req.user!.empresaId); }

  const venta = get<any>(db, sql, params);
  if (!venta) {
    res.status(404).json({ error: 'Venta de crédito pendiente no encontrada' }); return;
  }

  // Reduce stock
  const items = all(db, 'SELECT * FROM ventas_detalle WHERE venta_id = ?', [id]) as any[];
  for (const item of items) {
    run(db, 'UPDATE productos SET existencia = MAX(0, existencia - ?) WHERE id = ?',
      [item.cantidad, item.producto_id]);
  }

  // Update venta: mark completed, record finalization time + actual payment method
  run(db,
    `UPDATE ventas SET estado = 'completada', metodo_pago = ?, fecha_finalizacion = datetime('now') WHERE id = ?`,
    [metodo_pago_final, id]
  );

  // Update pagos_venta: change 'credito' entry to actual method
  run(db, `UPDATE pagos_venta SET metodo = ? WHERE venta_id = ? AND metodo = 'credito'`,
    [metodo_pago_final, id]);

  persistDB();
  registrarLog({
    db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo,
    usuarioTipo: req.user!.tipo, accion: 'editar', modulo: 'ventas',
    entidadId: id,
    descripcion: `Crédito finalizado: ${venta.folio_venta} — Método: ${metodo_pago_final} — Total: $${venta.total}`,
    ip: req.ip, empresaId: req.user!.empresaId
  });

  res.json(get(db, 'SELECT * FROM ventas WHERE id = ?', [id]));
};

// GET /api/ventas — list with pagination, supports ?estado=, ?metodo_pago=, ?buscar= filters
export const getVentas = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const { desde, hasta, estado, metodo_pago, buscar, page = '1', limit = '30' } = req.query;
  const pageNum  = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 30, 100);
  const offset   = (pageNum - 1) * limitNum;

  let where = 'WHERE 1=1';
  const params: (string | number | null)[] = [];

  if (req.user!.tipo !== 'root') {
    where += ' AND v.empresa_id = ?';
    params.push(req.user!.empresaId);
    if (req.user!.tipo === 'empleado') {
      const scope = req.permisoScope || 'empresa';
      if (scope === 'propio') {
        where += ' AND v.usuario_id = ?';
        params.push(req.user!.userId);
      } else if (scope === 'local' && req.user!.localId) {
        where += ' AND v.local_id = ?';
        params.push(req.user!.localId);
      }
    }
  }
  if (estado) { where += ' AND v.estado = ?'; params.push(estado as string); }
  else { where += " AND v.estado = 'completada'"; }
  if (metodo_pago) { where += ' AND v.metodo_pago = ?'; params.push(metodo_pago as string); }
  if (desde) { where += ' AND COALESCE(v.fecha_finalizacion, v.fecha) >= ?'; params.push(desde as string); }
  if (hasta) { where += ' AND COALESCE(v.fecha_finalizacion, v.fecha) <= ?'; params.push((hasta as string) + ' 23:59:59'); }
  if (buscar) {
    where += ' AND (v.folio_venta LIKE ? OR c.nombre LIKE ?)';
    params.push(`%${buscar}%`, `%${buscar}%`);
  }

  const baseQuery = `FROM ventas v LEFT JOIN personas c ON v.cliente_id = c.id LEFT JOIN personas u ON v.usuario_id = u.id ${where}`;

  const total = (get<any>(db, `SELECT COUNT(*) as total ${baseQuery}`, params) as any)?.total ?? 0;

  const statsRow = get<any>(db,
    `SELECT COALESCE(SUM(v.total),0) as total_monto,
            COALESCE(AVG(v.total),0) as avg_monto
     FROM ventas v LEFT JOIN personas c ON v.cliente_id = c.id
     ${where}`, params
  );
  const itemsRow = get<any>(db,
    `SELECT COALESCE(SUM(vd.cantidad),0) as total_items
     FROM ventas_detalle vd
     JOIN ventas v ON vd.venta_id = v.id
     LEFT JOIN personas c ON v.cliente_id = c.id
     ${where}`, params
  );
  const stats = {
    total_monto: statsRow?.total_monto ?? 0,
    avg_monto:   statsRow?.avg_monto   ?? 0,
    total_items: itemsRow?.total_items ?? 0,
  };

  const data = all(db,
    `SELECT v.*, c.nombre as cliente_nombre, u.nombre as usuario_nombre
     ${baseQuery} ORDER BY v.fecha DESC LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  res.json({ data, total, page: pageNum, stats });
};

// GET /api/ventas/:id — detail with items and payments
export const getVentaById = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);

  let sql = `SELECT v.*, c.nombre as cliente_nombre, u.nombre as usuario_nombre
             FROM ventas v
             LEFT JOIN personas c ON v.cliente_id = c.id
             LEFT JOIN personas u ON v.usuario_id = u.id
             WHERE v.id = ?`;
  const params: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') { sql += ' AND v.empresa_id = ?'; params.push(req.user!.empresaId); }

  const venta = get<any>(db, sql, params);
  if (!venta) { res.status(404).json({ error: 'Venta no encontrada' }); return; }

  const detalle = all(db,
    `SELECT vd.*, p.nombre as producto_nombre, p.codigo
     FROM ventas_detalle vd JOIN productos p ON vd.producto_id = p.id
     WHERE vd.venta_id = ?`, [id]);

  const pagos = all(db, 'SELECT * FROM pagos_venta WHERE venta_id = ?', [id]);

  res.json({ ...venta, items: detalle, pagos });
};
