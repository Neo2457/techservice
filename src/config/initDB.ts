// src/config/initDB.ts
import { getDB, run, get, persistDB } from './db';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

export async function initDB(): Promise<void> {
  const db = await getDB();

  db.run(`
    CREATE TABLE IF NOT EXISTS empresa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      iniciales TEXT NOT NULL DEFAULT 'TS',
      rfc TEXT, telefono TEXT, correo TEXT, calle TEXT, cp TEXT,
      ciudad TEXT, estado_rep TEXT, tipo_empresa TEXT DEFAULT 'servicio',
      nombre_encargado TEXT, logo TEXT, cobro REAL DEFAULT 0,
      fecha_creacion TEXT NOT NULL DEFAULT (date('now')),
      fecha_actualizacion TEXT NOT NULL DEFAULT (date('now')),
      estatus TEXT NOT NULL DEFAULT 'activo'
    );
    CREATE TABLE IF NOT EXISTS locales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_local TEXT NOT NULL, ubicacion_interna TEXT,
      ciudad TEXT, estado_local TEXT, telefono TEXT, correo_contacto TEXT,
      gerente_encargado TEXT, fecha_apertura TEXT,
      estatus TEXT NOT NULL DEFAULT 'A',
      empresa_id INTEGER NOT NULL,
      FOREIGN KEY (empresa_id) REFERENCES empresa(id) ON DELETE RESTRICT ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS usuario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL, correo TEXT NOT NULL UNIQUE,
      contrasena TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'empleado',
      telefono TEXT, foto TEXT,
      local_id INTEGER NOT NULL, empresa_id INTEGER NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (local_id)   REFERENCES locales(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (empresa_id) REFERENCES empresa(id) ON DELETE RESTRICT ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL, telefono TEXT, correo TEXT,
      direccion TEXT, imagen TEXT, notas TEXT,
      tipo_cliente TEXT NOT NULL DEFAULT 'regular',
      empresa_id INTEGER NOT NULL, local_id INTEGER NOT NULL,
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (empresa_id) REFERENCES empresa(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (local_id)   REFERENCES locales(id) ON DELETE RESTRICT ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS servicios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT NOT NULL UNIQUE,
      cliente_id INTEGER NOT NULL,
      modelo TEXT NOT NULL, num_serie TEXT,
      falla TEXT NOT NULL, descripcion TEXT, observaciones TEXT, imagen TEXT,
      garantia TEXT NOT NULL DEFAULT 'Sin garantia',
      estado TEXT NOT NULL DEFAULT 'Recibido',
      fecha_entrada TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_salida TEXT,
      anticipo REAL NOT NULL DEFAULT 0,
      costo_refaccion REAL NOT NULL DEFAULT 0,
      costo_total REAL NOT NULL DEFAULT 0,
      anuncio_estado TEXT NOT NULL DEFAULT 'open',
      usuario_id INTEGER NOT NULL, local_id INTEGER NOT NULL, empresa_id INTEGER NOT NULL,
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cliente_id)  REFERENCES clientes(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (usuario_id)  REFERENCES usuario(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (local_id)    REFERENCES locales(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (empresa_id)  REFERENCES empresa(id)  ON DELETE RESTRICT ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL, nombre TEXT NOT NULL,
      compra REAL NOT NULL DEFAULT 0, venta REAL NOT NULL DEFAULT 0,
      existencia INTEGER NOT NULL DEFAULT 0,
      local_id INTEGER NOT NULL, empresa_id INTEGER NOT NULL,
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (local_id)   REFERENCES locales(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (empresa_id) REFERENCES empresa(id)  ON DELETE RESTRICT ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio_venta TEXT NOT NULL UNIQUE,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      subtotal REAL NOT NULL DEFAULT 0, descuento REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
      cliente_id INTEGER, usuario_id INTEGER NOT NULL,
      local_id INTEGER NOT NULL, empresa_id INTEGER NOT NULL,
      FOREIGN KEY (cliente_id)  REFERENCES clientes(id) ON DELETE SET NULL  ON UPDATE CASCADE,
      FOREIGN KEY (usuario_id)  REFERENCES usuario(id)  ON DELETE RESTRICT  ON UPDATE CASCADE,
      FOREIGN KEY (local_id)    REFERENCES locales(id)  ON DELETE RESTRICT  ON UPDATE CASCADE,
      FOREIGN KEY (empresa_id)  REFERENCES empresa(id)  ON DELETE RESTRICT  ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ventas_detalle (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL, producto_id INTEGER NOT NULL,
      cantidad INTEGER NOT NULL DEFAULT 1,
      precio_unitario REAL NOT NULL, descuento_item REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL,
      FOREIGN KEY (venta_id)    REFERENCES ventas(id)    ON DELETE CASCADE  ON UPDATE CASCADE,
      FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS creditos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER, cliente_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL, local_id INTEGER NOT NULL,
      monto_total REAL NOT NULL, saldo_pendiente REAL NOT NULL,
      fecha_inicio TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_limite TEXT, estado TEXT NOT NULL DEFAULT 'activo',
      FOREIGN KEY (venta_id)   REFERENCES ventas(id)   ON DELETE SET NULL  ON UPDATE CASCADE,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT  ON UPDATE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuario(id)  ON DELETE RESTRICT  ON UPDATE CASCADE,
      FOREIGN KEY (local_id)   REFERENCES locales(id)  ON DELETE RESTRICT  ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS abonos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credito_id INTEGER NOT NULL, fecha_abono TEXT NOT NULL DEFAULT (datetime('now')),
      monto_abonado REAL NOT NULL, nota TEXT, usuario_id INTEGER NOT NULL,
      FOREIGN KEY (credito_id) REFERENCES creditos(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuario(id)  ON DELETE RESTRICT ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS empleados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL, apellido TEXT NOT NULL,
      correo TEXT NOT NULL UNIQUE, telefono TEXT,
      fecha_nacimiento TEXT, fecha_ingreso TEXT NOT NULL DEFAULT (date('now')),
      puesto TEXT NOT NULL, salario REAL NOT NULL DEFAULT 0,
      direccion TEXT, imagen TEXT, usuario_id INTEGER,
      local_id INTEGER NOT NULL, empresa_id INTEGER NOT NULL,
      FOREIGN KEY (usuario_id)  REFERENCES usuario(id)  ON DELETE SET NULL  ON UPDATE CASCADE,
      FOREIGN KEY (local_id)    REFERENCES locales(id)  ON DELETE RESTRICT  ON UPDATE CASCADE,
      FOREIGN KEY (empresa_id)  REFERENCES empresa(id)  ON DELETE RESTRICT  ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS listas_precios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL, descripcion TEXT,
      descuento_porcentaje REAL NOT NULL DEFAULT 0,
      precio_n INTEGER NOT NULL DEFAULT 1,
      empresa_id INTEGER NOT NULL,
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (empresa_id) REFERENCES empresa(id) ON DELETE RESTRICT ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS clientes_listas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL, lista_id INTEGER NOT NULL,
      fecha_asignacion TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id)       ON DELETE CASCADE  ON UPDATE CASCADE,
      FOREIGN KEY (lista_id)   REFERENCES listas_precios(id) ON DELETE CASCADE  ON UPDATE CASCADE,
      UNIQUE(cliente_id, lista_id)
    );
    CREATE INDEX IF NOT EXISTS idx_servicios_cliente ON servicios(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_servicios_estado  ON servicios(estado);
    CREATE INDEX IF NOT EXISTS idx_servicios_empresa ON servicios(empresa_id);
    CREATE INDEX IF NOT EXISTS idx_ventas_cliente    ON ventas(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_clientes_nombre   ON clientes(nombre);
  `);

  // Seed solo si está vacío
  const emp = get<{ c: number }>(db, 'SELECT COUNT(*) as c FROM empresa');
  if (!emp || emp.c === 0) {
    console.log('📦 Insertando datos iniciales...');

    run(db, `INSERT INTO empresa (nombre, iniciales, rfc, telefono, correo, ciudad, estado_rep, nombre_encargado, estatus)
             VALUES (?,?,?,?,?,?,?,?,?)`,
      ['TechService Pro', 'TS', 'TSP010101AAA', '33 1234 5678', 'admin@techservice.mx', 'Guadalajara', 'Jalisco', 'Administrador', 'activo']);

    run(db, `INSERT INTO locales (nombre_local, ciudad, estado_local, telefono, estatus, empresa_id)
             VALUES (?,?,?,?,?,?)`,
      ['Sucursal Centro', 'Guadalajara', 'Jalisco', '33 1234 5678', 'A', 1]);

    const hash = bcrypt.hashSync('1234', 10);
    run(db, `INSERT INTO usuario (nombre, correo, contrasena, tipo, local_id, empresa_id)
             VALUES (?,?,?,?,?,?)`,
      ['Administrador', 'admin', hash, 'admin', 1, 1]);

    persistDB();
    console.log('✅ Datos iniciales insertados.');
    console.log('   Usuario: admin | Contraseña: 1234');
  }

  console.log('✅ Base de datos lista.');
}

if (require.main === module) {
  initDB().then(() => process.exit(0));
}

