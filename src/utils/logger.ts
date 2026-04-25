// src/utils/logger.ts
import { run } from '../config/db';

interface LogEntry {
  db: any;
  usuarioId: number | null;
  usuarioNombre: string;
  usuarioTipo: string;
  accion: string;   // 'login', 'login_fallido', 'crear', 'editar', 'borrar', 'cambio_contrasena', 'asignar', 'quitar'
  modulo: string;   // 'auth', 'servicios', 'clientes', 'productos', 'usuarios', 'empresas', 'locales', 'listas', 'configuracion'
  entidadId?: number | null;
  descripcion?: string;
  ip?: string;
  empresaId?: number | null;
}

export function registrarLog(entry: LogEntry): void {
  try {
    run(entry.db,
      `INSERT INTO logs (usuario_id, usuario_nombre, usuario_tipo, accion, modulo, entidad_id, descripcion, ip, empresa_id)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        entry.usuarioId ?? null,
        entry.usuarioNombre,
        entry.usuarioTipo,
        entry.accion,
        entry.modulo,
        entry.entidadId ?? null,
        entry.descripcion ?? null,
        entry.ip ?? null,
        entry.empresaId ?? null
      ]
    );
  } catch (e) {
    // Never let logging crash the main request
    console.error('[logger] Error al registrar log:', e);
  }
}
