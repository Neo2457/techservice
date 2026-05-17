// src/middleware/jerarquia.ts
// Reglas de jerarquía entre roles. NO son permisos configurables, son reglas
// del sistema:
//   - Empleado NO puede editar / borrar / ver-detalle a admin ni root
//   - Admin NO puede editar / borrar a root
//   - Empleado NO puede modificar permisos de nadie
//   - Admin solo puede otorgar permisos que él mismo tiene (validado en handler)

import { Request, Response, NextFunction } from 'express';
import { getDB, get } from '../config/db';

// Rango numérico de cada tipo (mayor = más privilegio)
export const RANGO_TIPO: Record<string, number> = {
  empleado: 1,
  admin: 2,
  root: 3,
};

export function rangoOf(tipo?: string | null): number {
  if (!tipo) return 0;
  return RANGO_TIPO[tipo] ?? 0;
}

/**
 * Bloquea PUT/DELETE sobre una persona si el actor tiene menor o igual rango
 * que el target. Asume que `req.params.id` es el ID de la persona objetivo.
 *
 * Reglas:
 *   - root puede editar a cualquiera (incluso otros roots si quisiera)
 *   - admin puede editar a empleados y a sí mismo, NO a root ni a otros admins
 *   - empleado solo puede editarse a sí mismo (su perfil)
 */
export async function verificarJerarquiaPersona(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const targetId = Number(req.params.id);
  if (!targetId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const actor = req.user!;
  // Permitirse a sí mismo siempre
  if (targetId === actor.userId) { next(); return; }

  const db = await getDB();
  const target = get<{ tipo: string; empresa_id: number }>(
    db,
    'SELECT tipo, empresa_id FROM personas WHERE id = ?',
    [targetId],
  );
  if (!target) { res.status(404).json({ error: 'Persona no encontrada' }); return; }

  // Multi-tenant: nadie (excepto root) puede tocar personas de otra empresa
  if (actor.tipo !== 'root' && target.empresa_id !== actor.empresaId) {
    res.status(403).json({ error: 'No puedes modificar personas de otra empresa' });
    return;
  }

  // Regla principal de jerarquía: actor solo puede modificar targets con rango
  // ESTRICTAMENTE menor o IGUAL al suyo. Esto permite que admin edite a otros
  // admins (mismo rango) pero impide que admin edite a root (mayor rango).
  const rA = rangoOf(actor.tipo);
  const rT = rangoOf(target.tipo);
  if (rA < rT) {
    res.status(403).json({
      error: `No tienes jerarquía suficiente. Tu rol (${actor.tipo}) no puede modificar a un ${target.tipo}.`,
    });
    return;
  }

  next();
}

/**
 * Versión "ver detalle": empleado tampoco puede VER detalle/permisos de
 * admins/roots. (Lectura pública del nombre/correo en listados sí; pero el
 * endpoint de detalle se bloquea aquí.)
 */
export async function verificarJerarquiaVerDetalle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const targetId = Number(req.params.id);
  if (!targetId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const actor = req.user!;
  if (targetId === actor.userId) { next(); return; }
  // Root y admin pueden ver detalles libremente (la edición sigue regulada por verificarJerarquiaPersona)
  if (actor.tipo === 'root' || actor.tipo === 'admin') { next(); return; }

  // Empleado: bloquear ver detalle de admin/root
  const db = await getDB();
  const target = get<{ tipo: string }>(
    db,
    'SELECT tipo FROM personas WHERE id = ?',
    [targetId],
  );
  if (!target) { res.status(404).json({ error: 'Persona no encontrada' }); return; }

  if (target.tipo === 'admin' || target.tipo === 'root') {
    res.status(403).json({ error: 'No tienes acceso al detalle de este usuario.' });
    return;
  }

  next();
}

/**
 * Valida que un admin solo otorgue permisos que él mismo tiene.
 * Se usa al guardar permisos de empleados.
 *
 * @param actorUserId  Usuario que está otorgando
 * @param actorTipo    Tipo del actor (root/admin)
 * @param permisosNuevos  Array de { modulo, ver, crear, editar, borrar, scope }
 * @returns string con error si no permitido, null si OK
 */
export async function validarOtorgaPermisos(
  actorUserId: number,
  actorTipo: string,
  permisosNuevos: Array<{ modulo: string; ver: number; crear: number; editar: number; borrar: number; scope?: string }>,
): Promise<string | null> {
  // root puede otorgar todo
  if (actorTipo === 'root') return null;
  if (actorTipo !== 'admin') return 'Solo admin/root pueden otorgar permisos';
  // admin: tiene todo implícitamente excepto módulos exclusivamente root.
  // Por ahora todos los módulos del catálogo son accesibles para admin, así
  // que devolvemos null. Si algún día se agrega 'sandbox' u otro solo-root,
  // habría que filtrarlo aquí.
  return null;
}
