// src/controllers/configuracionController.ts

import { Request, Response } from 'express';
import { getDB, run, get, all, persistDB } from '../config/db';
import { registrarLog } from '../utils/logger';
import fs from 'fs';
import path from 'path';

// GET /api/configuracion
export const getConfiguracion = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = (req.user!.tipo === 'root' && req.query.empresa_id)
  
    ? Number(req.query.empresa_id)
    : req.user!.empresaId;

  let config = get(db, 'SELECT * FROM configuracion WHERE empresa_id = ?', [empresaId]);

  // Create default config if not exists
  if (!config) {
    run(db, 'INSERT INTO configuracion (empresa_id) VALUES (?)', [empresaId]);
    persistDB();
    config = get(db, 'SELECT * FROM configuracion WHERE empresa_id = ?', [empresaId]);
  }

  res.json(config);
};

// PUT /api/configuracion
export const updateConfiguracion = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = (req.user!.tipo === 'root' && req.body.empresa_id)
    ? Number(req.body.empresa_id)
    : req.user!.empresaId;

  const {
    logo_mode,
    ticket_titulo,
    ticket_mostrar_logo,
    ticket_mostrar_firma_cliente,
    ticket_mostrar_firma_tecnico,
    ticket_mostrar_telefono,
    ticket_mostrar_direccion,
    ticket_mostrar_gracias,
    ticket_politica_garantia,
    ticket_politica_revision,
    ticket_texto_extra,
    ticket_elementos_orden,
    etiqueta_mostrar_nombre,
    etiqueta_mostrar_codigo,
    etiqueta_mostrar_precio,
    etiqueta_mostrar_qr,
    etiqueta_ancho,
    etiqueta_alto,
    corte_automatico,
    corte_hora,
    ticket_venta_mostrar_logo,
    ticket_venta_mostrar_empresa,
    ticket_venta_mostrar_folio,
    ticket_venta_mostrar_fecha,
    ticket_venta_mostrar_cliente,
    ticket_venta_mostrar_items,
    ticket_venta_mostrar_metodo,
    ticket_venta_footer,
    // Toggles granulares para datos del ticket de servicio
    ticket_mostrar_folio,
    ticket_mostrar_cliente_nombre,
    ticket_mostrar_cliente_telefono,
    ticket_mostrar_dispositivo,
    ticket_mostrar_num_serie,
    ticket_mostrar_falla,
    ticket_mostrar_observaciones,
    ticket_mostrar_estado,
    ticket_mostrar_garantia,
    ticket_mostrar_fecha_entrada,
    ticket_mostrar_fecha_salida,
    ticket_mostrar_anticipo,
    ticket_mostrar_refacciones,
    ticket_mostrar_costo_total,
    ticket_mostrar_restante,
    ticket_mostrar_ubicacion,
    ticket_mostrar_fecha_emision,
    // Imagen secundaria (data URL base64 o /uploads/...)
    ticket_imagen_extra,
    ticket_imagen_extra_size,
    ticket_imagen_extra_pos,
    // Personalización avanzada del ticket de venta (POS)
    ticket_venta_titulo,
    ticket_venta_mostrar_telefono,
    ticket_venta_mostrar_direccion,
    ticket_venta_mostrar_rfc,
    ticket_venta_mostrar_vendedor,
    ticket_venta_mostrar_subtotal,
    ticket_venta_mostrar_descuento,
    ticket_venta_mostrar_total,
    ticket_venta_mostrar_gracias,
    ticket_venta_mostrar_codigos,
    ticket_venta_texto_extra,
    ticket_venta_imagen_extra,
    ticket_venta_imagen_extra_size,
    ticket_venta_imagen_extra_pos,
    ticket_venta_ancho_mm,
  } = req.body;

  // Ensure config exists
  let config = get(db, 'SELECT id FROM configuracion WHERE empresa_id = ?', [empresaId]);
  if (!config) {
    run(db, 'INSERT INTO configuracion (empresa_id) VALUES (?)', [empresaId]);
  }

  run(db,
    `UPDATE configuracion SET
      logo_mode = ?,
      ticket_titulo = ?,
      ticket_mostrar_logo = ?,
      ticket_mostrar_firma_cliente = ?,
      ticket_mostrar_firma_tecnico = ?,
      ticket_mostrar_telefono = ?,
      ticket_mostrar_direccion = ?,
      ticket_mostrar_gracias = ?,
      ticket_politica_garantia = ?,
      ticket_politica_revision = ?,
      ticket_texto_extra = ?,
      ticket_elementos_orden = ?,
      etiqueta_mostrar_nombre = ?,
      etiqueta_mostrar_codigo = ?,
      etiqueta_mostrar_precio = ?,
      etiqueta_mostrar_qr = ?,
      etiqueta_ancho = ?,
      etiqueta_alto = ?,
      corte_automatico = ?,
      corte_hora = ?,
      ticket_venta_mostrar_logo = ?,
      ticket_venta_mostrar_empresa = ?,
      ticket_venta_mostrar_folio = ?,
      ticket_venta_mostrar_fecha = ?,
      ticket_venta_mostrar_cliente = ?,
      ticket_venta_mostrar_items = ?,
      ticket_venta_mostrar_metodo = ?,
      ticket_venta_footer = ?,
      ticket_mostrar_folio            = ?,
      ticket_mostrar_cliente_nombre   = ?,
      ticket_mostrar_cliente_telefono = ?,
      ticket_mostrar_dispositivo      = ?,
      ticket_mostrar_num_serie        = ?,
      ticket_mostrar_falla            = ?,
      ticket_mostrar_observaciones    = ?,
      ticket_mostrar_estado           = ?,
      ticket_mostrar_garantia         = ?,
      ticket_mostrar_fecha_entrada    = ?,
      ticket_mostrar_fecha_salida     = ?,
      ticket_mostrar_anticipo         = ?,
      ticket_mostrar_refacciones      = ?,
      ticket_mostrar_costo_total      = ?,
      ticket_mostrar_restante         = ?,
      ticket_mostrar_ubicacion        = ?,
      ticket_mostrar_fecha_emision    = ?,
      ticket_imagen_extra             = ?,
      ticket_imagen_extra_size        = ?,
      ticket_imagen_extra_pos         = ?,
      ticket_venta_titulo               = ?,
      ticket_venta_mostrar_telefono     = ?,
      ticket_venta_mostrar_direccion    = ?,
      ticket_venta_mostrar_rfc          = ?,
      ticket_venta_mostrar_vendedor     = ?,
      ticket_venta_mostrar_subtotal     = ?,
      ticket_venta_mostrar_descuento    = ?,
      ticket_venta_mostrar_total        = ?,
      ticket_venta_mostrar_gracias      = ?,
      ticket_venta_mostrar_codigos      = ?,
      ticket_venta_texto_extra          = ?,
      ticket_venta_imagen_extra         = ?,
      ticket_venta_imagen_extra_size    = ?,
      ticket_venta_imagen_extra_pos     = ?,
      ticket_venta_ancho_mm             = ?,
      fecha_actualizacion = datetime('now')
    WHERE empresa_id = ?`,
    [
      logo_mode ?? 'empresa',
      ticket_titulo ?? 'TICKET DE SERVICIO',
      ticket_mostrar_logo ?? 1,
      ticket_mostrar_firma_cliente ?? 1,
      ticket_mostrar_firma_tecnico ?? 1,
      ticket_mostrar_telefono ?? 1,
      ticket_mostrar_direccion ?? 0,
      ticket_mostrar_gracias ?? 1,
      ticket_politica_garantia ?? null,
      ticket_politica_revision ?? null,
      ticket_texto_extra ?? null,
      ticket_elementos_orden ? (typeof ticket_elementos_orden === 'string' ? ticket_elementos_orden : JSON.stringify(ticket_elementos_orden)) : null,
      etiqueta_mostrar_nombre ?? 1,
      etiqueta_mostrar_codigo ?? 1,
      etiqueta_mostrar_precio ?? 1,
      etiqueta_mostrar_qr ?? 1,
      etiqueta_ancho ?? 40,
      etiqueta_alto ?? 30,
      corte_automatico ?? 0,
      corte_hora ?? '22:00',
      ticket_venta_mostrar_logo ?? 1,
      ticket_venta_mostrar_empresa ?? 1,
      ticket_venta_mostrar_folio ?? 1,
      ticket_venta_mostrar_fecha ?? 1,
      ticket_venta_mostrar_cliente ?? 0,
      ticket_venta_mostrar_items ?? 1,
      ticket_venta_mostrar_metodo ?? 1,
      ticket_venta_footer ?? 'Gracias por su compra',
      ticket_mostrar_folio            ?? 1,
      ticket_mostrar_cliente_nombre   ?? 1,
      ticket_mostrar_cliente_telefono ?? 1,
      ticket_mostrar_dispositivo      ?? 1,
      ticket_mostrar_num_serie        ?? 1,
      ticket_mostrar_falla            ?? 1,
      ticket_mostrar_observaciones    ?? 1,
      ticket_mostrar_estado           ?? 1,
      ticket_mostrar_garantia         ?? 1,
      ticket_mostrar_fecha_entrada    ?? 1,
      ticket_mostrar_fecha_salida     ?? 1,
      ticket_mostrar_anticipo         ?? 1,
      ticket_mostrar_refacciones      ?? 1,
      ticket_mostrar_costo_total      ?? 1,
      ticket_mostrar_restante         ?? 1,
      ticket_mostrar_ubicacion        ?? 1,
      ticket_mostrar_fecha_emision    ?? 1,
      ticket_imagen_extra             ?? null,
      ticket_imagen_extra_size        ?? 60,
      ticket_imagen_extra_pos         ?? 'final',
      ticket_venta_titulo               ?? 'TICKET DE VENTA',
      ticket_venta_mostrar_telefono     ?? 1,
      ticket_venta_mostrar_direccion    ?? 0,
      ticket_venta_mostrar_rfc          ?? 1,
      ticket_venta_mostrar_vendedor     ?? 1,
      ticket_venta_mostrar_subtotal     ?? 1,
      ticket_venta_mostrar_descuento    ?? 1,
      ticket_venta_mostrar_total        ?? 1,
      ticket_venta_mostrar_gracias      ?? 1,
      ticket_venta_mostrar_codigos      ?? 1,
      ticket_venta_texto_extra          ?? null,
      ticket_venta_imagen_extra         ?? null,
      ticket_venta_imagen_extra_size    ?? 60,
      ticket_venta_imagen_extra_pos     ?? 'final',
      ticket_venta_ancho_mm             ?? 58,

      empresaId
    ]
  );

  persistDB();
  registrarLog({ db, usuarioId: req.user!.userId, usuarioNombre: req.user!.correo, usuarioTipo: req.user!.tipo,
    accion: 'editar', modulo: 'configuracion', entidadId: empresaId,
    descripcion: `Actualizó configuración de empresa ID ${empresaId}`, ip: req.ip, empresaId: empresaId });
  res.json(get(db, 'SELECT * FROM configuracion WHERE empresa_id = ?', [empresaId]));
};

