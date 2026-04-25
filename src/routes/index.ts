// src/routes/index.ts
// Enrutador principal — agrega todos los módulos

import { Router } from 'express';
import { authMiddleware, adminOnly, rootOnly } from '../middleware/auth';
import { checkPermiso } from '../middleware/permisos';

// Auth
import { login, getProfile, updateProfile, changePassword, switchLocal } from '../controllers/authController';

// Clientes
import { getClientes, getClienteById, createCliente, updateCliente, deleteCliente, updateRoles } from '../controllers/clientesController';

// Personas (módulo unificado)
import { getPersonas, getPersonaById, createPersona, updatePersona, deletePersona, activarAcceso, desactivarAcceso, getPermisos as getPersonaPermisos, updatePermisos as updatePersonaPermisos } from '../controllers/personasController';

// Servicios
import { getServicios, getServicioById, createServicio, updateServicio, deleteServicio, getReporte, getDashboard, cobrarServicio, getPagosServicio, getPagosServicioReporte } from '../controllers/serviciosController';

// Productos
import { getProductos, getProductoById, createProducto, updateProducto, deleteProducto } from '../controllers/productosController';

// Usuarios
import { getUsuarios, getUsuarioById, createUsuario, updateUsuario, deleteUsuario, getPermisos, updatePermisos } from '../controllers/usuariosController';

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
import { getNotificaciones, updateNotificacionesConfig } from '../controllers/notificacionesController';

// Importación masiva
import { importarPreview, importarConfirmar } from '../controllers/importController';

// Sandbox
import { createSandbox, listSandboxes, deleteSandbox, resetSandbox } from '../controllers/sandboxController';

const router = Router();

// ── Auth ──────────────────────────────────────────────────────
router.post('/auth/login', login);
router.get('/auth/profile',          authMiddleware, getProfile);
router.put('/auth/profile',          authMiddleware, updateProfile);
router.put('/auth/change-password',  authMiddleware, changePassword);
router.put('/auth/switch-local',    authMiddleware, adminOnly, switchLocal);

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', authMiddleware, getDashboard);

// ── Clientes ──────────────────────────────────────────────────
router.get('/clientes',                          authMiddleware, checkPermiso('clientes', 'ver'),    getClientes);
router.get('/clientes/:id',                      authMiddleware, checkPermiso('clientes', 'ver'),    getClienteById);
router.post('/clientes',                         authMiddleware, checkPermiso('clientes', 'crear'),  createCliente);
router.put('/clientes/:id',                      authMiddleware, checkPermiso('clientes', 'editar'), updateCliente);
router.delete('/clientes/:id',                   authMiddleware, checkPermiso('clientes', 'borrar'), deleteCliente);
router.put('/clientes/:id/roles',               authMiddleware, checkPermiso('clientes', 'editar'), updateRoles);
router.get('/clientes/:id/listas',               authMiddleware, checkPermiso('clientes', 'ver'),    getClienteListas);
router.put('/clientes/:id/listas',               authMiddleware, checkPermiso('clientes', 'editar'), syncClienteListas);
router.post('/clientes/:id/listas',              authMiddleware, checkPermiso('clientes', 'editar'), asignarLista);
router.delete('/clientes/:id/listas/:listaId',   authMiddleware, checkPermiso('clientes', 'editar'), quitarLista);

// ── Personas (módulo unificado) ───────────────────────────────
router.get('/personas',                        authMiddleware, checkPermiso('personas', 'ver'),    getPersonas);
router.get('/personas/:id',                    authMiddleware, checkPermiso('personas', 'ver'),    getPersonaById);
router.post('/personas',                       authMiddleware, checkPermiso('personas', 'crear'),  createPersona);
router.put('/personas/:id',                    authMiddleware, checkPermiso('personas', 'editar'), updatePersona);
router.delete('/personas/:id',                 authMiddleware, checkPermiso('personas', 'borrar'), deletePersona);
router.put('/personas/:id/acceso',             authMiddleware, adminOnly, activarAcceso);
router.delete('/personas/:id/acceso',          authMiddleware, adminOnly, desactivarAcceso);
router.get('/personas/:id/permisos',           authMiddleware, adminOnly, getPersonaPermisos);
router.put('/personas/:id/permisos',           authMiddleware, adminOnly, updatePersonaPermisos);

// ── Listas de Precios ─────────────────────────────────────────
router.get('/listas-precios',              authMiddleware, checkPermiso('clientes', 'ver'),    getListasPrecios);
router.get('/listas-precios/:id',          authMiddleware, checkPermiso('clientes', 'ver'),    getListaPrecioById);
router.get('/listas-precios/:id/clientes', authMiddleware, checkPermiso('clientes', 'ver'),    getListaClientes);
router.post('/listas-precios',             authMiddleware, checkPermiso('clientes', 'crear'),  createListaPrecio);
router.put('/listas-precios/:id',          authMiddleware, checkPermiso('clientes', 'editar'), updateListaPrecio);
router.delete('/listas-precios/:id',       authMiddleware, checkPermiso('clientes', 'borrar'), deleteListaPrecio);

// ── Servicios ─────────────────────────────────────────────────
router.get('/servicios/reporte',  authMiddleware, checkPermiso('reportes', 'ver'), getReporte);
router.get('/servicios/pagos',    authMiddleware, checkPermiso('reportes', 'ver'), getPagosServicioReporte);
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

