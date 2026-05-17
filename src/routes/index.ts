// src/routes/index.ts
// Enrutador principal — agrega todos los módulos

import { Router, raw } from 'express';
import { authMiddleware, adminOnly, rootOnly } from '../middleware/auth';
import { checkPermiso } from '../middleware/permisos';
import { verificarJerarquiaPersona, verificarJerarquiaVerDetalle } from '../middleware/jerarquia';
import { getCatalogoPermisos } from '../controllers/permisosController';
import { globalSearch } from '../controllers/searchController';

// Auth
import { login, getProfile, updateProfile, changePassword, switchLocal } from '../controllers/authController';


// Personas (módulo unificado)
import { getPersonas, getPersonaById, createPersona, updatePersona, deletePersona, activarAcceso, desactivarAcceso, toggleEstadoPersona, getPermisos as getPersonaPermisos, updatePermisos as updatePersonaPermisos } from '../controllers/personasController';

// Servicios
import { getServicios, getServicioById, createServicio, updateServicio, deleteServicio, getReporte, getDashboard, cobrarServicio, getPagosServicio, getPagosServicioReporte } from '../controllers/serviciosController';

// Productos
import { getProductos, getProductoById, createProducto, updateProducto, deleteProducto } from '../controllers/productosController';


// Empresas
import { getEmpresas, getEmpresaById, createEmpresa, updateEmpresa, deleteEmpresa } from '../controllers/empresasController';

// Locales
import { getLocales, getLocalById, createLocal, updateLocal, deleteLocal, getLocalesByEmpresa, updateLocalWaConfig } from '../controllers/localesController';

// Configuración
import { getConfiguracion, updateConfiguracion, uploadLogo, getTicketData, getTicketVenta, getPlantillasForTicket, updateWaConfig, getWaConfigPublic, getRolesConfig, updateRolesConfig, getTiposProductos, updateTiposProductos, getNivelesPrecios, updateNivelesPrecios, getEstadosConfig, updateEstadosConfig, getConceptosCobro, createConceptoCobro, updateConceptoCobro, deleteConceptoCobro } from '../controllers/configuracionController';

// Plantillas de Ticket
import { getPlantillas, getPlantillaById, createPlantilla, updatePlantilla, deletePlantilla } from '../controllers/ticketPlantillasController';

// Listas de precios
import { getListasPrecios, getListaPrecioById, createListaPrecio, updateListaPrecio, deleteListaPrecio, getClienteListas, getListaClientes, asignarLista, quitarLista, syncClienteListas } from '../controllers/listasController';

// Ventas
import { createVenta, getVentas, getVentaById, finalizarVenta } from '../controllers/ventasController';

// Cortes
import { abrirCorte, getCorteActivo, cerrarCorte, getCortes, getCorteDetalle } from '../controllers/cortesController';

// Logs / Auditoría
import { getLogs } from '../controllers/logsController';

// Notificaciones
import { getNotificaciones, updateNotificacionesConfig, dismissNotificacion, restoreDismissedNotificaciones } from '../controllers/notificacionesController';

// Importación masiva
import { importarPreview, importarConfirmar, importarClientesPreview, importarClientesConfirmar, importarServiciosPreview, importarServiciosConfirmar } from '../controllers/importController';

// Sandbox
import { createSandbox, listSandboxes, deleteSandbox, resetSandbox } from '../controllers/sandboxController';

// Admin DB (descargar/subir BD)
import { downloadDatabase, uploadDatabase } from '../controllers/adminDbController';

const router = Router();

// ── Auth ──────────────────────────────────────────────────────
router.post('/auth/login', login);
router.get('/auth/profile',          authMiddleware, getProfile);
router.put('/auth/profile',          authMiddleware, updateProfile);
router.put('/auth/change-password',  authMiddleware, changePassword);
router.put('/auth/switch-local',    authMiddleware, adminOnly, switchLocal);

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', authMiddleware, getDashboard);


