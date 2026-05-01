// src/controllers/importController.ts
// Importación masiva de productos, clientes y servicios desde XLSX / CSV / ODS / TSV

import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { getDB, run, get, all, persistDB } from '../config/db';
import { registrarLog } from '../utils/logger';
import { generarFolioProducto, generarFolio } from '../utils/folio';

// ── Mapeo flexible de nombres de columna ──────────────────────────
const COL_MAP: Record<string, string[]> = {
  nombre:     ['nombre', 'name', 'producto', 'product', 'descripcion', 'description', 'item',
               'articulo', 'artículo', 'denominacion', 'denominación'],
  sku:        ['sku', 'referencia', 'ref', 'codigo_interno', 'clave', 'clave_producto',
               'clave_articulo', 'clave_artículo', 'num_parte', 'numero_parte', 'número_parte',
               'part_number', 'part_no', 'modelo', 'modelo_producto', 'referencia_interna',
               'numero_de_parte', 'número_de_parte'],
  codigo:     ['codigo', 'código', 'code', 'barcode', 'codigo_barras', 'código_barras',
               'ean', 'upc', 'gtin', 'codigo_de_barras', 'código_de_barras'],
  tipo:       ['tipo', 'type', 'categoria', 'categoría', 'category', 'tipo_producto',
               'clasificacion', 'clasificación', 'familia'],
  compra:     ['compra', 'costo', 'cost', 'precio_compra', 'purchase', 'costo_unitario',
               'precio_costo', 'costo_neto'],
  venta:      ['venta', 'precio', 'price', 'precio_venta', 'sale', 'pvp',
               'precio_publico', 'precio_de_venta', 'p_venta'],
  existencia: ['existencia', 'stock', 'cantidad', 'inventory', 'qty', 'quantity', 'unidades',
               'inventario', 'disponible', 'piezas'],
};

// Normaliza el encabezado: minúsculas, sin acentos, espacios/guiones → _
function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar acentos
    .replace(/[\s\-\/\.]+/g, '_')                       // espacios, guiones, slashes → _
    .replace(/[^a-z0-9_]/g, '');                        // quitar caracteres especiales restantes
}

function mapHeader(raw: string): string | null {
  const key = normalizeKey(raw);
  // Exact match
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    if (aliases.includes(key)) return field;
  }
  // Fallback: si el key empieza con uno de los field names exactos (ej. "sku_interno" → sku)
  for (const field of Object.keys(COL_MAP)) {
    if (key === field || key.startsWith(field + '_') || key.startsWith(field + ' ')) return field;
  }
  return null;
}

function normalizeNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/[,$\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

function normalizeStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

interface ParsedRow {
  _line: number;
  nombre: string;
  sku: string;
  codigo: string;
  tipo: string;
  compra: number;
  venta: number;
  existencia: number;
}

interface DiffRow extends ParsedRow {
  status: 'nuevo' | 'actualizar' | 'sin_cambio' | 'error';
  error?: string;
  matchedId?: number;
  changes?: Record<string, { old: unknown; new: unknown }>;
}

interface ParseResult {
  rows: ParsedRow[];
  ignoredHeaders: string[];
}

function parseFile(fileBase64: string, fileName: string): ParseResult {
  const buf = Buffer.from(fileBase64, 'base64');

  const wb = XLSX.read(buf, {
    type: 'buffer',
    raw: false,
    cellDates: false,
  });

  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (raw.length < 2) return { rows: [], ignoredHeaders: [] };

  // Map headers — track which ones weren't recognized
  const rawHeaders = (raw[0] as unknown[]).map(h => String(h));
  const headers = rawHeaders.map(h => mapHeader(h));
  const ignoredHeaders = rawHeaders.filter((h, i) => h.trim() !== '' && headers[i] === null);

  const rows: ParsedRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i] as unknown[];
    // Skip completely empty rows
    if (cells.every(c => c === '' || c === null || c === undefined)) continue;

    const obj: Record<string, unknown> = {};
    headers.forEach((field, idx) => {
      if (field) obj[field] = cells[idx];
    });

    rows.push({
      _line: i + 1,
      nombre:     normalizeStr(obj.nombre),
      sku:        normalizeStr(obj.sku),
      codigo:     normalizeStr(obj.codigo),
      tipo:       normalizeStr(obj.tipo),
      compra:     normalizeNum(obj.compra),
      venta:      normalizeNum(obj.venta),
      existencia: normalizeNum(obj.existencia),
    });
  }
  return { rows, ignoredHeaders };
}