// POST /api/upload/logo
export const uploadLogo = async (req: Request, res: Response): Promise<void> => {
  const { imagen, tipo, id: targetId } = req.body;
  // imagen = base64 data URL
  // tipo = 'empresa' | 'local'
  // id = empresa_id or local_id

  if (!imagen || !tipo || !targetId) {
    res.status(400).json({ error: 'Se requiere imagen, tipo y id' }); return;
  }

  const db = await getDB();

  // Validate access
  if (tipo === 'empresa') {
    if (req.user!.tipo !== 'root' && Number(targetId) !== req.user!.empresaId) {
      res.status(403).json({ error: 'No tienes acceso a esta empresa' }); return;
    }
  } else if (tipo === 'local') {
    const local = get<{ empresa_id: number }>(db, 'SELECT empresa_id FROM locales WHERE id = ?', [Number(targetId)]);
    if (!local) { res.status(404).json({ error: 'Local no encontrado' }); return; }
    if (req.user!.tipo !== 'root' && local.empresa_id !== req.user!.empresaId) {
      res.status(403).json({ error: 'No tienes acceso a este local' }); return;
    }
  } else {
    res.status(400).json({ error: 'Tipo debe ser empresa o local' }); return;
  }

  try {
    // Parse base64
    const matches = imagen.match(/^data:image\/(png|jpg|jpeg|gif|webp);base64,(.+)$/);
    if (!matches) {
      res.status(400).json({ error: 'Formato de imagen inválido' }); return;
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `${tipo}_${targetId}_${Date.now()}.${ext}`;
    const filepath = path.join(__dirname, '../../public/uploads/logos', filename);

    fs.writeFileSync(filepath, buffer);

    const logoUrl = `/uploads/logos/${filename}`;

    // Update database
    if (tipo === 'empresa') {
      run(db, 'UPDATE empresa SET logo = ? WHERE id = ?', [logoUrl, Number(targetId)]);
    } else {
      run(db, 'UPDATE locales SET logo = ? WHERE id = ?', [logoUrl, Number(targetId)]);
    }

    persistDB();
    res.json({ ok: true, logo: logoUrl });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar la imagen' });
  }
};

// GET /api/ticket/:servicioId — generate ticket data for printing
export const getTicketData = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const servicioId = Number(req.params.servicioId);

  // Get servicio with client data
  const servicio = get(db,
    `SELECT s.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono,
            c.correo as cliente_correo, c.direccion as cliente_direccion,
            e.nombre as empresa_nombre, e.telefono as empresa_telefono,
            e.correo as empresa_correo, e.logo as empresa_logo,
            e.ciudad as empresa_ciudad, e.estado_rep as empresa_estado,
            e.calle as empresa_calle,
            l.nombre_local as local_nombre, l.telefono as local_telefono,
            l.ciudad as local_ciudad, l.estado_local, l.logo as local_logo
     FROM servicios s
     LEFT JOIN personas c ON s.cliente_id = c.id
     LEFT JOIN empresa e ON s.empresa_id = e.id
     LEFT JOIN locales l ON s.local_id = l.id
     WHERE s.id = ?`,
    [servicioId]
  );

  if (!servicio) {
    res.status(404).json({ error: 'Servicio no encontrado' }); return;
  }

  // Access control
  const srv = servicio as any;
  if (req.user!.tipo !== 'root' && srv.empresa_id !== req.user!.empresaId) {
    res.status(403).json({ error: 'No tienes acceso a este servicio' }); return;
  }

  // Get config
  let config = get(db, 'SELECT * FROM configuracion WHERE empresa_id = ?', [srv.empresa_id]);
  if (!config) {
    run(db, 'INSERT INTO configuracion (empresa_id) VALUES (?)', [srv.empresa_id]);
    persistDB();
    config = get(db, 'SELECT * FROM configuracion WHERE empresa_id = ?', [srv.empresa_id]);
  }

  const cfg = config as any;

  // If a plantilla_id is provided, override config with plantilla settings
  const plantillaId = req.query.plantilla_id ? Number(req.query.plantilla_id) : null;
  if (plantillaId) {
    const plantilla = get(db,
      'SELECT * FROM ticket_plantillas WHERE id = ? AND empresa_id = ?',
      [plantillaId, srv.empresa_id]
    ) as any;
    if (plantilla) {
      // Sobrescribe TODOS los campos visuales del cfg con los de la plantilla.
      // Los demás campos del cfg (etiqueta, ticket_venta, etc.) se conservan.
      const overrideKeys = [
        'ticket_titulo',
        'ticket_mostrar_logo', 'ticket_mostrar_firma_cliente', 'ticket_mostrar_firma_tecnico',
        'ticket_mostrar_telefono', 'ticket_mostrar_direccion', 'ticket_mostrar_gracias',
        'ticket_politica_garantia', 'ticket_politica_revision', 'ticket_texto_extra',
        'ticket_mostrar_folio', 'ticket_mostrar_cliente_nombre', 'ticket_mostrar_cliente_telefono',
        'ticket_mostrar_dispositivo', 'ticket_mostrar_num_serie', 'ticket_mostrar_falla',
        'ticket_mostrar_observaciones', 'ticket_mostrar_estado', 'ticket_mostrar_garantia',
        'ticket_mostrar_fecha_entrada', 'ticket_mostrar_fecha_salida', 'ticket_mostrar_anticipo',
        'ticket_mostrar_refacciones', 'ticket_mostrar_costo_total', 'ticket_mostrar_restante',
        'ticket_mostrar_ubicacion', 'ticket_mostrar_fecha_emision',
        'ticket_imagen_extra', 'ticket_imagen_extra_size', 'ticket_imagen_extra_pos',
      ];
      for (const k of overrideKeys) {
        if (plantilla[k] !== undefined && plantilla[k] !== null) cfg[k] = plantilla[k];
      }
    }
  }

  // Determine logo based on config
  let logo = srv.empresa_logo;
  if (cfg.logo_mode === 'local' && srv.local_logo) {
    logo = srv.local_logo;
  }

  res.json({
    servicio: srv,
    config: cfg,
    logo
  });
};

