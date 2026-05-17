/**
 * scripts/migrate-image-paths.ts
 *
 * Después de copiar los archivos físicos de imágenes a public/uploads/servicios/
 * y public/uploads/logos/, este script actualiza la BD para que:
 *   - servicios.imagen pase de "IMG_4600.jpeg" a "/uploads/servicios/IMG_4600.jpeg"
 *   - empresa.logo pase de "Hospital_de_Celulares.jpg" a "/uploads/logos/Hospital_de_Celulares.jpg"
 *
 * Verifica que cada archivo exista físicamente. Si no existe, deja el campo en NULL
 * y lo reporta al final (para que sepas qué imágenes faltan).
 *
 * Uso:
 *   docker exec techservice-dev npx ts-node --transpile-only scripts/migrate-image-paths.ts
 *   (o equivalente con docker run efímero, igual que la migración anterior)
 *
 * Es idempotente: si ya tienen path "/uploads/...", no los toca.
 */

import fs from 'fs';
import path from 'path';
import { getDB, run, get, all, persistDB } from '../src/config/db';

const UPLOADS_BASE = path.resolve(__dirname, '../public/uploads');
const SERVICIOS_DIR = path.join(UPLOADS_BASE, 'servicios');
const LOGOS_DIR = path.join(UPLOADS_BASE, 'logos');

interface FilaImagen {
  id: number;
  imagen: string | null;
}
interface FilaLogo {
  id: number;
  logo: string | null;
}

function ensureDirs() {
  for (const d of [SERVICIOS_DIR, LOGOS_DIR]) {
    if (!fs.existsSync(d)) {
      console.log(`📁 Creando carpeta: ${d}`);
      fs.mkdirSync(d, { recursive: true });
    }
  }
}

function listAvailable(dir: string): Set<string> {
  if (!fs.existsSync(dir)) return new Set();
  return new Set(fs.readdirSync(dir));
}

async function main() {
  ensureDirs();
  console.log(`📂 Carpeta servicios: ${SERVICIOS_DIR}`);
  console.log(`📂 Carpeta logos:     ${LOGOS_DIR}`);
  console.log('');

  const archivosServicios = listAvailable(SERVICIOS_DIR);
  const archivosLogos = listAvailable(LOGOS_DIR);
  console.log(`📊 Archivos disponibles en servicios/: ${archivosServicios.size}`);
  console.log(`📊 Archivos disponibles en logos/:     ${archivosLogos.size}`);
  console.log('');

  const db = await getDB();

  // ─── SERVICIOS ────────────────────────────────────────────────
  const servicios = all<FilaImagen>(db,
    "SELECT id, imagen FROM servicios WHERE imagen IS NOT NULL AND imagen != '' AND imagen NOT LIKE '/uploads/%' AND imagen NOT LIKE 'data:%'");
  console.log(`🔍 Servicios con imagen pendiente de actualizar: ${servicios.length}`);

  let svActualizados = 0, svFaltantes = 0, svLimpiados = 0;
  const faltantesServicios: string[] = [];
  for (const s of servicios) {
    const filename = (s.imagen || '').trim();
    if (!filename) continue;
    if (archivosServicios.has(filename)) {
      run(db, 'UPDATE servicios SET imagen=? WHERE id=?',
        [`/uploads/servicios/${filename}`, s.id]);
      svActualizados++;
    } else {
      // Archivo NO existe físicamente — limpiar el campo para evitar imágenes rotas
      run(db, 'UPDATE servicios SET imagen=NULL WHERE id=?', [s.id]);
      svFaltantes++;
      svLimpiados++;
      if (faltantesServicios.length < 20) faltantesServicios.push(filename);
    }
  }

  // ─── LOGOS DE EMPRESA ─────────────────────────────────────────
  const empresas = all<FilaLogo>(db,
    "SELECT id, logo FROM empresa WHERE logo IS NOT NULL AND logo != '' AND logo NOT LIKE '/uploads/%' AND logo NOT LIKE 'data:%'");
  console.log(`🔍 Empresas con logo pendiente de actualizar:     ${empresas.length}`);

  let lgActualizados = 0, lgFaltantes = 0;
  const faltantesLogos: string[] = [];
  for (const e of empresas) {
    const filename = (e.logo || '').trim();
    if (!filename) continue;
    if (archivosLogos.has(filename)) {
      run(db, 'UPDATE empresa SET logo=? WHERE id=?',
        [`/uploads/logos/${filename}`, e.id]);
      lgActualizados++;
    } else {
      run(db, 'UPDATE empresa SET logo=NULL WHERE id=?', [e.id]);
      lgFaltantes++;
      faltantesLogos.push(filename);
    }
  }

  persistDB();

  // ─── REPORTE ──────────────────────────────────────────────────
  console.log('');
  console.log('═════════════════════════════════════════════════════════');
  console.log('  RESULTADO');
  console.log('═════════════════════════════════════════════════════════');
  console.log(`  Servicios:`);
  console.log(`    ✓ Paths actualizados:   ${svActualizados}`);
  console.log(`    ⚠ Archivos faltantes:   ${svFaltantes} (campo limpiado a NULL)`);
  console.log(`  Logos de empresa:`);
  console.log(`    ✓ Paths actualizados:   ${lgActualizados}`);
  console.log(`    ⚠ Archivos faltantes:   ${lgFaltantes}`);
  console.log('═════════════════════════════════════════════════════════');

  if (faltantesServicios.length) {
    console.log('\n⚠️  Primeros 20 archivos de servicios FALTANTES (no estaban en la carpeta):');
    faltantesServicios.forEach(f => console.log(`    - ${f}`));
    if (svFaltantes > 20) console.log(`    ... y ${svFaltantes - 20} más`);
  }
  if (faltantesLogos.length) {
    console.log('\n⚠️  Logos FALTANTES:');
    faltantesLogos.forEach(f => console.log(`    - ${f}`));
  }

  console.log('\n✅ Listo. Reinicia el container para que la app vea los cambios:');
  console.log('   docker restart techservice');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