// POST /api/productos/importar/preview
export const importarPreview = async (req: Request, res: Response): Promise<void> => {
  const { fileBase64, fileName, local_id } = req.body;

  if (!fileBase64 || !fileName) {
    res.status(400).json({ error: 'Se requiere fileBase64 y fileName' }); return;
  }

  let parsed: ParseResult;
  try {
    parsed = parseFile(fileBase64, fileName);
  } catch (e) {
    res.status(400).json({ error: 'No se pudo leer el archivo. Verifica el formato.' }); return;
  }

  if (parsed.rows.length === 0) {
    res.status(400).json({ error: 'El archivo está vacío o sin encabezados reconocibles' }); return;
  }

  const { rows: parsedRows, ignoredHeaders } = parsed;

  const db = await getDB();

  // Load existing products for this empresa
  const existentes = all<{
    id: number; nombre: string; sku: string; codigo: string;
    tipo: string; compra: number; venta: number; existencia: number;
  }>(db,
    `SELECT id, nombre, sku, codigo, tipo, compra, venta, existencia
     FROM productos WHERE empresa_id = ?`,
    [req.user!.empresaId]
  );

  // Index for fast lookup
  const byCodigo = new Map<string, typeof existentes[0]>();
  const bySku    = new Map<string, typeof existentes[0]>();
  const byNombre = new Map<string, typeof existentes[0]>();
  existentes.forEach(p => {
    if (p.codigo) byCodigo.set(p.codigo.toLowerCase(), p);
    if (p.sku)    bySku.set(p.sku.toLowerCase(), p);
    byNombre.set(p.nombre.toLowerCase(), p);
  });

  const diff: DiffRow[] = parsedRows.map(row => {
    if (!row.nombre) {
      return { ...row, status: 'error', error: 'Nombre requerido' };
    }

    // Match existing
    let match: typeof existentes[0] | undefined;
    if (row.codigo) match = byCodigo.get(row.codigo.toLowerCase());
    if (!match && row.sku) match = bySku.get(row.sku.toLowerCase());
    if (!match) match = byNombre.get(row.nombre.toLowerCase());

    if (!match) {
      return { ...row, status: 'nuevo' };
    }

    // Compare fields
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    const cmp = (field: keyof typeof match, newVal: unknown) => {
      const oldVal = match![field];
      const a = String(oldVal ?? '').trim();
      const b = String(newVal ?? '').trim();
      if (a !== b) changes[field] = { old: oldVal, new: newVal };
    };
    cmp('nombre', row.nombre);
    cmp('sku', row.sku);
    cmp('codigo', row.codigo);
    cmp('tipo', row.tipo);
    cmp('compra', row.compra);
    cmp('venta', row.venta);
    cmp('existencia', row.existencia);

    const status = Object.keys(changes).length > 0 ? 'actualizar' : 'sin_cambio';
    return { ...row, status, matchedId: match.id, changes };
  });

  const stats = {
    nuevo:      diff.filter(r => r.status === 'nuevo').length,
    actualizar: diff.filter(r => r.status === 'actualizar').length,
    sin_cambio: diff.filter(r => r.status === 'sin_cambio').length,
    error:      diff.filter(r => r.status === 'error').length,
    total:      diff.length,
  };

  res.json({ rows: diff, stats, ignoredHeaders });
};

