// src/controllers/importController.ts
// Importación masiva de productos desde XLSX / CSV / ODS / TSV

import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { getDB, run, get, all, persistDB } from '../config/db';
import { registrarLog } from '../utils/logger';
import { generarFolioProducto } from '../utils/folio';

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