// ── Usuarios (solo admin/root) ────────────────────────────────
router.get('/usuarios',              authMiddleware, adminOnly, getUsuarios);
router.get('/usuarios/:id',          authMiddleware, adminOnly, getUsuarioById);
router.post('/usuarios',             authMiddleware, adminOnly, createUsuario);
router.put('/usuarios/:id',          authMiddleware, adminOnly, updateUsuario);
router.delete('/usuarios/:id',       authMiddleware, adminOnly, deleteUsuario);
router.get('/usuarios/:id/permisos', authMiddleware, adminOnly, getPermisos);
router.put('/usuarios/:id/permisos', authMiddleware, adminOnly, updatePermisos);

// ── Configuración ────────────────────────────────────────────
router.get('/configuracion/wa',      authMiddleware, getWaConfigPublic);
router.get('/configuracion/roles',          authMiddleware, getRolesConfig);
router.put('/configuracion/roles',          authMiddleware, adminOnly, updateRolesConfig);
router.get('/configuracion/estados',          authMiddleware, getEstadosConfig);
router.put('/configuracion/estados',          authMiddleware, adminOnly, updateEstadosConfig);
router.get('/configuracion/conceptos-cobro',  authMiddleware, getConceptosCobro);
router.post('/configuracion/conceptos-cobro', authMiddleware, adminOnly, createConceptoCobro);
router.put('/configuracion/conceptos-cobro/:id',    authMiddleware, adminOnly, updateConceptoCobro);
router.delete('/configuracion/conceptos-cobro/:id', authMiddleware, adminOnly, deleteConceptoCobro);
router.get('/configuracion/tipos-productos',  authMiddleware, getTiposProductos);
router.put('/configuracion/tipos-productos',  authMiddleware, adminOnly, updateTiposProductos);
router.get('/configuracion/niveles-precio',   authMiddleware, getNivelesPrecios);
router.put('/configuracion/niveles-precio',   authMiddleware, adminOnly, updateNivelesPrecios);
router.get('/configuracion',         authMiddleware, adminOnly, getConfiguracion);
router.put('/configuracion/wa',      authMiddleware, adminOnly, updateWaConfig);
router.put('/configuracion',         authMiddleware, adminOnly, updateConfiguracion);
router.post('/upload/logo',          authMiddleware, adminOnly, uploadLogo);
router.get('/ticket/:servicioId',    authMiddleware, getTicketData);
router.get('/ticket-venta/:ventaId', authMiddleware, getTicketVenta);

// ── Plantillas de Ticket ────────────────────────────────────
router.get('/ticket-plantillas-list',    authMiddleware, getPlantillasForTicket);
router.get('/ticket-plantillas',         authMiddleware, adminOnly, getPlantillas);
router.get('/ticket-plantillas/:id',     authMiddleware, adminOnly, getPlantillaById);
router.post('/ticket-plantillas',        authMiddleware, adminOnly, createPlantilla);
router.put('/ticket-plantillas/:id',     authMiddleware, adminOnly, updatePlantilla);
router.delete('/ticket-plantillas/:id',  authMiddleware, adminOnly, deletePlantilla);

// ── Ventas ───────────────────────────────────────────────────
router.get('/ventas',    authMiddleware, checkPermiso('ventas', 'ver'),   getVentas);
router.get('/ventas/:id',authMiddleware, checkPermiso('ventas', 'ver'),   getVentaById);
router.post('/ventas',              authMiddleware, checkPermiso('ventas', 'crear'), createVenta);
router.post('/ventas/:id/finalizar',authMiddleware, checkPermiso('ventas', 'crear'), finalizarVenta);

// ── Cortes ───────────────────────────────────────────────────
router.get('/cortes',              authMiddleware, checkPermiso('cortes', 'ver'),    getCortes);
router.get('/cortes/:id/detalle', authMiddleware, checkPermiso('cortes', 'ver'),    getCorteDetalle);
router.get('/cortes/activo',       authMiddleware, getCorteActivo);
router.post('/cortes/apertura',    authMiddleware, checkPermiso('cortes', 'crear'),  abrirCorte);
router.post('/cortes/:id/cerrar',  authMiddleware, checkPermiso('cortes', 'editar'), cerrarCorte);

// ── Auditoría ────────────────────────────────────────────────
router.get('/logs', authMiddleware, checkPermiso('auditoria', 'ver'), getLogs);

// ── Notificaciones ──────────────────────────────────────────
router.get('/notificaciones',                  authMiddleware, getNotificaciones);
router.put('/configuracion/notificaciones',    authMiddleware, adminOnly, updateNotificacionesConfig);

// ── Importación masiva ───────────────────────────────────────
router.post('/productos/importar/preview',   authMiddleware, checkPermiso('importar_productos', 'crear'), importarPreview);
router.post('/productos/importar/confirmar', authMiddleware, checkPermiso('importar_productos', 'crear'), importarConfirmar);

// ── Sandbox (solo root) ─────────────────────────────────────
router.get('/sandbox',           authMiddleware, rootOnly, listSandboxes);
router.post('/sandbox',          authMiddleware, rootOnly, createSandbox);
router.delete('/sandbox/:id',    authMiddleware, rootOnly, deleteSandbox);
router.put('/sandbox/:id/reset', authMiddleware, rootOnly, resetSandbox);

export default router;