// GET /api/ticket-venta/:ventaId — generate POS receipt data
export const getTicketVenta = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const ventaId = Number(req.params.ventaId);

  const venta = get(db,
    `SELECT v.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono,
            u.nombre as usuario_nombre,
            e.nombre as empresa_nombre, e.telefono as empresa_telefono,
            e.correo as empresa_correo, e.logo as empresa_logo,
            e.ciudad as empresa_ciudad, e.estado_rep as empresa_estado,
            e.calle as empresa_calle, e.rfc as empresa_rfc,
            l.nombre_local, l.telefono as local_telefono,
            l.ciudad as local_ciudad, l.logo as local_logo
     FROM ventas v
     LEFT JOIN personas c  ON v.cliente_id  = c.id
     LEFT JOIN personas u  ON v.usuario_id   = u.id
     LEFT JOIN empresa  e  ON v.empresa_id   = e.id
     LEFT JOIN locales  l  ON v.local_id     = l.id
     WHERE v.id = ?`,
    [ventaId]
  ) as any;

  if (!venta) { res.status(404).json({ error: 'Venta no encontrada' }); return; }
  if (req.user!.tipo !== 'root' && venta.empresa_id !== req.user!.empresaId) {
    res.status(403).json({ error: 'Sin acceso' }); return;
  }

  const items = all(db,
    `SELECT vd.*, p.nombre as producto_nombre, p.codigo
     FROM ventas_detalle vd JOIN productos p ON vd.producto_id = p.id
     WHERE vd.venta_id = ?`, [ventaId]
  );
  const pagos = all(db, 'SELECT * FROM pagos_venta WHERE venta_id = ?', [ventaId]);

  let config = get(db, 'SELECT * FROM configuracion WHERE empresa_id = ?', [venta.empresa_id]) as any;
  if (!config) {
    run(db, 'INSERT INTO configuracion (empresa_id) VALUES (?)', [venta.empresa_id]);
    persistDB();
    config = get(db, 'SELECT * FROM configuracion WHERE empresa_id = ?', [venta.empresa_id]) as any;
  }

  const logo = (config.logo_mode === 'local' && venta.local_logo) ? venta.local_logo : venta.empresa_logo;

  res.json({ venta, items, pagos, config, logo });
};

