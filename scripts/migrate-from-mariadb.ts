/**
 * scripts/migrate-from-mariadb.ts
 *
 * Migra un dump SQL de MariaDB/MySQL (sistema viejo "celulares") a la BD
 * SQLite de TechService Pro.
 *
 * Uso:
 *   npx ts-node scripts/migrate-from-mariadb.ts <ruta-al-dump.sql>
 *
 * Decisiones tomadas (según conversación con el usuario):
 * - BORRA todos los datos actuales de la BD destino antes de importar.
 * - Mantiene IDs originales del dump.
 * - Re-hashea contraseñas con bcrypt (estaban en texto plano).
 * - Convierte morfeo@onoffsoluciones.com (Yahir Martinez) en usuario root.
 * - Deduplica clientes por (nombre normalizado + teléfono normalizado).
 * - Importa las 7 empresas, 7 locales, todos los usuarios, productos, ventas, etc.
 * - Cada fila vieja de `clientes` se transforma en (1 persona) + (1 servicio).
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { getDB, run, get, persistDB } from '../src/config/db';
import { initDB } from '../src/config/initDB';

// ───────────────────────────────────────────────────────────────────────────
//  Parser SQL — extrae filas de INSERT statements del dump
// ───────────────────────────────────────────────────────────────────────────

type SqlValue = string | number | null;

/**
 * Parsea los INSERT INTO `table` ... VALUES (...), (...); de un dump.
 * Devuelve array de arrays (cada array es una fila con valores en orden).
 */
function parseInserts(sql: string, tableName: string): SqlValue[][] {
  const result: SqlValue[][] = [];
  // Regex: INSERT INTO `tabla` (...) VALUES <bloque>;
  const re = new RegExp(
    `INSERT INTO \`${tableName}\`\\s*\\([^)]+\\)\\s*VALUES\\s*([\\s\\S]*?);\\s*$`,
    'gm',
  );
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    const block = match[1];
    const rows = parseValueRows(block);
    result.push(...rows);
  }
  return result;
}

