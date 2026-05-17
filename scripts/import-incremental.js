/**
 * scripts/import-incremental.js
 *
 * Versión JavaScript pura (sin TypeScript) para ejecutar en Docker.
 *
 * Uso (dentro del contenedor o con node_modules instalado):
 *   node scripts/import-incremental.js <dump.sql> [--desde=YYYY-MM-DD] [--dry-run]
 *
 * Ejemplo Docker:
 *   docker compose stop app
 *   docker compose run --rm -v "$(pwd)/scripts:/app/scripts" app \
 *     node scripts/import-incremental.js scripts/import-mayo-2026.sql --desde=2026-05-01 --dry-run
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

// ───────────────────────────────────────────────────────────────────────────
//  Parser SQL
// ───────────────────────────────────────────────────────────────────────────

function parseInserts(sql, tableName) {
  const result = [];
  const re = new RegExp(
    `INSERT INTO \\\`${tableName}\\\`\\s*\\([^)]+\\)\\s*VALUES\\s*([\\s\\S]*?);\\s*$`,
    'gm',
  );
  let match;
  while ((match = re.exec(sql)) !== null) {
    result.push(...parseValueRows(match[1]));
  }
  return result;
}

function parseValueRows(block) {
  const rows = [];
  let i = 0;
  const n = block.length;
  while (i < n) {
    while (i < n && /[\s,]/.test(block[i])) i++;
    if (i >= n) break;
    if (block[i] !== '(') break;
    i++;
    const row = [];
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

function parseOneValue(s, start) {
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
//  DB helpers (estilo sql.js)
// ───────────────────────────────────────────────────────────────────────────

function dbGet(db, sql, params = []) {
  const res = db.exec(sql, params);
  if (!res.length || !res[0].values.length) return undefined;
  const { columns, values } = res[0];
  const row = {};
  columns.forEach((c, i) => { row[c] = values[0][i]; });
  return row;
}

function dbAll(db, sql, params = []) {
  const res = db.exec(sql, params);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(v => {
    const o = {};
    columns.forEach((c, i) => { o[c] = v[i]; });
    return o;
  });
}

function dbRun(db, sql, params = []) {
  db.run(sql, params);
  const lastId = db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] ?? 0;
  const changes = db.exec('SELECT changes()')[0]?.values[0]?.[0] ?? 0;
  return { lastInsertRowid: Number(lastId), changes: Number(changes) };
}

// ───────────────────────────────────────────────────────────────────────────
//  Utilidades de migración
// ───────────────────────────────────────────────────────────────────────────

function normalizePhone(p) {
  if (!p) return '';
  return String(p).replace(/[^0-9]/g, '');
}
function normalizeName(n) {
  if (!n) return '';
  return String(n).trim().toLowerCase().replace(/\s+/g, ' ');
}
function fechaIso(raw) {
  if (!raw || raw === '0000-00-00 00:00:00' || raw === '0000-00-00') {
    return new Date().toISOString().substring(0, 19).replace('T', ' ');
  }
  return String(raw);
}
function ddmmaaFromFecha(fecha) {
  const d = new Date(String(fecha).replace(' ', 'T'));
  if (isNaN(d.getTime())) return '010100';
  return String(d.getDate()).padStart(2, '0') +
         String(d.getMonth() + 1).padStart(2, '0') +
         String(d.getFullYear()).substring(2);
}

// ───────────────────────────────────────────────────────────────────────────
//  Main
// ───────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Uso: node scripts/import-incremental.js <dump.sql> [--desde=YYYY-MM-DD] [--dry-run]');
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
  if (!fs.existsSync(dumpPath)) { console.error(`❌ No existe: ${dumpPath}`); process.exit(1); }
  console.log(`📂 Dump:  ${dumpPath}`);
  console.log(`📅 Desde: ${desde}`);
  console.log(`🔧 Modo:  ${dryRun ? 'DRY-RUN (no escribe nada)' : 'APLICAR cambios'}\n`);

  // Resolver path de la BD: usa env DB_PATH o el default del proyecto
  const DB_PATH = path.resolve(process.env.DB_PATH || './database/techservice.db');
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ No existe la BD destino: ${DB_PATH}`);
    console.error('   Asegúrate de que la app haya creado la BD al menos una vez.');
    process.exit(1);
  }
  console.log(`💾 BD destino: ${DB_PATH}`);

  console.log('🔧 Cargando sql.js y abriendo BD...');
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);
  db.run('PRAGMA foreign_keys = OFF');

  const sql = fs.readFileSync(dumpPath, 'utf-8');

  const allClientes = parseInserts(sql, 'clientes');
  const allProductos = parseInserts(sql, 'productos');
  const allVentas = parseInserts(sql, 'ventas');
  const allProductosVentas = parseInserts(sql, 'productos_ventas');

  const serviciosNuevos = allClientes.filter(r => String(r[13] || '') >= desde);
  const ventasNuevas = allVentas.filter(r => String(r[1] || '') >= desde);
  const ventaIdsNuevas = new Set(ventasNuevas.map(r => Number(r[0])));
  const detalleNuevos = allProductosVentas.filter(r => ventaIdsNuevas.has(Number(r[4])));

  console.log(`\n📊 En dump (>= ${desde}):`);
  console.log(`   - ${serviciosNuevos.length} servicios candidatos`);
  console.log(`   - ${allProductos.length} productos (todos, para reconciliar)`);
  console.log(`   - ${ventasNuevas.length} ventas candidatas`);
  console.log(`   - ${detalleNuevos.length} detalles de venta\n`);

  const empresaActual = dbGet(db, 'SELECT id, iniciales FROM empresa LIMIT 1');
  if (!empresaActual) { console.error('❌ No hay empresa en la BD destino.'); process.exit(1); }
  console.log(`🏢 Empresa destino: id=${empresaActual.id} (${empresaActual.iniciales})`);

  const fallbackUsuario = dbGet(db,
    "SELECT id FROM personas WHERE tipo IN ('root','admin') ORDER BY (tipo='root') DESC, id ASC LIMIT 1");
  if (!fallbackUsuario) { console.error('❌ No hay usuarios root/admin.'); process.exit(1); }
  console.log(`👤 Usuario fallback: id=${fallbackUsuario.id}\n`);

  const stats = {
    personasCreadas: 0, personasReusadas: 0,
    serviciosInsertados: 0, serviciosOmitidos: 0,
    productosInsertados: 0, productosActualizados: 0, productosSinCambio: 0,
    ventasInsertadas: 0, ventasOmitidas: 0,
    detalleInsertados: 0, detalleOmitidos: 0,
  };

  const productoIdMap = new Map();

  // ─── 1) Personas + Servicios ─────────────────────────────────────────
  console.log('═══ 1/3  Importando servicios + clientes nuevos ═══');
  for (const r of serviciosNuevos) {
    const [_oldId, imagen, nombre, telefono, correo, direccion, descripcion, falla,
           numSerie, observaciones, pago, costo, pieza, fecha, fechaEntrega,
           estado, garantia, anuncioEstado, local, usuario, empresa] = r;
    if (!nombre) continue;
    const empresaId = Number(empresa) || empresaActual.id;
    const localId = Number(local) || 1;
    const fechaServ = fechaIso(fecha);
    const modelo = descripcion || falla || 'Sin modelo';

    const telNorm = normalizePhone(telefono);
    const nomNorm = normalizeName(nombre);
    let personaId = null;
    if (telNorm) {
      const f = dbGet(db,
        `SELECT id FROM personas
         WHERE REPLACE(REPLACE(REPLACE(REPLACE(telefono,'-',''),' ',''),'(',''),')','') = ?
           AND empresa_id = ?
         ORDER BY id ASC LIMIT 1`,
        [telNorm, empresaId]);
      if (f) personaId = f.id;
    }
    if (!personaId) {
      const f = dbGet(db,
        `SELECT id FROM personas WHERE LOWER(TRIM(nombre)) = ? AND empresa_id = ? LIMIT 1`,
        [nomNorm, empresaId]);
      if (f) personaId = f.id;
    }
    if (personaId) {
      stats.personasReusadas++;
    } else {
      if (!dryRun) {
        const ins = dbRun(db,
          `INSERT INTO personas (nombre, correo, telefono, direccion, tipo,
             empresa_id, local_id, tipo_cliente, roles, activo)
           VALUES (?,?,?,?,NULL,?,?,?,?,1)`,
          [nombre, correo || null, telefono || null, direccion || null,
           empresaId, localId, 'regular', 'cliente']);
        personaId = ins.lastInsertRowid;
      } else {
        personaId = -1;
      }
      stats.personasCreadas++;
    }

    const dup = dbGet(db,
      `SELECT id FROM servicios WHERE cliente_id = ? AND fecha_entrada = ? AND modelo = ? LIMIT 1`,
      [personaId, fechaServ, modelo]);
    if (dup) { stats.serviciosOmitidos++; continue; }

    const cntEmp = dbGet(db, `SELECT COUNT(*) as n FROM servicios WHERE empresa_id = ?`, [empresaId]);
    const seq = (cntEmp?.n || 0) + 1 + stats.serviciosInsertados;
    const empInfo = dbGet(db, `SELECT iniciales FROM empresa WHERE id=?`, [empresaId]);
    const ini = empInfo?.iniciales || empresaActual.iniciales || 'TS';
    const folio = `${ini}${ddmmaaFromFecha(fechaServ)}${String(seq).padStart(5, '0')}`;

    let usuarioId = Number(usuario) || fallbackUsuario.id;
    if (!dbGet(db, 'SELECT id FROM personas WHERE id=?', [usuarioId])) usuarioId = fallbackUsuario.id;

    if (!dryRun) {
      dbRun(db,
        `INSERT INTO servicios (folio, cliente_id, modelo, num_serie, falla,
           descripcion, observaciones, imagen, garantia, estado,
           fecha_entrada, fecha_salida, anticipo, costo_refaccion, costo_total,
           anuncio_estado, usuario_id, local_id, empresa_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [folio, personaId, modelo,
         numSerie || null, falla || observaciones || 'Sin falla',
         descripcion || null, observaciones || null,
         imagen || null, garantia || 'Sin garantia',
         estado || 'Recibido', fechaServ,
         fechaEntrega && fechaEntrega !== '0000-00-00 00:00:00' ? fechaEntrega : null,
         Number(pago) || 0, Number(pieza) || 0, Number(costo) || 0,
         anuncioEstado || 'open',
         usuarioId, localId, empresaId]);
    }
    stats.serviciosInsertados++;
  }
  console.log(`   • Personas creadas:     ${stats.personasCreadas}`);
  console.log(`   • Personas reusadas:    ${stats.personasReusadas}`);
  console.log(`   • Servicios insertados: ${stats.serviciosInsertados}`);
  console.log(`   • Servicios omitidos:   ${stats.serviciosOmitidos}\n`);

  // ─── 2) Productos ────────────────────────────────────────────────────
  console.log('═══ 2/3  Reconciliando productos ═══');
  for (const r of allProductos) {
    const [oldId, codigo, nombre, compra, venta, existencia, local, empresa] = r;
    const empresaId = Number(empresa) || empresaActual.id;
    const localId = Number(local) || 1;
    const codigoStr = codigo || '';
    const ventaNum = Number(venta) || 0;
    const compraNum = Number(compra) || 0;
    const existenciaNum = Number(existencia) || 0;

    let existing = null;
    if (codigoStr) {
      existing = dbGet(db,
        `SELECT id, existencia, venta, compra FROM productos WHERE codigo = ? AND empresa_id = ? LIMIT 1`,
        [codigoStr, empresaId]);
    }
    if (!existing && nombre) {
      existing = dbGet(db,
        `SELECT id, existencia, venta, compra FROM productos WHERE nombre = ? AND empresa_id = ? LIMIT 1`,
        [nombre, empresaId]);
    }

    if (existing) {
      productoIdMap.set(Number(oldId), existing.id);
      const cambios = [];
      const params = [];
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
          dbRun(db, `UPDATE productos SET ${cambios.join(', ')} WHERE id = ?`, params);
        }
        stats.productosActualizados++;
      } else {
        stats.productosSinCambio++;
      }
    } else {
      const empInfo = dbGet(db, `SELECT iniciales FROM empresa WHERE id=?`, [empresaId]);
      const ini = empInfo?.iniciales || empresaActual.iniciales || 'TS';
      const dd = new Date();
      const ddmmaa = String(dd.getDate()).padStart(2,'0') + String(dd.getMonth()+1).padStart(2,'0') + String(dd.getFullYear()).substring(2);
      const cntEmp = dbGet(db, `SELECT COUNT(*) as n FROM productos WHERE empresa_id = ?`, [empresaId]);
      const seq = (cntEmp?.n || 0) + 1 + stats.productosInsertados;
      const folio = `${ini}${ddmmaa}${String(seq).padStart(5,'0')}`;
      const precios = `[${ventaNum},0,0]`;
      let newId = -1;
      if (!dryRun) {
        const ins = dbRun(db,
          `INSERT INTO productos (folio, codigo, nombre, compra, venta, existencia,
             local_id, empresa_id, precios, precio_2, precio_3)
           VALUES (?,?,?,?,?,?,?,?,?,0,0)`,
          [folio, codigoStr, nombre, compraNum, ventaNum, existenciaNum,
           localId, empresaId, precios]);
        newId = ins.lastInsertRowid;
      }
      productoIdMap.set(Number(oldId), newId);
      stats.productosInsertados++;
    }
  }
  console.log(`   • Productos nuevos:        ${stats.productosInsertados}`);
  console.log(`   • Productos actualizados:  ${stats.productosActualizados}`);
  console.log(`   • Productos sin cambio:    ${stats.productosSinCambio}\n`);

  // ─── 3) Ventas + detalle ─────────────────────────────────────────────
  console.log('═══ 3/3  Importando ventas ═══');
  const ventaIdMap = new Map();
  for (const r of ventasNuevas) {
    const [oldId, fecha, total, idUsuario, idCliente, local, empresa] = r;
    const empresaId = Number(empresa) || empresaActual.id;
    const localId = Number(local) || 1;
    const fechaV = fechaIso(fecha);
    const totalNum = Number(total) || 0;

    const dup = dbGet(db,
      `SELECT id FROM ventas
       WHERE fecha = ? AND ABS(total - ?) < 0.001 AND local_id = ? AND empresa_id = ? LIMIT 1`,
      [fechaV, totalNum, localId, empresaId]);
    if (dup) {
      ventaIdMap.set(Number(oldId), dup.id);
      stats.ventasOmitidas++;
      continue;
    }

    let usuarioId = Number(idUsuario) || fallbackUsuario.id;
    if (!dbGet(db, 'SELECT id FROM personas WHERE id=?', [usuarioId])) usuarioId = fallbackUsuario.id;
    let clienteId = idCliente && Number(idCliente) > 0 ? Number(idCliente) : null;
    if (clienteId && !dbGet(db, 'SELECT id FROM personas WHERE id=?', [clienteId])) clienteId = null;

    const empInfo = dbGet(db, `SELECT iniciales FROM empresa WHERE id=?`, [empresaId]);
    const ini = empInfo?.iniciales || empresaActual.iniciales || 'TS';
    const cntEmp = dbGet(db, `SELECT COUNT(*) as n FROM ventas WHERE empresa_id = ?`, [empresaId]);
    const seq = (cntEmp?.n || 0) + 1 + stats.ventasInsertadas;
    const folio = `V${ini}${ddmmaaFromFecha(fechaV)}${String(seq).padStart(5,'0')}`;

    let nuevaVentaId = -1;
    if (!dryRun) {
      const ins = dbRun(db,
        `INSERT INTO ventas (folio_venta, fecha, subtotal, descuento, total,
           metodo_pago, cliente_id, usuario_id, local_id, empresa_id, estado, fecha_finalizacion)
         VALUES (?,?,?,0,?, 'efectivo', ?, ?, ?, ?, 'completada', ?)`,
        [folio, fechaV, totalNum, totalNum, clienteId, usuarioId, localId, empresaId, fechaV]);
      nuevaVentaId = ins.lastInsertRowid;
    }
    ventaIdMap.set(Number(oldId), nuevaVentaId);
    stats.ventasInsertadas++;
  }

  for (const r of detalleNuevos) {
    const [_id, cantidad, precio, idProducto, idVenta] = r;
    const newVentaId = ventaIdMap.get(Number(idVenta));
    if (!newVentaId || newVentaId < 0) { stats.detalleOmitidos++; continue; }
    const newProductoId = productoIdMap.get(Number(idProducto));
    if (!newProductoId || newProductoId < 0) { stats.detalleOmitidos++; continue; }
    const cant = Number(cantidad) || 1;
    const precioU = Number(precio) || 0;
    if (!dryRun) {
      dbRun(db,
        `INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario,
           descuento_item, subtotal)
         VALUES (?,?,?,?,0,?)`,
        [newVentaId, newProductoId, cant, precioU, cant * precioU]);
    }
    stats.detalleInsertados++;
  }
  console.log(`   • Ventas insertadas:  ${stats.ventasInsertadas}`);
  console.log(`   • Ventas duplicadas:  ${stats.ventasOmitidas}`);
  console.log(`   • Detalle insertados: ${stats.detalleInsertados}`);
  console.log(`   • Detalle omitidos:   ${stats.detalleOmitidos}\n`);

  db.run('PRAGMA foreign_keys = ON');

  if (!dryRun) {
    console.log('💾 Guardando BD...');
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    console.log(`✅ Guardado en ${DB_PATH}`);
  } else {
    console.log('⚠️  DRY-RUN: nada fue escrito. Quita --dry-run para aplicar.');
  }

  console.log('\n═════ Resumen ═════');
  console.log(JSON.stringify(stats, null, 2));
  db.close();
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