// PUT /api/configuracion/wa — update only wa_config for empresa
export const updateWaConfig = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = (req.user!.tipo === 'root' && req.body.empresa_id)
    ? Number(req.body.empresa_id) : req.user!.empresaId;
  const { wa_config } = req.body;

  let config = get(db, 'SELECT id FROM configuracion WHERE empresa_id = ?', [empresaId]);
  if (!config) { run(db, 'INSERT INTO configuracion (empresa_id) VALUES (?)', [empresaId]); }

  run(db, 'UPDATE configuracion SET wa_config = ? WHERE empresa_id = ?',
    [wa_config ? (typeof wa_config === 'string' ? wa_config : JSON.stringify(wa_config)) : null, empresaId]);
  persistDB();
  res.json({ ok: true });
};

// GET /api/configuracion/wa — get wa_config for authenticated user (public, for employees)
export const getWaConfigPublic = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const { empresaId, localId } = req.user!;

  // Try local-specific config first
  if (localId) {
    const local = get<{ wa_config: string | null }>(db, 'SELECT wa_config FROM locales WHERE id = ?', [localId]);
    if (local?.wa_config) {
      res.json({ wa_config: local.wa_config }); return;
    }
  }

  const config = get<{ wa_config: string | null }>(db, 'SELECT wa_config FROM configuracion WHERE empresa_id = ?', [empresaId]);
  res.json({ wa_config: config?.wa_config || null });
};