// POST /api/productos/importar/confirmar
export const importarConfirmar = async (req: Request, res: Response): Promise<void> => {
  const { rows, local_id } = req.body as {
    rows: DiffRow[];
    local_id?: number;
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'No hay filas para importar' }); return;
  }

  const db = await getDB();
  const { empresaId, localId, tipo } = req.user!;
  const effectiveLocalId = (tipo === 'root' || tipo === 'admin') ? (local_id || localId) : localId;

  if (!effectiveLocalId) {
    res.status(400).json({ error: 'Se requiere un local para importar productos' }); return;
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  const toImport = rows.filter(r => r.status === 'nuevo' || r.status === 'actualizar');

  for (const row of toImport) {
    try {
      if (row.status === 'nuevo') {
        const result = run(db,
          `INSERT INTO productos (codigo, sku, tipo, nombre, compra, venta, existencia, local_id, empresa_id)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          ['TEMP', row.sku || null, row.tipo || null, row.nombre,
           row.compra, row.venta, row.existencia, effectiveLocalId, empresaId]
        );
        const newId = result.lastInsertRowid;
        const folio = generarFolioProducto(db, empresaId, Number(newId));
        run(db, 'UPDATE productos SET folio = ?, codigo = ? WHERE id = ?',
          [folio, row.codigo || '', newId]);
        created++;
      } else if (row.status === 'actualizar' && row.matchedId) {
        run(db,
          `UPDATE productos SET sku=?, codigo=?, tipo=?, nombre=?, compra=?, venta=?, existencia=?
           WHERE id=? AND empresa_id=?`,
          [row.sku || null, row.codigo || '', row.tipo || null, row.nombre,
           row.compra, row.venta, row.existencia, row.matchedId, empresaId]
        );
        updated++;
      }
    } catch (e) {
      errors.push(`Línea ${row._line} (${row.nombre}): ${(e as Error).message}`);
    }
  }

  persistDB();

  registrarLog({
    db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo,
    usuarioTipo: req.user!.tipo, accion: 'crear', modulo: 'productos',
    entidadId: 0, ip: req.ip, empresaId,
    descripcion: `Importación masiva: ${created} creados, ${updated} actualizados, ${errors.length} errores`,
  });

  res.json({ created, updated, errors, total: created + updated });
};

// ═══════════════════════════════════════════════════════════════════
// CLIENTES IMPORT
// ═══════════════════════════════════════════════════════════════════

const COL_MAP_CLIENTES: Record<string, string[]> = {
  nombre:       ['nombre', 'name', 'cliente', 'customer', 'razon_social', 'razón_social', 'denominacion', 'denominación'],
  telefono:     ['telefono', 'teléfono', 'phone', 'tel', 'celular', 'movil', 'móvil', 'whatsapp', 'numero_telefono'],
  correo:       ['correo', 'email', 'mail', 'e_mail', 'correo_electronico', 'correo_electrónico'],
  direccion:    ['direccion', 'dirección', 'address', 'domicilio', 'calle', 'ubicacion', 'ubicación'],
  notas:        ['notas', 'notes', 'observaciones', 'comentarios', 'obs'],
  tipo_cliente: ['tipo_cliente', 'tipo', 'type', 'categoria', 'categoría', 'category', 'rol', 'role', 'clasificacion', 'clasificación'],
};

interface ParsedClienteRow {
  _line: number;
  nombre: string;
  telefono: string;
  correo: string;
  direccion: string;
  notas: string;
  tipo_cliente: string;
}

interface DiffClienteRow extends ParsedClienteRow {
  status: 'nuevo' | 'actualizar' | 'sin_cambio' | 'error';
  error?: string;
  matchedId?: number;
  changes?: Record<string, { old: unknown; new: unknown }>;
}

function parseFileClientes(fileBase64: string): { rows: ParsedClienteRow[]; ignoredHeaders: string[] } {
  const buf = Buffer.from(fileBase64, 'base64');
  const wb = XLSX.read(buf, { type: 'buffer', raw: false, cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (raw.length < 2) return { rows: [], ignoredHeaders: [] };

  const rawHeaders = (raw[0] as unknown[]).map(h => String(h));
  const headers = rawHeaders.map(h => {
    const key = normalizeKey(h);
    for (const [field, aliases] of Object.entries(COL_MAP_CLIENTES)) {
      if (aliases.includes(key)) return field;
    }
    for (const field of Object.keys(COL_MAP_CLIENTES)) {
      if (key === field || key.startsWith(field + '_')) return field;
    }
    return null;
  });
  const ignoredHeaders = rawHeaders.filter((h, i) => h.trim() !== '' && headers[i] === null);

  const rows: ParsedClienteRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i] as unknown[];
    if (cells.every(c => c === '' || c === null || c === undefined)) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((field, idx) => { if (field) obj[field] = cells[idx]; });
    rows.push({
      _line: i + 1,
      nombre:       normalizeStr(obj.nombre),
      telefono:     normalizeStr(obj.telefono),
      correo:       normalizeStr(obj.correo),
      direccion:    normalizeStr(obj.direccion),
      notas:        normalizeStr(obj.notas),
      tipo_cliente: normalizeStr(obj.tipo_cliente),
    });
  }
  return { rows, ignoredHeaders };
}

export const importarClientesPreview = async (req: Request, res: Response): Promise<void> => {
  const { fileBase64, fileName } = req.body;
  if (!fileBase64 || !fileName) { res.status(400).json({ error: 'Se requiere fileBase64 y fileName' }); return; }

  let parsed: { rows: ParsedClienteRow[]; ignoredHeaders: string[] };
  try {
    parsed = parseFileClientes(fileBase64);
  } catch {
    res.status(400).json({ error: 'No se pudo leer el archivo. Verifica el formato.' }); return;
  }
  if (parsed.rows.length === 0) { res.status(400).json({ error: 'El archivo está vacío o sin encabezados reconocibles' }); return; }

  const db = await getDB();
  const existentes = all<{ id: number; nombre: string; telefono: string; correo: string; direccion: string; notas: string; tipo_cliente: string }>(
    db,
    `SELECT id, nombre, telefono, correo, direccion, notas, tipo_cliente FROM personas WHERE empresa_id = ? AND (',' || roles || ',') LIKE '%,cliente,%'`,
    [req.user!.empresaId]
  );

  const byCorreo = new Map<string, typeof existentes[0]>();
  const byTel    = new Map<string, typeof existentes[0]>();
  const byNombre = new Map<string, typeof existentes[0]>();
  existentes.forEach(c => {
    if (c.correo)  byCorreo.set(c.correo.toLowerCase(), c);
    if (c.telefono) byTel.set(c.telefono.replace(/\D/g, ''), c);
    byNombre.set(c.nombre.toLowerCase(), c);
  });

  const diff: DiffClienteRow[] = parsed.rows.map(row => {
    if (!row.nombre) return { ...row, status: 'error' as const, error: 'Nombre requerido' };
    let match = row.correo ? byCorreo.get(row.correo.toLowerCase()) : undefined;
    if (!match && row.telefono) match = byTel.get(row.telefono.replace(/\D/g, ''));
    if (!match) match = byNombre.get(row.nombre.toLowerCase());
    if (!match) return { ...row, status: 'nuevo' as const };

    const changes: Record<string, { old: unknown; new: unknown }> = {};
    const cmp = (field: keyof typeof match, newVal: string) => {
      const a = String(match![field] ?? '').trim();
      if (a !== newVal && newVal !== '') changes[field] = { old: match![field], new: newVal };
    };
    cmp('nombre', row.nombre); cmp('telefono', row.telefono);
    cmp('correo', row.correo); cmp('direccion', row.direccion);
    cmp('notas', row.notas);   cmp('tipo_cliente', row.tipo_cliente);

    const status = Object.keys(changes).length > 0 ? 'actualizar' as const : 'sin_cambio' as const;
    return { ...row, status, matchedId: match.id, changes };
  });

  const stats = {
    nuevo:      diff.filter(r => r.status === 'nuevo').length,
    actualizar: diff.filter(r => r.status === 'actualizar').length,
    sin_cambio: diff.filter(r => r.status === 'sin_cambio').length,
    error:      diff.filter(r => r.status === 'error').length,
    total:      diff.length,
  };
  res.json({ rows: diff, stats, ignoredHeaders: parsed.ignoredHeaders });
};

export const importarClientesConfirmar = async (req: Request, res: Response): Promise<void> => {
  const { rows } = req.body as { rows: DiffClienteRow[] };
  if (!Array.isArray(rows) || rows.length === 0) { res.status(400).json({ error: 'No hay filas para importar' }); return; }

  const db = await getDB();
  const { empresaId, localId } = req.user!;
  let created = 0, updated = 0;
  const errors: string[] = [];

  for (const row of rows.filter(r => r.status === 'nuevo' || r.status === 'actualizar')) {
    try {
      if (row.status === 'nuevo') {
        run(db,
          `INSERT INTO personas (nombre, telefono, correo, direccion, notas, tipo_cliente, roles, empresa_id, local_id)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [row.nombre, row.telefono || null, row.correo || null, row.direccion || null,
           row.notas || null, row.tipo_cliente || 'regular', 'cliente', empresaId, localId || null]
        );
        created++;
      } else if (row.matchedId) {
        const sets = ['nombre=?'];
        const vals: (string | number | null)[] = [row.nombre];
        if (row.telefono)     { sets.push('telefono=?');     vals.push(row.telefono); }
        if (row.correo)       { sets.push('correo=?');       vals.push(row.correo); }
        if (row.direccion)    { sets.push('direccion=?');    vals.push(row.direccion); }
        if (row.notas)        { sets.push('notas=?');        vals.push(row.notas); }
        if (row.tipo_cliente) { sets.push('tipo_cliente=?'); vals.push(row.tipo_cliente); }
        vals.push(row.matchedId, empresaId);
        run(db, `UPDATE personas SET ${sets.join(', ')} WHERE id=? AND empresa_id=?`, vals);
        updated++;
      }
    } catch (e) {
      errors.push(`Línea ${row._line} (${row.nombre}): ${(e as Error).message}`);
    }
  }

  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'crear', modulo: 'clientes', entidadId: 0, ip: req.ip, empresaId,
    descripcion: `Importación clientes: ${created} creados, ${updated} actualizados, ${errors.length} errores` });

  res.json({ created, updated, errors, total: created + updated });
};

