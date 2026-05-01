// src/utils/folio.ts
// Genera folios: [INICIALES][DDMMAA][00001]  Ej: TS25032600001

import { Database } from 'sql.js';
import { get } from '../config/db';

function getIniciales(db: Database, empresaId: number): string {
  const empresa = get<{ iniciales: string }>(db, 'SELECT iniciales FROM empresa WHERE id = ?', [empresaId]);
  return (empresa?.iniciales || 'TS').toUpperCase().substring(0, 4);
}

function getFecha(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const aa = String(now.getFullYear()).substring(2);
  return `${dd}${mm}${aa}`;
}

// Si se pasa `id` se usa como secuencial (útil en imports masivos para evitar
// duplicados por COUNT(*) en transacciones paralelas). Si no, se calcula con COUNT.
export function generarFolio(db: Database, empresaId: number, id?: number | bigint): string {
  let seq: number;
  if (typeof id === 'number' || typeof id === 'bigint') {
    seq = Number(id);
  } else {
    const r = get<{ n: number }>(db, 'SELECT COUNT(*) as n FROM servicios WHERE empresa_id = ?', [empresaId]);
    seq = r?.n || 1;
  }
  return `${getIniciales(db, empresaId)}${getFecha()}${String(seq).padStart(5, '0')}`;
}

export function generarFolioVenta(db: Database, empresaId: number, id: number): string {
  return `V${getIniciales(db, empresaId)}${getFecha()}${String(id).padStart(5, '0')}`;
}

export function generarFolioProducto(db: Database, empresaId: number, id?: number | bigint): string {
  let seq: number;
  if (typeof id === 'number' || typeof id === 'bigint') {
    seq = Number(id);
  } else {
    const r = get<{ n: number }>(db, 'SELECT COUNT(*) as n FROM productos WHERE empresa_id = ?', [empresaId]);
    seq = r?.n || 1;
  }
  return `${getIniciales(db, empresaId)}${getFecha()}${String(seq).padStart(5, '0')}`;
}

