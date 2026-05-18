// src/controllers/adminDbController.ts
// Endpoints root-only para descargar/subir el archivo .db de SQLite.
// Útil cuando no se tiene acceso SSH al servidor (Hostinger sin terminal, etc.).
//
// IMPORTANTE: estos endpoints exponen toda la base de datos. Sólo root puede usarlos.
// Si se piensa quitar después de la migración inicial, basta con eliminar las rutas.

import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { persistDB, getDB } from '../config/db';
import {
  listBackups, backupNow, restoreFromBackup, deleteBackup, getBackupInfo,
} from '../utils/autoBackup';

const DB_PATH = path.resolve(process.env.DB_PATH || './database/techservice.db');

// GET /api/admin/database/download
// Descarga el archivo .db actual. Persiste primero la BD en memoria a disco
// para asegurar que el archivo descargado refleja el estado actual.
export const downloadDatabase = async (req: Request, res: Response): Promise<void> => {
  try {
    // Asegurarse de que la BD en memoria esté flushed a disco
    await getDB();
    persistDB();

    if (!fs.existsSync(DB_PATH)) {
      res.status(404).json({ error: 'No existe el archivo de base de datos en el servidor' });
      return;
    }

    const stat = fs.statSync(DB_PATH);
    const filename = `techservice-${new Date().toISOString().substring(0, 19).replace(/[:T]/g, '-')}.db`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    fs.createReadStream(DB_PATH).pipe(res);
  } catch (e: any) {
    res.status(500).json({ error: 'Error al descargar la BD: ' + (e?.message || e) });
  }
};

// POST /api/admin/database/upload
// Reemplaza la base de datos actual con un archivo .db enviado en el body
// (como raw application/octet-stream).
//
// IMPORTANTE: tras escribir el archivo, el proceso se TERMINA con exit(0) para que
// Docker (restart: unless-stopped) lo reinicie y cargue la BD nueva desde disco.
// Si no se ejecuta dentro de Docker, hay que reiniciar manualmente.
export const uploadDatabase = async (req: Request, res: Response): Promise<void> => {
  try {
    const buf = req.body as Buffer;
    if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) {
      res.status(400).json({ error: 'No se recibió archivo. Envía el .db como application/octet-stream.' });
      return;
    }

    // Validar que es un SQLite válido. La firma mágica de SQLite empieza con
    // "SQLite format 3\0" (16 bytes).
    const magic = buf.slice(0, 16).toString('utf-8').replace(/\0$/, '');
    if (magic !== 'SQLite format 3') {
      res.status(400).json({ error: 'El archivo no es una base de datos SQLite válida.' });
      return;
    }

    // Tamaño mínimo razonable (1 KB)
    if (buf.length < 1024) {
      res.status(400).json({ error: 'El archivo es demasiado pequeño para ser una BD válida.' });
      return;
    }

    // Backup automático del .db actual antes de reemplazar
    if (fs.existsSync(DB_PATH)) {
      const backupPath = DB_PATH + '.backup-' + Date.now();
      try {
        fs.copyFileSync(DB_PATH, backupPath);
        console.log(`[admin] Backup creado: ${backupPath}`);
      } catch (e) {
        console.warn('[admin] No se pudo crear backup, continúa:', e);
      }
    }

    // Asegurar que el directorio existe
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Escribir la nueva BD
    fs.writeFileSync(DB_PATH, buf);
    console.log(`[admin] BD reemplazada (${buf.length} bytes). Reiniciando proceso...`);

    res.json({
      ok: true,
      message: 'BD reemplazada. El servidor se reiniciará en 1 segundo para cargar los cambios.',
      bytes: buf.length,
    });

    // Esperar a que la respuesta se envíe y terminar el proceso para que Docker
    // (restart: unless-stopped) reinicie el contenedor con la BD nueva en memoria.
    setTimeout(() => process.exit(0), 1000);
  } catch (e: any) {
    console.error('[admin] Error al subir BD:', e);
    res.status(500).json({ error: 'Error al subir la BD: ' + (e?.message || e) });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// Backups automáticos: listar / crear / restaurar / borrar
// ───────────────────────────────────────────────────────────────────────────

// GET /api/admin/database/backups
export const listBackupsHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const backups = listBackups().map(b => ({
      name: b.name,
      size: b.size,
      mtime: b.mtime.toISOString(),
    }));
    res.json({ ok: true, info: getBackupInfo(), backups });
  } catch (e: any) {
    res.status(500).json({ error: 'No se pudo listar los backups: ' + (e?.message || e) });
  }
};

// POST /api/admin/database/backup-now
// Persiste la BD en memoria a disco y luego crea un backup inmediato.
export const backupNowHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    await getDB();
    persistDB();
    const name = backupNow();
    if (!name) {
      res.status(400).json({ error: 'No hay BD que respaldar o no superó el tamaño mínimo' });
      return;
    }
    res.json({ ok: true, name });
  } catch (e: any) {
    res.status(500).json({ error: 'Error al crear backup: ' + (e?.message || e) });
  }
};

// POST /api/admin/database/restore
// Body: { name: "techservice-..." }
// Restaura desde un backup específico y reinicia el proceso.
export const restoreBackupHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name de backup requerido' }); return;
    }
    const ok = restoreFromBackup(name);
    if (!ok) { res.status(404).json({ error: 'Backup no encontrado' }); return; }
    res.json({ ok: true, message: 'Backup restaurado. El servidor se reiniciará en 1 segundo.' });
    setTimeout(() => process.exit(0), 1000);
  } catch (e: any) {
    res.status(500).json({ error: 'Error al restaurar backup: ' + (e?.message || e) });
  }
};

// DELETE /api/admin/database/backups/:name — borra un backup específico
export const deleteBackupHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = req.params.name;
    if (!name) { res.status(400).json({ error: 'name requerido' }); return; }
    const ok = deleteBackup(name);
    if (!ok) { res.status(404).json({ error: 'Backup no encontrado' }); return; }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Error al borrar backup: ' + (e?.message || e) });
  }
};
