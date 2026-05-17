/**
 * scripts/import-incremental.ts
 *
 * Importa INCREMENTALMENTE registros nuevos desde un dump de MariaDB viejo
 * a la BD SQLite actual de TechService Pro.
 *
 * Diferencia con migrate-from-mariadb.ts:
 *   - NO borra nada
 *   - Solo importa servicios y ventas con fecha >= --desde (default 2026-05-01)
 *   - Para productos: actualiza existencia si el código coincide; agrega los nuevos.
 *   - Deduplica clientes por (nombre+telefono).
 *   - Deduplica servicios por (cliente+fecha+modelo).
 *   - Deduplica ventas por (fecha+total+local).
 *
 * Uso:
 *   npx ts-node scripts/import-incremental.ts <ruta-al-dump.sql> [--desde=YYYY-MM-DD] [--dry-run]
 *
 * Ejemplo:
 *   npx ts-node scripts/import-incremental.ts /app/import.sql --desde=2026-05-01
 *
 * Importante: el servidor TechService debe estar DETENIDO durante la corrida,
 * porque sql.js carga la BD en memoria y al persistir sobrescribiría cambios.
 */

import fs from 'fs';
import { getDB, run, get, all, persistDB } from '../src/config/db';
import { initDB } from '../src/config/initDB';

// ───────────────────────────────────────────────────────────────────────────
//  Parser SQL (reusado del script de migración completa)
// ───────────────────────────────────────────────────────────────────────────

type SqlValue = string | number | null;

function parseInserts(sql: string, tableName: string): SqlValue[][] {
  const result: SqlValue[][] = [];
  const re = new RegExp(
    `INSERT INTO \`${tableName}\`\\s*\\([^)]+\\)\\s*VALUES\\s*([\\s\\S]*?);\\s*$`,
    'gm',
  );
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    result.push(...parseValueRows(match[1]));
  }
  return result;
}

function parseValueRows(block: string): SqlValue[][] {
  const rows: SqlValue[][] = [];
  let i = 0;
  const n = block.length;
  while (i < n) {
    while (i < n && /[\s,]/.test(block[i])) i++;
    if (i >= n) break;
    if (block[i] !== '(') break;
    i++;
    const row: SqlValue[] = [];
    while (i < n) {
      while (i < n && /\s/.test(block[i])) i++;
      if (block[i] === ')') { i++; break; }
      const [val, next] = parseOneValue(block, i);
      row.push(val);
      i = next;
      while (i < n && /\s/.test(block[i])) i++;
      if (block[i] === ',') i++;
      else if (block[i] === ')') { i++; break; }
    }
    rows.push(row);
  }
  return rows;
}

function parseOneValue(s: string, start: number): [SqlValue, number] {
  let i = start;
  const c = s[i];
  if (c === "'") {
    i++;
    let val = '';
    while (i < s.length) {
      const ch = s[i];
      if (ch === '\\' && i + 1 < s.length) {
        const nxt = s[i + 1];
        if (nxt === 'n') val += '\n';
        else if (nxt === 'r') val += '\r';
        else if (nxt === 't') val += '\t';
        else if (nxt === '0') val += '\0';
        else val += nxt;
        i += 2;
      } else if (ch === "'") {
        if (s[i + 1] === "'") { val += "'"; i += 2; }
        else { i++; return [val, i]; }
      } else { val += ch; i++; }
    }
    return [val, i];
  }
  if (s.substr(i, 4).toUpperCase() === 'NULL') return [null, i + 4];
  const numMatch = s.substr(i).match(/^-?\d+(\.\d+)?/);
  if (numMatch) return [parseFloat(numMatch[0]), i + numMatch[0].length];
  let val = '';
  while (i < s.length && s[i] !== ',' && s[i] !== ')') { val += s[i]; i++; }
  return [val.trim() || null, i];
}

// ───────────────────────────────────────────────────────────────────────────
//  Helpers
// ───────────────────────────────────────────────────────────────────────────

function normalizePhone(p: string | null): string {
  if (!p) return '';
  return String(p).replace(/[^0-9]/g, '');
}

function normalizeName(n: string | null): string {
  if (!n) return '';
  return String(n).trim().toLowerCase().replace(/\s+/g, ' ');
}

function fechaIso(raw: string | null): string {
  if (!raw || raw === '0000-00-00 00:00:00' || raw === '0000-00-00') {
    return new Date().toISOString().substring(0, 19).replace('T', ' ');
  }
  return String(raw);
}

