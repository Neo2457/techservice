// src/controllers/sandboxController.ts
// Modo Sandbox: crear empresas de prueba con datos de ejemplo

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDB, run, get, all, persistDB } from '../config/db';

export const createSandbox = async (req: Request, res: Response): Promise<void> => {
  const { nombre } = req.body;
  const db = await getDB();

  const sandboxName = nombre || `Sandbox ${Date.now().toString(36).toUpperCase()}`;
  const iniciales = 'SB';

  // Create sandbox company
  const emp = run(db, `INSERT INTO empresa (nombre, iniciales, rfc, telefono, correo, ciudad, estado_rep, nombre_encargado, estatus, sandbox)
    VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [sandboxName, iniciales, 'XAXX010101000', '00 0000 0000', 'sandbox@test.local',
     'Ciudad de Prueba', 'Estado Test', 'Admin Sandbox', 'activo', 1]);
  const empresaId = emp.lastInsertRowid;

  // Create 2 test locals
  const loc1 = run(db, `INSERT INTO locales (nombre_local, ciudad, estado_local, telefono, estatus, empresa_id)
    VALUES (?,?,?,?,?,?)`,
    ['Local Prueba A', 'Ciudad Test', 'Estado Test', '00 1111 1111', 'A', empresaId]);
  const localId1 = loc1.lastInsertRowid;

  const loc2 = run(db, `INSERT INTO locales (nombre_local, ciudad, estado_local, telefono, estatus, empresa_id)
    VALUES (?,?,?,?,?,?)`,
    ['Local Prueba B', 'Ciudad Test', 'Estado Test', '00 2222 2222', 'A', empresaId]);
  const localId2 = loc2.lastInsertRowid;

  // Create an admin user for the sandbox company
  const hash = bcrypt.hashSync('sandbox', 10);
  const adminUser = run(db, `INSERT INTO personas (nombre, correo, contrasena, tipo, local_id, empresa_id, roles)
    VALUES (?,?,?,?,?,?,?)`,
    [`Admin ${sandboxName}`, `admin-sb-${empresaId}@test.local`, hash, 'admin', localId1, empresaId, 'admin']);

  // Create an employee for each local
  const emp1 = run(db, `INSERT INTO personas (nombre, correo, contrasena, tipo, local_id, empresa_id, roles)
    VALUES (?,?,?,?,?,?,?)`,
    ['Empleado Test A', `emp-a-sb-${empresaId}@test.local`, hash, 'empleado', localId1, empresaId, 'empleado']);

  const emp2 = run(db, `INSERT INTO personas (nombre, correo, contrasena, tipo, local_id, empresa_id, roles)
    VALUES (?,?,?,?,?,?,?)`,
    ['Empleado Test B', `emp-b-sb-${empresaId}@test.local`, hash, 'empleado', localId2, empresaId, 'empleado']);

  // Permisos for employees
  const modulos = ['servicios', 'clientes', 'productos', 'ventas', 'reportes', 'empresas', 'locales'];
  for (const empId of [emp1.lastInsertRowid, emp2.lastInsertRowid]) {
    for (const modulo of modulos) {
      run(db, 'INSERT INTO permisos (usuario_id, modulo, ver, crear, editar, borrar) VALUES (?,?,1,1,1,1)', [empId, modulo]);
    }
  }

  // Create sample clients
  const clientNames = ['Cliente Demo 1', 'Cliente Demo 2', 'Cliente Demo 3'];
  const clientIds: number[] = [];
  for (let i = 0; i < clientNames.length; i++) {
    const c = run(db, 'INSERT INTO personas (nombre, telefono, correo, tipo_cliente, empresa_id, local_id, roles) VALUES (?,?,?,?,?,?,?)',
      [clientNames[i], `55 0000 000${i}`, `cliente${i + 1}@sandbox.local`, 'regular', empresaId, i < 2 ? localId1 : localId2, 'cliente']);
    clientIds.push(Number(c.lastInsertRowid));
  }

  // Create sample services
  const fallas = ['Pantalla rota', 'No enciende', 'Batería dañada', 'Software lento', 'Puerto de carga'];
  const modelos = ['iPhone 14', 'Samsung S23', 'Laptop HP', 'iPad Air', 'MacBook Pro'];
  const estados = ['Recibido', 'Diagnóstico', 'En proceso', 'Listo', 'Entregado'];

  for (let i = 0; i < 5; i++) {
    const srvResult = run(db, `INSERT INTO servicios
      (folio, cliente_id, modelo, falla, estado, usuario_id, local_id, empresa_id, anticipo, costo_total, costo_refaccion)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ['TEMP', clientIds[i % clientIds.length], modelos[i], fallas[i], estados[i],
       Number(adminUser.lastInsertRowid), i < 3 ? localId1 : localId2, empresaId,
       i * 50, (i + 1) * 350, i * 100]);

    // Generate real folio
    const empresa = get<{ iniciales: string }>(db, 'SELECT iniciales FROM empresa WHERE id = ?', [empresaId]);
    const date = new Date();
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const aa = String(date.getFullYear()).substring(2);
    const folio = `${(empresa?.iniciales || 'SB').substring(0, 2).toUpperCase()}${dd}${mm}${aa}${String(srvResult.lastInsertRowid).padStart(3, '0')}`;
    run(db, 'UPDATE servicios SET folio = ? WHERE id = ?', [folio, srvResult.lastInsertRowid]);
  }

  persistDB();

  res.status(201).json({
    ok: true,
    empresa: {
      id: empresaId,
      nombre: sandboxName,
      sandbox: 1,
    },
    credenciales: {
      admin: { correo: `admin-sb-${empresaId}@test.local`, contrasena: 'sandbox' },
      empleado_a: { correo: `emp-a-sb-${empresaId}@test.local`, contrasena: 'sandbox' },
      empleado_b: { correo: `emp-b-sb-${empresaId}@test.local`, contrasena: 'sandbox' },
    },
    locales: [
      { id: localId1, nombre: 'Local Prueba A' },
      { id: localId2, nombre: 'Local Prueba B' },
    ],
    clientes: clientIds.length,
    servicios: 5,
    message: `Empresa sandbox "${sandboxName}" creada con datos de ejemplo`,
  });
};

