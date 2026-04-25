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

export function generarFolio(db: Database, empresaId: number, id: number): string {
  return `${getIniciales(db, empresaId)}${getFecha()}${String(id).padStart(5, '0')}`;
}

export function generarFolioVenta(db: Database, empresaId: number, id: number): string {
  return 'V' + generarFolio(db, empresaId, id);
}

export function generarFolioProducto(db: Database, empresaId: number, id: number): string {
  return `${getIniciales(db, empresaId)}${getFecha()}${String(id).padStart(5, '0')}`;
}