// GET /api/ticket-plantillas-list — list plantilla names for dropdown (all auth users)
export const getPlantillasForTicket = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = (req.user!.tipo === 'root' && req.query.empresa_id)
    ? Number(req.query.empresa_id) : req.user!.empresaId;
  res.json(all(db, 'SELECT id, nombre FROM ticket_plantillas WHERE empresa_id = ? ORDER BY nombre ASC', [empresaId]));
};

// Roles predefinidos del sistema (no borrables)
const ROLES_SISTEMA = [
  { id: 'cliente',   nombre: 'Cliente',   color: '#1e90ff', sistema: true },
  { id: 'empleado',  nombre: 'Empleado',  color: '#00d4aa', sistema: true },
  { id: 'proveedor', nombre: 'Proveedor', color: '#f0a500', sistema: true },
];

// GET /api/configuracion/roles
export const getRolesConfig = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = req.user!.empresaId;
  const cfg = get<{ roles_config: string | null }>(
    db, 'SELECT roles_config FROM configuracion WHERE empresa_id = ?', [empresaId]
  );
  const custom = cfg?.roles_config ? JSON.parse(cfg.roles_config) : [];
  res.json({ roles: [...ROLES_SISTEMA, ...custom] });
};

// PUT /api/configuracion/roles  — guarda sólo los roles custom (sistema se reconstruyen en GET)
export const updateRolesConfig = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = req.user!.empresaId;
  const { roles } = req.body; // array of { id, nombre, color }
  if (!Array.isArray(roles)) { res.status(400).json({ error: 'roles debe ser un array' }); return; }

  // Reject attempts to overwrite system roles
  const custom = roles.filter((r: any) => !ROLES_SISTEMA.find(s => s.id === r.id));
  // Ensure IDs are slugified strings (alphanumeric+underscore)
  for (const r of custom) {
    if (!r.nombre) { res.status(400).json({ error: 'Cada rol necesita un nombre' }); return; }
    if (!r.id) r.id = r.nombre.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  let config = get(db, 'SELECT id FROM configuracion WHERE empresa_id = ?', [empresaId]);
  if (!config) { run(db, 'INSERT INTO configuracion (empresa_id) VALUES (?)', [empresaId]); }
  run(db, 'UPDATE configuracion SET roles_config = ? WHERE empresa_id = ?',
    [JSON.stringify(custom), empresaId]);
  persistDB();
  res.json({ ok: true, roles: [...ROLES_SISTEMA, ...custom] });
};

