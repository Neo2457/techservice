/**
 * scripts/revoke-client-access.ts
 *
 * Quita el acceso al sistema (tipo + contrasena → NULL) a TODAS las personas
 * cuyo único rol sea "cliente". También borra sus permisos asignados.
 *
 * NO desactiva: hace el cambio definitivo. Si en el futuro un cliente
 * necesita acceso, hay que reactivárselo manualmente desde la edición.
 *
 * Modo dry-run por defecto (no toca nada, solo reporta).
 *
 * Uso:
 *   # Dry-run: solo muestra cuántos serían afectados
 *   docker run --rm -it [montajes] node:20-alpine sh -c "
 *     npm install --silent &&
 *     npx ts-node --transpile-only scripts/revoke-client-access.ts"
 *
 *   # APLICAR cambios reales:
 *   docker run --rm -it [montajes] node:20-alpine sh -c "
 *     npm install --silent &&
 *     npx ts-node --transpile-only scripts/revoke-client-access.ts --apply"
 */

import { getDB, run, get, all, persistDB } from '../src/config/db';

interface PersonaFila {
  id: number;
  nombre: string;
  correo: string | null;
  tipo: string | null;
  roles: string;
  empresa_id: number;
}

function isOnlyCliente(roles: string): boolean {
  // El campo roles es CSV. Cuenta como "solo cliente" si:
  // - tiene 'cliente'
  // - y NO tiene ningún otro rol que implique acceso operativo
  // (root/admin/empleado son tipos, pero también pueden estar en roles)
  const rolesArr = (roles || '').split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
  if (rolesArr.length === 0) return false;
  // Roles que significan "no es solo cliente" (no quitarles acceso)
  const rolesQueNoSonCliente = new Set(['root', 'admin', 'empleado']);
  for (const r of rolesArr) {
    if (rolesQueNoSonCliente.has(r)) return false;
  }
  // Si tiene 'cliente' y nada más que también pueda implicar acceso, OK
  return rolesArr.includes('cliente');
}

async function main() {
  const apply = process.argv.includes('--apply');

  console.log('═══════════════════════════════════════════════════════');
  console.log('  Revocar acceso al sistema a personas SOLO clientes');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Modo: ${apply ? '⚠️  APLICAR CAMBIOS' : '🔍 DRY-RUN (sin cambios)'}`);
  console.log('');

  const db = await getDB();

  // Obtener TODAS las personas con tipo (acceso al sistema) — luego filtramos en JS
  // por roles para tener la lógica clara en código.
  const candidatos = all<PersonaFila>(db,
    `SELECT id, nombre, correo, tipo, roles, empresa_id
     FROM personas
     WHERE tipo IS NOT NULL`);

  console.log(`📊 Personas con acceso al sistema (tipo IS NOT NULL): ${candidatos.length}`);

  // Filtrar las que son SOLO cliente
  const aRevocar = candidatos.filter(p => isOnlyCliente(p.roles));
  console.log(`📊 De esas, son SOLO 'cliente': ${aRevocar.length}`);
  console.log('');

  // Proteger root: por si algún día alguien pone roles='cliente' a un root.
  // Aunque isOnlyCliente ya excluye root, doble-check explícito por seguridad.
  const aRevocarSeguro = aRevocar.filter(p => p.tipo !== 'root');
  if (aRevocarSeguro.length !== aRevocar.length) {
    console.log(`⚠️  Filtrados ${aRevocar.length - aRevocarSeguro.length} usuarios root por seguridad.`);
  }

  if (aRevocarSeguro.length === 0) {
    console.log('✅ Nada que hacer. No hay personas que cumplan el criterio.');
    return;
  }

  console.log('Personas que serían afectadas:');
  console.log('───────────────────────────────────────────────────────');
  aRevocarSeguro.slice(0, 30).forEach(p => {
    console.log(`  • ID ${p.id.toString().padEnd(6)} | ${(p.tipo || '?').padEnd(10)} | empresa ${p.empresa_id} | ${p.nombre}${p.correo ? ' <' + p.correo + '>' : ''}`);
  });
  if (aRevocarSeguro.length > 30) {
    console.log(`  ... y ${aRevocarSeguro.length - 30} más`);
  }
  console.log('───────────────────────────────────────────────────────');
  console.log('');

  // Cuántos permisos se borrarían
  const ids = aRevocarSeguro.map(p => p.id);
  const placeholders = ids.map(() => '?').join(',');
  const permisosCount = (get<{ n: number }>(db,
    `SELECT COUNT(*) as n FROM permisos WHERE usuario_id IN (${placeholders})`,
    ids) as { n: number })?.n ?? 0;
  console.log(`📊 Permisos asociados que se borrarían: ${permisosCount}`);
  console.log('');

  if (!apply) {
    console.log('🔍 DRY-RUN — no se aplicaron cambios.');
    console.log('   Para ejecutar de verdad, vuelve a correr con --apply al final.');
    return;
  }

  // ────── APLICAR ──────
  console.log('⏳ Aplicando cambios...');
  let ok = 0, fail = 0;
  for (const p of aRevocarSeguro) {
    try {
      run(db, 'UPDATE personas SET tipo = NULL, contrasena = NULL WHERE id = ?', [p.id]);
      run(db, 'DELETE FROM permisos WHERE usuario_id = ?', [p.id]);
      ok++;
    } catch (e) {
      console.error(`  ✗ Falló id ${p.id}: ${(e as Error).message}`);
      fail++;
    }
  }
  persistDB();

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ✅ Procesados: ${ok}    ❌ Fallidos: ${fail}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('Las personas afectadas siguen existiendo en la BD como');
  console.log('clientes regulares — solo se les quitó el acceso al sistema.');
  console.log('Sus servicios, ventas y demás registros quedan intactos.');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