// ═══════════════════════════════════════════════════════════════════
// SERVICIOS IMPORT
// ═══════════════════════════════════════════════════════════════════

const COL_MAP_SERVICIOS: Record<string, string[]> = {
  cliente:         ['cliente', 'customer', 'nombre_cliente', 'client', 'cliente_nombre', 'propietario', 'dueno', 'dueño'],
  modelo:          ['modelo', 'model', 'equipo', 'device', 'aparato', 'tipo_equipo'],
  falla:           ['falla', 'falla_reportada', 'problema', 'problem', 'issue', 'fault', 'descripcion_falla'],
  descripcion:     ['descripcion', 'descripción', 'description', 'detalle', 'nota_tecnico', 'diagnostico', 'diagnóstico'],
  garantia:        ['garantia', 'garantía', 'warranty', 'dias_garantia'],
  estado:          ['estado', 'status', 'estatus', 'state', 'etapa'],
  fecha_entrada:   ['fecha_entrada', 'fecha', 'date', 'ingreso', 'entrada', 'recepcion', 'recepción', 'fecha_ingreso'],
  fecha_salida:    ['fecha_salida', 'salida', 'fecha_entrega', 'entrega', 'delivery_date'],
  costo_total:     ['costo_total', 'precio', 'price', 'total', 'costo', 'cost', 'importe', 'monto', 'cobro'],
  anticipo:        ['anticipo', 'adelanto', 'deposito', 'depósito', 'down_payment', 'anticipo_pagado'],
  costo_refaccion: ['costo_refaccion', 'costo_refacción', 'refaccion', 'refacción', 'parts_cost', 'costo_piezas'],
  num_serie:       ['num_serie', 'serie', 'serial', 'serial_number', 'numero_serie', 'número_serie', 'ns', 'sn', 'imei'],
};