// GET /api/configuracion/niveles-precio
export const getNivelesPrecios = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = req.user!.empresaId;
  const cfg = get<{ niveles_precio: string | null }>(
    db, 'SELECT niveles_precio FROM configuracion WHERE empresa_id = ?', [empresaId]
  );
  const niveles = cfg?.niveles_precio
    ? JSON.parse(cfg.niveles_precio)
    : [{ nombre: 'Precio de venta' }, { nombre: 'Precio mayorista' }, { nombre: 'Precio especial' }];
  res.json({ niveles });
};

// PUT /api/configuracion/niveles-precio
export const updateNivelesPrecios = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = req.user!.empresaId;
  const { niveles } = req.body;
  if (!Array.isArray(niveles) || niveles.length === 0) {
    res.status(400).json({ error: 'Debe haber al menos un nivel de precio' }); return;
  }
  for (const n of niveles) {
    if (!n.nombre) { res.status(400).json({ error: 'Cada nivel necesita un nombre' }); return; }
  }
  let config = get(db, 'SELECT id FROM configuracion WHERE empresa_id = ?', [empresaId]);
  if (!config) { run(db, 'INSERT INTO configuracion (empresa_id) VALUES (?)', [empresaId]); }
  run(db, 'UPDATE configuracion SET niveles_precio = ? WHERE empresa_id = ?',
    [JSON.stringify(niveles), empresaId]);
  persistDB();
  res.json({ ok: true, niveles });
};