/** Parsea un bloque "(v1,v2,...), (v1,v2,...), ..." en filas. */
function parseValueRows(block: string): SqlValue[][] {
  const rows: SqlValue[][] = [];
  let i = 0;
  const n = block.length;
  while (i < n) {
    // skip whitespace y comas
    while (i < n && /[\s,]/.test(block[i])) i++;
    if (i >= n) break;
    if (block[i] !== '(') break;
    i++; // consume '('
    const row: SqlValue[] = [];
    while (i < n) {
      // skip whitespace
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

/** Parsea UN valor (string, number, NULL) y devuelve [valor, índiceSiguiente]. */
function parseOneValue(s: string, start: number): [SqlValue, number] {
  let i = start;
  const c = s[i];
  // String
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
        else val += nxt; // \\ \' \" etc.
        i += 2;
      } else if (ch === "'") {
        if (s[i + 1] === "'") { val += "'"; i += 2; } // escape SQL ''
        else { i++; return [val, i]; }
      } else {
        val += ch;
        i++;
      }
    }
    return [val, i];
  }
  // NULL
  if (s.substr(i, 4).toUpperCase() === 'NULL') {
    return [null, i + 4];
  }
  // Number (incluye negativos y decimales)
  const numMatch = s.substr(i).match(/^-?\d+(\.\d+)?/);
  if (numMatch) {
    return [parseFloat(numMatch[0]), i + numMatch[0].length];
  }
  // Fallback: leer hasta , o )
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

function mapTipoUsuario(tipoViejo: string): string {
  const t = (tipoViejo || '').toLowerCase().trim();
  if (t === 'administrador' || t === 'admin') return 'admin';
  if (t === 'encargado') return 'admin';
  if (t === 'empleado') return 'empleado';
  return 'empleado';
}

function mapRolesPersona(tipoViejo: string): string {
  return mapTipoUsuario(tipoViejo);
}

/** Quita acentos y caracteres especiales para iniciales/folios. */
function makeIniciales(nombre: string): string {
  if (!nombre) return 'TS';
  return nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .substring(0, 4)
    .toUpperCase() || 'TS';
}

function fechaIso(raw: string | null): string {
  if (!raw || raw === '0000-00-00 00:00:00' || raw === '0000-00-00') {
    return new Date().toISOString().substring(0, 19).replace('T', ' ');
  }
  return String(raw);
}

// ───────────────────────────────────────────────────────────────────────────
//  Limpieza de la BD destino
// ───────────────────────────────────────────────────────────────────────────

const APP_TABLES = [
  // Orden: hijas primero (no importa porque deshabilitamos FK)
  'pagos_servicio', 'pagos_venta', 'cortes',
  'abonos', 'creditos',
  'ventas_detalle', 'ventas',
  'servicios',
  'productos',
  'clientes_listas', 'listas_precios',
  'permisos', 'logs',
  'configuracion', 'ticket_plantillas',
  'personas',
  'locales',
  'empresa',
  'conceptos_cobro',
];

function wipeData(db: any) {
  console.log('🗑️  Borrando datos actuales...');
  for (const t of APP_TABLES) {
    try {
      db.run(`DELETE FROM ${t}`);
      try { db.run(`DELETE FROM sqlite_sequence WHERE name='${t}'`); } catch {}
    } catch (e: any) {
      // tabla no existe — OK
    }
  }
  console.log('✓ Datos borrados.');
}

// ───────────────────────────────────────────────────────────────────────────
//  Importadores por tabla
// ───────────────────────────────────────────────────────────────────────────

function importEmpresas(db: any, rows: SqlValue[][]) {
  // Schema viejo: id, logo, nombre, rfc, telefono, correo, calle, cp, ciudad, estado,
  //               tipo_empresa, nombre_encargado, cobro, fecha_creacion, fecha_actualizacion, estatus
  let n = 0;
  for (const r of rows) {
    const [id, logo, nombre, rfc, telefono, correo, calle, cp, ciudad, estado,
           tipoEmpresa, nombreEncargado, cobro, fechaCreacion, fechaAct, estatus] = r;
    const iniciales = makeIniciales(String(nombre));
    db.run(
      `INSERT INTO empresa (id, nombre, iniciales, rfc, telefono, correo, calle, cp,
         ciudad, estado_rep, tipo_empresa, nombre_encargado, logo, cobro,
         fecha_creacion, fecha_actualizacion, estatus, sandbox)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
      [Number(id), nombre, iniciales, rfc || '', telefono || '', correo || '',
       calle || '', cp ? String(cp) : '', ciudad || '', estado || '',
       (tipoEmpresa as string)?.toLowerCase() === 'a' ? 'servicio' : (tipoEmpresa || 'servicio'),
       nombreEncargado || '', logo || null,
       Number(cobro) || 0, fechaIso(fechaCreacion as string),
       fechaIso(fechaAct as string), estatus === 'A' ? 'activo' : 'inactivo']
    );
    n++;
  }
  console.log(`✓ ${n} empresas importadas.`);
}

function importLocales(db: any, rows: SqlValue[][]) {
  // Schema viejo: id, nombre_local, ubicacion_interna, ciudad, estado, telefono,
  //               correo_contacto, gerente_encargado, fecha_apertura, estatus, empresa
  let n = 0;
  for (const r of rows) {
    const [id, nombreLocal, ubicacion, ciudad, estado, tel, correo, gerente,
           fechaApertura, estatus, empresa] = r;
    db.run(
      `INSERT INTO locales (id, nombre_local, ubicacion_interna, ciudad, estado_local,
         telefono, correo_contacto, gerente_encargado, fecha_apertura, estatus, empresa_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [Number(id), nombreLocal, ubicacion || '', ciudad || '', estado || '',
       tel || '', correo || '', gerente || '',
       fechaApertura as string || null,
       estatus || 'A', Number(empresa)]
    );
    n++;
  }
  console.log(`✓ ${n} locales importados.`);
}

function importUsuarios(db: any, rows: SqlValue[][]) {
  // Schema viejo: id, usu_correo, contrasena, nombre, tipo, local, empresa
  // Mapeo a personas con bcrypt y conversión de Yahir a root.
  let n = 0;
  for (const r of rows) {
    const [id, correo, contrasena, nombre, tipo, local, empresa] = r;
    let rolFinal = mapRolesPersona(String(tipo));
    let tipoFinal = mapTipoUsuario(String(tipo));
    // Convertir Yahir Martinez en root
    if (String(correo).toLowerCase() === 'morfeo@onoffsoluciones.com') {
      rolFinal = 'root';
      tipoFinal = 'root';
    }
    const hash = bcrypt.hashSync(String(contrasena || '1234'), 10);
    db.run(
      `INSERT INTO personas (id, nombre, correo, contrasena, tipo, local_id, empresa_id,
         tipo_cliente, roles, activo)
       VALUES (?,?,?,?,?,?,?,?,?,1)`,
      [Number(id), nombre || correo, correo, hash, tipoFinal,
       Number(local) || null, Number(empresa) || 1,
       'regular', rolFinal]
    );
    n++;
  }
  console.log(`✓ ${n} usuarios importados (Yahir Martinez → root).`);
}

function importClientesYServicios(db: any, rows: SqlValue[][]) {
  // Schema viejo `clientes`: cada fila es CLIENTE+SERVICIO mezclados.
  // Dedup clientes por (nombre normalizado + teléfono normalizado).
  // Cada fila genera 1 servicio. Asignar cliente_id según dedup map.
  let nClientes = 0, nServicios = 0;
  // Map dedup: clave "nombrenorm|telnorm" → personaId asignada
  const dedup = new Map<string, number>();
  // Para evitar colisiones con IDs de personas (usuarios), comenzamos desde un offset alto
  let nextPersonaId = 100000;
  // Pre-cargar IDs ya usados en personas (los usuarios ya importados)
  const usedIds = new Set<number>();
  const usedIdsRes = db.exec('SELECT id FROM personas');
  if (usedIdsRes.length) {
    for (const v of usedIdsRes[0].values) usedIds.add(Number(v[0]));
  }
  while (usedIds.has(nextPersonaId)) nextPersonaId++;

  // Generador de folio único para servicios
  const folioCounters = new Map<number, number>(); // empresaId → counter

  for (const r of rows) {
    const [oldId, imagen, nombre, telefono, correo, direccion, descripcion, falla,
           numSerie, observaciones, pago, costo, pieza, fecha, fechaEntrega,
           estado, garantia, anuncioEstado, local, usuario, empresa] = r;
    if (!nombre) continue;
    const empresaId = Number(empresa) || 1;
    const localId = Number(local) || 1;
    const usuarioId = Number(usuario) || null;

    // DEDUP cliente
    const key = `${normalizeName(nombre as string)}|${normalizePhone(telefono as string)}`;
    let personaId = dedup.get(key);
    if (!personaId) {
      personaId = nextPersonaId++;
      while (usedIds.has(nextPersonaId)) nextPersonaId++;
      dedup.set(key, personaId);
      usedIds.add(personaId);
      db.run(
        `INSERT INTO personas (id, nombre, correo, telefono, direccion, tipo,
           empresa_id, local_id, tipo_cliente, roles, activo)
         VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
        [personaId, nombre, correo || null, telefono || null, direccion || null,
         'cliente', empresaId, localId, 'regular', 'cliente']
      );
      nClientes++;
    }

    // SERVICIO
    const seq = (folioCounters.get(empresaId) || 0) + 1;
    folioCounters.set(empresaId, seq);
    const empresaInfo = get<{ iniciales: string }>(db,
      'SELECT iniciales FROM empresa WHERE id=?', [empresaId]);
    const ini = empresaInfo?.iniciales || 'TS';
    const fechaServ = fechaIso(fecha as string);
    const ddmmaa = (() => {
      const d = new Date(fechaServ.replace(' ', 'T'));
      if (isNaN(d.getTime())) return '010100';
      return String(d.getDate()).padStart(2, '0') +
             String(d.getMonth() + 1).padStart(2, '0') +
             String(d.getFullYear()).substring(2);
    })();
    const folio = `${ini}${ddmmaa}${String(seq).padStart(5, '0')}`;
    db.run(
      `INSERT INTO servicios (id, folio, cliente_id, modelo, num_serie, falla,
         descripcion, observaciones, imagen, garantia, estado,
         fecha_entrada, fecha_salida, anticipo, costo_refaccion, costo_total,
         anuncio_estado, usuario_id, local_id, empresa_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [Number(oldId), folio, personaId,
       (descripcion as string) || (falla as string) || 'Sin modelo',
       numSerie || null, (falla as string) || (observaciones as string) || 'Sin falla',
       (descripcion as string) || null, observaciones || null,
       imagen || null, garantia || 'Sin garantia',
       estado || 'Recibido', fechaServ,
       fechaEntrega && fechaEntrega !== '0000-00-00 00:00:00' ? fechaEntrega : null,
       Number(pago) || 0, Number(pieza) || 0, Number(costo) || 0,
       anuncioEstado || 'open',
       usuarioId || 1, localId, empresaId]
    );
    nServicios++;
  }
  console.log(`✓ ${nClientes} clientes únicos (deduplicados de ${rows.length} filas).`);
  console.log(`✓ ${nServicios} servicios importados.`);
}

function importProductos(db: any, rows: SqlValue[][]) {
  // Schema viejo: id, codigo, nombre, compra, venta, existencia, local, empresa
  let n = 0;
  for (const r of rows) {
    const [id, codigo, nombre, compra, venta, existencia, local, empresa] = r;
    const empresaId = Number(empresa) || 1;
    const empresaInfo = get<{ iniciales: string }>(db,
      'SELECT iniciales FROM empresa WHERE id=?', [empresaId]);
    const ini = empresaInfo?.iniciales || 'TS';
    const ddmmaa = (() => {
      const d = new Date();
      return String(d.getDate()).padStart(2, '0') +
             String(d.getMonth() + 1).padStart(2, '0') +
             String(d.getFullYear()).substring(2);
    })();
    const folio = `${ini}${ddmmaa}${String(Number(id)).padStart(5, '0')}`;
    const ventaNum = Number(venta) || 0;
    const precios = `[${ventaNum},0,0]`;
    db.run(
      `INSERT INTO productos (id, folio, codigo, nombre, compra, venta, existencia,
         local_id, empresa_id, precios, precio_2, precio_3)
       VALUES (?,?,?,?,?,?,?,?,?,?,0,0)`,
      [Number(id), folio, (codigo as string) || '', nombre,
       Number(compra) || 0, ventaNum, Number(existencia) || 0,
       Number(local) || 1, empresaId, precios]
    );
    n++;
  }
  console.log(`✓ ${n} productos importados.`);
}

function importVentas(db: any, rows: SqlValue[][], usuariosFallback: number) {
  // Schema viejo: id, fecha, total, idUsuario, idCliente, local, empresa
  let n = 0;
  for (const r of rows) {
    const [id, fecha, total, idUsuario, idCliente, local, empresa] = r;
    const empresaId = Number(empresa) || 1;
    const empresaInfo = get<{ iniciales: string }>(db,
      'SELECT iniciales FROM empresa WHERE id=?', [empresaId]);
    const ini = empresaInfo?.iniciales || 'TS';
    const folio = `V${ini}${String(Number(id)).padStart(5, '0')}`;
    const totalNum = Number(total) || 0;
    // Asegurar que el usuario existe
    let usuarioId = Number(idUsuario);
    if (!usuarioId || !get(db, 'SELECT id FROM personas WHERE id=?', [usuarioId])) {
      usuarioId = usuariosFallback;
    }
    // Cliente puede ser NULL o 0
    let clienteId: number | null = idCliente && Number(idCliente) > 0 ? Number(idCliente) : null;
    if (clienteId && !get(db, 'SELECT id FROM personas WHERE id=?', [clienteId])) {
      clienteId = null;
    }
    db.run(
      `INSERT INTO ventas (id, folio_venta, fecha, subtotal, descuento, total,
         metodo_pago, cliente_id, usuario_id, local_id, empresa_id, estado, fecha_finalizacion)
       VALUES (?,?,?,?,0,?,?,?,?,?,?,?,?)`,
      [Number(id), folio, fechaIso(fecha as string),
       totalNum, totalNum,
       'efectivo', clienteId, usuarioId,
       Number(local) || 1, empresaId,
       'completada', fechaIso(fecha as string)]
    );
    n++;
  }
  console.log(`✓ ${n} ventas importadas.`);
}

function importVentasDetalle(db: any, rows: SqlValue[][]) {
  // Schema viejo productos_ventas: id, cantidad, precio, idProducto, idVenta
  let n = 0, skipped = 0;
  for (const r of rows) {
    const [id, cantidad, precio, idProducto, idVenta] = r;
    // Verificar que venta y producto existen (si no, skip)
    if (!get(db, 'SELECT id FROM ventas WHERE id=?', [Number(idVenta)])) { skipped++; continue; }
    if (!get(db, 'SELECT id FROM productos WHERE id=?', [Number(idProducto)])) { skipped++; continue; }
    const cant = Number(cantidad) || 1;
    const precioU = Number(precio) || 0;
    db.run(
      `INSERT INTO ventas_detalle (id, venta_id, producto_id, cantidad, precio_unitario,
         descuento_item, subtotal)
       VALUES (?,?,?,?,?,0,?)`,
      [Number(id), Number(idVenta), Number(idProducto), cant, precioU, cant * precioU]
    );
    n++;
  }
  console.log(`✓ ${n} detalles de venta importados (${skipped} omitidos por refs faltantes).`);
}

// ───────────────────────────────────────────────────────────────────────────
//  Main
// ───────────────────────────────────────────────────────────────────────────

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error('Uso: npx ts-node scripts/migrate-from-mariadb.ts <ruta-al-dump.sql>');
    process.exit(1);
  }
  if (!fs.existsSync(dumpPath)) {
    console.error(`No existe el archivo: ${dumpPath}`);
    process.exit(1);
  }
  console.log(`📂 Leyendo dump: ${dumpPath}`);
  const sql = fs.readFileSync(dumpPath, 'utf-8');

  console.log('🔧 Inicializando BD destino (corre migraciones si hace falta)...');
  await initDB();
  const db = await getDB();

  console.log('🚦 Deshabilitando FKs durante el import...');
  db.run('PRAGMA foreign_keys = OFF');

  wipeData(db);

  console.log('\n📥 Importando datos del dump...');
  const empresas = parseInserts(sql, 'empresa');
  const locales = parseInserts(sql, 'locales');
  const usuarios = parseInserts(sql, 'usuario');
  const clientes = parseInserts(sql, 'clientes');
  const productos = parseInserts(sql, 'productos');
  const ventas = parseInserts(sql, 'ventas');
  const productosVentas = parseInserts(sql, 'productos_ventas');

  console.log(`   - ${empresas.length} empresa(s) en dump`);
  console.log(`   - ${locales.length} local(es) en dump`);
  console.log(`   - ${usuarios.length} usuario(s) en dump`);
  console.log(`   - ${clientes.length} fila(s) cliente/servicio en dump`);
  console.log(`   - ${productos.length} producto(s) en dump`);
  console.log(`   - ${ventas.length} venta(s) en dump`);
  console.log(`   - ${productosVentas.length} detalle(s) de venta en dump`);
  console.log('');

  importEmpresas(db, empresas);
  importLocales(db, locales);
  importUsuarios(db, usuarios);

  // Encuentra el ID de Yahir (root) para usar como fallback de usuarios faltantes
  const root = get<{ id: number }>(db,
    "SELECT id FROM personas WHERE correo='morfeo@onoffsoluciones.com' LIMIT 1");
  const fallbackUsuario = root?.id || 1;

  importClientesYServicios(db, clientes);
  importProductos(db, productos);
  importVentas(db, ventas, fallbackUsuario);
  importVentasDetalle(db, productosVentas);

  console.log('\n🌱 Generando configuración default por empresa...');
  const empresasIds = db.exec('SELECT id FROM empresa');
  if (empresasIds.length) {
    for (const v of empresasIds[0].values) {
      const eid = Number(v[0]);
      try {
        db.run(`INSERT INTO configuracion (empresa_id) VALUES (?)`, [eid]);
      } catch {}
    }
  }

  console.log('🚦 Re-habilitando FKs...');
  db.run('PRAGMA foreign_keys = ON');

  console.log('💾 Persistiendo BD...');
  persistDB();

  // Resumen final
  console.log('\n═════════════════════════════════════════════════════════');
  console.log('  RESUMEN FINAL');
  console.log('═════════════════════════════════════════════════════════');
  const counts = [
    'empresa', 'locales', 'personas', 'productos', 'servicios', 'ventas', 'ventas_detalle',
  ];
  for (const t of counts) {
    const r = get<{ n: number }>(db, `SELECT COUNT(*) as n FROM ${t}`);
    console.log(`  ${t.padEnd(20)} ${r?.n || 0} filas`);
  }
  console.log('═════════════════════════════════════════════════════════');
  console.log('\n✅ Migración completada con éxito.');
  console.log('   Login root: morfeo@onoffsoluciones.com / roja');
  console.log('   (contraseña original del dump, ahora rehasheada con bcrypt)');
}

main().catch(err => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
