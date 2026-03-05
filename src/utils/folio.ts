// src/utils/folio.ts
// Genera folios: [INICIALES][DDMMAA][ID]  Ej: TS050326001

import { Database } from 'sql.js';
import { get } from '../config/db';

export function generarFolio(db: Database, empresaId: number, id: number): string {
  const empresa = get<{ iniciales: string }>(db, 'SELECT iniciales FROM empresa WHERE id = ?', [empresaId]);
  const iniciales = (empresa?.iniciales || 'TS').toUpperCase().substring(0, 2);

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const aa = String(now.getFullYear()).substring(2);

  return `${iniciales}${dd}${mm}${aa}${String(id).padStart(3, '0')}`;
}

export function generarFolioVenta(db: Database, empresaId: number, id: number): string {
  return 'V' + generarFolio(db, empresaId, id);
}