// GET /api/configuracion/tipos-productos
export const getTiposProductos = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = req.user!.empresaId;
  const cfg = get<{ tipos_productos: string | null }>(
    db, 'SELECT tipos_productos FROM configuracion WHERE empresa_id = ?', [empresaId]
  );
  const tipos = cfg?.tipos_productos ? JSON.parse(cfg.tipos_productos) : [];
  res.json({ tipos });
};

// PUT /api/configuracion/tipos-productos
export const updateTiposProductos = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = req.user!.empresaId;
  const { tipos } = req.body;
  if (!Array.isArray(tipos)) { res.status(400).json({ error: 'tipos debe ser un array' }); return; }

  for (const t of tipos) {
    if (!t.nombre) { res.status(400).json({ error: 'Cada tipo necesita un nombre' }); return; }
    if (!t.id) t.id = t.nombre.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (!t.prefijo) t.prefijo = t.nombre.substring(0, 4).toUpperCase();
  }

  let config = get(db, 'SELECT id FROM configuracion WHERE empresa_id = ?', [empresaId]);
  if (!config) { run(db, 'INSERT INTO configuracion (empresa_id) VALUES (?)', [empresaId]); }
  run(db, 'UPDATE configuracion SET tipos_productos = ? WHERE empresa_id = ?',
    [JSON.stringify(tipos), empresaId]);
  persistDB();
  res.json({ ok: true, tipos });
};

// Estados de servicio — sistema (no borrables)
const ESTADOS_SISTEMA = ['recibido', 'entregado', 'cancelado'];
const ESTADOS_DEFAULT = [
  { id: 'recibido',             nombre: 'Recibido',             color: '#f0a500', sistema: true  },
  { id: 'diagnostico',          nombre: 'Diagnóstico',          color: '#3b82f6', sistema: false },
  { id: 'en_proceso',           nombre: 'En proceso',           color: '#3b82f6', sistema: false },
  { id: 'esperando_refaccion',  nombre: 'Esperando refacción',  color: '#f0a500', sistema: false },
  { id: 'listo',                nombre: 'Listo',                color: '#2ed573', sistema: false },
  { id: 'entregado',            nombre: 'Entregado',            color: '#f59e0b', sistema: true  },
  { id: 'cancelado',            nombre: 'Cancelado',            color: '#ff4757', sistema: true  },
];

// GET /api/configuracion/estados
export const getEstadosConfig = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = req.user!.empresaId;
  const cfg = get<{ estados_config: string | null }>(
    db, 'SELECT estados_config FROM configuracion WHERE empresa_id = ?', [empresaId]
  );
  let estados: any[];
  try {
    estados = cfg?.estados_config ? JSON.parse(cfg.estados_config) : [...ESTADOS_DEFAULT];
  } catch { estados = [...ESTADOS_DEFAULT]; }
  // Ensure sistema states always exist
  for (const id of ESTADOS_SISTEMA) {
    if (!estados.find((e: any) => e.id === id)) {
      const def = ESTADOS_DEFAULT.find(e => e.id === id)!;
      estados.push(def);
    }
  }
  res.json(estados);
};