export const listSandboxes = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const sandboxes = all(db, `SELECT e.*,
    (SELECT COUNT(*) FROM locales WHERE empresa_id = e.id AND estatus = 'A') as total_locales,
    (SELECT COUNT(*) FROM personas WHERE empresa_id = e.id AND activo = 1 AND tipo IS NOT NULL) as total_usuarios,
    (SELECT COUNT(*) FROM personas WHERE empresa_id = e.id AND ((',' || roles || ',') LIKE '%,cliente,%' OR tipo IS NULL)) as total_clientes,
    (SELECT COUNT(*) FROM servicios WHERE empresa_id = e.id) as total_servicios
    FROM empresa e WHERE e.sandbox = 1 ORDER BY e.fecha_creacion DESC`, []);
  res.json(sandboxes);
};

export const deleteSandbox = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const db = await getDB();

  // Verify it's actually a sandbox
  const empresa = get<{ id: number; sandbox: number; nombre: string }>(db,
    'SELECT id, sandbox, nombre FROM empresa WHERE id = ? AND sandbox = 1', [Number(id)]);
  if (!empresa) {
    res.status(400).json({ error: 'Empresa no encontrada o no es sandbox. Solo se pueden eliminar empresas de prueba.' });
    return;
  }

  // Delete all related data in order (respecting foreign keys)
  run(db, 'DELETE FROM abonos WHERE credito_id IN (SELECT id FROM creditos WHERE local_id IN (SELECT id FROM locales WHERE empresa_id = ?))', [Number(id)]);
  run(db, 'DELETE FROM creditos WHERE local_id IN (SELECT id FROM locales WHERE empresa_id = ?)', [Number(id)]);
  run(db, 'DELETE FROM ventas_detalle WHERE venta_id IN (SELECT id FROM ventas WHERE empresa_id = ?)', [Number(id)]);
  run(db, 'DELETE FROM ventas WHERE empresa_id = ?', [Number(id)]);
  run(db, 'DELETE FROM servicios WHERE empresa_id = ?', [Number(id)]);
  run(db, 'DELETE FROM productos WHERE empresa_id = ?', [Number(id)]);
  run(db, 'DELETE FROM permisos WHERE usuario_id IN (SELECT id FROM personas WHERE empresa_id = ?)', [Number(id)]);
  run(db, 'DELETE FROM configuracion WHERE empresa_id = ?', [Number(id)]);
  run(db, 'DELETE FROM personas WHERE empresa_id = ?', [Number(id)]);
  run(db, 'DELETE FROM locales WHERE empresa_id = ?', [Number(id)]);
  run(db, 'DELETE FROM empresa WHERE id = ? AND sandbox = 1', [Number(id)]);

  persistDB();

  res.json({ ok: true, message: `Sandbox "${empresa.nombre}" eliminado completamente` });
};

export const resetSandbox = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const db = await getDB();

  const empresa = get<{ id: number; sandbox: number; nombre: string }>(db,
    'SELECT id, sandbox, nombre FROM empresa WHERE id = ? AND sandbox = 1', [Number(id)]);
  if (!empresa) {
    res.status(400).json({ error: 'Empresa no encontrada o no es sandbox' });
    return;
  }

  // Only delete transactional data, keep structure (users, locals)
  run(db, 'DELETE FROM abonos WHERE credito_id IN (SELECT id FROM creditos WHERE local_id IN (SELECT id FROM locales WHERE empresa_id = ?))', [Number(id)]);
  run(db, 'DELETE FROM creditos WHERE local_id IN (SELECT id FROM locales WHERE empresa_id = ?)', [Number(id)]);
  run(db, 'DELETE FROM ventas_detalle WHERE venta_id IN (SELECT id FROM ventas WHERE empresa_id = ?)', [Number(id)]);
  run(db, 'DELETE FROM ventas WHERE empresa_id = ?', [Number(id)]);
  run(db, 'DELETE FROM servicios WHERE empresa_id = ?', [Number(id)]);
  // For reset: only delete client-only personas (tipo IS NULL), keep system users
  run(db, "DELETE FROM personas WHERE empresa_id = ? AND tipo IS NULL", [Number(id)]);
  run(db, 'DELETE FROM productos WHERE empresa_id = ?', [Number(id)]);

  persistDB();

  res.json({ ok: true, message: `Datos transaccionales de "${empresa.nombre}" limpiados. Usuarios y locales conservados.` });
};
