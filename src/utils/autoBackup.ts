// src/utils/autoBackup.ts
//
// Sistema de backup automático + auto-restore de la base de datos SQLite.
//
// Flujo en cada arranque del servidor:
//   1. Antes de initDB(), si la BD destino "parece vacía" (no existe o muy chica),
//      buscamos el backup más reciente en data/backups/ y lo copiamos a la ruta
//      de la BD. Así, después de un push/redeploy que borra el volumen, el
//      servidor restaura solo la última versión sin intervención manual.
//   2. Cada N minutos (default 30), guardamos una copia del archivo .db en
//      data/backups/ con timestamp en el nombre.
//   3. Rotación: mantenemos los últimos MAX backups y borramos los más viejos.
//
// Configurable por variables de entorno (todas opcionales):
//   DB_PATH                   – ruta del .db (default ./database/techservice.db)
//   BACKUP_DIR                – carpeta de backups (default ./data/backups)
//   BACKUP_INTERVAL_MINUTES   – cada cuántos minutos hacer backup (default 30)
//   BACKUP_KEEP               – cuántos backups conservar (default 48)
//   BACKUP_MIN_BYTES          – si la BD pesa menos que esto al arrancar, se considera vacía (default 50 KB)

import fs from 'fs';
import path from 'path';

const DB_PATH    = path.resolve(process.env.DB_PATH || './database/techservice.db');
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || './data/backups');
const INTERVAL_MIN = parseInt(process.env.BACKUP_INTERVAL_MINUTES || '30');
const KEEP_MAX     = parseInt(process.env.BACKUP_KEEP || '48');
const MIN_BYTES    = parseInt(process.env.BACKUP_MIN_BYTES || String(50 * 1024)); // 50 KB

let _scheduler: NodeJS.Timeout | null = null;

function ensureDirs(): void {
  if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  if (!fs.existsSync(BACKUP_DIR))            fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Genera un nombre de archivo con timestamp legible y ordenable lexicográficamente.
function timestampName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `techservice-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.db`;
}

export function listBackups(): Array<{ name: string; size: number; mtime: Date; path: string }> {
  ensureDirs();
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db'))
    .map(f => {
      const full = path.join(BACKUP_DIR, f);
      const st = fs.statSync(full);
      return { name: f, size: st.size, mtime: st.mtime, path: full };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // más reciente primero
}

// Crea una copia del .db actual. Retorna el nombre del backup, o null si no hay nada que copiar.
export function backupNow(): string | null {
  try {
    ensureDirs();
    if (!fs.existsSync(DB_PATH)) return null;
    const stat = fs.statSync(DB_PATH);
    if (stat.size < MIN_BYTES) {
      // No respaldamos BDs casi vacías para no llenar de basura el folder.
      return null;
    }
    const name = timestampName();
    const dest = path.join(BACKUP_DIR, name);
    fs.copyFileSync(DB_PATH, dest);
    pruneOldBackups();
    return name;
  } catch (e: any) {
    console.error('[autoBackup] backupNow falló:', e?.message || e);
    return null;
  }
}

// Mantiene solo los KEEP_MAX más recientes, borra el resto.
function pruneOldBackups(): void {
  try {
    const all = listBackups();
    const toDelete = all.slice(KEEP_MAX);
    for (const f of toDelete) {
      try { fs.unlinkSync(f.path); } catch {}
    }
  } catch {}
}

// Restaura desde el backup más reciente si la BD destino está vacía o no existe.
// Se llama ANTES de initDB() para que sql.js cargue ya la BD restaurada.
// Retorna true si se restauró, false si no.
export function restoreFromLatestIfEmpty(): boolean {
  try {
    ensureDirs();
    const exists = fs.existsSync(DB_PATH);
    const size   = exists ? fs.statSync(DB_PATH).size : 0;
    if (exists && size >= MIN_BYTES) return false; // BD parece tener datos reales

    const backups = listBackups();
    if (!backups.length) {
      console.log(`[autoBackup] BD destino vacía (${size} bytes) y no hay backups disponibles.`);
      return false;
    }
    const latest = backups[0];
    console.log(`[autoBackup] BD destino vacía (${size} bytes). Restaurando desde ${latest.name} (${(latest.size / 1024).toFixed(0)} KB)...`);
    fs.copyFileSync(latest.path, DB_PATH);
    console.log(`[autoBackup] ✓ Restauración completada.`);
    return true;
  } catch (e: any) {
    console.error('[autoBackup] restoreFromLatestIfEmpty falló:', e?.message || e);
    return false;
  }
}

// Restaura desde un backup específico (por nombre). Usado por endpoint admin.
export function restoreFromBackup(filename: string): boolean {
  const safe = path.basename(filename); // evita path traversal
  const src = path.join(BACKUP_DIR, safe);
  if (!fs.existsSync(src)) return false;
  ensureDirs();
  fs.copyFileSync(src, DB_PATH);
  return true;
}

// Borra un backup específico.
export function deleteBackup(filename: string): boolean {
  const safe = path.basename(filename);
  const target = path.join(BACKUP_DIR, safe);
  if (!fs.existsSync(target)) return false;
  fs.unlinkSync(target);
  return true;
}

// Arranca el scheduler periódico. Idempotente: si ya hay uno corriendo, no duplica.
export function startBackupScheduler(): void {
  if (_scheduler) return;
  ensureDirs();
  const ms = Math.max(1, INTERVAL_MIN) * 60 * 1000;
  console.log(`[autoBackup] Scheduler activo. Backup cada ${INTERVAL_MIN} min en ${BACKUP_DIR}. Conservar ${KEEP_MAX} archivos.`);
  // Backup inicial 30s después de arrancar (para no chocar con la persistencia inicial de sql.js).
  setTimeout(() => {
    const name = backupNow();
    if (name) console.log(`[autoBackup] Backup inicial creado: ${name}`);
  }, 30 * 1000);
  // Schedule recurrente
  _scheduler = setInterval(() => {
    const name = backupNow();
    if (name) console.log(`[autoBackup] Backup periódico creado: ${name}`);
  }, ms);
}

export function stopBackupScheduler(): void {
  if (_scheduler) { clearInterval(_scheduler); _scheduler = null; }
}

// Información para la UI / debug
export function getBackupInfo() {
  return {
    db_path: DB_PATH,
    backup_dir: BACKUP_DIR,
    interval_minutes: INTERVAL_MIN,
    keep_max: KEEP_MAX,
    min_bytes_threshold: MIN_BYTES,
    backups_count: listBackups().length,
    scheduler_running: _scheduler !== null,
  };
}