// PUT /api/configuracion/estados
export const updateEstadosConfig = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = req.user!.empresaId;
  const { estados } = req.body;
  if (!Array.isArray(estados)) { res.status(400).json({ error: 'estados debe ser un array' }); return; }
  for (const e of estados) {
    if (!e.nombre?.trim()) { res.status(400).json({ error: 'Cada estado requiere un nombre' }); return; }
    if (!e.id) e.id = e.nombre.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
  // Ensure sistema states remain present
  const final = [...estados];
  for (const id of ESTADOS_SISTEMA) {
    if (!final.find((e: any) => e.id === id)) {
      final.push(ESTADOS_DEFAULT.find(e => e.id === id)!);
    }
  }
  let config = get(db, 'SELECT id FROM configuracion WHERE empresa_id = ?', [empresaId]);
  if (!config) { run(db, 'INSERT INTO configuracion (empresa_id) VALUES (?)', [empresaId]); }
  run(db, 'UPDATE configuracion SET estados_config = ? WHERE empresa_id = ?',
    [JSON.stringify(final), empresaId]);
  persistDB();
  res.json(final);
};

// GET /api/configuracion/conceptos-cobro
export const getConceptosCobro = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const empresaId = req.user!.tipo === 'root' && req.query.empresa_id
    ? Number(req.query.empresa_id) : req.user!.empresaId;
  const data = all(db, 'SELECT * FROM conceptos_cobro WHERE empresa_id = ? ORDER BY orden ASC, id ASC', [empresaId]);
  res.json(data);
};

// POST /api/configuracion/conceptos-cobro
export const createConceptoCobro = async (req: Request, res: Response): Promise<void> => {
  const { nombre, tipo = 'fijo', valor = 0 } = req.body;
  if (!nombre?.trim()) { res.status(400).json({ error: 'El nombre es requerido' }); return; }
  const db = await getDB();
  const empresaId = req.user!.empresaId;
  const orden = (get<{ n: number }>(db, 'SELECT COUNT(*) as n FROM conceptos_cobro WHERE empresa_id = ?', [empresaId]) as any)?.n ?? 0;
  const result = run(db, 'INSERT INTO conceptos_cobro (empresa_id, nombre, tipo, valor, orden) VALUES (?,?,?,?,?)',
    [empresaId, nombre.trim(), tipo, Number(valor) || 0, orden]);
  persistDB();
  res.status(201).json(get(db, 'SELECT * FROM conceptos_cobro WHERE id = ?', [result.lastInsertRowid]));
};

// PUT /api/configuracion/conceptos-cobro/:id
export const updateConceptoCobro = async (req: Request, res: Response): Promise<void> => {
  const { nombre, tipo = 'fijo', valor = 0 } = req.body;
  if (!nombre?.trim()) { res.status(400).json({ error: 'El nombre es requerido' }); return; }
  const db = await getDB();
  const id = Number(req.params.id);
  // Root puede editar conceptos de cualquier empresa; los demás solo dentro de la suya.
  let findSql = 'SELECT id FROM conceptos_cobro WHERE id = ?';
  const findParams: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') { findSql += ' AND empresa_id = ?'; findParams.push(req.user!.empresaId); }
  const existing = get(db, findSql, findParams);
  if (!existing) { res.status(404).json({ error: 'Concepto no encontrado' }); return; }
  run(db, 'UPDATE conceptos_cobro SET nombre=?, tipo=?, valor=? WHERE id=?',
    [nombre.trim(), tipo, Number(valor) || 0, id]);
  persistDB();
  res.json(get(db, 'SELECT * FROM conceptos_cobro WHERE id = ?', [id]));
};

// DELETE /api/configuracion/conceptos-cobro/:id
export const deleteConceptoCobro = async (req: Request, res: Response): Promise<void> => {
  const db = await getDB();
  const id = Number(req.params.id);
  // Root puede borrar conceptos de cualquier empresa; los demás solo dentro de la suya.
  let findSql = 'SELECT id FROM conceptos_cobro WHERE id = ?';
  const findParams: (string | number)[] = [id];
  if (req.user!.tipo !== 'root') { findSql += ' AND empresa_id = ?'; findParams.push(req.user!.empresaId); }
  const existing = get(db, findSql, findParams);
  if (!existing) { res.status(404).json({ error: 'Concepto no encontrado' }); return; }
  run(db, 'DELETE FROM conceptos_cobro WHERE id = ?', [id]);
  persistDB();
  res.json({ ok: true });
};