// ── Personas (módulo unificado) ───────────────────────────────
// Listado: solo permiso. Detalle/edición/borrado/permisos: además jerarquía.
router.get('/personas',                        authMiddleware, checkPermiso('personas', 'ver'),    getPersonas);
router.get('/personas/:id',                    authMiddleware, checkPermiso('personas', 'ver'),    verificarJerarquiaVerDetalle, getPersonaById);
router.post('/personas',                       authMiddleware, checkPermiso('personas', 'crear'),  createPersona);
router.put('/personas/:id',                    authMiddleware, checkPermiso('personas', 'editar'), verificarJerarquiaPersona, updatePersona);
router.delete('/personas/:id',                 authMiddleware, checkPermiso('personas', 'borrar'), verificarJerarquiaPersona, deletePersona);
router.put('/personas/:id/acceso',             authMiddleware, adminOnly, verificarJerarquiaPersona, activarAcceso);
router.delete('/personas/:id/acceso',          authMiddleware, adminOnly, verificarJerarquiaPersona, desactivarAcceso);
// Activar / desactivar usuario (sin borrarlo). Body: { activo: true | false }
router.put('/personas/:id/estado',             authMiddleware, adminOnly, verificarJerarquiaPersona, toggleEstadoPersona);
router.get('/personas/:id/permisos',           authMiddleware, adminOnly, verificarJerarquiaPersona, getPersonaPermisos);
router.put('/personas/:id/permisos',           authMiddleware, adminOnly, verificarJerarquiaPersona, updatePersonaPermisos);
router.get('/personas/:id/listas',             authMiddleware, checkPermiso('clientes', 'ver'),    getClienteListas);
router.put('/personas/:id/listas',             authMiddleware, checkPermiso('clientes', 'editar'), syncClienteListas);
router.post('/personas/:id/listas',            authMiddleware, checkPermiso('clientes', 'editar'), asignarLista);
router.delete('/personas/:id/listas/:listaId', authMiddleware, checkPermiso('clientes', 'editar'), quitarLista);
// ── Catálogo de permisos (para construir UI de gestión) ──────
router.get('/permisos/catalogo',               authMiddleware, adminOnly, getCatalogoPermisos);

// ── Búsqueda global (command palette) ─────────────────────────
router.get('/search',                          authMiddleware, globalSearch);

// ── Listas de Precios (módulo separado de clientes) ──────────
router.get('/listas-precios',              authMiddleware, checkPermiso('listas_precios', 'ver'),    getListasPrecios);
router.get('/listas-precios/:id',          authMiddleware, checkPermiso('listas_precios', 'ver'),    getListaPrecioById);
router.get('/listas-precios/:id/clientes', authMiddleware, checkPermiso('listas_precios', 'ver'),    getListaClientes);
router.post('/listas-precios',             authMiddleware, checkPermiso('listas_precios', 'crear'),  createListaPrecio);
router.put('/listas-precios/:id',          authMiddleware, checkPermiso('listas_precios', 'editar'), updateListaPrecio);
router.delete('/listas-precios/:id',       authMiddleware, checkPermiso('listas_precios', 'borrar'), deleteListaPrecio);

// ── Servicios ─────────────────────────────────────────────────
// Reporte de servicios: usa permiso del módulo base servicios (su scope aplica).
router.get('/servicios/reporte',  authMiddleware, checkPermiso('servicios', 'ver'), getReporte);
router.get('/servicios/pagos',    authMiddleware, checkPermiso('servicios', 'ver'), getPagosServicioReporte);
router.get('/servicios/dashboard',authMiddleware, getDashboard);
router.get('/servicios',          authMiddleware, checkPermiso('servicios', 'ver'),    getServicios);
router.get('/servicios/:id',      authMiddleware, checkPermiso('servicios', 'ver'),    getServicioById);
router.post('/servicios',         authMiddleware, checkPermiso('servicios', 'crear'),  createServicio);
router.put('/servicios/:id',      authMiddleware, checkPermiso('servicios', 'editar'), updateServicio);
router.delete('/servicios/:id',   authMiddleware, checkPermiso('servicios', 'borrar'), deleteServicio);
router.get('/servicios/:id/pagos',  authMiddleware, checkPermiso('servicios', 'ver'),    getPagosServicio);
router.post('/servicios/:id/cobrar',authMiddleware, checkPermiso('servicios', 'editar'), cobrarServicio);

