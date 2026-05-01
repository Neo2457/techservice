// src/config/initDB.ts
import { getDB, run, get, all, persistDB } from './db';
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
    CREATE TABLE IF NOT EXISTS personas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      correo TEXT,
      contrasena TEXT,
      tipo TEXT,
      telefono TEXT, foto TEXT,
      direccion TEXT, notas TEXT,
      tipo_cliente TEXT NOT NULL DEFAULT 'regular',
      roles TEXT NOT NULL DEFAULT 'cliente',
      local_id INTEGER, empresa_id INTEGER NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (local_id)   REFERENCES locales(id) ON DELETE SET NULL  ON UPDATE CASCADE,
      FOREIGN KEY (empresa_id) REFERENCES empresa(id) ON DELETE RESTRICT ON UPDATE CASCADE
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
      FOREIGN KEY (cliente_id)  REFERENCES personas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (usuario_id)  REFERENCES personas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (local_id)    REFERENCES locales(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (empresa_id)  REFERENCES empresa(id)  ON DELETE RESTRICT ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT, nombre TEXT NOT NULL,
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
      FOREIGN KEY (cliente_id)  REFERENCES personas(id) ON DELETE SET NULL  ON UPDATE CASCADE,
      FOREIGN KEY (usuario_id)  REFERENCES personas(id) ON DELETE RESTRICT  ON UPDATE CASCADE,
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
      FOREIGN KEY (cliente_id) REFERENCES personas(id) ON DELETE RESTRICT  ON UPDATE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES personas(id) ON DELETE RESTRICT  ON UPDATE CASCADE,
      FOREIGN KEY (local_id)   REFERENCES locales(id)  ON DELETE RESTRICT  ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS abonos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credito_id INTEGER NOT NULL, fecha_abono TEXT NOT NULL DEFAULT (datetime('now')),
      monto_abonado REAL NOT NULL, nota TEXT, usuario_id INTEGER NOT NULL,
      FOREIGN KEY (credito_id) REFERENCES creditos(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES personas(id)  ON DELETE RESTRICT ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS empleados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL, apellido TEXT NOT NULL,
      correo TEXT NOT NULL UNIQUE, telefono TEXT,
      fecha_nacimiento TEXT, fecha_ingreso TEXT NOT NULL DEFAULT (date('now')),
      puesto TEXT NOT NULL, salario REAL NOT NULL DEFAULT 0,
      direccion TEXT, imagen TEXT, usuario_id INTEGER,
      local_id INTEGER NOT NULL, empresa_id INTEGER NOT NULL,
      FOREIGN KEY (usuario_id)  REFERENCES personas(id) ON DELETE SET NULL  ON UPDATE CASCADE,
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
      FOREIGN KEY (cliente_id) REFERENCES personas(id)       ON DELETE CASCADE  ON UPDATE CASCADE,
      FOREIGN KEY (lista_id)   REFERENCES listas_precios(id) ON DELETE CASCADE  ON UPDATE CASCADE,
      UNIQUE(cliente_id, lista_id)
    );
    CREATE TABLE IF NOT EXISTS permisos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      modulo TEXT NOT NULL,
      ver INTEGER NOT NULL DEFAULT 0,
      crear INTEGER NOT NULL DEFAULT 0,
      editar INTEGER NOT NULL DEFAULT 0,
      borrar INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (usuario_id) REFERENCES personas(id) ON DELETE CASCADE ON UPDATE CASCADE,
      UNIQUE(usuario_id, modulo)
    );
    CREATE TABLE IF NOT EXISTS configuracion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL UNIQUE,
      logo_mode TEXT NOT NULL DEFAULT 'empresa',
      ticket_titulo TEXT DEFAULT 'TICKET DE SERVICIO',
      ticket_mostrar_logo INTEGER NOT NULL DEFAULT 1,
      ticket_mostrar_firma_cliente INTEGER NOT NULL DEFAULT 1,
      ticket_mostrar_firma_tecnico INTEGER NOT NULL DEFAULT 1,
      ticket_mostrar_telefono INTEGER NOT NULL DEFAULT 1,
      ticket_mostrar_direccion INTEGER NOT NULL DEFAULT 0,
      ticket_mostrar_gracias INTEGER NOT NULL DEFAULT 1,
      ticket_politica_garantia TEXT DEFAULT 'Una vez transcurridos 30 días naturales desde la fecha en que el dispositivo fue ingresado sin que haya sido recogido por el cliente, el establecimiento no se hará responsable por daños, pérdidas o cualquier situación que pueda presentarse con el equipo.',
      ticket_politica_revision TEXT DEFAULT 'Todo servicio, independientemente de si se acepta o no la reparación, genera un costo por concepto de revisión técnica.',
      ticket_texto_extra TEXT DEFAULT NULL,
      ticket_elementos_orden TEXT DEFAULT '["logo","titulo","ubicacion","fecha","datos_servicio","costos","politica_garantia","politica_revision","firma_cliente","firma_tecnico","gracias","telefono"]',
      fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (empresa_id) REFERENCES empresa(id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ticket_plantillas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      empresa_id INTEGER NOT NULL,
      ticket_titulo TEXT DEFAULT 'TICKET DE SERVICIO',
      ticket_mostrar_logo INTEGER NOT NULL DEFAULT 1,
      ticket_mostrar_firma_cliente INTEGER NOT NULL DEFAULT 1,
      ticket_mostrar_firma_tecnico INTEGER NOT NULL DEFAULT 1,
      ticket_mostrar_telefono INTEGER NOT NULL DEFAULT 1,
      ticket_mostrar_direccion INTEGER NOT NULL DEFAULT 0,
      ticket_mostrar_gracias INTEGER NOT NULL DEFAULT 1,
      ticket_politica_garantia TEXT DEFAULT NULL,
      ticket_politica_revision TEXT DEFAULT NULL,
      ticket_texto_extra TEXT DEFAULT NULL,
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (empresa_id) REFERENCES empresa(id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      usuario_nombre TEXT NOT NULL,
      usuario_tipo TEXT NOT NULL DEFAULT 'empleado',
      accion TEXT NOT NULL,
      modulo TEXT NOT NULL,
      entidad_id INTEGER,
      descripcion TEXT,
      ip TEXT,
      empresa_id INTEGER,
      fecha TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_servicios_cliente       ON servicios(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_servicios_estado        ON servicios(estado);
    CREATE INDEX IF NOT EXISTS idx_servicios_empresa       ON servicios(empresa_id);
    CREATE INDEX IF NOT EXISTS idx_servicios_local_empresa ON servicios(local_id, empresa_id);
    CREATE INDEX IF NOT EXISTS idx_servicios_fecha_entrada ON servicios(fecha_entrada);
    CREATE INDEX IF NOT EXISTS idx_ventas_cliente          ON ventas(cliente_id);
    -- Nota: los índices que dependen de columnas agregadas via ALTER TABLE
    -- (estado, fecha_finalizacion) se crean más abajo, después de las migraciones.
    CREATE INDEX IF NOT EXISTS idx_clientes_nombre         ON personas(nombre);
    CREATE INDEX IF NOT EXISTS idx_personas_correo         ON personas(correo);
    CREATE INDEX IF NOT EXISTS idx_personas_tipo_empresa   ON personas(tipo, empresa_id);
    CREATE INDEX IF NOT EXISTS idx_permisos_usuario        ON permisos(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_logs_empresa            ON logs(empresa_id);
    CREATE INDEX IF NOT EXISTS idx_logs_fecha              ON logs(fecha);
  `);

  // pagos_venta table (split-payment support)
  try {
    db.run(`CREATE TABLE IF NOT EXISTS pagos_venta (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      metodo   TEXT    NOT NULL,
      monto    REAL    NOT NULL,
      FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE ON UPDATE CASCADE
    )`);
  } catch(e) { /* already exists */ }
  try { db.run('CREATE INDEX IF NOT EXISTS idx_pagos_venta_venta ON pagos_venta(venta_id)'); } catch(e) {}

  // pagos_servicio table — cobros de servicios desde caja
  try {
    db.run(`CREATE TABLE IF NOT EXISTS pagos_servicio (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      servicio_id INTEGER NOT NULL,
      monto       REAL    NOT NULL,
      metodo      TEXT    NOT NULL DEFAULT 'efectivo',
      concepto    TEXT    NOT NULL DEFAULT 'saldo',
      descripcion TEXT,
      usuario_id  INTEGER NOT NULL,
      local_id    INTEGER NOT NULL,
      empresa_id  INTEGER NOT NULL,
      fecha       TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (usuario_id)  REFERENCES personas(id)  ON DELETE RESTRICT ON UPDATE CASCADE
    )`);
  } catch(e) { /* already exists */ }
  try { db.run('CREATE INDEX IF NOT EXISTS idx_pagos_servicio_servicio  ON pagos_servicio(servicio_id)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_pagos_servicio_local_fecha ON pagos_servicio(local_id, empresa_id, fecha)'); } catch(e) {}

  // cortes table
  try {
    db.run(`CREATE TABLE IF NOT EXISTS cortes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio_corte TEXT NOT NULL UNIQUE,
      fondo_apertura REAL NOT NULL DEFAULT 0,
      total_efectivo REAL NOT NULL DEFAULT 0,
      total_tarjeta REAL NOT NULL DEFAULT 0,
      total_transferencia REAL NOT NULL DEFAULT 0,
      total_credito REAL NOT NULL DEFAULT 0,
      total_ventas REAL NOT NULL DEFAULT 0,
      efectivo_contado REAL,
      diferencia REAL,
      fecha_apertura TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_cierre TEXT,
      estado TEXT NOT NULL DEFAULT 'abierto',
      usuario_id INTEGER NOT NULL,
      local_id INTEGER NOT NULL,
      empresa_id INTEGER NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES personas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (local_id)   REFERENCES locales(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (empresa_id) REFERENCES empresa(id)  ON DELETE RESTRICT ON UPDATE CASCADE
    )`);
  } catch(e) { /* already exists */ }
  try { db.run('CREATE INDEX IF NOT EXISTS idx_cortes_local_estado ON cortes(local_id, empresa_id, estado)'); } catch(e) {}

  // configuracion: corte settings
  try { db.run("ALTER TABLE configuracion ADD COLUMN corte_automatico INTEGER NOT NULL DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN corte_hora TEXT NOT NULL DEFAULT '22:00'"); } catch(e) {}

  // ventas: estado (completada | credito_pendiente) + fecha_finalizacion
  try { db.run("ALTER TABLE ventas ADD COLUMN estado TEXT NOT NULL DEFAULT 'completada'"); } catch(e) {}
  try { db.run("ALTER TABLE ventas ADD COLUMN fecha_finalizacion TEXT"); } catch(e) {}
  // Backfill: existing ventas get fecha_finalizacion = fecha
  try { db.run("UPDATE ventas SET fecha_finalizacion = fecha WHERE fecha_finalizacion IS NULL AND estado = 'completada'"); } catch(e) {}
  // Índices que dependen de las columnas agregadas arriba (movidos del bloque CREATE inicial
  // para soportar BDs nuevas donde la columna estado aún no existía al crear el índice).
  try { db.run('CREATE INDEX IF NOT EXISTS idx_ventas_estado_fecha ON ventas(estado, fecha_finalizacion)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_ventas_local_fecha  ON ventas(local_id, empresa_id, fecha_finalizacion)'); } catch(e) {}

  // Add logo column to locales if not present (migration)
  try { db.run('ALTER TABLE locales ADD COLUMN logo TEXT'); } catch(e) { /* column already exists */ }
  // Add sandbox flag to empresa (migration)
  try { db.run("ALTER TABLE empresa ADD COLUMN sandbox INTEGER NOT NULL DEFAULT 0"); } catch(e) { /* column already exists */ }
  // Label configuration columns (migration)
  try { db.run("ALTER TABLE configuracion ADD COLUMN etiqueta_mostrar_nombre INTEGER NOT NULL DEFAULT 1"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN etiqueta_mostrar_codigo INTEGER NOT NULL DEFAULT 1"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN etiqueta_mostrar_precio INTEGER NOT NULL DEFAULT 1"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN etiqueta_mostrar_qr INTEGER NOT NULL DEFAULT 1"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN etiqueta_ancho INTEGER NOT NULL DEFAULT 40"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN etiqueta_alto INTEGER NOT NULL DEFAULT 30"); } catch(e) {}
  // Precios alternativos en productos (para listas de precios por niveles)
  try { db.run("ALTER TABLE productos ADD COLUMN precio_2 REAL NOT NULL DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE productos ADD COLUMN precio_3 REAL NOT NULL DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE productos ADD COLUMN sku TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE productos ADD COLUMN folio TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE productos ADD COLUMN tipo TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE productos ADD COLUMN precios TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN tipos_productos TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN niveles_precio TEXT"); } catch(e) {}
  // Backfill precios from existing venta/precio_2/precio_3
  try {
    db.run(`UPDATE productos SET precios = '[' || venta || ',' || COALESCE(precio_2,0) || ',' || COALESCE(precio_3,0) || ']' WHERE precios IS NULL`);
  } catch(e) {}

  // Ticket de venta (POS receipt) configuration
  try { db.run("ALTER TABLE configuracion ADD COLUMN ticket_venta_mostrar_logo    INTEGER NOT NULL DEFAULT 1"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN ticket_venta_mostrar_empresa INTEGER NOT NULL DEFAULT 1"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN ticket_venta_mostrar_folio   INTEGER NOT NULL DEFAULT 1"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN ticket_venta_mostrar_fecha   INTEGER NOT NULL DEFAULT 1"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN ticket_venta_mostrar_cliente INTEGER NOT NULL DEFAULT 0"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN ticket_venta_mostrar_items   INTEGER NOT NULL DEFAULT 1"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN ticket_venta_mostrar_metodo  INTEGER NOT NULL DEFAULT 1"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN ticket_venta_footer          TEXT    DEFAULT 'Gracias por su compra'"); } catch(e) {}
  // WA notifications config (JSON)
  try { db.run("ALTER TABLE configuracion ADD COLUMN wa_config TEXT"); } catch(e) {}
  // WA config per-local override
  try { db.run("ALTER TABLE locales ADD COLUMN wa_config TEXT"); } catch(e) {}
  // Permissions scope: 'propio' | 'local' | 'empresa'
  try { db.run("ALTER TABLE permisos ADD COLUMN scope TEXT NOT NULL DEFAULT 'empresa'"); } catch(e) {}
  // Notifications config (JSON)
  try { db.run("ALTER TABLE configuracion ADD COLUMN notificaciones_config TEXT"); } catch(e) {}
  // Custom persona roles (JSON array of {id, nombre, color, sistema})
  try { db.run("ALTER TABLE configuracion ADD COLUMN roles_config TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE configuracion ADD COLUMN estados_config TEXT"); } catch(e) {}
  // Track when a service entered its current state
  try { db.run("ALTER TABLE servicios ADD COLUMN fecha_estado TEXT"); } catch(e) {}
  try { db.run("UPDATE servicios SET fecha_estado = fecha_actualizacion WHERE fecha_estado IS NULL"); } catch(e) {}

  // ═══════════════════════════════════════════════════════════════════
  // MIGRATION: Merge usuario + clientes → personas (runs ONCE)
  // ═══════════════════════════════════════════════════════════════════
  const personasExists = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='personas'");
  if (!personasExists || !personasExists[0] || personasExists[0].values.length === 0) {
    console.log('🔄 Migrando a tabla personas unificada...');
    db.run('PRAGMA foreign_keys = OFF');

    // 1. Create personas table
    db.run(`CREATE TABLE personas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      correo TEXT,
      contrasena TEXT,
      tipo TEXT,
      telefono TEXT,
      foto TEXT,
      direccion TEXT,
      notas TEXT,
      tipo_cliente TEXT NOT NULL DEFAULT 'regular',
      roles TEXT NOT NULL DEFAULT 'cliente',
      local_id INTEGER,
      empresa_id INTEGER NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (local_id)   REFERENCES locales(id) ON DELETE SET NULL  ON UPDATE CASCADE,
      FOREIGN KEY (empresa_id) REFERENCES empresa(id) ON DELETE RESTRICT ON UPDATE CASCADE
    )`);

    // 2. Copy usuario → personas (preserve exact IDs)
    const usuarios = db.exec('SELECT * FROM usuario');
    if (usuarios && usuarios[0]) {
      const cols = usuarios[0].columns;
      for (const row of usuarios[0].values) {
        const u: any = {};
        cols.forEach((c, i) => { u[c] = row[i]; });
        const tipoRole = u.tipo === 'root' ? 'root' : u.tipo === 'admin' ? 'admin' : 'empleado';
        run(db, `INSERT INTO personas (id, nombre, correo, contrasena, tipo, telefono, foto, local_id, empresa_id, activo, fecha_creacion, fecha_actualizacion, roles)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [u.id, u.nombre, u.correo, u.contrasena, u.tipo, u.telefono ?? null, u.foto ?? null,
           u.local_id ?? null, u.empresa_id, u.activo, u.fecha_creacion, u.fecha_creacion, tipoRole]);
      }
    }

    // Update sqlite_sequence so new INSERTs start after the highest existing ID
    const maxId = get<{ m: number }>(db, 'SELECT MAX(id) as m FROM personas');
    if (maxId && maxId.m) {
      try { db.run('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)', ['personas', maxId.m]); } catch(e) {
        db.run('UPDATE sqlite_sequence SET seq = ? WHERE name = ?', [maxId.m, 'personas']);
      }
    }

    // 3. Copy clientes → personas (NEW IDs) + update all FK references
    const clientes = db.exec('SELECT * FROM clientes');
    if (clientes && clientes[0]) {
      const cols = clientes[0].columns;
      for (const row of clientes[0].values) {
        const c: any = {};
        cols.forEach((col, i) => { c[col] = row[i]; });
        // Skip if this clientes record is already linked to a usuario (avoid duplicate)
        if (c.usuario_id) {
          // Just update their roles to include 'cliente'
          const existing = get<{ roles: string }>(db, 'SELECT roles FROM personas WHERE id = ?', [c.usuario_id]);
          if (existing) {
            const newRoles = existing.roles.includes('cliente') ? existing.roles : existing.roles + ',cliente';
            run(db, 'UPDATE personas SET roles = ? WHERE id = ?', [newRoles, c.usuario_id]);
          }
          // Map old cliente_id → existing persona_id
          db.run('UPDATE servicios SET cliente_id = ? WHERE cliente_id = ?', [c.usuario_id, c.id]);
          db.run('UPDATE ventas SET cliente_id = ? WHERE cliente_id = ?', [c.usuario_id, c.id]);
          db.run('UPDATE creditos SET cliente_id = ? WHERE cliente_id = ?', [c.usuario_id, c.id]);
          db.run('UPDATE clientes_listas SET cliente_id = ? WHERE cliente_id = ?', [c.usuario_id, c.id]);
          continue;
        }
        const result = run(db, `INSERT INTO personas (nombre, correo, contrasena, tipo, telefono, direccion, notas, tipo_cliente, roles, empresa_id, local_id, activo, fecha_creacion, fecha_actualizacion)
                 VALUES (?,?,NULL,NULL,?,?,?,?,?,?,?,1,?,datetime('now'))`,
          [c.nombre, c.correo ?? null, c.telefono ?? null, c.direccion ?? null, c.notas ?? null,
           c.tipo_cliente ?? 'regular', c.roles ?? 'cliente', c.empresa_id, c.local_id ?? null,
           c.fecha_creacion]);
        const newId = Number(result.lastInsertRowid);
        // Update all references from old clientes.id → new personas.id
        db.run('UPDATE servicios SET cliente_id = ? WHERE cliente_id = ?', [newId, c.id]);
        db.run('UPDATE ventas SET cliente_id = ? WHERE cliente_id = ?', [newId, c.id]);
        db.run('UPDATE creditos SET cliente_id = ? WHERE cliente_id = ?', [newId, c.id]);
        db.run('UPDATE clientes_listas SET cliente_id = ? WHERE cliente_id = ?', [newId, c.id]);
      }
    }

    // 4. Recreate tables that reference usuario or clientes to point to personas
    // servicios
    db.run(`CREATE TABLE servicios_new (
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
      fecha_estado TEXT,
      FOREIGN KEY (cliente_id)  REFERENCES personas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (usuario_id)  REFERENCES personas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (local_id)    REFERENCES locales(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (empresa_id)  REFERENCES empresa(id)  ON DELETE RESTRICT ON UPDATE CASCADE
    )`);
    db.run('INSERT INTO servicios_new SELECT * FROM servicios');
    db.run('DROP TABLE servicios');
    db.run('ALTER TABLE servicios_new RENAME TO servicios');

    // ventas
    db.run(`CREATE TABLE ventas_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio_venta TEXT NOT NULL UNIQUE,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      subtotal REAL NOT NULL DEFAULT 0, descuento REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
      cliente_id INTEGER, usuario_id INTEGER NOT NULL,
      local_id INTEGER NOT NULL, empresa_id INTEGER NOT NULL,
      estado TEXT NOT NULL DEFAULT 'completada',
      fecha_finalizacion TEXT,
      FOREIGN KEY (cliente_id)  REFERENCES personas(id) ON DELETE SET NULL  ON UPDATE CASCADE,
      FOREIGN KEY (usuario_id)  REFERENCES personas(id) ON DELETE RESTRICT  ON UPDATE CASCADE,
      FOREIGN KEY (local_id)    REFERENCES locales(id)  ON DELETE RESTRICT  ON UPDATE CASCADE,
      FOREIGN KEY (empresa_id)  REFERENCES empresa(id)  ON DELETE RESTRICT  ON UPDATE CASCADE
    )`);
    db.run('INSERT INTO ventas_new SELECT id, folio_venta, fecha, subtotal, descuento, total, metodo_pago, cliente_id, usuario_id, local_id, empresa_id, estado, fecha_finalizacion FROM ventas');
    db.run('DROP TABLE ventas');
    db.run('ALTER TABLE ventas_new RENAME TO ventas');

    // creditos
    db.run(`CREATE TABLE creditos_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER, cliente_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL, local_id INTEGER NOT NULL,
      monto_total REAL NOT NULL, saldo_pendiente REAL NOT NULL,
      fecha_inicio TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_limite TEXT, estado TEXT NOT NULL DEFAULT 'activo',
      FOREIGN KEY (venta_id)   REFERENCES ventas(id)    ON DELETE SET NULL  ON UPDATE CASCADE,
      FOREIGN KEY (cliente_id) REFERENCES personas(id)  ON DELETE RESTRICT  ON UPDATE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES personas(id)  ON DELETE RESTRICT  ON UPDATE CASCADE,
      FOREIGN KEY (local_id)   REFERENCES locales(id)   ON DELETE RESTRICT  ON UPDATE CASCADE
    )`);
    db.run('INSERT INTO creditos_new SELECT * FROM creditos');
    db.run('DROP TABLE creditos');
    db.run('ALTER TABLE creditos_new RENAME TO creditos');

    // abonos
    db.run(`CREATE TABLE abonos_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credito_id INTEGER NOT NULL, fecha_abono TEXT NOT NULL DEFAULT (datetime('now')),
      monto_abonado REAL NOT NULL, nota TEXT, usuario_id INTEGER NOT NULL,
      FOREIGN KEY (credito_id) REFERENCES creditos(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES personas(id)  ON DELETE RESTRICT ON UPDATE CASCADE
    )`);
    db.run('INSERT INTO abonos_new SELECT * FROM abonos');
    db.run('DROP TABLE abonos');
    db.run('ALTER TABLE abonos_new RENAME TO abonos');

    // permisos
    db.run(`CREATE TABLE permisos_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      modulo TEXT NOT NULL,
      ver INTEGER NOT NULL DEFAULT 0,
      crear INTEGER NOT NULL DEFAULT 0,
      editar INTEGER NOT NULL DEFAULT 0,
      borrar INTEGER NOT NULL DEFAULT 0,
      scope TEXT NOT NULL DEFAULT 'empresa',
      FOREIGN KEY (usuario_id) REFERENCES personas(id) ON DELETE CASCADE ON UPDATE CASCADE,
      UNIQUE(usuario_id, modulo)
    )`);
    db.run('INSERT INTO permisos_new SELECT * FROM permisos');
    db.run('DROP TABLE permisos');
    db.run('ALTER TABLE permisos_new RENAME TO permisos');

    // cortes
    db.run(`CREATE TABLE cortes_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio_corte TEXT NOT NULL UNIQUE,
      fondo_apertura REAL NOT NULL DEFAULT 0,
      total_efectivo REAL NOT NULL DEFAULT 0,
      total_tarjeta REAL NOT NULL DEFAULT 0,
      total_transferencia REAL NOT NULL DEFAULT 0,
      total_credito REAL NOT NULL DEFAULT 0,
      total_ventas REAL NOT NULL DEFAULT 0,
      efectivo_contado REAL,
      diferencia REAL,
      fecha_apertura TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_cierre TEXT,
      estado TEXT NOT NULL DEFAULT 'abierto',
      usuario_id INTEGER NOT NULL,
      local_id INTEGER NOT NULL,
      empresa_id INTEGER NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES personas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (local_id)   REFERENCES locales(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (empresa_id) REFERENCES empresa(id)  ON DELETE RESTRICT ON UPDATE CASCADE
    )`);
    db.run('INSERT INTO cortes_new SELECT * FROM cortes');
    db.run('DROP TABLE cortes');
    db.run('ALTER TABLE cortes_new RENAME TO cortes');

    // clientes_listas: update FK to personas
    db.run(`CREATE TABLE clientes_listas_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL, lista_id INTEGER NOT NULL,
      fecha_asignacion TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cliente_id) REFERENCES personas(id)       ON DELETE CASCADE  ON UPDATE CASCADE,
      FOREIGN KEY (lista_id)   REFERENCES listas_precios(id) ON DELETE CASCADE  ON UPDATE CASCADE,
      UNIQUE(cliente_id, lista_id)
    )`);
    db.run('INSERT INTO clientes_listas_new SELECT * FROM clientes_listas');
    db.run('DROP TABLE clientes_listas');
    db.run('ALTER TABLE clientes_listas_new RENAME TO clientes_listas');

    // Recreate indexes
    try { db.run('CREATE INDEX IF NOT EXISTS idx_servicios_cliente ON servicios(cliente_id)'); } catch(e) {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_servicios_estado  ON servicios(estado)'); } catch(e) {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_servicios_empresa ON servicios(empresa_id)'); } catch(e) {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_ventas_cliente    ON ventas(cliente_id)'); } catch(e) {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_clientes_nombre   ON personas(nombre)'); } catch(e) {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_personas_correo   ON personas(correo)'); } catch(e) {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_permisos_usuario  ON permisos(usuario_id)'); } catch(e) {}

    // 5. Drop old tables
    db.run('DROP TABLE IF EXISTS usuario');
    db.run('DROP TABLE IF EXISTS clientes');
    db.run('DROP TABLE IF EXISTS empleados'); // deprecated, was never used

    db.run('PRAGMA foreign_keys = ON');
    persistDB();
    console.log('✅ Migración a personas completada.');
  }

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
    run(db, `INSERT INTO personas (nombre, correo, contrasena, tipo, local_id, empresa_id, roles) VALUES (?,?,?,?,?,?,?)`,
      ['Desarrollador', 'admin', hash, 'root', null, 1, 'root']);

    run(db, `INSERT INTO personas (nombre, correo, contrasena, tipo, local_id, empresa_id, roles) VALUES (?,?,?,?,?,?,?)`,
      ['Administrador TS', 'empresa', hash, 'admin', null, 1, 'admin']);

    // Empleado para TechService (local_id=1)
    run(db, `INSERT INTO personas (nombre, correo, contrasena, tipo, local_id, empresa_id, roles) VALUES (?,?,?,?,?,?,?)`,
      ['Juan Pérez', 'juan@techservice.mx', hash, 'empleado', 1, 1, 'empleado']);

    // Segunda empresa de ejemplo: ElectroFix
    run(db, `INSERT INTO empresa (nombre, iniciales, rfc, telefono, correo, ciudad, estado_rep, nombre_encargado, estatus)
             VALUES (?,?,?,?,?,?,?,?,?)`,
      ['ElectroFix', 'EF', 'ELF020202BBB', '55 9876 5432', 'contacto@electrofix.mx', 'CDMX', 'Ciudad de México', 'Carlos Ramírez', 'activo']);

    // Locales para ElectroFix (empresa_id=2)
    run(db, `INSERT INTO locales (nombre_local, ciudad, estado_local, telefono, estatus, empresa_id)
             VALUES (?,?,?,?,?,?)`,
      ['Sucursal Reforma', 'CDMX', 'Ciudad de México', '55 1111 2222', 'A', 2]);

    run(db, `INSERT INTO locales (nombre_local, ciudad, estado_local, telefono, estatus, empresa_id)
             VALUES (?,?,?,?,?,?)`,
      ['Sucursal Polanco', 'CDMX', 'Ciudad de México', '55 3333 4444', 'A', 2]);

    // Admin para ElectroFix
    run(db, `INSERT INTO personas (nombre, correo, contrasena, tipo, local_id, empresa_id, roles) VALUES (?,?,?,?,?,?,?)`,
      ['Carlos Ramírez', 'carlos@electrofix.mx', hash, 'admin', null, 2, 'admin']);

    // Empleados para ElectroFix
    run(db, `INSERT INTO personas (nombre, correo, contrasena, tipo, local_id, empresa_id, roles) VALUES (?,?,?,?,?,?,?)`,
      ['María López', 'maria@electrofix.mx', hash, 'empleado', 2, 2, 'empleado']);

    run(db, `INSERT INTO personas (nombre, correo, contrasena, tipo, local_id, empresa_id, roles) VALUES (?,?,?,?,?,?,?)`,
      ['Pedro García', 'pedro@electrofix.mx', hash, 'empleado', 3, 2, 'empleado']);

    // Permisos default para empleados (IDs 3, 5, 6)
    const modulosDefault = ['servicios', 'clientes', 'productos', 'ventas', 'reportes', 'empresas', 'locales'];
    for (const empId of [3, 5, 6]) {
      for (const modulo of modulosDefault) {
        run(db, 'INSERT INTO permisos (usuario_id, modulo, ver, crear, editar, borrar) VALUES (?,?,1,1,1,0)',
          [empId, modulo]);
      }
    }

    persistDB();
    console.log('✅ Datos iniciales insertados.');
    console.log('   Root:  admin | Contraseña: 1234');
    console.log('   Admin TS: empresa | Contraseña: 1234');
    console.log('   Admin EF: carlos@electrofix.mx | Contraseña: 1234');
    console.log('   Empleado TS: juan@techservice.mx | Contraseña: 1234');
    console.log('   Empleado EF: maria@electrofix.mx / pedro@electrofix.mx | 1234');
  }

  // ── Migration: make productos.codigo nullable (products without barcode are valid) ──
  try {
    const tblInfo = db.exec("PRAGMA table_info(productos)");
    if (tblInfo && tblInfo[0]) {
      const codigoRow = tblInfo[0].values.find((r: any[]) => r[1] === 'codigo');
      if (codigoRow && codigoRow[3] === 1) { // notnull=1 → need to drop constraint
        console.log('🔄 Haciendo productos.codigo nullable...');
        db.run('PRAGMA foreign_keys = OFF');
        db.run(`CREATE TABLE productos_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          codigo TEXT, nombre TEXT NOT NULL,
          compra REAL NOT NULL DEFAULT 0, venta REAL NOT NULL DEFAULT 0,
          existencia INTEGER NOT NULL DEFAULT 0,
          local_id INTEGER NOT NULL, empresa_id INTEGER NOT NULL,
          fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
          precio_2 REAL NOT NULL DEFAULT 0, precio_3 REAL NOT NULL DEFAULT 0,
          sku TEXT, folio TEXT, tipo TEXT, precios TEXT
        )`);
        db.run(`INSERT INTO productos_v2 (id, codigo, nombre, compra, venta, existencia, local_id, empresa_id, fecha_creacion, precio_2, precio_3, sku, folio, tipo, precios)
                SELECT id, codigo, nombre, compra, venta, existencia, local_id, empresa_id, fecha_creacion,
                       COALESCE(precio_2,0), COALESCE(precio_3,0), sku, folio, tipo, precios FROM productos`);
        db.run('DROP TABLE productos');
        db.run('ALTER TABLE productos_v2 RENAME TO productos');
        db.run('PRAGMA foreign_keys = ON');
        console.log('✅ productos.codigo ahora es nullable.');
      }
    }
  } catch(e) { console.error('Migration productos.codigo nullable falló:', e); }

  // ── Seed productos de prueba (corre siempre que empresa_id=1 no tenga productos) ──
  const prodCount = get<{ c: number }>(db, 'SELECT COUNT(*) as c FROM productos WHERE empresa_id = 1');
  if (!prodCount || prodCount.c === 0) {
    console.log('🛍️  Insertando productos de prueba...');
    const tiposPrueba = JSON.stringify([
      { id: 'pantallas',  nombre: 'Pantallas',   prefijo: 'PANT', color: '#6366f1' },
      { id: 'baterias',   nombre: 'Baterías',    prefijo: 'BAT',  color: '#22c55e' },
      { id: 'cargadores', nombre: 'Cargadores',  prefijo: 'CARG', color: '#f0a500' },
      { id: 'flex',       nombre: 'Flexibles',   prefijo: 'FLEX', color: '#ec4899' },
      { id: 'accesorios', nombre: 'Accesorios',  prefijo: 'ACC',  color: '#06b6d4' },
    ]);
    const cfgExists = get(db, 'SELECT id FROM configuracion WHERE empresa_id = 1');
    if (cfgExists) {
      run(db, 'UPDATE configuracion SET tipos_productos = ? WHERE empresa_id = 1', [tiposPrueba]);
    } else {
      run(db, 'INSERT INTO configuracion (empresa_id, tipos_productos) VALUES (1, ?)', [tiposPrueba]);
    }
    const tiposIds = ['pantallas', 'baterias', 'cargadores', 'flex', 'accesorios'];
    const seedProds: Array<[string, string|null, string|null, string, number, number, number, number]> = [
      ['000001', 'PANT-IP14-BLK', '7501234000001', 'Pantalla iPhone 14 Negro',     450, 850,  8, 0],
      ['000002', 'PANT-IP14-WHT', '7501234000002', 'Pantalla iPhone 14 Blanco',    450, 850,  5, 0],
      ['000003', 'PANT-SAM-A54',  '7501234000003', 'Pantalla Samsung A54',         280, 550, 12, 0],
      ['000004', 'BAT-IP13',      '7501234000004', 'Batería iPhone 13',             95, 220, 20, 1],
      ['000005', 'BAT-IP14',      '7501234000005', 'Batería iPhone 14',            110, 250, 15, 1],
      ['000006', 'BAT-SAM-A54',   '7501234000006', 'Batería Samsung A54',           75, 180, 18, 1],
      ['000007', 'CARG-USBC-20W', '7501234000007', 'Cargador USB-C 20W Original',   80, 180, 30, 2],
      ['000008', 'CARG-MAGSAFE',  '7501234000008', 'MagSafe 15W Apple',            200, 420, 10, 2],
      ['000009', 'FLEX-IP14-VOL', null,            'Flex Volumen iPhone 14',         35,  90, 25, 3],
      ['000010', 'FLEX-IP14-CAM', null,            'Módulo Cámara iPhone 14',       380, 720,  7, 3],
      ['000011', 'TEMP-IP14',     '7501234000011', 'Cristal Templado iPhone 14',    25,  65, 50, 4],
      ['000012', 'CASE-IP14-CLR', null,            'Funda Transparente iPhone 14',  18,  45, 40, 4],
    ];
    for (const [folio, sku, codigo, nombre, compra, venta, existencia, tipoIdx] of seedProds) {
      const precios = JSON.stringify([venta, Math.round(venta * 0.85), Math.round(venta * 0.75)]);
      run(db,
        `INSERT INTO productos (folio, sku, codigo, tipo, nombre, compra, venta, precios, precio_2, precio_3, existencia, local_id, empresa_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,1,1)`,
        [folio, sku, codigo, tiposIds[tipoIdx], nombre, compra, venta, precios,
         Math.round(venta * 0.85), Math.round(venta * 0.75), existencia]);
    }
    persistDB();
    console.log('✅ 12 productos de prueba insertados.');
  }

  // ── Migration: regenerate all folios to new format [INICIALES][DDMMAA][00001] ──
  try {
    // Helper: parse a SQLite datetime string and return ddmmaa
    function parseFecha(dateStr: string): string {
      const d = new Date(dateStr);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const aa = String(d.getFullYear()).substring(2);
      return `${dd}${mm}${aa}`;
    }

    // Cache iniciales per empresa
    const inicialesCache: Record<number, string> = {};
    function getInic(empresaId: number): string {
      if (!inicialesCache[empresaId]) {
        const e = get<{ iniciales: string }>(db, 'SELECT iniciales FROM empresa WHERE id = ?', [empresaId]);
        inicialesCache[empresaId] = (e?.iniciales || 'TS').toUpperCase().substring(0, 4);
      }
      return inicialesCache[empresaId];
    }

    function buildFolio(inic: string, fecha: string, id: number): string {
      return `${inic}${parseFecha(fecha)}${String(id).padStart(5, '0')}`;
    }

    // Productos: old format was purely numeric (e.g. "000001")
    const prods = all(db,
      "SELECT id, empresa_id, fecha_creacion, folio FROM productos WHERE folio GLOB '[0-9][0-9][0-9][0-9][0-9][0-9]'",
      []) as Array<{ id: number; empresa_id: number; fecha_creacion: string; folio: string }>;
    for (const p of prods) {
      run(db, 'UPDATE productos SET folio = ? WHERE id = ?',
        [buildFolio(getInic(p.empresa_id), p.fecha_creacion, p.id), p.id]);
    }
    if (prods.length) console.log(`✅ ${prods.length} folios de productos regenerados.`);

    // Servicios: old format ends with 3-digit ID (total length ≤ 11 for 2-char iniciales)
    const servs = all(db,
      "SELECT id, empresa_id, fecha_entrada, folio FROM servicios WHERE length(folio) <= 11",
      []) as Array<{ id: number; empresa_id: number; fecha_entrada: string; folio: string }>;
    for (const s of servs) {
      run(db, 'UPDATE servicios SET folio = ? WHERE id = ?',
        [buildFolio(getInic(s.empresa_id), s.fecha_entrada, s.id), s.id]);
    }
    if (servs.length) console.log(`✅ ${servs.length} folios de servicios regenerados.`);

    // Ventas: old format starts with V + 11 chars = total 12 chars
    const ventas = all(db,
      "SELECT id, empresa_id, fecha, folio_venta FROM ventas WHERE length(folio_venta) <= 12",
      []) as Array<{ id: number; empresa_id: number; fecha: string; folio_venta: string }>;
    for (const v of ventas) {
      run(db, 'UPDATE ventas SET folio_venta = ? WHERE id = ?',
        ['V' + buildFolio(getInic(v.empresa_id), v.fecha, v.id), v.id]);
    }
    if (ventas.length) console.log(`✅ ${ventas.length} folios de ventas regenerados.`);

  } catch(e) { console.error('Migration folios failed:', e); }

  // ── Columna fuera_caja en pagos_servicio ──────────────────────────
  try { db.run("ALTER TABLE pagos_servicio ADD COLUMN fuera_caja INTEGER NOT NULL DEFAULT 0"); } catch(e) {}

  // ── Conceptos de cobro (autofill en POS) ──────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS conceptos_cobro (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL,
    nombre   TEXT NOT NULL,
    tipo     TEXT NOT NULL DEFAULT 'fijo',
    valor    REAL NOT NULL DEFAULT 0,
    orden    INTEGER DEFAULT 0,
    FOREIGN KEY (empresa_id) REFERENCES empresa(id) ON DELETE CASCADE
  )`);

  // Seed defaults for each empresa that has no concepts yet
  const empresas = all<{ id: number }>(db, 'SELECT id FROM empresa', []);
  for (const emp of empresas) {
    const tiene = get<{ n: number }>(db, 'SELECT COUNT(*) as n FROM conceptos_cobro WHERE empresa_id = ?', [emp.id]);
    if (!tiene || tiene.n === 0) {
      const defaults = [
        { nombre: 'Revisión',    tipo: 'fijo',        valor: 150, orden: 0 },
        { nombre: 'Anticipo',    tipo: 'fijo',        valor: 100, orden: 1 },
        { nombre: 'Liquidación', tipo: 'liquidacion', valor: 0,   orden: 2 },
        { nombre: 'Otro',        tipo: 'fijo',        valor: 0,   orden: 3 },
      ];
      for (const d of defaults) {
        run(db, 'INSERT INTO conceptos_cobro (empresa_id, nombre, tipo, valor, orden) VALUES (?,?,?,?,?)',
          [emp.id, d.nombre, d.tipo, d.valor, d.orden]);
      }
    }
  }

  // Always persist after migrations so schema changes survive restarts
  persistDB();
  console.log('✅ Base de datos lista.');
}

if (require.main === module) {
  initDB().then(() => process.exit(0));
}