interface ParsedServicioRow {
  _line: number;
  cliente: string;
  modelo: string;
  falla: string;
  descripcion: string;
  garantia: string;
  estado: string;
  fecha_entrada: string;
  fecha_salida: string;
  costo_total: number;
  anticipo: number;
  costo_refaccion: number;
  num_serie: string;
}

interface DiffServicioRow extends ParsedServicioRow {
  status: 'nuevo' | 'actualizar' | 'sin_cambio' | 'error';
  error?: string;
  matchedId?: number;
  clienteId?: number;
  changes?: Record<string, { old: unknown; new: unknown }>;
}

function normalizeDate(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' && v > 1000 && v < 100000) {
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().substring(0, 10);
  }
  const s = String(v).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  if (/^\d{2}-\d{2}-\d{4}/.test(s)) {
    const [d, m, y] = s.split('-');
    return `${y}-${m}-${d}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().substring(0, 10);
  return s;
}

function parseFileServicios(fileBase64: string): { rows: ParsedServicioRow[]; ignoredHeaders: string[] } {
  const buf = Buffer.from(fileBase64, 'base64');
  const wb = XLSX.read(buf, { type: 'buffer', raw: false, cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (raw.length < 2) return { rows: [], ignoredHeaders: [] };

  const rawHeaders = (raw[0] as unknown[]).map(h => String(h));
  const headers = rawHeaders.map(h => {
    const key = normalizeKey(h);
    for (const [field, aliases] of Object.entries(COL_MAP_SERVICIOS)) {
      if (aliases.includes(key)) return field;
    }
    for (const field of Object.keys(COL_MAP_SERVICIOS)) {
      if (key === field || key.startsWith(field + '_')) return field;
    }
    return null;
  });
  const ignoredHeaders = rawHeaders.filter((h, i) => h.trim() !== '' && headers[i] === null);

  const rows: ParsedServicioRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i] as unknown[];
    if (cells.every(c => c === '' || c === null || c === undefined)) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((field, idx) => { if (field) obj[field] = cells[idx]; });
    rows.push({
      _line:          i + 1,
      cliente:        normalizeStr(obj.cliente),
      modelo:         normalizeStr(obj.modelo),
      falla:          normalizeStr(obj.falla),
      descripcion:    normalizeStr(obj.descripcion),
      garantia:       normalizeStr(obj.garantia),
      estado:         normalizeStr(obj.estado),
      fecha_entrada:  normalizeDate(obj.fecha_entrada),
      fecha_salida:   normalizeDate(obj.fecha_salida),
      costo_total:    normalizeNum(obj.costo_total),
      anticipo:       normalizeNum(obj.anticipo),
      costo_refaccion:normalizeNum(obj.costo_refaccion),
      num_serie:      normalizeStr(obj.num_serie),
    });
  }
  return { rows, ignoredHeaders };
}

export const importarServiciosPreview = async (req: Request, res: Response): Promise<void> => {
  const { fileBase64, fileName } = req.body;
  if (!fileBase64 || !fileName) { res.status(400).json({ error: 'Se requiere fileBase64 y fileName' }); return; }

  let parsed: { rows: ParsedServicioRow[]; ignoredHeaders: string[] };
  try {
    parsed = parseFileServicios(fileBase64);
  } catch {
    res.status(400).json({ error: 'No se pudo leer el archivo. Verifica el formato.' }); return;
  }
  if (parsed.rows.length === 0) { res.status(400).json({ error: 'El archivo está vacío o sin encabezados reconocibles' }); return; }

  const db = await getDB();
  const { empresaId } = req.user!;

  // Index existing services by num_serie for dedup detection
  const srvBySerie = new Map<string, { id: number; modelo: string; estado: string; costo_total: number }>();
  all<{ id: number; num_serie: string; modelo: string; estado: string; costo_total: number }>(
    db, `SELECT id, num_serie, modelo, estado, costo_total FROM servicios WHERE empresa_id = ? AND num_serie != '' AND num_serie IS NOT NULL`, [empresaId]
  ).forEach(s => srvBySerie.set(s.num_serie.toLowerCase(), s));

  const diff: DiffServicioRow[] = parsed.rows.map(row => {
    if (!row.cliente)  return { ...row, status: 'error' as const, error: 'Cliente requerido' };
    if (!row.modelo)   return { ...row, status: 'error' as const, error: 'Modelo requerido' };
    if (!row.falla)    return { ...row, status: 'error' as const, error: 'Falla requerida' };

    if (row.num_serie) {
      const existing = srvBySerie.get(row.num_serie.toLowerCase());
      if (existing) {
        const changes: Record<string, { old: unknown; new: unknown }> = {};
        if (row.modelo !== existing.modelo) changes['modelo'] = { old: existing.modelo, new: row.modelo };
        if (row.estado && row.estado !== existing.estado) changes['estado'] = { old: existing.estado, new: row.estado };
        if (row.costo_total && row.costo_total !== existing.costo_total) changes['costo_total'] = { old: existing.costo_total, new: row.costo_total };
        const status = Object.keys(changes).length > 0 ? 'actualizar' as const : 'sin_cambio' as const;
        return { ...row, status, matchedId: existing.id, changes };
      }
    }
    return { ...row, status: 'nuevo' as const };
  });

  const stats = {
    nuevo:      diff.filter(r => r.status === 'nuevo').length,
    actualizar: diff.filter(r => r.status === 'actualizar').length,
    sin_cambio: diff.filter(r => r.status === 'sin_cambio').length,
    error:      diff.filter(r => r.status === 'error').length,
    total:      diff.length,
  };
  res.json({ rows: diff, stats, ignoredHeaders: parsed.ignoredHeaders });
};

export const importarServiciosConfirmar = async (req: Request, res: Response): Promise<void> => {
  const { rows, local_id } = req.body as { rows: DiffServicioRow[]; local_id?: number };
  if (!Array.isArray(rows) || rows.length === 0) { res.status(400).json({ error: 'No hay filas para importar' }); return; }

  const db = await getDB();
  const { empresaId, localId, userId, tipo } = req.user!;
  const effectiveLocalId = (tipo === 'root' || tipo === 'admin') ? (local_id || localId) : localId;

  if (!effectiveLocalId) { res.status(400).json({ error: 'Se requiere un local para importar servicios' }); return; }

  // Cache of client lookups to avoid repeated queries per name
  const clienteCache = new Map<string, number>();
  const toImport = rows.filter(r => r.status === 'nuevo' || r.status === 'actualizar');

  let created = 0, updated = 0;
  const errors: string[] = [];

  for (const row of toImport) {
    try {
      if (row.status === 'actualizar' && row.matchedId) {
        const sets: string[] = [];
        const vals: (string | number | null)[] = [];
        if (row.modelo)       { sets.push('modelo=?');        vals.push(row.modelo); }
        if (row.estado)       { sets.push('estado=?');        vals.push(row.estado); }
        if (row.costo_total)  { sets.push('costo_total=?');   vals.push(row.costo_total); }
        if (row.fecha_salida) { sets.push('fecha_salida=?');  vals.push(row.fecha_salida); }
        if (sets.length > 0) {
          vals.push(row.matchedId, empresaId);
          run(db, `UPDATE servicios SET ${sets.join(', ')} WHERE id=? AND empresa_id=?`, vals);
        }
        updated++;
        continue;
      }

      // Resolve or create cliente
      let clienteId: number = clienteCache.get(row.cliente.toLowerCase()) ?? 0;
      if (!clienteId) {
        const existing = get<{ id: number }>(db,
          `SELECT id FROM personas WHERE empresa_id=? AND (',' || roles || ',') LIKE '%,cliente,%' AND lower(nombre)=lower(?)`,
          [empresaId, row.cliente]
        );
        if (existing) {
          clienteId = existing.id;
        } else {
          const r = run(db,
            `INSERT INTO personas (nombre, roles, tipo_cliente, empresa_id, local_id) VALUES (?,?,?,?,?)`,
            [row.cliente, 'cliente', 'regular', empresaId, effectiveLocalId]
          );
          clienteId = r.lastInsertRowid;
        }
        clienteCache.set(row.cliente.toLowerCase(), clienteId);
      }

      const fechaEntrada = row.fecha_entrada || new Date().toISOString().substring(0, 10);
      const result = run(db,
        `INSERT INTO servicios (folio, cliente_id, modelo, num_serie, falla, descripcion,
           garantia, estado, fecha_entrada, fecha_salida, anticipo, costo_refaccion, costo_total,
           usuario_id, local_id, empresa_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ['TEMP', clienteId, row.modelo, row.num_serie || null, row.falla, row.descripcion || null,
         row.garantia || 'Sin garantia', row.estado || 'Recibido',
         fechaEntrada, row.fecha_salida || null,
         row.anticipo, row.costo_refaccion, row.costo_total,
         userId, effectiveLocalId, empresaId]
      );
      const newId = result.lastInsertRowid;
      const folio = generarFolio(db, empresaId, newId);
      run(db, 'UPDATE servicios SET folio=? WHERE id=?', [folio, newId]);

      // Register anticipo as payment if present
      if (row.anticipo > 0) {
        run(db,
          `INSERT INTO pagos_servicio (servicio_id, monto, metodo, concepto, usuario_id, local_id, empresa_id, fuera_caja)
           VALUES (?,?,?,?,?,?,?,?)`,
          [Number(newId), row.anticipo, 'efectivo', 'anticipo', userId, effectiveLocalId, empresaId, 1]
        );
      }
      created++;
    } catch (e) {
      errors.push(`Línea ${row._line} (${row.cliente} - ${row.modelo}): ${(e as Error).message}`);
    }
  }

  persistDB();
  registrarLog({ db, usuarioId: userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'crear', modulo: 'servicios', entidadId: 0, ip: req.ip, empresaId,
    descripcion: `Importación servicios: ${created} creados, ${updated} actualizados, ${errors.length} errores` });

  res.json({ created, updated, errors, total: created + updated });
};