// ── Productos ────────────────────────────────────────────────
router.get('/productos',       authMiddleware, checkPermiso('productos', 'ver'),    getProductos);
router.get('/productos/:id',   authMiddleware, checkPermiso('productos', 'ver'),    getProductoById);
router.post('/productos',      authMiddleware, checkPermiso('productos', 'crear'),  createProducto);
router.put('/productos/:id',   authMiddleware, checkPermiso('productos', 'editar'), updateProducto);
router.delete('/productos/:id',authMiddleware, checkPermiso('productos', 'borrar'), deleteProducto);

// ── Empresas ──────────────────────────────────────────────────
router.get('/empresas',       authMiddleware, checkPermiso('empresas', 'ver'),    getEmpresas);
router.get('/empresas/:empresaId/locales', authMiddleware, checkPermiso('locales', 'ver'), getLocalesByEmpresa);
router.get('/empresas/:id',   authMiddleware, checkPermiso('empresas', 'ver'),    getEmpresaById);
router.post('/empresas',      authMiddleware, rootOnly,                            createEmpresa);
router.put('/empresas/:id',   authMiddleware, checkPermiso('empresas', 'editar'), updateEmpresa);
router.delete('/empresas/:id',authMiddleware, rootOnly,                            deleteEmpresa);

// ── Locales ───────────────────────────────────────────────────
router.get('/locales',        authMiddleware, checkPermiso('locales', 'ver'),    getLocales);
router.get('/locales/:id',    authMiddleware, checkPermiso('locales', 'ver'),    getLocalById);
router.post('/locales',       authMiddleware, checkPermiso('locales', 'crear'),  createLocal);
router.put('/locales/:id/wa-config', authMiddleware, adminOnly, updateLocalWaConfig);
router.put('/locales/:id',    authMiddleware, checkPermiso('locales', 'editar'), updateLocal);
router.delete('/locales/:id', authMiddleware, checkPermiso('locales', 'borrar'), deleteLocal);


// ── Configuración ────────────────────────────────────────────
router.get('/configuracion/wa',      authMiddleware, getWaConfigPublic);
router.get('/configuracion/roles',          authMiddleware, getRolesConfig);
router.put('/configuracion/roles',          authMiddleware, adminOnly, updateRolesConfig);  // meta-config: solo admin
router.get('/configuracion/estados',         authMiddleware, getEstadosConfig);
router.put('/configuracion/estados',         authMiddleware, adminOnly, updateEstadosConfig);  // meta-config: solo admin
// Conceptos de cobro: nuevo permiso granular
router.get('/configuracion/conceptos-cobro',        authMiddleware, checkPermiso('conceptos_cobro', 'ver'),    getConceptosCobro);
router.post('/configuracion/conceptos-cobro',       authMiddleware, checkPermiso('conceptos_cobro', 'crear'),  createConceptoCobro);
router.put('/configuracion/conceptos-cobro/:id',    authMiddleware, checkPermiso('conceptos_cobro', 'editar'), updateConceptoCobro);
router.delete('/configuracion/conceptos-cobro/:id', authMiddleware, checkPermiso('conceptos_cobro', 'borrar'), deleteConceptoCobro);
router.get('/configuracion/tipos-productos',  authMiddleware, getTiposProductos);
router.put('/configuracion/tipos-productos',  authMiddleware, adminOnly, updateTiposProductos);  // meta-config: solo admin
router.get('/configuracion/niveles-precio',   authMiddleware, getNivelesPrecios);
router.put('/configuracion/niveles-precio',   authMiddleware, adminOnly, updateNivelesPrecios);  // meta-config: solo admin
// Configuración general (datos empresa, logo, ticket): permiso granular
router.get('/configuracion',         authMiddleware, checkPermiso('configuracion', 'ver'),    getConfiguracion);
router.put('/configuracion/wa',      authMiddleware, checkPermiso('wa_config',     'editar'), updateWaConfig);
router.put('/configuracion',         authMiddleware, checkPermiso('configuracion', 'editar'), updateConfiguracion);
router.post('/upload/logo',          authMiddleware, checkPermiso('subir_logos',   'ver'),    uploadLogo);
router.get('/ticket/:servicioId',    authMiddleware, getTicketData);
router.get('/ticket-venta/:ventaId', authMiddleware, getTicketVenta);