function ddmmaaFromFecha(fecha: string): string {
  const d = new Date(fecha.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '010100';
  return String(d.getDate()).padStart(2, '0') +
         String(d.getMonth() + 1).padStart(2, '0') +
         String(d.getFullYear()).substring(2);
}

// ───────────────────────────────────────────────────────────────────────────
//  Main
// ───────────────────────────────────────────────────────────────────────────

interface Args {
  dumpPath: string;
  desde: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Uso: npx ts-node scripts/import-incremental.ts <dump.sql> [--desde=YYYY-MM-DD] [--dry-run]');
    process.exit(1);
  }
  const dumpPath = args[0];
  let desde = '2026-05-01';
  let dryRun = false;
  for (const a of args.slice(1)) {
    if (a.startsWith('--desde=')) desde = a.substring(8);
    else if (a === '--dry-run') dryRun = true;
  }
  return { dumpPath, desde, dryRun };
}

async function main() {
  const { dumpPath, desde, dryRun } = parseArgs();
  if (!fs.existsSync(dumpPath)) {
    console.error(`❌ No existe: ${dumpPath}`);
    process.exit(1);
  }
  console.log(`📂 Dump:   ${dumpPath}`);
  console.log(`📅 Desde:  ${desde}`);
  console.log(`🔧 Modo:   ${dryRun ? 'DRY-RUN (no escribe nada)' : 'APLICAR cambios'}`);
  console.log('');

  console.log('🔧 Abriendo BD destino...');
  await initDB();
  const db = await getDB();
  db.run('PRAGMA foreign_keys = OFF');

  const sql = fs.readFileSync(dumpPath, 'utf-8');

  // ─── Parse ────────────────────────────────────────────────────────────
  const allClientes = parseInserts(sql, 'clientes');       // = servicios viejos
  const allProductos = parseInserts(sql, 'productos');
  const allVentas = parseInserts(sql, 'ventas');
  const allProductosVentas = parseInserts(sql, 'productos_ventas');

  // ─── Filtrar por fecha ────────────────────────────────────────────────
  const serviciosNuevos = allClientes.filter(r => {
    const fecha = String(r[13] || '');
    return fecha >= desde;
  });
  const ventasNuevas = allVentas.filter(r => {
    const fecha = String(r[1] || '');
    return fecha >= desde;
  });
  const ventaIdsNuevas = new Set(ventasNuevas.map(r => Number(r[0])));
  const detalleNuevos = allProductosVentas.filter(r => ventaIdsNuevas.has(Number(r[4])));

  console.log(`📊 En dump (filtrado >= ${desde}):`);
  console.log(`   - ${serviciosNuevos.length} servicios candidatos`);
  console.log(`   - ${allProductos.length} productos (todos, para reconciliar)`);
  console.log(`   - ${ventasNuevas.length} ventas candidatas`);
  console.log(`   - ${detalleNuevos.length} detalles de venta`);
  console.log('');

  // ─── Obtener empresa default ─────────────────────────────────────────
  const empresaActual = get<{ id: number; iniciales: string }>(db,
    'SELECT id, iniciales FROM empresa LIMIT 1');
  if (!empresaActual) {
    console.error('❌ No hay empresa en la BD destino. Crea una primero.');
    process.exit(1);
  }
  console.log(`🏢 Empresa destino: id=${empresaActual.id} (${empresaActual.iniciales})`);

  // Fallback usuario_id si el del dump no existe
  const fallbackUsuario = get<{ id: number }>(db,
    "SELECT id FROM personas WHERE tipo IN ('root','admin') ORDER BY (tipo='root') DESC, id ASC LIMIT 1");
  if (!fallbackUsuario) {
    console.error('❌ No hay usuarios root/admin en la BD destino.');
    process.exit(1);
  }
  console.log(`👤 Usuario fallback: id=${fallbackUsuario.id}`);
  console.log('');

  let stats = {
    personasCreadas: 0,
    personasReusadas: 0,
    serviciosInsertados: 0,
    serviciosOmitidos: 0,
    productosInsertados: 0,
    productosActualizados: 0,
    productosSinCambio: 0,
    ventasInsertadas: 0,
    ventasOmitidas: 0,
    detalleInsertados: 0,
    detalleOmitidos: 0,
  };

  // Mapa idDump (clientes viejos) → personaId real (para servicios)
  // Mapa idDump (productos viejos) → productoId real (para detalle de ventas)
  const productoIdMap = new Map<number, number>();

  // ─── 1) Personas + Servicios ─────────────────────────────────────────
  console.log('═══ 1/3  Importando servicios + clientes nuevos ═══');
  for (const r of serviciosNuevos) {
    const [_oldId, imagen, nombre, telefono, correo, direccion, descripcion, falla,
           numSerie, observaciones, pago, costo, pieza, fecha, fechaEntrega,
           estado, garantia, anuncioEstado, local, usuario, empresa] = r;

    if (!nombre) continue;
    const empresaId = Number(empresa) || empresaActual.id;
    const localId = Number(local) || 1;
    const fechaServ = fechaIso(fecha as string);
    const modelo = (descripcion as string) || (falla as string) || 'Sin modelo';

    // PERSONA — buscar por telefono normalizado, si no por nombre+empresa
    const telNorm = normalizePhone(telefono as string);
    const nomNorm = normalizeName(nombre as string);
    let personaId: number | null = null;
    if (telNorm) {
      const found = get<{ id: number }>(db,
        `SELECT id FROM personas
         WHERE REPLACE(REPLACE(REPLACE(REPLACE(telefono,'-',''),' ',''),'(',''),')','') = ?
           AND empresa_id = ?
         ORDER BY id ASC LIMIT 1`,
        [telNorm, empresaId]);
      if (found) personaId = found.id;
    }
    if (!personaId) {
      const found = get<{ id: number }>(db,
        `SELECT id FROM personas WHERE LOWER(TRIM(nombre)) = ? AND empresa_id = ? LIMIT 1`,
        [nomNorm, empresaId]);
      if (found) personaId = found.id;
    }
    if (personaId) {
      stats.personasReusadas++;
    } else {
      if (!dryRun) {
        const resIns = run(db,
          `INSERT INTO personas (nombre, correo, telefono, direccion, tipo,
             empresa_id, local_id, tipo_cliente, roles, activo)
           VALUES (?,?,?,?,NULL,?,?,?,?,1)`,
          [nombre as string, (correo as string) || null, (telefono as string) || null,
           (direccion as string) || null, empresaId, localId, 'regular', 'cliente']);
        personaId = Number(resIns.lastInsertRowid);
      } else {
        personaId = -1; // dry-run
      }
      stats.personasCreadas++;
    }

    // SERVICIO — dedup por (cliente_id + fecha + modelo)
    const dup = get<{ id: number }>(db,
      `SELECT id FROM servicios WHERE cliente_id = ? AND fecha_entrada = ? AND modelo = ? LIMIT 1`,
      [personaId, fechaServ, modelo]);
    if (dup) {
      stats.serviciosOmitidos++;
      continue;
    }

    // Folio único basado en fecha + secuencial
    const cntEmp = get<{ n: number }>(db,
      `SELECT COUNT(*) as n FROM servicios WHERE empresa_id = ?`, [empresaId]);
    const seq = (cntEmp?.n || 0) + 1 + stats.serviciosInsertados;
    const empInfo = get<{ iniciales: string }>(db, `SELECT iniciales FROM empresa WHERE id=?`, [empresaId]);
    const ini = empInfo?.iniciales || empresaActual.iniciales || 'TS';
    const folio = `${ini}${ddmmaaFromFecha(fechaServ)}${String(seq).padStart(5, '0')}`;

    // Usuario fallback si el del dump no existe
    let usuarioId = Number(usuario) || fallbackUsuario.id;
    if (!get(db, 'SELECT id FROM personas WHERE id=?', [usuarioId])) usuarioId = fallbackUsuario.id;

    if (!dryRun) {
      run(db,
        `INSERT INTO servicios (folio, cliente_id, modelo, num_serie, falla,
           descripcion, observaciones, imagen, garantia, estado,
           fecha_entrada, fecha_salida, anticipo, costo_refaccion, costo_total,
           anuncio_estado, usuario_id, local_id, empresa_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [folio, personaId, modelo,
         (numSerie as string) || null, (falla as string) || (observaciones as string) || 'Sin falla',
         (descripcion as string) || null, (observaciones as string) || null,
         (imagen as string) || null, (garantia as string) || 'Sin garantia',
         (estado as string) || 'Recibido',
         fechaServ,
         fechaEntrega && fechaEntrega !== '0000-00-00 00:00:00' ? String(fechaEntrega) : null,
         Number(pago) || 0, Number(pieza) || 0, Number(costo) || 0,
         (anuncioEstado as string) || 'open',
         usuarioId, localId, empresaId]);
    }
    stats.serviciosInsertados++;
  }
  console.log(`   • Personas creadas:    ${stats.personasCreadas}`);
  console.log(`   • Personas reusadas:   ${stats.personasReusadas}`);
  console.log(`   • Servicios insertados:${stats.serviciosInsertados}`);
  console.log(`   • Servicios duplicados omitidos: ${stats.serviciosOmitidos}`);
  console.log('');

  // ─── 2) Productos (reconciliar todos) ────────────────────────────────
  console.log('═══ 2/3  Reconciliando productos ═══');
  for (const r of allProductos) {
    const [oldId, codigo, nombre, compra, venta, existencia, local, empresa] = r;
    const empresaId = Number(empresa) || empresaActual.id;
    const localId = Number(local) || 1;
    const codigoStr = (codigo as string) || '';
    const ventaNum = Number(venta) || 0;
    const compraNum = Number(compra) || 0;
    const existenciaNum = Number(existencia) || 0;

    let existing: any = null;
    if (codigoStr) {
      existing = get<{ id: number; existencia: number; venta: number; compra: number }>(db,
        `SELECT id, existencia, venta, compra FROM productos WHERE codigo = ? AND empresa_id = ? LIMIT 1`,
        [codigoStr, empresaId]);
    }
    if (!existing && nombre) {
      // Fallback: buscar por nombre exacto
      existing = get<{ id: number; existencia: number; venta: number; compra: number }>(db,
        `SELECT id, existencia, venta, compra FROM productos WHERE nombre = ? AND empresa_id = ? LIMIT 1`,
        [nombre as string, empresaId]);
    }

    if (existing) {
      productoIdMap.set(Number(oldId), existing.id);
      const cambios: string[] = [];
      const params: any[] = [];
      if (Math.abs((existing.existencia || 0) - existenciaNum) > 0) {
        cambios.push('existencia=?'); params.push(existenciaNum);
      }
      if (Math.abs((existing.venta || 0) - ventaNum) > 0.001 && ventaNum > 0) {
        cambios.push('venta=?'); params.push(ventaNum);
      }
      if (Math.abs((existing.compra || 0) - compraNum) > 0.001 && compraNum > 0) {
        cambios.push('compra=?'); params.push(compraNum);
      }
      if (cambios.length) {
        if (!dryRun) {
          params.push(existing.id);
          run(db, `UPDATE productos SET ${cambios.join(', ')} WHERE id = ?`, params);
        }
        stats.productosActualizados++;
      } else {
        stats.productosSinCambio++;
      }
    } else {
      // Insertar nuevo
      const empInfo = get<{ iniciales: string }>(db, `SELECT iniciales FROM empresa WHERE id=?`, [empresaId]);
      const ini = empInfo?.iniciales || empresaActual.iniciales || 'TS';
      const ddmmaa = (() => {
        const d = new Date();
        return String(d.getDate()).padStart(2, '0') +
               String(d.getMonth() + 1).padStart(2, '0') +
               String(d.getFullYear()).substring(2);
      })();
      const cntEmp = get<{ n: number }>(db,
        `SELECT COUNT(*) as n FROM productos WHERE empresa_id = ?`, [empresaId]);
      const seq = (cntEmp?.n || 0) + 1 + stats.productosInsertados;
      const folio = `${ini}${ddmmaa}${String(seq).padStart(5, '0')}`;
      const precios = `[${ventaNum},0,0]`;
      let newId = -1;
      if (!dryRun) {
        const ins = run(db,
          `INSERT INTO productos (folio, codigo, nombre, compra, venta, existencia,
             local_id, empresa_id, precios, precio_2, precio_3)
           VALUES (?,?,?,?,?,?,?,?,?,0,0)`,
          [folio, codigoStr, nombre as string, compraNum, ventaNum, existenciaNum,
           localId, empresaId, precios]);
        newId = Number(ins.lastInsertRowid);
      }
      productoIdMap.set(Number(oldId), newId);
      stats.productosInsertados++;
    }
  }
  console.log(`   • Productos nuevos insertados: ${stats.productosInsertados}`);
  console.log(`   • Productos actualizados:      ${stats.productosActualizados}`);
  console.log(`   • Productos sin cambio:        ${stats.productosSinCambio}`);
  console.log('');

  // ─── 3) Ventas + detalle ─────────────────────────────────────────────
  console.log('═══ 3/3  Importando ventas ═══');
  const ventaIdMap = new Map<number, number>(); // idVenta dump → id en BD destino
  for (const r of ventasNuevas) {
    const [oldId, fecha, total, idUsuario, idCliente, local, empresa] = r;
    const empresaId = Number(empresa) || empresaActual.id;
    const localId = Number(local) || 1;
    const fechaV = fechaIso(fecha as string);
    const totalNum = Number(total) || 0;

    // Dedup por (fecha + total + local_id + empresa_id)
    const dup = get<{ id: number }>(db,
      `SELECT id FROM ventas
       WHERE fecha = ? AND ABS(total - ?) < 0.001 AND local_id = ? AND empresa_id = ? LIMIT 1`,
      [fechaV, totalNum, localId, empresaId]);
    if (dup) {
      ventaIdMap.set(Number(oldId), dup.id);
      stats.ventasOmitidas++;
      continue;
    }

    // Usuario fallback
    let usuarioId = Number(idUsuario) || fallbackUsuario.id;
    if (!get(db, 'SELECT id FROM personas WHERE id=?', [usuarioId])) usuarioId = fallbackUsuario.id;
    // Cliente válido o NULL
    let clienteId: number | null = idCliente && Number(idCliente) > 0 ? Number(idCliente) : null;
    if (clienteId && !get(db, 'SELECT id FROM personas WHERE id=?', [clienteId])) clienteId = null;

    const empInfo = get<{ iniciales: string }>(db, `SELECT iniciales FROM empresa WHERE id=?`, [empresaId]);
    const ini = empInfo?.iniciales || empresaActual.iniciales || 'TS';
    const cntEmp = get<{ n: number }>(db, `SELECT COUNT(*) as n FROM ventas WHERE empresa_id = ?`, [empresaId]);
    const seq = (cntEmp?.n || 0) + 1 + stats.ventasInsertadas;
    const folio = `V${ini}${ddmmaaFromFecha(fechaV)}${String(seq).padStart(5, '0')}`;

    let nuevaVentaId = -1;
    if (!dryRun) {
      const ins = run(db,
        `INSERT INTO ventas (folio_venta, fecha, subtotal, descuento, total,
           metodo_pago, cliente_id, usuario_id, local_id, empresa_id, estado, fecha_finalizacion)
         VALUES (?,?,?,0,?, 'efectivo', ?, ?, ?, ?, 'completada', ?)`,
        [folio, fechaV, totalNum, totalNum, clienteId, usuarioId, localId, empresaId, fechaV]);
      nuevaVentaId = Number(ins.lastInsertRowid);
    }
    ventaIdMap.set(Number(oldId), nuevaVentaId);
    stats.ventasInsertadas++;
  }

  // Detalle de ventas
  for (const r of detalleNuevos) {
    const [_id, cantidad, precio, idProducto, idVenta] = r;
    const oldVentaId = Number(idVenta);
    const newVentaId = ventaIdMap.get(oldVentaId);
    if (!newVentaId || newVentaId < 0) { stats.detalleOmitidos++; continue; }
    const newProductoId = productoIdMap.get(Number(idProducto));
    if (!newProductoId || newProductoId < 0) { stats.detalleOmitidos++; continue; }
    const cant = Number(cantidad) || 1;
    const precioU = Number(precio) || 0;
    if (!dryRun) {
      run(db,
        `INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario,
           descuento_item, subtotal)
         VALUES (?,?,?,?,0,?)`,
        [newVentaId, newProductoId, cant, precioU, cant * precioU]);
    }
    stats.detalleInsertados++;
  }
  console.log(`   • Ventas insertadas:    ${stats.ventasInsertadas}`);
  console.log(`   • Ventas duplicadas:    ${stats.ventasOmitidas}`);
  console.log(`   • Detalle insertados:   ${stats.detalleInsertados}`);
  console.log(`   • Detalle omitidos:     ${stats.detalleOmitidos}`);
  console.log('');

  db.run('PRAGMA foreign_keys = ON');
  if (!dryRun) {
    console.log('💾 Persistiendo BD...');
    persistDB();
    console.log('✅ Importación completada.');
  } else {
    console.log('⚠️  DRY-RUN: nada fue escrito en disco. Quita --dry-run para aplicar.');
  }

  console.log('\n═════ Resumen ═════');
  console.log(JSON.stringify(stats, null, 2));
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
