/**
 * scripts/restore-image-names.ts
 *
 * Plan B: si se perdió el campo `imagen` de servicios y `logo` de empresa
 * (por una corrida fallida del script de paths), este script los recupera
 * leyendo el dump SQL original.
 *
 * SOLO actualiza filas donde el campo está en NULL. NO sobrescribe paths
 * ya válidos (los que empiezan con /uploads/ o data:).
 *
 * Uso:
 *   docker run --rm -it [montajes] node:20-alpine sh -c "
 *     npm install --silent &&
 *     npx ts-node --transpile-only scripts/restore-image-names.ts scripts/dump.sql"
 */

import fs from 'fs';
import { getDB, run, get, persistDB } from '../src/config/db';

type SqlValue = string | number | null;

// ── Parser SQL (mismo que migrate-from-mariadb.ts) ─────────────────────
function parseInserts(sql: string, tableName: string): SqlValue[][] {
  const result: SqlValue[][] = [];
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
      } else {
        val += ch;
        i++;
      }
    }
    return [val, i];
  }
  if (s.substr(i, 4).toUpperCase() === 'NULL') {
    return [null, i + 4];
  }
  const numMatch = s.substr(i).match(/^-?\d+(\.\d+)?/);
  if (numMatch) {
    return [parseFloat(numMatch[0]), i + numMatch[0].length];
  }
  let val = '';
  while (i < s.length && s[i] !== ',' && s[i] !== ')') { val += s[i]; i++; }
  return [val.trim() || null, i];
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error('Uso: npx ts-node scripts/restore-image-names.ts <ruta-al-dump.sql>');
    process.exit(1);
  }
  if (!fs.existsSync(dumpPath)) {
    console.error(`No existe el archivo: ${dumpPath}`);
    process.exit(1);
  }
  console.log(`📂 Leyendo dump: ${dumpPath}`);
  const sql = fs.readFileSync(dumpPath, 'utf-8');

  // El dump tiene tabla `clientes` con columnas:
  // id, imagen, nombre, telefono, correo, direccion, descripcion, falla,
  // num_serie, observaciones, pago, costo, pieza, fecha, fecha_entrega,
  // estado, garantia, anuncio_estado, local, usuario, empresa
  const clientes = parseInserts(sql, 'clientes');
  // Mapeo: servicio_id (= id viejo) → imagen
  const mapServicios = new Map<number, string>();
  for (const r of clientes) {
    const id = Number(r[0]);
    const imagen = r[1];
    if (imagen && typeof imagen === 'string' && imagen.trim()) {
      mapServicios.set(id, imagen.trim());
    }
  }
  console.log(`📊 Servicios con nombre de imagen en el dump: ${mapServicios.size}`);

  // Empresas: id, logo
  const empresas = parseInserts(sql, 'empresa');
  const mapLogos = new Map<number, string>();
  for (const r of empresas) {
    const id = Number(r[0]);
    const logo = r[1];
    if (logo && typeof logo === 'string' && logo.trim()) {
      mapLogos.set(id, logo.trim());
    }
  }
  console.log(`📊 Empresas con logo en el dump: ${mapLogos.size}`);
  console.log('');

  const db = await getDB();

  // ── Restaurar servicios (solo donde imagen IS NULL) ──────────────────
  let svRestaurados = 0, svConservados = 0;
  for (const [sid, imagen] of mapServicios.entries()) {
    const row = get<{ id: number; imagen: string | null }>(db,
      'SELECT id, imagen FROM servicios WHERE id=?', [sid]);
    if (!row) continue;
    // Solo restaurar si imagen está en NULL
    if (row.imagen === null) {
      run(db, 'UPDATE servicios SET imagen=? WHERE id=?', [imagen, sid]);
      svRestaurados++;
    } else {
      svConservados++;
    }
  }
  console.log(`✓ Servicios restaurados (imagen estaba NULL):  ${svRestaurados}`);
  console.log(`  Servicios conservados (imagen ya tenía valor): ${svConservados}`);

  // ── Restaurar empresas (solo donde logo IS NULL) ─────────────────────
  let lgRestaurados = 0, lgConservados = 0;
  for (const [eid, logo] of mapLogos.entries()) {
    const row = get<{ id: number; logo: string | null }>(db,
      'SELECT id, logo FROM empresa WHERE id=?', [eid]);
    if (!row) continue;
    if (row.logo === null) {
      run(db, 'UPDATE empresa SET logo=? WHERE id=?', [logo, eid]);
      lgRestaurados++;
    } else {
      lgConservados++;
    }
  }
  console.log(`✓ Empresas con logo restaurado (logo estaba NULL): ${lgRestaurados}`);
  console.log(`  Empresas conservadas:                            ${lgConservados}`);

  persistDB();

  console.log('');
  console.log('✅ Listo. Ahora corre el script de paths:');
  console.log('   scripts/migrate-image-paths.ts');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