// ── Plantillas de Ticket: permiso granular ──────────────────
router.get('/ticket-plantillas-list',    authMiddleware, getPlantillasForTicket);
router.get('/ticket-plantillas',         authMiddleware, checkPermiso('ticket_plantillas', 'ver'),    getPlantillas);
router.get('/ticket-plantillas/:id',     authMiddleware, checkPermiso('ticket_plantillas', 'ver'),    getPlantillaById);
router.post('/ticket-plantillas',        authMiddleware, checkPermiso('ticket_plantillas', 'crear'),  createPlantilla);
router.put('/ticket-plantillas/:id',     authMiddleware, checkPermiso('ticket_plantillas', 'editar'), updatePlantilla);
router.delete('/ticket-plantillas/:id',  authMiddleware, checkPermiso('ticket_plantillas', 'borrar'), deletePlantilla);

// ── Ventas ───────────────────────────────────────────────────
router.get('/ventas',    authMiddleware, checkPermiso('ventas', 'ver'),   getVentas);
router.get('/ventas/:id',authMiddleware, checkPermiso('ventas', 'ver'),   getVentaById);
router.post('/ventas',              authMiddleware, checkPermiso('ventas', 'crear'), createVenta);
// Finalizar venta a crédito: permiso especial separado
router.post('/ventas/:id/finalizar',authMiddleware, checkPermiso('finalizar_credito', 'ver'), finalizarVenta);

// ── Cortes ───────────────────────────────────────────────────
router.get('/cortes',              authMiddleware, checkPermiso('cortes', 'ver'),    getCortes);
router.get('/cortes/:id/detalle', authMiddleware, checkPermiso('cortes', 'ver'),    getCorteDetalle);
router.get('/cortes/activo',       authMiddleware, getCorteActivo);
router.post('/cortes/apertura',    authMiddleware, checkPermiso('cortes', 'crear'),  abrirCorte);
router.post('/cortes/:id/cerrar',  authMiddleware, checkPermiso('cortes', 'editar'), cerrarCorte);

// ── Auditoría ────────────────────────────────────────────────
router.get('/logs', authMiddleware, checkPermiso('auditoria', 'ver'), getLogs);

// ── Notificaciones (permiso granular) ───────────────────────
router.get('/notificaciones',                  authMiddleware, checkPermiso('notificaciones', 'ver'),    getNotificaciones);
router.post('/notificaciones/dismiss',         authMiddleware, checkPermiso('notificaciones', 'ver'),    dismissNotificacion);
router.delete('/notificaciones/dismissed',     authMiddleware, checkPermiso('notificaciones', 'ver'),    restoreDismissedNotificaciones);
router.put('/configuracion/notificaciones',    authMiddleware, checkPermiso('notificaciones', 'editar'), updateNotificacionesConfig);

// ── Importación masiva (un solo permiso para todos los XLSX) ─
router.post('/productos/importar/preview',   authMiddleware, checkPermiso('importar_xlsx', 'ver'), importarPreview);
router.post('/productos/importar/confirmar', authMiddleware, checkPermiso('importar_xlsx', 'ver'), importarConfirmar);
router.post('/clientes/importar/preview',    authMiddleware, checkPermiso('importar_xlsx', 'ver'), importarClientesPreview);
router.post('/clientes/importar/confirmar',  authMiddleware, checkPermiso('importar_xlsx', 'ver'), importarClientesConfirmar);
router.post('/servicios/importar/preview',   authMiddleware, checkPermiso('importar_xlsx', 'ver'), importarServiciosPreview);
router.post('/servicios/importar/confirmar', authMiddleware, checkPermiso('importar_xlsx', 'ver'), importarServiciosConfirmar);

// ── Sandbox (solo root) ─────────────────────────────────────
router.get('/sandbox',           authMiddleware, rootOnly, listSandboxes);
router.post('/sandbox',          authMiddleware, rootOnly, createSandbox);
router.delete('/sandbox/:id',    authMiddleware, rootOnly, deleteSandbox);
router.put('/sandbox/:id/reset', authMiddleware, rootOnly, resetSandbox);

// ── Admin BD: descargar / subir el archivo .db (sólo root) ─────────────
// El upload usa express.raw para recibir el binario directamente sin JSON.
// Aumentamos el límite a 200 MB para BDs grandes.
router.get('/admin/database/download',  authMiddleware, rootOnly, downloadDatabase);
router.post('/admin/database/upload',   authMiddleware, rootOnly,
  raw({ type: 'application/octet-stream', limit: '200mb' }), uploadDatabase);

export default router;
