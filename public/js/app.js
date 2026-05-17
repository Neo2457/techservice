// ===== ERROR HANDLER GLOBAL (debug) =====
// Captura cualquier error que ocurra durante la carga del script o en handlers
// asíncronos para que aparezca en la consola del navegador con stack trace.
window.addEventListener('error', function(ev) {
  console.error('[GLOBAL ERROR]', ev.error || ev.message, 'at', ev.filename + ':' + ev.lineno + ':' + ev.colno);
});
window.addEventListener('unhandledrejection', function(ev) {
  console.error('[UNHANDLED REJECTION]', ev.reason);
});

// ===== CONSTANTES UI (se declaran ARRIBA para evitar TDZ si algo más adelante
// en el script lanza un error que detiene la inicialización) =====
var NOTIF_TIPOS = {
  servicio_estado:        { icon: 'fa-screwdriver-wrench', page: 'services' },
  stock_bajo:             { icon: 'fa-box',                page: 'productos' },
  credito_vencido:        { icon: 'fa-clock-rotate-left',  page: 'reportes' },
  pago_pendiente:         { icon: 'fa-hand-holding-dollar',page: 'reportes' },
  corte_sin_apertura:     { icon: 'fa-cash-register',      page: 'pos' },
  empleados_sin_actividad:{ icon: 'fa-users',              page: 'usuarios' },
};
var NOTIF_ESTADOS_CONFIG = [
  { key: 'Recibido',            label: 'Recibido',            clase: 'sp-pending',   defaultHoras: 4  },
  { key: 'Diagnóstico',         label: 'Diagnóstico',         clase: 'sp-progress',  defaultHoras: 6  },
  { key: 'En proceso',          label: 'En proceso',          clase: 'sp-progress',  defaultHoras: 12 },
  { key: 'Esperando refacción', label: 'Esperando refacción', clase: 'sp-pending',   defaultHoras: 72 },
  { key: 'Listo',               label: 'Listo',               clase: 'sp-done',      defaultHoras: 48 },
];

// TOP LEVEL VARS
let currentLang = localStorage.getItem('ts_lang') || 'es';
let currentTheme = localStorage.getItem('ts_theme') || 'dark';
let token = localStorage.getItem('ts_token') || '';
let currentUserData = JSON.parse(localStorage.getItem('ts_user') || 'null');
let userPermisos = JSON.parse(localStorage.getItem('ts_permisos') || '{}');
let waConfig = null;
let allEstados = [];    // cache of estados de servicio (configurable)
let allRoles = [];      // cache of all roles (sistema + custom)
let allTiposProducto = [];
let allNivelesPrecios = [];
let editingId = null;
let deleteId = null;
let currentPage = 1;
let PER_PAGE = 10;
let editingUserId = null;
let permisosUserId = null;
let acSearchTimer = null;
let editingEmpresaId = null;
let editingLocalId = null;
let editingProductoId = null;
let productosPage = 1;
let PROD_LIMIT = 20;
let allEmpresas = [];
let editingClienteId = null;
let clientesPage = 1;
let CLIENTES_PER_PAGE = 20;
let editingListaId = null;
let listasPage = 1;
let LISTAS_PER_PAGE = 20;
let usuariosPage = 1;
let USUARIOS_PER_PAGE = 20;
let empresasPage = 1;
let EMPRESAS_PER_PAGE = 20;
let localesPage = 1;
let LOCALES_PER_PAGE = 20;
let reportSrvData = [];   const repSrvSort = { f: 'fecha_entrada', d: 'desc' }; let REP_SRV_PER_PAGE = 25; let repSrvPage = 1;
let reportCobrosData = []; const cobrosSort = { f: 'fecha',         d: 'desc' }; let COBROS_PER_PAGE  = 25; let cobrosPage  = 1;
let reportCortesData = []; const rcSort     = { f: 'fecha_apertura', d: 'desc' }; let RC_PER_PAGE    = 20; let rcPage      = 1;
let rcrFilteredData  = []; const rcrSort    = { f: 'fecha',          d: 'desc' }; let RCR_PER_PAGE   = 20; let rcrPage     = 1;
let plantillasData   = [];  const pltSort   = { f: 'nombre',         d: 'asc'  };
let dashMode = 'general'; // 'general' | 'local' | 'empleado'
let posConceptosCobro = []; // loaded from /configuracion/conceptos-cobro
let posCart = [];          // { rowId, productoId, codigo, nombre, precioOriginal, precioUnitario, cantidad, subtotal }
let posNextRowId = 1;
let posClienteId = null;
let posClienteNombre = '';
let posListaInfo = null; // { nombre, descuento_porcentaje } — active price list for selected client
let posSelectedMethod = 'efectivo';
let posSplitMode = false;
let posPagos = [{ metodo: 'efectivo', monto: '' }];
let posCreditoFecha = '';
let corteActivo = null;
let posAcTimer = null;
let viewingServiceId = null;
let viewingServiceData = null;
let _statusPopoverServiceId = null;
let _dashLoading = false;
let currentConfig = null;
let activeConfigTab = 'general';
let CFG_SECTIONS = ['general','ticket-venta','ticket-servicio','plantillas','etiquetas','wa','notificaciones','roles','estados','tipos-productos','conceptos-cobro','auditoria'];
let logsPage = 1;
let LOGS_PER_PAGE = 50;
let _autoCorteInterval = null;
let lastVentaId = null;
let labelTipoImpresion = 'qr'; // 'qr' | 'barcode'
let labelCurrentCode = '';
let qrScanner = null;
let qrScanTarget = null;
let _unifiedAcDebounce = null;
let importPreviewRows = [];
let importTipo = 'productos';
let rvCurrentPage = 1;
let rvTotalPages  = 1;
let rvTotalRows   = 0;
let rvCurrentVentaId = null;
let RV_LIMIT = 25;
let _corteDetalleData = null;
let creditosPendientes = [];
let creditosLoadGen = 0;
let finalizarCreditoId = null;
let finalizarCreditoMethod = 'efectivo';
let _notifInterval = null;
let _notifData = { notifs: [], total: 0 };
let personasPage = 1;
let personasRolTab = 'cliente';
let PERSONAS_PER_PAGE = 20;
let editingPersonaId = null;
let permisosPersonaId = null;
let MODULOS_PERMISOS = [];
let PERSONA_MODULOS = [];
let _catalogoCache = null;
let _gsState = { open: false, results: [], selectedIdx: 0, debounceId: null, lastQ: '' };
// END TOP LEVEL VARS
// TechService Pro — script principal
// ===== TRANSLATIONS =====
currentLang = localStorage.getItem('ts_lang') || 'es';

const TRANSLATIONS = {
  es: {
    // Login
    'login.tagline': 'Sistema integral de gestión para tu taller de reparaciones y servicios técnicos.',
    'login.stat.clientes': 'Clientes',
    'login.stat.ventas': 'Ventas',
    'login.stat.servicios': 'Servicios',
    'login.title': 'Iniciar Sesión',
    'login.subtitle': 'Accede al panel de administración',
    'login.label.usuario': 'Usuario',
    'login.label.contrasena': 'Contraseña',
    'login.btn': 'Entrar al sistema',
    // Sidebar
    'nav.section.principal': 'Principal',
    'nav.section.gestion': 'Gestión',
    'nav.section.pos': 'Caja',
    'nav.section.org': 'Organización',
    'nav.section.sistema': 'Sistema',
    'nav.section.dev': 'Desarrollo',
    'nav.dashboard': 'Dashboard',
    'nav.servicios': 'Servicios',
    'nav.reportes': 'Reportes',
    'nav.vender': 'Caja',
    'nav.productos': 'Productos',
    'nav.clientes': 'Clientes',
    'nav.listas': 'Listas de Precios',
    'nav.empresas': 'Empresas',
    'nav.locales': 'Locales',
    'nav.usuarios': 'Usuarios',
    'nav.configuracion': 'Configuración',
    'nav.sandbox': 'Modo Sandbox',
    'nav.ayuda': 'Ayuda',
    'nav.logout': 'Cerrar sesión',
    'sidebar.sub': 'Admin Panel',
    // Topbar
    'topbar.notif': 'Sin notificaciones nuevas',
    'topbar.search': 'Búsqueda global próximamente',
    'topbar.profile.title': 'Mi perfil',
    // Dashboard
    'dash.filter.label': 'Filtrar por:',
    'dash.filter.all.empresas': 'Todas las empresas',
    'dash.filter.all.locales': 'Todos los locales',
    'dash.stat.total': 'Servicios totales',
    'dash.stat.este.mes': 'Este mes',
    'dash.stat.ingresos': 'Ingresos totales',
    'dash.stat.acumulado': 'Acumulado',
    'dash.stat.proceso': 'En proceso',
    'dash.stat.pendientes': 'Pendientes',
    'dash.stat.completados': 'Completados',
    'dash.stat.entregados': 'Entregados',
    'dash.widget.servicios.mes': 'Servicios por mes',
    'dash.widget.estado': 'Estado de servicios',
    'dash.widget.recientes': 'Servicios recientes',
    'dash.btn.ver.todos': 'Ver todos',
    'dash.empty.servicios': 'Sin servicios registrados',
    'dash.pos.title': 'Caja',
    'dash.stat.ventas.hoy': 'Ventas del día',
    'dash.stat.hoy': 'Hoy',
    'dash.stat.productos': 'Productos registrados',
    'dash.stat.inventario': 'Inventario',
    'dash.stat.creditos': 'Créditos activos',
    'dash.stat.ventas.mes': 'Ventas del mes',
    'dash.widget.ventas.rec': 'Ventas recientes',
    'dash.btn.ver.todas': 'Ver todas',
    'dash.empty.ventas': 'Sin ventas registradas',
    // Servicios page
    'srv.title': 'Módulo de Servicios',
    'srv.subtitle': 'Gestiona todos los servicios y reparaciones del taller',
    'srv.btn.nuevo': 'Nuevo servicio',
    'srv.search.placeholder': 'Buscar por nombre, modelo, folio, falla...',
    'srv.filter.all.empresas': 'Todas las empresas',
    'srv.filter.all.locales': 'Todos los locales',
    'srv.filter.all.estados': 'Todos los estados',
    'srv.filter.all.garantia': 'Toda garantía',
    'srv.th.folio': 'Folio',
    'srv.th.cliente': 'Cliente / Equipo',
    'srv.th.modelo': 'Modelo',
    'srv.th.falla': 'Falla',
    'srv.th.estado': 'Estado',
    'srv.th.garantia': 'Garantía',
    'srv.th.f.entrada': 'F. Entrada',
    'srv.th.total': 'Total',
    'srv.th.anticipo': 'Anticipo',
    'srv.th.f.salida': 'F. Salida',
    'srv.th.empresa': 'Empresa',
    'srv.th.acciones': 'Acciones',
    'srv.empty': 'Sin servicios. Haz clic en "+ Nuevo servicio" para comenzar',
    'srv.table.info': '0 registros',
    // Reportes page
    'rep.title': 'Reportes',
    'rep.subtitle': 'Análisis financiero y operativo',
    'rep.tab.ventas': 'Ventas',
    'rep.tab.servicios': 'Servicios',
    'rep.tab.cortes': 'Cortes',
    'rep.tab.creditos': 'Créditos',
    'rep.btn.export.csv': 'Exportar CSV',
    'rep.label.empresa': 'Empresa',
    'rep.label.desde': 'Desde',
    'rep.label.hasta': 'Hasta',
    'rep.label.metodo': 'Método de pago',
    'rep.label.buscar': 'Buscar folio / cliente',
    'rep.btn.buscar': 'Buscar',
    'rep.opt.todos': 'Todos',
    'rep.opt.efectivo': 'Efectivo',
    'rep.opt.tarjeta': 'Tarjeta',
    'rep.opt.transferencia': 'Transferencia',
    'rep.opt.mixto': 'Mixto',
    'rep.opt.todas': 'Todas',
    'rep.rs.ventas': 'Ventas encontradas',
    'rep.rs.ingresos': 'Ingresos totales',
    'rep.rs.ticket': 'Ticket promedio',
    'rep.rs.productos': 'Productos vendidos',
    'rep.detail.ventas': 'Detalle de ventas',
    'rep.th.folio': 'Folio',
    'rep.th.fecha': 'Fecha',
    'rep.th.cliente': 'Cliente',
    'rep.th.cajero': 'Cajero',
    'rep.th.metodo': 'Método',
    'rep.th.desc': 'Desc.',
    'rep.th.total': 'Total',
    'rep.th.acciones': 'Acciones',
    'rep.empty.ventas': 'Usa los filtros y presiona Buscar',
    'rep.btn.anterior': 'Anterior',
    'rep.btn.siguiente': 'Siguiente',
    'rep.srv.label.empresa': 'Empresa',
    'rep.srv.label.local': 'Local',
    'rep.srv.label.inicio': 'Fecha inicio',
    'rep.srv.label.fin': 'Fecha fin',
    'rep.srv.label.estado': 'Estado',
    'rep.srv.btn.generar': 'Generar reporte',
    'rep.srv.filter.label': 'Filtros de período',
    'rep.srv.rs.ingresos': 'Ingresos totales',
    'rep.srv.rs.costos': 'Costo refacciones',
    'rep.srv.rs.utilidad': 'Utilidad neta',
    'rep.srv.rs.count': 'Servicios en período',
    'rep.srv.detail': 'Detalle de servicios',
    'rep.srv.th.folio': 'Folio',
    'rep.srv.th.cliente': 'Cliente',
    'rep.srv.th.equipo': 'Equipo / Modelo',
    'rep.srv.th.estado': 'Estado',
    'rep.srv.th.entrada': 'F. Entrada',
    'rep.srv.th.salida': 'F. Salida',
    'rep.srv.th.anticipo': 'Anticipo',
    'rep.srv.th.costo': 'Costo Ref.',
    'rep.srv.th.total': 'Total',
    'rep.srv.th.utilidad': 'Utilidad',
    'rep.srv.empty': 'Genera un reporte para ver los datos',
    'rep.cortes.filter': 'Filtros',
    'rep.cortes.label.inicio': 'Fecha inicio',
    'rep.cortes.label.fin': 'Fecha fin',
    'rep.cortes.label.usuario': 'Usuario',
    'rep.cortes.opt.todos': 'Todos los usuarios',
    'rep.cortes.btn': 'Generar',
    'rep.cortes.rs.total': 'Total cortes',
    'rep.cortes.rs.ventas': 'Ventas registradas',
    'rep.cortes.rs.efectivo': 'Efectivo esperado',
    'rep.cortes.rs.dif': 'Diferencia total',
    'rep.cortes.detail': 'Detalle de cortes',
    'rep.cortes.th.usuario': 'Usuario',
    'rep.cortes.th.fecha': 'Fecha',
    'rep.cortes.th.inicio': 'Hora inicio',
    'rep.cortes.th.fin': 'Hora fin',
    'rep.cortes.th.fondo': 'Efectivo inicial',
    'rep.cortes.th.ventas': 'Ventas',
    'rep.cortes.th.retiros': 'Retiros',
    'rep.cortes.th.esperado': 'Esperado',
    'rep.cortes.th.real': 'Real',
    'rep.cortes.th.dif': 'Diferencia',
    'rep.cortes.empty': 'Genera un reporte para ver los cortes',
    'rep.creditos.btn.actualizar': 'Actualizar',
    'rep.creditos.rs.pendientes': 'Créditos pendientes',
    'rep.creditos.rs.monto': 'Monto total pendiente',
    'rep.creditos.rs.antiguo': 'Más antiguo',
    'rep.creditos.detail': 'Ventas pendientes de cobro',
    'rep.creditos.search': 'Buscar folio o cliente...',
    'rep.creditos.th.folio': 'Folio',
    'rep.creditos.th.cliente': 'Cliente',
    'rep.creditos.th.fecha': 'Fecha venta',
    'rep.creditos.th.productos': 'Productos',
    'rep.creditos.th.total': 'Total',
    'rep.creditos.th.acciones': 'Acciones',
    'rep.creditos.empty': 'Sin créditos pendientes',
    // Usuarios
    'usr.title': 'Gestión de Usuarios',
    'usr.subtitle': 'Administra usuarios y sus permisos de acceso',
    'usr.btn.nuevo': 'Nuevo usuario',
    'usr.filter.all.empresas': 'Todas las empresas',
    'usr.filter.all.locales': 'Todos los locales',
    'usr.filter.all.tipos': 'Todos los tipos',
    'usr.opt.admin': 'Administrador',
    'usr.opt.empleado': 'Empleado',
    'usr.opt.root': 'Desarrollador',
    'usr.tipo.root': 'Desarrollador',
    'usr.tipo.admin': 'Administrador',
    'usr.tipo.empleado': 'Empleado',
    'usr.sin.local': '— Sin local',
    'usr.empty.data': 'Sin usuarios registrados',
    'usr.filter.buscar.ph': 'Buscar por nombre o correo...',
    'usr.th.nombre': 'Nombre',
    'usr.th.tipo': 'Tipo',
    'usr.th.empresa': 'Empresa',
    'usr.th.local': 'Local',
    'usr.th.estado': 'Estado',
    'usr.th.fecha': 'Fecha creación',
    'usr.th.acciones': 'Acciones',
    'usr.empty': 'Cargando usuarios...',
    // Empresas
    'emp.title': 'Gestión de Empresas',
    'emp.subtitle': 'Administra las empresas registradas en el sistema',
    'emp.btn.nuevo': 'Nueva empresa',
    'emp.th.nombre': 'Nombre',
    'emp.th.iniciales': 'Iniciales',
    'emp.th.rfc': 'RFC',
    'emp.th.ciudad': 'Ciudad',
    'emp.th.encargado': 'Encargado',
    'emp.th.locales': 'Locales',
    'emp.th.estatus': 'Estatus',
    'emp.th.acciones': 'Acciones',
    'emp.empty': 'Cargando empresas...',
    // Locales
    'loc.title': 'Gestión de Locales',
    'loc.subtitle': 'Administra las sucursales y locales de operación',
    'loc.btn.nuevo': 'Nuevo local',
    'loc.filter.all.empresas': 'Todas las empresas',
    'loc.th.nombre': 'Nombre',
    'loc.th.empresa': 'Empresa',
    'loc.th.ciudad': 'Ciudad',
    'loc.th.telefono': 'Teléfono',
    'loc.th.gerente': 'Gerente',
    'loc.th.usuarios': 'Usuarios',
    'loc.th.estatus': 'Estatus',
    'loc.th.acciones': 'Acciones',
    'loc.empty': 'Cargando locales...',
    // Clientes
    'cli.title': 'Gestión de Clientes',
    'cli.subtitle': 'Administra los clientes registrados en el sistema',
    'cli.btn.nuevo': 'Nuevo cliente',
    'cli.search.placeholder': 'Buscar por nombre, teléfono, correo...',
    'cli.filter.all.tipos': 'Todos los tipos',
    'cli.opt.regular': 'Regular',
    'cli.opt.frecuente': 'Frecuente',
    'cli.opt.mayorista': 'Mayorista',
    'cli.filter.all.empresas': 'Todas las empresas',
    'cli.th.nombre': 'Nombre',
    'cli.th.telefono': 'Teléfono',
    'cli.th.correo': 'Correo',
    'cli.th.tipo': 'Tipo',
    'cli.th.listas': 'Listas de precios',
    'cli.th.empresa': 'Empresa / Local',
    'cli.th.fecha': 'Fecha registro',
    'cli.th.acciones': 'Acciones',
    'cli.empty': 'Cargando clientes...',
    // Productos
    'prod.title': 'Gestión de Productos',
    'prod.subtitle': 'Administra el inventario de productos para venta',
    'prod.btn.nuevo': 'Nuevo producto',
    'prod.search.placeholder': 'Buscar por código o nombre...',
    'prod.filter.all.empresas': 'Todas las empresas',
    'prod.filter.all.locales': 'Todos los locales',
    'prod.th.codigo': 'Código',
    'prod.th.nombre': 'Nombre',
    'prod.th.compra': 'Compra',
    'prod.th.venta': 'Venta',
    'prod.th.existencia': 'Existencia',
    'prod.th.local': 'Local',
    'prod.th.empresa': 'Empresa',
    'prod.th.qr': 'QR',
    'prod.th.acciones': 'Acciones',
    'prod.empty': 'Cargando productos...',
    // Listas de Precios
    'lp.title': 'Listas de Precios',
    'lp.subtitle': 'Gestiona listas de precios especiales para diferentes tipos de clientes',
    'lp.btn.nueva': 'Nueva lista',
    'lp.search.placeholder': 'Buscar por nombre...',
    'lp.filter.all.empresas': 'Todas las empresas',
    'lp.th.nombre': 'Nombre',
    'lp.th.descripcion': 'Descripción',
    'lp.th.descuento': 'Descuento %',
    'lp.th.nivel': 'Nivel de precio',
    'lp.th.clientes': 'Clientes',
    'lp.th.empresa': 'Empresa',
    'lp.th.fecha': 'Fecha creación',
    'lp.th.acciones': 'Acciones',
    'lp.empty': 'Cargando listas de precios...',
    // POS
    'pos.scan.placeholder': 'Escanear código de barras o buscar producto...',
    'pos.th.producto': 'Producto',
    'pos.th.cantidad': 'Cantidad',
    'pos.th.precio': 'Precio',
    'pos.th.subtotal': 'Subtotal',
    'pos.empty.scan': 'Escanea un producto para comenzar',
    'pos.empty.scan.sub': 'Usa el lector de código de barras o busca manualmente',
    'pos.btn.limpiar': 'Limpiar',
    'pos.resumen': 'Resumen de Venta',
    'pos.label.cliente': 'Cliente (opcional)',
    'pos.cliente.placeholder': 'Buscar cliente...',
    'pos.subtotal': 'Subtotal',
    'pos.descuento': 'Descuento',
    'pos.total': 'TOTAL',
    'pos.label.metodo': 'Método de pago',
    'pos.btn.dividir': 'Dividir pago',
    'pos.pay.efectivo': 'Efectivo',
    'pos.pay.tarjeta': 'Tarjeta',
    'pos.pay.transferencia': 'Transferencia',
    'pos.pay.credito': 'Crédito',
    'pos.label.pago.dividido': 'Pago dividido',
    'pos.btn.cancelar.split': 'Cancelar',
    'pos.btn.agregar.pago': 'Agregar forma de pago',
    'pos.corte.desde': 'Desde:',
    'pos.corte.efectivo': 'Efectivo:',
    'pos.corte.ventas': 'Ventas:',
    'pos.corte.abierta': 'Caja abierta',
    'pos.btn.cerrar.corte': 'Cerrar Corte',
    // Sandbox
    'sbx.title': 'Modo Sandbox',
    'sbx.subtitle': 'Crea empresas de prueba con datos de ejemplo para testing. Los datos son completamente independientes.',
    'sbx.btn.crear': 'Crear sandbox',
    // Profile
    'prof.title': 'Mi Perfil',
    'prof.subtitle': 'Administra tu información personal y seguridad de cuenta',
    'prof.cuenta.activa': 'Cuenta activa',
    'prof.actividad': 'Actividad del sistema',
    'prof.stat.servicios': 'Servicios registrados',
    'prof.stat.ingresos': 'Ingresos totales',
    'prof.stat.entregados': 'Entregados',
    'prof.stat.proceso': 'En proceso',
    'prof.datos.title': 'Datos personales',
    'prof.datos.sub': 'Tu información de perfil visible en el sistema',
    'prof.label.nombre': 'Nombre completo',
    'prof.label.correo': 'Correo electrónico',
    'prof.label.telefono': 'Teléfono',
    'prof.label.local': 'Local / sucursal activo',
    'prof.label.empresa': 'Empresa',
    'prof.btn.guardar': 'Guardar datos',
    'prof.pass.title': 'Cambiar contraseña',
    'prof.pass.sub': 'Actualiza tu contraseña de acceso al sistema',
    'prof.label.pass.actual': 'Contraseña actual',
    'prof.label.pass.nueva': 'Nueva contraseña',
    'prof.label.pass.confirm': 'Confirmar nueva contraseña',
    'prof.btn.limpiar': 'Limpiar',
    'prof.btn.actualizar': 'Actualizar contraseña',
    // Configuración
    'cfg.title': 'Configuración',
    'cfg.subtitle': 'Personaliza logos, tickets, etiquetas y auditoría de tu empresa',
    'cfg.empresa.label': 'Empresa:',
    'cfg.general.title': 'General',
    'cfg.general.sub': 'Logo y corte de caja',
    'cfg.logo.mode.label': 'Modo de logo',
    'cfg.logo.mode.empresa': 'Un solo logo por empresa',
    'cfg.logo.mode.local': 'Logo diferente por local',
    'cfg.logo.mode.hint': 'Si eliges "por local", podrás subir un logo distinto en la sección de Locales.',
    'cfg.logo.actual': 'Logo actual de la empresa',
    'cfg.logo.btn': 'Cambiar logo',
    'cfg.corte.title': 'Cortes de Caja',
    'cfg.corte.auto': 'Corte automático',
    'cfg.corte.auto.sub': 'Cierra la caja automáticamente a una hora definida',
    'cfg.corte.hora.label': 'Hora de corte',
    'cfg.tv.title': 'Ticket de Venta (POS)',
    'cfg.tv.sub': 'Recibo impreso al cobrar en el punto de venta',
    'cfg.tv.elementos': 'Elementos visibles',
    'cfg.tv.logo': 'Logo',
    'cfg.tv.empresa': 'Datos de empresa',
    'cfg.tv.folio': 'Folio de venta',
    'cfg.tv.fecha': 'Fecha y hora',
    'cfg.tv.cliente': 'Nombre del cliente',
    'cfg.tv.items': 'Detalle de productos',
    'cfg.tv.metodo': 'Método de pago',
    'cfg.tv.pie': 'Pie de ticket',
    'cfg.ts.title': 'Ticket de Servicio',
    'cfg.ts.sub': 'Diseño y textos del ticket de reparación',
    'cfg.ts.titulo.label': 'Título del ticket',
    'cfg.ts.elementos': 'Elementos visibles',
    'cfg.ts.logo': 'Logo',
    'cfg.ts.telefono': 'Teléfono',
    'cfg.ts.direccion': 'Dirección',
    'cfg.ts.firma.cli': 'Firma del cliente',
    'cfg.ts.firma.tec': 'Firma del técnico',
    'cfg.ts.gracias': 'Mensaje de agradecimiento',
    'cfg.ts.garantia': 'Política de garantía',
    'cfg.ts.revision': 'Política de revisión técnica',
    'cfg.ts.extra': 'Texto adicional',
    'cfg.ts.extra.opt': '(opcional)',
    'cfg.ts.preview': 'Vista previa',
    'cfg.plt.title': 'Plantillas de Ticket',
    'cfg.plt.sub': 'Variantes del ticket con configuraciones distintas',
    'cfg.plt.btn.nueva': 'Nueva',
    'cfg.plt.empty': 'No hay plantillas adicionales.',
    'cfg.plt.th.nombre': 'Nombre',
    'cfg.plt.th.titulo': 'Título',
    'cfg.plt.th.creada': 'Creada',
    'cfg.plt.th.acciones': 'Acciones',
    'cfg.etq.title': 'Etiquetas de Producto',
    'cfg.etq.sub': 'Diseño para impresoras de etiquetas',
    'cfg.etq.elementos': 'Elementos visibles',
    'cfg.etq.nombre': 'Nombre del producto',
    'cfg.etq.codigo': 'Código de barras',
    'cfg.etq.precio': 'Precio de venta',
    'cfg.etq.qr': 'Código QR',
    'cfg.etq.dim': 'Dimensiones (mm)',
    'cfg.etq.ancho': 'Ancho',
    'cfg.etq.alto': 'Alto',
    'cfg.aud.title': 'Auditoría',
    'cfg.aud.sub': 'Registro de acciones de usuarios',
    'cfg.aud.buscar': 'Buscar',
    'cfg.aud.buscar.ph': 'Usuario, descripción...',
    'cfg.aud.modulo': 'Módulo',
    'cfg.aud.accion.label': 'Acción',
    'cfg.aud.desde': 'Desde',
    'cfg.aud.hasta': 'Hasta',
    'cfg.aud.th.fecha': 'Fecha',
    'cfg.aud.th.usuario': 'Usuario',
    'cfg.aud.th.accion': 'Acción',
    'cfg.aud.th.modulo': 'Módulo',
    'cfg.aud.th.desc': 'Descripción',
    'cfg.aud.th.ip': 'IP',
    'cfg.aud.empty': 'Abre esta sección para cargar los registros.',
    'cfg.btn.guardar': 'Guardar configuración',
    // Common buttons / labels
    'btn.cancelar': 'Cancelar',
    'btn.guardar': 'Guardar',
    'btn.eliminar': 'Eliminar',
    'btn.editar': 'Editar',
    'btn.nuevo': 'Nuevo',
    'btn.nueva': 'Nueva',
    'btn.cerrar': 'Cerrar',
    'btn.imprimir': 'Imprimir',
    'btn.aceptar': 'Aceptar',
    'btn.siguiente': 'Siguiente',
    'btn.anterior': 'Anterior',
    // Modals
    'modal.confirm.title': '¿Eliminar registro?',
    'modal.confirm.body': 'Esta acción no se puede deshacer. El servicio será eliminado permanentemente.',
    'modal.confirm.si': 'Sí, eliminar',
    'modal.venta.success.title': '¡Venta registrada!',
    'modal.venta.success.sub': 'La venta se ha guardado correctamente.',
    'modal.venta.folio': 'Folio',
    'modal.venta.total': 'Total',
    'modal.venta.metodo': 'Método',
    'modal.venta.btn.imprimir': 'Imprimir',
    'modal.credito.title': 'Finalizar Crédito',
    'modal.credito.cliente': 'Cliente',
    'modal.credito.fecha': 'Fecha de venta',
    'modal.credito.total': 'Total a cobrar',
    'modal.credito.productos': 'Productos',
    'modal.credito.label': '¿Con qué método pagó el cliente?',
    'modal.credito.mantener': 'Mantener crédito',
    'modal.credito.btn': 'Finalizar y cobrar',
    'modal.apertura.title': 'Apertura de Caja',
    'modal.apertura.sub': 'Ingresa el efectivo inicial en caja',
    'modal.apertura.hint': 'Para iniciar las ventas necesitas abrir la caja. Ingresa el efectivo con el que comienza la jornada. Si no hay fondo, deja en $0.00.',
    'modal.apertura.label': 'Fondo inicial (efectivo en caja)',
    'modal.apertura.btn': 'Abrir Caja',
    'modal.cierre.title': 'Corte de Caja',
    'modal.cierre.resumen': 'Resumen de la jornada',
    'modal.cierre.efectivo': 'Efectivo',
    'modal.cierre.fondo': 'Fondo de apertura',
    'modal.cierre.ventas.ef': 'Ventas en efectivo',
    'modal.cierre.esperado': 'Total esperado en caja',
    'modal.cierre.otros': 'Otras Formas de Pago',
    'modal.cierre.tarjeta': 'Tarjeta',
    'modal.cierre.transfer': 'Transferencia',
    'modal.cierre.credito': 'Crédito',
    'modal.cierre.gran.total': 'Total general de ventas',
    'modal.cierre.contado.hint': 'Opcional: cuenta el efectivo físico para detectar diferencias.',
    'modal.cierre.contado.label': 'Efectivo contado (opcional)',
    'modal.cierre.contado.ph': 'Dejar vacío para omitir',
    'modal.cierre.dif': 'Diferencia',
    'modal.cierre.btn': 'Cerrar Corte',
    // Service modal
    'svc.modal.nuevo': 'Nuevo Servicio',
    'svc.modal.sub': 'Completa los campos del servicio',
    'svc.foto.label': 'Foto / Imagen del equipo',
    'svc.foto.click': 'Haz clic para subir una imagen',
    'svc.foto.sub': 'JPG, PNG, WEBP — máx. 5MB',
    'svc.sec.cliente': 'Datos del Cliente',
    'svc.label.nombre': 'Nombre del cliente *',
    'svc.label.telefono': 'Teléfono',
    'svc.label.correo': 'Correo electrónico',
    'svc.label.direccion': 'Dirección',
    'svc.sec.equipo': 'Datos del Equipo',
    'svc.label.modelo': 'Modelo del equipo *',
    'svc.label.serie': 'Número de serie',
    'svc.label.falla': 'Falla reportada *',
    'svc.label.estado': 'Estado del servicio',
    'svc.label.descripcion': 'Descripción del servicio',
    'svc.label.observaciones': 'Observaciones',
    'svc.label.local': 'Local / Sucursal',
    'svc.sec.garantia': 'Garantía',
    'svc.garantia.sin': 'Sin garantía',
    'svc.sec.fechas': 'Fechas y Costos',
    'svc.label.f.entrada': 'Fecha de entrada',
    'svc.label.f.salida': 'Fecha de salida',
    'svc.label.anticipo': 'Anticipo / Pago parcial ($)',
    'svc.label.costo.ref': 'Costo de refacción ($)',
    'svc.label.costo.total': 'Costo total del servicio ($)',
    'svc.btn.guardar': 'Guardar servicio',
    // Service detail modal
    'sd.title': 'Detalle del Servicio',
    'sd.sub': 'Información completa del servicio',
    'sd.sec.cliente': 'Datos del Cliente',
    'sd.label.nombre': 'Nombre',
    'sd.label.telefono': 'Teléfono',
    'sd.label.correo': 'Correo',
    'sd.label.direccion': 'Dirección',
    'sd.sec.equipo': 'Datos del Equipo',
    'sd.label.modelo': 'Modelo',
    'sd.label.serie': 'N° Serie',
    'sd.label.falla': 'Falla reportada',
    'sd.label.descripcion': 'Descripción del servicio',
    'sd.label.obs': 'Observaciones',
    'sd.sec.estado': 'Estado y Fechas',
    'sd.label.estado': 'Estado',
    'sd.label.garantia': 'Garantía',
    'sd.label.entrada': 'Fecha de entrada',
    'sd.label.salida': 'Fecha de salida',
    'sd.sec.costos': 'Costos',
    'sd.label.anticipo': 'Anticipo',
    'sd.label.refaccion': 'Costo de refacción',
    'sd.label.total': 'Total del servicio',
    'sd.label.restante': 'Restante por cobrar',
    'sd.sec.imagen': 'Imagen adjunta',
    'sd.btn.ticket': 'Imprimir ticket',
    'sd.btn.finalizar': 'Finalizar',
    // Ticket modal
    'tkt.title': 'Ticket de Servicio',
    'tkt.sub': 'Vista previa para impresión',
    'tkt.btn.cerrar': 'Cerrar',
    'tkt.btn.imprimir': 'Imprimir ticket',
    // Plantilla modal
    'plt.modal.nuevo': 'Nueva plantilla de ticket',
    'plt.modal.sub': 'Configura una variante del ticket',
    'plt.label.nombre': 'Nombre de la plantilla *',
    'plt.label.titulo': 'Título del ticket',
    'plt.elementos': 'Elementos visibles',
    'plt.logo': 'Logo de la empresa',
    'plt.telefono': 'Teléfono de contacto',
    'plt.direccion': 'Dirección',
    'plt.firma.cli': 'Firma del cliente',
    'plt.firma.tec': 'Firma del técnico',
    'plt.gracias': 'Mensaje de agradecimiento',
    'plt.garantia': 'Política de garantía',
    'plt.revision': 'Política de revisión técnica',
    'plt.extra': 'Texto adicional',
    'plt.extra.opt': '(opcional)',
    'plt.btn.guardar': 'Guardar plantilla',
    // User modal
    'usr.modal.nuevo': 'Nuevo Usuario',
    'usr.modal.sub': 'Datos de acceso al sistema',
    'usr.label.nombre': 'Nombre completo *',
    'usr.label.correo': 'Correo / usuario *',
    'usr.label.pass': 'Contraseña *',
    'usr.pass.hint': 'Haz clic en "Auto" para asignar contraseña por defecto (12345678)',
    'usr.label.tipo': 'Tipo de usuario',
    'usr.label.telefono': 'Teléfono',
    'usr.label.empresa': 'Empresa *',
    'usr.label.local': 'Local / Sucursal *',
    'usr.btn.guardar': 'Guardar usuario',
    // Permisos modal
    'prm.title': 'Permisos de Usuario',
    'prm.th.modulo': 'Módulo',
    'prm.th.ver': 'Ver',
    'prm.th.crear': 'Crear',
    'prm.th.editar': 'Editar',
    'prm.th.borrar': 'Borrar',
    'prm.btn.desmarcar': 'Desmarcar todo',
    'prm.btn.guardar': 'Guardar permisos',
    // Empresa modal
    'emp.modal.nuevo': 'Nueva Empresa',
    'emp.modal.sub': 'Datos de la empresa',
    'emp.label.nombre': 'Nombre *',
    'emp.label.iniciales': 'Iniciales *',
    'emp.label.rfc': 'RFC',
    'emp.label.telefono': 'Teléfono',
    'emp.label.correo': 'Correo',
    'emp.label.encargado': 'Encargado',
    'emp.label.calle': 'Calle / Dirección',
    'emp.label.cp': 'Código Postal',
    'emp.label.ciudad': 'Ciudad',
    'emp.label.estado': 'Estado',
    'emp.label.tipo': 'Tipo de empresa',
    'emp.opt.servicio': 'Servicio',
    'emp.opt.comercio': 'Comercio',
    'emp.opt.mixto': 'Mixto',
    'emp.label.cobro': 'Cobro por servicio',
    'emp.label.logo': 'Logo de la empresa',
    'emp.btn.logo': 'Subir logo',
    'emp.btn.guardar': 'Guardar empresa',
    // Local modal
    'loc.modal.nuevo': 'Nuevo Local',
    'loc.modal.sub': 'Datos de la sucursal',
    'loc.label.empresa': 'Empresa *',
    'loc.label.nombre': 'Nombre del local *',
    'loc.label.ubicacion': 'Ubicación interna',
    'loc.label.ciudad': 'Ciudad',
    'loc.label.estado': 'Estado',
    'loc.label.telefono': 'Teléfono',
    'loc.label.correo': 'Correo de contacto',
    'loc.label.gerente': 'Gerente encargado',
    'loc.label.apertura': 'Fecha de apertura',
    'loc.label.logo': 'Logo del local',
    'loc.btn.logo': 'Subir logo',
    'loc.btn.guardar': 'Guardar local',
    // Cliente modal
    'cli.modal.nuevo': 'Nuevo Cliente',
    'cli.modal.sub': 'Datos del cliente',
    'cli.label.nombre': 'Nombre completo *',
    'cli.label.telefono': 'Teléfono',
    'cli.label.correo': 'Correo',
    'cli.label.tipo': 'Tipo de cliente',
    'cli.label.direccion': 'Dirección',
    'cli.label.notas': 'Notas',
    'cli.label.listas': 'Listas de precios',
    'cli.btn.guardar': 'Guardar cliente',
    // Cliente detail modal
    'cd.title': 'Detalle del Cliente',
    'cd.stat.servicios': 'Servicios',
    'cd.stat.ventas': 'Ventas',
    'cd.stat.creditos': 'Créditos pendientes',
    'cd.label.telefono': 'Teléfono',
    'cd.label.correo': 'Correo',
    'cd.label.direccion': 'Dirección',
    'cd.listas.title': 'Listas de precios asignadas',
    'cd.listas.sin': 'Sin listas asignadas',
    'cd.servicios.title': 'Últimos servicios',
    'cd.servicios.sin': 'Sin servicios',
    'cd.btn.agregar': 'Agregar cliente',
    'cd.btn.editar': 'Editar cliente',
    // Producto modal
    'prod.modal.nuevo': 'Nuevo Producto',
    'prod.modal.sub': 'Datos del producto',
    'prod.label.codigo': 'Código de barras',
    'prod.label.nombre': 'Nombre del producto *',
    'prod.label.compra': 'Precio de compra ($)',
    'prod.label.venta': 'Precio de venta ($) *',
    'prod.label.precio2': 'Precio 2 ($)',
    'prod.label.precio3': 'Precio 3 ($)',
    'prod.label.existencia': 'Existencia',
    'prod.label.local': 'Local / Sucursal',
    'prod.btn.guardar': 'Guardar producto',
    // Lista precios modal
    'lp.modal.nuevo': 'Nueva Lista de Precios',
    'lp.modal.sub': 'Configuración de la lista',
    'lp.label.nombre': 'Nombre de la lista *',
    'lp.label.descripcion': 'Descripción',
    'lp.label.descuento': 'Descuento adicional (%)',
    'lp.label.nivel': 'Nivel de precio base',
    'lp.btn.guardar': 'Guardar lista',
    // Lista detalle modal
    'ld.title': 'Lista de Precios',
    'ld.label.descuento': 'Descuento',
    'ld.label.nivel': 'Nivel de precio',
    'ld.label.clientes': 'Clientes asignados',
    'ld.label.desc': 'Descripción',
    'ld.clientes.title': 'Clientes con esta lista',
    'ld.btn.editar': 'Editar lista',
    // QR/Label modals
    'lbl.title': 'Etiqueta de Producto',
    'lbl.sub': 'Vista previa para impresión',
    'lbl.btn.imprimir': 'Imprimir etiqueta',
    'qr.title': 'QR del Servicio',
    'qr.sub': 'Folio para identificación',
    'qr.btn.imprimir': 'Imprimir',
    'scan.title': 'Escanear Código',
    'scan.sub': 'Apunta la cámara al código QR o de barras',
    // Abono modal
    'abono.title': 'Registrar Abono',
    'abono.label.pendiente': 'Saldo pendiente',
    'abono.label.total': 'Monto total',
    'abono.label.monto': 'Monto del abono *',
    'abono.label.nota': 'Nota (opcional)',
    'abono.btn': 'Registrar abono',
    // RV Detalle modal
    'rvd.title': 'Detalle de Venta',
    'rvd.btn.reimprimir': 'Reimprimir Ticket',
    // Common status
    'status.activo': 'Activo',
    'status.inactivo': 'Inactivo',
    // Lang toggle
    'lang.toggle': 'EN',
    // Table counts / empty
    'table.registro': 'registro',
    'table.registros': 'registros',
    'table.empty': 'Sin registros encontrados',
    // Payment methods
    'metodo.efectivo': 'Efectivo',
    'metodo.tarjeta': 'Tarjeta',
    'metodo.transferencia': 'Transferencia',
    'metodo.credito': 'Crédito',
    'metodo.mixto': 'Mixto',
    'metodo.split': 'Pago dividido',
    // POS counts
    'pos.item': 'producto',
    'pos.items': 'productos',
    'pos.unit': 'unidad',
    'pos.units': 'unidades',
    'pos.empty.sub': 'Usa el lector de código de barras o busca manualmente',
    // Configuración — Apariencia
    'cfg.ap.title': 'Apariencia',
    'cfg.ap.sub': 'Idioma y apariencia de la interfaz',
    'cfg.ap.lang.label': 'Idioma / Language',
    'cfg.ap.lang.sub': 'Cambia el idioma de la interfaz del sistema',
    'cfg.ap.lang.es': 'Español',
    'cfg.ap.lang.en': 'English',
    'cfg.ap.theme.label': 'Tema / Theme',
    'cfg.ap.theme.sub': 'Elige el aspecto visual del sistema',
    'cfg.ap.theme.dark': 'Oscuro',
    'cfg.ap.theme.light': 'Claro',
  },
  en: {
    // Login
    'login.tagline': 'Complete management system for your repair shop and technical services.',
    'login.stat.clientes': 'Clients',
    'login.stat.ventas': 'Sales',
    'login.stat.servicios': 'Services',
    'login.title': 'Sign In',
    'login.subtitle': 'Access the administration panel',
    'login.label.usuario': 'Username',
    'login.label.contrasena': 'Password',
    'login.btn': 'Enter system',
    // Sidebar
    'nav.section.principal': 'Main',
    'nav.section.gestion': 'Management',
    'nav.section.pos': 'Cash Register',
    'nav.section.org': 'Organization',
    'nav.section.sistema': 'System',
    'nav.section.dev': 'Development',
    'nav.dashboard': 'Dashboard',
    'nav.servicios': 'Services',
    'nav.reportes': 'Reports',
    'nav.vender': 'Cash Register',
    'nav.productos': 'Products',
    'nav.clientes': 'Clients',
    'nav.listas': 'Price Lists',
    'nav.empresas': 'Companies',
    'nav.locales': 'Branches',
    'nav.usuarios': 'Users',
    'nav.configuracion': 'Settings',
    'nav.sandbox': 'Sandbox Mode',
    'nav.ayuda': 'Help',
    'nav.logout': 'Sign out',
    'sidebar.sub': 'Admin Panel',
    // Topbar
    'topbar.notif': 'No new notifications',
    'topbar.search': 'Global search coming soon',
    'topbar.profile.title': 'My profile',
    // Dashboard
    'dash.filter.label': 'Filter by:',
    'dash.filter.all.empresas': 'All companies',
    'dash.filter.all.locales': 'All branches',
    'dash.stat.total': 'Total services',
    'dash.stat.este.mes': 'This month',
    'dash.stat.ingresos': 'Total revenue',
    'dash.stat.acumulado': 'Accumulated',
    'dash.stat.proceso': 'In progress',
    'dash.stat.pendientes': 'Pending',
    'dash.stat.completados': 'Completed',
    'dash.stat.entregados': 'Delivered',
    'dash.widget.servicios.mes': 'Services per month',
    'dash.widget.estado': 'Service status',
    'dash.widget.recientes': 'Recent services',
    'dash.btn.ver.todos': 'View all',
    'dash.empty.servicios': 'No services registered',
    'dash.pos.title': 'Point of Sale',
    'dash.stat.ventas.hoy': 'Today\'s sales',
    'dash.stat.hoy': 'Today',
    'dash.stat.productos': 'Registered products',
    'dash.stat.inventario': 'Inventory',
    'dash.stat.creditos': 'Active credits',
    'dash.stat.ventas.mes': 'Monthly sales',
    'dash.widget.ventas.rec': 'Recent sales',
    'dash.btn.ver.todas': 'View all',
    'dash.empty.ventas': 'No sales registered',
    // Servicios page
    'srv.title': 'Services Module',
    'srv.subtitle': 'Manage all services and repairs in the shop',
    'srv.btn.nuevo': 'New service',
    'srv.search.placeholder': 'Search by name, model, folio, issue...',
    'srv.filter.all.empresas': 'All companies',
    'srv.filter.all.locales': 'All branches',
    'srv.filter.all.estados': 'All statuses',
    'srv.filter.all.garantia': 'All warranties',
    'srv.th.folio': 'Folio',
    'srv.th.cliente': 'Client / Device',
    'srv.th.modelo': 'Model',
    'srv.th.falla': 'Issue',
    'srv.th.estado': 'Status',
    'srv.th.garantia': 'Warranty',
    'srv.th.f.entrada': 'Entry Date',
    'srv.th.total': 'Total',
    'srv.th.anticipo': 'Advance',
    'srv.th.f.salida': 'Exit Date',
    'srv.th.empresa': 'Company',
    'srv.th.acciones': 'Actions',
    'srv.empty': 'No services. Click "+ New service" to begin',
    'srv.table.info': '0 records',
    // Reportes page
    'rep.title': 'Reports',
    'rep.subtitle': 'Financial and operational analysis',
    'rep.tab.ventas': 'Sales',
    'rep.tab.servicios': 'Services',
    'rep.tab.cortes': 'Cash Draws',
    'rep.tab.creditos': 'Credits',
    'rep.btn.export.csv': 'Export CSV',
    'rep.label.empresa': 'Company',
    'rep.label.desde': 'From',
    'rep.label.hasta': 'To',
    'rep.label.metodo': 'Payment method',
    'rep.label.buscar': 'Search folio / client',
    'rep.btn.buscar': 'Search',
    'rep.opt.todos': 'All',
    'rep.opt.efectivo': 'Cash',
    'rep.opt.tarjeta': 'Card',
    'rep.opt.transferencia': 'Transfer',
    'rep.opt.mixto': 'Mixed',
    'rep.opt.todas': 'All',
    'rep.rs.ventas': 'Sales found',
    'rep.rs.ingresos': 'Total revenue',
    'rep.rs.ticket': 'Average ticket',
    'rep.rs.productos': 'Products sold',
    'rep.detail.ventas': 'Sales detail',
    'rep.th.folio': 'Folio',
    'rep.th.fecha': 'Date',
    'rep.th.cliente': 'Client',
    'rep.th.cajero': 'Cashier',
    'rep.th.metodo': 'Method',
    'rep.th.desc': 'Disc.',
    'rep.th.total': 'Total',
    'rep.th.acciones': 'Actions',
    'rep.empty.ventas': 'Use the filters and press Search',
    'rep.btn.anterior': 'Previous',
    'rep.btn.siguiente': 'Next',
    'rep.srv.label.empresa': 'Company',
    'rep.srv.label.local': 'Branch',
    'rep.srv.label.inicio': 'Start date',
    'rep.srv.label.fin': 'End date',
    'rep.srv.label.estado': 'Status',
    'rep.srv.btn.generar': 'Generate report',
    'rep.srv.filter.label': 'Period filters',
    'rep.srv.rs.ingresos': 'Total revenue',
    'rep.srv.rs.costos': 'Parts cost',
    'rep.srv.rs.utilidad': 'Net profit',
    'rep.srv.rs.count': 'Services in period',
    'rep.srv.detail': 'Services detail',
    'rep.srv.th.folio': 'Folio',
    'rep.srv.th.cliente': 'Client',
    'rep.srv.th.equipo': 'Device / Model',
    'rep.srv.th.estado': 'Status',
    'rep.srv.th.entrada': 'Entry Date',
    'rep.srv.th.salida': 'Exit Date',
    'rep.srv.th.anticipo': 'Advance',
    'rep.srv.th.costo': 'Parts Cost',
    'rep.srv.th.total': 'Total',
    'rep.srv.th.utilidad': 'Profit',
    'rep.srv.empty': 'Generate a report to see data',
    'rep.cortes.filter': 'Filters',
    'rep.cortes.label.inicio': 'Start date',
    'rep.cortes.label.fin': 'End date',
    'rep.cortes.label.usuario': 'User',
    'rep.cortes.opt.todos': 'All users',
    'rep.cortes.btn': 'Generate',
    'rep.cortes.rs.total': 'Total draws',
    'rep.cortes.rs.ventas': 'Registered sales',
    'rep.cortes.rs.efectivo': 'Expected cash',
    'rep.cortes.rs.dif': 'Total difference',
    'rep.cortes.detail': 'Cash draws detail',
    'rep.cortes.th.usuario': 'User',
    'rep.cortes.th.fecha': 'Date',
    'rep.cortes.th.inicio': 'Start time',
    'rep.cortes.th.fin': 'End time',
    'rep.cortes.th.fondo': 'Opening cash',
    'rep.cortes.th.ventas': 'Sales',
    'rep.cortes.th.retiros': 'Withdrawals',
    'rep.cortes.th.esperado': 'Expected',
    'rep.cortes.th.real': 'Actual',
    'rep.cortes.th.dif': 'Difference',
    'rep.cortes.empty': 'Generate a report to see cash draws',
    'rep.creditos.btn.actualizar': 'Refresh',
    'rep.creditos.rs.pendientes': 'Pending credits',
    'rep.creditos.rs.monto': 'Total pending amount',
    'rep.creditos.rs.antiguo': 'Oldest',
    'rep.creditos.detail': 'Pending sales',
    'rep.creditos.search': 'Search folio or client...',
    'rep.creditos.th.folio': 'Folio',
    'rep.creditos.th.cliente': 'Client',
    'rep.creditos.th.fecha': 'Sale date',
    'rep.creditos.th.productos': 'Products',
    'rep.creditos.th.total': 'Total',
    'rep.creditos.th.acciones': 'Actions',
    'rep.creditos.empty': 'No pending credits',
    // Usuarios
    'usr.title': 'User Management',
    'usr.subtitle': 'Manage users and their access permissions',
    'usr.btn.nuevo': 'New user',
    'usr.filter.all.empresas': 'All companies',
    'usr.filter.all.locales': 'All branches',
    'usr.filter.all.tipos': 'All types',
    'usr.opt.admin': 'Administrator',
    'usr.opt.empleado': 'Employee',
    'usr.opt.root': 'Developer',
    'usr.tipo.root': 'Developer',
    'usr.tipo.admin': 'Administrator',
    'usr.tipo.empleado': 'Employee',
    'usr.sin.local': '— No branch',
    'usr.empty.data': 'No users registered',
    'usr.filter.buscar.ph': 'Search by name or email...',
    'usr.th.nombre': 'Name',
    'usr.th.tipo': 'Type',
    'usr.th.empresa': 'Company',
    'usr.th.local': 'Branch',
    'usr.th.estado': 'Status',
    'usr.th.fecha': 'Created',
    'usr.th.acciones': 'Actions',
    'usr.empty': 'Loading users...',
    // Empresas
    'emp.title': 'Company Management',
    'emp.subtitle': 'Manage companies registered in the system',
    'emp.btn.nuevo': 'New company',
    'emp.th.nombre': 'Name',
    'emp.th.iniciales': 'Initials',
    'emp.th.rfc': 'Tax ID',
    'emp.th.ciudad': 'City',
    'emp.th.encargado': 'Manager',
    'emp.th.locales': 'Branches',
    'emp.th.estatus': 'Status',
    'emp.th.acciones': 'Actions',
    'emp.empty': 'Loading companies...',
    // Locales
    'loc.title': 'Branch Management',
    'loc.subtitle': 'Manage operating branches and locations',
    'loc.btn.nuevo': 'New branch',
    'loc.filter.all.empresas': 'All companies',
    'loc.th.nombre': 'Name',
    'loc.th.empresa': 'Company',
    'loc.th.ciudad': 'City',
    'loc.th.telefono': 'Phone',
    'loc.th.gerente': 'Manager',
    'loc.th.usuarios': 'Users',
    'loc.th.estatus': 'Status',
    'loc.th.acciones': 'Actions',
    'loc.empty': 'Loading branches...',
    // Clientes
    'cli.title': 'Client Management',
    'cli.subtitle': 'Manage clients registered in the system',
    'cli.btn.nuevo': 'New client',
    'cli.search.placeholder': 'Search by name, phone, email...',
    'cli.filter.all.tipos': 'All types',
    'cli.opt.regular': 'Regular',
    'cli.opt.frecuente': 'Frequent',
    'cli.opt.mayorista': 'Wholesale',
    'cli.filter.all.empresas': 'All companies',
    'cli.th.nombre': 'Name',
    'cli.th.telefono': 'Phone',
    'cli.th.correo': 'Email',
    'cli.th.tipo': 'Type',
    'cli.th.listas': 'Price lists',
    'cli.th.empresa': 'Company / Branch',
    'cli.th.fecha': 'Registration date',
    'cli.th.acciones': 'Actions',
    'cli.empty': 'Loading clients...',
    // Productos
    'prod.title': 'Product Management',
    'prod.subtitle': 'Manage the sales product inventory',
    'prod.btn.nuevo': 'New product',
    'prod.search.placeholder': 'Search by code or name...',
    'prod.filter.all.empresas': 'All companies',
    'prod.filter.all.locales': 'All branches',
    'prod.th.codigo': 'Code',
    'prod.th.nombre': 'Name',
    'prod.th.compra': 'Purchase',
    'prod.th.venta': 'Sale',
    'prod.th.existencia': 'Stock',
    'prod.th.local': 'Branch',
    'prod.th.empresa': 'Company',
    'prod.th.qr': 'QR',
    'prod.th.acciones': 'Actions',
    'prod.empty': 'Loading products...',
    // Listas de Precios
    'lp.title': 'Price Lists',
    'lp.subtitle': 'Manage special price lists for different client types',
    'lp.btn.nueva': 'New list',
    'lp.search.placeholder': 'Search by name...',
    'lp.filter.all.empresas': 'All companies',
    'lp.th.nombre': 'Name',
    'lp.th.descripcion': 'Description',
    'lp.th.descuento': 'Discount %',
    'lp.th.nivel': 'Price level',
    'lp.th.clientes': 'Clients',
    'lp.th.empresa': 'Company',
    'lp.th.fecha': 'Created',
    'lp.th.acciones': 'Actions',
    'lp.empty': 'Loading price lists...',
    // POS
    'pos.scan.placeholder': 'Scan barcode or search product...',
    'pos.th.producto': 'Product',
    'pos.th.cantidad': 'Quantity',
    'pos.th.precio': 'Price',
    'pos.th.subtotal': 'Subtotal',
    'pos.empty.scan': 'Scan a product to begin',
    'pos.empty.scan.sub': 'Use the barcode reader or search manually',
    'pos.btn.limpiar': 'Clear',
    'pos.resumen': 'Sale Summary',
    'pos.label.cliente': 'Client (optional)',
    'pos.cliente.placeholder': 'Search client...',
    'pos.subtotal': 'Subtotal',
    'pos.descuento': 'Discount',
    'pos.total': 'TOTAL',
    'pos.label.metodo': 'Payment method',
    'pos.btn.dividir': 'Split payment',
    'pos.pay.efectivo': 'Cash',
    'pos.pay.tarjeta': 'Card',
    'pos.pay.transferencia': 'Transfer',
    'pos.pay.credito': 'Credit',
    'pos.label.pago.dividido': 'Split payment',
    'pos.btn.cancelar.split': 'Cancel',
    'pos.btn.agregar.pago': 'Add payment method',
    'pos.corte.desde': 'Since:',
    'pos.corte.efectivo': 'Cash:',
    'pos.corte.ventas': 'Sales:',
    'pos.corte.abierta': 'Register open',
    'pos.btn.cerrar.corte': 'Close Shift',
    // Sandbox
    'sbx.title': 'Sandbox Mode',
    'sbx.subtitle': 'Create test companies with sample data for testing. Data is completely independent.',
    'sbx.btn.crear': 'Create sandbox',
    // Profile
    'prof.title': 'My Profile',
    'prof.subtitle': 'Manage your personal information and account security',
    'prof.cuenta.activa': 'Active account',
    'prof.actividad': 'System activity',
    'prof.stat.servicios': 'Registered services',
    'prof.stat.ingresos': 'Total revenue',
    'prof.stat.entregados': 'Delivered',
    'prof.stat.proceso': 'In progress',
    'prof.datos.title': 'Personal data',
    'prof.datos.sub': 'Your profile information visible in the system',
    'prof.label.nombre': 'Full name',
    'prof.label.correo': 'Email address',
    'prof.label.telefono': 'Phone',
    'prof.label.local': 'Active branch / location',
    'prof.label.empresa': 'Company',
    'prof.btn.guardar': 'Save data',
    'prof.pass.title': 'Change password',
    'prof.pass.sub': 'Update your system access password',
    'prof.label.pass.actual': 'Current password',
    'prof.label.pass.nueva': 'New password',
    'prof.label.pass.confirm': 'Confirm new password',
    'prof.btn.limpiar': 'Clear',
    'prof.btn.actualizar': 'Update password',
    // Configuración
    'cfg.title': 'Settings',
    'cfg.subtitle': 'Customize logos, tickets, labels and audit for your company',
    'cfg.empresa.label': 'Company:',
    'cfg.general.title': 'General',
    'cfg.general.sub': 'Logo and cash register',
    'cfg.logo.mode.label': 'Logo mode',
    'cfg.logo.mode.empresa': 'Single logo per company',
    'cfg.logo.mode.local': 'Different logo per branch',
    'cfg.logo.mode.hint': 'If you choose "per branch", you can upload a different logo in the Branches section.',
    'cfg.logo.actual': 'Current company logo',
    'cfg.logo.btn': 'Change logo',
    'cfg.corte.title': 'Cash Register',
    'cfg.corte.auto': 'Automatic shift close',
    'cfg.corte.auto.sub': 'Automatically close the register at a defined time',
    'cfg.corte.hora.label': 'Close time',
    'cfg.tv.title': 'Sales Ticket (POS)',
    'cfg.tv.sub': 'Receipt printed when charging at point of sale',
    'cfg.tv.elementos': 'Visible elements',
    'cfg.tv.logo': 'Logo',
    'cfg.tv.empresa': 'Company data',
    'cfg.tv.folio': 'Sale folio',
    'cfg.tv.fecha': 'Date and time',
    'cfg.tv.cliente': 'Client name',
    'cfg.tv.items': 'Product detail',
    'cfg.tv.metodo': 'Payment method',
    'cfg.tv.pie': 'Ticket footer',
    'cfg.ts.title': 'Service Ticket',
    'cfg.ts.sub': 'Design and text for the repair ticket',
    'cfg.ts.titulo.label': 'Ticket title',
    'cfg.ts.elementos': 'Visible elements',
    'cfg.ts.logo': 'Logo',
    'cfg.ts.telefono': 'Phone',
    'cfg.ts.direccion': 'Address',
    'cfg.ts.firma.cli': 'Client signature',
    'cfg.ts.firma.tec': 'Technician signature',
    'cfg.ts.gracias': 'Thank you message',
    'cfg.ts.garantia': 'Warranty policy',
    'cfg.ts.revision': 'Technical review policy',
    'cfg.ts.extra': 'Additional text',
    'cfg.ts.extra.opt': '(optional)',
    'cfg.ts.preview': 'Preview',
    'cfg.plt.title': 'Ticket Templates',
    'cfg.plt.sub': 'Ticket variants with different settings',
    'cfg.plt.btn.nueva': 'New',
    'cfg.plt.empty': 'No additional templates.',
    'cfg.plt.th.nombre': 'Name',
    'cfg.plt.th.titulo': 'Title',
    'cfg.plt.th.creada': 'Created',
    'cfg.plt.th.acciones': 'Actions',
    'cfg.etq.title': 'Product Labels',
    'cfg.etq.sub': 'Design for label printers',
    'cfg.etq.elementos': 'Visible elements',
    'cfg.etq.nombre': 'Product name',
    'cfg.etq.codigo': 'Barcode',
    'cfg.etq.precio': 'Sale price',
    'cfg.etq.qr': 'QR code',
    'cfg.etq.dim': 'Dimensions (mm)',
    'cfg.etq.ancho': 'Width',
    'cfg.etq.alto': 'Height',
    'cfg.aud.title': 'Audit',
    'cfg.aud.sub': 'User action log',
    'cfg.aud.buscar': 'Search',
    'cfg.aud.buscar.ph': 'User, description...',
    'cfg.aud.modulo': 'Module',
    'cfg.aud.accion.label': 'Action',
    'cfg.aud.desde': 'From',
    'cfg.aud.hasta': 'To',
    'cfg.aud.th.fecha': 'Date',
    'cfg.aud.th.usuario': 'User',
    'cfg.aud.th.accion': 'Action',
    'cfg.aud.th.modulo': 'Module',
    'cfg.aud.th.desc': 'Description',
    'cfg.aud.th.ip': 'IP',
    'cfg.aud.empty': 'Open this section to load records.',
    'cfg.btn.guardar': 'Save settings',
    // Common buttons / labels
    'btn.cancelar': 'Cancel',
    'btn.guardar': 'Save',
    'btn.eliminar': 'Delete',
    'btn.editar': 'Edit',
    'btn.nuevo': 'New',
    'btn.nueva': 'New',
    'btn.cerrar': 'Close',
    'btn.imprimir': 'Print',
    'btn.aceptar': 'Accept',
    'btn.siguiente': 'Next',
    'btn.anterior': 'Previous',
    // Modals
    'modal.confirm.title': 'Delete record?',
    'modal.confirm.body': 'This action cannot be undone. The service will be permanently deleted.',
    'modal.confirm.si': 'Yes, delete',
    'modal.venta.success.title': 'Sale registered!',
    'modal.venta.success.sub': 'The sale has been saved correctly.',
    'modal.venta.folio': 'Folio',
    'modal.venta.total': 'Total',
    'modal.venta.metodo': 'Method',
    'modal.venta.btn.imprimir': 'Print',
    'modal.credito.title': 'Finalize Credit',
    'modal.credito.cliente': 'Client',
    'modal.credito.fecha': 'Sale date',
    'modal.credito.total': 'Amount to collect',
    'modal.credito.productos': 'Products',
    'modal.credito.label': 'How did the client pay?',
    'modal.credito.mantener': 'Keep as credit',
    'modal.credito.btn': 'Finalize and collect',
    'modal.apertura.title': 'Open Register',
    'modal.apertura.sub': 'Enter the initial cash in the register',
    'modal.apertura.hint': 'To start sales you need to open the register. Enter the cash to start the day. If no initial fund, leave at $0.00.',
    'modal.apertura.label': 'Opening fund (cash in register)',
    'modal.apertura.btn': 'Open Register',
    'modal.cierre.title': 'Cash Draw',
    'modal.cierre.resumen': 'Day summary',
    'modal.cierre.efectivo': 'Cash',
    'modal.cierre.fondo': 'Opening fund',
    'modal.cierre.ventas.ef': 'Cash sales',
    'modal.cierre.esperado': 'Total expected in register',
    'modal.cierre.otros': 'Other Payment Methods',
    'modal.cierre.tarjeta': 'Card',
    'modal.cierre.transfer': 'Transfer',
    'modal.cierre.credito': 'Credit',
    'modal.cierre.gran.total': 'Total overall sales',
    'modal.cierre.contado.hint': 'Optional: count physical cash to detect differences.',
    'modal.cierre.contado.label': 'Counted cash (optional)',
    'modal.cierre.contado.ph': 'Leave empty to skip',
    'modal.cierre.dif': 'Difference',
    'modal.cierre.btn': 'Close Shift',
    // Service modal
    'svc.modal.nuevo': 'New Service',
    'svc.modal.sub': 'Complete the service fields',
    'svc.foto.label': 'Photo / Device Image',
    'svc.foto.click': 'Click to upload an image',
    'svc.foto.sub': 'JPG, PNG, WEBP — max 5MB',
    'svc.sec.cliente': 'Client Data',
    'svc.label.nombre': 'Client name *',
    'svc.label.telefono': 'Phone',
    'svc.label.correo': 'Email',
    'svc.label.direccion': 'Address',
    'svc.sec.equipo': 'Device Data',
    'svc.label.modelo': 'Device model *',
    'svc.label.serie': 'Serial number',
    'svc.label.falla': 'Reported issue *',
    'svc.label.estado': 'Service status',
    'svc.label.descripcion': 'Service description',
    'svc.label.observaciones': 'Observations',
    'svc.label.local': 'Branch / Location',
    'svc.sec.garantia': 'Warranty',
    'svc.garantia.sin': 'No warranty',
    'svc.sec.fechas': 'Dates and Costs',
    'svc.label.f.entrada': 'Entry date',
    'svc.label.f.salida': 'Exit date',
    'svc.label.anticipo': 'Advance / Partial payment ($)',
    'svc.label.costo.ref': 'Parts cost ($)',
    'svc.label.costo.total': 'Total service cost ($)',
    'svc.btn.guardar': 'Save service',
    // Service detail modal
    'sd.title': 'Service Detail',
    'sd.sub': 'Complete service information',
    'sd.sec.cliente': 'Client Data',
    'sd.label.nombre': 'Name',
    'sd.label.telefono': 'Phone',
    'sd.label.correo': 'Email',
    'sd.label.direccion': 'Address',
    'sd.sec.equipo': 'Device Data',
    'sd.label.modelo': 'Model',
    'sd.label.serie': 'Serial No.',
    'sd.label.falla': 'Reported issue',
    'sd.label.descripcion': 'Service description',
    'sd.label.obs': 'Observations',
    'sd.sec.estado': 'Status and Dates',
    'sd.label.estado': 'Status',
    'sd.label.garantia': 'Warranty',
    'sd.label.entrada': 'Entry date',
    'sd.label.salida': 'Exit date',
    'sd.sec.costos': 'Costs',
    'sd.label.anticipo': 'Advance',
    'sd.label.refaccion': 'Parts cost',
    'sd.label.total': 'Service total',
    'sd.label.restante': 'Remaining to collect',
    'sd.sec.imagen': 'Attached image',
    'sd.btn.ticket': 'Print ticket',
    'sd.btn.finalizar': 'Finalize',
    // Ticket modal
    'tkt.title': 'Service Ticket',
    'tkt.sub': 'Print preview',
    'tkt.btn.cerrar': 'Close',
    'tkt.btn.imprimir': 'Print ticket',
    // Plantilla modal
    'plt.modal.nuevo': 'New ticket template',
    'plt.modal.sub': 'Configure a ticket variant',
    'plt.label.nombre': 'Template name *',
    'plt.label.titulo': 'Ticket title',
    'plt.elementos': 'Visible elements',
    'plt.logo': 'Company logo',
    'plt.telefono': 'Contact phone',
    'plt.direccion': 'Address',
    'plt.firma.cli': 'Client signature',
    'plt.firma.tec': 'Technician signature',
    'plt.gracias': 'Thank you message',
    'plt.garantia': 'Warranty policy',
    'plt.revision': 'Technical review policy',
    'plt.extra': 'Additional text',
    'plt.extra.opt': '(optional)',
    'plt.btn.guardar': 'Save template',
    // User modal
    'usr.modal.nuevo': 'New User',
    'usr.modal.sub': 'System access data',
    'usr.label.nombre': 'Full name *',
    'usr.label.correo': 'Email / username *',
    'usr.label.pass': 'Password *',
    'usr.pass.hint': 'Click "Auto" to assign the default password (12345678)',
    'usr.label.tipo': 'User type',
    'usr.label.telefono': 'Phone',
    'usr.label.empresa': 'Company *',
    'usr.label.local': 'Branch / Location *',
    'usr.btn.guardar': 'Save user',
    // Permisos modal
    'prm.title': 'User Permissions',
    'prm.th.modulo': 'Module',
    'prm.th.ver': 'View',
    'prm.th.crear': 'Create',
    'prm.th.editar': 'Edit',
    'prm.th.borrar': 'Delete',
    'prm.btn.desmarcar': 'Uncheck all',
    'prm.btn.guardar': 'Save permissions',
    // Empresa modal
    'emp.modal.nuevo': 'New Company',
    'emp.modal.sub': 'Company data',
    'emp.label.nombre': 'Name *',
    'emp.label.iniciales': 'Initials *',
    'emp.label.rfc': 'Tax ID',
    'emp.label.telefono': 'Phone',
    'emp.label.correo': 'Email',
    'emp.label.encargado': 'Manager',
    'emp.label.calle': 'Street / Address',
    'emp.label.cp': 'Postal Code',
    'emp.label.ciudad': 'City',
    'emp.label.estado': 'State',
    'emp.label.tipo': 'Company type',
    'emp.opt.servicio': 'Service',
    'emp.opt.comercio': 'Commerce',
    'emp.opt.mixto': 'Mixed',
    'emp.label.cobro': 'Service charge',
    'emp.label.logo': 'Company logo',
    'emp.btn.logo': 'Upload logo',
    'emp.btn.guardar': 'Save company',
    // Local modal
    'loc.modal.nuevo': 'New Branch',
    'loc.modal.sub': 'Branch data',
    'loc.label.empresa': 'Company *',
    'loc.label.nombre': 'Branch name *',
    'loc.label.ubicacion': 'Internal location',
    'loc.label.ciudad': 'City',
    'loc.label.estado': 'State',
    'loc.label.telefono': 'Phone',
    'loc.label.correo': 'Contact email',
    'loc.label.gerente': 'Branch manager',
    'loc.label.apertura': 'Opening date',
    'loc.label.logo': 'Branch logo',
    'loc.btn.logo': 'Upload logo',
    'loc.btn.guardar': 'Save branch',
    // Cliente modal
    'cli.modal.nuevo': 'New Client',
    'cli.modal.sub': 'Client data',
    'cli.label.nombre': 'Full name *',
    'cli.label.telefono': 'Phone',
    'cli.label.correo': 'Email',
    'cli.label.tipo': 'Client type',
    'cli.label.direccion': 'Address',
    'cli.label.notas': 'Notes',
    'cli.label.listas': 'Price lists',
    'cli.btn.guardar': 'Save client',
    // Cliente detail modal
    'cd.title': 'Client Detail',
    'cd.stat.servicios': 'Services',
    'cd.stat.ventas': 'Sales',
    'cd.stat.creditos': 'Pending credits',
    'cd.label.telefono': 'Phone',
    'cd.label.correo': 'Email',
    'cd.label.direccion': 'Address',
    'cd.listas.title': 'Assigned price lists',
    'cd.listas.sin': 'No lists assigned',
    'cd.servicios.title': 'Latest services',
    'cd.servicios.sin': 'No services',
    'cd.btn.agregar': 'Add client',
    'cd.btn.editar': 'Edit client',
    // Producto modal
    'prod.modal.nuevo': 'New Product',
    'prod.modal.sub': 'Product data',
    'prod.label.codigo': 'Barcode',
    'prod.label.nombre': 'Product name *',
    'prod.label.compra': 'Purchase price ($)',
    'prod.label.venta': 'Sale price ($) *',
    'prod.label.precio2': 'Price 2 ($)',
    'prod.label.precio3': 'Price 3 ($)',
    'prod.label.existencia': 'Stock',
    'prod.label.local': 'Branch / Location',
    'prod.btn.guardar': 'Save product',
    // Lista precios modal
    'lp.modal.nuevo': 'New Price List',
    'lp.modal.sub': 'List configuration',
    'lp.label.nombre': 'List name *',
    'lp.label.descripcion': 'Description',
    'lp.label.descuento': 'Additional discount (%)',
    'lp.label.nivel': 'Base price level',
    'lp.btn.guardar': 'Save list',
    // Lista detalle modal
    'ld.title': 'Price List',
    'ld.label.descuento': 'Discount',
    'ld.label.nivel': 'Price level',
    'ld.label.clientes': 'Assigned clients',
    'ld.label.desc': 'Description',
    'ld.clientes.title': 'Clients with this list',
    'ld.btn.editar': 'Edit list',
    // QR/Label modals
    'lbl.title': 'Product Label',
    'lbl.sub': 'Print preview',
    'lbl.btn.imprimir': 'Print label',
    'qr.title': 'Service QR',
    'qr.sub': 'Folio for identification',
    'qr.btn.imprimir': 'Print',
    'scan.title': 'Scan Code',
    'scan.sub': 'Point the camera at the QR or barcode',
    // Abono modal
    'abono.title': 'Register Payment',
    'abono.label.pendiente': 'Pending balance',
    'abono.label.total': 'Total amount',
    'abono.label.monto': 'Payment amount *',
    'abono.label.nota': 'Note (optional)',
    'abono.btn': 'Register payment',
    // RV Detalle modal
    'rvd.title': 'Sale Detail',
    'rvd.btn.reimprimir': 'Reprint Ticket',
    // Common status
    'status.activo': 'Active',
    'status.inactivo': 'Inactive',
    // Lang toggle
    'lang.toggle': 'ES',
    // Table counts / empty
    'table.registro': 'record',
    'table.registros': 'records',
    'table.empty': 'No records found',
    // Payment methods
    'metodo.efectivo': 'Cash',
    'metodo.tarjeta': 'Card',
    'metodo.transferencia': 'Transfer',
    'metodo.credito': 'Credit',
    'metodo.mixto': 'Mixed',
    'metodo.split': 'Split payment',
    // POS counts
    'pos.item': 'item',
    'pos.items': 'items',
    'pos.unit': 'unit',
    'pos.units': 'units',
    'pos.empty.sub': 'Use the barcode reader or search manually',
    // Configuración — Apariencia
    'cfg.ap.title': 'Appearance',
    'cfg.ap.sub': 'Interface language and appearance',
    'cfg.ap.lang.label': 'Idioma / Language',
    'cfg.ap.lang.sub': 'Change the system interface language',
    'cfg.ap.lang.es': 'Español',
    'cfg.ap.lang.en': 'English',
    'cfg.ap.theme.label': 'Tema / Theme',
    'cfg.ap.theme.sub': 'Choose the visual appearance of the system',
    'cfg.ap.theme.dark': 'Dark',
    'cfg.ap.theme.light': 'Light',
  }
};

function t(key) {
  const lang = TRANSLATIONS[currentLang] || TRANSLATIONS['es'];
  return lang[key] !== undefined ? lang[key] : (TRANSLATIONS['es'][key] || key);
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      // handled by data-i18n-placeholder
    } else if (el.tagName === 'OPTION') {
      el.textContent = val;  // innerHTML ignored by browsers for option text
    } else {
      el.innerHTML = val;
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  // Highlight active language button in Apariencia section
  ['es','en'].forEach(l => {
    const b = document.getElementById('lang-btn-' + l);
    if (b) {
      b.style.borderColor = l === currentLang ? 'var(--accent)' : 'var(--border)';
      b.style.background  = l === currentLang ? 'rgba(201,112,0,0.08)' : 'var(--bg2)';
      b.style.color       = l === currentLang ? 'var(--accent)' : 'var(--text)';
    }
  });
  // Highlight active theme button
  ['dark','light'].forEach(th => {
    const b = document.getElementById('theme-btn-' + th);
    if (b) {
      b.style.borderColor = th === currentTheme ? 'var(--accent)' : 'var(--border)';
      b.style.background  = th === currentTheme ? 'rgba(201,112,0,0.08)' : 'var(--bg2)';
      b.style.color       = th === currentTheme ? 'var(--accent)' : 'var(--text)';
    }
  });
}

currentTheme = localStorage.getItem('ts_theme') || 'dark';

function setTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('ts_theme', theme);
  // Suppress all transitions during theme switch to prevent GPU overload
  document.body.classList.add('notransition');
  document.body.classList.toggle('light', theme === 'light');
  ['dark','light'].forEach(t => {
    const b = document.getElementById('theme-btn-' + t);
    if (b) {
      b.style.borderColor = t === theme ? 'var(--accent)' : 'var(--border)';
      b.style.background  = t === theme ? 'rgba(201,112,0,0.08)' : 'var(--bg2)';
      b.style.color       = t === theme ? 'var(--accent)' : 'var(--text)';
    }
  });
  void document.body.offsetHeight;
  requestAnimationFrame(() => { requestAnimationFrame(() => { document.body.classList.remove('notransition'); }); });
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('ts_lang', lang);
  applyTranslations();
  // Also update the topbar titles that are set dynamically
  const titleMap = {
    dashboard: t('nav.dashboard'),
    services: t('srv.title').split(' ').slice(0,2).join(' '),
    reportes: t('rep.title'),
    profile: t('prof.title'),
    usuarios: t('usr.title'),
    empresas: t('emp.title'),
    locales: t('loc.title'),
    configuracion: t('cfg.title'),
    sandbox: t('sbx.title'),
    pos: t('nav.section.pos'),
    productos: t('prod.title'),
    clientes: t('cli.title'),
    'listas-precios': t('lp.title'),
  };
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) {
    const currentPage = Object.keys(titleMap).find(p =>
      document.getElementById('page-' + p)?.classList.contains('active')
    );
    if (currentPage && titleMap[currentPage]) topbarTitle.textContent = titleMap[currentPage];
  }
  // Re-render POS cart if visible (updates empty state text and item counts)
  if (typeof renderPOSCart === 'function' && typeof posCart !== 'undefined') renderPOSCart();
}

// ===== API HELPER =====
const API = '/api';
token = localStorage.getItem('ts_token') || '';
currentUserData = JSON.parse(localStorage.getItem('ts_user') || 'null');
userPermisos = JSON.parse(localStorage.getItem('ts_permisos') || '{}');
waConfig = null;
allEstados = [];    // cache of estados de servicio (configurable)
allRoles = [];      // cache of all roles (sistema + custom)
allTiposProducto = [];
allNivelesPrecios = [];

const WA_ESTADOS = () => allEstados.map(e => e.nombre);
const WA_DEFAULT_MSGS = {
  'Recibido':            'Hola {nombre}, hemos recibido tu {equipo} con el folio #{folio}. En breve te daremos seguimiento. 🔧',
  'Diagnóstico':         'Hola {nombre}, tu {equipo} (folio #{folio}) está siendo diagnosticado. Pronto te informaremos.',
  'En proceso':          'Hola {nombre}, tu {equipo} (folio #{folio}) ya está en proceso de reparación. ⚙️',
  'Esperando refacción': 'Hola {nombre}, estamos esperando las refacciones necesarias para tu {equipo} (folio #{folio}). Te avisamos en cuanto lleguen.',
  'Listo':               'Hola {nombre}, ¡tu {equipo} (folio #{folio}) está listo para recoger! ✅',
  'Entregado':           'Hola {nombre}, tu {equipo} (folio #{folio}) está listo y fue entregado. ¡Que lo disfrutes! Si tienes alguna duda, con gusto te atendemos.',
  'Cancelado':           'Hola {nombre}, lamentablemente el servicio para tu {equipo} (folio #{folio}) fue cancelado. Contáctanos para más información.',
};


async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (res.status === 401) { doLogout(); throw new Error('Sesión expirada'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

function $id(id) { return document.getElementById(id); }
function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Wrap each page's content (after .page-header) in a .page-content div.
// Scroll pages: page-content scrolls vertically (forms, dashboards, etc.)
// Table pages: page-content is overflow:hidden; the .table-card fills flex:1 and scrolls internally.
(function initPageLayout() {
  const scrollPages = new Set([
    'page-dashboard','page-reportes','page-profile',
    'page-configuracion','page-importar-productos','page-sandbox'
  ]);

  document.querySelectorAll('.page').forEach(page => {
    const header = page.querySelector(':scope > .page-header');
    const wrapper = document.createElement('div');
    wrapper.className = 'page-content';

    if (scrollPages.has(page.id)) {
      wrapper.style.display = 'block';
      wrapper.style.overflowY = 'auto';
      wrapper.style.paddingBottom = '24px';
    } else {
      // Table pages: fixed container, internal table scroll
      wrapper.style.overflow = 'hidden';
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
    }

    if (header) {
      let el = header.nextElementSibling;
      while (el) { const next = el.nextElementSibling; wrapper.appendChild(el); el = next; }
    } else {
      while (page.firstChild) wrapper.appendChild(page.firstChild);
    }

    if (wrapper.childElementCount > 0) page.appendChild(wrapper);

    // For table pages: find the table-card (may not be a direct child) and make it grow
    if (!scrollPages.has(page.id)) {
      const tableCard = wrapper.querySelector('.table-card');
      if (tableCard) {
        tableCard.style.flex = '1';
        tableCard.style.minHeight = '0';
        tableCard.style.display = 'flex';
        tableCard.style.flexDirection = 'column';
        tableCard.style.overflow = 'hidden';
        // Make the element before table-card (tabs, etc.) not shrink
        let prev = tableCard.previousElementSibling;
        while (prev) { prev.style.flexShrink = '0'; prev = prev.previousElementSibling; }
        // Ensure table-wrap inside scrolls
        const tw = tableCard.querySelector('.table-wrap');
        if (tw) { tw.style.flex = '1'; tw.style.minHeight = '0'; tw.style.overflowY = 'auto'; }
      }
    }
  });
}());
function money(n) { return '$' + Number(n||0).toLocaleString('es-MX', {minimumFractionDigits:2}); }
function fmtDatetime(d) { if (!d) return '—'; return new Date(String(d).replace(' ', 'T')).toLocaleString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }

// Helper: devuelve una versión debounced de fn (espera ms desde el último call).
// Útil para inputs de búsqueda que pegan al backend — antes pegaban en cada tecla.
function _debounce(fn, ms) {
  let t = null;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

// Helper inline para usar directo en oninput="...":
//   oninput="_d('srv', 350, () => { filterTable(); })"
// Reemplaza la llamada inmediata por una espera de N ms desde la última tecla.
const _searchTimers = {};
function _d(key, ms, fn) {
  clearTimeout(_searchTimers[key]);
  _searchTimers[key] = setTimeout(fn, ms || 350);
}
// Convierte fecha de BD ('2026-04-30 14:30:00' o ISO) a valor de input datetime-local
function toDatetimeLocal(s) {
  if (!s) return '';
  // Formato esperado por <input type="datetime-local">: 'YYYY-MM-DDTHH:mm'
  return String(s).replace(' ', 'T').substring(0, 16);
}
// Convierte el valor de input datetime-local a formato compatible con la BD
// ('YYYY-MM-DD HH:mm:00'). Si llega vacío devuelve null.
function fromDatetimeLocal(v) {
  if (!v) return null;
  let s = String(v).replace('T', ' ').trim();
  if (s.length === 16) s += ':00';  // sin segundos → agregar
  return s;
}
// Devuelve datetime-local con la hora local actual ('YYYY-MM-DDTHH:mm').
function nowDatetimeLocal() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().substring(0, 16);
}
function phoneToWA(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return 'https://wa.me/' + (digits.startsWith('52') ? digits : '52' + digits);
}
function hasPermiso(mod, accion) {
  if (!currentUserData) return false;
  if (currentUserData.tipo === 'root' || currentUserData.tipo === 'admin') return true;
  return userPermisos[mod] && userPermisos[mod][accion];
}
function hasAnyPermiso(mod) {
  if (!currentUserData) return false;
  if (currentUserData.tipo === 'root' || currentUserData.tipo === 'admin') return true;
  const p = userPermisos[mod];
  return !!(p && (p.ver || p.crear || p.editar || p.borrar));
}

// ===== STATE =====
editingId = null;
deleteId = null;
currentPage = 1;
PER_PAGE = 10;
editingUserId = null;
permisosUserId = null;
acSearchTimer = null;
editingEmpresaId = null;
editingLocalId = null;
editingProductoId = null;
productosPage = 1;
PROD_LIMIT = 20;
allEmpresas = [];
editingClienteId = null;
clientesPage = 1;
CLIENTES_PER_PAGE = 20;
editingListaId = null;
listasPage = 1;
LISTAS_PER_PAGE = 20;
usuariosPage = 1;
USUARIOS_PER_PAGE = 20;
empresasPage = 1;
EMPRESAS_PER_PAGE = 20;
localesPage = 1;
LOCALES_PER_PAGE = 20;
// sort state per table
const srvSort  = { f: 'fecha_entrada', d: 'desc' };
const empSort  = { f: 'nombre',        d: 'asc'  };
const locSort  = { f: 'nombre',        d: 'asc'  };
const perSort  = { f: 'nombre',        d: 'asc'  };
const listSort = { f: 'nombre',        d: 'asc'  };
const usrSort  = { f: 'fecha',         d: 'desc' };
const rvSort   = { f: 'fecha',         d: 'desc' };

window.activeNotifFilter = null;
window.activeNotifParam = null;

// Texto contextual mostrado en el banner según el tipo de alerta
const NOTIF_BANNER_LABELS = {
  servicio_estado:        { label: 'Servicios en estado',   detail: p => p ? `"${p}" con tiempo excedido` : 'con tiempo excedido' },
  stock_bajo:             { label: 'Productos con stock bajo', detail: () => 'Existencia igual o menor al umbral configurado' },
  credito_vencido:        { label: 'Créditos vencidos',     detail: () => 'Ventas a crédito sin cobrar más allá del plazo' },
  pago_pendiente:         { label: 'Cobros pendientes',     detail: () => 'Ventas en estado credito_pendiente' },
  empleados_sin_actividad:{ label: 'Empleados sin actividad', detail: () => 'Sin registrar servicios en los últimos días' },
};

window.clearNotifFilter = function() {
  const b = $id('notif-active-banner');
  if (b) b.hidden = true;
  const tipo = window.activeNotifFilter;
  window.activeNotifFilter = null;
  window.activeNotifParam = null;

  if (tipo === 'servicio_estado') {
    const sel = $id('filter-estado');
    if (sel) sel.value = '';
    filterTable();
  } else if (tipo === 'stock_bajo') {
    const s = $id('filter-productos-stock');
    if (s) s.value = '';
    filterProductos();
  } else if (tipo === 'credito_vencido' || tipo === 'pago_pendiente') {
    loadReporteCreditos();
  } else if (tipo === 'empleados_sin_actividad') {
    loadPersonas();
  }
};

// Devuelve la clase CSS para resaltar una fila si el filtro activo de notificación
// corresponde al tipo esperado de esa tabla (services, productos, etc.).
function rowAlertClass(tipoEsperado) {
  return window.activeNotifFilter === tipoEsperado ? 'row-alerted' : '';
}

function showNotifBanner() {
  const b = $id('notif-active-banner');
  if (!b) return;
  const tipo  = window.activeNotifFilter;
  const param = window.activeNotifParam;
  const cfg   = NOTIF_BANNER_LABELS[tipo];
  const labelEl  = $id('notif-banner-label');
  const detailEl = $id('notif-banner-detail');
  if (cfg) {
    if (labelEl)  labelEl.textContent  = cfg.label + (param && tipo === 'servicio_estado' ? ` "${param}"` : '');
    if (detailEl) detailEl.textContent = cfg.detail(param);
  } else {
    if (labelEl)  labelEl.textContent  = 'Filtro de notificación activo';
    if (detailEl) detailEl.textContent = 'Mostrando solo los registros que dispararon la alerta';
  }
  b.hidden = false;
}
// report panel — client-side sort + pagination

dashMode = 'general'; // 'general' | 'local' | 'empleado'

// POS state
posConceptosCobro = []; // loaded from /configuracion/conceptos-cobro
posCart = [];          // { rowId, productoId, codigo, nombre, precioOriginal, precioUnitario, cantidad, subtotal }
posNextRowId = 1;
posClienteId = null;
posClienteNombre = '';
posListaInfo = null; // { nombre, descuento_porcentaje } — active price list for selected client
posSelectedMethod = 'efectivo';
posSplitMode = false;
posPagos = [{ metodo: 'efectivo', monto: '' }];
posCreditoFecha = '';
corteActivo = null;

// ===== LOGIN =====
function togglePass() {
  const inp = $id('inp-pass');
  const icon = $id('eye-icon');
  if (inp.type === 'password') { inp.type = 'text'; icon.className = 'fa-solid fa-eye-slash'; }
  else { inp.type = 'password'; icon.className = 'fa-solid fa-eye'; }
}

async function doLogin() {
  const correo = $id('inp-user').value.trim();
  const contrasena = $id('inp-pass').value;
  if (!correo || !contrasena) { showToast('Ingresa usuario y contraseña', 'error'); return; }
  // Only the API call uses a user-facing catch (wrong credentials, network error)
  let data;
  try {
    data = await api('POST', '/auth/login', { correo, contrasena });
  } catch (e) {
    showToast(e.message || 'Credenciales incorrectas', 'error');
    return;
  }
  // Post-login initialization — errors here are non-fatal and must not show as toasts
  token = data.token;
  currentUserData = data.usuario;
  userPermisos = data.permisos || {};
  localStorage.setItem('ts_token', token);
  localStorage.setItem('ts_user', JSON.stringify(currentUserData));
  localStorage.setItem('ts_permisos', JSON.stringify(userPermisos));
  $id('login-screen').style.display = 'none';
  $id('app').style.display = 'flex';
  const _loginTipo = currentUserData.tipo;
  $id('dash-greeting').style.display    = _loginTipo === 'empleado' ? '' : 'none';
  $id('dash-admin-header').style.display = _loginTipo === 'empleado' ? 'none' : 'flex';
  // Activate dashboard immediately so skeletons are visible before async config loads
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $id('page-dashboard').classList.add('active');
  dashShowSkeletons();
  await Promise.all([
    loadEstadosConfig(), loadRolesConfig(), loadTiposProductos(), loadNivelesPrecios(),
    // Pre-cargar empresas si es root — evita esperas al abrir secciones que las usan
    (currentUserData?.tipo === 'root' && allEmpresas.length === 0)
      ? api('GET', '/empresas?limit=1000').then(r => { allEmpresas = r.data || []; }).catch(() => {})
      : Promise.resolve(),
  ]).catch(() => {});
  try { applyPermisos(); } catch(e) { console.warn('[doLogin] init error:', e); try { goTo('dashboard'); } catch(e2) {} }
  updateProfileUI();
  startAutoCorteWatcher();
  startNotifWatcher();
  showToast('Bienvenido, ' + currentUserData.nombre, 'success');
}

$id('inp-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
$id('inp-user').addEventListener('keydown', e => { if (e.key === 'Enter') $id('inp-pass').focus(); });

function doLogout() {
  token = '';
  currentUserData = null;
  userPermisos = {};
  waConfig = null;
  stopAutoCorteWatcher();
  stopNotifWatcher();
  updateNotifBadge(0);
  localStorage.removeItem('ts_token');
  localStorage.removeItem('ts_user');
  localStorage.removeItem('ts_permisos');
  $id('login-screen').style.display = 'flex';
  $id('app').style.display = 'none';
  $id('inp-user').value = '';
  $id('inp-pass').value = '';
  showToast('Sesión cerrada', 'info');
}

// Apply theme and translations first so page is fully styled before navigation
setTheme(currentTheme);
applyTranslations();

// ===== PERMISOS UI =====
function applyPermisos() {
  if (!currentUserData) return;
  const tipo = currentUserData.tipo;
  const isRoot = tipo === 'root';
  const isAdmin = tipo === 'root' || tipo === 'admin';

  // Wrap UI setup in try/catch so any missing element never blocks navigation
  try {
    // Show/hide nav items based on permisos
    $id('nav-servicios').style.display = (isAdmin || hasAnyPermiso('servicios')) ? '' : 'none';
    $id('nav-reportes').style.display = (isAdmin || hasAnyPermiso('reportes') || hasAnyPermiso('auditoria')) ? '' : 'none';
    $id('nav-empresas').style.display = isRoot ? '' : 'none';
    $id('nav-locales').style.display = (isAdmin || hasAnyPermiso('locales')) ? '' : 'none';
    $id('nav-configuracion').style.display = isAdmin ? '' : 'none';

    // POS nav items
    const hasPOS = isAdmin || hasPermiso('ventas', 'crear') || hasAnyPermiso('productos') || hasAnyPermiso('cortes');
    $id('nav-pos-label').style.display = hasPOS ? '' : 'none';
    $id('nav-pos').style.display = (isAdmin || hasPermiso('ventas', 'crear') || hasAnyPermiso('cortes')) ? '' : 'none';
    $id('nav-productos').style.display = (isAdmin || hasAnyPermiso('productos')) ? '' : 'none';
    const canImport = isAdmin || hasPermiso('importar_productos', 'crear');
    $id('nav-importar-productos').style.display = canImport ? '' : 'none';
    const btnImp = $id('btn-importar-productos');
    if (btnImp) btnImp.style.display = canImport ? '' : 'none';
    $id('nav-personas').style.display = (isAdmin || hasAnyPermiso('personas') || hasAnyPermiso('clientes')) ? '' : 'none';
    $id('nav-listas-precios').style.display = isAdmin ? '' : 'none';

    // Dashboard POS widgets
    const dashPosStats = $id('dashboard-pos-stats');
    const dashVentasRec = $id('dashboard-ventas-recientes');
    if (dashPosStats) dashPosStats.style.display = hasPOS ? '' : 'none';
    if (dashVentasRec) dashVentasRec.style.display = hasPOS ? '' : 'none';

    // Show sandbox nav for root only
    $id('nav-dev-label').style.display = isRoot ? '' : 'none';
    $id('nav-sandbox').style.display = isRoot ? '' : 'none';

    // Hide section labels when all their items are hidden
    const vis = id => $id(id)?.style.display !== 'none';
    $id('nav-gestion-label').style.display = (vis('nav-servicios') || vis('nav-reportes')) ? '' : 'none';
    $id('nav-org-label').style.display = (vis('nav-empresas') || vis('nav-locales')) ? '' : 'none';
    $id('nav-sistema-label').style.display = vis('nav-configuracion') ? '' : 'none';

    // Show/hide create service button
    const canCreate = hasPermiso('servicios', 'crear');
    document.querySelectorAll('[onclick="openModal()"]').forEach(b => b.style.display = canCreate ? '' : 'none');

    // Show/hide root-only filters
    if (isRoot) {
      const _dfEl = $id('dashboard-filters'); if (_dfEl) _dfEl.style.display = '';
      const _srvEmp = $id('filter-srv-empresa'); if (_srvEmp) _srvEmp.style.display = '';
      const _srvLoc = $id('filter-srv-local');   if (_srvLoc) _srvLoc.style.display = '';
      const uEmpEl = $id('filter-usuarios-empresa'); if (uEmpEl) uEmpEl.style.display = '';
      const uLocEl = $id('filter-usuarios-local');   if (uLocEl) uLocEl.style.display = '';
      const _persEmp = $id('filter-personas-empresa'); if (_persEmp) _persEmp.style.display = '';
      const _repEmp = $id('rep-empresa-group'); if (_repEmp) _repEmp.style.display = '';
      const _repLoc = $id('rep-local-group');   if (_repLoc) _repLoc.style.display = '';
      document.querySelectorAll('.th-empresa-srv').forEach(th => th.style.display = '');
      populateEmpresaFilters();
      populatePersonasEmpresaFilter();
    } else {
      // Hide root-only filters
      const _dfEl2 = $id('dashboard-filters'); if (_dfEl2) _dfEl2.style.display = 'none';
      const _srvEmp2 = $id('filter-srv-empresa'); if (_srvEmp2) _srvEmp2.style.display = 'none';
      const _srvLoc2 = $id('filter-srv-local');   if (_srvLoc2) _srvLoc2.style.display = 'none';
      const uEmpEl2 = $id('filter-usuarios-empresa'); if (uEmpEl2) uEmpEl2.style.display = 'none';
      const _persEmp2 = $id('filter-personas-empresa'); if (_persEmp2) _persEmp2.style.display = 'none';
      const _repEmp2 = $id('rep-empresa-group'); if (_repEmp2) _repEmp2.style.display = 'none';
      const _repLoc2 = $id('rep-local-group');   if (_repLoc2) _repLoc2.style.display = 'none';
      document.querySelectorAll('.th-empresa-srv').forEach(th => th.style.display = 'none');

      if (isAdmin) {
        const uLocEl2 = $id('filter-usuarios-local'); if (uLocEl2) uLocEl2.style.display = '';
        populateAdminLocalFilters();
      } else {
        const uLocEl3 = $id('filter-usuarios-local'); if (uLocEl3) uLocEl3.style.display = 'none';
      }
    }
  } catch(e) {
    console.warn('[applyPermisos] UI setup error (non-fatal):', e);
  }

  // Navigation is always outside the try/catch so it always runs
  const lastPage = localStorage.getItem('ts_last_page') || 'dashboard';
  const validPages = ['dashboard','services','reportes','pos','productos','personas','listas-precios','empresas','locales','configuracion','sandbox','profile'];
  let pageToRestore = validPages.includes(lastPage) ? lastPage : 'dashboard';
  if (pageToRestore === 'empresas' && tipo !== 'root') pageToRestore = 'dashboard';
  if (pageToRestore === 'sandbox' && tipo !== 'root') pageToRestore = 'dashboard';
  goTo(pageToRestore);
}

// Populate empresa dropdown filters for root
async function populateEmpresaFilters() {
  if (allEmpresas.length === 0) {
    try { allEmpresas = (await api('GET', '/empresas?limit=1000')).data || []; } catch(e) { return; }
  }
  const selectors = ['filter-dash-empresa', 'filter-srv-empresa', 'filter-usuarios-empresa', 'rep-empresa'];
  selectors.forEach(id => {
    const sel = $id(id);
    if (!sel) return;
    if (sel.options.length <= 1) {
      allEmpresas.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id; opt.textContent = e.nombre;
        sel.appendChild(opt);
      });
    }
  });
}

async function populatePersonasEmpresaFilter() {
  const sel = $id('filter-personas-empresa');
  if (!sel || allEmpresas.length === 0) return;
  if (sel.options.length <= 1) {
    allEmpresas.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id; opt.textContent = e.nombre;
      sel.appendChild(opt);
    });
  }
}

async function populateLocalFilter(empresaId, selectId) {
  const sel = $id(selectId);
  if (!sel) return;
  sel.innerHTML = `<option value="">${t('usr.filter.all.locales')}</option>`;
  if (!empresaId) return;
  try {
    const locales = await api('GET', '/empresas/' + empresaId + '/locales');
    locales.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id; opt.textContent = l.nombre_local;
      sel.appendChild(opt);
    });
  } catch(e) {}
}

// Admin: populate local filter with their empresa locales
async function populateAdminLocalFilters() {
  await populateLocalFilter(currentUserData.empresa_id, 'filter-usuarios-local');
}

// Filter change handlers
async function onFilterDashEmpresa() {
  const empId = $id('filter-dash-empresa').value;
  await populateLocalFilter(empId, 'filter-dash-local');
  // Reset empleado dropdown when empresa changes
  const selEmp = $id('dash-filter-empleado');
  if (selEmp) selEmp.innerHTML = '<option value="">Todos los empleados</option>';
  refreshDashboard();
}

async function filterDashByLocal(localId) {
  setDashMode('local');
  const sel = $id('dash-filter-local');
  if (sel) sel.value = localId;
  refreshDashboard();
}

async function onFilterSrvEmpresa() {
  const empId = $id('filter-srv-empresa').value;
  await populateLocalFilter(empId, 'filter-srv-local');
  filterTable();
}

async function onFilterRepEmpresa() {
  const empId = $id('rep-empresa').value;
  await populateLocalFilter(empId, 'rep-local');
}

// ===== NAVIGATION =====
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
  $id('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  $id('sidebar-overlay').classList.remove('open');
}

// Mapa: tipo de alerta → página donde vive su filtro. Se usa para sincronizar
// la visibilidad del banner con la página actual sin perder el filtro al cambiar
// de pestaña en la SPA.
const NOTIF_TIPO_TO_PAGE = {
  servicio_estado:         'services',
  stock_bajo:              'productos',
  credito_vencido:         'reportes',
  pago_pendiente:          'reportes',
  empleados_sin_actividad: 'personas',
};

function syncNotifBanner(currentPage) {
  const b = $id('notif-active-banner');
  if (!b) return;
  const tipo = window.activeNotifFilter;
  if (tipo && NOTIF_TIPO_TO_PAGE[tipo] === currentPage) {
    showNotifBanner();
  } else {
    b.hidden = true;
  }
}

function goTo(page, el) {
  // NOTA: ya NO limpiamos activeNotifFilter al navegar manualmente. El filtro
  // persiste durante toda la sesión hasta que el usuario lo quite con el botón
  // "Quitar filtro" o haga click en otra notificación. Al volver a la página
  // filtrada, el banner y los registros resaltados reaparecen.

  // Permission guards for root-only pages
  if (currentUserData && currentUserData.tipo !== 'root') {
    if (page === 'empresas' || page === 'sandbox') { page = 'dashboard'; el = null; }
  }
  closeSidebar();
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (!el) el = document.querySelector(`.nav-item[onclick*="${page}"]`);
  if (el) el.classList.add('active');
  localStorage.setItem('ts_last_page', page);
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = $id('page-' + page);
  if (!pageEl) { console.warn('[goTo] page not found:', page); return; }
  pageEl.classList.add('notransition');
  pageEl.classList.add('active');
  requestAnimationFrame(() => { requestAnimationFrame(() => { pageEl.classList.remove('notransition'); }); });
  const titles = () => ({ dashboard: t('nav.dashboard'), services: t('srv.title'), reportes: t('rep.title'), profile: t('prof.title'), empresas: t('emp.title'), locales: t('loc.title'), configuracion: t('cfg.title'), sandbox: t('sbx.title'), pos: t('nav.section.pos'), productos: t('prod.title'), 'listas-precios': t('lp.title'), personas: 'Personas', 'importar-productos': 'Importar productos' });
  const subtitles = () => ({ dashboard: 'Resumen general', services: 'Servicios y reparaciones', reportes: 'Análisis financiero', pos: 'Terminal de venta', productos: 'Inventario de productos', personas: 'Clientes y empleados', 'listas-precios': 'Precios especiales', empresas: 'Empresas del sistema', locales: 'Sucursales y locales', usuarios: 'Gestión de accesos', configuracion: 'Ajustes del sistema', sandbox: 'Entorno de pruebas', profile: 'Mi cuenta', 'importar-productos': 'Importación masiva' });
  const titleEl = $id('topbar-title'); if (titleEl) titleEl.textContent = titles()[page] || page;
  const subEl = $id('topbar-subtitle'); if (subEl) subEl.textContent = subtitles()[page] || '';
  try {
    if (page === 'dashboard') refreshDashboard();
    else if (page === 'services') renderTable();
    else if (page === 'reportes') loadReportes();
    else if (page === 'profile') loadProfile();
    
    else if (page === 'empresas') loadEmpresas();
    else if (page === 'locales') loadLocales();
    else if (page === 'configuracion') { loadConfiguracion(); loadRolesConfig(); loadTiposProductos(); loadNivelesPrecios(); loadEstadosConfig(); loadConceptosCobro(); }
    else if (page === 'sandbox') loadSandboxes();
    else if (page === 'pos') loadPOS();
    else if (page === 'productos') loadProductos();
    
    else if (page === 'personas') {
      const isEmpleado = currentUserData?.tipo === 'empleado';
      const empTab = $id('prstab-empleado');
      if (empTab) empTab.style.display = isEmpleado ? 'none' : '';
      setPersonasRolTab(isEmpleado ? 'cliente' : 'empleado');
    }
    else if (page === 'listas-precios') loadListasPrecios();
    else if (page === 'importar-productos') initImportPage();
  } catch(e) { console.warn('[goTo] page load error:', page, e); }

  // Sincronizar banner: si hay un filtro de notificación activo y la página actual
  // es la que corresponde, mostrarlo; de lo contrario, ocultarlo.
  syncNotifBanner(page);
}

// ===== SERVICE MODAL =====
async function openModal(id = null) {
  editingId = id;
  const isEdit = id !== null;
  $id('modal-title').textContent = isEdit ? 'Editar Servicio' : 'Nuevo Servicio';
  $id('btn-save-label').textContent = isEdit ? 'Actualizar servicio' : 'Guardar servicio';
  resetForm();

  // Local field: editable for admin/root, hidden for empleado
  const tipo = currentUserData.tipo;
  const canEditLocal = (tipo === 'root' || tipo === 'admin');
  const userLocalId = currentUserData.local_id || currentUserData.localId;
  const localGroup = $id('servicio-local-group');
  const localSel = $id('f-servicio-local-id');

  if (canEditLocal) {
    localGroup.style.display = '';
    localSel.innerHTML = '<option value="">-- Seleccionar local --</option>';
    localSel.disabled = false;
    try {
      const empId = currentUserData.empresa_id || currentUserData.empresaId;
      const locales = await api('GET', '/empresas/' + empId + '/locales');
      locales.forEach(l => { const o = document.createElement('option'); o.value = l.id; o.textContent = l.nombre_local; localSel.appendChild(o); });
      if (userLocalId) localSel.value = userLocalId;
      // Auto-select first local if none pre-assigned (e.g. admin)
      if (!localSel.value && locales.length) localSel.value = locales[0].id;
    } catch(e) {}
  } else {
    // Empleado: local is assigned automatically — hide the field
    localGroup.style.display = 'none';
    localSel.innerHTML = '';
    const o = document.createElement('option');
    o.value = userLocalId;
    localSel.appendChild(o);
    localSel.value = userLocalId;
  }

  // Costos: show only if user has costos:editar permission
  const canSeeCostos = (tipo === 'root' || tipo === 'admin') || hasPermiso('costos', 'editar');
  const costosGroup = $id('costos-fields-group');
  if (costosGroup) costosGroup.style.display = canSeeCostos ? 'contents' : 'none';

  if (isEdit) {
    try {
      const s = await api('GET', '/servicios/' + id);
      fillForm(s);
      if (s.local_id && canEditLocal) localSel.value = s.local_id;
    } catch (e) { showToast(e.message, 'error'); return; }
  } else {
    // Default: ahora mismo (con hora) — antes solo era la fecha sin hora
    $id('f-fecha-entrada').value = nowDatetimeLocal();
  }
  $id('service-modal').classList.add('open');
}

function closeModal() { $id('service-modal').classList.remove('open'); editingId = null; }

function resetForm() {
  ['f-nombre','f-telefono','f-correo','f-direccion','f-modelo','f-serie',
   'f-falla','f-descripcion','f-observaciones','f-fecha-entrada','f-fecha-salida',
   'f-anticipo','f-costo-refaccion','f-costo-total'].forEach(id => $id(id).value = '');
  $id('f-cliente-id').value = '';
  $id('f-estado').value = 'Recibido';
  $id('g0').checked = true;
  $id('preview-img').style.display = 'none';
  $id('upload-icon').style.display = 'block';
  $id('upload-text').textContent = 'Haz clic para subir una imagen';
  $id('img-input').value = '';
  $id('ac-clientes').classList.remove('show');
}

function fillForm(s) {
  $id('f-cliente-id').value = s.cliente_id || '';
  $id('f-nombre').value = s.cliente_nombre || '';
  $id('f-telefono').value = s.cliente_telefono || '';
  $id('f-correo').value = s.cliente_correo || '';
  $id('f-direccion').value = s.cliente_direccion || '';
  $id('f-modelo').value = s.modelo || '';
  $id('f-serie').value = s.num_serie || '';
  $id('f-falla').value = s.falla || '';
  $id('f-descripcion').value = s.descripcion || '';
  $id('f-observaciones').value = s.observaciones || '';
  $id('f-estado').value = s.estado || 'Recibido';
  $id('f-fecha-entrada').value = toDatetimeLocal(s.fecha_entrada);
  $id('f-fecha-salida').value  = toDatetimeLocal(s.fecha_salida);
  $id('f-anticipo').value = s.anticipo || '';
  $id('f-costo-refaccion').value = s.costo_refaccion || '';
  $id('f-costo-total').value = s.costo_total || '';
  const gVal = s.garantia || 'Sin garantía';
  document.querySelectorAll('input[name="garantia"]').forEach(r => r.checked = r.value === gVal);
  if (s.imagen) {
    $id('preview-img').src = s.imagen;
    $id('preview-img').style.display = 'block';
    $id('upload-icon').style.display = 'none';
    $id('upload-text').textContent = 'Imagen adjunta';
  }
}

function previewImg(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      $id('preview-img').src = e.target.result;
      $id('preview-img').style.display = 'block';
      $id('upload-icon').style.display = 'none';
      $id('upload-text').textContent = input.files[0].name;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// ===== CLIENT AUTOCOMPLETE =====
function searchClientes(val) {
  $id('f-cliente-id').value = '';
  clearTimeout(acSearchTimer);
  const list = $id('ac-clientes');
  if (val.trim().length < 2) { if (list) list.classList.remove('show'); return; }
  acSearchTimer = setTimeout(async () => {
    try {
      // /personas devuelve {data,total,page}. Filtramos por rol=cliente para no
      // mezclar empleados/admins en el dropdown del modal de servicio.
      const resp = await api('GET', '/personas?rol=cliente&q=' + encodeURIComponent(val.trim()) + '&limit=8');
      const items = Array.isArray(resp) ? resp : (resp?.data || []);
      if (!list) return;
      if (!items.length) {
        list.innerHTML = `<div class="autocomplete-item" style="color:var(--text3);font-style:italic;cursor:default;">Sin coincidencias — se creará un cliente nuevo al guardar</div>`;
        list.classList.add('show');
        return;
      }
      list.innerHTML = items.map(c => {
        const nombre   = (c.nombre   || '').replace(/'/g, "\\'");
        const telefono = (c.telefono || '').replace(/'/g, "\\'");
        const correo   = (c.correo   || '').replace(/'/g, "\\'");
        const direccion= (c.direccion|| '').replace(/'/g, "\\'");
        return `<div class="autocomplete-item" onclick="selectCliente(${c.id}, '${nombre}', '${telefono}', '${correo}', '${direccion}')">
          <div class="ac-name">${escHtml(c.nombre || '')}</div>
          <div class="ac-sub">${escHtml(c.telefono || '')}${c.correo ? ' · ' + escHtml(c.correo) : ''}</div>
        </div>`;
      }).join('');
      list.classList.add('show');
    } catch(e) {
      console.error('[searchClientes] fallo:', e);
      if (list) {
        list.innerHTML = `<div class="autocomplete-item" style="color:var(--danger);cursor:default;">Error buscando clientes: ${escHtml(e.message || e)}</div>`;
        list.classList.add('show');
      }
    }
  }, 300);
}

function selectCliente(id, nombre, telefono, correo, direccion) {
  $id('f-cliente-id').value = id;
  $id('f-nombre').value = nombre;
  $id('f-telefono').value = telefono;
  $id('f-correo').value = correo;
  $id('f-direccion').value = direccion;
  $id('ac-clientes').classList.remove('show');
}

posAcTimer = null;
function searchPOSCliente(val) {
  posClienteId = null;
  if (posListaInfo) applyPOSListaDescuento(null);
  clearTimeout(posAcTimer);
  const list = $id('pos-ac-clientes');
  if (val.trim().length < 2) { if (list) list.classList.remove('show'); return; }
  posAcTimer = setTimeout(async () => {
    try {
      const clientes = await api('GET', '/personas?q=' + encodeURIComponent(val.trim()) + '&limit=8');
      const items = Array.isArray(clientes) ? clientes : (clientes.data || []);
      if (!items.length) { list.classList.remove('show'); return; }
      list.innerHTML = items.map(c => `
        <div class="autocomplete-item" onclick="selectPOSCliente(${c.id}, '${(c.nombre||'').replace(/'/g,"\\'")}')">
          <div class="ac-name">${escHtml(c.nombre)}</div>
          <div class="ac-sub">${c.telefono || ''} ${c.correo ? '· ' + c.correo : ''}</div>
        </div>`).join('');
      list.classList.add('show');
    } catch(e) { /* silently fail */ }
  }, 300);
}

async function selectPOSCliente(id, nombre) {
  posClienteId = id;
  posClienteNombre = nombre;
  if ($id('pos-cliente-input')) $id('pos-cliente-input').value = nombre;
  const list = $id('pos-ac-clientes');
  if (list) list.classList.remove('show');
  // Apply price list discount if the client has one
  try {
    const listas = await api('GET', '/personas/' + id + '/listas');
    const lista = Array.isArray(listas) ? listas.find(l => l.descuento_porcentaje > 0) : null;
    applyPOSListaDescuento(lista || null);
  } catch(e) {
    applyPOSListaDescuento(null);
  }
}

function applyPOSListaDescuento(lista) {
  posListaInfo = lista;
  const pct = lista ? lista.descuento_porcentaje : 0;
  posCart.forEach(item => {
    const precio = pct > 0
      ? Math.round(item.precioOriginal * (1 - pct / 100) * 100) / 100
      : item.precioOriginal;
    item.precioUnitario = precio;
    item.subtotal = Math.round(precio * item.cantidad * 100) / 100;
  });
  const infoDiv  = $id('pos-lista-info');
  const infoText = $id('pos-lista-info-text');
  if (infoDiv && infoText) {
    if (lista) {
      infoText.textContent = `Lista "${lista.nombre}" — ${lista.descuento_porcentaje}% de descuento aplicado`;
      infoDiv.style.display = '';
    } else {
      infoDiv.style.display = 'none';
    }
  }
  renderPOSCart();
  updatePOSTotals();
}

// Close autocomplete when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.autocomplete-wrap')) {
    $id('ac-clientes').classList.remove('show');
    const pac = $id('pos-ac-clientes'); if (pac) pac.classList.remove('show');
  }
  if (!e.target.closest('.ticket-dropdown')) { const m = $id('sd-ticket-menu'); if (m) m.classList.remove('open'); }
});

// ===== SAVE SERVICE =====
async function saveService() {
  const nombre = $id('f-nombre').value.trim();
  const modelo = $id('f-modelo').value.trim();
  const falla = $id('f-falla').value.trim();
  if (!nombre || !modelo || !falla) { showToast('Completa los campos obligatorios (*)', 'error'); return; }

  const saveBtn = document.querySelector('#service-modal .btn-accent');
  btnLoading(saveBtn, true);
  try {
    let clienteId = $id('f-cliente-id').value;

    // If no client selected, create one automatically
    if (!clienteId) {
      const newCliente = await api('POST', '/personas', {
        nombre,
        telefono: $id('f-telefono').value || null,
        correo: $id('f-correo').value || null,
        direccion: $id('f-direccion').value || null,
      });
      clienteId = newCliente.id;
    }

    const garantia = document.querySelector('input[name="garantia"]:checked')?.value || 'Sin garantía';
    const imagen = $id('preview-img').style.display !== 'none' ? $id('preview-img').src : null;

    const servicioLocalId = $id('f-servicio-local-id').value;
    if (!servicioLocalId && (currentUserData.tipo === 'admin' || currentUserData.tipo === 'root')) {
      showToast('Selecciona un local / sucursal', 'error'); return;
    }
    const body = {
      cliente_id: Number(clienteId),
      modelo,
      num_serie: $id('f-serie').value || null,
      falla,
      descripcion: $id('f-descripcion').value || null,
      observaciones: $id('f-observaciones').value || null,
      imagen,
      garantia,
      estado: $id('f-estado').value,
      fecha_entrada: fromDatetimeLocal($id('f-fecha-entrada').value),
      fecha_salida:  fromDatetimeLocal($id('f-fecha-salida').value),
      anticipo: parseFloat($id('f-anticipo').value) || 0,
      costo_refaccion: parseFloat($id('f-costo-refaccion').value) || 0,
      costo_total: parseFloat($id('f-costo-total').value) || 0,
      local_id: servicioLocalId ? Number(servicioLocalId) : undefined,
    };

    let savedServicio = null;
    if (editingId !== null) {
      savedServicio = await api('PUT', '/servicios/' + editingId, body);
      showToast('Servicio actualizado correctamente', 'success');
    } else {
      savedServicio = await api('POST', '/servicios', body);
      showToast('Servicio registrado correctamente', 'success');
    }

    closeModal();
    renderTable();
    refreshDashboard();

    // Auto WA send if enabled
    const waCfg = getWaConfig();
    if (waCfg.auto_enviar && savedServicio) {
      const nuevoEstado = body.estado;
      const estadoCfg = getWaEstadoConfig(nuevoEstado);
      if (estadoCfg.activo && estadoCfg.mensaje && savedServicio.cliente_telefono) {
        const waUrl = buildWaUrl(savedServicio, nuevoEstado);
        if (waUrl) setTimeout(() => window.open(waUrl, '_blank'), 300);
      }
    }
  } catch (e) {
    showToast(e.message, 'error');
  } finally { btnLoading(saveBtn, false); }
}

// ===== TABLE =====
function getEstadoColor(nombre) {
  const e = allEstados.find(x => x.nombre === nombre);
  return e ? e.color : '#888888';
}
function getEstadoStyle(nombre) {
  const c = getEstadoColor(nombre);
  return `background:${c}22;color:${c};border:1px solid ${c}44;`;
}

function garantiaBadge(garantia, fechaSalida) {
  if (!garantia || garantia === 'Sin garantía') {
    return `<span class="status-pill" style="background:var(--bg3);color:var(--text3);border:1px solid var(--border);font-size:10px;"><i class="fa-solid fa-ban" style="margin-right:3px;font-size:9px;"></i>Sin garantía</span>`;
  }
  const match = garantia.match(/(\d+)/);
  const dias = match ? parseInt(match[1]) : null;
  const valorPill = `<span class="status-pill sp-progress" style="font-size:10px;">${garantia}</span>`;
  if (!fechaSalida || !dias) return valorPill;
  const vencimiento = new Date(fechaSalida);
  vencimiento.setDate(vencimiento.getDate() + dias);
  const vigente = new Date() <= vencimiento;
  const statusPill = vigente
    ? `<span class="status-pill sp-done" style="font-size:10px;"><i class="fa-solid fa-shield-halved" style="margin-right:3px;font-size:9px;"></i>En garantía</span>`
    : `<span class="status-pill sp-cancelled" style="font-size:10px;"><i class="fa-solid fa-shield-xmark" style="margin-right:3px;font-size:9px;"></i>Garantía vencida</span>`;
  return `<div style="display:flex;flex-direction:column;gap:3px;">${valorPill}${statusPill}</div>`;
}

// ── Sort / per-page helpers ─────────────────────────────────────
function updateSortIcons(tbodyId, field, dir) {
  const tbody = $id(tbodyId);
  if (!tbody) return;
  const thead = tbody.closest('table')?.querySelector('thead');
  if (!thead) return;
  thead.querySelectorAll('th[data-sort]').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (!icon) return;
    const active = th.dataset.sort === field;
    th.classList.toggle('sort-active', active);
    icon.textContent = active ? (dir === 'asc' ? '↑' : '↓') : '↕';
  });
}

function sortByCol(sortObj, tbodyId, field, resetPageFn, loadFn) {
  if (sortObj.f === field) { sortObj.d = sortObj.d === 'asc' ? 'desc' : 'asc'; }
  else { sortObj.f = field; sortObj.d = 'asc'; }
  updateSortIcons(tbodyId, sortObj.f, sortObj.d);
  resetPageFn();
  loadFn();
}

function clientSort(arr, field, dir) {
  return [...arr].sort((a, b) => {
    let va = a[field] ?? ''; let vb = b[field] ?? '';
    const cmp = (typeof va === 'number' && typeof vb === 'number')
      ? va - vb : String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
  });
}

function perPageSelect(id, defaultVal, resetFn) {
  const el = $id(id);
  if (el) el.value = String(defaultVal);
}
// ────────────────────────────────────────────────────────────────

async function renderTable() {
  await ensureWaConfig();
  const q = $id('search-input').value;
  const estado = $id('filter-estado').value;
  const garantia = $id('filter-garantia').value;
  const srvEmp = $id('filter-srv-empresa')?.value;
  const srvLoc = $id('filter-srv-local')?.value;
  const isRoot = currentUserData?.tipo === 'root';
  tableLoading($id('services-tbody'), isRoot ? 12 : 11);
  try {
    PER_PAGE = parseInt($id('srv-per-page')?.value) || PER_PAGE;
    let url = `/servicios?page=${currentPage}&limit=${PER_PAGE}&sort=${srvSort.f}_${srvSort.d}`;
    if (q) url += '&q=' + encodeURIComponent(q);
    if (estado) url += '&estado=' + encodeURIComponent(estado);
    if (garantia) url += '&garantia=' + encodeURIComponent(garantia);
    if (srvEmp) url += '&empresa_id=' + srvEmp;
    if (srvLoc) url += '&local_id=' + srvLoc;
    
    if (window.activeNotifFilter === 'servicio_estado') {
      url += '&notif=' + window.activeNotifFilter;
      if (window.activeNotifParam) url += '&notif_param=' + encodeURIComponent(window.activeNotifParam);
    }

    const { data, total, page } = await api('GET', url);
    currentPage = page;

    const canEdit = hasPermiso('servicios', 'editar');
    const canDelete = hasPermiso('servicios', 'borrar');
    const canSeeCostos = (currentUserData?.tipo === 'root' || currentUserData?.tipo === 'admin') || hasPermiso('costos', 'ver');
    const thTot = $id('th-costo-total'); if (thTot) thTot.style.display = canSeeCostos ? '' : 'none';
    const thAnt = $id('th-anticipo'); if (thAnt) thAnt.style.display = canSeeCostos ? '' : 'none';
    const colSpan = (isRoot ? 12 : 11) - (canSeeCostos ? 0 : 2);

    $id('table-info').textContent = `${total} ${total !== 1 ? t('table.registros') : t('table.registro')}`;
    $id('badge-services').textContent = total;

    const tbody = $id('services-tbody');
    const rowCls = rowAlertClass('servicio_estado');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="${colSpan}"><div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Sin resultados</p></div></td></tr>`;
    } else {
      tbody.innerHTML = data.map(s => `
        <tr class="${rowCls}">
          <td class="col-priority-1">
            <span class="text-accent fw-bold">${s.folio||'-'}</span>
            ${s.folio ? `<br><canvas class="qr-mini-svc" data-folio="${(s.folio||'').replace(/"/g,'&quot;')}" style="width:40px;height:40px;cursor:pointer;margin-top:4px;display:block;" onclick="openFolioModal(this)" title="Ver QR del folio"></canvas>` : ''}
          </td>
          <td class="col-priority-1">
            <div class="td-name">${s.cliente_nombre||'-'}</div>
            <div class="td-sub">${s.cliente_telefono ? `<a href="${phoneToWA(s.cliente_telefono)}" target="_blank" style="color:var(--text2);text-decoration:none;" title="Enviar WhatsApp"><i class="fa-brands fa-whatsapp" style="color:#25D366;margin-right:3px;"></i>${s.cliente_telefono}</a>` : ''}</div>
          </td>
          <td class="col-priority-3">
            <div>${s.modelo||''}</div>
            <div class="td-sub">${s.num_serie||''}</div>
          </td>
          <td class="col-priority-4">${s.falla||'-'}</td>
          <td class="col-priority-1"><span class="status-pill${canEdit?' clickable':''}" style="${getEstadoStyle(s.estado)}" ${canEdit?`onclick="openStatusPopover(${s.id},'${s.estado.replace(/'/g,'\\\'').replace(/"/g,'&quot;')}',event)"`:''} title="${canEdit?'Cambiar estado':s.estado}">${s.estado||'-'}</span></td>
          <td class="col-priority-3" style="font-size:12px;">${s.fecha_entrada ? fmtDatetime(s.fecha_entrada) : '-'}</td>
          ${canSeeCostos ? `<td class="col-priority-3 text-accent fw-bold">${money(s.costo_total)}</td>` : ''}
          ${canSeeCostos ? `<td class="col-priority-5">${money(s.anticipo)}</td>` : ''}
          <td class="col-priority-5" style="font-size:12px;">${s.fecha_salida ? fmtDatetime(s.fecha_salida) : '-'}</td>
          <td class="col-priority-2">${garantiaBadge(s.garantia, s.fecha_salida)}</td>
          ${isRoot ? `<td class="col-priority-4"><div class="td-sub">${s.empresa_nombre||'-'}</div><div style="font-size:10px;color:var(--text3);">${s.local_nombre||''}</div></td>` : ''}
          <td class="col-priority-1">
            <div class="td-actions">
              <button class="act-btn view-btn" onclick="viewDetail(${s.id})" title="Ver detalle"><i class="fa-solid fa-eye"></i></button>
              ${waButtonVisible(s) ? `<button class="act-btn" onclick="sendWaFromTable(${s.id})" title="Notificar por WhatsApp" style="color:#25D366;"><i class="fa-brands fa-whatsapp"></i></button>` : ''}
              ${canEdit ? `<button class="act-btn edit" onclick="openModal(${s.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>` : ''}
              ${canDelete ? `<button class="act-btn del" onclick="askDelete(${s.id})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
          </td>
        </tr>
      `).join('');

      // Generate QR codes for service folios
      setTimeout(() => {
        document.querySelectorAll('.qr-mini-svc').forEach(canvas => {
          const folio = canvas.getAttribute('data-folio');
          if (folio && typeof QRCode !== 'undefined') {
            QRCode.toCanvas(canvas, folio, { width: 40, margin: 0, color: { dark: '#000', light: '#fff' } }, function(err) {
              if (err) console.warn('QR folio error:', err);
            });
          }
        });
      }, 50);
    }

    // Pagination — usa renderPagination() reducida con elipsis (definida más abajo)
    const pages = Math.ceil(total / PER_PAGE) || 1;
    renderPagination($id('pag-btns'), currentPage, pages, p => { currentPage = p; renderTable(); });
  } catch(e) { showToast(e.message, 'error'); }
}

function filterTable() { currentPage = 1; renderTable(); }
function sortTable(field) { sortByCol(srvSort, 'services-tbody', field, () => { currentPage = 1; }, renderTable); }

viewingServiceId = null;
viewingServiceData = null;

async function viewDetail(id) {
  try {
    const s = await api('GET', '/servicios/' + id);
    viewingServiceId = id;
    viewingServiceData = s;

    // Populate modal fields
    $id('sd-title').textContent = 'Detalle del Servicio — ' + (s.folio || '');
    $id('sd-nombre').textContent = s.cliente_nombre || '—';
    const waUrl = phoneToWA(s.cliente_telefono);
    $id('sd-telefono').innerHTML = s.cliente_telefono
      ? `<a href="${waUrl}" target="_blank" style="color:inherit;text-decoration:none;" title="Enviar WhatsApp"><i class="fa-brands fa-whatsapp" style="color:#25D366;margin-right:5px;"></i>${s.cliente_telefono}</a>`
      : '—';
    $id('sd-correo').textContent = s.cliente_correo || '—';
    $id('sd-direccion').textContent = s.cliente_direccion || '—';
    $id('sd-modelo').textContent = s.modelo || '—';
    $id('sd-serie').textContent = s.num_serie || '—';
    $id('sd-falla').textContent = s.falla || '—';
    $id('sd-descripcion').textContent = s.descripcion || '—';
    $id('sd-descripcion').classList.toggle('muted', !s.descripcion);
    $id('sd-observaciones').textContent = s.observaciones || '—';
    $id('sd-observaciones').classList.toggle('muted', !s.observaciones);

    // Estado with pill + quick selector
    $id('sd-estado').innerHTML = `<span class="status-pill" style="${getEstadoStyle(s.estado)}">${s.estado || '—'}</span>`;
    renderSdStatusSelector(s.estado);
    $id('sd-garantia').textContent = s.garantia || '—';
    $id('sd-fecha-entrada').textContent = fmtDatetime(s.fecha_entrada);
    $id('sd-fecha-salida').textContent  = fmtDatetime(s.fecha_salida);

    // Costs — visibility based on costos permission
    const canSeeCostosDetail = (currentUserData?.tipo === 'root' || currentUserData?.tipo === 'admin') || hasPermiso('costos', 'ver');
    const costosSec = $id('sd-costos-section');
    if (costosSec) costosSec.style.display = canSeeCostosDetail ? '' : 'none';
    if (canSeeCostosDetail) {
      $id('sd-anticipo').textContent = money(s.anticipo);
      $id('sd-refaccion').textContent = money(s.costo_refaccion);
      $id('sd-total').textContent = money(s.costo_total);
      const restante = (s.costo_total || 0) - (s.anticipo || 0);
      $id('sd-restante').textContent = money(restante > 0 ? restante : 0);
    }

    // Image
    if (s.imagen) {
      $id('sd-imagen').src = s.imagen;
      $id('sd-imagen-section').style.display = '';
    } else {
      $id('sd-imagen-section').style.display = 'none';
    }

    // Show/hide Finalizar button based on estado
    const hideFinalizar = ['Entregado', 'Cancelado'].includes(s.estado);
    $id('sd-btn-finalizar').style.display = hideFinalizar ? 'none' : '';

    // Show/hide WA notify button
    const waBtn = $id('sd-btn-wa');
    if (waBtn) waBtn.style.display = waButtonVisible(s) ? '' : 'none';

    // Load ticket templates for dropdown
    $id('sd-ticket-menu').classList.remove('open');
    loadTicketTemplates();

    $id('service-detail-modal').classList.add('open');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function closeServiceDetailModal() {
  $id('service-detail-modal').classList.remove('open');
  viewingServiceId = null;
  viewingServiceData = null;
}

function toggleTicketDropdown() {
  const menu = $id('sd-ticket-menu');
  menu.classList.toggle('open');
}

async function loadTicketTemplates() {
  const menu = $id('sd-ticket-menu');
  menu.innerHTML = '<button onclick="selectTicketTemplate(null)"><i class="fa-solid fa-file-lines"></i> Configuración por defecto</button>';
  try {
    let url = '/ticket-plantillas-list';
    if (viewingServiceData && viewingServiceData.empresa_id) url += '?empresa_id=' + viewingServiceData.empresa_id;
    const plantillas = await api('GET', url);
    plantillas.forEach(p => {
      menu.innerHTML += `<button onclick="selectTicketTemplate(${p.id})"><i class="fa-solid fa-ticket"></i> ${p.nombre}</button>`;
    });
  } catch(e) { /* si no hay plantillas, solo queda la opción por defecto */ }
}

function selectTicketTemplate(plantillaId) {
  $id('sd-ticket-menu').classList.remove('open');
  if (viewingServiceId) {
    const sId = viewingServiceId;
    closeServiceDetailModal();
    openTicketModal(sId, plantillaId);
  }
}

async function finalizarServicio() {
  if (!viewingServiceId || !viewingServiceData) return;
  if (!confirm('¿Marcar como entregado?\n\nEl estado cambiará a "Entregado" y se registrará la fecha de entrega actual.')) return;

  try {
    const s = viewingServiceData;
    await api('PUT', '/servicios/' + viewingServiceId, {
      cliente_id: s.cliente_id,
      modelo: s.modelo,
      num_serie: s.num_serie,
      falla: s.falla,
      descripcion: s.descripcion,
      observaciones: s.observaciones,
      imagen: s.imagen,
      garantia: s.garantia,
      estado: 'Entregado',
      fecha_entrada: s.fecha_entrada,
      fecha_salida: new Date().toISOString(),
      anticipo: s.anticipo,
      costo_refaccion: s.costo_refaccion,
      costo_total: s.costo_total
    });

    showToast('Servicio finalizado correctamente', 'success');
    closeServiceDetailModal();
    renderTable();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ===== QUICK STATUS CHANGE =====
_statusPopoverServiceId = null;

const ESTADOS_ORDER = () => allEstados.map(e => e.nombre);

function openStatusPopover(id, currentEstado, event) {
  event.stopPropagation();
  _statusPopoverServiceId = id;
  const pop = $id('status-popover');
  pop.innerHTML = ESTADOS_ORDER().map(est => `
    <div class="status-popover-item${est === currentEstado ? ' current' : ''}" onclick="quickChangeStatus(${id},'${est.replace(/'/g,"\\'")}')">
      <span class="sp-dot" style="background:${getEstadoColor(est)};"></span>
      <span>${est}</span>
      ${est === currentEstado ? '<i class="fa-solid fa-check" style="margin-left:auto;font-size:11px;color:var(--accent3);"></i>' : ''}
    </div>`).join('');
  // Position near click
  const rect = event.currentTarget.getBoundingClientRect();
  const popW = 195, popH = 280;
  let top = rect.bottom + 6, left = rect.left;
  if (top + popH > window.innerHeight - 10) top = rect.top - popH - 6;
  if (left + popW > window.innerWidth - 10) left = window.innerWidth - popW - 10;
  pop.style.top = top + 'px';
  pop.style.left = left + 'px';
  pop.classList.add('open');
}

function closeStatusPopover() {
  $id('status-popover')?.classList.remove('open');
  _statusPopoverServiceId = null;
}

async function quickChangeStatus(id, newEstado) {
  closeStatusPopover();
  try {
    const s = await api('GET', '/servicios/' + id);
    const updated = await api('PUT', '/servicios/' + id, {
      cliente_id: s.cliente_id, modelo: s.modelo, num_serie: s.num_serie,
      falla: s.falla, descripcion: s.descripcion, observaciones: s.observaciones,
      imagen: s.imagen, garantia: s.garantia, estado: newEstado,
      fecha_entrada: s.fecha_entrada,
      fecha_salida: newEstado === 'Entregado' ? (s.fecha_salida || new Date().toISOString()) : s.fecha_salida,
      anticipo: s.anticipo, costo_refaccion: s.costo_refaccion, costo_total: s.costo_total
    });
    showToast(`Estado → ${newEstado}`, 'success');
    renderTable();
    // If detail modal is open for this service, update it in-place
    if (viewingServiceId === id) {
      viewingServiceData = { ...viewingServiceData, estado: newEstado };
      $id('sd-estado').innerHTML = `<span class="status-pill" style="${getEstadoStyle(newEstado)}">${newEstado}</span>`;
      renderSdStatusSelector(newEstado);
      const hideFinalizar = ['Entregado','Cancelado'].includes(newEstado);
      $id('sd-btn-finalizar').style.display = hideFinalizar ? 'none' : '';
      const waBtn = $id('sd-btn-wa');
      if (waBtn) waBtn.style.display = waButtonVisible(viewingServiceData) ? '' : 'none';
    }
    // Auto WA send
    const waCfg = getWaConfig();
    if (waCfg.auto_enviar && updated) {
      const estadoCfg = getWaEstadoConfig(newEstado);
      if (estadoCfg.activo && estadoCfg.mensaje && updated.cliente_telefono) {
        const waUrl = buildWaUrl(updated, newEstado);
        if (waUrl) setTimeout(() => window.open(waUrl, '_blank'), 300);
      }
    }
  } catch(e) { showToast(e.message, 'error'); }
}

function renderSdStatusSelector(currentEstado) {
  const sel = $id('sd-status-selector');
  if (!sel) return;
  const canEdit = hasPermiso('servicios', 'editar');
  if (!canEdit) { sel.style.display = 'none'; return; }
  sel.innerHTML = ESTADOS_ORDER().map(est => {
    const isActive = est === currentEstado;
    return `<span class="sd-status-btn${isActive ? ' active' : ''}" style="${getEstadoStyle(est)}${isActive ? 'opacity:1;' : 'opacity:0.65;'}" onclick="quickChangeStatus(${viewingServiceId},'${est.replace(/'/g,"\\'")}');return false;" title="${est}">${est}</span>`;
  }).join('');
}

// Close popover when clicking outside
document.addEventListener('click', (e) => {
  const pop = $id('status-popover');
  if (pop && pop.classList.contains('open') && !pop.contains(e.target)) closeStatusPopover();
});

// ===== WA NOTIFICATIONS =====
// WA_ESTADOS and WA_DEFAULT_MSGS moved to top
function getWaConfig() {
  if (!waConfig) return { auto_enviar: false, estados: {} };
  return waConfig;
}

async function ensureWaConfig() {
  if (waConfig !== null) return;
  try {
    const res = await api('GET', '/configuracion/wa');
    waConfig = res.wa_config ? JSON.parse(res.wa_config) : { auto_enviar: false, estados: {} };
  } catch(e) { waConfig = { auto_enviar: false, estados: {} }; }
}

function getWaEstadoConfig(estado) {
  const cfg = getWaConfig();
  return cfg.estados && cfg.estados[estado] ? cfg.estados[estado] : { activo: false, mensaje: WA_DEFAULT_MSGS[estado] || '' };
}

function buildWaUrl(s, estado) {
  if (!s.cliente_telefono) return null;
  const estadoCfg = getWaEstadoConfig(estado || s.estado);
  if (!estadoCfg.activo || !estadoCfg.mensaje) return null;
  const msg = estadoCfg.mensaje
    .replace(/\{nombre\}/g, s.cliente_nombre || s.nombre || '')
    .replace(/\{folio\}/g, s.folio || '')
    .replace(/\{equipo\}/g, s.modelo || '')
    .replace(/\{estado\}/g, estado || s.estado || '')
    .replace(/\{empresa\}/g, currentUserData?.empresa_nombre || '');
  const digits = s.cliente_telefono.replace(/\D/g, '');
  const phone = digits.startsWith('52') ? digits : '52' + digits;
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);
}

function sendWaForService(s, estado) {
  const url = buildWaUrl(s, estado || s.estado);
  if (!url) { showToast('Sin número de cliente o botón desactivado', 'warning'); return; }
  window.open(url, '_blank');
}

// Called from table row button
async function sendWaFromTable(id) {
  try {
    const s = await api('GET', '/servicios/' + id);
    sendWaForService(s, s.estado);
  } catch(e) { showToast(e.message, 'error'); }
}

// Called from detail modal
function sendWaFromDetail() {
  if (!viewingServiceData) return;
  sendWaForService(viewingServiceData, viewingServiceData.estado);
}

// Check if WA button should be visible for a given service row
function waButtonVisible(s) {
  if (!s.cliente_telefono) return false;
  const isAdmin = currentUserData?.tipo === 'admin' || currentUserData?.tipo === 'root';
  if (!isAdmin && !hasPermiso('wa_notificaciones', 'ver')) return false;
  const estadoCfg = getWaEstadoConfig(s.estado);
  return estadoCfg.activo && !!estadoCfg.mensaje;
}

// ===== WA CONFIG FORM =====
function renderWaConfigForm() {
  const cfg = getWaConfig();
  const container = $id('wa-estados-list');
  if (!container) return;
  $id('cfg-wa-auto').checked = !!cfg.auto_enviar;

  container.innerHTML = WA_ESTADOS().map(est => {
    const ec = cfg.estados && cfg.estados[est] ? cfg.estados[est] : { activo: false, mensaje: WA_DEFAULT_MSGS[est] || '' };
    const safeEst = est.replace(/[^a-zA-Z0-9]/g, '_');
    const varBtns = WA_VARIABLES.map(v => `
      <button type="button" onclick="waInsertVar('${safeEst}','${v.key}')" title="Insertar {${v.key}} en el mensaje"
        style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:14px;border:1px solid ${v.color}55;background:${v.color}1a;color:${v.color};font-size:11px;font-weight:600;font-family:monospace;cursor:pointer;transition:all .12s;"
        onmouseover="this.style.background='${v.color}33';this.style.borderColor='${v.color}88';"
        onmouseout="this.style.background='${v.color}1a';this.style.borderColor='${v.color}55';">
        <i class="fa-solid ${v.icon}" style="font-size:9px;"></i> ${v.label}
      </button>`).join('');
    return `<div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;">
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--border);flex-wrap:wrap;">
        <input type="checkbox" id="cfg-wa-activo-${safeEst}" ${ec.activo ? 'checked' : ''} onchange="toggleWaEstado('${est}')" style="width:15px;height:15px;cursor:pointer;flex-shrink:0;">
        <span class="status-pill" style="font-size:11px;${getEstadoStyle(est)}">${est}</span>
      </div>
      <div style="padding:10px 14px;${ec.activo ? '' : 'opacity:0.5;'}" id="cfg-wa-body-${safeEst}">
        <textarea id="cfg-wa-msg-${safeEst}" class="f-input" rows="2" style="width:100%;resize:vertical;font-size:13px;" placeholder="Mensaje para estado: ${est}">${escHtml(ec.mensaje || WA_DEFAULT_MSGS[est] || '')}</textarea>
        <div style="display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap;">
          <span style="font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-right:4px;">
            <i class="fa-solid fa-hand-pointer" style="font-size:10px;margin-right:3px;"></i>Insertar variable:
          </span>
          ${varBtns}
        </div>
      </div>
    </div>`;
  }).join('');
}

// Catálogo de variables disponibles para los mensajes de WhatsApp.
// Cada una con su color/icono para que sea visualmente identificable.
const WA_VARIABLES = [
  { key: 'nombre',  label: 'Nombre',  icon: 'fa-user',          color: '#3b82f6' },  // azul
  { key: 'folio',   label: 'Folio',   icon: 'fa-hashtag',       color: '#f59e0b' },  // naranja
  { key: 'equipo',  label: 'Equipo',  icon: 'fa-mobile-screen', color: '#8b5cf6' },  // morado
  { key: 'estado',  label: 'Estado',  icon: 'fa-circle-info',   color: '#10b981' },  // verde
  { key: 'empresa', label: 'Empresa', icon: 'fa-building',      color: '#ef4444' },  // rojo
];

// Inserta {variable} en el textarea del estado dado, en la posición del
// cursor (o al final). Mantiene el focus dentro del textarea para que el
// usuario pueda seguir escribiendo.
function waInsertVar(safeEst, variable) {
  const ta = $id('cfg-wa-msg-' + safeEst);
  if (!ta) return;
  const placeholder = '{' + variable + '}';
  const start = ta.selectionStart ?? ta.value.length;
  const end   = ta.selectionEnd ?? ta.value.length;
  const before = ta.value.substring(0, start);
  const after  = ta.value.substring(end);
  // Si el carácter justo antes del cursor no es espacio, salto, ni inicio,
  // agregamos un espacio para separar la variable del texto previo.
  const needSpaceBefore = before.length > 0 && !/[\s\n]$/.test(before);
  const insert = (needSpaceBefore ? ' ' : '') + placeholder;
  ta.value = before + insert + after;
  ta.focus();
  const newPos = (before + insert).length;
  ta.setSelectionRange(newPos, newPos);
}

function toggleWaEstado(estado) {
  // Just update visual opacity
  const safeEst = estado.replace(/[^a-zA-Z0-9]/g, '_');
  const cb = $id('cfg-wa-activo-' + safeEst);
  const body = $id('cfg-wa-body-' + safeEst);
  if (body) body.style.opacity = cb?.checked ? '1' : '0.5';
}

function readWaConfigForm() {
  const cfg = { auto_enviar: !!$id('cfg-wa-auto')?.checked, estados: {} };
  WA_ESTADOS().forEach(est => {
    const safeEst = est.replace(/[^a-zA-Z0-9]/g, '_');
    const activo = !!$id('cfg-wa-activo-' + safeEst)?.checked;
    const mensaje = $id('cfg-wa-msg-' + safeEst)?.value?.trim() || '';
    cfg.estados[est] = { activo, mensaje };
  });
  return cfg;
}

async function initWaScopeSelector() {
  const sel = $id('cfg-wa-scope');
  if (!sel) return;
  const isRoot = currentUserData?.tipo === 'root';
  const empresaId = isRoot
    ? (parseInt($id('config-empresa-select')?.value) || currentUserData?.empresaId)
    : currentUserData?.empresaId;
  sel.innerHTML = '<option value="">General (todas las sucursales)</option>';
  try {
    const locales = await api('GET', '/empresas/' + empresaId + '/locales');
    locales.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = l.nombre_local;
      sel.appendChild(opt);
    });
  } catch(e) {}
}

async function loadWaForScope() {
  const sel = $id('cfg-wa-scope');
  const localId = sel ? sel.value : '';
  try {
    if (localId) {
      const local = await api('GET', '/locales/' + localId);
      if (local.wa_config) {
        waConfig = typeof local.wa_config === 'string' ? JSON.parse(local.wa_config) : local.wa_config;
      } else {
        const cfg = await api('GET', '/configuracion');
        waConfig = cfg.wa_config ? JSON.parse(cfg.wa_config) : { auto_enviar: false, estados: {} };
      }
    } else {
      const cfg = await api('GET', '/configuracion');
      waConfig = cfg.wa_config ? JSON.parse(cfg.wa_config) : { auto_enviar: false, estados: {} };
    }
  } catch(e) { waConfig = { auto_enviar: false, estados: {} }; }
  renderWaConfigForm();
}

async function saveWaConfig() {
  const sel = $id('cfg-wa-scope');
  const localId = sel ? sel.value : '';
  const waData = readWaConfigForm();
  try {
    if (localId) {
      await api('PUT', '/locales/' + localId + '/wa-config', { wa_config: JSON.stringify(waData) });
    } else {
      const isRoot = currentUserData?.tipo === 'root';
      const body = { wa_config: JSON.stringify(waData) };
      if (isRoot) {
        const empresaId = parseInt($id('config-empresa-select')?.value);
        if (empresaId) body.empresa_id = empresaId;
      }
      await api('PUT', '/configuracion/wa', body);
    }
    waConfig = waData;
    showToast('Configuración WhatsApp guardada', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

// Delete
function askDelete(id) {
  deleteId = id;
  $id('confirm-overlay').classList.add('open');
}
function closeConfirm() { $id('confirm-overlay').classList.remove('open'); deleteId = null; }
async function confirmDelete() {
  try {
    await api('DELETE', '/servicios/' + deleteId);
    closeConfirm();
    renderTable();
    refreshDashboard();
    showToast('Servicio eliminado', 'error');
  } catch(e) { showToast(e.message, 'error'); }
}

// ── Loading helpers ────────────────────────────────────────────
function tableLoading(tbodyEl, cols, rows) {
  if (!tbodyEl) return;
  rows = rows || 6;
  tbodyEl.innerHTML = Array.from({length:rows}, () =>
    `<tr class="skel-row">${Array.from({length:cols}, (_, i) =>
      `<td><span class="skel-cell" style="width:${[70,55,80,60,50,40,65][i%7]}%"></span></td>`
    ).join('')}</tr>`
  ).join('');
}

function btnLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.classList.add('btn-loading');
    btn.disabled = true;
    const ic = btn.querySelector('i');
    if (ic) { ic._prevClass = ic.className; ic.className = 'fa-solid fa-circle-notch fa-spin-on-load'; }
  } else {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    const ic = btn.querySelector('i');
    if (ic && ic._prevClass) { ic.className = ic._prevClass; delete ic._prevClass; }
  }
}

// ===== DASHBOARD =====

function setDashMode(mode) {
  dashMode = mode;
  // Tab button styles
  ['general','local','empleado'].forEach(m => {
    const btn = $id('dash-mode-' + m);
    if (!btn) return;
    btn.style.background = m === mode ? 'var(--accent)' : 'transparent';
    btn.style.color = m === mode ? '#fff' : 'var(--text2)';
  });
  // Filter visibility
  const filterLocal = $id('dash-filter-local');
  const filterEmp   = $id('dash-filter-empleado');
  if (filterLocal)  filterLocal.style.display  = mode === 'local'    ? '' : 'none';
  if (filterEmp)    filterEmp.style.display     = mode === 'empleado' ? '' : 'none';
  // Section visibility
  $id('dash-general-section').style.display  = mode === 'general'  ? '' : 'none';
  $id('dash-local-section').style.display    = mode === 'local'    ? '' : 'none';
  $id('dash-empleado-section').style.display = mode === 'empleado' ? '' : 'none';
  refreshDashboard();
}

// Skeletons HTML — generados perezosamente para evitar TDZ si algún handler
// llama dashShowSkeletons() antes de que el script evalúe estas constantes.
function _getDashSkelKpi() {
  return Array.from({length:6},()=>`<div class="stat-card"><div class="stat-icon"><span class="skel-cell" style="width:32px;height:32px;border-radius:50%;display:block;"></span></div><div class="stat-info"><div class="skel-cell" style="width:60%;height:20px;margin-bottom:6px;"></div><div class="skel-cell" style="width:40%;height:11px;"></div></div></div>`).join('');
}
function _getDashSkelRow() {
  return Array.from({length:4},()=>`<div class="recent-item"><div class="ri-avatar"><span class="skel-cell" style="width:36px;height:36px;border-radius:50%;display:block;"></span></div><div style="flex:1;"><div class="skel-cell" style="width:55%;height:13px;margin-bottom:5px;"></div><div class="skel-cell" style="width:35%;height:10px;"></div></div><div class="skel-cell" style="width:60px;height:20px;border-radius:99px;"></div><div class="skel-cell" style="width:52px;height:13px;"></div></div>`).join('');
}

function dashShowSkeletons() {
  const kpiGrid = $id('dash-kpi-grid'); if (kpiGrid) kpiGrid.innerHTML = _getDashSkelKpi();
  const rc = $id('recent-list'); if (rc) rc.innerHTML = _getDashSkelRow();
  const rv = $id('recent-ventas-list'); if (rv) rv.innerHTML = _getDashSkelRow();
  const tp = $id('dash-top-productos'); if (tp) tp.innerHTML = `<div style="padding:16px 8px;">${Array.from({length:4},()=>`<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;"><div class="skel-cell" style="flex:1;height:13px;"></div><div class="skel-cell" style="width:50px;height:13px;"></div><div class="skel-cell" style="width:80px;height:8px;border-radius:4px;"></div></div>`).join('')}</div>`;
  const bc = $id('bar-chart'); if (bc) bc.innerHTML = `<div style="display:flex;align-items:flex-end;gap:6px;height:120px;padding:0 8px;">${Array.from({length:8},()=>`<div style="flex:1;display:flex;flex-direction:column;gap:3px;align-items:center;"><div class="skel-cell" style="width:100%;height:${30+Math.random()*70}px;border-radius:4px 4px 0 0;"></div></div>`).join('')}</div>`;
  const dw = $id('donut-wrap'); if (dw) dw.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:160px;"><div class="skel-cell" style="width:130px;height:130px;border-radius:50%;"></div></div>`;
}

function dashShowError(msg) {
  const grid = $id('dash-kpi-grid');
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px 16px;color:var(--text2);">
    <i class="fa-solid fa-circle-exclamation" style="font-size:28px;color:var(--danger);margin-bottom:10px;display:block;"></i>
    <div style="font-size:14px;margin-bottom:12px;">${escHtml(msg || 'No se pudo cargar el dashboard')}</div>
    <button class="btn-outline" onclick="refreshDashboard()" style="font-size:13px;padding:8px 20px;">
      <i class="fa-solid fa-rotate-right"></i> Reintentar
    </button>
  </div>`;
}

_dashLoading = false;
async function refreshDashboard() {
  if (!token || !currentUserData) return;
  if (_dashLoading) return;
  _dashLoading = true;
  try {
    const tipo = currentUserData?.tipo;
    // Show correct header
    const isEmpleado = tipo === 'empleado';
    $id('dash-greeting').style.display    = isEmpleado ? '' : 'none';
    $id('dash-admin-header').style.display = isEmpleado ? 'none' : 'flex';
    if (tipo === 'root') { const _fe = $id('filter-dash-empresa'); if (_fe) _fe.style.display = ''; }
    // Greeting for empleados
    if (isEmpleado) {
      $id('dash-greeting-text').textContent = `Hola, ${currentUserData.nombre?.split(' ')[0]} 👋`;
      const now = new Date();
      $id('dash-greeting-date').textContent = now.toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    }

    // Build URL
    let dashUrl = '/dashboard';
    const dashParams = [];
    const dashEmp = $id('filter-dash-empresa')?.value;
    if (dashEmp) dashParams.push('empresa_id=' + dashEmp);
    if (!isEmpleado) {
      if (dashMode === 'local') {
        const v = $id('dash-filter-local')?.value;
        if (v) dashParams.push('local_id=' + v);
      } else if (dashMode === 'empleado') {
        const v = $id('dash-filter-empleado')?.value;
        if (v) dashParams.push('usuario_id=' + v);
      }
    }
    if (dashParams.length) dashUrl += '?' + dashParams.join('&');

    // Show skeletons on first load or when refreshing
    dashShowSkeletons();

    const d = await api('GET', dashUrl);
    const s = d.stats || {};

    // KPI grid
    renderKpiGrid(s, tipo);

    // Charts
    renderBarChart(d.porMes || [], d.ventasPorMes || []);
    renderDonutFromStats(s);

    // General section
    renderRecent(d.recientes || []);
    renderRecentVentas(d.recientesVentas || []);
    renderTopProductos(d.topProductos || []);

    // Breakdown sections
    if (dashMode === 'local')    renderPorLocal(d.porLocal || []);
    if (dashMode === 'empleado') renderPorEmpleado(d.porEmpleado || [], d.porLocal || []);

    // Populate empleado dropdown if switching to that mode and empty
    if (!isEmpleado && dashMode === 'empleado') {
      const sel = $id('dash-filter-empleado');
      if (sel && sel.options.length <= 1 && d.porEmpleado?.length) {
        d.porEmpleado.forEach(e => {
          const opt = document.createElement('option');
          opt.value = e.id; opt.textContent = e.nombre;
          sel.appendChild(opt);
        });
      }
    }

    // Badge + profile stats
    $id('badge-services').textContent = s.total || 0;
    $id('prof-stat-services').textContent = s.total || 0;
    $id('prof-stat-ingresos').textContent  = money(s.ingresos_totales);
    $id('prof-stat-done').textContent      = s.entregados || 0;
    $id('prof-stat-pending').textContent   = s.en_proceso || 0;
  } catch(e) {
    if (token) dashShowError(e.message);
  } finally {
    _dashLoading = false;
  }
}

function renderKpiGrid(s, tipo) {
  const isEmpleado = tipo === 'empleado';
  const growthPct = (cur, prev) => {
    if (!prev) return cur > 0 ? '+100%' : '0%';
    const p = Math.round(((cur - prev) / prev) * 100);
    return (p >= 0 ? '+' : '') + p + '%';
  };
  const growthColor = (cur, prev) => cur >= prev ? 'var(--success)' : 'var(--danger)';
  const kpiCard = (icon, label, value, sub, subColor) => `
    <div class="stat-card">
      <div class="stat-icon"><i class="fa-solid ${icon}"></i></div>
      <div class="stat-info">
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
        ${sub ? `<div style="font-size:11px;color:${subColor||'var(--text3)'};margin-top:2px;">${sub}</div>` : ''}
      </div>
    </div>`;

  let cards = '';
  // Always show: total servicios activos, servicios este mes, ingresos servicios mes
  cards += kpiCard('fa-wrench', 'Servicios activos', s.activos || 0,
    `${s.entregados_hoy||0} entregado${s.entregados_hoy!==1?'s':''} hoy`, 'var(--text3)');
  cards += kpiCard('fa-calendar', 'Servicios este mes', s.total_mes || 0,
    growthPct(s.total_mes, s.total_mes_ant) + ' vs mes anterior',
    growthColor(s.total_mes, s.total_mes_ant));
  cards += kpiCard('fa-circle-dollar-to-slot', 'Ingresos servicios', money(s.ingresos_mes || 0),
    growthPct(s.ingresos_mes, s.ingresos_mes_ant) + ' vs mes anterior',
    growthColor(s.ingresos_mes, s.ingresos_mes_ant));

  if (!isEmpleado) {
    // Ventas POS cards for admin/root
    cards += kpiCard('fa-cash-register', 'Ventas hoy', s.ventas_hoy || 0,
      money(s.ingresos_hoy || 0) + ' en efectivo+tarjeta', 'var(--text3)');
    cards += kpiCard('fa-chart-line', 'Ventas este mes', s.ventas_mes || 0,
      money(s.ingresos_ventas_mes || 0), 'var(--accent)');
    cards += kpiCard('fa-hourglass-half', 'Créditos pendientes', s.creditos_activos || 0,
      'Por cobrar', s.creditos_activos > 0 ? 'var(--warning)' : 'var(--text3)');
  } else {
    // For empleados, show personal ventas
    cards += kpiCard('fa-cash-register', 'Mis ventas hoy', s.ventas_hoy || 0,
      money(s.ingresos_hoy || 0), 'var(--text3)');
    cards += kpiCard('fa-check-circle', 'Listos para entregar', s.listos || 0,
      '', s.listos > 0 ? 'var(--success)' : 'var(--text3)');
  }

  $id('dash-kpi-grid').innerHTML = cards;
}

function renderBarChart(porMes, ventasPorMes) {
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const counts  = new Array(12).fill(0);
  const vCounts = new Array(12).fill(0);
  porMes.forEach(m => {
    const idx = parseInt(m.mes) - 1;
    if (idx >= 0 && idx < 12) counts[idx] = m.cantidad || 0;
  });
  (ventasPorMes || []).forEach(m => {
    const idx = parseInt(m.mes) - 1;
    if (idx >= 0 && idx < 12) vCounts[idx] = m.cantidad || 0;
  });
  const maxC = Math.max(...counts, ...vCounts, 1);
  $id('bar-chart').innerHTML = months.map((m, i) => `
    <div class="bar-col">
      <div style="display:flex;gap:2px;align-items:flex-end;height:120px;">
        <div class="bar" style="height:${Math.max(4,(counts[i]/maxC)*120)}px;flex:1" title="${m}: ${counts[i]} servicios"></div>
        <div class="bar" style="height:${Math.max(4,(vCounts[i]/maxC)*120)}px;flex:1;background:var(--info);opacity:.7" title="${m}: ${vCounts[i]} ventas POS"></div>
      </div>
      <div class="bar-label">${m}</div>
    </div>
  `).join('');
}

function renderDonutFromStats(s) {
  const labels = ['Recibido','En proceso','Listo','Entregado','Cancelado'];
  const colors = ['#f0a500','#1e90ff','#a855f7','#00d4aa','#ff4757'];
  const counts = [
    (s.total||0) - (s.en_proceso||0) - (s.entregados||0) - (s.listos||0) - (s.cancelados||0),
    s.en_proceso || 0,
    s.listos || 0,
    s.entregados || 0,
    s.cancelados || 0
  ];
  // Fix: Recibido count could be negative if counts don't add up, use 0
  if (counts[0] < 0) counts[0] = 0;
  const total = counts.reduce((a,b) => a+b, 0) || 1;
  let offset = 0;
  const r = 50, cx = 60, cy = 60;
  const circumference = 2 * Math.PI * r;
  const segments = counts.map((c, i) => {
    const pct = c / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[i]}" stroke-width="18" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset * circumference}" transform="rotate(-90 ${cx} ${cy})" opacity="${c>0?0.85:0.1}"/>`;
    offset += pct;
    return seg;
  });
  const svg = `<svg class="donut-svg" viewBox="0 0 120 120">
    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="18"/>
    ${segments.join('')}
    <text x="60" y="55" text-anchor="middle" fill="var(--text)" font-size="18" font-family="Syne" font-weight="800">${s.total||0}</text>
    <text x="60" y="70" text-anchor="middle" fill="var(--text2)" font-size="9">servicios</text>
  </svg>`;
  const legend = labels.map((l, i) => `
    <div class="dl-item"><div class="dl-dot" style="background:${colors[i]}"></div><span class="dl-label">${l}</span><span class="dl-val">${counts[i]}</span></div>
  `).join('');
  $id('donut-wrap').innerHTML = svg + `<div class="donut-legend">${legend}</div>`;
}

function renderRecent(recientes) {
  const el = $id('recent-list');
  if (!recientes.length) { el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Sin servicios registrados</p></div>'; return; }
  el.innerHTML = recientes.map(s => `
    <div class="recent-item">
      <div class="ri-avatar"><i class="fa-solid fa-mobile-screen-button"></i></div>
      <div><div class="ri-name">${escHtml(s.cliente_nombre||'-')}</div><div class="ri-sub">${escHtml(s.modelo)} · ${escHtml(s.folio)}</div></div>
      <span class="status-pill" style="${getEstadoStyle(s.estado)}">${s.estado||'-'}</span>
      <div class="ri-price">${money(s.costo_total)}</div>
    </div>
  `).join('');
}

function renderRecentVentas(ventas) {
  const el = $id('recent-ventas-list');
  if (!el) return;
  if (!ventas.length) { el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Sin ventas registradas</p></div>'; return; }
  const metodoBadge = { efectivo:'badge-efectivo', tarjeta:'badge-tarjeta', transferencia:'badge-transferencia', credito:'badge-credito', mixto:'badge-mixto' };
  el.innerHTML = ventas.map(v => `
    <div class="recent-item">
      <div class="ri-avatar" style="background:var(--info-bg,#1e90ff22);color:var(--info,#1e90ff);"><i class="fa-solid fa-receipt"></i></div>
      <div><div class="ri-name">${escHtml(v.cliente_nombre||'Cliente general')}</div><div class="ri-sub">${escHtml(v.folio_venta||'')} · ${escHtml(v.vendedor_nombre||'-')}</div></div>
      <span class="badge-metodo ${metodoBadge[v.metodo_pago]||''}">${v.metodo_pago||'-'}</span>
      <div class="ri-price">${money(v.total)}</div>
    </div>
  `).join('');
}

function renderTopProductos(productos) {
  const el = $id('dash-top-productos');
  if (!el) return;
  if (!productos.length) { el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px;">Sin datos este mes</div>'; return; }
  const max = productos[0].unidades || 1;
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="color:var(--text3);">
      <th style="text-align:left;padding:6px 8px;font-weight:600;">Producto</th>
      <th style="text-align:right;padding:6px 8px;font-weight:600;">Unidades</th>
      <th style="text-align:right;padding:6px 8px;font-weight:600;">Ingreso</th>
      <th style="padding:6px 8px;width:120px;"></th>
    </tr></thead>
    <tbody>${productos.map(p => `
      <tr style="border-top:1px solid var(--border);">
        <td style="padding:8px;">${escHtml(p.nombre)}</td>
        <td style="padding:8px;text-align:right;font-weight:600;">${p.unidades}</td>
        <td style="padding:8px;text-align:right;">${money(p.ingreso)}</td>
        <td style="padding:8px;"><div style="background:var(--bg3);border-radius:4px;height:6px;overflow:hidden;"><div style="background:var(--accent);height:100%;width:${Math.round((p.unidades/max)*100)}%;border-radius:4px;"></div></div></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function renderPorLocal(locales) {
  const el = $id('dash-por-local');
  if (!el) return;
  if (!locales.length) { el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px;">Sin sucursales</div>'; return; }
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;min-width:500px;">
    <thead><tr style="color:var(--text3);">
      <th style="text-align:left;padding:8px 10px;font-weight:600;">Sucursal</th>
      <th style="text-align:right;padding:8px 10px;font-weight:600;">Activos</th>
      <th style="text-align:right;padding:8px 10px;font-weight:600;">Servicios total</th>
      <th style="text-align:right;padding:8px 10px;font-weight:600;">Ventas este mes</th>
      <th style="text-align:right;padding:8px 10px;font-weight:600;">Ingresos ventas</th>
    </tr></thead>
    <tbody>${locales.map(l => `
      <tr style="border-top:1px solid var(--border);cursor:pointer;" onclick="filterDashByLocal(${l.id})">
        <td style="padding:9px 10px;font-weight:600;">${escHtml(l.nombre_local)}</td>
        <td style="padding:9px 10px;text-align:right;"><span style="color:var(--warning);font-weight:600;">${l.activos}</span></td>
        <td style="padding:9px 10px;text-align:right;">${l.total_servicios}</td>
        <td style="padding:9px 10px;text-align:right;">${l.ventas_mes}</td>
        <td style="padding:9px 10px;text-align:right;">${money(l.ing_ventas_mes)}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function renderPorEmpleado(empleados) {
  const el = $id('dash-por-empleado');
  if (!el) return;
  if (!empleados.length) { el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px;">Sin empleados</div>'; return; }
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;min-width:500px;">
    <thead><tr style="color:var(--text3);">
      <th style="text-align:left;padding:8px 10px;font-weight:600;">Empleado</th>
      <th style="text-align:left;padding:8px 10px;font-weight:600;">Sucursal</th>
      <th style="text-align:right;padding:8px 10px;font-weight:600;">Activos</th>
      <th style="text-align:right;padding:8px 10px;font-weight:600;">Servicios total</th>
      <th style="text-align:right;padding:8px 10px;font-weight:600;">Ventas este mes</th>
      <th style="text-align:right;padding:8px 10px;font-weight:600;">Ingresos ventas</th>
    </tr></thead>
    <tbody>${empleados.map(e => `
      <tr style="border-top:1px solid var(--border);">
        <td style="padding:9px 10px;">
          <div style="font-weight:600;">${escHtml(e.nombre)}</div>
          <div style="font-size:11px;color:var(--text3);">${escHtml(e.correo||'')}</div>
        </td>
        <td style="padding:9px 10px;color:var(--text2);">${escHtml(e.nombre_local||'—')}</td>
        <td style="padding:9px 10px;text-align:right;"><span style="color:var(--warning);font-weight:600;">${e.activos}</span></td>
        <td style="padding:9px 10px;text-align:right;">${e.total_servicios}</td>
        <td style="padding:9px 10px;text-align:right;">${e.ventas_mes}</td>
        <td style="padding:9px 10px;text-align:right;">${money(e.ing_ventas_mes)}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

// ===== REPORTS =====
async function generateReport() {
  const start = $id('rep-start').value;
  const end = $id('rep-end').value;
  const estado = $id('rep-estado').value;
  const repEmp = $id('rep-empresa')?.value;
  const repLoc = $id('rep-local')?.value;
  try {
    let url = '/servicios/reporte?';
    if (start) url += 'desde=' + start + '&';
    if (end) url += 'hasta=' + end + '&';
    if (estado) url += 'estado=' + encodeURIComponent(estado) + '&';
    if (repEmp) url += 'empresa_id=' + repEmp + '&';
    if (repLoc) url += 'local_id=' + repLoc + '&';
    tableLoading($id('rep-tbody'), 8);
    const { resumen, servicios } = await api('GET', url);

    $id('rs-income').textContent = money(resumen.ingresos_totales);
    $id('rs-expenses').textContent = money(resumen.costo_refacciones);
    $id('rs-profit').textContent = money(resumen.utilidad_neta);
    $id('rs-count').textContent = resumen.total_servicios;

    let rangeLabel = 'Todos los registros';
    if (start && end) rangeLabel = `${start} — ${end}`;
    else if (start) rangeLabel = `Desde ${start}`;
    else if (end) rangeLabel = `Hasta ${end}`;
    $id('rep-range-label').textContent = rangeLabel;

    reportSrvData = servicios;
    repSrvPage = 1;
    renderReporteSrv();
    showToast(`Reporte generado — ${servicios.length} servicios`, 'success');
    // Also load cobros section
    loadCobrosServiciosReporte();
  } catch(e) { showToast(e.message, 'error'); }
}

function renderReporteSrv() {
  const perPage = parseInt($id('rep-srv-per-page')?.value) || 25;
  const sorted = clientSort(reportSrvData, repSrvSort.f, repSrvSort.d);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (repSrvPage > totalPages) repSrvPage = totalPages;
  const slice = perPage >= 9999 ? sorted : sorted.slice((repSrvPage - 1) * perPage, repSrvPage * perPage);
  const tbody = $id('report-tbody');
  tbody.innerHTML = slice.length ? slice.map(s => {
    const utilidad = (s.costo_total||0) - (s.costo_refaccion||0);
    const utilColor = utilidad >= 0 ? 'text-success' : 'text-danger';
    return `<tr>
      <td><span class="text-accent fw-bold">${s.folio||'-'}</span></td>
      <td><div class="fw-bold">${s.cliente_nombre||'-'}</div></td>
      <td>${s.modelo||'-'}</td>
      <td><span class="status-pill" style="${getEstadoStyle(s.estado)}">${s.estado||'-'}</span></td>
      <td style="font-size:12px;">${s.fecha_entrada ? fmtDatetime(s.fecha_entrada) : '-'}</td>
      <td style="font-size:12px;">${s.fecha_salida ? fmtDatetime(s.fecha_salida) : '-'}</td>
      <td class="text-right">${money(s.anticipo)}</td>
      <td class="text-right text-danger">${money(s.costo_refaccion)}</td>
      <td class="text-right text-accent fw-bold">${money(s.costo_total)}</td>
      <td class="text-right ${utilColor} fw-bold">${money(utilidad)}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="10"><div class="empty-state"><i class="fa-solid fa-chart-bar"></i><p>Sin registros</p></div></td></tr>`;
  updateSortIcons('report-tbody', repSrvSort.f, repSrvSort.d);
  const pag = $id('rep-srv-pagination');
  if (pag) {
    pag.style.display = total > 0 ? 'flex' : 'none';
    const from = Math.min((repSrvPage - 1) * perPage + 1, total);
    const to   = Math.min(repSrvPage * perPage, total);
    const info = $id('rep-srv-page-info'); if (info) info.textContent = `${from}–${to} de ${total}`;
    const prev = $id('rep-srv-btn-prev'); if (prev) prev.disabled = repSrvPage <= 1;
    const next = $id('rep-srv-btn-next'); if (next) next.disabled = repSrvPage >= totalPages;
  }
}

function exportCSV() {
  // Export visible report table as CSV
  const rows = [];
  const headers = ['Folio','Cliente','Modelo','Estado','F.Entrada','F.Salida','Anticipo','Costo Ref.','Total','Utilidad'];
  rows.push(headers);
  $id('report-tbody').querySelectorAll('tr').forEach(tr => {
    const cells = [];
    tr.querySelectorAll('td').forEach(td => cells.push(td.textContent.trim()));
    if (cells.length) rows.push(cells);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'reporte_servicios.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exportado', 'success');
}

// ===== PROFILE =====
async function loadProfile() {
  try {
    const p = await api('GET', '/auth/profile');
    $id('prof-nombre').value = p.nombre || '';
    $id('prof-correo').value = p.correo || '';
    $id('prof-telefono').value = p.telefono || '';
    $id('prof-empresa').value = p.empresa_nombre || '';
    $id('prof-empresa').readOnly = true;
    $id('prof-empresa').style.opacity = '0.6';

    // Local selector: admin/root get dropdown, empleado gets read-only
    const isAdminOrRoot = p.tipo === 'admin' || p.tipo === 'root';
    if (isAdminOrRoot) {
      $id('prof-local').style.display = 'none';
      $id('prof-local-select').style.display = '';
      $id('prof-local-hint').style.display = '';
      // Populate locales dropdown
      try {
        const locales = await api('GET', '/locales');
        const sel = $id('prof-local-select');
        sel.innerHTML = '<option value="">-- Selecciona un local --</option>';
        (locales.data || locales).forEach(l => {
          sel.innerHTML += `<option value="${l.id}" ${l.id === p.local_id ? 'selected' : ''}>${l.nombre_local} — ${l.ciudad || ''}</option>`;
        });
      } catch(e) { /* fallback */ }
    } else {
      $id('prof-local').style.display = '';
      $id('prof-local').value = p.local_nombre || '';
      $id('prof-local').readOnly = true;
      $id('prof-local').style.opacity = '0.6';
      $id('prof-local-select').style.display = 'none';
      $id('prof-local-hint').style.display = 'none';
    }

    // Update display
    currentUserData = { ...currentUserData, nombre: p.nombre, correo: p.correo, telefono: p.telefono, foto: p.foto, tipo: p.tipo, empresa_nombre: p.empresa_nombre, local_nombre: p.local_nombre, local_id: p.local_id, empresa_id: p.empresa_id };
    localStorage.setItem('ts_user', JSON.stringify(currentUserData));
    updateProfileUI();
  } catch(e) { showToast(e.message, 'error'); }
}

async function onSwitchLocal(localId) {
  if (!localId) return;
  try {
    const res = await api('PUT', '/auth/switch-local', { local_id: Number(localId) });
    // Update token
    token = res.token;
    localStorage.setItem('ts_token', token);
    // Update user data
    currentUserData.local_id = res.local_id;
    currentUserData.local_nombre = res.local_nombre;
    if (res.empresa_id) currentUserData.empresa_id = res.empresa_id;
    if (res.empresa_nombre) currentUserData.empresa_nombre = res.empresa_nombre;
    localStorage.setItem('ts_user', JSON.stringify(currentUserData));
    updateProfileUI();
    showToast('Local activo cambiado a: ' + res.local_nombre, 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

function updateProfileUI() {
  if (!currentUserData) return;
  const p = currentUserData;
  const nombre = p.nombre || 'Usuario';
  const inicial = nombre.charAt(0).toUpperCase();
  const tipoLabels = { root: 'Desarrollador', admin: 'Administrador', empleado: 'Empleado' };

  if (p.foto) {
    const imgHTML = `<img src="${p.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    $id('user-av').innerHTML = imgHTML;
    $id('topbar-av').innerHTML = `<img src="${p.foto}" style="width:38px;height:38px;object-fit:cover;border-radius:8px;">`;
    $id('profile-avatar-display').innerHTML = `<img src="${p.foto}" style="width:100%;height:100%;object-fit:cover;">`;
  } else {
    $id('user-av').textContent = inicial;
    $id('topbar-av').textContent = inicial;
    $id('profile-avatar-display').textContent = inicial;
  }

  $id('user-name-display').textContent = nombre;
  $id('user-role-display').textContent = tipoLabels[p.tipo] || p.tipo;
  $id('profile-display-name').textContent = nombre;
  $id('profile-display-role').textContent = tipoLabels[p.tipo] || p.tipo;
  $id('profile-display-correo').textContent = p.correo || '—';
  $id('profile-display-tel').textContent = p.telefono || '—';
  if (p.local_nombre) {
    $id('profile-display-local').textContent = p.local_nombre;
    $id('profile-display-local').style.color = 'var(--text2)';
  } else {
    $id('profile-display-local').textContent = 'Sin local asignado';
    $id('profile-display-local').style.color = 'var(--danger)';
  }
  $id('profile-display-empresa').textContent = p.empresa_nombre || '—';
}

async function saveProfile() {
  try {
    await api('PUT', '/auth/profile', {
      nombre: $id('prof-nombre').value.trim() || 'Usuario',
      correo: $id('prof-correo').value.trim(),
      telefono: $id('prof-telefono').value.trim() || null,
      foto: currentUserData?.foto || null,
    });
    currentUserData.nombre = $id('prof-nombre').value.trim();
    currentUserData.correo = $id('prof-correo').value.trim();
    currentUserData.telefono = $id('prof-telefono').value.trim();
    localStorage.setItem('ts_user', JSON.stringify(currentUserData));
    updateProfileUI();
    showToast('Perfil actualizado correctamente', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

function updateProfilePhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        await api('PUT', '/auth/profile', {
          nombre: currentUserData.nombre,
          correo: currentUserData.correo,
          telefono: currentUserData.telefono || null,
          foto: e.target.result,
        });
        currentUserData.foto = e.target.result;
        localStorage.setItem('ts_user', JSON.stringify(currentUserData));
        updateProfileUI();
        showToast('Foto de perfil actualizada', 'success');
      } catch(err) { showToast(err.message, 'error'); }
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function changePassword() {
  const actual = $id('prof-pass-actual').value;
  const nueva = $id('prof-pass-nueva').value;
  const confirm = $id('prof-pass-confirm').value;
  if (!actual) { showToast('Ingresa la contraseña actual', 'error'); return; }
  if (nueva.length < 4) { showToast('La nueva contraseña debe tener al menos 4 caracteres', 'error'); return; }
  if (nueva !== confirm) { showToast('Las contraseñas no coinciden', 'error'); return; }
  try {
    await api('PUT', '/auth/change-password', { contrasena_actual: actual, contrasena_nueva: nueva });
    clearPassFields();
    showToast('Contraseña actualizada correctamente', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

function clearPassFields() {
  ['prof-pass-actual','prof-pass-nueva','prof-pass-confirm'].forEach(id => { $id(id).value = ''; $id(id).type = 'password'; });
  ['eye-actual','eye-nueva','eye-confirm'].forEach(id => $id(id).className = 'fa-solid fa-eye');
  $id('pass-strength-bar').style.display = 'none';
}

function toggleFieldPass(fieldId, eyeId) {
  const inp = $id(fieldId); const icon = $id(eyeId);
  if (inp.type === 'password') { inp.type = 'text'; icon.className = 'fa-solid fa-eye-slash'; }
  else { inp.type = 'password'; icon.className = 'fa-solid fa-eye'; }
}

function checkPassStrength(val) {
  const bar = $id('pass-strength-bar'); const label = $id('ps-label');
  if (!val) { bar.style.display = 'none'; return; }
  bar.style.display = 'block';
  let score = 0;
  if (val.length >= 6) score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const colors = ['var(--danger)','#ff9f43','var(--accent)','var(--success)'];
  const labels = ['Muy débil','Débil','Buena','Muy segura'];
  [1,2,3,4].forEach(i => $id('ps'+i).style.background = i <= score+1 ? colors[score] : 'var(--border)');
  label.textContent = labels[score]; label.style.color = colors[score];
}

// ===== EMPRESAS CRUD =====
async function loadEmpresas() {
  try {
    tableLoading($id('empresas-tbody'), 8);
    EMPRESAS_PER_PAGE = parseInt($id('emp-per-page')?.value) || EMPRESAS_PER_PAGE;
    updateSortIcons('empresas-tbody', empSort.f, empSort.d);
    const res = await api('GET', `/empresas?page=${empresasPage}&limit=${EMPRESAS_PER_PAGE}&sort=${empSort.f}_${empSort.d}`);
    const empresas = res.data || [];
    const total = res.total ?? empresas.length;
    const isRoot = currentUserData?.tipo === 'root';
    const btnCreate = $id('btn-nueva-empresa');
    if (btnCreate) btnCreate.style.display = isRoot ? '' : 'none';

    const infoEl = $id('empresas-table-info');
    if (infoEl) infoEl.textContent = `${total} ${total !== 1 ? t('table.registros') : t('table.registro')}`;

    const tbody = $id('empresas-tbody');
    if (!empresas.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-building"></i><p>Sin empresas registradas</p></div></td></tr>';
    } else {
      tbody.innerHTML = empresas.map(e => `
        <tr>
          <td class="col-priority-1"><div class="td-name">${e.nombre}${e.sandbox ? ' <span style="font-size:9px;padding:1px 6px;border-radius:3px;background:rgba(240,165,0,0.12);color:var(--accent);font-weight:600;vertical-align:middle;margin-left:6px;">SANDBOX</span>' : ''}</div></td>
          <td class="col-priority-2">${e.iniciales}</td>
          <td class="col-priority-2">${e.rfc || '-'}</td>
          <td class="col-priority-3">${e.ciudad || '-'}</td>
          <td class="col-priority-3">${e.nombre_encargado || '-'}</td>
          <td class="col-priority-4"><span class="badge">${e.locales_count || 0}</span></td>
          <td class="col-priority-1"><span class="status-pill ${e.estatus === 'activo' ? 'sp-done' : 'sp-cancelled'}">${e.estatus}</span></td>
          <td class="col-priority-1">
            <div class="td-actions">
              <button class="act-btn edit" onclick="openEmpresaModal(${e.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>
              ${isRoot ? `<button class="act-btn del" onclick="askDeleteEmpresa(${e.id})" title="Desactivar"><i class="fa-solid fa-ban"></i></button>` : ''}
            </div>
          </td>
        </tr>
      `).join('');
    }
    // Pagination — usa renderPagination() reducida con elipsis
    const pages = Math.ceil(total / EMPRESAS_PER_PAGE) || 1;
    renderPagination($id('empresas-pag-btns'), empresasPage, pages, p => { empresasPage = p; loadEmpresas(); });
  } catch(e) { showToast(e.message, 'error'); }
}

async function openEmpresaModal(id = null) {
  editingEmpresaId = id;
  $id('empresa-modal-title').textContent = id ? 'Editar Empresa' : 'Nueva Empresa';
  $id('btn-save-empresa-label').textContent = id ? 'Actualizar empresa' : 'Guardar empresa';
  ['fe-nombre','fe-iniciales','fe-rfc','fe-telefono','fe-correo','fe-encargado','fe-calle','fe-cp','fe-ciudad','fe-estado-rep','fe-cobro'].forEach(f => $id(f).value = '');
  $id('fe-tipo-empresa').value = 'servicio';
  $id('fe-logo-preview').style.display = 'none';
  $id('fe-logo-name').textContent = '';
  $id('fe-logo-input').value = '';
  if (id) {
    try {
      const e = await api('GET', '/empresas/' + id);
      $id('fe-nombre').value = e.nombre || '';
      $id('fe-iniciales').value = e.iniciales || '';
      $id('fe-rfc').value = e.rfc || '';
      $id('fe-telefono').value = e.telefono || '';
      $id('fe-correo').value = e.correo || '';
      $id('fe-encargado').value = e.nombre_encargado || '';
      $id('fe-calle').value = e.calle || '';
      $id('fe-cp').value = e.cp || '';
      $id('fe-ciudad').value = e.ciudad || '';
      $id('fe-estado-rep').value = e.estado_rep || '';
      $id('fe-tipo-empresa').value = e.tipo_empresa || 'servicio';
      $id('fe-cobro').value = e.cobro || '';
      if (e.logo) {
        $id('fe-logo-preview').src = e.logo;
        $id('fe-logo-preview').style.display = '';
        $id('fe-logo-name').textContent = 'Logo actual';
      }
    } catch(er) { showToast(er.message, 'error'); return; }
  }
  $id('empresa-modal').classList.add('open');
}

function closeEmpresaModal() { $id('empresa-modal').classList.remove('open'); editingEmpresaId = null; }

async function saveEmpresa() {
  const nombre = $id('fe-nombre').value.trim();
  const iniciales = $id('fe-iniciales').value.trim();
  if (!nombre || !iniciales) { showToast('Nombre e iniciales son requeridos', 'error'); return; }
  const body = {
    nombre, iniciales,
    rfc: $id('fe-rfc').value.trim() || null,
    telefono: $id('fe-telefono').value.trim() || null,
    correo: $id('fe-correo').value.trim() || null,
    nombre_encargado: $id('fe-encargado').value.trim() || null,
    calle: $id('fe-calle').value.trim() || null,
    cp: $id('fe-cp').value.trim() || null,
    ciudad: $id('fe-ciudad').value.trim() || null,
    estado_rep: $id('fe-estado-rep').value.trim() || null,
    tipo_empresa: $id('fe-tipo-empresa').value,
    cobro: parseFloat($id('fe-cobro').value) || 0,
  };
  const saveBtn = document.querySelector('#empresa-modal .btn-accent');
  btnLoading(saveBtn, true);
  try {
    let empId;
    if (editingEmpresaId) {
      await api('PUT', '/empresas/' + editingEmpresaId, body);
      empId = editingEmpresaId;
      showToast('Empresa actualizada', 'success');
    } else {
      const newEmp = await api('POST', '/empresas', body);
      empId = newEmp.id;
      showToast('Empresa creada', 'success');
    }
    // Upload logo if file selected
    if ($id('fe-logo-input').files && $id('fe-logo-input').files[0]) {
      await uploadEmpresaLogoAfterSave(empId);
    }
    closeEmpresaModal();
    loadEmpresas();
  } catch(e) { showToast(e.message, 'error'); }
  finally { btnLoading(saveBtn, false); }
}

async function askDeleteEmpresa(id) {
  if (!confirm('¿Desea desactivar esta empresa?')) return;
  try {
    await api('DELETE', '/empresas/' + id);
    showToast('Empresa desactivada', 'info');
    loadEmpresas();
  } catch(e) { showToast(e.message, 'error'); }
}

// ===== LOCALES CRUD =====
async function loadLocales() {
  try {
    const isRoot = currentUserData?.tipo === 'root';
    LOCALES_PER_PAGE = parseInt($id('loc-per-page')?.value) || LOCALES_PER_PAGE;
    updateSortIcons('locales-tbody', locSort.f, locSort.d);
    const params = [`page=${localesPage}`, `limit=${LOCALES_PER_PAGE}`, `sort=${locSort.f}_${locSort.d}`];
    const filterSel = $id('filter-empresa-locales');

    if (isRoot) {
      filterSel.style.display = '';
      if (filterSel.options.length <= 1) {
        if (allEmpresas.length === 0) { try { allEmpresas = (await api('GET', '/empresas?limit=1000')).data || []; } catch(e) {} }
        allEmpresas.forEach(e => {
          const opt = document.createElement('option');
          opt.value = e.id; opt.textContent = e.nombre;
          filterSel.appendChild(opt);
        });
      }
      const filterVal = filterSel.value;
      if (filterVal) params.push('empresa_id=' + filterVal);
    } else {
      filterSel.style.display = 'none';
    }

    tableLoading($id('locales-tbody'), 8);
    const res = await api('GET', '/locales?' + params.join('&'));
    const locales = res.data || [];
    const total = res.total ?? locales.length;
    const canEdit = hasPermiso('locales', 'editar');
    const canDelete = hasPermiso('locales', 'borrar');

    const infoEl = $id('locales-table-info');
    if (infoEl) infoEl.textContent = `${total} ${total !== 1 ? t('table.registros') : t('table.registro')}`;

    const tbody = $id('locales-tbody');
    if (!locales.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-store"></i><p>Sin locales registrados</p></div></td></tr>';
    } else {
      tbody.innerHTML = locales.map(l => `
        <tr>
          <td class="col-priority-1"><div class="td-name">${l.nombre_local}</div></td>
          <td class="col-priority-4">${l.empresa_nombre || '-'}</td>
          <td class="col-priority-4">${l.ciudad || '-'}</td>
          <td class="col-priority-2">${l.telefono || '-'}</td>
          <td class="col-priority-3">${l.gerente_encargado || '-'}</td>
          <td class="col-priority-4"><span class="badge">${l.usuarios_count || 0}</span></td>
          <td class="col-priority-1"><span class="status-pill ${l.estatus === 'A' ? 'sp-done' : 'sp-cancelled'}">${l.estatus === 'A' ? 'Activo' : 'Inactivo'}</span></td>
          <td class="col-priority-1">
            <div class="td-actions">
              ${canEdit ? `<button class="act-btn edit" onclick="openLocalModal(${l.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>` : ''}
              ${canDelete ? `<button class="act-btn del" onclick="askDeleteLocal(${l.id})" title="Desactivar"><i class="fa-solid fa-ban"></i></button>` : ''}
            </div>
          </td>
        </tr>
      `).join('');
    }
    // Pagination buttons
    const pages = Math.ceil(total / LOCALES_PER_PAGE) || 1;
    const pb = $id('locales-pag-btns');
    pb.innerHTML = '';
    if (pages > 1) {
      for (let i = 1; i <= Math.min(pages, 10); i++) {
        const btn = document.createElement('button');
        btn.className = 'pag-btn' + (i === localesPage ? ' active' : '');
        btn.textContent = i;
        btn.onclick = () => { localesPage = i; loadLocales(); };
        pb.appendChild(btn);
      }
    }
  } catch(e) { showToast(e.message, 'error'); }
}

async function openLocalModal(id = null) {
  editingLocalId = id;
  $id('local-modal-title').textContent = id ? 'Editar Local' : 'Nuevo Local';
  $id('btn-save-local-label').textContent = id ? 'Actualizar local' : 'Guardar local';
  ['fl-nombre','fl-ubicacion','fl-ciudad','fl-estado','fl-telefono','fl-correo','fl-gerente','fl-fecha-apertura'].forEach(f => $id(f).value = '');
  $id('fl-logo-preview').style.display = 'none';
  $id('fl-logo-name').textContent = '';
  $id('fl-logo-input').value = '';

  const isRoot = currentUserData?.tipo === 'root';
  const empSelect = $id('fl-empresa-id');
  empSelect.innerHTML = '';

  if (isRoot) {
    if (allEmpresas.length === 0) { try { allEmpresas = (await api('GET', '/empresas?limit=1000')).data || []; } catch(e) {} }
    allEmpresas.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id; opt.textContent = e.nombre;
      empSelect.appendChild(opt);
    });
    $id('local-empresa-group').style.display = '';
  } else {
    const opt = document.createElement('option');
    opt.value = currentUserData.empresa_id;
    opt.textContent = currentUserData.empresa_nombre || 'Mi empresa';
    empSelect.appendChild(opt);
    $id('local-empresa-group').style.display = 'none';
  }

  // Check if logo_mode is 'local' to show logo upload
  try {
    const empId = isRoot ? (empSelect.value || currentUserData.empresa_id) : currentUserData.empresa_id;
    const cfg = await api('GET', '/configuracion?empresa_id=' + empId);
    $id('fl-logo-group').style.display = cfg.logo_mode === 'local' ? '' : 'none';
  } catch(e) {
    $id('fl-logo-group').style.display = 'none';
  }

  if (id) {
    try {
      const l = await api('GET', '/locales/' + id);
      empSelect.value = l.empresa_id;
      $id('fl-nombre').value = l.nombre_local || '';
      $id('fl-ubicacion').value = l.ubicacion_interna || '';
      $id('fl-ciudad').value = l.ciudad || '';
      $id('fl-estado').value = l.estado_local || '';
      $id('fl-telefono').value = l.telefono || '';
      $id('fl-correo').value = l.correo_contacto || '';
      $id('fl-gerente').value = l.gerente_encargado || '';
      $id('fl-fecha-apertura').value = l.fecha_apertura || '';
      if (l.logo) {
        $id('fl-logo-preview').src = l.logo;
        $id('fl-logo-preview').style.display = '';
        $id('fl-logo-name').textContent = 'Logo actual';
      }
    } catch(e) { showToast(e.message, 'error'); return; }
  }
  $id('local-modal').classList.add('open');
}

function closeLocalModal() { $id('local-modal').classList.remove('open'); editingLocalId = null; }

async function saveLocal() {
  const nombre_local = $id('fl-nombre').value.trim();
  if (!nombre_local) { showToast('El nombre del local es requerido', 'error'); return; }
  const body = {
    nombre_local,
    empresa_id: parseInt($id('fl-empresa-id').value),
    ubicacion_interna: $id('fl-ubicacion').value.trim() || null,
    ciudad: $id('fl-ciudad').value.trim() || null,
    estado_local: $id('fl-estado').value.trim() || null,
    telefono: $id('fl-telefono').value.trim() || null,
    correo_contacto: $id('fl-correo').value.trim() || null,
    gerente_encargado: $id('fl-gerente').value.trim() || null,
    fecha_apertura: $id('fl-fecha-apertura').value || null,
  };
  const saveBtn = document.querySelector('#local-modal .btn-accent');
  btnLoading(saveBtn, true);
  try {
    let localId;
    if (editingLocalId) {
      await api('PUT', '/locales/' + editingLocalId, body);
      localId = editingLocalId;
      showToast('Local actualizado', 'success');
    } else {
      const newLocal = await api('POST', '/locales', body);
      localId = newLocal.id;
      showToast('Local creado', 'success');
    }
    // Upload logo if file selected
    if ($id('fl-logo-input').files && $id('fl-logo-input').files[0]) {
      await uploadLocalLogoAfterSave(localId);
    }
    closeLocalModal();
    loadLocales();
  } catch(e) { showToast(e.message, 'error'); }
  finally { btnLoading(saveBtn, false); }
}

async function askDeleteLocal(id) {
  if (!confirm('¿Desea desactivar este local?')) return;
  try {
    await api('DELETE', '/locales/' + id);
    showToast('Local desactivado', 'info');
    loadLocales();
  } catch(e) { showToast(e.message, 'error'); }
}

function updatePermisoRowState(checkbox) {
  const mod = checkbox.dataset.mod;
  const row = $id('permisos-tbody').querySelector(`tr[data-modulo="${mod}"]`);
  if (!row) return;
  const any = Array.from(row.querySelectorAll('input[type="checkbox"]')).some(cb => cb.checked);
  const eye = $id('eye-' + mod);
  if (eye) eye.style.color = any ? 'var(--accent3)' : 'var(--text3)';
  row.style.opacity = any ? '1' : '0.5';
}

function clearPermisoRow(mod) {
  const row = $id('permisos-tbody').querySelector(`tr[data-modulo="${mod}"]`);
  if (!row) return;
  row.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  const eye = $id('eye-' + mod);
  if (eye) eye.style.color = 'var(--text3)';
  row.style.opacity = '0.5';
}

function clearAllPermisos() {
  $id('permisos-tbody').querySelectorAll('tr[data-modulo]').forEach(row => {
    row.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    const mod = row.dataset.modulo;
    const eye = $id('eye-' + mod);
    if (eye) eye.style.color = 'var(--text3)';
    row.style.opacity = '0.5';
  });
}

async function savePermisos() {
  const permisoMap = {};
  $id('permisos-tbody').querySelectorAll('input[type="checkbox"]').forEach(ch => {
    const mod = ch.dataset.mod; const acc = ch.dataset.acc;
    if (!permisoMap[mod]) permisoMap[mod] = { modulo: mod, ver: 0, crear: 0, editar: 0, borrar: 0, scope: 'empresa' };
    permisoMap[mod][acc] = ch.checked ? 1 : 0;
  });
  $id('permisos-tbody').querySelectorAll('select[data-scope-mod]').forEach(sel => {
    const mod = sel.dataset.scopeMod;
    if (permisoMap[mod]) permisoMap[mod].scope = sel.value || 'empresa';
  });
  try {
    await api('PUT', '/personas/' + permisosUserId + '/permisos', { permisos: Object.values(permisoMap) });
    if (permisosUserId === currentUserData?.id) {
      userPermisos = {};
      Object.values(permisoMap).forEach(p => {
        userPermisos[p.modulo] = { ver: p.ver, crear: p.crear, editar: p.editar, borrar: p.borrar };
      });
      localStorage.setItem('ts_permisos', JSON.stringify(userPermisos));
      applyPermisos();
    }
    closePermisosModal();
    showToast('Permisos actualizados', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

// ===== TOAST =====
function showToast(msg, type = 'info') {
  const icons = { success:'fa-circle-check', error:'fa-circle-xmark', info:'fa-circle-info' };
  const tc = $id('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fa-solid ${icons[type]||icons.info}"></i><span>${msg}</span>`;
  tc.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ===== CONFIGURACIÓN =====
currentConfig = null;
// waConfig is declared at the top of the file (near line 1523)
activeConfigTab = 'general';

function switchConfigTab(tab) { /* legacy no-op — now using accordion */ }

CFG_SECTIONS = ['general','ticket-venta','ticket-servicio','plantillas','etiquetas','wa','notificaciones','roles','estados','tipos-productos','conceptos-cobro','auditoria'];

function cfgToggle(id) {
  const target  = $id('cfg-collapse-' + id);
  if (!target) return;
  const wasOpen = target.classList.contains('open');
  // Close all
  CFG_SECTIONS.forEach(s => $id('cfg-collapse-' + s)?.classList.remove('open'));
  // Re-open if it was closed
  if (!wasOpen) {
    target.classList.add('open');
    if (id === 'wa') loadWaForScope();
  }
}

async function loadConfiguracion() {
  const isRoot  = currentUserData?.tipo === 'root';
  const isAdmin = currentUserData?.tipo === 'admin';
  const filterDiv = $id('config-empresa-filter');

  if (isRoot) {
    filterDiv.style.display = '';
    const sel = $id('config-empresa-select');
    if (sel.options.length === 0) {
      if (allEmpresas.length === 0) { try { allEmpresas = (await api('GET', '/empresas?limit=1000')).data || []; } catch(e) {} }
      allEmpresas.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id; opt.textContent = e.nombre;
        sel.appendChild(opt);
      });
    }
  } else {
    filterDiv.style.display = 'none';
  }

  try {
    const empresaId = isRoot ? ($id('config-empresa-select').value || '') : '';
    const url = empresaId ? '/configuracion?empresa_id=' + empresaId : '/configuracion';
    currentConfig = await api('GET', url);

    // Fill form
    $id('cfg-logo-mode').value = currentConfig.logo_mode || 'empresa';
    $id('cfg-ticket-titulo').value = currentConfig.ticket_titulo || 'TICKET DE SERVICIO';
    $id('cfg-mostrar-logo').checked = !!currentConfig.ticket_mostrar_logo;
    $id('cfg-mostrar-telefono').checked = !!currentConfig.ticket_mostrar_telefono;
    $id('cfg-mostrar-direccion').checked = !!currentConfig.ticket_mostrar_direccion;
    $id('cfg-mostrar-firma-cliente').checked = !!currentConfig.ticket_mostrar_firma_cliente;
    $id('cfg-mostrar-firma-tecnico').checked = !!currentConfig.ticket_mostrar_firma_tecnico;
    $id('cfg-mostrar-gracias').checked = !!currentConfig.ticket_mostrar_gracias;
    $id('cfg-politica-garantia').value = currentConfig.ticket_politica_garantia || '';
    $id('cfg-politica-revision').value = currentConfig.ticket_politica_revision || '';
    $id('cfg-texto-extra').value = currentConfig.ticket_texto_extra || '';

    // Toggles granulares de datos del ticket de servicio (default: visible)
    const _ckTk = (id, val) => { const el = $id(id); if (el) el.checked = (val === undefined || val === null) ? true : !!val; };
    _ckTk('cfg-mostrar-folio',            currentConfig.ticket_mostrar_folio);
    _ckTk('cfg-mostrar-cliente-nombre',   currentConfig.ticket_mostrar_cliente_nombre);
    _ckTk('cfg-mostrar-cliente-telefono', currentConfig.ticket_mostrar_cliente_telefono);
    _ckTk('cfg-mostrar-dispositivo',      currentConfig.ticket_mostrar_dispositivo);
    _ckTk('cfg-mostrar-num-serie',        currentConfig.ticket_mostrar_num_serie);
    _ckTk('cfg-mostrar-falla',            currentConfig.ticket_mostrar_falla);
    _ckTk('cfg-mostrar-observaciones',    currentConfig.ticket_mostrar_observaciones);
    _ckTk('cfg-mostrar-estado',           currentConfig.ticket_mostrar_estado);
    _ckTk('cfg-mostrar-garantia',         currentConfig.ticket_mostrar_garantia);
    _ckTk('cfg-mostrar-fecha-entrada',    currentConfig.ticket_mostrar_fecha_entrada);
    _ckTk('cfg-mostrar-fecha-salida',     currentConfig.ticket_mostrar_fecha_salida);
    _ckTk('cfg-mostrar-anticipo',         currentConfig.ticket_mostrar_anticipo);
    _ckTk('cfg-mostrar-refacciones',      currentConfig.ticket_mostrar_refacciones);
    _ckTk('cfg-mostrar-costo-total',      currentConfig.ticket_mostrar_costo_total);
    _ckTk('cfg-mostrar-restante',         currentConfig.ticket_mostrar_restante);
    _ckTk('cfg-mostrar-ubicacion',        currentConfig.ticket_mostrar_ubicacion);
    _ckTk('cfg-mostrar-fecha-emision',    currentConfig.ticket_mostrar_fecha_emision);

    // Imagen extra del ticket
    const imgExtra = currentConfig.ticket_imagen_extra || '';
    const imgPrev  = $id('cfg-imagen-extra-preview');
    const imgEmpty = $id('cfg-imagen-extra-empty-icon');
    const imgRem   = $id('cfg-imagen-extra-remove');
    if (imgExtra && imgPrev) {
      imgPrev.src = imgExtra;
      imgPrev.style.display = '';
      if (imgEmpty) imgEmpty.style.display = 'none';
      if (imgRem) imgRem.style.display = '';
    } else if (imgPrev) {
      imgPrev.src = '';
      imgPrev.style.display = 'none';
      if (imgEmpty) imgEmpty.style.display = '';
      if (imgRem) imgRem.style.display = 'none';
    }
    const sizeVal = currentConfig.ticket_imagen_extra_size || 60;
    if ($id('cfg-imagen-extra-size')) $id('cfg-imagen-extra-size').value = sizeVal;
    if ($id('cfg-imagen-extra-size-val')) $id('cfg-imagen-extra-size-val').textContent = sizeVal + '%';
    if ($id('cfg-imagen-extra-pos'))  $id('cfg-imagen-extra-pos').value = currentConfig.ticket_imagen_extra_pos || 'final';

    // Load empresa logo preview
    const empId = isRoot ? ($id('config-empresa-select').value || currentUserData.empresa_id) : currentUserData.empresa_id;
    try {
      const emp = await api('GET', '/empresas/' + empId);
      if (emp.logo) {
        $id('cfg-logo-empresa-preview').src = emp.logo;
        $id('cfg-logo-empresa-preview').style.display = '';
        $id('cfg-logo-empresa-placeholder').style.display = 'none';
      } else {
        $id('cfg-logo-empresa-preview').style.display = 'none';
        $id('cfg-logo-empresa-placeholder').style.display = 'flex';
      }
    } catch(e) {}

    // Label config
    $id('cfg-etiqueta-nombre').checked = currentConfig.etiqueta_mostrar_nombre !== 0;
    $id('cfg-etiqueta-codigo').checked = currentConfig.etiqueta_mostrar_codigo !== 0;
    $id('cfg-etiqueta-precio').checked = currentConfig.etiqueta_mostrar_precio !== 0;
    $id('cfg-etiqueta-qr').checked = currentConfig.etiqueta_mostrar_qr !== 0;
    $id('cfg-etiqueta-ancho').value = currentConfig.etiqueta_ancho || 40;
    $id('cfg-etiqueta-alto').value = currentConfig.etiqueta_alto || 30;

    // Corte config
    const corteAutoEl = $id('cfg-corte-automatico');
    if (corteAutoEl) {
      corteAutoEl.checked = !!currentConfig.corte_automatico;
      onCorteAutomaticoChange();
    }
    const corteHoraEl = $id('cfg-corte-hora');
    if (corteHoraEl) corteHoraEl.value = currentConfig.corte_hora || '22:00';

    // Ticket venta config
    const tvLogo = $id('cfg-tv-logo'); if (tvLogo) tvLogo.checked = currentConfig.ticket_venta_mostrar_logo !== 0;
    const tvEmp  = $id('cfg-tv-empresa'); if (tvEmp) tvEmp.checked = currentConfig.ticket_venta_mostrar_empresa !== 0;
    const tvFol  = $id('cfg-tv-folio'); if (tvFol) tvFol.checked = currentConfig.ticket_venta_mostrar_folio !== 0;
    const tvFec  = $id('cfg-tv-fecha'); if (tvFec) tvFec.checked = currentConfig.ticket_venta_mostrar_fecha !== 0;
    const tvCli  = $id('cfg-tv-cliente'); if (tvCli) tvCli.checked = !!currentConfig.ticket_venta_mostrar_cliente;
    const tvIte  = $id('cfg-tv-items'); if (tvIte) tvIte.checked = currentConfig.ticket_venta_mostrar_items !== 0;
    const tvMet  = $id('cfg-tv-metodo'); if (tvMet) tvMet.checked = currentConfig.ticket_venta_mostrar_metodo !== 0;
    const tvFoot = $id('cfg-tv-footer'); if (tvFoot) tvFoot.value = currentConfig.ticket_venta_footer ?? 'Gracias por su compra';

    // WA Notifications config — init scope selector (renders form async)
    try {
      waConfig = currentConfig.wa_config ? JSON.parse(currentConfig.wa_config) : null;
    } catch(e) { waConfig = null; }
    renderWaConfigForm();
    initWaScopeSelector();

    // Notifications config
    try {
      const notifCfg = currentConfig.notificaciones_config ? JSON.parse(currentConfig.notificaciones_config) : null;
      loadNotificacionesConfig(notifCfg);
    } catch(e) { loadNotificacionesConfig(null); }

    onLogoModeChange();
    loadPlantillas();
  } catch(e) { showToast(e.message, 'error'); }
}

function onLogoModeChange() {
  const mode = $id('cfg-logo-mode').value;
  // Show/hide local logo upload in local modal
  // This will be checked when opening local modal
}

// ── Imagen extra del ticket (carga local como base64; se persiste en BD) ──
function onCfgImagenExtraChange(input) {
  const file = input?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('El archivo debe ser una imagen', 'error');
    return;
  }
  // Limitar tamaño aprox para no saturar la BD/SQLite
  if (file.size > 1.5 * 1024 * 1024) {
    showToast('Imagen muy pesada (máx 1.5MB). Compárala antes de subir.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    const prev = $id('cfg-imagen-extra-preview');
    const empty = $id('cfg-imagen-extra-empty-icon');
    const rem = $id('cfg-imagen-extra-remove');
    prev.src = dataUrl;
    prev.style.display = '';
    if (empty) empty.style.display = 'none';
    if (rem) rem.style.display = '';
    showToast('Imagen lista. Recuerda guardar la configuración.', 'info');
  };
  reader.readAsDataURL(file);
  input.value = ''; // reset para permitir volver a subir el mismo archivo si se quita
}

function cfgRemoveImagenExtra() {
  if (!confirm('¿Quitar la imagen extra del ticket?')) return;
  const prev = $id('cfg-imagen-extra-preview');
  const empty = $id('cfg-imagen-extra-empty-icon');
  const rem = $id('cfg-imagen-extra-remove');
  prev.src = '';
  prev.style.display = 'none';
  if (empty) empty.style.display = '';
  if (rem) rem.style.display = 'none';
  showToast('Imagen marcada para quitar. Guarda la configuración para aplicar.', 'info');
}

function onCorteAutomaticoChange() {
  const auto = $id('cfg-corte-automatico')?.checked;
  const grupo = $id('cfg-corte-hora-group');
  if (grupo) grupo.style.display = auto ? '' : 'none';
}

async function saveConfiguracion() {
  const isRoot = currentUserData?.tipo === 'root';
  const body = {
    logo_mode: $id('cfg-logo-mode').value,
    ticket_titulo: $id('cfg-ticket-titulo').value.trim() || 'TICKET DE SERVICIO',
    ticket_mostrar_logo: $id('cfg-mostrar-logo').checked ? 1 : 0,
    ticket_mostrar_telefono: $id('cfg-mostrar-telefono').checked ? 1 : 0,
    ticket_mostrar_direccion: $id('cfg-mostrar-direccion').checked ? 1 : 0,
    ticket_mostrar_firma_cliente: $id('cfg-mostrar-firma-cliente').checked ? 1 : 0,
    ticket_mostrar_firma_tecnico: $id('cfg-mostrar-firma-tecnico').checked ? 1 : 0,
    ticket_mostrar_gracias: $id('cfg-mostrar-gracias').checked ? 1 : 0,
    ticket_politica_garantia: $id('cfg-politica-garantia').value.trim() || null,
    ticket_politica_revision: $id('cfg-politica-revision').value.trim() || null,
    ticket_texto_extra: $id('cfg-texto-extra').value.trim() || null,
    etiqueta_mostrar_nombre: $id('cfg-etiqueta-nombre').checked ? 1 : 0,
    etiqueta_mostrar_codigo: $id('cfg-etiqueta-codigo').checked ? 1 : 0,
    etiqueta_mostrar_precio: $id('cfg-etiqueta-precio').checked ? 1 : 0,
    etiqueta_mostrar_qr: $id('cfg-etiqueta-qr').checked ? 1 : 0,
    etiqueta_ancho: parseInt($id('cfg-etiqueta-ancho').value) || 40,
    etiqueta_alto: parseInt($id('cfg-etiqueta-alto').value) || 30,
    corte_automatico: $id('cfg-corte-automatico')?.checked ? 1 : 0,
    corte_hora: $id('cfg-corte-hora')?.value || '22:00',
    ticket_venta_mostrar_logo:    $id('cfg-tv-logo')?.checked    ? 1 : 0,
    ticket_venta_mostrar_empresa: $id('cfg-tv-empresa')?.checked ? 1 : 0,
    ticket_venta_mostrar_folio:   $id('cfg-tv-folio')?.checked   ? 1 : 0,
    ticket_venta_mostrar_fecha:   $id('cfg-tv-fecha')?.checked   ? 1 : 0,
    ticket_venta_mostrar_cliente: $id('cfg-tv-cliente')?.checked ? 1 : 0,
    ticket_venta_mostrar_items:   $id('cfg-tv-items')?.checked   ? 1 : 0,
    ticket_venta_mostrar_metodo:  $id('cfg-tv-metodo')?.checked  ? 1 : 0,
    ticket_venta_footer:          $id('cfg-tv-footer')?.value?.trim() || 'Gracias por su compra',
    // Toggles granulares del ticket de servicio (helper: 1 si checked, 0 si no)
    ticket_mostrar_folio:            $id('cfg-mostrar-folio')?.checked            ? 1 : 0,
    ticket_mostrar_cliente_nombre:   $id('cfg-mostrar-cliente-nombre')?.checked   ? 1 : 0,
    ticket_mostrar_cliente_telefono: $id('cfg-mostrar-cliente-telefono')?.checked ? 1 : 0,
    ticket_mostrar_dispositivo:      $id('cfg-mostrar-dispositivo')?.checked      ? 1 : 0,
    ticket_mostrar_num_serie:        $id('cfg-mostrar-num-serie')?.checked        ? 1 : 0,
    ticket_mostrar_falla:            $id('cfg-mostrar-falla')?.checked            ? 1 : 0,
    ticket_mostrar_observaciones:    $id('cfg-mostrar-observaciones')?.checked    ? 1 : 0,
    ticket_mostrar_estado:           $id('cfg-mostrar-estado')?.checked           ? 1 : 0,
    ticket_mostrar_garantia:         $id('cfg-mostrar-garantia')?.checked         ? 1 : 0,
    ticket_mostrar_fecha_entrada:    $id('cfg-mostrar-fecha-entrada')?.checked    ? 1 : 0,
    ticket_mostrar_fecha_salida:     $id('cfg-mostrar-fecha-salida')?.checked     ? 1 : 0,
    ticket_mostrar_anticipo:         $id('cfg-mostrar-anticipo')?.checked         ? 1 : 0,
    ticket_mostrar_refacciones:      $id('cfg-mostrar-refacciones')?.checked      ? 1 : 0,
    ticket_mostrar_costo_total:      $id('cfg-mostrar-costo-total')?.checked      ? 1 : 0,
    ticket_mostrar_restante:         $id('cfg-mostrar-restante')?.checked         ? 1 : 0,
    ticket_mostrar_ubicacion:        $id('cfg-mostrar-ubicacion')?.checked        ? 1 : 0,
    ticket_mostrar_fecha_emision:    $id('cfg-mostrar-fecha-emision')?.checked    ? 1 : 0,
    // Imagen extra: si el preview tiene src, lo enviamos (data URL base64 o path)
    ticket_imagen_extra:      ($id('cfg-imagen-extra-preview')?.style.display !== 'none' && $id('cfg-imagen-extra-preview')?.src) ? $id('cfg-imagen-extra-preview').src : null,
    ticket_imagen_extra_size: parseInt($id('cfg-imagen-extra-size')?.value) || 60,
    ticket_imagen_extra_pos:  $id('cfg-imagen-extra-pos')?.value || 'final',
  };
  if (isRoot) {
    body.empresa_id = parseInt($id('config-empresa-select').value) || null;
  }
  try {
    await api('PUT', '/configuracion', body);
    showToast('Configuración guardada', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

// ===== PLANTILLAS DE TICKET =====
async function loadPlantillas() {
  try {
    const isRoot = currentUserData?.tipo === 'root';
    let url = '/ticket-plantillas';
    if (isRoot) {
      const empId = $id('config-empresa-select').value;
      if (empId) url += '?empresa_id=' + empId;
    }
    plantillasData = await api('GET', url);
    renderPlantillas();
  } catch(e) { /* silent */ }
}

function renderPlantillas() {
  const sorted = clientSort(plantillasData, pltSort.f, pltSort.d);
  const table = $id('plantillas-table');
  const empty = $id('plantillas-empty');
  const tbody = $id('plantillas-tbody');
  if (!tbody) return;
  if (!sorted.length) {
    if (table) table.style.display = 'none';
    if (empty) empty.style.display = '';
    return;
  }
  if (table) table.style.display = '';
  if (empty) empty.style.display = 'none';
  tbody.innerHTML = sorted.map(p => `<tr>
    <td><strong>${p.nombre}</strong></td>
    <td style="color:var(--text2);">${p.ticket_titulo || 'TICKET DE SERVICIO'}</td>
    <td style="color:var(--text3);font-size:12px;">${p.fecha_creacion ? p.fecha_creacion.split('T')[0] : ''}</td>
    <td class="td-actions" style="text-align:center;">
      <button class="btn-icon" title="Editar" onclick="openPlantillaModal(${p.id})"><i class="fa-solid fa-pen"></i></button>
      <button class="btn-icon btn-danger" title="Eliminar" onclick="deletePlantilla(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash"></i></button>
    </td>
  </tr>`).join('');
  updateSortIcons('plantillas-tbody', pltSort.f, pltSort.d);
}

// Lista compartida de toggles del ticket (frontend ↔ backend usa los mismos nombres).
// Se usa tanto para Configuración como para Plantillas.
const TICKET_TOGGLES = [
  { key:'logo', def:1 }, { key:'telefono', def:1 }, { key:'direccion', def:0 },
  { key:'firma-cliente', def:1 }, { key:'firma-tecnico', def:1 }, { key:'gracias', def:1 },
  { key:'folio', def:1 }, { key:'cliente-nombre', def:1 }, { key:'cliente-telefono', def:1 },
  { key:'dispositivo', def:1 }, { key:'num-serie', def:1 }, { key:'falla', def:1 },
  { key:'observaciones', def:1 }, { key:'estado', def:1 }, { key:'garantia', def:1 },
  { key:'fecha-entrada', def:1 }, { key:'fecha-salida', def:1 }, { key:'anticipo', def:1 },
  { key:'refacciones', def:1 }, { key:'costo-total', def:1 }, { key:'restante', def:1 },
  { key:'ubicacion', def:1 }, { key:'fecha-emision', def:1 },
];
function dashToUnder(s) { return s.replace(/-/g, '_'); }

async function openPlantillaModal(id = null) {
  $id('plt-id').value = id || '';
  $id('plantilla-modal-title').textContent = id ? 'Editar plantilla de ticket' : 'Nueva plantilla de ticket';

  // Helper: setea checked basado en (valor BD ? coerce : default)
  const setCk = (key, val, def) => {
    const el = $id('plt-mostrar-' + key);
    if (!el) return;
    el.checked = (val === undefined || val === null) ? !!def : !!val;
  };

  if (id) {
    try {
      const p = await api('GET', '/ticket-plantillas/' + id);
      $id('plt-nombre').value = p.nombre || '';
      $id('plt-titulo').value = p.ticket_titulo || '';
      TICKET_TOGGLES.forEach(t => setCk(t.key, p['ticket_mostrar_' + dashToUnder(t.key)], t.def));
      $id('plt-politica-garantia').value = p.ticket_politica_garantia || '';
      $id('plt-politica-revision').value = p.ticket_politica_revision || '';
      $id('plt-texto-extra').value = p.ticket_texto_extra || '';

      // Imagen extra
      const img = p.ticket_imagen_extra || '';
      const prev = $id('plt-imagen-extra-preview');
      const empty = $id('plt-imagen-extra-empty-icon');
      const rem = $id('plt-imagen-extra-remove');
      if (img && prev) {
        prev.src = img; prev.style.display = '';
        if (empty) empty.style.display = 'none';
        if (rem) rem.style.display = '';
      } else if (prev) {
        prev.src = ''; prev.style.display = 'none';
        if (empty) empty.style.display = '';
        if (rem) rem.style.display = 'none';
      }
      const sz = p.ticket_imagen_extra_size || 60;
      if ($id('plt-imagen-extra-size')) $id('plt-imagen-extra-size').value = sz;
      if ($id('plt-imagen-extra-size-val')) $id('plt-imagen-extra-size-val').textContent = sz + '%';
      if ($id('plt-imagen-extra-pos')) $id('plt-imagen-extra-pos').value = p.ticket_imagen_extra_pos || 'final';
    } catch(e) { showToast(e.message, 'error'); return; }
  } else {
    $id('plt-nombre').value = '';
    $id('plt-titulo').value = '';
    TICKET_TOGGLES.forEach(t => setCk(t.key, undefined, t.def));
    $id('plt-politica-garantia').value = '';
    $id('plt-politica-revision').value = '';
    $id('plt-texto-extra').value = '';
    // Reset imagen extra
    const prev = $id('plt-imagen-extra-preview');
    const empty = $id('plt-imagen-extra-empty-icon');
    const rem = $id('plt-imagen-extra-remove');
    if (prev) { prev.src = ''; prev.style.display = 'none'; }
    if (empty) empty.style.display = '';
    if (rem) rem.style.display = 'none';
    if ($id('plt-imagen-extra-size')) $id('plt-imagen-extra-size').value = 60;
    if ($id('plt-imagen-extra-size-val')) $id('plt-imagen-extra-size-val').textContent = '60%';
    if ($id('plt-imagen-extra-pos')) $id('plt-imagen-extra-pos').value = 'final';
  }
  $id('plantilla-modal').classList.add('open');
}

function closePlantillaModal() {
  $id('plantilla-modal').classList.remove('open');
}

// Subida/quitar imagen extra de plantilla (mismo patrón que cfg)
function onPltImagenExtraChange(input) {
  const file = input?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('El archivo debe ser una imagen', 'error'); return; }
  if (file.size > 1.5 * 1024 * 1024) { showToast('Imagen muy pesada (máx 1.5MB).', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const prev = $id('plt-imagen-extra-preview');
    const empty = $id('plt-imagen-extra-empty-icon');
    const rem = $id('plt-imagen-extra-remove');
    prev.src = e.target.result; prev.style.display = '';
    if (empty) empty.style.display = 'none';
    if (rem) rem.style.display = '';
  };
  reader.readAsDataURL(file);
  input.value = '';
}
function pltRemoveImagenExtra() {
  if (!confirm('¿Quitar la imagen extra de esta plantilla?')) return;
  const prev = $id('plt-imagen-extra-preview');
  const empty = $id('plt-imagen-extra-empty-icon');
  const rem = $id('plt-imagen-extra-remove');
  prev.src = ''; prev.style.display = 'none';
  if (empty) empty.style.display = '';
  if (rem) rem.style.display = 'none';
}

async function savePlantilla() {
  const nombre = $id('plt-nombre').value.trim();
  if (!nombre) { showToast('El nombre de la plantilla es obligatorio', 'error'); return; }

  const body = {
    nombre,
    ticket_titulo: $id('plt-titulo').value.trim() || 'TICKET DE SERVICIO',
    ticket_politica_garantia: $id('plt-politica-garantia').value.trim() || null,
    ticket_politica_revision: $id('plt-politica-revision').value.trim() || null,
    ticket_texto_extra: $id('plt-texto-extra').value.trim() || null,
    // Imagen extra
    ticket_imagen_extra:      ($id('plt-imagen-extra-preview')?.style.display !== 'none' && $id('plt-imagen-extra-preview')?.src) ? $id('plt-imagen-extra-preview').src : null,
    ticket_imagen_extra_size: parseInt($id('plt-imagen-extra-size')?.value) || 60,
    ticket_imagen_extra_pos:  $id('plt-imagen-extra-pos')?.value || 'final',
  };
  // Toggles dinámicos (un solo bucle, sin duplicar 23 líneas)
  TICKET_TOGGLES.forEach(t => {
    body['ticket_mostrar_' + dashToUnder(t.key)] = $id('plt-mostrar-' + t.key)?.checked ? 1 : 0;
  });

  const isRoot = currentUserData?.tipo === 'root';
  if (isRoot) {
    body.empresa_id = parseInt($id('config-empresa-select').value) || null;
  }

  const id = $id('plt-id').value;
  try {
    if (id) {
      await api('PUT', '/ticket-plantillas/' + id, body);
      showToast('Plantilla actualizada', 'success');
    } else {
      await api('POST', '/ticket-plantillas', body);
      showToast('Plantilla creada', 'success');
    }
    closePlantillaModal();
    loadPlantillas();
  } catch(e) { showToast(e.message, 'error'); }
}

async function deletePlantilla(id, nombre) {
  if (!confirm('¿Eliminar la plantilla "' + nombre + '"?\n\nEsta acción no se puede deshacer.')) return;
  try {
    await api('DELETE', '/ticket-plantillas/' + id);
    showToast('Plantilla eliminada', 'success');
    loadPlantillas();
  } catch(e) { showToast(e.message, 'error'); }
}

// ===== LOGO UPLOAD FUNCTIONS =====
function previewEmpresaLogo(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      $id('fe-logo-preview').src = e.target.result;
      $id('fe-logo-preview').style.display = '';
      $id('fe-logo-name').textContent = input.files[0].name;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function previewLocalLogo(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      $id('fl-logo-preview').src = e.target.result;
      $id('fl-logo-preview').style.display = '';
      $id('fl-logo-name').textContent = input.files[0].name;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function uploadConfigLogo(input, tipo) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const isRoot = currentUserData?.tipo === 'root';
    const empresaId = isRoot ? ($id('config-empresa-select').value || currentUserData.empresa_id) : currentUserData.empresa_id;
    try {
      const result = await api('POST', '/upload/logo', {
        imagen: e.target.result,
        tipo: 'empresa',
        id: parseInt(empresaId)
      });
      $id('cfg-logo-empresa-preview').src = result.logo;
      $id('cfg-logo-empresa-preview').style.display = '';
      $id('cfg-logo-empresa-placeholder').style.display = 'none';
      showToast('Logo actualizado', 'success');
    } catch(err) { showToast(err.message, 'error'); }
  };
  reader.readAsDataURL(input.files[0]);
}

// Upload logo after saving empresa
async function uploadEmpresaLogoAfterSave(empresaId) {
  const input = $id('fe-logo-input');
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  return new Promise((resolve) => {
    reader.onload = async (e) => {
      try {
        await api('POST', '/upload/logo', { imagen: e.target.result, tipo: 'empresa', id: empresaId });
        showToast('Logo de empresa actualizado', 'success');
      } catch(err) { showToast(err.message, 'error'); }
      resolve();
    };
    reader.readAsDataURL(input.files[0]);
  });
}

// Upload logo after saving local
async function uploadLocalLogoAfterSave(localId) {
  const input = $id('fl-logo-input');
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  return new Promise((resolve) => {
    reader.onload = async (e) => {
      try {
        await api('POST', '/upload/logo', { imagen: e.target.result, tipo: 'local', id: localId });
        showToast('Logo del local actualizado', 'success');
      } catch(err) { showToast(err.message, 'error'); }
      resolve();
    };
    reader.readAsDataURL(input.files[0]);
  });
}

// ===== TICKET PRINTING =====
function closeTicketModal() { $id('ticket-modal').classList.remove('open'); }

async function openTicketModal(servicioId, plantillaId = null) {
  try {
    let url = '/ticket/' + servicioId;
    if (plantillaId) url += '?plantilla_id=' + plantillaId;
    const data = await api('GET', url);
    const s = data.servicio;
    const cfg = data.config;
    const logo = data.logo;

    const total = (s.costo_total || 0) - (s.anticipo || 0);
    const fecha = new Date().toLocaleString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true });

    // Helper: cada toggle es por defecto VISIBLE si la columna no existe (BD vieja)
    const show = (k) => cfg[k] === undefined || cfg[k] === null || !!cfg[k];

    // Imagen extra: bloque reusable (HTML) que se inyecta al inicio o al final
    const imgExtraSize = Math.max(20, Math.min(100, Number(cfg.ticket_imagen_extra_size) || 60));
    const imgExtraBlock = cfg.ticket_imagen_extra
      ? `<div style="margin:10px 0;text-align:center;"><img src="${cfg.ticket_imagen_extra}" alt="" style="width:${imgExtraSize}%;height:auto;max-width:100%;"></div>`
      : '';
    const imgExtraPos = cfg.ticket_imagen_extra_pos || 'final';

    let html = '<div style="text-align:center;width:100%;font-family:Arial,sans-serif;font-size:12px;color:#000;">';

    // Imagen extra (al inicio)
    if (imgExtraBlock && imgExtraPos === 'inicio') html += imgExtraBlock;

    // Logo
    if (show('ticket_mostrar_logo') && logo) {
      html += `<div style="margin-bottom:8px;"><img src="${logo}" alt="Logo" style="max-width:90%;height:auto;max-height:80px;"></div>`;
    }

    // Título
    html += `<h3 style="margin:4px 0;font-size:14px;font-weight:bold;">${cfg.ticket_titulo || 'TICKET DE SERVICIO'}</h3>`;

    // Ubicación
    if (show('ticket_mostrar_ubicacion')) {
      const ubicacion = s.local_ciudad || s.empresa_ciudad || '';
      const estado = s.estado_local || s.empresa_estado || '';
      if (ubicacion || estado) {
        html += `<p style="margin:2px 0;font-size:11px;">${ubicacion}${estado ? ', ' + estado : ''}</p>`;
      }
    }
    // Fecha de emisión (del ticket, no del servicio)
    if (show('ticket_mostrar_fecha_emision')) {
      html += `<p style="margin:2px 0;font-size:11px;">${fecha}</p>`;
    }

    // Dirección
    if (show('ticket_mostrar_direccion') && s.empresa_calle) {
      html += `<p style="margin:2px 0;font-size:11px;">${s.empresa_calle}</p>`;
    }

    html += '<hr style="border:none;border-top:1px dashed #000;margin:8px 0;">';

    // Datos del servicio (cada uno con su toggle)
    let dataRows = '';
    if (show('ticket_mostrar_folio'))            dataRows += `<tr><td style="padding:2px 0;"><strong>Folio:</strong> ${s.folio}</td></tr>`;
    if (show('ticket_mostrar_cliente_nombre'))   dataRows += `<tr><td style="padding:2px 0;"><strong>Cliente:</strong> ${s.cliente_nombre || '-'}</td></tr>`;
    if (show('ticket_mostrar_cliente_telefono') && s.cliente_telefono) dataRows += `<tr><td style="padding:2px 0;"><strong>Tel. cliente:</strong> ${s.cliente_telefono}</td></tr>`;
    if (show('ticket_mostrar_dispositivo'))      dataRows += `<tr><td style="padding:2px 0;"><strong>Dispositivo:</strong> ${s.modelo || '-'}</td></tr>`;
    if (show('ticket_mostrar_num_serie') && s.num_serie) dataRows += `<tr><td style="padding:2px 0;"><strong>No. Serie:</strong> ${s.num_serie}</td></tr>`;
    if (show('ticket_mostrar_falla'))            dataRows += `<tr><td style="padding:2px 0;"><strong>Falla:</strong> ${s.falla || '-'}</td></tr>`;
    if (show('ticket_mostrar_observaciones') && s.observaciones) dataRows += `<tr><td style="padding:2px 0;"><strong>Observaciones:</strong> ${s.observaciones}</td></tr>`;
    if (show('ticket_mostrar_estado'))           dataRows += `<tr><td style="padding:2px 0;"><strong>Estado:</strong> ${s.estado || '-'}</td></tr>`;
    if (show('ticket_mostrar_garantia'))         dataRows += `<tr><td style="padding:2px 0;"><strong>Garantía:</strong> ${s.garantia || 'Sin garantía'}</td></tr>`;
    if (show('ticket_mostrar_fecha_entrada'))    dataRows += `<tr><td style="padding:2px 0;"><strong>Fecha entrada:</strong> ${s.fecha_entrada ? s.fecha_entrada.split('T')[0] : '-'}</td></tr>`;
    if (show('ticket_mostrar_fecha_salida') && s.fecha_salida) dataRows += `<tr><td style="padding:2px 0;"><strong>Fecha salida:</strong> ${s.fecha_salida.split('T')[0]}</td></tr>`;
    if (dataRows) {
      html += '<table style="width:100%;border-collapse:collapse;text-align:left;font-size:11px;">' + dataRows + '</table>';
      html += '<hr style="border:none;border-top:1px dashed #000;margin:8px 0;">';
    }

    // Costos
    let costRows = '';
    if (show('ticket_mostrar_anticipo'))    costRows += `<tr><td style="padding:2px 0;"><strong>Anticipo:</strong></td><td style="text-align:right;">$${Number(s.anticipo||0).toFixed(2)}</td></tr>`;
    if (show('ticket_mostrar_refacciones') && s.costo_refaccion > 0) costRows += `<tr><td style="padding:2px 0;"><strong>Refacciones:</strong></td><td style="text-align:right;">$${Number(s.costo_refaccion).toFixed(2)}</td></tr>`;
    if (show('ticket_mostrar_costo_total')) costRows += `<tr><td style="padding:2px 0;"><strong>Costo total:</strong></td><td style="text-align:right;">$${Number(s.costo_total||0).toFixed(2)}</td></tr>`;
    if (show('ticket_mostrar_restante'))    costRows += `<tr style="font-size:14px;font-weight:bold;"><td style="padding:4px 0;border-top:1px solid #000;"><strong>Restante:</strong></td><td style="text-align:right;border-top:1px solid #000;">$${Number(total).toFixed(2)}</td></tr>`;
    if (costRows) {
      html += '<table style="width:100%;border-collapse:collapse;text-align:left;font-size:12px;">' + costRows + '</table>';
      html += '<hr style="border:none;border-top:1px dashed #000;margin:8px 0;">';
    }

    // Políticas
    if (cfg.ticket_politica_garantia) html += `<p style="font-size:9px;margin:4px 0;text-align:justify;">${cfg.ticket_politica_garantia}</p>`;
    if (cfg.ticket_politica_revision) html += `<p style="font-size:9px;margin:4px 0;text-align:justify;">${cfg.ticket_politica_revision}</p>`;
    if (cfg.ticket_texto_extra)       html += `<p style="font-size:9px;margin:4px 0;text-align:justify;">${cfg.ticket_texto_extra}</p>`;

    // Firmas
    if (show('ticket_mostrar_firma_cliente')) {
      html += '<div style="margin-top:16px;"><p style="font-size:10px;margin:0;">FIRMA CLIENTE:</p><div style="border-bottom:1px solid #000;margin-top:20px;width:80%;margin-left:auto;margin-right:auto;"></div></div>';
    }
    if (show('ticket_mostrar_firma_tecnico')) {
      html += '<div style="margin-top:16px;"><p style="font-size:10px;margin:0;">FIRMA TÉCNICO:</p><div style="border-bottom:1px solid #000;margin-top:20px;width:80%;margin-left:auto;margin-right:auto;"></div></div>';
    }

    // Gracias
    if (show('ticket_mostrar_gracias')) {
      html += '<p style="text-align:center;margin-top:12px;font-size:11px;font-weight:bold;">¡Gracias por su preferencia!</p>';
    }

    // Teléfono empresa
    if (show('ticket_mostrar_telefono') && s.empresa_telefono) {
      html += `<p style="text-align:center;font-size:10px;margin:4px 0;">Tel: +52 ${s.empresa_telefono}</p>`;
    }

    // Imagen extra (al final)
    if (imgExtraBlock && imgExtraPos !== 'inicio') html += imgExtraBlock;

    html += '</div>';

    $id('ticket-print-area').innerHTML = html;
    $id('ticket-modal').classList.add('open');
  } catch(e) { showToast(e.message, 'error'); }
}

// Construye el HTML de la vista previa del ticket leyendo los inputs del
// prefijo dado ('cfg' para Configuración, 'plt' para Plantilla).
// Comparte la lógica de render para mantener visualmente idénticos ambos previews.
function _buildTicketPreviewHTML(prefix) {
  const ck = (id) => { const el = $id(id); return el ? !!el.checked : true; };
  const val = (id, def='') => $id(id)?.value ?? def;
  // IDs de inputs de la imagen extra y textos varían según prefijo
  const imgPrev = $id(prefix + '-imagen-extra-preview');
  const imgVisible = imgPrev?.style.display !== 'none' && imgPrev?.src;
  const imgSize = parseInt($id(prefix + '-imagen-extra-size')?.value) || 60;
  const imgPos = $id(prefix + '-imagen-extra-pos')?.value || 'final';
  const imgBlock = imgVisible
    ? `<div style="margin:10px 0;text-align:center;"><img src="${imgPrev.src}" alt="" style="width:${imgSize}%;height:auto;max-width:100%;"></div>`
    : '';

  // Datos de ejemplo
  const s = {
    folio: 'TS070326001',
    cliente_nombre: 'Juan Ejemplo',
    cliente_telefono: '33 1234 5678',
    modelo: 'iPhone 15 Pro',
    num_serie: 'F2LX0H3HQR8C',
    falla: 'Pantalla rota',
    observaciones: 'Golpe en esquina inferior derecha',
    estado: 'Recibido',
    garantia: '30 días',
    fecha_entrada: '2026-03-07T10:30:00',
    fecha_salida: null,
    anticipo: 500,
    costo_refaccion: 800,
    costo_total: 2500,
    empresa_calle: 'Av. Ejemplo #123',
    empresa_telefono: '33 1234 5678',
  };
  const total = s.costo_total - s.anticipo;
  const fecha = new Date().toLocaleString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true });

  // Logo (siempre desde el preview de Configuración — la empresa es la misma)
  const logoSrc = $id('cfg-logo-empresa-preview')?.src || '';
  const logoVisible = $id('cfg-logo-empresa-preview')?.style.display !== 'none';
  // Título: cfg usa #cfg-ticket-titulo, plt usa #plt-titulo
  const tituloId = (prefix === 'cfg') ? 'cfg-ticket-titulo' : 'plt-titulo';
  const titulo = val(tituloId, '') || 'TICKET DE SERVICIO';
  // Helper de toggle con prefijo
  const ckp = (key) => ck(prefix + '-mostrar-' + key);

  let html = '<div style="text-align:center;width:100%;font-family:Arial,sans-serif;font-size:12px;color:#000;">';

  if (imgBlock && imgPos === 'inicio') html += imgBlock;

  if (ckp('logo') && logoVisible && logoSrc) {
    html += `<div style="margin-bottom:8px;"><img src="${logoSrc}" alt="Logo" style="max-width:90%;height:auto;max-height:80px;"></div>`;
  }

  html += `<h3 style="margin:4px 0;font-size:14px;font-weight:bold;">${titulo}</h3>`;

  if (ckp('ubicacion'))     html += `<p style="margin:2px 0;font-size:11px;">Guadalajara, Jalisco</p>`;
  if (ckp('fecha-emision')) html += `<p style="margin:2px 0;font-size:11px;">${fecha}</p>`;
  if (ckp('direccion'))     html += `<p style="margin:2px 0;font-size:11px;">${s.empresa_calle}</p>`;

  // Datos del servicio
  let dataRows = '';
  if (ckp('folio'))            dataRows += `<tr><td style="padding:2px 0;"><strong>Folio:</strong> ${s.folio}</td></tr>`;
  if (ckp('cliente-nombre'))   dataRows += `<tr><td style="padding:2px 0;"><strong>Cliente:</strong> ${s.cliente_nombre}</td></tr>`;
  if (ckp('cliente-telefono')) dataRows += `<tr><td style="padding:2px 0;"><strong>Tel. cliente:</strong> ${s.cliente_telefono}</td></tr>`;
  if (ckp('dispositivo'))      dataRows += `<tr><td style="padding:2px 0;"><strong>Dispositivo:</strong> ${s.modelo}</td></tr>`;
  if (ckp('num-serie'))        dataRows += `<tr><td style="padding:2px 0;"><strong>No. Serie:</strong> ${s.num_serie}</td></tr>`;
  if (ckp('falla'))            dataRows += `<tr><td style="padding:2px 0;"><strong>Falla:</strong> ${s.falla}</td></tr>`;
  if (ckp('observaciones'))    dataRows += `<tr><td style="padding:2px 0;"><strong>Observaciones:</strong> ${s.observaciones}</td></tr>`;
  if (ckp('estado'))           dataRows += `<tr><td style="padding:2px 0;"><strong>Estado:</strong> ${s.estado}</td></tr>`;
  if (ckp('garantia'))         dataRows += `<tr><td style="padding:2px 0;"><strong>Garantía:</strong> ${s.garantia}</td></tr>`;
  if (ckp('fecha-entrada'))    dataRows += `<tr><td style="padding:2px 0;"><strong>Fecha entrada:</strong> 07/03/2026</td></tr>`;
  if (ckp('fecha-salida'))     dataRows += `<tr><td style="padding:2px 0;"><strong>Fecha salida:</strong> 12/03/2026</td></tr>`;
  if (dataRows) {
    html += '<hr style="border:none;border-top:1px dashed #000;margin:8px 0;">';
    html += '<table style="width:100%;border-collapse:collapse;text-align:left;font-size:11px;">' + dataRows + '</table>';
  }

  // Costos
  let costRows = '';
  if (ckp('anticipo'))    costRows += `<tr><td style="padding:2px 0;"><strong>Anticipo:</strong></td><td style="text-align:right;">$${s.anticipo.toFixed(2)}</td></tr>`;
  if (ckp('refacciones')) costRows += `<tr><td style="padding:2px 0;"><strong>Refacciones:</strong></td><td style="text-align:right;">$${s.costo_refaccion.toFixed(2)}</td></tr>`;
  if (ckp('costo-total')) costRows += `<tr><td style="padding:2px 0;"><strong>Costo total:</strong></td><td style="text-align:right;">$${s.costo_total.toFixed(2)}</td></tr>`;
  if (ckp('restante'))    costRows += `<tr style="font-size:14px;font-weight:bold;"><td style="padding:4px 0;border-top:1px solid #000;"><strong>Restante:</strong></td><td style="text-align:right;border-top:1px solid #000;">$${total.toFixed(2)}</td></tr>`;
  if (costRows) {
    html += '<hr style="border:none;border-top:1px dashed #000;margin:8px 0;">';
    html += '<table style="width:100%;border-collapse:collapse;text-align:left;font-size:12px;">' + costRows + '</table>';
  }

  html += '<hr style="border:none;border-top:1px dashed #000;margin:8px 0;">';

  const polG = val(prefix + '-politica-garantia');
  const polR = val(prefix + '-politica-revision');
  const polE = val(prefix + '-texto-extra');
  if (polG) html += `<p style="font-size:9px;margin:4px 0;text-align:justify;">${polG}</p>`;
  if (polR) html += `<p style="font-size:9px;margin:4px 0;text-align:justify;">${polR}</p>`;
  if (polE) html += `<p style="font-size:9px;margin:4px 0;text-align:justify;">${polE}</p>`;

  if (ckp('firma-cliente')) {
    html += '<div style="margin-top:16px;"><p style="font-size:10px;margin:0;">FIRMA CLIENTE:</p><div style="border-bottom:1px solid #000;margin-top:20px;width:80%;margin-left:auto;margin-right:auto;"></div></div>';
  }
  if (ckp('firma-tecnico')) {
    html += '<div style="margin-top:16px;"><p style="font-size:10px;margin:0;">FIRMA TÉCNICO:</p><div style="border-bottom:1px solid #000;margin-top:20px;width:80%;margin-left:auto;margin-right:auto;"></div></div>';
  }
  if (ckp('gracias')) html += '<p style="text-align:center;margin-top:12px;font-size:11px;font-weight:bold;">¡Gracias por su preferencia!</p>';
  if (ckp('telefono')) html += `<p style="text-align:center;font-size:10px;margin:4px 0;">Tel: +52 ${s.empresa_telefono}</p>`;

  if (imgBlock && imgPos !== 'inicio') html += imgBlock;

  html += '</div>';
  return html;
}

// Wrappers: vista previa desde Configuración y desde el modal de Plantilla
function previewTicket() {
  $id('ticket-print-area').innerHTML = _buildTicketPreviewHTML('cfg');
  $id('ticket-modal').classList.add('open');
}
function previewPlantilla() {
  // Validar que al menos haya un nombre cargado (estamos dentro del modal)
  $id('ticket-print-area').innerHTML = _buildTicketPreviewHTML('plt');
  $id('ticket-modal').classList.add('open');
}

function printTicket() {
  const content = $id('ticket-print-area').innerHTML;
  const printWin = window.open('', '_blank', 'width=400,height=700');
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Ticket</title>
      <style>
        @media print {
          @page { size: 58mm auto; margin: 0; }
          body, html { margin: 0; padding: 0; width: 58mm; }
        }
        body { margin: 0; padding: 4px; font-family: Arial, sans-serif; font-size: 12px; width: 58mm; box-sizing: border-box; }
        img { max-width: 52mm !important; }
      </style>
    </head>
    <body>
      ${content}
      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); window.close(); }, 300);
        };
      <\/script>
    </body>
    </html>
  `);
  printWin.document.close();
}

// ===== AUDITORÍA =====
logsPage = 1;
LOGS_PER_PAGE = 50;
const logsSort = { f: 'fecha', d: 'desc' };

async function loadLogs() {
  const q = ($id('log-q') || {}).value || '';
  const modulo = ($id('log-modulo') || {}).value || '';
  const accion = ($id('log-accion') || {}).value || '';
  const desde = ($id('log-desde') || {}).value || '';
  const hasta = ($id('log-hasta') || {}).value || '';
  LOGS_PER_PAGE = parseInt($id('logs-per-page')?.value) || LOGS_PER_PAGE;
  const params = new URLSearchParams({ page: logsPage, limit: LOGS_PER_PAGE });
  if (q) params.set('q', q);
  if (modulo) params.set('modulo', modulo);
  if (accion) params.set('accion', accion);
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);

  const tbody = $id('logs-tbody');
  tableLoading(tbody, 6);

  try {
    const res = await api('GET', '/logs?' + params.toString());
    const { data = [], total = 0 } = res;

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text3);">${t('table.empty')}</td></tr>`;
    } else {
      tbody.innerHTML = data.map(log => {
        const accionInfo = logAccionStyle(log.accion);
        const fechaStr = log.fecha ? log.fecha.replace('T',' ').substring(0,16) : '—';
        return `<tr style="border-bottom:1px solid var(--border);">
          <td style="padding:11px 16px;font-size:12px;color:var(--text2);white-space:nowrap;">${fechaStr}</td>
          <td style="padding:11px 16px;">
            <div style="font-size:13px;font-weight:500;">${escHtml(log.usuario_nombre || '—')}</div>
            <div style="font-size:11px;color:var(--text3);">${logTipoLabel(log.usuario_tipo)}</div>
          </td>
          <td style="padding:11px 16px;"><span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;background:${accionInfo.bg};color:${accionInfo.color};">${accionInfo.label}</span></td>
          <td style="padding:11px 16px;"><span style="font-size:12px;color:var(--text2);">${escHtml(log.modulo || '—')}</span></td>
          <td style="padding:11px 16px;font-size:13px;color:var(--text);max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(log.descripcion || '')}">${escHtml(log.descripcion || '—')}</td>
          <td style="padding:11px 16px;font-size:12px;color:var(--text3);">${escHtml(log.ip || '—')}</td>
        </tr>`;
      }).join('');
    }

    // Pagination
    const totalPages = Math.ceil(total / LOGS_PER_PAGE);
    const pag = $id('logs-pagination');
    pag.innerHTML = `
      <span>${total} registro${total !== 1 ? 's' : ''} · Página ${logsPage} de ${totalPages || 1}</span>
      <div style="display:flex;gap:8px;">
        <button class="btn-outline" style="padding:6px 14px;font-size:12px;" ${logsPage <= 1 ? 'disabled' : ''} onclick="logsPage--;loadLogs()"><i class="fa-solid fa-chevron-left"></i></button>
        <button class="btn-outline" style="padding:6px 14px;font-size:12px;" ${logsPage >= totalPages ? 'disabled' : ''} onclick="logsPage++;loadLogs()"><i class="fa-solid fa-chevron-right"></i></button>
      </div>`;
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--danger);">Error al cargar logs</td></tr>`;
  }
}

function filterLogs() { logsPage = 1; loadLogs(); }

function clearLogFilters() {
  $id('log-q').value = '';
  $id('log-modulo').value = '';
  $id('log-accion').value = '';
  $id('log-desde').value = '';
  $id('log-hasta').value = '';
  logsPage = 1;
  loadLogs();
}

function logAccionStyle(accion) {
  const map = {
    login:             { label:'Login',         color:'#0a0b0f', bg:'var(--accent)' },
    login_fallido:     { label:'Login fallido', color:'#fff',    bg:'var(--danger)' },
    crear:             { label:'Crear',         color:'#0a0b0f', bg:'var(--success)' },
    editar:            { label:'Editar',        color:'#fff',    bg:'var(--info)' },
    borrar:            { label:'Borrar',        color:'#fff',    bg:'var(--danger)' },
    cambio_contrasena: { label:'Contraseña',    color:'#0a0b0f', bg:'var(--purple)' },
    asignar:           { label:'Asignar',       color:'#0a0b0f', bg:'var(--accent3)' },
    quitar:            { label:'Quitar',        color:'#fff',    bg:'var(--accent2)' },
  };
  return map[accion] || { label: accion, color:'var(--text)', bg:'var(--bg3)' };
}

function logTipoLabel(tipo) {
  if (tipo === 'root') return '<span style="color:var(--accent);font-size:10px;">ROOT</span>';
  if (tipo === 'admin') return '<span style="color:var(--info);font-size:10px;">ADMIN</span>';
  return '<span style="color:var(--text3);font-size:10px;">EMPLEADO</span>';
}

// ===== ADMIN DB (descargar / reemplazar BD del servidor) =====
window.adminDownloadDB = async function() {
  const statusEl = $id('admin-db-status');
  if (statusEl) statusEl.textContent = 'Descargando…';
  try {
    const res = await fetch('/api/admin/database/download', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'HTTP ' + res.status }));
      throw new Error(err.error || 'Error ' + res.status);
    }
    const blob = await res.blob();
    // Detectar nombre del header
    const cd = res.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename="?([^"]+)"?/);
    const fname = (match && match[1]) || ('techservice-' + Date.now() + '.db');
    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
    if (statusEl) statusEl.textContent = '✓ Descargado ' + fname + ' (' + (blob.size / 1024).toFixed(0) + ' KB)';
    showToast('BD descargada', 'success');
  } catch(e) {
    if (statusEl) statusEl.textContent = '✗ ' + (e.message || e);
    showToast('Error: ' + (e.message || e), 'error');
  }
};

window.adminUploadDB = async function(file) {
  if (!file) return;
  const statusEl = $id('admin-db-status');
  const confirmMsg =
    `¿Reemplazar la BD del servidor con "${file.name}" (${(file.size / 1024).toFixed(0)} KB)?\n\n` +
    'La BD actual se respaldará automáticamente, pero TODAS las sesiones activas se cerrarán\n' +
    'y el servidor se reiniciará en ~1 segundo después de subir.\n\nEsta acción NO se puede deshacer fácilmente.';
  if (!confirm(confirmMsg)) {
    $id('admin-db-upload-input').value = '';
    return;
  }
  if (statusEl) statusEl.textContent = 'Subiendo ' + file.name + '…';
  try {
    const res = await fetch('/api/admin/database/upload', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/octet-stream',
      },
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
    if (statusEl) statusEl.textContent = '✓ ' + data.message;
    showToast('BD reemplazada. Reiniciando servidor…', 'success');
    // Esperar ~3s y forzar logout porque el server va a reiniciar
    setTimeout(() => {
      localStorage.removeItem('ts_token');
      localStorage.removeItem('ts_user');
      localStorage.removeItem('ts_permisos');
      location.reload();
    }, 3500);
  } catch(e) {
    if (statusEl) statusEl.textContent = '✗ ' + (e.message || e);
    showToast('Error subiendo BD: ' + (e.message || e), 'error');
  } finally {
    $id('admin-db-upload-input').value = '';
  }
};

// ===== SANDBOX =====
async function loadSandboxes() {
  try {
    const sandboxes = await api('GET', '/sandbox');
    const container = $id('sandbox-list');

    if (!sandboxes.length) {
      container.innerHTML = `
        <div class="widget" style="padding:60px 40px;text-align:center;">
          <i class="fa-solid fa-flask" style="font-size:48px;color:var(--text3);margin-bottom:16px;opacity:0.5;"></i>
          <p style="font-size:16px;color:var(--text2);margin-bottom:8px;">No hay sandboxes creados</p>
          <p style="font-size:13px;color:var(--text3);margin-bottom:24px;">Crea uno para empezar a hacer pruebas sin afectar datos reales</p>
          <button class="btn-accent" onclick="createNewSandbox()" style="font-size:14px;padding:12px 24px;">
            <i class="fa-solid fa-plus"></i> Crear mi primer sandbox
          </button>
        </div>`;
      return;
    }

    container.innerHTML = sandboxes.map(s => `
      <div class="widget" style="padding:0;margin-bottom:16px;overflow:hidden;border:1px solid rgba(240,165,0,0.15);">
        <div style="padding:18px 22px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,rgba(240,165,0,0.15),rgba(0,212,170,0.1));display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--accent);">
              <i class="fa-solid fa-flask"></i>
            </div>
            <div>
              <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;">
                ${s.nombre}
                <span style="font-size:10px;padding:2px 8px;border-radius:4px;background:rgba(240,165,0,0.12);color:var(--accent);font-family:inherit;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Sandbox</span>
              </div>
              <div style="font-size:12px;color:var(--text3);margin-top:2px;">ID: ${s.id} &middot; Creado: ${new Date(s.fecha_creacion).toLocaleDateString('es-MX')}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="resetSandboxData(${s.id}, '${s.nombre.replace(/'/g, "\\'")}')" class="btn-outline" style="font-size:12px;padding:8px 14px;color:var(--accent);border-color:rgba(240,165,0,0.3);" title="Limpiar datos transaccionales">
              <i class="fa-solid fa-arrows-rotate"></i> Limpiar datos
            </button>
            <button onclick="removeSandbox(${s.id}, '${s.nombre.replace(/'/g, "\\'")}')" class="btn-outline" style="font-size:12px;padding:8px 14px;color:var(--danger);border-color:rgba(255,71,87,0.3);" title="Eliminar sandbox completamente">
              <i class="fa-solid fa-trash"></i> Eliminar
            </button>
          </div>
        </div>
        <div style="padding:16px 22px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
          <div style="text-align:center;">
            <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--accent);">${s.total_locales || 0}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">Locales</div>
          </div>
          <div style="text-align:center;">
            <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--accent2);">${s.total_usuarios || 0}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">Usuarios</div>
          </div>
          <div style="text-align:center;">
            <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--info);">${s.total_clientes || 0}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">Clientes</div>
          </div>
          <div style="text-align:center;">
            <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--success);">${s.total_servicios || 0}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">Servicios</div>
          </div>
        </div>
      </div>
    `).join('');
  } catch(e) { showToast(e.message, 'error'); }
}

async function createNewSandbox() {
  const nombre = prompt('Nombre para el sandbox (opcional):');
  try {
    const res = await api('POST', '/sandbox', { nombre: nombre || undefined });
    showToast(res.message, 'success');
    // Show credentials
    const creds = res.credenciales;
    setTimeout(() => {
      alert(`Sandbox creado!\n\nCredenciales:\n\nAdmin: ${creds.admin.correo}\nEmpleado A: ${creds.empleado_a.correo}\nEmpleado B: ${creds.empleado_b.correo}\n\nContrasena para todos: sandbox`);
    }, 500);
    loadSandboxes();
  } catch(e) { showToast(e.message, 'error'); }
}

async function removeSandbox(id, nombre) {
  if (!confirm(`Eliminar sandbox "${nombre}"?\n\nEsto borrara TODOS los datos (usuarios, clientes, servicios, etc.) de forma permanente.`)) return;
  try {
    const res = await api('DELETE', '/sandbox/' + id);
    showToast(res.message, 'success');
    loadSandboxes();
  } catch(e) { showToast(e.message, 'error'); }
}

async function resetSandboxData(id, nombre) {
  if (!confirm(`Limpiar datos de "${nombre}"?\n\nSe eliminaran servicios, clientes, ventas y productos.\nLos usuarios y locales se conservaran.`)) return;
  try {
    const res = await api('PUT', '/sandbox/' + id + '/reset');
    showToast(res.message, 'success');
    loadSandboxes();
  } catch(e) { showToast(e.message, 'error'); }
}

// ===== POS MODULE =====

// --- POS Terminal ---
function loadPOS() {
  const input = $id('pos-barcode-input');
  if (input) {
    setTimeout(() => input.focus(), 100);
    if (!input._posbound) {
      input._posbound = true;
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && this.value.trim()) {
          const code = this.value.trim();
          const ac = $id('pos-unified-ac');
          if (ac) ac.style.display = 'none';
          this.value = '';
          addProductToPOS(code);
        }
        if (e.key === 'Escape') {
          const ac = $id('pos-unified-ac');
          if (ac) ac.style.display = 'none';
          this.value = '';
        }
      });
    }
  }
  if (!document._posAcBound) {
    document._posAcBound = true;
    document.addEventListener('click', e => {
      const ac = $id('pos-unified-ac');
      const inp = $id('pos-barcode-input');
      if (ac && inp && !inp.contains(e.target) && !ac.contains(e.target)) {
        ac.style.display = 'none';
      }
    });
  }
  renderPOSCart();
  updatePOSTotals();
  checkCorteActivo();
  loadPOSConceptos();
}

async function checkCorteActivo() {
  try {
    corteActivo = await api('GET', '/cortes/activo');
    if (!corteActivo) {
      // No open corte — show apertura modal (if user has a local)
      if (currentUserData?.local_id) {
        const fondoInput = $id('corte-fondo-input');
        if (fondoInput) fondoInput.value = '0';
        $id('corte-apertura-modal').classList.add('open');
        $id('pos-corte-bar').style.display = 'none';
      }
    } else {
      updateCorteBar();
    }
  } catch(e) { /* no local or no permission — skip corte */ }
}

// Background watcher — detects server-side auto-corte closure every minute
_autoCorteInterval = null;
function startAutoCorteWatcher() {
  if (_autoCorteInterval) clearInterval(_autoCorteInterval);
  _autoCorteInterval = setInterval(async () => {
    if (!token || !currentUserData?.local_id || !corteActivo) return;
    try {
      const activo = await api('GET', '/cortes/activo');
      if (!activo) {
        const folio = corteActivo.folio_corte;
        corteActivo = null;
        updateCorteBar();
        showToast(`Corte automático cerrado: ${folio}`, 'info');
      } else {
        corteActivo = activo;
        updateCorteBar();
      }
    } catch(e) { /* ignore */ }
  }, 60 * 1000);
}
function stopAutoCorteWatcher() {
  if (_autoCorteInterval) { clearInterval(_autoCorteInterval); _autoCorteInterval = null; }
}

async function abrirCaja() {
  const fondo = parseFloat($id('corte-fondo-input').value) || 0;
  try {
    corteActivo = await api('POST', '/cortes/apertura', { fondo_apertura: fondo });
    $id('corte-apertura-modal').classList.remove('open');
    updateCorteBar();
    showToast(`Caja abierta — Fondo: ${money(fondo)}`, 'success');
    setTimeout(() => $id('pos-barcode-input')?.focus(), 100);
  } catch(e) { showToast(e.message, 'error'); }
}

function updateCorteBar() {
  if (!corteActivo) { $id('pos-corte-bar').style.display = 'none'; return; }
  $id('pos-corte-bar').style.display = '';
  const apertura = new Date(corteActivo.fecha_apertura);
  $id('corte-bar-desde').textContent = apertura.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  $id('corte-bar-efectivo').textContent = money(corteActivo.total_efectivo || 0);
  const totalTx = (corteActivo.num_ventas || 0) + (corteActivo.num_servicios || 0);
  $id('corte-bar-num').textContent = totalTx;
  const otros = [];
  if ((corteActivo.total_tarjeta || 0) > 0)       otros.push(`Tarjeta: ${money(corteActivo.total_tarjeta)}`);
  if ((corteActivo.total_transferencia || 0) > 0)  otros.push(`Transf: ${money(corteActivo.total_transferencia)}`);
  if ((corteActivo.total_credito || 0) > 0)        otros.push(`Crédito: ${money(corteActivo.total_credito)}`);
  $id('corte-bar-otros').textContent = otros.length ? otros.join(' · ') : 'Sin otros pagos';
}

async function showCorteCierreModal() {
  try {
    corteActivo = await api('GET', '/cortes/activo');
    if (!corteActivo) { showToast('No hay caja abierta', 'info'); return; }

    const apertura = new Date(corteActivo.fecha_apertura);
    const fondo = corteActivo.fondo_apertura || 0;
    const efectivo = corteActivo.total_efectivo || 0;
    const esperado = fondo + efectivo;

    $id('corte-cierre-folio').textContent = corteActivo.folio_corte;
    $id('corte-cierre-apertura').textContent = apertura.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
    const nv = corteActivo.num_ventas || 0;
    const ns = corteActivo.num_servicios || 0;
    $id('corte-cierre-ventas-count').textContent = nv + ns > 0
      ? `${nv} venta(s)${ns > 0 ? ` · ${ns} cobro(s) servicio` : ''}`
      : '0 transacciones';
    $id('corte-cierre-fondo').textContent = money(fondo);
    $id('corte-cierre-efectivo').textContent = money(efectivo);
    $id('corte-cierre-esperado').textContent = money(esperado);
    $id('corte-cierre-tarjeta').textContent = money(corteActivo.total_tarjeta || 0);
    $id('corte-cierre-transferencia').textContent = money(corteActivo.total_transferencia || 0);
    $id('corte-cierre-credito').textContent = money(corteActivo.total_credito || 0);
    $id('corte-cierre-total').textContent = money(corteActivo.total_ventas || 0);
    $id('corte-contado-input').value = '';
    $id('corte-diferencia-row').style.display = 'none';

    $id('corte-cierre-modal').classList.add('open');
  } catch(e) { showToast(e.message, 'error'); }
}

function updateCorteDiferencia() {
  const val = $id('corte-contado-input').value;
  const row = $id('corte-diferencia-row');
  if (!val || !corteActivo) { row.style.display = 'none'; return; }

  const fondo = corteActivo.fondo_apertura || 0;
  const efectivo = corteActivo.total_efectivo || 0;
  const esperado = fondo + efectivo;
  const contado = parseFloat(val) || 0;
  const diff = Math.round((contado - esperado) * 100) / 100;

  row.style.display = 'flex';
  const el = $id('corte-diferencia-val');
  el.textContent = (diff >= 0 ? '+' : '') + money(diff);
  el.style.color = diff === 0 ? 'var(--success)' : (diff > 0 ? 'var(--accent)' : 'var(--danger)');
}

async function cerrarCorte() {
  if (!corteActivo) return;
  const contadoVal = $id('corte-contado-input').value;
  const efectivo_contado = contadoVal !== '' ? parseFloat(contadoVal) : null;
  try {
    const closed = await api('POST', `/cortes/${corteActivo.id}/cerrar`, { efectivo_contado });
    corteActivo = null;
    $id('corte-cierre-modal').classList.remove('open');
    $id('pos-corte-bar').style.display = 'none';
    showToast(`Corte ${closed.folio_corte} cerrado — Total: ${money(closed.total_ventas)}`, 'success');
    // Prompt for new apertura
    setTimeout(() => {
      const fondoInput = $id('corte-fondo-input');
      if (fondoInput) fondoInput.value = '0';
      $id('corte-apertura-modal').classList.add('open');
    }, 800);
  } catch(e) { showToast(e.message, 'error'); }
}

async function addProductToPOS(code) {
  if (!code) return;
  try {
    const { data } = await api('GET', '/productos?q=' + encodeURIComponent(code) + '&limit=10');
    // Prefer exact code match, else use sole result
    let prod = data.find(p => p.codigo === code);
    if (!prod && data.length === 1) prod = data[0];
    if (!prod) {
      // Fallback: buscar servicio por folio o resultado único
      try {
        const { data: srvs } = await api('GET', '/servicios?q=' + encodeURIComponent(code) + '&limit=5');
        const srv = srvs.find(s => s.folio === code) || (srvs.length === 1 ? srvs[0] : null);
        if (srv) { addServiceToPOS(srv.id); return; }
      } catch(e2) { /* ignore */ }
      showToast('No se encontró producto ni servicio: ' + code, 'error');
      $id('pos-barcode-input').focus();
      return;
    }
    const pct = posListaInfo ? posListaInfo.descuento_porcentaje : 0;
    const precioFinal = pct > 0
      ? Math.round(prod.venta * (1 - pct / 100) * 100) / 100
      : prod.venta;
    const existing = posCart.find(item => item.type !== 'servicio' && item.productoId === prod.id);
    if (existing) {
      existing.cantidad += 1;
      existing.subtotal = Math.round(existing.precioUnitario * existing.cantidad * 100) / 100;
      showToast(prod.nombre + ' ×' + existing.cantidad, 'success');
    } else {
      posCart.push({
        type: 'producto',
        rowId: posNextRowId++,
        productoId: prod.id,
        codigo: prod.codigo,
        nombre: prod.nombre,
        precioOriginal: prod.venta,
        precioUnitario: precioFinal,
        cantidad: 1,
        subtotal: Math.round(precioFinal * 100) / 100
      });
      showToast('+ ' + prod.nombre, 'success');
    }
    renderPOSCart();
    updatePOSTotals();
    $id('pos-barcode-input').focus();
  } catch(e) { showToast(e.message, 'error'); }
}

function renderPOSCart() {
  const prodTbody = $id('pos-items-tbody');
  const srvTbody  = $id('pos-srv-tbody');
  if (!prodTbody || !srvTbody) return;

  const productItems = posCart.filter(i => i.type !== 'servicio');
  const serviceItems = posCart.filter(i => i.type === 'servicio');

  // ── Tabla productos ──
  if (productItems.length === 0) {
    prodTbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state" style="padding:32px 24px;">
        <i class="fa-solid fa-barcode" style="font-size:36px;margin-bottom:10px;color:var(--text3);"></i>
        <p style="font-size:14px;color:var(--text2);margin-bottom:2px;">Escanea un producto para comenzar</p>
        <span style="font-size:12px;color:var(--text3);">Usa el lector o busca manualmente</span>
      </div>
    </td></tr>`;
  } else {
    prodTbody.innerHTML = productItems.map(item => `<tr>
      <td class="col-priority-1">
        <div style="font-weight:600;font-size:14px;">${escHtml(item.nombre)}</div>
        <div style="font-size:12px;color:var(--text3);">${escHtml(item.codigo||'')}</div>
      </td>
      <td style="text-align:center;">
        <input type="number" class="pos-qty-input" value="${item.cantidad}" min="1"
          oninput="posUpdateItem(${item.rowId},'cantidad',this.value)" onclick="this.select()">
      </td>
      <td style="text-align:right;">
        <input type="number" class="pos-price-input" value="${item.precioUnitario.toFixed(2)}" min="0" step="0.01"
          oninput="posUpdateItem(${item.rowId},'precioUnitario',this.value)" onclick="this.select()">
      </td>
      <td style="text-align:right;font-family:'Syne',sans-serif;font-weight:700;color:var(--accent);"
          id="pos-sub-${item.rowId}">${money(item.subtotal)}</td>
      <td style="text-align:center;">
        <button class="act-btn del" onclick="posRemoveItem(${item.rowId})" title="Quitar">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </td>
    </tr>`).join('');
  }

  // ── Tabla servicios ──
  if (serviceItems.length === 0) {
    srvTbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state" style="padding:20px 24px;">
        <i class="fa-solid fa-screwdriver-wrench" style="font-size:28px;margin-bottom:8px;color:var(--text3);"></i>
        <p style="font-size:13px;color:var(--text2);">Sin servicios en caja</p>
      </div>
    </td></tr>`;
  } else {
    srvTbody.innerHTML = serviceItems.map(item => {
      const srvTotal = (item.montoCobrar||0);
      return `<tr style="background:rgba(40,167,69,.04);border-left:3px solid rgba(40,167,69,.4);">
        <td style="padding:8px 10px;">
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">
            <span style="font-size:9px;font-weight:700;color:var(--success);padding:1px 5px;background:rgba(40,167,69,.15);border-radius:3px;letter-spacing:.3px;">SRV</span>
            <span style="font-weight:700;color:var(--accent);font-size:12px;">${escHtml(item.folio)}</span>
          </div>
          <div style="font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;">${escHtml(item.clienteNombre)}</div>
          <div style="font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;">${escHtml(item.modelo)}${item.falla?' · '+escHtml(item.falla):''}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:1px;">Ant: <span style="color:var(--success);">${money(item.cobradoAnterior)}</span></div>
        </td>
        <td style="text-align:center;vertical-align:middle;padding:6px 4px;">
          <select style="width:100%;padding:4px 3px;font-size:11px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text1);cursor:pointer;"
            onchange="posUpdateSrvItem(${item.rowId},'concepto',this.value)">
            ${(posConceptosCobro.length ? posConceptosCobro : [
              {nombre:'Saldo',tipo:'fijo'},{nombre:'Anticipo',tipo:'fijo'},
              {nombre:'Mano de obra',tipo:'fijo'},{nombre:'Otro',tipo:'fijo'}
            ]).map(c => `<option value="${escHtml(c.nombre)}" ${item.concepto===c.nombre?'selected':''}>${escHtml(c.nombre)}${c.tipo==='liquidacion'?' ↩':''}</option>`).join('')}
          </select>
        </td>
        <td style="text-align:right;vertical-align:middle;padding:6px 4px;">
          <input type="number" class="pos-price-input" value="${(item.montoCobrar||0).toFixed(2)}" min="0" step="0.01"
            oninput="posUpdateSrvItem(${item.rowId},'montoCobrar',this.value)" onclick="this.select()">
        </td>
        <td style="text-align:right;vertical-align:middle;padding:6px 4px;">
          <input type="number" class="pos-price-input" value="${(item.costoRefaccion||0).toFixed(2)}" min="0" step="0.01"
            oninput="posUpdateSrvItem(${item.rowId},'costoRefaccion',this.value)" onclick="this.select()" style="opacity:.85;">
        </td>
        <td style="text-align:right;vertical-align:middle;padding:6px 8px;font-family:'Syne',sans-serif;font-weight:700;font-size:13px;color:var(--success);"
            id="pos-srv-sub-${item.rowId}">${money(srvTotal)}</td>
        <td style="text-align:center;vertical-align:middle;padding:6px 4px;">
          <button class="act-btn del" onclick="posRemoveItem(${item.rowId})" title="Quitar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  // Contadores
  const nProds = productItems.reduce((s,i) => s + i.cantidad, 0);
  const nSrvs  = serviceItems.length;
  $id('pos-items-count').textContent = nProds > 0 ? `${nProds} artículo${nProds!==1?'s':''}` : '0 artículos';
  $id('pos-srv-count').textContent   = nSrvs  > 0 ? `${nSrvs} servicio${nSrvs!==1?'s':''}` : '0 servicios';

  updateMiniRecibo();
}

function posUpdateItem(rowId, field, value) {
  const item = posCart.find(i => i.rowId === rowId);
  if (!item) return;
  if (field === 'cantidad') item.cantidad = Math.max(1, Math.floor(Number(value) || 1));
  else if (field === 'precioUnitario') item.precioUnitario = Math.max(0, Number(value) || 0);
  item.subtotal = Math.round(item.precioUnitario * item.cantidad * 100) / 100;
  const subEl = $id('pos-sub-' + rowId);
  if (subEl) subEl.textContent = money(item.subtotal);
  updatePOSTotals();
}

function posRemoveItem(rowId) {
  posCart = posCart.filter(i => i.rowId !== rowId);
  renderPOSCart();
  updatePOSTotals();
}

function clearPOSCart() {
  posCart = [];
  posNextRowId = 1;
  posClienteId = null;
  posClienteNombre = '';
  posListaInfo = null;
  if ($id('pos-cliente-input')) $id('pos-cliente-input').value = '';
  const infoDiv = $id('pos-lista-info');
  if (infoDiv) infoDiv.style.display = 'none';
  renderPOSCart();
  updatePOSTotals();
  showToast('Venta limpiada', 'info');
}

function updatePOSTotals() {
  const prodItems = posCart.filter(i => i.type !== 'servicio');
  const srvItems  = posCart.filter(i => i.type === 'servicio');
  const bruto     = prodItems.reduce((s, i) => s + i.precioOriginal * i.cantidad, 0);
  const prodTotal = prodItems.reduce((s, i) => s + i.subtotal, 0);
  const desc      = Math.max(0, bruto - prodTotal);
  const srvTotal  = srvItems.reduce((s, i) => s + (i.montoCobrar||0), 0);
  const grandTotal = prodTotal + srvTotal;
  if ($id('pos-subtotal'))  $id('pos-subtotal').textContent = money(bruto);
  if ($id('pos-descuento')) $id('pos-descuento').textContent = '-' + money(desc);
  const srvRow = $id('pos-srv-subtotal-row');
  const srvSubEl = $id('pos-srv-subtotal');
  if (srvRow) srvRow.style.display = srvTotal > 0 ? '' : 'none';
  if (srvSubEl) srvSubEl.textContent = money(srvTotal);
  if ($id('pos-total')) $id('pos-total').textContent = money(grandTotal);
  // Update service row subtotals inline
  srvItems.forEach(i => {
    const el = $id('pos-srv-sub-' + i.rowId);
    if (el) el.textContent = money((i.montoCobrar||0));
  });
  const cobrarBtn = $id('pos-cobrar-btn');
  if (cobrarBtn) cobrarBtn.innerHTML = `<i class="fa-solid fa-cash-register"></i> COBRAR ${money(grandTotal)}`;
  if (posSplitMode) updateSplitPendiente();
  updateMiniRecibo();
}

function updateMiniRecibo() {
  const prodItems = posCart.filter(i => i.type !== 'servicio');
  const srvItems  = posCart.filter(i => i.type === 'servicio');
  const reciboList  = $id('pos-recibo-list');
  const reciboCount = $id('pos-recibo-count');
  if (!reciboList) return;
  const totalLines = prodItems.length + srvItems.length;
  if (reciboCount) reciboCount.textContent = totalLines > 0 ? `${totalLines} línea${totalLines!==1?'s':''}` : '0 líneas';
  if (totalLines === 0) {
    reciboList.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:6px;padding:20px;opacity:0.4;">
      <i class="fa-solid fa-cart-shopping" style="font-size:24px;color:var(--text3);"></i>
      <span style="font-size:12px;color:var(--text3);">Carrito vacío</span>
    </div>`;
    return;
  }
  const prodRows = prodItems.map(i => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);">
      <div style="width:20px;height:20px;border-radius:4px;background:rgba(240,165,0,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="fa-solid fa-box" style="font-size:9px;color:var(--accent);"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(i.nombre)}</div>
        <div style="font-size:10px;color:var(--text3);">× ${i.cantidad} · ${money(i.precioUnitario)} c/u</div>
      </div>
      <div style="font-size:12px;font-weight:700;font-family:'Syne',sans-serif;color:var(--accent);flex-shrink:0;">${money(i.subtotal)}</div>
    </div>`).join('');
  const srvRows = srvItems.map(i => {
    const tot = (i.montoCobrar||0);
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);background:rgba(40,167,69,0.03);">
      <div style="width:20px;height:20px;border-radius:4px;background:rgba(40,167,69,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="fa-solid fa-screwdriver-wrench" style="font-size:9px;color:var(--success);"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:700;color:var(--accent);">${escHtml(i.folio)}</div>
        <div style="font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(i.clienteNombre)} · ${escHtml(i.modelo)}</div>
      </div>
      <div style="font-size:12px;font-weight:700;font-family:'Syne',sans-serif;color:var(--success);flex-shrink:0;">${money(tot)}</div>
    </div>`;
  }).join('');
  reciboList.innerHTML = prodRows + srvRows;
}

function selectPayMethod(btn, method) {
  posSelectedMethod = method;
  document.querySelectorAll('.pos-pay-btn').forEach(b => b.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
  if ($id('pos-credit-fields')) $id('pos-credit-fields').classList.toggle('show', method === 'credito');
  if (method === 'credito' && posCart.some(i => i.type === 'servicio')) {
    showToast('Los servicios no pueden cobrarse a crédito — se cobrarán en efectivo', 'info');
  }
}

// ── Split payment ──
function toggleSplitPago() {
  posSplitMode = !posSplitMode;
  $id('pos-single-pay').style.display = posSplitMode ? 'none' : '';
  $id('pos-split-pay').style.display  = posSplitMode ? '' : 'none';
  if (posSplitMode) {
    const prodItems = posCart.filter(i => i.type !== 'servicio');
    const srvItems  = posCart.filter(i => i.type === 'servicio');
    const total = prodItems.reduce((s, i) => s + i.subtotal, 0)
                + srvItems.reduce((s, i) => s + (i.montoCobrar||0), 0);
    posPagos = [{ metodo: 'efectivo', monto: total.toFixed(2) }];
    renderPagosSplit();
  }
}

function renderPagosSplit() {
  const container = $id('pos-split-rows');
  if (!container) return;
  const names = { efectivo: t('metodo.efectivo'), tarjeta: t('metodo.tarjeta'), transferencia: t('metodo.transferencia'), credito: t('metodo.credito') };
  container.innerHTML = posPagos.map((pago, idx) => `
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div class="pos-split-row">
        <select class="f-select" style="flex:1;padding:8px 12px;font-size:13px;"
          onchange="posPagos[${idx}].metodo=this.value;renderPagosSplit();">
          ${Object.entries(names).map(([v,l]) => `<option value="${v}"${pago.metodo===v?' selected':''}>${l}</option>`).join('')}
        </select>
        <input type="number" class="f-input" style="width:110px;text-align:right;padding:8px 10px;font-size:13px;"
          placeholder="0.00" min="0" step="0.01" value="${pago.monto}"
          onchange="posPagos[${idx}].monto=this.value;updateSplitPendiente();">
        ${posPagos.length > 1 ? `<button class="act-btn del" style="flex-shrink:0;" onclick="posPagos.splice(${idx},1);renderPagosSplit();" title="Quitar"><i class="fa-solid fa-xmark"></i></button>` : ''}
      </div>
      ${pago.metodo === 'credito' ? `
        <div style="padding:8px;background:rgba(240,165,0,0.05);border:1px solid rgba(240,165,0,0.15);border-radius:var(--radius-sm);">
          <label class="f-label" style="font-size:11px;margin-bottom:4px;">Fecha límite del crédito</label>
          <input type="date" class="f-input" style="font-size:13px;" value="${posCreditoFecha}"
            onchange="posCreditoFecha=this.value;">
        </div>` : ''}
    </div>`).join('');
  updateSplitPendiente();
}

function updateSplitPendiente() {
  const prodItems = posCart.filter(i => i.type !== 'servicio');
  const srvItems  = posCart.filter(i => i.type === 'servicio');
  const total  = prodItems.reduce((s, i) => s + i.subtotal, 0)
               + srvItems.reduce((s, i) => s + (i.montoCobrar||0), 0);
  const pagado  = posPagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const diff    = total - pagado;
  const el = $id('pos-split-pendiente');
  if (!el) return;
  if (Math.abs(diff) < 0.01) {
    el.textContent = '✓ Monto completo'; el.style.color = 'var(--success)';
  } else if (diff > 0) {
    el.textContent = `Pendiente: ${money(diff)}`; el.style.color = 'var(--danger)';
  } else {
    el.textContent = `Exceso: ${money(-diff)}`; el.style.color = 'var(--accent2)';
  }
}

function addSplitPago() {
  posPagos.push({ metodo: 'efectivo', monto: '' });
  renderPagosSplit();
}

async function cobrarVenta() {
  if (posCart.length === 0) { showToast('Agrega productos a la venta', 'error'); return; }
  const total = posCart.reduce((s, i) => s + i.subtotal, 0);

  if (posSplitMode) {
    const pagado = posPagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
    if (Math.abs(pagado - total) > 0.01) {
      showToast('El total de los pagos no coincide con el total de la venta', 'error'); return;
    }
    if (posPagos.some(p => p.metodo === 'credito') && !posClienteId) {
      showToast('El pago en crédito requiere asignar un cliente', 'error'); return;
    }
  } else if (posSelectedMethod === 'credito' && !posClienteId) {
    showToast('El pago en crédito requiere asignar un cliente', 'error'); return;
  }

  try {
    const venta = await api('POST', '/ventas', {
      items: posCart.map(i => ({ producto_id: i.productoId, cantidad: i.cantidad, precio_unitario: i.precioUnitario })),
      cliente_id: posClienteId || null,
      split: posSplitMode,
      metodo_pago: posSelectedMethod,
      pagos: posSplitMode ? posPagos.map(p => ({ metodo: p.metodo, monto: Number(p.monto) })) : [],
      fecha_limite_credito: posCreditoFecha || null
    });

    openVentaSuccessModal(venta);
    clearPOSCart();
    if (posSplitMode) { posSplitMode = false; $id('pos-single-pay').style.display=''; $id('pos-split-pay').style.display='none'; }
    posSelectedMethod = 'efectivo';
    document.querySelectorAll('.pos-pay-btn').forEach(b => b.classList.remove('selected'));
    const firstBtn = document.querySelector('.pos-pay-btn');
    if (firstBtn) firstBtn.classList.add('selected');
    if ($id('pos-credit-fields')) $id('pos-credit-fields').classList.remove('show');
    posCreditoFecha = '';
    // Refresh corte bar
    if (corteActivo) checkCorteActivo();
  } catch(e) {
    const msg = e.message || '';
    if (msg.toLowerCase().includes('local')) {
      showToast('Tu usuario no tiene un local asignado. Ve a Usuarios → edita tu perfil y asigna un local.', 'error');
    } else {
      showToast(msg || 'Error al cobrar', 'error');
    }
  }
}

lastVentaId = null;

function openVentaSuccessModal(venta) {
  const metodosLabel = { efectivo: t('metodo.efectivo'), tarjeta: t('metodo.tarjeta'), transferencia: t('metodo.transferencia'), credito: t('metodo.credito'), mixto: t('metodo.split') };
  lastVentaId = venta.id;
  $id('venta-success-folio').textContent  = venta.folio_venta;
  $id('venta-success-total').textContent  = money(venta.total);
  $id('venta-success-metodo').textContent = metodosLabel[venta.metodo_pago] || venta.metodo_pago;
  $id('venta-success-modal').classList.add('open');
}

function closeVentaSuccessModal() {
  $id('venta-success-modal').classList.remove('open');
}

async function printVentaTicket() {
  if (!lastVentaId) return;
  try {
    const data = await api('GET', '/ticket-venta/' + lastVentaId);
    const { venta, items, pagos, config, logo } = data;
    const cfg = config || {};
    const fmt = d => { if (!d) return '-'; const dt = new Date(d); return dt.toLocaleString('es-MX', { dateStyle:'short', timeStyle:'short' }); };
    const fmtMoney = n => '$' + Number(n || 0).toFixed(2);
    const metodosLabel = { efectivo: t('metodo.efectivo'), tarjeta: t('metodo.tarjeta'), transferencia: t('metodo.transferencia'), credito: t('metodo.credito'), mixto: t('metodo.split') };

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Ticket ${venta.folio_venta}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:monospace;font-size:12px;color:#000;background:#fff;width:72mm;margin:0 auto;padding:4mm;}
  .center{text-align:center;} .right{text-align:right;} .bold{font-weight:bold;}
  .line{border-top:1px dashed #000;margin:6px 0;}
  .row{display:flex;justify-content:space-between;margin:2px 0;}
  .logo{max-width:60mm;max-height:25mm;margin:0 auto 6px;display:block;}
  .total-row{font-size:15px;font-weight:bold;margin:4px 0;}
  table{width:100%;border-collapse:collapse;margin:4px 0;}
  th{text-align:left;font-size:11px;border-bottom:1px solid #000;padding:2px 0;}
  td{font-size:11px;padding:2px 0;vertical-align:top;}
  td.r{text-align:right;}
  .footer{text-align:center;margin-top:8px;font-size:11px;color:#333;}
  @media print{body{margin:0;}}
</style></head><body>`;

    // Logo
    if (cfg.ticket_venta_mostrar_logo && logo) {
      html += `<img class="logo" src="${logo}" alt="logo">`;
    }

    // Empresa
    if (cfg.ticket_venta_mostrar_empresa) {
      html += `<div class="center bold" style="font-size:14px;">${venta.empresa_nombre || ''}</div>`;
      if (venta.nombre_local) html += `<div class="center">${venta.nombre_local}</div>`;
      if (venta.empresa_calle) html += `<div class="center">${venta.empresa_calle}${venta.empresa_ciudad ? ', ' + venta.empresa_ciudad : ''}</div>`;
      if (venta.empresa_telefono) html += `<div class="center">Tel: ${venta.empresa_telefono}</div>`;
      if (venta.empresa_rfc) html += `<div class="center">RFC: ${venta.empresa_rfc}</div>`;
    }

    html += `<div class="line"></div>`;

    // Folio + Fecha
    if (cfg.ticket_venta_mostrar_folio) {
      html += `<div class="row"><span class="bold">Folio:</span><span>${venta.folio_venta}</span></div>`;
    }
    if (cfg.ticket_venta_mostrar_fecha) {
      html += `<div class="row"><span>Fecha:</span><span>${fmt(venta.fecha_finalizacion || venta.fecha)}</span></div>`;
    }
    if (cfg.ticket_venta_mostrar_cliente && venta.cliente_nombre) {
      html += `<div class="row"><span>Cliente:</span><span>${venta.cliente_nombre}</span></div>`;
    }
    if (venta.usuario_nombre) {
      html += `<div class="row"><span>Cajero:</span><span>${venta.usuario_nombre}</span></div>`;
    }

    // Items
    if (cfg.ticket_venta_mostrar_items && items && items.length > 0) {
      html += `<div class="line"></div>`;
      html += `<table><thead><tr><th>Producto</th><th class="r">Cant</th><th class="r">P.U.</th><th class="r">Total</th></tr></thead><tbody>`;
      for (const it of items) {
        html += `<tr>
          <td>${it.producto_nombre}${it.codigo ? '<br><small style="color:#666;">' + it.codigo + '</small>' : ''}</td>
          <td class="r">${it.cantidad}</td>
          <td class="r">${fmtMoney(it.precio_unitario)}</td>
          <td class="r">${fmtMoney(it.subtotal)}</td>
        </tr>`;
      }
      html += `</tbody></table>`;
    }

    html += `<div class="line"></div>`;
    if (venta.descuento > 0) {
      html += `<div class="row"><span>Descuento:</span><span>-${fmtMoney(venta.descuento)}</span></div>`;
    }
    html += `<div class="row total-row"><span>TOTAL:</span><span>${fmtMoney(venta.total)}</span></div>`;

    // Pagos
    if (cfg.ticket_venta_mostrar_metodo && pagos && pagos.length > 0) {
      html += `<div class="line"></div>`;
      for (const p of pagos) {
        html += `<div class="row"><span>${metodosLabel[p.metodo] || p.metodo}:</span><span>${fmtMoney(p.monto)}</span></div>`;
      }
    }

    // Footer
    const footer = cfg.ticket_venta_footer || 'Gracias por su compra';
    if (footer) {
      html += `<div class="line"></div><div class="footer">${footer}</div>`;
    }

    html += `</body></html>`;

    const win = window.open('', '_blank', 'width=320,height=600');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => { win.print(); };
    }
  } catch(e) { showToast('Error al generar ticket: ' + e.message, 'error'); }
}

// --- Productos ---
// ===== PRODUCTOS CRUD =====
// Smart pagination renderer — shows max ~7 elements, uses ellipsis
function renderPagination(container, current, total, onChange) {
  container.innerHTML = '';
  if (total <= 1) return;

  const mkBtn = (label, page, isActive, disabled, isIcon) => {
    const btn = document.createElement('button');
    btn.className = 'pag-btn' + (isActive ? ' active' : '') + (disabled ? ' disabled' : '');
    btn.innerHTML = label;
    btn.disabled = disabled;
    btn.style.minWidth = isIcon ? '32px' : '';
    if (!disabled && !isActive) btn.onclick = () => onChange(page);
    return btn;
  };
  const mkEllipsis = () => {
    const s = document.createElement('span');
    s.textContent = '…';
    s.style.cssText = 'padding:0 4px;color:var(--text3);align-self:center;font-size:13px;';
    return s;
  };

  // Prev
  container.appendChild(mkBtn('<i class="fa-solid fa-chevron-left"></i>', current - 1, false, current === 1, true));

  // Build page range
  const delta = 2; // pages around current
  const pages = [];
  const range = new Set([1, total]);
  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) range.add(i);
  [...range].sort((a, b) => a - b).forEach(p => pages.push(p));

  let prev = 0;
  pages.forEach(p => {
    if (p - prev > 1) container.appendChild(mkEllipsis());
    container.appendChild(mkBtn(p, p, p === current, false, false));
    prev = p;
  });

  // Next
  container.appendChild(mkBtn('<i class="fa-solid fa-chevron-right"></i>', current + 1, false, current === total, true));
}

async function loadProductos() {
  const isRoot = currentUserData?.tipo === 'root';
  const isAdmin = isRoot || currentUserData?.tipo === 'admin';
  const q          = $id('search-productos')?.value || '';
  const empFilter  = $id('filter-productos-empresa');
  const locFilter  = $id('filter-productos-local');
  const tipoFilter = $id('filter-productos-tipo');
  const stockFilter= $id('filter-productos-stock');
  const sortSel    = $id('filter-productos-sort');

  if (isRoot) {
    empFilter.style.display = '';
    locFilter.style.display = '';
    if (empFilter.options.length <= 1) {
      if (allEmpresas.length === 0) { try { allEmpresas = (await api('GET', '/empresas?limit=1000')).data || []; } catch(e) {} }
      allEmpresas.forEach(e => { const o = document.createElement('option'); o.value = e.id; o.textContent = e.nombre; empFilter.appendChild(o); });
    }
  }

  // Populate tipos filter once
  if (tipoFilter && tipoFilter.options.length <= 1 && allTiposProducto.length > 0) {
    allTiposProducto.forEach(tp => {
      const o = document.createElement('option'); o.value = tp.id; o.textContent = tp.nombre; tipoFilter.appendChild(o);
    });
  }

  try {
    PROD_LIMIT = parseInt($id('prod-per-page')?.value) || PROD_LIMIT;
    let url = `/productos?page=${productosPage}&limit=${PROD_LIMIT}`;
    if (q)                    url += '&q='          + encodeURIComponent(q);
    if (empFilter?.value)     url += '&empresa_id=' + empFilter.value;
    if (locFilter?.value)     url += '&local_id='   + locFilter.value;
    if (tipoFilter?.value)    url += '&tipo='        + encodeURIComponent(tipoFilter.value);
    if (stockFilter?.value)   url += '&stock='       + stockFilter.value;
    if (sortSel?.value)       url += '&sort='        + sortSel.value;

    if (window.activeNotifFilter === 'stock_bajo') {
      url += '&notif=' + window.activeNotifFilter;
    }

    tableLoading($id('productos-tbody'), 10);
    const { data, total, page } = await api('GET', url);
    productosPage = page;

    const canEdit   = isAdmin || hasPermiso('productos', 'editar');
    const canDelete = isAdmin || hasPermiso('productos', 'borrar');
    const pages = Math.ceil(total / PROD_LIMIT) || 1;

    // Info text with active filter indicator
    const hasFilter = q || tipoFilter?.value || stockFilter?.value;
    $id('productos-table-info').textContent =
      `${total} ${total !== 1 ? 'registros' : 'registro'}` +
      (pages > 1 ? ` · Pág ${productosPage} de ${pages}` : '');

    // Show/hide clear button
    const clearBtn = $id('btn-clear-prod-filters');
    if (clearBtn) clearBtn.style.opacity = hasFilter ? '1' : '0.4';

    const tbody = $id('productos-tbody');
    const rowCls = rowAlertClass('stock_bajo');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><i class="fa-solid fa-boxes-stacked"></i><p>Sin productos encontrados</p></div></td></tr>';
    } else {
      tbody.innerHTML = data.map(p => {
        const tipoBadge = (() => {
          const tp = allTiposProducto.find(t => t.id === p.tipo);
          return tp
            ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${tp.color}22;color:${tp.color};border:1px solid ${tp.color}44;"><span style="width:6px;height:6px;border-radius:50%;background:${tp.color};flex-shrink:0;"></span>${escHtml(tp.nombre)}</span>`
            : '<span style="color:var(--text3);font-size:12px;">—</span>';
        })();
        const stockStyle = p.existencia <= 0
          ? 'background:rgba(255,71,87,.12);color:var(--danger);'
          : p.existencia <= 5
            ? 'background:rgba(240,165,0,.12);color:var(--accent);'
            : 'background:var(--bg3);';
        return `<tr class="${rowCls}">
          <td class="col-priority-1"><span style="font-family:monospace;font-size:12px;font-weight:700;color:var(--text2);">${escHtml(p.folio || '-')}</span></td>
          <td class="col-priority-2">${tipoBadge}</td>
          <td class="col-priority-1"><div class="td-name">${escHtml(p.nombre || '-')}</div></td>
          <td class="col-priority-3"><span style="font-family:monospace;font-size:12px;">${escHtml(p.codigo || '-')}</span></td>
          <td class="col-priority-2">${money(p.compra)}</td>
          <td class="col-priority-1"><span class="text-accent fw-bold">${money(p.venta)}</span></td>
          <td class="col-priority-2"><span style="padding:3px 10px;border-radius:6px;font-size:13px;font-weight:600;${stockStyle}">${p.existencia ?? 0}</span></td>
          <td class="col-priority-3">${escHtml(p.local_nombre || '-')}</td>
          <td class="col-priority-1" style="text-align:center;">
            ${p.codigo ? `<canvas class="qr-mini" data-code="${p.codigo.replace(/"/g,'&quot;')}" data-name="${(p.nombre||'').replace(/"/g,'&quot;')}" data-price="${p.venta}" data-id="${p.id}" style="width:40px;height:40px;cursor:pointer;" onclick="openLabelModal(this)" title="Imprimir etiqueta"></canvas>` : '<span style="color:var(--text3);font-size:12px;">—</span>'}
          </td>
          <td class="col-priority-1">
            <div class="td-actions">
              ${canEdit   ? `<button class="act-btn edit" onclick="openProductoModal(${p.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>` : ''}
              ${canDelete ? `<button class="act-btn del" onclick="askDeleteProducto(${p.id}, '${(p.nombre||'').replace(/'/g, "\\'")}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
          </td>
        </tr>`;
      }).join('');

      // Generate QR codes for each mini canvas
      setTimeout(() => {
        document.querySelectorAll('.qr-mini').forEach(canvas => {
          const code = canvas.getAttribute('data-code');
          if (code && typeof QRCode !== 'undefined') {
            QRCode.toCanvas(canvas, code, { width: 40, margin: 0, color: { dark: '#000', light: '#fff' } }, err => {
              if (err) console.warn('QR error:', err);
            });
          }
        });
      }, 50);
    }

    renderPagination($id('productos-pag-btns'), productosPage, pages, p => { productosPage = p; loadProductos(); });
  } catch(e) { showToast(e.message, 'error'); }
}

function filterProductos() { productosPage = 1; loadProductos(); }

function clearProductosFilters() {
  const s = $id('search-productos'); if (s) s.value = '';
  const t = $id('filter-productos-tipo'); if (t) t.value = '';
  const st = $id('filter-productos-stock'); if (st) st.value = '';
  const so = $id('filter-productos-sort'); if (so) so.value = 'reciente';
  filterProductos();
}

async function onFilterProductosEmpresa() {
  const empId = $id('filter-productos-empresa').value;
  const locSel = $id('filter-productos-local');
  locSel.innerHTML = `<option value="">${t('prod.filter.all.locales')}</option>`;
  if (empId) {
    try {
      const locales = await api('GET', '/empresas/' + empId + '/locales');
      locales.forEach(l => { const o = document.createElement('option'); o.value = l.id; o.textContent = l.nombre_local; locSel.appendChild(o); });
    } catch(e) {}
  }
  filterProductos();
}

async function openProductoModal(id = null) {
  editingProductoId = id;
  $id('producto-modal-title').textContent = id ? 'Editar Producto' : 'Nuevo Producto';
  $id('btn-save-producto-label').textContent = id ? 'Actualizar' : 'Guardar producto';

  ['fp-sku','fp-codigo','fp-prod-nombre','fp-compra','fp-venta','fp-existencia'].forEach(f => { const e=$id(f); if(e) e.value=''; });
  $id('fp-folio').value = '';
  $id('fp-folio-group').style.display = 'none';
  if (allTiposProducto.length === 0) await loadTiposProductos();
  populateTipoProductoSelect('');

  const tipo = currentUserData.tipo;
  const canEditLocal = (tipo === 'root' || tipo === 'admin');
  const userLocalId = currentUserData.local_id || currentUserData.localId;

  // Populate local dropdown
  const localSel = $id('fp-local-id');
  localSel.innerHTML = '<option value="">-- Seleccionar local --</option>';
  try {
    if (canEditLocal) {
      // Admin/Root: show all locales dropdown, editable
      $id('fp-local-group').style.display = '';
      localSel.disabled = false;
      const empId = currentUserData.empresa_id || currentUserData.empresaId;
      const locales = await api('GET', '/empresas/' + empId + '/locales');
      locales.forEach(l => { const o = document.createElement('option'); o.value = l.id; o.textContent = l.nombre_local; localSel.appendChild(o); });
      if (userLocalId) localSel.value = userLocalId;
      // Auto-select first local if none pre-assigned (e.g. admin)
      if (!localSel.value && locales.length) localSel.value = locales[0].id;
    } else {
      // Empleado: local is assigned automatically — hide the field
      $id('fp-local-group').style.display = 'none';
      localSel.innerHTML = '';
      const o = document.createElement('option');
      o.value = userLocalId;
      localSel.appendChild(o);
      localSel.value = userLocalId;
    }
  } catch(e) {}

  if (id) {
    try {
      const p = await api('GET', '/productos/' + id);
      if (p.folio) { $id('fp-folio').value = p.folio; $id('fp-folio-group').style.display = ''; }
      populateTipoProductoSelect(p.tipo || '');
      $id('fp-sku').value    = p.sku    || '';
      $id('fp-codigo').value = p.codigo || '';
      $id('fp-prod-nombre').value = p.nombre || '';
      $id('fp-compra').value    = p.compra    || '';
      $id('fp-venta').value = p.venta || '';
      $id('fp-existencia').value = p.existencia ?? 0;
      if (p.local_id && canEditLocal) localSel.value = p.local_id;
    } catch(er) { showToast(er.message, 'error'); return; }
  }
  const printBtn = $id('btn-print-etiqueta');
  if (printBtn) printBtn.style.display = id ? '' : 'none';
  $id('producto-modal').classList.add('open');
}

function closeProductoModal() {
  $id('producto-modal').classList.remove('open');
  editingProductoId = null;
}

async function saveProducto() {
  const nombre = $id('fp-prod-nombre').value.trim();
  if (!nombre) { showToast('El nombre es requerido', 'error'); return; }
  const ventaEl = $id('fp-venta');
  const venta = ventaEl ? parseFloat(ventaEl.value) : 0;
  if (isNaN(venta) || venta <= 0) { showToast('El precio de venta es requerido', 'error'); return; }

  const localId = parseInt($id('fp-local-id').value);
  if (!localId) { showToast('Selecciona un local', 'error'); return; }

  const body = {
    tipo:       $id('fp-tipo-producto').value || null,
    sku:        $id('fp-sku').value.trim()    || null,
    codigo:     $id('fp-codigo').value.trim() || '',
    nombre,
    compra:     parseFloat($id('fp-compra').value) || 0,
    venta,
    existencia: parseInt($id('fp-existencia').value) || 0,
    local_id:   localId,
  };

  const saveBtn = document.querySelector('#producto-modal .btn-accent');
  btnLoading(saveBtn, true);
  try {
    if (editingProductoId) {
      await api('PUT', '/productos/' + editingProductoId, body);
      showToast('Producto actualizado', 'success');
    } else {
      await api('POST', '/productos', body);
      showToast('Producto creado', 'success');
    }
    closeProductoModal();
    loadProductos();
  } catch(e) { showToast(e.message, 'error'); }
  finally { btnLoading(saveBtn, false); }
}

async function askDeleteProducto(id, nombre) {
  if (!confirm('¿Eliminar el producto "' + nombre + '"?\n\nEsta acción no se puede deshacer.')) return;
  try {
    await api('DELETE', '/productos/' + id);
    showToast('Producto eliminado', 'success');
    loadProductos();
  } catch(e) { showToast(e.message, 'error'); }
}

// ===== LABEL (ETIQUETA) =====
labelTipoImpresion = 'qr'; // 'qr' | 'barcode'
labelCurrentCode = '';

// ── Code128B encoder (sin dependencias externas) ──────────────────
function drawCode128(canvas, text) {
  const T = [
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132133','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
    '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
    '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
    '114131','311141','411131','211412','211214','211232','2331112'
  ];
  const codes = [104]; // Start B
  let sum = 104;
  for (let i = 0; i < text.length; i++) {
    const v = text.charCodeAt(i) - 32;
    if (v < 0 || v > 95) continue;
    codes.push(v);
    sum += (i + 1) * v;
  }
  codes.push(sum % 103); // checksum
  codes.push(106);       // Stop

  const mw = 2; // módulo width en px
  const barH = 60;
  const quiet = 10;
  let totalW = quiet * 2;
  for (const c of codes) totalW += T[c].split('').reduce((a,d) => a + parseInt(d), 0) * mw;

  canvas.width  = totalW;
  canvas.height = barH + 16;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';

  let x = quiet;
  for (const c of codes) {
    const pattern = T[c];
    let isBar = true;
    for (const ch of pattern) {
      const w = parseInt(ch) * mw;
      if (isBar) ctx.fillRect(x, 0, w, barH);
      x += w;
      isBar = !isBar;
    }
  }
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, barH + 13);
}

function switchLabelTipo(tipo) {
  labelTipoImpresion = tipo;
  const qrBtn = $id('lbl-btn-qr');
  const bcBtn = $id('lbl-btn-barcode');
  const qrC   = $id('label-qr');
  const bcC   = $id('label-barcode');
  const base  = 'flex:1;padding:7px;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;';
  if (tipo === 'qr') {
    qrBtn.style.cssText = base + 'background:var(--accent);color:#fff;';
    bcBtn.style.cssText = base + 'background:transparent;color:var(--text2);';
    qrC.style.display = labelCurrentCode ? 'block' : 'none';
    bcC.style.display = 'none';
  } else {
    bcBtn.style.cssText = base + 'background:var(--accent);color:#fff;';
    qrBtn.style.cssText = base + 'background:transparent;color:var(--text2);';
    qrC.style.display = 'none';
    bcC.style.display = labelCurrentCode ? 'block' : 'none';
    if (labelCurrentCode) drawCode128(bcC, labelCurrentCode);
  }
}

function _applyLabelData(name, code, price) {
  labelCurrentCode = code || '';
  const cfg = currentConfig || {};
  const showNombre = cfg.etiqueta_mostrar_nombre !== 0;
  const showCodigo = cfg.etiqueta_mostrar_codigo !== 0;
  const showPrecio = cfg.etiqueta_mostrar_precio !== 0;
  const labelW = cfg.etiqueta_ancho || 40;
  const labelH = cfg.etiqueta_alto  || 30;
  const preview = $id('label-preview');
  preview.style.width    = labelW + 'mm';
  preview.style.minHeight = labelH + 'mm';
  $id('label-nombre').textContent  = name  || '';
  $id('label-nombre').style.display = showNombre ? '' : 'none';
  $id('label-codigo').textContent  = code  || '';
  $id('label-codigo').style.display = (showCodigo && code) ? '' : 'none';
  $id('label-precio').textContent  = showPrecio ? money(price) : '';
  $id('label-precio').style.display = showPrecio ? '' : 'none';

  // QR
  const qrC = $id('label-qr');
  if (labelTipoImpresion === 'qr') {
    qrC.style.display = code ? 'block' : 'none';
    if (code && typeof QRCode !== 'undefined') {
      QRCode.toCanvas(qrC, code, { width: 80, margin: 1, color: { dark: '#000', light: '#fff' } }, err => {
        if (err) console.warn('QR label error:', err);
      });
    }
    $id('label-barcode').style.display = 'none';
  } else {
    qrC.style.display = 'none';
    const bcC = $id('label-barcode');
    bcC.style.display = code ? 'block' : 'none';
    if (code) drawCode128(bcC, code);
  }
}

function openLabelModal(canvasEl) {
  _applyLabelData(
    canvasEl.getAttribute('data-name'),
    canvasEl.getAttribute('data-code'),
    canvasEl.getAttribute('data-price')
  );
  $id('label-modal').classList.add('open');
}

function closeLabelModal() {
  $id('label-modal').classList.remove('open');
  labelTipoImpresion = 'qr';
  switchLabelTipo('qr');
}

function printLabel() {
  const preview = $id('label-preview');
  const cfg = currentConfig || {};
  const labelW = cfg.etiqueta_ancho || 40;
  const labelH = cfg.etiqueta_alto || 30;
  const clone = preview.cloneNode(true);
  preview.querySelectorAll('canvas').forEach((orig, i) => {
    const img = document.createElement('img');
    img.src = orig.toDataURL('image/png');
    img.style.cssText = orig.style.cssText;
    clone.querySelectorAll('canvas')[i].replaceWith(img);
  });
  const win = window.open('', '_blank', 'width=400,height=400');
  win.document.write('<!DOCTYPE html><html><head><style>' +
    '@page { size: ' + labelW + 'mm ' + labelH + 'mm; margin: 0; }' +
    'body { margin:0; padding:2mm; display:flex; align-items:center; justify-content:center; font-family:Arial,sans-serif; }' +
    '.label-wrap { text-align:center; width:100%; }' +
    '</style></head><body><div class="label-wrap">' + clone.innerHTML + '</div></body></html>');
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); win.close(); }, 400);
}

// Abre el modal de etiqueta directamente desde los datos del formulario de producto
function printEtiquetaFromModal() {
  const nombre = $id('fp-prod-nombre').value.trim();
  const codigo = $id('fp-codigo').value.trim();
  const precio = parseFloat($id('fp-venta').value) || 0;
  _applyLabelData(nombre, codigo, precio);
  $id('label-modal').classList.add('open');
}

// ===== FOLIO QR MODAL =====
function openFolioModal(canvasEl) {
  const folio = canvasEl.getAttribute('data-folio');
  $id('folio-qr-text').textContent = folio || '';
  const qrCanvas = $id('folio-qr-canvas');
  if (folio && typeof QRCode !== 'undefined') {
    QRCode.toCanvas(qrCanvas, folio, { width: 160, margin: 2, color: { dark: '#000', light: '#ffffff' } }, function(err) {
      if (err) console.warn('QR folio modal error:', err);
    });
  }
  $id('folio-qr-modal').classList.add('open');
}

function closeFolioModal() {
  $id('folio-qr-modal').classList.remove('open');
}

function printFolioQR() {
  const preview = $id('folio-qr-preview');
  const clone = preview.cloneNode(true);
  preview.querySelectorAll('canvas').forEach((orig, i) => {
    const img = document.createElement('img');
    img.src = orig.toDataURL('image/png');
    img.style.cssText = orig.style.cssText;
    clone.querySelectorAll('canvas')[i].replaceWith(img);
  });
  const win = window.open('', '_blank', 'width=300,height=300');
  win.document.write('<!DOCTYPE html><html><head><style>' +
    '@page { size: 60mm 60mm; margin: 0; }' +
    'body { margin:0; padding:4mm; display:flex; align-items:center; justify-content:center; font-family:Arial,sans-serif; }' +
    '.wrap { text-align:center; width:100%; }' +
    '</style></head><body><div class="wrap">' + clone.innerHTML + '</div></body></html>');
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); win.close(); }, 400);
}

// ===== QR SCANNER =====
qrScanner = null;
qrScanTarget = null;

function openQRScanner(target) {
  qrScanTarget = target;
  $id('qr-scanner-modal').classList.add('open');

  setTimeout(function() {
    if (typeof Html5Qrcode === 'undefined') {
      showToast('Librería de escaneo no disponible', 'error');
      closeQRScanner();
      return;
    }
    qrScanner = new Html5Qrcode('qr-reader');
    qrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      function(decodedText) { onQRScanned(decodedText); },
      function() { /* scanning... */ }
    ).catch(function(err) {
      showToast('No se pudo acceder a la cámara: ' + err, 'error');
      closeQRScanner();
    });
  }, 300);
}

function onQRScanned(code) {
  closeQRScanner();
  if (qrScanTarget === 'productos') {
    $id('search-productos').value = code;
    filterProductos();
  } else if (qrScanTarget === 'servicios') {
    $id('search-input').value = code;
    filterTable();
  } else if (qrScanTarget === 'pos') {
    $id('pos-barcode-input').value = code;
    addProductToPOS(code);
  }
  showToast('Código escaneado: ' + code, 'success');
}

function closeQRScanner() {
  if (qrScanner) {
    try {
      qrScanner.stop().then(function() {
        try { qrScanner.clear(); } catch(e) {}
        qrScanner = null;
      }).catch(function() { qrScanner = null; });
    } catch(e) { qrScanner = null; }
  }
  $id('qr-scanner-modal').classList.remove('open');
}


// ===== POS UNIFICADO (PRODUCTOS + SERVICIOS) =====
_unifiedAcDebounce = null;

function debounceUnifiedSearch(q) {
  const ac = $id('pos-unified-ac');
  if (!q || q.trim().length < 2) { if(ac) ac.style.display='none'; return; }
  clearTimeout(_unifiedAcDebounce);
  _unifiedAcDebounce = setTimeout(() => doUnifiedSearch(q.trim()), 280);
}

async function doUnifiedSearch(q) {
  const ac = $id('pos-unified-ac');
  if (!ac) return;
  try {
    const [prods, srvs] = await Promise.all([
      api('GET', '/productos?q=' + encodeURIComponent(q) + '&limit=5').catch(() => ({ data: [] })),
      api('GET', '/servicios?q=' + encodeURIComponent(q) + '&limit=5').catch(() => ({ data: [] }))
    ]);
    const pItems = (prods.data || []);
    const sItems = (srvs.data || []);
    if (pItems.length === 0 && sItems.length === 0) {
      ac.style.display = 'none'; return;
    }
    let html = '';
    if (pItems.length > 0) {
      html += `<div style="padding:6px 12px;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;background:var(--bg2);">Productos</div>`;
      html += pItems.map(p => `
        <div class="pos-ac-item" onclick="addProductToPOSById(${p.id})" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border-light, var(--border));">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span style="font-weight:600;font-size:13px;">${escHtml(p.nombre)}</span>
              <span style="font-size:11px;color:var(--text3);margin-left:8px;">${escHtml(p.codigo||'')}</span>
            </div>
            <span style="font-weight:700;color:var(--accent);">${money(p.venta||0)}</span>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:1px;">Stock: ${p.stock ?? '—'}</div>
        </div>`).join('');
    }
    if (sItems.length > 0) {
      html += `<div style="padding:6px 12px;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;background:var(--bg2);">Servicios</div>`;
      html += sItems.map(s => {
        const saldo = Math.max(0, (s.costo_total||0) - (s.total_cobrado||0));
        return `
        <div class="pos-ac-item" onclick="addServiceToPOS(${s.id})" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border-light, var(--border));">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span style="font-size:11px;font-weight:700;color:var(--success);padding:1px 6px;background:rgba(40,167,69,.12);border-radius:3px;margin-right:6px;">SRV</span>
              <span style="font-weight:600;font-size:13px;">${escHtml(s.folio)}</span>
              <span style="font-size:12px;color:var(--text2);margin-left:6px;">${escHtml(s.cliente_nombre||'—')}</span>
            </div>
            <span style="font-weight:700;color:var(--success);">Saldo: ${money(saldo)}</span>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:1px;">${escHtml(s.modelo||'')} · ${escHtml(s.estado||'')}</div>
        </div>`;
      }).join('');
    }
    ac.innerHTML = html;
    ac.style.display = '';
  } catch(e) { if(ac) ac.style.display='none'; }
}

function closeUnifiedAc() {
  const ac = $id('pos-unified-ac');
  if (ac) ac.style.display = 'none';
  const inp = $id('pos-barcode-input');
  if (inp) inp.value = '';
}

async function addProductToPOSById(id) {
  closeUnifiedAc();
  try {
    const prod = await api('GET', '/productos/' + id);
    const pct = posListaInfo ? posListaInfo.descuento_porcentaje : 0;
    const precioFinal = pct > 0 ? Math.round(prod.venta * (1 - pct / 100) * 100) / 100 : prod.venta;
    const existing = posCart.find(i => i.type !== 'servicio' && i.productoId === prod.id);
    if (existing) {
      existing.cantidad += 1;
      existing.subtotal = Math.round(existing.precioUnitario * existing.cantidad * 100) / 100;
      showToast(prod.nombre + ' ×' + existing.cantidad, 'success');
    } else {
      posCart.push({ type:'producto', rowId: posNextRowId++, productoId: prod.id, codigo: prod.codigo, nombre: prod.nombre, precioOriginal: prod.venta, precioUnitario: precioFinal, cantidad: 1, subtotal: Math.round(precioFinal * 100) / 100 });
      showToast('+ ' + prod.nombre, 'success');
    }
    renderPOSCart();
    updatePOSTotals();
  } catch(e) { showToast(e.message || 'Error al agregar producto', 'error'); }
}

async function addServiceToPOS(id) {
  closeUnifiedAc();
  if (posCart.find(i => i.type === 'servicio' && i.servicioId === id)) {
    showToast('Este servicio ya está en la caja', 'info'); return;
  }
  try {
    const srv = await api('GET', '/servicios/' + id);
    const cobradoAnterior = srv.anticipo || 0;
    const saldo = Math.max(0, (srv.costo_total||0) - cobradoAnterior);
    const initCfg = posConceptosCobro.length ? posConceptosCobro[0] : null;
    const initMonto = initCfg
      ? (initCfg.tipo === 'liquidacion' ? saldo : (Number(initCfg.valor) || 0))
      : saldo;
    posCart.push({
      type: 'servicio',
      rowId: posNextRowId++,
      servicioId: srv.id,
      folio: srv.folio,
      clienteNombre: srv.cliente_nombre || '—',
      modelo: srv.modelo || '',
      falla: srv.falla || '',
      cobradoAnterior,
      saldo,
      montoCobrar: initMonto,
      costoRefaccion: 0,
      concepto: initCfg ? initCfg.nombre : 'Saldo',
      descripcion: ''
    });
    // Auto-assign client from service if none set
    if (srv.cliente_id && !posClienteId) {
      posClienteId = srv.cliente_id;
      posClienteNombre = srv.cliente_nombre || '';
      const clienteInput = $id('pos-cliente-input');
      if (clienteInput) clienteInput.value = posClienteNombre;
    }
    renderPOSCart();
    updatePOSTotals();
    showToast('+ Servicio ' + srv.folio, 'success');
  } catch(e) { showToast(e.message || 'Error al cargar servicio', 'error'); }
}

function posUpdateSrvItem(rowId, field, value) {
  const item = posCart.find(i => i.rowId === rowId);
  if (!item || item.type !== 'servicio') return;
  if (field === 'montoCobrar') {
    item.montoCobrar = Math.max(0, parseFloat(value) || 0);
  } else if (field === 'costoRefaccion') {
    item.costoRefaccion = Math.max(0, parseFloat(value) || 0);
  } else if (field === 'concepto') {
    item.concepto = value;
    // Autofill amount based on concept configuration
    const cfg = posConceptosCobro.find(c => c.nombre === value);
    if (cfg) {
      const autoMonto = cfg.tipo === 'liquidacion' ? item.saldo : (Number(cfg.valor) || 0);
      item.montoCobrar = autoMonto;
      // Update the monto input in the DOM without re-rendering the whole table
      const input = document.querySelector(`input[oninput*="posUpdateSrvItem(${rowId},'montoCobrar'"]`);
      if (input) input.value = autoMonto.toFixed(2);
    }
  } else if (field === 'descripcion') {
    item.descripcion = value;
  }
  updatePOSTotals();
}

function posCobrar() {
  cobrarUnificado();
}

function cobrarUnificado() {
  const productItems = posCart.filter(i => i.type !== 'servicio');
  const serviceItems = posCart.filter(i => i.type === 'servicio');
  if (productItems.length === 0 && serviceItems.length === 0) {
    showToast('La caja está vacía', 'info'); return;
  }
  for (const s of serviceItems) {
    if ((s.montoCobrar||0) <= 0) {
      showToast(`Ingresa un monto para el servicio ${s.folio}`, 'error'); return;
    }
  }
  // Products only → existing flow (no confirmation modal needed)
  if (serviceItems.length === 0) { cobrarVenta(); return; }
  // Split mode: validate amounts match before opening modal
  if (posSplitMode) {
    const prodTotal = productItems.reduce((s, i) => s + i.subtotal, 0);
    const srvTotal  = serviceItems.reduce((s, i) => s + (i.montoCobrar||0), 0);
    const grandTotal = prodTotal + srvTotal;
    const pagado = posPagos.reduce((s, p) => s + (Number(p.monto)||0), 0);
    if (Math.abs(pagado - grandTotal) > 0.01) {
      showToast(`El total de pagos (${money(pagado)}) no coincide con el total (${money(grandTotal)})`, 'error'); return;
    }
  }
  // Show confirmation modal
  showPosConfirmarModal();
}

function showPosConfirmarModal() {
  const productItems = posCart.filter(i => i.type !== 'servicio');
  const serviceItems = posCart.filter(i => i.type === 'servicio');
  const metodo       = posSelectedMethod || 'efectivo';
  const isCredito    = metodo === 'credito';
  const metodosLabel = { efectivo:'Efectivo', tarjeta:'Tarjeta', transferencia:'Transferencia', credito:'Crédito' };
  const prodTotal    = productItems.reduce((s, i) => s + i.subtotal, 0);
  const srvTotal     = serviceItems.reduce((s, i) => s + (i.montoCobrar||0), 0);
  const grandTotal   = prodTotal + srvTotal;

  let html = '';
  if (productItems.length > 0) {
    html += `<div>
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Productos</div>`;
    html += productItems.map(i => `
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid var(--bg3);">
        <span>${escHtml(i.nombre)} <span style="color:var(--text3);">×${i.cantidad}</span></span>
        <span style="font-weight:600;">${money(i.subtotal)}</span>
      </div>`).join('');
    html += `<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0 0;font-weight:700;">
        <span>Subtotal</span><span style="color:var(--accent);">${money(prodTotal)}</span>
      </div></div>`;
  }
  if (serviceItems.length > 0) {
    html += `<div>
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Servicios</div>`;
    const srvMetodoModal = posSplitMode && posPagos.length > 0
      ? (posPagos.filter(p => p.metodo !== 'credito' && Number(p.monto) > 0)
          .sort((a, b) => Number(b.monto) - Number(a.monto))[0]?.metodo || 'efectivo')
      : (metodo === 'credito' ? 'efectivo' : metodo);
    html += serviceItems.map(s => {
      const t = (s.montoCobrar||0);
      return `<div style="padding:8px 10px;background:rgba(40,167,69,.05);border:1px solid rgba(40,167,69,.15);border-radius:6px;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;">
          <span style="color:var(--accent);">${escHtml(s.folio)}</span>
          <span style="color:var(--success);">${money(t)}</span>
        </div>
        <div style="font-size:12px;color:var(--text2);">${escHtml(s.clienteNombre)} · ${escHtml(s.modelo)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px;display:flex;gap:8px;flex-wrap:wrap;">
          ${s.montoCobrar > 0 ? `<span>Cobro: ${money(s.montoCobrar)}</span>` : ''}
          ${(s.costoRefaccion||0) > 0 ? `<span>Pieza: ${money(s.costoRefaccion)}</span>` : ''}
          <span style="margin-left:auto;font-weight:600;color:var(--text2);">${metodosLabel[srvMetodoModal]||srvMetodoModal}</span>
        </div>
      </div>`;
    }).join('');
    html += `<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0 0;font-weight:700;">
        <span>Subtotal</span><span style="color:var(--success);">${money(srvTotal)}</span>
      </div></div>`;
  }
  html += `<div style="display:flex;justify-content:space-between;padding:12px 0 0;border-top:2px solid var(--border);font-family:'Syne',sans-serif;font-weight:800;font-size:17px;">
    <span>TOTAL</span><span style="color:var(--accent);">${money(grandTotal)}</span>
  </div>`;
  if (posSplitMode && posPagos.length > 0) {
    html += `<div style="margin-top:10px;padding:10px 12px;background:var(--bg3);border-radius:var(--radius-sm);display:flex;flex-direction:column;gap:5px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:2px;">Pago dividido</div>
      ${posPagos.map(p => `
        <div style="display:flex;justify-content:space-between;font-size:13px;">
          <span style="color:var(--text2);">${metodosLabel[p.metodo]||p.metodo}</span>
          <span style="font-weight:600;">${money(Number(p.monto)||0)}</span>
        </div>`).join('')}
      </div>`;
  } else {
    html += `<div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0 0;">
      <span style="color:var(--text2);">Método de pago</span>
      <span style="font-weight:600;">${metodosLabel[metodo]||metodo}${isCredito && serviceItems.length > 0 ? ' <span style="color:var(--text3);font-weight:400;">(servicios en efectivo)</span>' : ''}</span>
    </div>`;
  }

  $id('pos-confirmar-detalle').innerHTML = html;
  const warn = $id('pos-confirmar-credito-warn');
  if (warn) warn.style.display = (isCredito && serviceItems.length > 0) ? '' : 'none';
  $id('pos-confirmar-modal').classList.add('open');
}

async function confirmarCobro() {
  $id('pos-confirmar-modal').classList.remove('open');
  const productItems = posCart.filter(i => i.type !== 'servicio');
  const serviceItems = posCart.filter(i => i.type === 'servicio');
  const metodo       = posSelectedMethod || 'efectivo';
  const srvMetodo    = metodo === 'credito' ? 'efectivo' : metodo;
  const btn = $id('pos-cobrar-btn');
  btnLoading(btn, true);
  try {
    let ventaResult = null;
    // 1. Venta de productos (si hay)
    if (productItems.length > 0) {
      ventaResult = await api('POST', '/ventas', {
        items: productItems.map(i => ({ producto_id: i.productoId, cantidad: i.cantidad, precio_unitario: i.precioUnitario })),
        cliente_id: posClienteId || null,
        split: posSplitMode,
        metodo_pago: metodo,
        pagos: posSplitMode ? posPagos.map(p => ({ metodo: p.metodo, monto: Number(p.monto) })) : [],
        fecha_limite_credito: posCreditoFecha || null
      });
    }
    // 2. Cobros de servicios — siguen el método global (o el de mayor monto en split; nunca crédito)
    const srvMetodoFinal = posSplitMode && posPagos.length > 0
      ? (posPagos.filter(p => p.metodo !== 'credito' && Number(p.monto) > 0)
          .sort((a, b) => Number(b.monto) - Number(a.monto))[0]?.metodo || 'efectivo')
      : srvMetodo;
    for (const s of serviceItems) {
      if ((s.montoCobrar||0) > 0) {
        await api('POST', '/servicios/' + s.servicioId + '/cobrar', {
          monto: s.montoCobrar, metodo: srvMetodoFinal, concepto: s.concepto, descripcion: s.descripcion || null,
          costo_refaccion: (s.costoRefaccion||0) > 0 ? s.costoRefaccion : undefined
        });
      }
    }
    // 3. Reset carrito
    posCart = [];
    posNextRowId = 1;
    posClienteId = null;
    posClienteNombre = '';
    posListaInfo = null;
    if ($id('pos-cliente-input')) $id('pos-cliente-input').value = '';
    if (posSplitMode) {
      posSplitMode = false;
      $id('pos-single-pay').style.display = '';
      $id('pos-split-pay').style.display = 'none';
    }
    posSelectedMethod = 'efectivo';
    document.querySelectorAll('.pos-pay-btn').forEach(b => b.classList.remove('selected'));
    const firstBtn = document.querySelector('.pos-pay-btn');
    if (firstBtn) firstBtn.classList.add('selected');
    if ($id('pos-credit-fields')) $id('pos-credit-fields').classList.remove('show');
    posCreditoFecha = '';
    renderPOSCart();
    updatePOSTotals();
    // 4. Ticket / confirmación
    if (ventaResult) {
      openVentaSuccessModal(ventaResult);
    } else {
      const n = serviceItems.length;
      showToast(`Cobro${n>1?'s':''} de servicio${n>1?'s':''} registrado${n>1?'s':''}`, 'success');
    }
    // 5. Refresh corte bar
    const activo = await api('GET', '/cortes/activo').catch(() => null);
    if (activo) { corteActivo = activo; updateCorteBar(); }
  } catch(e) {
    const msg = e.message || '';
    if (msg.toLowerCase().includes('local')) {
      showToast('Tu usuario no tiene un local asignado. Ve a Usuarios → edita tu perfil y asigna un local.', 'error');
    } else {
      showToast(msg || 'Error al cobrar', 'error');
    }
  }
  finally { btnLoading(btn, false); }
}

// --- Clientes ---
// ===== IMPORTAR (PRODUCTOS / CLIENTES / SERVICIOS) =====
importPreviewRows = [];
importTipo = 'productos';

const IMP_COLS = {
  productos: `
    <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
      <i class="fa-solid fa-circle-info" style="color:var(--accent);"></i> Columnas reconocidas — Productos
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>nombre</strong> <span style="color:var(--danger);">*</span></span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>sku</strong> / clave / referencia</span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>codigo</strong> / barcode / ean</span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>tipo</strong> / categoria</span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>compra</strong> / costo</span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>venta</strong> / precio <span style="color:var(--danger);">*</span></span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>existencia</strong> / stock / qty</span>
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--text3);">La primera fila debe ser el encabezado. Se detecta por código de barras, SKU o nombre para determinar si es nuevo o actualización.</div>`,
  clientes: `
    <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
      <i class="fa-solid fa-circle-info" style="color:var(--accent);"></i> Columnas reconocidas — Clientes
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>nombre</strong> <span style="color:var(--danger);">*</span></span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>telefono</strong> / celular / whatsapp</span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>correo</strong> / email</span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>direccion</strong> / domicilio</span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>notas</strong> / observaciones</span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>tipo_cliente</strong> / tipo / rol</span>
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--text3);">Se detecta cliente existente por correo, teléfono o nombre.</div>`,
  servicios: `
    <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
      <i class="fa-solid fa-circle-info" style="color:var(--accent);"></i> Columnas reconocidas — Servicios
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>cliente</strong> <span style="color:var(--danger);">*</span></span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>modelo</strong> / equipo <span style="color:var(--danger);">*</span></span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>falla</strong> / problema <span style="color:var(--danger);">*</span></span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>descripcion</strong> / detalle</span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>estado</strong></span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>fecha_entrada</strong> / fecha</span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>costo_total</strong> / precio / total</span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>anticipo</strong> / adelanto</span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>num_serie</strong> / serie / imei / sn</span>
      <span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;"><strong>garantia</strong></span>
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--text3);">Se detecta duplicado por número de serie. Si el cliente no existe se crea automáticamente.</div>`,
};

function setImportTipo(tipo) {
  importTipo = tipo;
  resetImport();
  // Update active tab styling
  document.querySelectorAll('.imp-tipo-tab').forEach(t => {
    t.style.background = 'transparent';
    t.style.color = 'var(--text)';
    t.style.fontWeight = '500';
  });
  const activeTab = $id('imp-tab-' + tipo);
  if (activeTab) {
    activeTab.style.background = 'var(--accent)';
    activeTab.style.color = '#fff';
    activeTab.style.fontWeight = '700';
  }
  // Update column reference
  const colsRef = $id('imp-cols-ref');
  if (colsRef) colsRef.innerHTML = IMP_COLS[tipo] || '';
  // Update local hint
  const hint = $id('imp-local-hint');
  const hintMap = { productos: 'Los productos importados se asignarán a este local.', clientes: 'Los clientes importados se asignarán a este local.', servicios: 'Los servicios importados se asignarán a este local.' };
  if (hint) hint.textContent = hintMap[tipo] || '';
  // Update topbar title
  const titleMap = { productos: 'Importar productos', clientes: 'Importar clientes', servicios: 'Importar servicios' };
  const titleEl = $id('topbar-title'); if (titleEl) titleEl.textContent = titleMap[tipo] || 'Importar';
  // Update volver button
  const volverBtn = $id('imp-volver-btn');
  const destinations = { productos: 'productos', clientes: 'clientes', servicios: 'services' };
  if (volverBtn) volverBtn.setAttribute('onclick', `goTo('${destinations[tipo] || 'productos'}')`);
}

function initImportPage() {
  const tipo = currentUserData?.tipo;
  // Show tabs based on permissions
  const canProducts = tipo === 'admin' || tipo === 'root' || hasPermiso('importar_productos','crear');
  const canClientes = tipo === 'admin' || tipo === 'root' || hasPermiso('clientes','crear');
  const canServicios = tipo === 'admin' || tipo === 'root' || hasPermiso('servicios','crear');
  const tabP = $id('imp-tab-productos'); if (tabP) tabP.style.display = canProducts ? '' : 'none';
  const tabC = $id('imp-tab-clientes');  if (tabC) tabC.style.display = canClientes ? '' : 'none';
  const tabS = $id('imp-tab-servicios'); if (tabS) tabS.style.display = canServicios ? '' : 'none';

  // Populate local selector for admin/root
  const localGroup = $id('imp-local-group');
  if (tipo === 'admin' || tipo === 'root') {
    localGroup.style.display = '';
    const sel = $id('imp-local-id');
    sel.innerHTML = '<option value="">-- Seleccionar local --</option>';
    const empId = currentUserData.empresa_id || currentUserData.empresaId;
    api('GET', '/empresas/' + empId + '/locales').then(locales => {
      (locales || []).forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.textContent = l.nombre_local;
        sel.appendChild(opt);
      });
      if (currentUserData.local_id) sel.value = currentUserData.local_id;
    }).catch(() => {});
  } else {
    localGroup.style.display = 'none';
  }
  setImportTipo(importTipo);
}

function resetImport() {
  importPreviewRows = [];
  const su = $id('imp-step-upload');     if (su) su.style.display = '';
  const sp = $id('imp-step-preview');    if (sp) sp.style.display = 'none';
  const sr = $id('imp-step-result');     if (sr) sr.style.display = 'none';
  const ue = $id('imp-upload-error');    if (ue) ue.style.display = 'none';
  const ul = $id('imp-upload-loading');  if (ul) ul.style.display = 'none';
  const fi = $id('imp-file-input');      if (fi) fi.value = '';
}

async function handleImportFileDrop(file) {
  if (!file) return;
  const allowed = ['xlsx','xls','csv','ods','tsv'];
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!allowed.includes(ext)) {
    showImportError('Formato no soportado. Usa XLSX, XLS, CSV, ODS o TSV.');
    return;
  }
  $id('imp-upload-error').style.display = 'none';
  $id('imp-upload-loading').style.display = '';
  try {
    const base64 = await fileToBase64(file);
    const localId = $id('imp-local-id')?.value || null;
    const endpoint = `/${importTipo}/importar/preview`;
    const data = await api('POST', endpoint, {
      fileBase64: base64.split(',')[1],
      fileName: file.name,
      local_id: localId ? Number(localId) : undefined,
    });
    importPreviewRows = data.rows;
    renderImportPreview(data);
  } catch(e) {
    showImportError(e.message || 'Error al procesar el archivo');
  } finally {
    $id('imp-upload-loading').style.display = 'none';
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showImportError(msg) {
  const el = $id('imp-upload-error');
  el.textContent = msg;
  el.style.display = '';
  $id('imp-upload-loading').style.display = 'none';
}

function renderImportPreview(data) {
  const { rows, stats, ignoredHeaders } = data;
  $id('imp-stat-nuevo').textContent = stats.nuevo;
  $id('imp-stat-actualizar').textContent = stats.actualizar;
  $id('imp-stat-sin_cambio').textContent = stats.sin_cambio;
  $id('imp-stat-error').textContent = stats.error;

  const actionable = stats.nuevo + stats.actualizar;
  $id('btn-confirmar-import').disabled = actionable === 0;
  const noun = importTipo === 'clientes' ? 'clientes' : importTipo === 'servicios' ? 'servicios' : 'productos';
  $id('btn-confirmar-import').title = actionable === 0 ? `No hay ${noun} nuevos o por actualizar` : '';

  const warnEl = $id('imp-ignored-headers-warn');
  if (warnEl) {
    if (ignoredHeaders && ignoredHeaders.length > 0) {
      warnEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Columnas no reconocidas (se ignoraron): <strong>${ignoredHeaders.map(h => escHtml(h)).join(', ')}</strong>`;
      warnEl.style.display = '';
    } else {
      warnEl.style.display = 'none';
    }
  }

  // Update table headers for current tipo
  const thead = $id('imp-preview-thead');
  if (thead) thead.innerHTML = getImportTableHeaders(importTipo);

  renderImportTable(rows);
  $id('imp-step-upload').style.display = 'none';
  $id('imp-step-preview').style.display = '';

  document.querySelectorAll('.imp-filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.imp-filter-btn[data-filter="all"]')?.classList.add('active');
}

function getImportTableHeaders(tipo) {
  const th = (t, w) => `<th${w ? ` style="width:${w}"` : ''}>${t}</th>`;
  if (tipo === 'clientes') {
    return `<tr>${th('Estado','110px')}${th('Nombre')}${th('Teléfono')}${th('Correo')}${th('Dirección')}${th('Tipo cliente')}${th('Cambios')}</tr>`;
  }
  if (tipo === 'servicios') {
    return `<tr>${th('Estado','110px')}${th('Cliente')}${th('Modelo')}${th('Falla')}${th('N° Serie')}${th('Fecha entrada')}${th('Costo total')}${th('Anticipo')}${th('Cambios')}</tr>`;
  }
  return `<tr>${th('Estado','110px')}${th('Nombre')}${th('SKU')}${th('Código')}${th('Tipo')}${th('Compra')}${th('Venta')}${th('Existencia')}${th('Cambios')}</tr>`;
}

function renderImportTable(rows) {
  const tbody = $id('imp-preview-tbody');
  const cols = importTipo === 'clientes' ? 7 : importTipo === 'servicios' ? 9 : 9;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;color:var(--text3);padding:32px;">Sin filas para mostrar</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => renderImportRow(r)).join('');
}

function renderImportRow(r) {
  const badgeText = { nuevo:'Nuevo', actualizar:'Actualizar', sin_cambio:'Sin cambio', error:'Error' }[r.status];
  const rowStyle = r.status === 'sin_cambio' ? 'opacity:.55;' : r.status === 'error' ? 'background:rgba(255,71,87,.04);' : '';
  const changesHtml = r.changes
    ? Object.keys(r.changes).map(k => `<span class="imp-change-pill">${k}</span>`).join('')
    : r.error ? `<span style="font-size:11px;color:var(--danger);">${escHtml(r.error)}</span>` : '';
  const badge = `<span class="imp-badge ${r.status}">${badgeText}</span>`;
  if (importTipo === 'clientes') {
    return `<tr style="${rowStyle}" data-status="${r.status}">
      <td>${badge}</td>
      <td style="font-weight:500;">${escHtml(r.nombre || '—')}</td>
      <td style="font-size:12px;color:var(--text2);">${escHtml(r.telefono || '—')}</td>
      <td style="font-size:12px;color:var(--text2);">${escHtml(r.correo || '—')}</td>
      <td style="font-size:12px;">${escHtml(r.direccion || '—')}</td>
      <td style="font-size:12px;">${escHtml(r.tipo_cliente || '—')}</td>
      <td>${changesHtml}</td>
    </tr>`;
  }
  if (importTipo === 'servicios') {
    return `<tr style="${rowStyle}" data-status="${r.status}">
      <td>${badge}</td>
      <td style="font-weight:500;">${escHtml(r.cliente || '—')}</td>
      <td style="font-size:12px;">${escHtml(r.modelo || '—')}</td>
      <td style="font-size:12px;color:var(--text2);">${escHtml(r.falla || '—')}</td>
      <td style="font-size:12px;color:var(--text2);">${escHtml(r.num_serie || '—')}</td>
      <td style="font-size:12px;">${r.fecha_entrada || '—'}</td>
      <td style="font-size:13px;font-weight:600;">${r.costo_total ? money(r.costo_total) : '—'}</td>
      <td style="font-size:12px;">${r.anticipo ? money(r.anticipo) : '—'}</td>
      <td>${changesHtml}</td>
    </tr>`;
  }
  // productos
  return `<tr style="${rowStyle}" data-status="${r.status}">
    <td>${badge}</td>
    <td style="font-weight:500;">${escHtml(r.nombre || '—')}</td>
    <td style="font-size:12px;color:var(--text2);">${escHtml(r.sku || '—')}</td>
    <td style="font-size:12px;color:var(--text2);">${escHtml(r.codigo || '—')}</td>
    <td style="font-size:12px;">${escHtml(r.tipo || '—')}</td>
    <td style="font-size:12px;">${r.compra ? money(r.compra) : '—'}</td>
    <td style="font-size:13px;font-weight:600;">${r.venta ? money(r.venta) : '—'}</td>
    <td style="font-size:12px;">${r.existencia ?? 0}</td>
    <td>${changesHtml}</td>
  </tr>`;
}

function filterImportPreview(filter, btn) {
  document.querySelectorAll('.imp-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const rows = filter === 'all'
    ? importPreviewRows
    : importPreviewRows.filter(r => r.status === filter);
  renderImportTable(rows);
}

async function confirmarImport() {
  const btn = $id('btn-confirmar-import');
  btnLoading(btn, true);
  try {
    const localId = $id('imp-local-id')?.value || null;
    const toSend = importPreviewRows.filter(r => r.status === 'nuevo' || r.status === 'actualizar');
    const endpoint = `/${importTipo}/importar/confirmar`;
    const result = await api('POST', endpoint, {
      rows: toSend,
      local_id: localId ? Number(localId) : undefined,
    });
    showImportResult(result);
  } catch(e) {
    showToast(e.message || 'Error al importar', 'error');
  } finally {
    btnLoading(btn, false);
  }
}

function showImportResult(result) {
  $id('imp-step-preview').style.display = 'none';
  $id('imp-step-result').style.display = '';
  const hasErrors = result.errors?.length > 0;
  const allErrors = result.total === 0 && hasErrors;
  const noun = importTipo === 'clientes' ? 'clientes' : importTipo === 'servicios' ? 'servicios' : 'productos';
  $id('imp-result-icon').innerHTML = allErrors
    ? '<i class="fa-solid fa-circle-xmark" style="color:var(--danger);"></i>'
    : '<i class="fa-solid fa-circle-check" style="color:#2ed573;"></i>';
  $id('imp-result-title').textContent = allErrors ? 'Importación fallida' : 'Importación completada';
  $id('imp-result-desc').innerHTML =
    `<strong style="color:#2ed573;">${result.created}</strong> ${noun} creados &nbsp;·&nbsp; ` +
    `<strong style="color:#f0a500;">${result.updated}</strong> actualizados` +
    (hasErrors ? ` &nbsp;·&nbsp; <strong style="color:var(--danger);">${result.errors.length}</strong> errores` : '');
  const errDiv = $id('imp-result-errors');
  if (hasErrors) {
    errDiv.style.display = '';
    errDiv.innerHTML = result.errors.map(e => `<div>• ${escHtml(e)}</div>`).join('');
  } else {
    errDiv.style.display = 'none';
  }
  // Update "Ver X" button
  const verBtn = $id('imp-result-ver-btn');
  if (verBtn) {
    const icons = { productos: 'fa-boxes-stacked', clientes: 'fa-users', servicios: 'fa-screwdriver-wrench' };
    const labels = { productos: 'Ver productos', clientes: 'Ver clientes', servicios: 'Ver servicios' };
    const destinations = { productos: 'productos', clientes: 'clientes', servicios: 'services' };
    verBtn.innerHTML = `<i class="fa-solid ${icons[importTipo]}"></i> ${labels[importTipo]}`;
    verBtn.setAttribute('onclick', `goTo('${destinations[importTipo]}')`);
  }
}

function downloadPlantillaImport() {
  const templates = {
    productos: {
      header: 'nombre,sku,codigo,tipo,compra,venta,existencia',
      example: 'Cable USB-C,SKU001,7501234567890,Accesorios,45,89,10',
      filename: 'plantilla_productos.csv',
    },
    clientes: {
      header: 'nombre,telefono,correo,direccion,notas,tipo_cliente',
      example: 'Juan Pérez,5512345678,juan@email.com,Calle Reforma 10,,regular',
      filename: 'plantilla_clientes.csv',
    },
    servicios: {
      header: 'cliente,modelo,falla,descripcion,estado,fecha_entrada,costo_total,anticipo,num_serie,garantia',
      example: 'Juan Pérez,iPhone 12,Pantalla rota,Pantalla con rayaduras,Recibido,2024-01-15,800,200,SN123456789,30 días',
      filename: 'plantilla_servicios.csv',
    },
  };
  const t = templates[importTipo] || templates.productos;
  const csv = t.header + '\n' + t.example;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = t.filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== LISTAS DE PRECIOS =====
async function loadListasPrecios() {
  const q = ($id('search-listas').value || '').trim();
  const isRoot = currentUserData?.tipo === 'root';
  const empresaId = $id('filter-listas-empresa')?.value;

  LISTAS_PER_PAGE = parseInt($id('listas-per-page')?.value) || LISTAS_PER_PAGE;
  let url = `/listas-precios?page=${listasPage}&limit=${LISTAS_PER_PAGE}&sort=${listSort.f}_${listSort.d}`;
  if (q) url += '&q=' + encodeURIComponent(q);
  if (isRoot && empresaId) url += '&empresa_id=' + empresaId;

  try {
    tableLoading($id('listas-precios-tbody'), 7);
    const data = await api('GET', url);
    const list = Array.isArray(data) ? data : (data.data || []);
    const total = data.total || list.length;

    $id('listas-table-info').textContent = `${total} ${total !== 1 ? t('table.registros') : t('table.registro')}`;

    const canEdit = hasPermiso('clientes', 'editar');
    const canDelete = hasPermiso('clientes', 'borrar');
    const tbody = $id('listas-precios-tbody');

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-tags"></i><p>Sin listas de precios. Crea la primera con el botón "Nueva lista".</p></div></td></tr>`;
    } else {
      tbody.innerHTML = list.map(l => `
        <tr style="cursor:pointer;" onclick="openListaDetalleModal(${l.id})">
          <td class="col-priority-1">
            <div class="td-name">${l.nombre}</div>
            ${l.descripcion ? `<div class="td-sub">${l.descripcion}</div>` : ''}
          </td>
          <td class="col-priority-2"><div class="td-sub">${l.descripcion || '—'}</div></td>
          <td class="col-priority-1">
            ${l.descuento_porcentaje > 0
              ? `<span style="font-size:16px;font-weight:800;color:var(--accent3);">-${l.descuento_porcentaje}%</span>`
              : '<span style="color:var(--text3);">—</span>'}
          </td>
          <td class="col-priority-2">
            <span style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--info);">${l.total_clientes || 0}</span>
            <span style="font-size:11px;color:var(--text3);margin-left:3px;">cliente${l.total_clientes !== 1 ? 's' : ''}</span>
          </td>
          <td class="col-priority-4"><div class="td-sub">${l.empresa_nombre || '—'}</div></td>
          <td class="col-priority-3">${l.fecha_creacion ? l.fecha_creacion.split('T')[0] : '—'}</td>
          <td class="col-priority-1" onclick="event.stopPropagation()">
            <div class="td-actions">
              <button class="act-btn view-btn" onclick="openListaDetalleModal(${l.id})" title="Ver detalle"><i class="fa-solid fa-eye"></i></button>
              ${canEdit ? `<button class="act-btn edit" onclick="openListaPrecioModal(${l.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>` : ''}
              ${canDelete ? `<button class="act-btn del" onclick="askDeleteLista(${l.id})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
          </td>
        </tr>`).join('');
    }

    // Pagination
    const pages = Math.ceil(total / LISTAS_PER_PAGE) || 1;
    const pb = $id('listas-pag-btns');
    pb.innerHTML = '';
    for (let i = 1; i <= pages; i++) {
      const btn = document.createElement('button');
      btn.className = 'pag-btn' + (i === listasPage ? ' active' : '');
      btn.textContent = i;
      btn.onclick = () => { listasPage = i; loadListasPrecios(); };
      pb.appendChild(btn);
    }
  } catch(e) {
    $id('listas-precios-tbody').innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>Error cargando listas</p></div></td></tr>`;
  }
}

function filterListasPrecios() {
  listasPage = 1;
  loadListasPrecios();
}

async function openListaDetalleModal(id) {
  $id('ld-nombre').textContent = 'Cargando...';
  $id('ld-info').textContent = '—';
  $id('ld-descuento').textContent = '—';
  $id('ld-total-clientes').textContent = '—';
  $id('ld-clientes-list').innerHTML = '<div class="empty-state" style="padding:16px;"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  $id('lista-detalle-modal').classList.add('open');

  try {
    const [lista, clientes] = await Promise.all([
      api('GET', '/listas-precios/' + id),
      api('GET', '/listas-precios/' + id + '/clientes')
    ]);

    $id('ld-nombre').textContent = lista.nombre;
    $id('ld-info').textContent = [lista.empresa_nombre, lista.fecha_creacion ? 'Creada ' + lista.fecha_creacion.split('T')[0] : ''].filter(Boolean).join(' · ');
    $id('ld-descuento').textContent = lista.descuento_porcentaje > 0 ? `-${lista.descuento_porcentaje}%` : 'Sin descuento';
    $id('ld-total-clientes').textContent = clientes.length;
    $id('ld-descripcion').textContent = lista.descripcion || 'Sin descripción';
    $id('ld-btn-edit').onclick = () => { closeListaDetalleModal(); openListaPrecioModal(id); };

    if (!clientes.length) {
      $id('ld-clientes-list').innerHTML = `
        <div class="empty-state" style="padding:20px;">
          <i class="fa-solid fa-users"></i>
          <p>Ningún cliente tiene esta lista asignada aún.</p>
          <p style="font-size:12px;color:var(--text3);">Asígna esta lista desde la sección de Clientes.</p>
        </div>`;
    } else {
      $id('ld-clientes-list').innerHTML = `
        <table style="width:100%;font-size:13px;">
          <thead><tr>
            <th style="padding:6px 8px;text-align:left;color:var(--text3);">Cliente</th>
            <th style="padding:6px 8px;text-align:left;color:var(--text3);">Teléfono</th>
            <th style="padding:6px 8px;text-align:left;color:var(--text3);">Tipo</th>
            <th style="padding:6px 8px;text-align:left;color:var(--text3);">Asignado</th>
            <th style="padding:6px 8px;"></th>
          </tr></thead>
          <tbody>
            ${clientes.map(c => {
              const waLink = phoneToWA(c.telefono);
              return `<tr style="border-top:1px solid var(--border);">
                <td style="padding:8px;">
                  <div style="font-weight:600;cursor:pointer;" onclick="closeListaDetalleModal();openClienteDetailModal(${c.id})">${c.nombre}</div>
                </td>
                <td style="padding:8px;">
                  ${c.telefono ? `<a href="${waLink}" target="_blank" style="color:var(--text2);text-decoration:none;font-size:12px;"><i class="fa-brands fa-whatsapp" style="color:#25D366;margin-right:3px;"></i>${c.telefono}</a>` : '<span style="color:var(--text3);">—</span>'}
                </td>
                <td style="padding:8px;">
                  <span class="status-pill ${tipoClienteClass[c.tipo_cliente]||'sp-pending'}" style="font-size:10px;">${tipoClienteLabel[c.tipo_cliente]||c.tipo_cliente}</span>
                </td>
                <td style="padding:8px;font-size:11px;color:var(--text3);">
                  ${c.fecha_asignacion ? c.fecha_asignacion.split('T')[0] : '—'}
                </td>
                <td style="padding:8px;text-align:right;">
                  <button class="act-btn del" onclick="quitarListaDeCliente(${c.id}, ${id})" title="Quitar lista"><i class="fa-solid fa-xmark"></i></button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    }
  } catch(e) {
    showToast('Error cargando detalle de lista', 'error');
    closeListaDetalleModal();
  }
}

function closeListaDetalleModal() {
  $id('lista-detalle-modal').classList.remove('open');
}

async function quitarListaDeCliente(clienteId, listaId) {
  if (!confirm('¿Quitar esta lista del cliente?')) return;
  try {
    await api('DELETE', `/clientes/${clienteId}/listas/${listaId}`);
    showToast('Lista removida del cliente', 'success');
    openListaDetalleModal(listaId); // refresh
    loadListasPrecios();
  } catch(e) {
    showToast(e.message || 'Error al remover', 'error');
  }
}

async function openListaPrecioModal(id = null) {
  editingListaId = id;
  $id('lista-modal-title').textContent = id ? 'Editar Lista de Precios' : 'Nueva Lista de Precios';
  $id('btn-save-lista-label').textContent = id ? 'Guardar cambios' : 'Guardar lista';

  $id('flp-nombre').value = '';
  $id('flp-descripcion').value = '';
  $id('flp-descuento').value = '';

  if (id) {
    try {
      // GET /listas-precios/:id — carga solo la lista necesaria
      const l = await api('GET', '/listas-precios/' + id);
      $id('flp-nombre').value = l.nombre || '';
      $id('flp-descripcion').value = l.descripcion || '';
      $id('flp-descuento').value = l.descuento_porcentaje || '';
    } catch(e) { showToast('Error cargando lista', 'error'); return; }
  }

  $id('lista-precio-modal').classList.add('open');
}

function closeListaPrecioModal() {
  $id('lista-precio-modal').classList.remove('open');
  editingListaId = null;
}

async function saveListaPrecio() {
  const nombre = $id('flp-nombre').value.trim();
  if (!nombre) { showToast('El nombre es requerido', 'error'); return; }

  const body = {
    nombre,
    descripcion: $id('flp-descripcion').value.trim() || null,
    descuento_porcentaje: parseFloat($id('flp-descuento').value) || 0,
  };

  const saveBtn = document.querySelector('#lista-precio-modal .btn-accent');
  btnLoading(saveBtn, true);
  try {
    if (editingListaId) {
      await api('PUT', '/listas-precios/' + editingListaId, body);
      showToast('Lista actualizada', 'success');
    } else {
      await api('POST', '/listas-precios', body);
      showToast('Lista creada', 'success');
    }
    closeListaPrecioModal();
    loadListasPrecios();
  } catch(e) {
    showToast(e.message || 'Error al guardar', 'error');
  } finally { btnLoading(saveBtn, false); }
}

async function askDeleteLista(id) {
  if (!confirm('¿Eliminar esta lista de precios? Se quitará de todos los clientes asignados.')) return;
  try {
    await api('DELETE', '/listas-precios/' + id);
    showToast('Lista eliminada', 'success');
    loadListasPrecios();
  } catch(e) {
    showToast(e.message || 'Error al eliminar', 'error');
  }
}

// --- Reporte Ventas ---
// ===== REPORTE VENTAS =====
rvCurrentPage = 1;
rvTotalPages  = 1;
rvTotalRows   = 0;
rvCurrentVentaId = null;
RV_LIMIT = 25;

function onRvEmpresaChange() {
  rvCurrentPage = 1;
  generateReporteVentas();
}

function loadReporteVentas() {
  // Set default dates: this month
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
  if (!$id('rv-start').value) $id('rv-start').value = `${y}-${m}-01`;
  if (!$id('rv-end').value)   $id('rv-end').value   = now.toISOString().slice(0, 10);
  if (currentUserData?.tipo === 'root') {
    $id('rv-empresa-group').style.display = '';
    if ($id('rv-empresa').options.length <= 1) {
      allEmpresas.forEach(e => {
        const o = document.createElement('option'); o.value = e.id; o.textContent = e.nombre;
        $id('rv-empresa').appendChild(o);
      });
    }
  }
  rvCurrentPage = 1;
  generateReporteVentas();
}

async function generateReporteVentas() {
  const desde  = $id('rv-start').value;
  const hasta  = $id('rv-end').value;
  const metodo = $id('rv-metodo-pago').value;
  const buscar = $id('rv-buscar').value.trim();
  const tbody  = $id('rv-tbody');
  tableLoading(tbody, 7);

  RV_LIMIT = parseInt($id('rv-per-page')?.value) || RV_LIMIT;
  let url = `/ventas?page=${rvCurrentPage}&limit=${RV_LIMIT}&sort=${rvSort.f}_${rvSort.d}`;
  if (desde)  url += `&desde=${desde}`;
  if (hasta)  url += `&hasta=${hasta}`;
  if (metodo) url += `&metodo_pago=${metodo}`;
  if (buscar) url += `&buscar=${encodeURIComponent(buscar)}`;
  if (currentUserData?.tipo === 'root' && $id('rv-empresa').value)
    url += `&empresa_id=${$id('rv-empresa').value}`;

  try {
    const res = await api('GET', url);
    rvTotalRows  = res.total;
    rvTotalPages = Math.max(1, Math.ceil(res.total / RV_LIMIT));
    const stats  = res.stats || {};

    // Summary cards
    $id('rv-total-ventas').textContent     = res.total;
    $id('rv-ingresos').textContent         = money(stats.total_monto || 0);
    $id('rv-ticket-promedio').textContent  = money(stats.avg_monto   || 0);
    $id('rv-productos-vendidos').textContent = Number(stats.total_items || 0).toLocaleString('es-MX');

    // Range label
    const label = (desde && hasta) ? `${desde} — ${hasta}` : desde ? `Desde ${desde}` : hasta ? `Hasta ${hasta}` : 'Todos los registros';
    $id('rv-range-label').textContent = label;

    // Table
    const metodosLabel = { efectivo: t('metodo.efectivo'), tarjeta: t('metodo.tarjeta'), transferencia: t('metodo.transferencia'), credito: t('metodo.credito'), mixto: t('metodo.mixto') };
    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-file-invoice-dollar"></i><p>Sin ventas en el período seleccionado</p></div></td></tr>`;
    } else {
      tbody.innerHTML = res.data.map(v => `
        <tr>
          <td><span style="font-family:'Syne',sans-serif;font-weight:700;color:var(--accent);">${v.folio_venta}</span></td>
          <td style="font-size:12px;color:var(--text2);">${fmtDatetime(v.fecha_finalizacion || v.fecha)}</td>
          <td>${v.cliente_nombre ? escHtml(v.cliente_nombre) : '<span style="color:var(--text3);">—</span>'}</td>
          <td style="font-size:12px;color:var(--text2);">${v.usuario_nombre ? escHtml(v.usuario_nombre) : '—'}</td>
          <td><span class="badge-metodo badge-${v.metodo_pago}">${metodosLabel[v.metodo_pago] || v.metodo_pago}</span></td>
          <td class="text-right" style="color:var(--text2);font-size:12px;">${v.descuento > 0 ? '-' + money(v.descuento) : '—'}</td>
          <td class="text-right"><strong style="color:var(--success);">${money(v.total)}</strong></td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="act-btn" onclick="rvVerDetalle(${v.id})" title="Ver detalle"><i class="fa-solid fa-eye"></i></button>
              <button class="act-btn" onclick="rvReprintTicket(${v.id})" title="Reimprimir ticket"><i class="fa-solid fa-print"></i></button>
            </div>
          </td>
        </tr>`).join('');
    }

    rvRenderPagination();
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="color:var(--danger);"><i class="fa-solid fa-circle-exclamation"></i><p>${e.message}</p></div></td></tr>`;
  }
}

function rvRenderPagination() {
  const pag = $id('rv-pagination');
  if (rvTotalRows === 0) { pag.style.display = 'none'; return; }
  pag.style.display = 'flex';
  const from = (rvCurrentPage - 1) * RV_LIMIT + 1;
  const to   = Math.min(rvCurrentPage * RV_LIMIT, rvTotalRows);
  $id('rv-page-info').textContent = `Mostrando ${from}–${to} de ${rvTotalRows} ventas`;
  $id('rv-btn-prev').disabled = rvCurrentPage <= 1;
  $id('rv-btn-next').disabled = rvCurrentPage >= rvTotalPages;
  // Page number buttons (up to 5 visible)
  const nums = $id('rv-page-nums');
  nums.innerHTML = '';
  const start = Math.max(1, rvCurrentPage - 2);
  const end   = Math.min(rvTotalPages, start + 4);
  for (let p = start; p <= end; p++) {
    const btn = document.createElement('button');
    btn.textContent = p;
    btn.className = 'btn-outline';
    btn.style.cssText = `padding:6px 11px;font-size:13px;${p === rvCurrentPage ? 'background:var(--accent);color:#000;border-color:var(--accent);' : ''}`;
    btn.onclick = () => { rvCurrentPage = p; generateReporteVentas(); };
    nums.appendChild(btn);
  }
}

function rvChangePage(delta) {
  const next = rvCurrentPage + delta;
  if (next < 1 || next > rvTotalPages) return;
  rvCurrentPage = next;
  generateReporteVentas();
}

function rvClearFilters() {
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
  $id('rv-start').value = `${y}-${m}-01`;
  $id('rv-end').value   = now.toISOString().slice(0, 10);
  $id('rv-metodo-pago').value = '';
  $id('rv-buscar').value = '';
  rvCurrentPage = 1;
  generateReporteVentas();
}

async function rvVerDetalle(ventaId) {
  rvCurrentVentaId = ventaId;
  const modal = $id('rv-detalle-modal');
  const body  = $id('rv-det-body');
  body.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text2)"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</div>`;
  modal.classList.add('open');

  try {
    const v = await api('GET', '/ventas/' + ventaId);
    const metodosLabel = { efectivo: t('metodo.efectivo'), tarjeta: t('metodo.tarjeta'), transferencia: t('metodo.transferencia'), credito: t('metodo.credito'), mixto: t('metodo.mixto') };
    $id('rv-det-titulo').textContent = `Venta ${v.folio_venta}`;

    const itemsHtml = (v.items || []).map(it => `
      <tr>
        <td style="font-size:13px;">${escHtml(it.producto_nombre)}<br><small style="color:var(--text3);">${it.codigo || ''}</small></td>
        <td class="text-right" style="font-size:13px;">${it.cantidad}</td>
        <td class="text-right" style="font-size:13px;">${money(it.precio_unitario)}</td>
        <td class="text-right" style="font-size:13px;font-weight:600;">${money(it.subtotal)}</td>
      </tr>`).join('');

    const pagosHtml = (v.pagos || []).map(p => `
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;">
        <span style="color:var(--text2);">${metodosLabel[p.metodo] || p.metodo}</span>
        <span style="font-weight:600;">${money(p.monto)}</span>
      </div>`).join('');

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;">
        <div style="background:var(--bg3);border-radius:var(--radius-sm);padding:12px;">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">FOLIO</div>
          <div style="font-family:'Syne',sans-serif;font-weight:700;color:var(--accent);">${v.folio_venta}</div>
        </div>
        <div style="background:var(--bg3);border-radius:var(--radius-sm);padding:12px;">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">FECHA</div>
          <div style="font-size:13px;">${fmtDatetime(v.fecha_finalizacion || v.fecha)}</div>
        </div>
        <div style="background:var(--bg3);border-radius:var(--radius-sm);padding:12px;">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">CLIENTE</div>
          <div style="font-size:13px;">${v.cliente_nombre || '—'}</div>
        </div>
        <div style="background:var(--bg3);border-radius:var(--radius-sm);padding:12px;">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">CAJERO</div>
          <div style="font-size:13px;">${v.usuario_nombre || '—'}</div>
        </div>
      </div>

      <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Productos</div>
      <div class="table-wrap" style="margin-bottom:20px;">
        <table>
          <thead><tr><th>Producto</th><th class="text-right">Cant.</th><th class="text-right">P.U.</th><th class="text-right">Subtotal</th></tr></thead>
          <tbody>${itemsHtml || '<tr><td colspan="4" style="color:var(--text2);text-align:center;">Sin detalle</td></tr>'}</tbody>
        </table>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:16px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Pagos</div>
        ${pagosHtml}
        ${v.descuento > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;"><span style="color:var(--text2);">Descuento</span><span style="color:var(--danger);">-${money(v.descuento)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:16px;padding:8px 0;border-top:1px solid var(--border);margin-top:4px;">
          <span style="font-weight:700;">TOTAL</span>
          <span style="font-weight:800;color:var(--success);">${money(v.total)}</span>
        </div>
      </div>`;
  } catch(e) {
    body.innerHTML = `<div style="color:var(--danger);text-align:center;padding:24px;">${e.message}</div>`;
  }
}

async function rvReprintTicket(ventaId) {
  rvCurrentVentaId = ventaId;
  await rvPrintTicket();
}

async function rvPrintTicket() {
  if (!rvCurrentVentaId) return;
  try {
    const data = await api('GET', '/ticket-venta/' + rvCurrentVentaId);
    const { venta, items, pagos, config, logo } = data;
    const cfg = config || {};
    const fmtDt = d => { if (!d) return '—'; return new Date(d).toLocaleString('es-MX', { dateStyle:'short', timeStyle:'short' }); };
    const fmtM  = n => '$' + Number(n || 0).toFixed(2);
    const metodosLabel = { efectivo: t('metodo.efectivo'), tarjeta: t('metodo.tarjeta'), transferencia: t('metodo.transferencia'), credito: t('metodo.credito'), mixto: t('metodo.mixto') };

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket ${venta.folio_venta}</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:monospace;font-size:12px;color:#000;background:#fff;width:72mm;margin:0 auto;padding:4mm;}.center{text-align:center;}.bold{font-weight:bold;}.line{border-top:1px dashed #000;margin:6px 0;}.row{display:flex;justify-content:space-between;margin:2px 0;}.logo{max-width:60mm;max-height:25mm;margin:0 auto 6px;display:block;}table{width:100%;border-collapse:collapse;margin:4px 0;}th{text-align:left;font-size:11px;border-bottom:1px solid #000;padding:2px 0;}td{font-size:11px;padding:2px 0;vertical-align:top;}td.r{text-align:right;}.footer{text-align:center;margin-top:8px;font-size:11px;}@media print{body{margin:0;}}</style>
</head><body>`;

    if (cfg.ticket_venta_mostrar_logo && logo) html += `<img class="logo" src="${logo}" alt="logo">`;
    if (cfg.ticket_venta_mostrar_empresa) {
      html += `<div class="center bold" style="font-size:14px;">${venta.empresa_nombre || ''}</div>`;
      if (venta.nombre_local) html += `<div class="center">${venta.nombre_local}</div>`;
      if (venta.empresa_calle) html += `<div class="center">${venta.empresa_calle}${venta.empresa_ciudad ? ', ' + venta.empresa_ciudad : ''}</div>`;
      if (venta.empresa_telefono) html += `<div class="center">Tel: ${venta.empresa_telefono}</div>`;
      if (venta.empresa_rfc) html += `<div class="center">RFC: ${venta.empresa_rfc}</div>`;
    }
    html += `<div class="line"></div>`;
    if (cfg.ticket_venta_mostrar_folio) html += `<div class="row"><span class="bold">Folio:</span><span>${venta.folio_venta}</span></div>`;
    if (cfg.ticket_venta_mostrar_fecha) html += `<div class="row"><span>Fecha:</span><span>${fmtDt(venta.fecha_finalizacion || venta.fecha)}</span></div>`;
    if (cfg.ticket_venta_mostrar_cliente && venta.cliente_nombre) html += `<div class="row"><span>Cliente:</span><span>${venta.cliente_nombre}</span></div>`;
    if (venta.usuario_nombre) html += `<div class="row"><span>Cajero:</span><span>${venta.usuario_nombre}</span></div>`;
    if (cfg.ticket_venta_mostrar_items && items && items.length > 0) {
      html += `<div class="line"></div><table><thead><tr><th>Producto</th><th class="r">Cant</th><th class="r">P.U.</th><th class="r">Total</th></tr></thead><tbody>`;
      for (const it of items)
        html += `<tr><td>${it.producto_nombre}${it.codigo ? '<br><small>' + it.codigo + '</small>' : ''}</td><td class="r">${it.cantidad}</td><td class="r">${fmtM(it.precio_unitario)}</td><td class="r">${fmtM(it.subtotal)}</td></tr>`;
      html += `</tbody></table>`;
    }
    html += `<div class="line"></div>`;
    if (venta.descuento > 0) html += `<div class="row"><span>Descuento:</span><span>-${fmtM(venta.descuento)}</span></div>`;
    html += `<div class="row" style="font-size:15px;font-weight:bold;margin:4px 0;"><span>TOTAL:</span><span>${fmtM(venta.total)}</span></div>`;
    if (cfg.ticket_venta_mostrar_metodo && pagos && pagos.length > 0) {
      html += `<div class="line"></div>`;
      for (const p of pagos) html += `<div class="row"><span>${metodosLabel[p.metodo] || p.metodo}:</span><span>${fmtM(p.monto)}</span></div>`;
    }
    const footer = cfg.ticket_venta_footer || 'Gracias por su compra';
    if (footer) html += `<div class="line"></div><div class="footer">${footer}</div>`;
    html += `</body></html>`;

    const win = window.open('', '_blank', 'width=320,height=600');
    if (win) { win.document.write(html); win.document.close(); win.onload = () => win.print(); }
  } catch(e) { showToast('Error al generar ticket: ' + e.message, 'error'); }
}

function exportReporteVentas() {
  const rows = $id('rv-tbody').querySelectorAll('tr');
  if (rows.length === 0 || rows[0].querySelector('.empty-state')) {
    showToast('No hay datos para exportar', 'error'); return;
  }
  const headers = ['Folio','Fecha','Cliente','Cajero','Método','Descuento','Total'];
  const lines   = [headers.join(',')];
  rows.forEach(row => {
    const cols = row.querySelectorAll('td');
    if (cols.length < 7) return;
    const get = (i, clean=true) => {
      let t = cols[i].textContent.trim().replace(/\n+/g,' ');
      return clean ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    lines.push([get(0), get(1), get(2), get(3), get(4), get(5), get(6)].join(','));
  });
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const now  = new Date().toISOString().slice(0, 10);
  a.href = url; a.download = `ventas_${now}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// --- Reporte Cortes ---
function loadReporteCortes() {
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
  if (!$id('rc-start').value) $id('rc-start').value = `${y}-${m}-01`;
  if (!$id('rc-end').value)   $id('rc-end').value   = now.toISOString().slice(0, 10);
  // Populate users dropdown
  api('GET', '/personas').then(res => {
    const sel = $id('rc-usuario');
    const current = sel.value;
    sel.innerHTML = '<option value="">Todos los usuarios</option>';
    (res.data || res).forEach(u => {
      sel.innerHTML += `<option value="${u.id}" ${u.id == current ? 'selected' : ''}>${escHtml(u.nombre)}</option>`;
    });
  }).catch(() => {});
  generateReporteCortes();
}

async function generateReporteCortes() {
  const desde = $id('rc-start').value;
  const hasta  = $id('rc-end').value;
  const usuId  = $id('rc-usuario').value;
  const tbody  = $id('rc-tbody');
  tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text2)"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</td></tr>`;

  let url = '/cortes?limit=100';
  if (desde) url += `&desde=${desde}`;
  if (hasta) url += `&hasta=${hasta}`;

  try {
    const res = await api('GET', url);
    let data = res.data || [];
    if (usuId) data = data.filter(c => String(c.usuario_id) === String(usuId));

    // Summary cards
    $id('rc-total-cortes').textContent = data.length;
    const totalVentas = data.reduce((s, c) => s + (c.total_ventas || 0), 0);
    $id('rc-ventas-total').textContent = money(totalVentas);
    const efectivoEsperado = data.reduce((s, c) => s + (c.fondo_apertura || 0) + (c.total_efectivo || 0), 0);
    $id('rc-efectivo-esperado').textContent = money(efectivoEsperado);
    const diferencia = data.reduce((s, c) => s + (c.diferencia || 0), 0);
    const difEl = $id('rc-diferencia');
    difEl.textContent = money(diferencia);
    difEl.style.color = diferencia < 0 ? 'var(--danger)' : diferencia > 0 ? 'var(--success)' : '';

    reportCortesData = data;
    rcPage = 1;
    renderReporteCortes();
  } catch(e) {
    const tbody = $id('rc-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state" style="color:var(--danger);"><i class="fa-solid fa-circle-exclamation"></i><p>${e.message}</p></div></td></tr>`;
  }
}

function renderReporteCortes() {
  const perPage = parseInt($id('rc-per-page')?.value) || 20;
  const sorted = clientSort(reportCortesData, rcSort.f, rcSort.d);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (rcPage > totalPages) rcPage = totalPages;
  const slice = perPage >= 9999 ? sorted : sorted.slice((rcPage - 1) * perPage, rcPage * perPage);
  const tbody = $id('rc-tbody');
  tbody.innerHTML = slice.length ? slice.map(c => {
    const apertura = c.fecha_apertura
      ? new Date(c.fecha_apertura).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    const cierre = c.fecha_cierre
      ? new Date(c.fecha_cierre).toLocaleTimeString('es-MX')
      : `<span style="color:var(--warning);">Abierto</span>`;
    const diff = (c.diferencia !== null && c.diferencia !== undefined) ? c.diferencia : null;
    const diffHtml = diff !== null
      ? `<span style="color:${diff < 0 ? 'var(--danger)' : diff > 0 ? 'var(--success)' : 'var(--text2)'};font-weight:600;">${money(diff)}</span>`
      : '<span style="color:var(--text3);">—</span>';
    return `<tr>
      <td style="font-size:13px;">${c.usuario_nombre ? escHtml(c.usuario_nombre) : '—'}<br><small style="color:var(--text3);">${c.nombre_local ? escHtml(c.nombre_local) : ''}</small></td>
      <td style="font-size:12px;color:var(--text2);">${apertura}</td>
      <td style="font-size:12px;color:var(--text2);">${c.fecha_apertura ? new Date(c.fecha_apertura).toLocaleTimeString('es-MX') : '—'}</td>
      <td style="font-size:12px;color:var(--text2);">${c.fecha_cierre ? new Date(c.fecha_cierre).toLocaleTimeString('es-MX') : cierre}</td>
      <td class="text-right" style="font-size:13px;">${money(c.fondo_apertura || 0)}</td>
      <td class="text-right" style="font-size:13px;color:var(--success);">${money(c.total_ventas || 0)}</td>
      <td class="text-right" style="font-size:13px;color:var(--danger);">${money(0)}</td>
      <td class="text-right" style="font-size:13px;">${money((c.fondo_apertura || 0) + (c.total_efectivo || 0))}</td>
      <td class="text-right" style="font-size:13px;">${c.efectivo_contado !== null && c.efectivo_contado !== undefined ? money(c.efectivo_contado) : '<span style="color:var(--text3);">—</span>'}</td>
      <td class="text-right">${diffHtml}</td>
      <td style="text-align:center;">
        <button class="act-btn" onclick="showCorteDetalle(${c.id})" title="Ver detalle del corte">
          <i class="fa-solid fa-magnifying-glass"></i>
        </button>
      </td>
    </tr>`;
  }).join('') : `<tr><td colspan="11"><div class="empty-state"><i class="fa-solid fa-scissors"></i><p>Sin cortes en el período seleccionado</p></div></td></tr>`;
  updateSortIcons('rc-tbody', rcSort.f, rcSort.d);
  const pag = $id('rc-pagination');
  if (pag) {
    pag.style.display = total > 0 ? 'flex' : 'none';
    const from = Math.min((rcPage - 1) * perPage + 1, total);
    const to   = Math.min(rcPage * perPage, total);
    const info = $id('rc-page-info'); if (info) info.textContent = `${from}–${to} de ${total}`;
    const prev = $id('rc-btn-prev'); if (prev) prev.disabled = rcPage <= 1;
    const next = $id('rc-btn-next'); if (next) next.disabled = rcPage >= totalPages;
  }
}

function exportReporteCortes() {
  const rows = $id('rc-tbody').querySelectorAll('tr');
  if (rows.length === 0 || rows[0].querySelector('.empty-state')) {
    showToast('No hay datos para exportar', 'error'); return;
  }
  const headers = ['Usuario','Fecha','Hora inicio','Hora fin','Fondo inicial','Ventas','Retiros','Esperado','Real','Diferencia'];
  const lines = [headers.join(',')];
  rows.forEach(row => {
    const cols = row.querySelectorAll('td');
    if (cols.length < 10) return;
    lines.push(Array.from(cols).map(td => '"' + td.textContent.trim().replace(/"/g, '""') + '"').join(','));
  });
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `cortes_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exportado', 'success');
}

// --- Detalle de Corte ---
_corteDetalleData = null;

async function showCorteDetalle(corteId) {
  $id('corte-detalle-modal').classList.add('open');
  $id('cd-titulo').textContent = 'Cargando...';
  $id('cd-subtitulo').textContent = '';
  $id('cd-resumen').innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text3);"><i class="fa-solid fa-spinner fa-spin"></i> Cargando detalle...</div>';
  $id('cd-ventas-tbody').innerHTML = '';
  $id('cd-srv-tbody').innerHTML = '';
  try {
    const data = await api('GET', '/cortes/' + corteId + '/detalle');
    _corteDetalleData = data;
    const { corte, ventas, pagosServicio } = data;
    const metLabels = { efectivo:'Efectivo', tarjeta:'Tarjeta', transferencia:'Transferencia', credito:'Crédito', mixto:'Mixto' };

    $id('cd-titulo').textContent = corte.folio_corte || ('Corte #' + corte.id);
    const aperturaFmt = corte.fecha_apertura ? new Date(corte.fecha_apertura).toLocaleString('es-MX', { dateStyle:'short', timeStyle:'short' }) : '—';
    const cierreFmt   = corte.fecha_cierre   ? new Date(corte.fecha_cierre).toLocaleTimeString('es-MX') : 'Abierto';
    $id('cd-subtitulo').textContent = `${corte.usuario_nombre || '—'} · ${corte.nombre_local || ''} · ${aperturaFmt} – ${cierreFmt}`;

    // Resumen por método (ventas + cobros)
    const metodos = ['efectivo', 'tarjeta', 'transferencia'];
    const totVentas   = { efectivo: corte.total_efectivo || 0, tarjeta: corte.total_tarjeta || 0, transferencia: corte.total_transferencia || 0 };
    $id('cd-resumen').innerHTML = `
      ${metodos.map(m => `
        <div style="padding:10px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);text-align:center;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:4px;">${metLabels[m]||m}</div>
          <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:15px;color:var(--text);">${money(totVentas[m])}</div>
        </div>`).join('')}
      <div style="padding:10px 14px;background:rgba(240,165,0,0.07);border:1px solid rgba(240,165,0,0.2);border-radius:var(--radius-sm);text-align:center;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:4px;">Total general</div>
        <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:15px;color:var(--accent);">${money(corte.total_ventas || 0)}</div>
      </div>`;

    // Ventas table
    $id('cd-ventas-count').textContent = ventas.length;
    if (ventas.length === 0) {
      $id('cd-ventas-tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text3);">Sin ventas en este corte</td></tr>';
    } else {
      $id('cd-ventas-tbody').innerHTML = ventas.map(v => `<tr>
        <td style="font-weight:600;color:var(--accent);">${escHtml(v.folio_venta)}</td>
        <td>${escHtml(v.cliente_nombre || '—')}</td>
        <td><span class="badge-metodo badge-${v.metodo_pago}">${metLabels[v.metodo_pago]||v.metodo_pago}</span></td>
        <td class="text-right" style="font-weight:700;">${money(v.total)}</td>
        <td style="color:var(--text3);font-size:11px;">${v.fecha_finalizacion ? new Date(v.fecha_finalizacion).toLocaleTimeString('es-MX') : '—'}</td>
      </tr>`).join('');
    }

    // Cobros servicios table
    $id('cd-srv-count').textContent = pagosServicio.length;
    if (pagosServicio.length === 0) {
      $id('cd-srv-tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:16px;color:var(--text3);">Sin cobros de servicios en este corte</td></tr>';
    } else {
      $id('cd-srv-tbody').innerHTML = pagosServicio.map(p => `<tr>
        <td style="font-weight:600;color:var(--accent);font-size:11px;">${escHtml(p.servicio_folio||'—')}</td>
        <td>${escHtml(p.cliente_nombre||'—')}</td>
        <td style="font-size:11px;color:var(--text2);">${escHtml(p.modelo||'—')}</td>
        <td style="font-size:11px;">${escHtml(p.concepto||'—')}${p.fuera_caja ? ' <span style="font-size:9px;padding:1px 5px;border-radius:8px;background:rgba(255,165,0,0.15);color:orange;font-weight:700;">Fuera de caja</span>' : ''}</td>
        <td><span class="badge-metodo badge-${p.metodo}">${metLabels[p.metodo]||p.metodo}</span></td>
        <td class="text-right" style="font-weight:700;color:var(--success);">${money(p.monto)}</td>
        <td style="color:var(--text3);font-size:11px;">${p.fecha ? new Date(p.fecha).toLocaleTimeString('es-MX') : '—'}</td>
      </tr>`).join('');
    }
  } catch(e) {
    $id('cd-resumen').innerHTML = `<div style="grid-column:1/-1;color:var(--danger);text-align:center;padding:20px;">${e.message}</div>`;
  }
}

function printCorteTicket() {
  if (!_corteDetalleData) return;
  const { corte, ventas, pagosServicio } = _corteDetalleData;
  const metLabels = { efectivo:'Efectivo', tarjeta:'Tarjeta', transferencia:'Transferencia', credito:'Crédito', mixto:'Mixto' };
  const fmtTime = d => d ? new Date(d).toLocaleTimeString('es-MX') : '—';
  const fmtDt   = d => d ? new Date(d).toLocaleString('es-MX', { dateStyle:'short', timeStyle:'short' }) : '—';
  const m = n => '$' + Number(n||0).toFixed(2);

  let html = `<div style="font-family:Arial,sans-serif;font-size:12px;color:#000;width:100%;text-align:center;">
    <h3 style="margin:4px 0;font-size:14px;">CORTE DE CAJA</h3>
    <p style="margin:2px 0;font-size:12px;font-weight:bold;">${corte.folio_corte || 'Corte #' + corte.id}</p>
    <p style="margin:2px 0;font-size:11px;">${corte.usuario_nombre || ''} · ${corte.nombre_local || ''}</p>
    <p style="margin:2px 0;font-size:11px;">Apertura: ${fmtDt(corte.fecha_apertura)}</p>
    <p style="margin:2px 0;font-size:11px;">Cierre: ${corte.fecha_cierre ? fmtDt(corte.fecha_cierre) : 'Abierto'}</p>
    <hr style="border:none;border-top:1px dashed #000;margin:8px 0;">
    <table style="width:100%;font-size:11px;border-collapse:collapse;text-align:left;">
      <tr><td>Fondo apertura:</td><td style="text-align:right;">${m(corte.fondo_apertura)}</td></tr>
      <tr><td>Efectivo:</td><td style="text-align:right;">${m(corte.total_efectivo)}</td></tr>
      <tr><td>Tarjeta:</td><td style="text-align:right;">${m(corte.total_tarjeta)}</td></tr>
      <tr><td>Transferencia:</td><td style="text-align:right;">${m(corte.total_transferencia)}</td></tr>
      <tr style="font-weight:bold;border-top:1px solid #000;"><td>Total ventas:</td><td style="text-align:right;">${m(corte.total_ventas)}</td></tr>
      ${corte.efectivo_contado !== null && corte.efectivo_contado !== undefined ? `
      <tr><td>Efectivo contado:</td><td style="text-align:right;">${m(corte.efectivo_contado)}</td></tr>
      <tr><td>Diferencia:</td><td style="text-align:right;${(corte.diferencia||0)<0?'color:red;':''}">${m(corte.diferencia)}</td></tr>` : ''}
    </table>`;

  if (ventas.length > 0) {
    html += `<hr style="border:none;border-top:1px dashed #000;margin:8px 0;">
    <p style="font-size:11px;font-weight:bold;margin:4px 0;">VENTAS (${ventas.length})</p>
    <table style="width:100%;font-size:10px;border-collapse:collapse;">
      ${ventas.map(v => `<tr><td>${escHtml(v.folio_venta)}</td><td>${metLabels[v.metodo_pago]||v.metodo_pago}</td><td style="text-align:right;">${m(v.total)}</td><td style="color:#666;">${fmtTime(v.fecha_finalizacion)}</td></tr>`).join('')}
    </table>`;
  }

  if (pagosServicio.length > 0) {
    html += `<hr style="border:none;border-top:1px dashed #000;margin:8px 0;">
    <p style="font-size:11px;font-weight:bold;margin:4px 0;">COBROS SERVICIOS (${pagosServicio.length})</p>
    <table style="width:100%;font-size:10px;border-collapse:collapse;">
      ${pagosServicio.map(p => `<tr><td>${escHtml(p.servicio_folio||'')}</td><td>${metLabels[p.metodo]||p.metodo}</td><td style="text-align:right;">${m(p.monto)}</td><td style="color:#666;">${fmtTime(p.fecha)}</td></tr>`).join('')}
    </table>`;
  }

  html += `<hr style="border:none;border-top:1px dashed #000;margin:8px 0;">
    <p style="font-size:10px;color:#666;">Impreso: ${new Date().toLocaleString('es-MX')}</p>
  </div>`;

  const printWin = window.open('', '_blank', 'width=400,height=700');
  printWin.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Corte ${corte.folio_corte||''}</title>
    <style>@media print{@page{size:58mm auto;margin:0}body,html{margin:0;padding:0;width:58mm}}
    body{margin:0;padding:4px;font-family:Arial,sans-serif;font-size:12px;width:58mm;box-sizing:border-box;}</style>
    </head><body>${html}<script>window.onload=function(){setTimeout(function(){window.print();window.close();},300)};<\/script></body></html>`);
  printWin.document.close();
}

// --- Cobros de servicios en reporte ---
async function loadCobrosServiciosReporte() {
  const desde = $id('rep-start').value;
  const hasta  = $id('rep-end').value;
  const tbody  = $id('rs-cobros-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:16px;color:var(--text2);"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>';
  try {
    let url = '/servicios/pagos';
    if (desde) url += (url.includes('?') ? '&' : '?') + 'desde=' + desde;
    if (hasta) url += (url.includes('?') ? '&' : '?') + 'hasta=' + hasta;
    const res = await api('GET', url);
    const { resumen, pagos } = res;
    const cards = $id('rs-cobros-cards');
    if (cards) {
      cards.style.display = '';
      $id('rs-cobros-total').textContent        = money(resumen.total_monto);
      $id('rs-cobros-efectivo').textContent     = money(resumen.total_efectivo);
      $id('rs-cobros-tarjeta').textContent      = money(resumen.total_tarjeta);
      $id('rs-cobros-transferencia').textContent= money(resumen.total_transferencia);
    }
    const countEl = $id('rs-cobros-resumen');
    if (countEl) countEl.textContent = pagos.length + ' cobro' + (pagos.length !== 1 ? 's' : '');
    reportCobrosData = pagos;
    cobrosPage = 1;
    renderCobrosReporte();
  } catch(e) {
    const tbody = $id('rs-cobros-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger);text-align:center;padding:16px;">${e.message}</td></tr>`;
  }
}

function renderCobrosReporte() {
  const perPage = parseInt($id('cobros-per-page')?.value) || 25;
  const sorted = clientSort(reportCobrosData, cobrosSort.f, cobrosSort.d);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (cobrosPage > totalPages) cobrosPage = totalPages;
  const slice = perPage >= 9999 ? sorted : sorted.slice((cobrosPage - 1) * perPage, cobrosPage * perPage);
  const tbody = $id('rs-cobros-tbody');
  if (!tbody) return;
  const metLabels = { efectivo:'Efectivo', tarjeta:'Tarjeta', transferencia:'Transferencia', credito:'Crédito' };
  const concLabels = { saldo:'Saldo', anticipo:'Anticipo', mano_obra:'Mano obra', refaccion:'Refacción', otro:'Otro' };
  tbody.innerHTML = slice.length ? slice.map(p => `<tr>
    <td style="font-size:12px;color:var(--text2);">${p.fecha ? new Date(p.fecha).toLocaleString('es-MX', {dateStyle:'short',timeStyle:'short'}) : '—'}</td>
    <td style="font-weight:600;color:var(--accent);">${escHtml(p.servicio_folio||'—')}</td>
    <td>${escHtml(p.cliente_nombre||'—')}</td>
    <td style="font-size:11px;color:var(--text2);">${escHtml(p.modelo||'—')}</td>
    <td>
      <span style="font-size:11px;padding:2px 7px;border-radius:10px;background:var(--bg3);color:var(--text2);">${concLabels[p.concepto]||p.concepto||'—'}</span>
      ${p.fuera_caja ? '<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:rgba(255,165,0,0.15);color:orange;font-weight:700;margin-left:4px;">Fuera de caja</span>' : ''}
    </td>
    <td><span class="badge-metodo badge-${p.metodo}">${metLabels[p.metodo]||p.metodo}</span></td>
    <td class="text-right" style="font-weight:700;color:var(--success);">${money(p.monto)}</td>
  </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3);">Sin cobros en el período</td></tr>';
  updateSortIcons('rs-cobros-tbody', cobrosSort.f, cobrosSort.d);
  const pag = $id('cobros-pagination');
  if (pag) {
    pag.style.display = total > 0 ? 'flex' : 'none';
    const from = Math.min((cobrosPage - 1) * perPage + 1, total);
    const to   = Math.min(cobrosPage * perPage, total);
    const info = $id('cobros-page-info'); if (info) info.textContent = `${from}–${to} de ${total}`;
    const prev = $id('cobros-btn-prev'); if (prev) prev.disabled = cobrosPage <= 1;
    const next = $id('cobros-btn-next'); if (next) next.disabled = cobrosPage >= totalPages;
  }
}

// --- Reporte Créditos ---
creditosPendientes = [];
creditosLoadGen = 0;

async function loadReporteCreditos() {
  const tbody = $id('rcr-tbody');
  tableLoading(tbody, 6);
  try {
    let url = '/ventas?estado=credito_pendiente&limit=100';
    if (window.activeNotifFilter === 'credito_vencido' || window.activeNotifFilter === 'pago_pendiente') {
      url += '&notif=' + window.activeNotifFilter;
    }
    const res = await api('GET', url);
    creditosPendientes = Array.isArray(res) ? res : (res.data || []);

    // Summary
    if ($id('rcr-total')) $id('rcr-total').textContent = creditosPendientes.length;
    const montoTotal = creditosPendientes.reduce((s, v) => s + (v.total || 0), 0);
    if ($id('rcr-monto')) $id('rcr-monto').textContent = money(montoTotal);
    if ($id('rcr-mas-antiguo')) {
      const oldest = creditosPendientes.length > 0
        ? new Date(creditosPendientes[creditosPendientes.length - 1].fecha).toLocaleDateString('es-MX')
        : '-';
      $id('rcr-mas-antiguo').textContent = oldest;
    }

    renderCreditosTable(creditosPendientes);
  } catch(e) {
    showToast(e.message, 'error');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Error al cargar créditos</p></div></td></tr>';
  }
}

function renderCreditosTable(data) {
  if (data !== undefined) rcrFilteredData = data;
  const tbody = $id('rcr-tbody');
  if (!tbody) return;
  const perPage = parseInt($id('rcr-per-page')?.value) || 20;
  const sorted = clientSort(rcrFilteredData, rcrSort.f, rcrSort.d);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (rcrPage > totalPages) rcrPage = totalPages;
  const slice = perPage >= 9999 ? sorted : sorted.slice((rcrPage - 1) * perPage, rcrPage * perPage);
  const canFinalizar = currentUserData?.tipo === 'admin' || currentUserData?.tipo === 'root' || hasPermiso('reportes', 'borrar');
  const rowCls = (window.activeNotifFilter === 'credito_vencido' || window.activeNotifFilter === 'pago_pendiente') ? 'row-alerted' : '';
  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-hand-holding-dollar"></i><p>Sin créditos pendientes</p><span style="font-size:13px;color:var(--text3);">Todas las ventas están al corriente</span></div></td></tr>';
  } else {
    tbody.innerHTML = slice.map(v => {
      const fecha = new Date(v.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
      const diasPendiente = Math.floor((Date.now() - new Date(v.fecha).getTime()) / 86400000);
      const diasColor = diasPendiente > 7 ? 'var(--danger)' : diasPendiente > 3 ? 'var(--accent2)' : 'var(--text2)';
      return `<tr class="${rowCls}">
        <td class="col-priority-1">
          <span class="text-accent fw-bold">${escHtml(v.folio_venta)}</span>
          <div style="font-size:11px;color:${diasColor};margin-top:2px;">${diasPendiente === 0 ? 'Hoy' : `Hace ${diasPendiente} día${diasPendiente !== 1 ? 's' : ''}`}</div>
        </td>
        <td class="col-priority-1">${v.cliente_nombre ? `<span style="font-weight:500;">${escHtml(v.cliente_nombre)}</span>` : '<span style="color:var(--text3);">Sin cliente</span>'}</td>
        <td class="col-priority-2" style="font-size:13px;color:var(--text2);">${fecha}</td>
        <td class="col-priority-2" style="font-size:13px;" id="rcr-items-${v.id}"><span style="color:var(--text3);">-</span></td>
        <td class="col-priority-1 text-right"><span style="font-family:'Syne',sans-serif;font-weight:700;color:var(--accent);">${money(v.total)}</span></td>
        <td class="col-priority-1">
          ${canFinalizar
            ? `<button class="btn-accent" style="font-size:12px;padding:7px 14px;white-space:nowrap;" onclick="openFinalizarCredito(${v.id})"><i class="fa-solid fa-check"></i> Finalizar</button>`
            : `<span style="font-size:12px;color:var(--text3);">Sin permiso</span>`}
        </td>
      </tr>`;
    }).join('');

    // Load item summaries for visible rows with cancellation
    const gen = ++creditosLoadGen;
    (async () => {
      for (const v of slice) {
        if (gen !== creditosLoadGen) return;
        try {
          const detail = await api('GET', `/ventas/${v.id}`);
          if (gen !== creditosLoadGen) return;
          const el = $id('rcr-items-' + v.id);
          if (el && detail.items) {
            el.textContent = detail.items.map(i => `${i.cantidad}× ${i.producto_nombre}`).join(', ');
          }
        } catch(e) { /* ignore */ }
      }
    })();
  }
  updateSortIcons('rcr-tbody', rcrSort.f, rcrSort.d);
  const pag = $id('rcr-pagination');
  if (pag) {
    pag.style.display = total > 0 ? 'flex' : 'none';
    const from = Math.min((rcrPage - 1) * perPage + 1, total);
    const to   = Math.min(rcrPage * perPage, total);
    const info = $id('rcr-page-info'); if (info) info.textContent = `${from}–${to} de ${total}`;
    const prev = $id('rcr-btn-prev'); if (prev) prev.disabled = rcrPage <= 1;
    const next = $id('rcr-btn-next'); if (next) next.disabled = rcrPage >= totalPages;
  }
}

function filterCreditosTable(q) {
  rcrPage = 1;
  if (!q) { renderCreditosTable(creditosPendientes); return; }
  const qLow = q.toLowerCase();
  renderCreditosTable(creditosPendientes.filter(v =>
    (v.folio_venta || '').toLowerCase().includes(qLow) ||
    (v.cliente_nombre || '').toLowerCase().includes(qLow)
  ));
}

// ── Finalizar Crédito ──────────────────────────────────────
finalizarCreditoId = null;
finalizarCreditoMethod = 'efectivo';

async function openFinalizarCredito(ventaId) {
  const isAdmin = currentUserData?.tipo === 'admin' || currentUserData?.tipo === 'root';
  if (!isAdmin && !hasPermiso('reportes', 'borrar')) {
    showToast('Sin permiso para finalizar créditos', 'error'); return;
  }
  finalizarCreditoId = ventaId;
  finalizarCreditoMethod = 'efectivo';
  try {
    const v = await api('GET', `/ventas/${ventaId}`);
    $id('fc-modal-folio').textContent = v.folio_venta;
    $id('fc-modal-cliente').textContent = v.cliente_nombre || 'Sin cliente';
    $id('fc-modal-fecha').textContent = new Date(v.fecha).toLocaleDateString('es-MX');
    $id('fc-modal-total').textContent = money(v.total);
    $id('fc-modal-items').innerHTML = (v.items || []).map(i =>
      `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">
        <span>${i.cantidad}× ${escHtml(i.producto_nombre)}</span>
        <span style="color:var(--accent);font-weight:600;">${money(i.subtotal)}</span>
      </div>`
    ).join('') || '<span style="color:var(--text3);">Sin detalle</span>';

    // Reset method buttons
    document.querySelectorAll('#finalizar-credito-modal .pos-pay-btn').forEach(b => b.classList.remove('selected'));
    $id('fc-btn-efectivo').classList.add('selected');
    $id('finalizar-credito-modal').classList.add('open');
  } catch(e) { showToast(e.message, 'error'); }
}

function selectFinalizarMethod(btn, method) {
  finalizarCreditoMethod = method;
  document.querySelectorAll('#finalizar-credito-modal .pos-pay-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

async function confirmarFinalizarCredito() {
  if (!finalizarCreditoId) return;
  try {
    const result = await api('POST', `/ventas/${finalizarCreditoId}/finalizar`, {
      metodo_pago_final: finalizarCreditoMethod
    });
    $id('finalizar-credito-modal').classList.remove('open');
    showToast(`Crédito finalizado: ${result.folio_venta} — ${money(result.total)}`, 'success');
    loadReporteCreditos();
    // Refresh corte bar if POS is active
    if (corteActivo) checkCorteActivo();
  } catch(e) { showToast(e.message, 'error'); }
}

// --- Abono Modal ---
function openAbonoModal(creditoId) {
  const modal = $id('abono-modal');
  if (modal) modal.classList.add('open');
  // Stub: will load credit info
}

function closeAbonoModal() {
  const modal = $id('abono-modal');
  if (modal) modal.classList.remove('open');
}

// ===== REPORTES COMBINADOS =====
function switchReporteTab(tab) {
  const isAdmin = currentUserData?.tipo === 'admin' || currentUserData?.tipo === 'root';
  const tabPerms = { ventas:'ver', servicios:'crear', cortes:'editar', creditos:'borrar', auditoria:'ver' };
  if (tab !== 'auditoria' && !isAdmin && !hasPermiso('reportes', tabPerms[tab])) {
    showToast('Sin permiso para ver este reporte', 'error'); return;
  }
  if (tab === 'auditoria' && !isAdmin && !hasPermiso('auditoria', 'ver')) {
    showToast('Sin permiso para ver auditoría', 'error'); return;
  }
  creditosLoadGen++;
  const container = $id('page-reportes');
  container.classList.add('notransition');
  ['ventas','servicios','cortes','creditos','auditoria'].forEach(t => {
    const btn = $id('rep-tab-' + t);
    const panel = $id('rep-panel-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
    if (panel) panel.style.display = t === tab ? '' : 'none';
  });
  void container.offsetHeight;
  container.classList.remove('notransition');
  if (tab === 'ventas') loadReporteVentas();
  else if (tab === 'servicios') { /* user clicks Generar manually */ }
  else if (tab === 'cortes') loadReporteCortes();
  else if (tab === 'creditos') loadReporteCreditos();
  else if (tab === 'auditoria') loadLogs();
}

function loadReportes(defaultTab) {
  const isAdmin = currentUserData?.tipo === 'admin' || currentUserData?.tipo === 'root';
  // ver=Ventas, crear=Servicios, editar=Cortes, borrar=Créditos, auditoria=ver auditoria perm
  const tabPerms = { ventas:'ver', servicios:'crear', cortes:'editar', creditos:'borrar' };

  // Show/hide each tab button based on permissions
  Object.entries(tabPerms).forEach(([tab, perm]) => {
    const btn = $id('rep-tab-' + tab);
    if (btn) btn.style.display = (isAdmin || hasPermiso('reportes', perm)) ? '' : 'none';
  });
  const audBtn = $id('rep-tab-auditoria');
  if (audBtn) audBtn.style.display = (isAdmin || hasPermiso('auditoria', 'ver')) ? '' : 'none';

  // Find the first accessible tab
  const requested = defaultTab || 'ventas';
  const canAccess = (t) => {
    if (t === 'auditoria') return isAdmin || hasPermiso('auditoria', 'ver');
    return isAdmin || hasPermiso('reportes', tabPerms[t]);
  };
  let tabToShow = canAccess(requested) ? requested : null;
  if (!tabToShow) {
    for (const t of ['ventas','servicios','cortes','creditos','auditoria']) {
      if (canAccess(t)) { tabToShow = t; break; }
    }
  }
  if (tabToShow) switchReporteTab(tabToShow);
}

// ===== NOTIFICACIONES =====
// (NOTIF_TIPOS y NOTIF_ESTADOS_CONFIG se declaran arriba del archivo para evitar TDZ)

_notifInterval = null;
_notifData = { notifs: [], total: 0 };

// Cache local de notificaciones descartadas (espejo del estado del server) para
// poder hacer optimistic updates: el panel responde al instante y la llamada al
// backend ocurre en background.
const _dismissedNotifIds = new Set();

// Devuelve sólo las notificaciones que aún NO han sido descartadas localmente.
// El backend YA filtra las descartadas persistidas; este filtro local cubre el
// caso del optimistic update entre el click y el siguiente fetch.
function _visibleNotifs() {
  return (_notifData.notifs || []).filter(n => !_dismissedNotifIds.has(n.id));
}

// Refresca el panel + badge usando los datos visibles.
function _renderNotifsFiltered() {
  const visibles = _visibleNotifs();
  try { renderNotifPanel({ notifs: visibles, total: visibles.length }); }
  catch(e) { console.error('[notif] renderNotifPanel falló:', e); }
  updateNotifBadge(visibles.length);
}

// Descarta una notificación de forma PERSISTENTE. Hace optimistic update local
// y luego llama al backend para guardar el descarte. Si la llamada falla,
// revierte el cambio.
window.dismissNotif = async function(id, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  if (!id) return;
  // Optimistic: oculta inmediatamente
  _dismissedNotifIds.add(id);
  _renderNotifsFiltered();
  try {
    await api('POST', '/notificaciones/dismiss', { id });
  } catch(e) {
    console.error('[notif] no se pudo descartar:', e);
    // Revertir
    _dismissedNotifIds.delete(id);
    _renderNotifsFiltered();
    showToast('No se pudo descartar la notificación', 'error');
  }
};

// Restaura todas las descartadas del usuario y vuelve a consultar al server.
// Útil cuando uno quiere "ver de nuevo" todo lo que ha descartado.
window.refreshNotificaciones = async function() {
  try {
    await api('DELETE', '/notificaciones/dismissed');
    _dismissedNotifIds.clear();
  } catch(e) {
    console.error('[notif] no se pudo restaurar descartadas:', e);
    // Aun así intentamos recargar; el botón puede usarse sólo para refrescar.
  }
  loadNotificaciones();
};

function toggleNotifPanel() {
  const panel = $id('notif-panel');
  if (!panel) return;
  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'flex';
    // Mientras se carga, indicar que está actualizando para no dejar el panel "vacío".
    const body = $id('notif-panel-body');
    if (body) body.innerHTML = `<div class="notif-empty"><i class="fa-solid fa-spinner fa-spin" style="font-size:22px;display:block;margin-bottom:8px;color:var(--accent);"></i>Cargando notificaciones…</div>`;
    loadNotificaciones();
  } else {
    panel.style.display = 'none';
  }
}
function closeNotifPanel() {
  const p = $id('notif-panel');
  if (p) p.style.display = 'none';
}

async function loadNotificaciones() {
  if (!token) return;
  try {
    const data = await api('GET', '/notificaciones');
    _notifData = data && Array.isArray(data.notifs)
      ? { notifs: data.notifs, total: data.total ?? data.notifs.length }
      : { notifs: [], total: 0 };
    // El backend YA filtra las descartadas, así que el cache local sólo refleja
    // descartes optimistas que aún no llegaron al server; lo limpiamos para evitar
    // duplicar el filtro.
    _dismissedNotifIds.clear();
    _renderNotifsFiltered();
    const ts = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const el = $id('notif-last-update');
    if (el) el.textContent = `Actualizado ${ts}`;
  } catch(e) {
    console.error('[notif] fetch falló:', e);
    renderNotifError(e.message || 'Error al cargar notificaciones');
  }
}

function renderNotifError(msg) {
  const body = $id('notif-panel-body');
  if (!body) return;
  body.innerHTML = `<div class="notif-empty" style="color:var(--danger);"><i class="fa-solid fa-triangle-exclamation" style="font-size:24px;display:block;margin-bottom:8px;"></i><div style="font-size:13px;">${escHtml(msg)}</div></div>`;
}

function updateNotifBadge(total) {
  const badge = $id('notif-badge');
  if (!badge) return;
  if (total > 0) {
    badge.textContent = total > 99 ? '99+' : total;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderNotifPanel(data) {
  const body = $id('notif-panel-body');
  if (!body) return;
  const notifs = Array.isArray(data?.notifs) ? data.notifs : [];
  if (notifs.length === 0) {
    body.innerHTML = `<div class="notif-empty"><i class="fa-solid fa-circle-check" style="font-size:28px;opacity:0.3;display:block;margin-bottom:8px;color:var(--success);"></i>Sin alertas activas</div>`;
    return;
  }
  body.innerHTML = notifs.map(n => {
    const tipoCfg = NOTIF_TIPOS[n?.tipo] || { icon: 'fa-bell', page: null };
    // Escapamos apóstrofes para que los atributos onclick no se rompan.
    const safeEstado = n?.estado ? String(n.estado).replace(/'/g, "\\'") : null;
    const param = safeEstado ? `'${safeEstado}'` : 'null';
    const tipoSafe = String(n?.tipo || '').replace(/'/g, "\\'");
    const idSafe   = String(n?.id   || '').replace(/'/g, "\\'");
    const urgencia = n?.urgencia || 'media';
    const titulo = n?.titulo != null ? n.titulo : '';
    const detalle = n?.detalle != null ? n.detalle : '';
    const count = n?.count != null ? n.count : '';
    return `<div class="notif-item" onclick="handleNotifClick('${tipoSafe}', ${param}, '${idSafe}')">
      <div class="notif-icon ${urgencia}"><i class="fa-solid ${tipoCfg.icon}"></i></div>
      <div class="notif-item-body">
        <div class="notif-item-title">${escHtml(titulo)}</div>
        <div class="notif-item-detail">${escHtml(detalle)}</div>
      </div>
      <span class="notif-item-count">${escHtml(count)}</span>
      <button class="notif-item-dismiss" onclick="dismissNotif('${idSafe}', event)" title="Descartar esta notificación" aria-label="Descartar">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`;
  }).join('');
}

// Tabla de despacho: cada tipo de alerta define cómo navega y qué filtro aplica.
// Centralizar esto evita switch gigantes y facilita agregar nuevos tipos.
const NOTIF_HANDLERS = {
  servicio_estado: {
    apply(param) {
      const qs = $id('search-input'); if (qs) qs.value = '';
      if (param) { const sel = $id('filter-estado'); if (sel) sel.value = param; }
      currentPage = 1;
      goTo('services');
    },
  },
  stock_bajo: {
    apply() {
      const qp = $id('search-productos'); if (qp) qp.value = '';
      const s  = $id('filter-productos-stock'); if (s) s.value = 'bajo_stock';
      productosPage = 1;
      goTo('productos');
    },
  },
  credito_vencido:  { apply() { goTo('reportes'); switchReporteTab('creditos'); } },
  pago_pendiente:   { apply() { goTo('reportes'); switchReporteTab('creditos'); } },
  corte_sin_apertura: {
    keepFilter: false, // no aplica filtro, solo navega
    apply() { goTo('pos'); },
  },
  empleados_sin_actividad: {
    apply() {
      const qe = $id('filter-personas-q'); if (qe) qe.value = '';
      goTo('personas');
      setPersonasRolTab('empleado');
    },
  },
};

window.handleNotifClick = function(tipo, param, id) {
  closeNotifPanel();
  const handler = NOTIF_HANDLERS[tipo];
  if (!handler) { console.warn('[notif] handler no definido para', tipo); return; }

  if (handler.keepFilter === false) {
    window.activeNotifFilter = null;
    window.activeNotifParam  = null;
  } else {
    window.activeNotifFilter = tipo;
    window.activeNotifParam  = param || null;
    showNotifBanner();
  }
  // Auto-descartar de forma PERSISTENTE: el usuario ya la vio al hacer click.
  // Reusamos dismissNotif para que también guarde en el backend.
  if (id) dismissNotif(id);
  try { handler.apply(param); } catch(e) { console.error('[notif] error aplicando filtro', tipo, e); }
};

function startNotifWatcher() {
  if (_notifInterval) clearInterval(_notifInterval);
  loadNotificaciones();
  _notifInterval = setInterval(loadNotificaciones, 5 * 60 * 1000); // every 5 min
}
function stopNotifWatcher() {
  if (_notifInterval) { clearInterval(_notifInterval); _notifInterval = null; }
}

// Close notif panel when clicking outside
document.addEventListener('click', e => {
  const panel = $id('notif-panel');
  const bell  = $id('notif-bell-btn');
  if (panel && panel.style.display !== 'none' && !panel.contains(e.target) && !bell?.contains(e.target)) {
    panel.style.display = 'none';
  }
});

// ── Config accordion for Notificaciones ──
function renderNotifEstadosConfig(cfg) {
  const container = $id('notif-estados-config');
  if (!container) return;
  const estadosAlerta = cfg?.estados_alerta || {};
  container.innerHTML = NOTIF_ESTADOS_CONFIG.map(ec => {
    const saved = estadosAlerta[ec.key] || {};
    const activo = saved.activo !== undefined ? saved.activo : true;
    const horas  = saved.horas  !== undefined ? saved.horas  : ec.defaultHoras;
    const safeKey = ec.key.replace(/[^a-zA-Z0-9]/g, '_');
    return `<div class="notif-estado-row" style="display:grid;grid-template-columns:1fr 60px 130px;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;font-size:13px;">
        <span class="status-pill ${ec.clase}" style="font-size:11px;">${ec.label}</span>
      </div>
      <div style="display:flex;justify-content:center;">
        <label class="toggle-switch" style="transform:scale(0.85);">
          <input type="checkbox" id="notif-est-activo-${safeKey}" ${activo ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <input type="number" class="f-input" id="notif-est-horas-${safeKey}" value="${horas}" min="1" max="720" style="width:60px;text-align:center;padding:6px 4px;font-size:13px;">
        <span style="font-size:12px;color:var(--text3);">${horas >= 24 ? 'h' : 'h'}</span>
        <span style="font-size:11px;color:var(--text3);">${horas >= 24 ? '('+(horas/24).toFixed(horas%24===0?0:1)+'d)' : ''}</span>
      </div>
    </div>`;
  }).join('');
}

function loadNotificacionesConfig(cfg) {
  if (!cfg) cfg = {};
  renderNotifEstadosConfig(cfg);

  // Stock bajo
  const sb = cfg.stock_bajo || {};
  const cbStk = $id('notif-stock-activo'); if (cbStk) cbStk.checked = sb.activo !== false;
  const inStk = $id('notif-stock-umbral');  if (inStk) inStk.value  = sb.umbral  ?? 5;

  // Créditos
  const cr = cfg.creditos_vencidos || {};
  const cbCr = $id('notif-credito-activo'); if (cbCr) cbCr.checked = cr.activo !== false;
  const inCr = $id('notif-credito-dias');   if (inCr) inCr.value   = cr.dias    ?? 7;

  // Pagos pendientes
  const pp = cfg.pagos_pendientes || {};
  const cbPp = $id('notif-pagos-activo'); if (cbPp) cbPp.checked = pp.activo !== false;

  // Corte
  const co = cfg.corte_sin_apertura || {};
  const cbCo = $id('notif-corte-activo'); if (cbCo) cbCo.checked = co.activo !== false;
  const inCo = $id('notif-corte-hora');   if (inCo) inCo.value   = co.hora    ?? '10:00';

  // Root: empleados sin actividad
  const ea = cfg.empleados_sin_actividad || {};
  const cbEa = $id('notif-emp-activo'); if (cbEa) cbEa.checked = ea.activo !== false;
  const inEa = $id('notif-emp-dias');   if (inEa) inEa.value   = ea.dias    ?? 3;

  // Show root section
  const rootSec = $id('notif-root-section');
  if (rootSec) rootSec.style.display = currentUserData?.tipo === 'root' ? '' : 'none';
}

function readNotificacionesConfigForm() {
  const estadosAlerta = {};
  NOTIF_ESTADOS_CONFIG.forEach(ec => {
    const safeKey = ec.key.replace(/[^a-zA-Z0-9]/g, '_');
    const activo = !!$id(`notif-est-activo-${safeKey}`)?.checked;
    const horas  = parseInt($id(`notif-est-horas-${safeKey}`)?.value) || ec.defaultHoras;
    estadosAlerta[ec.key] = { activo, horas };
  });
  const cfg = {
    estados_alerta: estadosAlerta,
    stock_bajo:    { activo: !!$id('notif-stock-activo')?.checked,  umbral: parseInt($id('notif-stock-umbral')?.value)  || 5  },
    creditos_vencidos: { activo: !!$id('notif-credito-activo')?.checked, dias: parseInt($id('notif-credito-dias')?.value) || 7  },
    pagos_pendientes:  { activo: !!$id('notif-pagos-activo')?.checked  },
    corte_sin_apertura:{ activo: !!$id('notif-corte-activo')?.checked,  hora: $id('notif-corte-hora')?.value || '10:00' },
    empleados_sin_actividad: { activo: !!$id('notif-emp-activo')?.checked, dias: parseInt($id('notif-emp-dias')?.value) || 3 },
  };
  return cfg;
}

async function saveNotificacionesConfig() {
  const cfg = readNotificacionesConfigForm();
  try {
    await api('PUT', '/configuracion/notificaciones', { notificaciones_config: JSON.stringify(cfg) });
    if (currentConfig) currentConfig.notificaciones_config = JSON.stringify(cfg);
    showToast('Configuración de notificaciones guardada', 'success');
    loadNotificaciones(); // refresh badge
  } catch(e) { showToast(e.message, 'error'); }
}

// ===== ROLES CONFIG =====
// allRoles and allEstados are declared at the top of the file (near line 1524)

async function loadEstadosConfig() {
  try {
    allEstados = await api('GET', '/configuracion/estados');
  } catch(e) {
    allEstados = [
      { id: 'recibido',            nombre: 'Recibido',            color: '#f0a500', sistema: true  },
      { id: 'diagnostico',         nombre: 'Diagnóstico',         color: '#3b82f6', sistema: false },
      { id: 'en_proceso',          nombre: 'En proceso',          color: '#3b82f6', sistema: false },
      { id: 'esperando_refaccion', nombre: 'Esperando refacción', color: '#f0a500', sistema: false },
      { id: 'listo',               nombre: 'Listo',               color: '#2ed573', sistema: false },
      { id: 'entregado',           nombre: 'Entregado',           color: '#f59e0b', sistema: true  },
      { id: 'cancelado',           nombre: 'Cancelado',           color: '#ff4757', sistema: true  },
    ];
  }
  renderEstadosList();
  populateFilterEstado();
}

function populateFilterEstado() {
  const sel = $id('filter-estado');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">Todos los estados</option>' +
    allEstados.map(e => `<option value="${escHtml(e.nombre)}"${e.nombre === current ? ' selected' : ''}>${escHtml(e.nombre)}</option>`).join('');
}

function renderEstadosList() {
  const el = $id('estados-list');
  if (!el) return;
  el.innerHTML = allEstados.map(e => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
      <span class="status-pill" style="${getEstadoStyle(e.nombre)};font-size:12px;min-width:130px;text-align:center;">${escHtml(e.nombre)}</span>
      <input type="color" value="${e.color}" onchange="updateEstadoColor('${e.id}',this.value)"
        style="width:36px;height:30px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:none;padding:2px;flex-shrink:0;">
      ${e.sistema
        ? `<span style="font-size:11px;color:var(--text3);margin-left:auto;"><i class="fa-solid fa-lock" style="margin-right:4px;"></i>Sistema</span>`
        : `<button class="act-btn delete" onclick="deleteEstado('${e.id}')" title="Eliminar" style="margin-left:auto;"><i class="fa-solid fa-trash"></i></button>`}
    </div>`).join('');
}

function updateEstadoColor(id, color) {
  const e = allEstados.find(x => x.id === id);
  if (e) { e.color = color; renderEstadosList(); }
}

function addEstado() {
  const nombre = $id('nuevo-estado-nombre').value.trim();
  const color  = $id('nuevo-estado-color').value;
  if (!nombre) { showToast('Ingresa un nombre para el estado', 'error'); return; }
  const id = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_');
  if (allEstados.find(e => e.id === id || e.nombre.toLowerCase() === nombre.toLowerCase())) {
    showToast('Ya existe un estado con ese nombre', 'error'); return;
  }
  allEstados.splice(allEstados.length - 1, 0, { id, nombre, color, sistema: false });
  $id('nuevo-estado-nombre').value = '';
  renderEstadosList();
}

function deleteEstado(id) {
  allEstados = allEstados.filter(e => e.id !== id);
  renderEstadosList();
}

async function saveEstadosConfig() {
  const btn = document.querySelector('#cfg-collapse-estados .btn-accent[onclick="saveEstadosConfig()"]');
  btnLoading(btn, true);
  try {
    await api('PUT', '/configuracion/estados', { estados: allEstados });
    await loadEstadosConfig();
    showToast('Estados guardados', 'success');
  } catch(e) { showToast(e.message || 'Error al guardar', 'error'); }
  finally { btnLoading(btn, false); }
}

async function loadRolesConfig() {
  try {
    const { roles } = await api('GET', '/configuracion/roles');
    allRoles = roles || [];
  } catch(e) {
    allRoles = [
      { id: 'cliente',   nombre: 'Cliente',   color: '#1e90ff', sistema: true },
      { id: 'empleado',  nombre: 'Empleado',  color: '#00d4aa', sistema: true },
      { id: 'proveedor', nombre: 'Proveedor', color: '#f0a500', sistema: true },
    ];
  }
  renderRolesList();
  renderRolesCheckboxes();
}

function renderRolesList() {
  const el = $id('roles-list');
  if (!el) return;
  el.innerHTML = allRoles.map(r => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:var(--radius-sm);border:1px solid var(--border);">
      <span style="width:14px;height:14px;border-radius:50%;background:${r.color};flex-shrink:0;display:inline-block;"></span>
      <span style="flex:1;font-size:13px;font-weight:600;">${escHtml(r.nombre)}</span>
      ${r.sistema
        ? `<span style="font-size:11px;color:var(--text3);padding:2px 7px;border-radius:4px;background:var(--bg2);">Sistema</span>`
        : `<input type="color" value="${r.color}" onchange="updateCustomRolColor('${r.id}',this.value)"
              style="width:28px;height:24px;border:none;border-radius:4px;cursor:pointer;background:none;padding:0;" title="Cambiar color">
           <button onclick="deleteCustomRol('${r.id}')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;padding:2px 4px;" title="Eliminar">
             <i class="fa-solid fa-trash"></i>
           </button>`
      }
    </div>`).join('');
}

function renderRolesCheckboxes(selectedRoles) {
  const el = $id('roles-checkboxes');
  if (!el) return;
  const selected = selectedRoles || ['cliente'];
  el.innerHTML = allRoles.map(r => `
    <label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);">
      <input type="checkbox" value="${r.id}" ${selected.includes(r.id) ? 'checked' : ''}
        style="width:14px;height:14px;cursor:pointer;accent-color:${r.color};">
      <span style="width:8px;height:8px;border-radius:50%;background:${r.color};display:inline-block;"></span>
      ${escHtml(r.nombre)}
    </label>`).join('');
}

function getRolesChecked() {
  const el = $id('roles-checkboxes');
  if (!el) return ['cliente'];
  return Array.from(el.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
}

function addRolPersonalizado() {
  const nombre = $id('nuevo-rol-nombre').value.trim();
  if (!nombre) { showToast('Escribe un nombre para el rol', 'error'); return; }
  const color = $id('nuevo-rol-color').value;
  const id = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'_');
  if (allRoles.find(r => r.id === id)) { showToast('Ya existe un rol con ese nombre', 'error'); return; }
  allRoles.push({ id, nombre, color, sistema: false });
  $id('nuevo-rol-nombre').value = '';
  renderRolesList();
}

function deleteCustomRol(id) {
  allRoles = allRoles.filter(r => r.id !== id);
  renderRolesList();
}

function updateCustomRolColor(id, color) {
  const r = allRoles.find(r => r.id === id);
  if (r) r.color = color;
}

async function saveRolesConfig() {
  const btn = document.querySelector('#cfg-collapse-roles .btn-accent:last-of-type');
  btnLoading(btn, true);
  try {
    await api('PUT', '/configuracion/roles', { roles: allRoles.filter(r => !r.sistema) });
    await loadRolesConfig();
    showToast('Roles guardados', 'success');
  } catch(e) { showToast(e.message, 'error'); }
  finally { btnLoading(btn, false); }
}

// ===== TIPOS DE PRODUCTO =====
// allTiposProducto and allNivelesPrecios are declared at the top of the file (near line 1524)

async function loadTiposProductos() {
  try {
    const { tipos } = await api('GET', '/configuracion/tipos-productos');
    allTiposProducto = tipos || [];
  } catch(e) {
    allTiposProducto = [];
  }
  renderTiposProductosList();
  populateTipoProductoSelect();
}

function renderTiposProductosList() {
  const el = $id('tipos-productos-list');
  if (!el) return;
  if (!allTiposProducto.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text3);padding:4px 0;">Sin tipos definidos. Agrega el primero.</div>';
    return;
  }
  el.innerHTML = allTiposProducto.map(t => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:var(--radius-sm);border:1px solid var(--border);">
      <span style="width:14px;height:14px;border-radius:50%;background:${t.color};flex-shrink:0;display:inline-block;"></span>
      <span style="flex:1;font-size:13px;font-weight:600;">${escHtml(t.nombre)}</span>
      <span style="font-family:monospace;font-size:11px;color:var(--text2);background:var(--bg2);padding:2px 7px;border-radius:4px;">${escHtml(t.prefijo)}</span>
      <input type="color" value="${t.color}" onchange="updateTipoColor('${t.id}',this.value)"
        style="width:28px;height:24px;border:none;border-radius:4px;cursor:pointer;background:none;padding:0;" title="Cambiar color">
      <button onclick="deleteTipoProducto('${t.id}')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;padding:2px 4px;" title="Eliminar">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`).join('');
}

function populateTipoProductoSelect(selectedId) {
  const sel = $id('fp-tipo-producto');
  if (!sel) return;
  const prev = selectedId ?? sel.value;
  sel.innerHTML = '<option value="">— Sin tipo —</option>' +
    allTiposProducto.map(t => `<option value="${t.id}" ${t.id === prev ? 'selected' : ''}>${escHtml(t.nombre)}</option>`).join('');
}

function addTipoProducto() {
  const nombre = $id('nuevo-tipo-nombre').value.trim();
  if (!nombre) { showToast('Escribe un nombre para el tipo', 'error'); return; }
  const prefijo = ($id('nuevo-tipo-prefijo').value.trim() || nombre.substring(0,4)).toUpperCase().replace(/[^A-Z0-9]/g,'');
  const color  = $id('nuevo-tipo-color').value;
  const id     = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_');
  if (allTiposProducto.find(t => t.id === id)) { showToast('Ya existe un tipo con ese nombre', 'error'); return; }
  allTiposProducto.push({ id, nombre, prefijo, color });
  $id('nuevo-tipo-nombre').value  = '';
  $id('nuevo-tipo-prefijo').value = '';
  renderTiposProductosList();
}

function deleteTipoProducto(id) {
  allTiposProducto = allTiposProducto.filter(t => t.id !== id);
  renderTiposProductosList();
}

function updateTipoColor(id, color) {
  const t = allTiposProducto.find(t => t.id === id);
  if (t) { t.color = color; renderTiposProductosList(); }
}

async function saveTiposProductosConfig() {
  const btn = document.querySelector('#cfg-collapse-tipos-productos .btn-accent:last-of-type');
  btnLoading(btn, true);
  try {
    await api('PUT', '/configuracion/tipos-productos', { tipos: allTiposProducto });
    await loadTiposProductos();
    showToast('Tipos de producto guardados', 'success');
  } catch(e) { showToast(e.message, 'error'); }
  finally { btnLoading(btn, false); }
}

async function loadNivelesPrecios() {
  try {
    const { niveles } = await api('GET', '/configuracion/niveles-precio');
    allNivelesPrecios = niveles || [];
  } catch(e) {
    allNivelesPrecios = [{ nombre: 'Precio de venta' }, { nombre: 'Precio mayorista' }, { nombre: 'Precio especial' }];
  }
  renderNivelesPrecioList();
  renderPreciosForm([]);
}

function renderNivelesPrecioList() {
  const el = $id('niveles-precio-list');
  if (!el) return;
  el.innerHTML = allNivelesPrecios.map((n, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--bg3);border-radius:var(--radius-sm);border:1px solid var(--border);">
      <span style="font-size:11px;font-weight:700;color:var(--text3);min-width:20px;">#${i + 1}</span>
      <input class="f-input" style="flex:1;height:32px;font-size:13px;" value="${escHtml(n.nombre)}"
        oninput="allNivelesPrecios[${i}].nombre = this.value"
        ${i === 0 ? 'placeholder="Precio de venta (requerido)"' : 'placeholder="Nivel ' + (i+1) + '"'}>
      ${i === 0
        ? '<span style="font-size:11px;color:var(--text3);padding:2px 7px;background:var(--bg2);border-radius:4px;">Base</span>'
        : '<button onclick="deleteNivelPrecio(' + i + ')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;padding:2px 4px;"><i class="fa-solid fa-trash"></i></button>'
      }
    </div>`).join('');
}

function addNivelPrecio() {
  const nombre = $id('nuevo-nivel-nombre').value.trim();
  if (!nombre) { showToast('Escribe un nombre para el nivel', 'error'); return; }
  allNivelesPrecios.push({ nombre });
  $id('nuevo-nivel-nombre').value = '';
  renderNivelesPrecioList();
}

function deleteNivelPrecio(idx) {
  if (idx === 0) return;
  allNivelesPrecios.splice(idx, 1);
  renderNivelesPrecioList();
}

async function saveNivelesPrecios() {
  const btn = document.querySelector('#cfg-collapse-tipos-productos .btn-accent[onclick="saveNivelesPrecios()"]');
  btnLoading(btn, true);
  try {
    await api('PUT', '/configuracion/niveles-precio', { niveles: allNivelesPrecios });
    await loadNivelesPrecios();
    showToast('Niveles de precio guardados', 'success');
  } catch(e) { showToast(e.message, 'error'); }
  finally { btnLoading(btn, false); }
}

function renderPreciosForm() { /* deprecated — single venta field is now static in the form */ }

function onProductoTipoChange() {
  const tipoId = $id('fp-tipo-producto').value;
  const tipo = allTiposProducto.find(t => t.id === tipoId);
  if (tipo && tipo.prefijo && !$id('fp-sku').value.trim()) {
    $id('fp-sku').value = tipo.prefijo + '-';
    $id('fp-sku').focus();
    // Put cursor at end
    const el = $id('fp-sku');
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }
}

// ===== PERSONAS MODULE =====
personasPage = 1;
personasRolTab = 'cliente';
PERSONAS_PER_PAGE = 20;
editingPersonaId = null;
permisosPersonaId = null;

async function loadPersonas() {
  const tbody = $id('personas-tbody');
  tableLoading(tbody, 7);
  const q   = $id('filter-personas-q')?.value || '';
  const emp = $id('filter-personas-empresa')?.value || '';
  PERSONAS_PER_PAGE = parseInt($id('per-per-page')?.value) || PERSONAS_PER_PAGE;
  let url = `/personas?page=${personasPage}&limit=${PERSONAS_PER_PAGE}&sort=${perSort.f}_${perSort.d}`;
  if (q)              url += '&q=' + encodeURIComponent(q);
  if (personasRolTab) url += '&rol=' + encodeURIComponent(personasRolTab);
  if (emp)            url += '&empresa_id=' + emp;
  if (window.activeNotifFilter === 'empleados_sin_actividad') url += '&notif=' + window.activeNotifFilter;
  try {
    const { data, total } = await api('GET', url);
    const infoEl = $id('personas-table-info');
    if (infoEl) infoEl.textContent = `${total} registro${total !== 1 ? 's' : ''}`;
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-users"></i><p>Sin personas registradas</p></div></td></tr>`;
    } else {
      const isRoot    = currentUserData?.tipo === 'root';
      const canEdit   = isRoot || currentUserData?.tipo === 'admin' || hasPermiso('personas','editar');
      const canDelete = isRoot || currentUserData?.tipo === 'admin' || hasPermiso('personas','borrar');
      const rowCls    = rowAlertClass('empleados_sin_actividad');
      tbody.innerHTML = data.map(p => {
        const rolesBadges = (p.roles || 'cliente').split(',').map(r => {
          const rol = allRoles.find(ar => ar.id === r) || { nombre: r, color: '#888' };
          return `<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:${rol.color}22;color:${rol.color};font-weight:600;border:1px solid ${rol.color}44;">${escHtml(rol.nombre)}</span>`;
        }).join(' ');
        // Badge de acceso: muestra tipo + estado activo/inactivo si aplica
        let accesoBadge;
        if (!p.tipo) {
          accesoBadge = `<span style="font-size:11px;color:var(--text3);">—</span>`;
        } else if (p.activo) {
          accesoBadge = `<span class="status-pill sp-done" style="font-size:10px;">${p.tipo}</span>`;
        } else {
          accesoBadge = `<span class="status-pill" style="font-size:10px;background:rgba(120,120,120,0.15);color:var(--text2);border:1px solid var(--border);">${p.tipo} · inactivo</span>`;
        }
        // Sucursal/Empresa: para root muestra ambos, para no-root solo sucursal (la empresa es la suya)
        const sucursal = p.nombre_local
          ? escHtml(p.nombre_local)
          : `<span style="color:var(--text3);font-style:italic;">Sin sucursal</span>`;
        const ubicacion = isRoot
          ? `<div style="font-weight:600;font-size:12px;">${escHtml(p.empresa_nombre || '—')}</div>
             <div style="font-size:11px;color:var(--text2);margin-top:2px;"><i class="fa-solid fa-store" style="font-size:9px;margin-right:3px;color:var(--text3);"></i>${sucursal}</div>`
          : `<div style="font-size:12px;color:var(--text2);"><i class="fa-solid fa-store" style="font-size:10px;margin-right:4px;color:var(--text3);"></i>${sucursal}</div>`;
        return `<tr class="${rowCls}">
          <td style="font-weight:600;">${escHtml(p.nombre)}</td>
          <td>${rolesBadges}</td>
          <td style="color:var(--text2);font-size:12px;">${escHtml(p.correo || '—')}</td>
          <td style="color:var(--text2);font-size:12px;">${escHtml(p.telefono || '—')}</td>
          <td>${accesoBadge}</td>
          <td>${ubicacion}</td>
          <td>
            <div class="act-btns">
              ${canEdit ? `<button class="act-btn edit" onclick="openPersonaModal(${p.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>` : ''}
              ${p.tipo && (currentUserData?.tipo === 'root' || currentUserData?.tipo === 'admin') ? `<button class="act-btn" onclick="openPersonaPermisos(${p.id},'${escHtml(p.nombre)}')" title="Permisos" style="color:var(--accent);"><i class="fa-solid fa-shield-halved"></i></button>` : ''}
              ${p.tipo && p.tipo !== 'root' && p.id !== currentUserData?.id && (currentUserData?.tipo === 'root' || currentUserData?.tipo === 'admin')
                ? (p.activo
                    ? `<button class="act-btn" onclick="togglePersonaEstado(${p.id}, false, '${escHtml(p.nombre)}')" title="Desactivar usuario" style="color:#e0a800;"><i class="fa-solid fa-user-slash"></i></button>`
                    : `<button class="act-btn" onclick="togglePersonaEstado(${p.id}, true,  '${escHtml(p.nombre)}')" title="Reactivar usuario" style="color:#28a745;"><i class="fa-solid fa-user-check"></i></button>`)
                : ''}
              ${canDelete ? `<button class="act-btn delete" onclick="deletePersona(${p.id})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
          </td>
        </tr>`;
      }).join('');
    }
    // Pagination — usa renderPagination() reducida con elipsis
    const totalPages = Math.ceil(total / PERSONAS_PER_PAGE) || 1;
    renderPagination($id('personas-pagination'), personasPage, totalPages, p => { personasPage = p; loadPersonas(); });
  } catch(e) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>Error cargando personas</p></div></td></tr>`; }
}

async function togglePersonaEstado(id, activarAhora, nombre) {
  const accion  = activarAhora ? 'reactivar' : 'desactivar';
  const mensaje = activarAhora
    ? `¿Reactivar a ${nombre}? Podrá volver a iniciar sesión.`
    : `¿Desactivar a ${nombre}? No podrá iniciar sesión hasta que lo reactives. Sus servicios y registros NO se borran.`;
  if (!confirm(mensaje)) return;
  try {
    await api('PUT', '/personas/' + id + '/estado', { activo: activarAhora });
    showToast(`Usuario ${activarAhora ? 'reactivado' : 'desactivado'} correctamente`, 'success');
    loadPersonas();
  } catch (e) {
    showToast(e.message || `No se pudo ${accion} el usuario`, 'error');
  }
}

function setPersonasRolTab(tab) {
  personasRolTab = tab;
  personasPage = 1;
  document.querySelectorAll('#personas-rol-tabs .cfg-tab').forEach(b => b.classList.remove('active'));
  const el = $id('prstab-' + tab);
  if (el) el.classList.add('active');
  loadPersonas();
}

async function openPersonaModal(id = null) {
  editingPersonaId = id;
  $id('persona-modal-title').textContent = id ? 'Editar Persona' : 'Nueva Persona';
  $id('btn-save-persona-label').textContent = id ? 'Guardar cambios' : 'Guardar persona';

  // Reset
  ['fp-nombre','fp-telefono','fp-correo','fp-notas','fp-direccion','fp-contrasena'].forEach(f => { const el=$id(f); if(el) el.value=''; });
  $id('fp-tipo-cliente').value = 'regular';
  $id('fp-tiene-acceso').checked = false;
  $id('fp-acceso-fields').style.display = 'none';
  $id('fp-acceso-section').style.display = 'none';
  if (allRoles.length === 0) await loadRolesConfig();
  renderPersonaRolesCheckboxes(['cliente']);
  await populatePersonaLocalSelect();

  if (id) {
    try {
      const p = await api('GET', '/personas/' + id);
      $id('fp-nombre').value      = p.nombre || '';
      $id('fp-telefono').value    = p.telefono || '';
      $id('fp-correo').value      = p.correo || '';
      $id('fp-direccion').value   = p.direccion || '';
      $id('fp-notas').value       = p.notas || '';
      $id('fp-tipo-cliente').value = p.tipo_cliente || 'regular';
      const rolesArr = (p.roles || 'cliente').split(',').map(r => r.trim()).filter(Boolean);
      renderPersonaRolesCheckboxes(rolesArr);
      // System access
      if (p.tipo) {
        $id('fp-acceso-section').style.display = '';
        $id('fp-tiene-acceso').checked = true;
        $id('fp-acceso-fields').style.display = '';
        $id('fp-tipo-acceso').value = p.tipo;
        if (p.local_id) $id('fp-local-id').value = p.local_id;
        $id('fp-pass-label').textContent = 'Nueva contraseña (dejar vacío para no cambiar)';
        $id('fp-contrasena').required = false;
      }
    } catch(e) { showToast('Error cargando persona', 'error'); return; }
  }
  $id('persona-modal').classList.add('open');
}

function renderPersonaRolesCheckboxes(selected) {
  const el = $id('fp-roles-checkboxes');
  if (!el) return;
  el.innerHTML = allRoles.map(r => `
    <label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);" onclick="onPersonaRolChange()">
      <input type="checkbox" value="${r.id}" ${selected.includes(r.id) ? 'checked' : ''}
        style="width:14px;height:14px;cursor:pointer;accent-color:${r.color};">
      <span style="width:8px;height:8px;border-radius:50%;background:${r.color};display:inline-block;"></span>
      ${escHtml(r.nombre)}
    </label>`).join('');
}

function getPersonaRolesChecked() {
  const el = $id('fp-roles-checkboxes');
  if (!el) return ['cliente'];
  return Array.from(el.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
}

function onPersonaRolChange() {
  // Show/hide acceso section based on whether 'empleado' role is selected
  setTimeout(() => {
    const roles = getPersonaRolesChecked();
    const hasEmpleado = roles.includes('empleado') || roles.includes('admin');
    $id('fp-acceso-section').style.display = hasEmpleado ? '' : 'none';
    if (!hasEmpleado) {
      $id('fp-tiene-acceso').checked = false;
      $id('fp-acceso-fields').style.display = 'none';
    }
  }, 10);
}

function onPersonaAccesoToggle() {
  $id('fp-acceso-fields').style.display = $id('fp-tiene-acceso').checked ? '' : 'none';
}

async function populatePersonaLocalSelect() {
  const sel = $id('fp-local-id');
  if (!sel) return;
  sel.innerHTML = '<option value="">Sin sucursal asignada</option>';
  try {
    const empId = currentUserData?.empresa_id;
    if (!empId) return;
    const locales = await api('GET', '/empresas/' + empId + '/locales');
    locales.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id; opt.textContent = l.nombre_local;
      sel.appendChild(opt);
    });
  } catch(e) {}
}

function closePersonaModal() {
  $id('persona-modal').classList.remove('open');
  editingPersonaId = null;
}

async function savePersona() {
  const nombre = $id('fp-nombre').value.trim();
  if (!nombre) { showToast('El nombre es requerido', 'error'); return; }
  const roles  = getPersonaRolesChecked();
  if (!roles.length) { showToast('Selecciona al menos un rol', 'error'); return; }

  const body = {
    nombre,
    correo:       $id('fp-correo').value.trim() || null,
    telefono:     $id('fp-telefono').value.trim() || null,
    direccion:    $id('fp-direccion').value.trim() || null,
    notas:        $id('fp-notas').value.trim() || null,
    tipo_cliente: $id('fp-tipo-cliente').value,
    roles,
  };

  const tieneAcceso = $id('fp-tiene-acceso').checked;
  const btn = $id('btn-save-persona');
  btnLoading(btn, true);
  try {
    if (editingPersonaId) {
      await api('PUT', '/personas/' + editingPersonaId, body);
      // Handle system access changes
      if (tieneAcceso) {
        const accesoBody = {
          tipo:       $id('fp-tipo-acceso').value,
          local_id:   $id('fp-local-id').value || null,
          contrasena: $id('fp-contrasena').value || undefined,
        };
        await api('PUT', '/personas/' + editingPersonaId + '/acceso', accesoBody);
      } else {
        // Check if they had access before and now toggle is off
        const existing = await api('GET', '/personas/' + editingPersonaId);
        if (existing.tipo && existing.tipo !== 'root') {
          if (confirm('¿Desactivar el acceso al sistema para esta persona?')) {
            await api('DELETE', '/personas/' + editingPersonaId + '/acceso');
          }
        }
      }
    } else {
      if (tieneAcceso) {
        body.tipo       = $id('fp-tipo-acceso').value;
        body.local_id   = $id('fp-local-id').value || null;
        body.contrasena = $id('fp-contrasena').value;
      }
      await api('POST', '/personas', body);
    }
    closePersonaModal();
    loadPersonas();
    showToast(editingPersonaId ? 'Persona actualizada' : 'Persona creada', 'success');
  } catch(e) { showToast(e.message, 'error'); }
  finally { btnLoading(btn, false); }
}

async function deletePersona(id) {
  if (!confirm('¿Eliminar esta persona?')) return;
  try {
    await api('DELETE', '/personas/' + id);
    loadPersonas();
    showToast('Persona eliminada', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

// Catálogo de módulos de permisos. Antes era hardcodeado; ahora se carga
// dinámicamente del backend (/api/permisos/catalogo) — así si se agregan
// nuevos módulos en initDB.ts, aparecen automáticamente en la UI.
MODULOS_PERMISOS = [];
PERSONA_MODULOS = [];

// Mapeo de iconos por module key (extensible). Si no está, usa default.
const MODULO_ICONS = {
  servicios:'fa-screwdriver-wrench', ventas:'fa-cash-register', cortes:'fa-money-bill-wave',
  clientes:'fa-user-tag', personas:'fa-address-book', productos:'fa-box',
  listas_precios:'fa-tags', empresas:'fa-building', locales:'fa-store',
  configuracion:'fa-gear', ticket_plantillas:'fa-receipt', conceptos_cobro:'fa-coins',
  notificaciones:'fa-bell', wa_config:'fa-comment-sms',
  reportes_ventas:'fa-chart-line', reportes_servicios:'fa-chart-column',
  reportes_cortes:'fa-cash-register', reportes_creditos:'fa-credit-card',
  auditoria:'fa-clipboard-list',
  ver_costos:'fa-coins', editar_costos:'fa-pen-to-square', ver_utilidad:'fa-chart-pie',
  aplicar_descuentos:'fa-percent', cancelar_venta:'fa-ban', cancelar_servicio:'fa-ban',
  cambiar_estado_servicio:'fa-shuffle', ajustar_inventario:'fa-boxes-stacked',
  finalizar_credito:'fa-circle-check', ver_pagos_servicio:'fa-money-check-dollar',
  exportar_xlsx:'fa-file-export', importar_xlsx:'fa-file-import',
  notificar_whatsapp:'fa-whatsapp', subir_logos:'fa-image',
};
const GRUPO_LABELS = {
  crud:          'Operaciones y catálogos',
  reportes:      'Reportes y auditoría',
  configuracion: 'Configuración',
  especiales:    'Acciones especiales',
};

_catalogoCache = null;
async function loadCatalogoPermisos(force = false) {
  if (_catalogoCache && !force) return _catalogoCache;
  const data = await api('GET', '/permisos/catalogo');
  // data.flat = [{ key, nombre, descripcion, grupo, acciones, scope_aplica, ... }]
  MODULOS_PERMISOS = (data.flat || []).map(m => ({
    id:        m.key,
    label:     m.nombre,
    descripcion: m.descripcion || '',
    icon:      MODULO_ICONS[m.key] || 'fa-shield-halved',
    grupo:     m.grupo,
    grupoLabel: GRUPO_LABELS[m.grupo] || m.grupo,
    acciones:  String(m.acciones || 'ver,crear,editar,borrar').split(',').map(s => s.trim()),
    scopeable: !!m.scope_aplica,
    orden:     m.orden,
  }));
  PERSONA_MODULOS = MODULOS_PERMISOS.map(m => m.id);
  _catalogoCache = data;
  return data;
}

async function openPersonaPermisos(id, nombre) {
  permisosPersonaId = id;
  $id('pp-nombre').textContent = nombre;
  const body = $id('pp-permisos-body');
  body.innerHTML = '<div style="text-align:center;padding:32px;"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:22px;color:var(--accent);"></i></div>';
  $id('persona-permisos-modal').classList.add('open');
  try {
    // Cargar catálogo del backend (cacheado entre aperturas)
    await loadCatalogoPermisos();
    const rows = await api('GET', '/personas/' + id + '/permisos');
    const map = {};
    rows.forEach(r => { map[r.modulo] = r; });
    renderPermisosTable(map);
  } catch(e) { body.innerHTML = '<div style="padding:20px;color:var(--danger);">Error cargando permisos</div>'; }
}

function renderPermisosTable(map) {
  const body = $id('pp-permisos-body');
  const ACCIONES = ['ver','crear','editar','borrar'];
  const ACCION_ICONS = { ver:'fa-eye', crear:'fa-plus', editar:'fa-pen', borrar:'fa-trash' };
  const ACCION_LABELS = { ver:'Ver', crear:'Crear', editar:'Editar', borrar:'Borrar' };
  const visibleMods = currentUserData?.tipo === 'root'
    ? MODULOS_PERMISOS
    : MODULOS_PERMISOS.filter(m => m.id !== 'empresas');
  // Conservar orden definido en el backend (campo orden), agrupado por grupo
  const grupos = [];
  visibleMods.forEach(m => { if (!grupos.includes(m.grupo)) grupos.push(m.grupo); });

  let html = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background:var(--bg2);position:sticky;top:0;z-index:2;border-bottom:2px solid var(--border);">
        <th style="text-align:left;padding:10px 12px;min-width:220px;">
          <span style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;">Módulo</span>
        </th>
        ${ACCIONES.map(a => `
        <th style="padding:8px 4px;text-align:center;min-width:70px;">
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
            <i class="fa-solid ${ACCION_ICONS[a]}" style="font-size:12px;color:var(--text2);"></i>
            <span style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;">${ACCION_LABELS[a]}</span>
            <input type="checkbox" class="pp-col-all" data-acc="${a}" title="Marcar / desmarcar todos"
              style="width:14px;height:14px;cursor:pointer;accent-color:var(--accent);"
              onchange="toggleColPermisos('${a}', this.checked)">
          </div>
        </th>`).join('')}
        <th style="padding:8px 8px;text-align:center;min-width:110px;">
          <span style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;">Alcance</span>
        </th>
      </tr>
    </thead>
    <tbody>`;

  grupos.forEach(grupo => {
    const mods = visibleMods.filter(m => m.grupo === grupo);
    const grupoLabel = mods[0]?.grupoLabel || grupo;
    html += `<tr>
      <td colspan="6" style="padding:8px 12px 4px;background:var(--bg3);font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;border-top:1px solid var(--border);">
        ${grupoLabel}
      </td>
    </tr>`;
    mods.forEach(mod => {
      const p = map[mod.id] || { ver:0, crear:0, editar:0, borrar:0, scope:'empresa' };
      // Solo las acciones declaradas por el módulo son interactivas; las demás aparecen "—"
      const accionesActivas = mod.acciones || ACCIONES;
      const anyChecked = accionesActivas.some(a => p[a]);
      const tooltip = mod.descripcion ? `title="${escHtml(mod.descripcion)}"` : '';
      html += `<tr class="pp-row" data-mod="${mod.id}" style="border-top:1px solid var(--border);${anyChecked ? 'background:rgba(99,102,241,0.04);' : ''}">
        <td style="padding:9px 12px;" ${tooltip}>
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" class="pp-row-all" data-mod="${mod.id}" ${anyChecked ? 'checked' : ''}
              style="width:14px;height:14px;cursor:pointer;accent-color:var(--accent);"
              onchange="toggleRowPermisos('${mod.id}', this.checked)" title="Activar / desactivar módulo">
            <i class="fa-solid ${mod.icon}" style="font-size:12px;color:var(--text2);width:14px;text-align:center;flex-shrink:0;"></i>
            <span style="font-weight:600;">${escHtml(mod.label)}</span>
          </div>
          ${mod.descripcion ? `<div style="font-size:11px;color:var(--text3);margin-left:36px;margin-top:2px;">${escHtml(mod.descripcion)}</div>` : ''}
        </td>
        ${ACCIONES.map(a => {
          const aplica = accionesActivas.includes(a);
          if (!aplica) {
            return `<td style="text-align:center;padding:9px 4px;color:var(--text3);font-size:14px;">—</td>`;
          }
          return `<td style="text-align:center;padding:9px 4px;">
            <input type="checkbox" class="pp-cb" data-mod="${mod.id}" data-acc="${a}" ${p[a] ? 'checked' : ''}
              style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent);"
              onchange="onPermisoCbChange('${mod.id}')">
          </td>`;
        }).join('')}
        <td style="text-align:center;padding:9px 8px;">
          ${mod.scopeable ? `<select class="f-select" style="font-size:11px;padding:3px 6px;min-width:96px;"
              data-mod="${mod.id}" data-type="scope">
              <option value="empresa" ${(p.scope||'empresa')==='empresa'?'selected':''}>Empresa</option>
              <option value="local"   ${p.scope==='local'?'selected':''}>Mi sucursal</option>
              <option value="propio"  ${p.scope==='propio'?'selected':''}>Mis registros</option>
            </select>` : `<span style="font-size:11px;color:var(--text3);">—</span>`}
        </td>
      </tr>`;
    });
  });

  html += `</tbody></table>`;
  body.innerHTML = html;
  ACCIONES.forEach(a => updateColAllCheckbox(a));
}

function onPermisoCbChange(modId) {
  const cbs = Array.from($id('pp-permisos-body').querySelectorAll(`.pp-cb[data-mod="${modId}"]`));
  const anyChecked = cbs.some(cb => cb.checked);
  const rowAll = $id('pp-permisos-body').querySelector(`.pp-row-all[data-mod="${modId}"]`);
  if (rowAll) rowAll.checked = anyChecked;
  // Update row background
  const row = $id('pp-permisos-body').querySelector(`.pp-row[data-mod="${modId}"]`);
  if (row) row.style.background = anyChecked ? 'rgba(99,102,241,0.04)' : '';
  ['ver','crear','editar','borrar'].forEach(a => updateColAllCheckbox(a));
}

function toggleRowPermisos(modId, checked) {
  $id('pp-permisos-body').querySelectorAll(`.pp-cb[data-mod="${modId}"]`).forEach(cb => { cb.checked = checked; });
  const row = $id('pp-permisos-body').querySelector(`.pp-row[data-mod="${modId}"]`);
  if (row) row.style.background = checked ? 'rgba(99,102,241,0.04)' : '';
  ['ver','crear','editar','borrar'].forEach(a => updateColAllCheckbox(a));
}

function toggleColPermisos(accion, checked) {
  $id('pp-permisos-body').querySelectorAll(`.pp-cb[data-acc="${accion}"]`).forEach(cb => { cb.checked = checked; });
  MODULOS_PERMISOS.forEach(mod => {
    const cbs = Array.from($id('pp-permisos-body').querySelectorAll(`.pp-cb[data-mod="${mod.id}"]`));
    const anyChecked = cbs.some(cb => cb.checked);
    const rowAll = $id('pp-permisos-body').querySelector(`.pp-row-all[data-mod="${mod.id}"]`);
    if (rowAll) rowAll.checked = anyChecked;
    const row = $id('pp-permisos-body').querySelector(`.pp-row[data-mod="${mod.id}"]`);
    if (row) row.style.background = anyChecked ? 'rgba(99,102,241,0.04)' : '';
  });
}

function updateColAllCheckbox(accion) {
  const allCbs = Array.from($id('pp-permisos-body').querySelectorAll(`.pp-cb[data-acc="${accion}"]`));
  const colAll = $id('pp-permisos-body').querySelector(`.pp-col-all[data-acc="${accion}"]`);
  if (!colAll || allCbs.length === 0) return;
  const checkedCount = allCbs.filter(cb => cb.checked).length;
  colAll.checked = checkedCount === allCbs.length;
  colAll.indeterminate = checkedCount > 0 && checkedCount < allCbs.length;
}

function applyPresetPermisos(preset) {
  const body = $id('pp-permisos-body');
  if (!body) return;
  const ACCIONES = ['ver','crear','editar','borrar'];
  const opMods = ['servicios','ventas','cortes','personas','productos'];
  MODULOS_PERMISOS.forEach(mod => {
    let accs = [];
    if (preset === 'completo')      accs = ACCIONES;
    else if (preset === 'readonly') accs = ['ver'];
    else if (preset === 'operador') accs = opMods.includes(mod.id) ? ['ver','crear','editar'] : ['ver'];
    // preset === 'none' → accs stays []
    ACCIONES.forEach(a => {
      const cb = body.querySelector(`.pp-cb[data-mod="${mod.id}"][data-acc="${a}"]`);
      if (cb) cb.checked = accs.includes(a);
    });
    const rowAll = body.querySelector(`.pp-row-all[data-mod="${mod.id}"]`);
    if (rowAll) rowAll.checked = accs.length > 0;
    const row = body.querySelector(`.pp-row[data-mod="${mod.id}"]`);
    if (row) row.style.background = accs.length > 0 ? 'rgba(99,102,241,0.04)' : '';
  });
  ACCIONES.forEach(a => updateColAllCheckbox(a));
}

async function savePersonaPermisos() {
  const body = $id('pp-permisos-body');
  const btn = $id('btn-save-permisos');
  btnLoading(btn, true);
  const modsToSave = currentUserData?.tipo === 'root' ? MODULOS_PERMISOS : MODULOS_PERMISOS.filter(m => m.id !== 'empresas');
  const permisos = modsToSave.map(mod => {
    const row = { modulo: mod.id, ver:0, crear:0, editar:0, borrar:0, scope:'empresa' };
    ['ver','crear','editar','borrar'].forEach(a => {
      const cb = body.querySelector(`.pp-cb[data-mod="${mod.id}"][data-acc="${a}"]`);
      if (cb) row[a] = cb.checked ? 1 : 0;
    });
    const scopeEl = body.querySelector(`select[data-mod="${mod.id}"][data-type="scope"]`);
    if (scopeEl) row.scope = scopeEl.value;
    return row;
  });
  try {
    await api('PUT', '/personas/' + permisosPersonaId + '/permisos', { permisos });
    $id('persona-permisos-modal').classList.remove('open');
    showToast('Permisos guardados', 'success');
  } catch(e) { showToast(e.message, 'error'); }
  finally { btnLoading(btn, false); }
}

// ===== INIT =====
const today = new Date().toISOString().split('T')[0];
const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
$id('rep-start').value = firstDay;
$id('rep-end').value = today;

// Auto-login if token exists (must be at end of script so all let/const vars are initialized)
if (token && currentUserData) {
  $id('login-screen').style.display = 'none';
  $id('app').style.display = 'flex';
  // Activate dashboard immediately so skeletons are visible while configs load
  const _autoTipo = currentUserData.tipo;
  $id('dash-greeting').style.display    = _autoTipo === 'empleado' ? '' : 'none';
  $id('dash-admin-header').style.display = _autoTipo === 'empleado' ? 'none' : 'flex';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $id('page-dashboard').classList.add('active');
  dashShowSkeletons();
  // Load config data first, then apply permisos + navigate to last page.
  // Pre-cargar empresas si es root para evitar demora en filtros.
  Promise.all([
    loadEstadosConfig(), loadRolesConfig(), loadTiposProductos(), loadNivelesPrecios(),
    (currentUserData?.tipo === 'root' && allEmpresas.length === 0)
      ? api('GET', '/empresas?limit=1000').then(r => { allEmpresas = r.data || []; }).catch(() => {})
      : Promise.resolve(),
  ])
    .catch(() => {})
    .finally(() => {
      try { applyPermisos(); } catch(e) { console.warn('[auto-login] init error:', e); try { goTo('dashboard'); } catch(e2) {} }
      updateProfileUI();
      startAutoCorteWatcher();
      startNotifWatcher();
    });
}

// ===== CONCEPTOS DE COBRO =====

async function loadPOSConceptos() {
  try {
    const data = await api('GET', '/configuracion/conceptos-cobro');
    posConceptosCobro = Array.isArray(data) ? data : [];
  } catch(e) {
    posConceptosCobro = [];
  }
}

async function loadConceptosCobro() {
  const list = $id('conceptos-cobro-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  try {
    const data = await api('GET', '/configuracion/conceptos-cobro');
    posConceptosCobro = data; // keep POS in sync
    if (!data.length) {
      list.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:12px;">Sin conceptos configurados</div>';
      return;
    }
    list.innerHTML = data.map(c => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);" id="cc-row-${c.id}">
        <div style="flex:2;min-width:0;">
          <input class="f-input" style="margin:0;" value="${escHtml(c.nombre)}" id="cc-nombre-${c.id}" placeholder="Nombre">
        </div>
        <div style="flex:1;min-width:80px;">
          <select class="f-select" style="margin:0;" id="cc-tipo-${c.id}" onchange="toggleConceptoValor(${c.id})">
            <option value="fijo" ${c.tipo==='fijo'?'selected':''}>Fijo ($)</option>
            <option value="liquidacion" ${c.tipo==='liquidacion'?'selected':''}>Liquidación</option>
          </select>
        </div>
        <div style="flex:1;min-width:80px;" id="cc-valor-wrap-${c.id}" ${c.tipo==='liquidacion'?'style="visibility:hidden;"':''}>
          <input class="f-input" type="number" style="margin:0;" value="${c.valor||0}" id="cc-valor-${c.id}" min="0" step="0.01" placeholder="0.00">
        </div>
        <button class="btn-outline" style="height:36px;padding:0 12px;" onclick="saveConceptoCobro(${c.id})">
          <i class="fa-solid fa-floppy-disk"></i>
        </button>
        <button class="act-btn del" style="flex-shrink:0;" onclick="deleteConceptoCobro(${c.id})" title="Eliminar">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>`).join('');
  } catch(e) {
    const msg = (e.message || '').includes("'<'")
      ? 'Reinicia el servidor para activar esta función (npm run dev)'
      : e.message;
    list.innerHTML = `<div style="color:var(--danger);font-size:13px;padding:12px;background:rgba(255,71,87,.06);border-radius:var(--radius-sm);border:1px solid rgba(255,71,87,.2);">
      <i class="fa-solid fa-circle-exclamation" style="margin-right:6px;"></i>${msg}
    </div>`;
  }
}

function toggleConceptoValor(id) {
  const tipo = $id('cc-tipo-' + id)?.value;
  const wrap = $id('cc-valor-wrap-' + id);
  if (wrap) wrap.style.visibility = tipo === 'liquidacion' ? 'hidden' : '';
}

function toggleNuevoConceptoValor() {
  const tipo = $id('nuevo-concepto-tipo')?.value;
  const grp  = $id('nuevo-concepto-valor-group');
  if (grp) grp.style.visibility = tipo === 'liquidacion' ? 'hidden' : '';
}

async function saveConceptoCobro(id) {
  const nombre = $id('cc-nombre-' + id)?.value.trim();
  const tipo   = $id('cc-tipo-'   + id)?.value;
  const valor  = $id('cc-valor-'  + id)?.value;
  if (!nombre) { showToast('El nombre es requerido', 'error'); return; }
  try {
    await api('PUT', '/configuracion/conceptos-cobro/' + id, { nombre, tipo, valor: Number(valor)||0 });
    showToast('Concepto guardado', 'success');
    loadConceptosCobro();
  } catch(e) { showToast(e.message, 'error'); }
}

async function addConceptoCobro() {
  const nombre = $id('nuevo-concepto-nombre')?.value.trim();
  const tipo   = $id('nuevo-concepto-tipo')?.value;
  const valor  = $id('nuevo-concepto-valor')?.value;
  if (!nombre) { showToast('Escribe un nombre para el concepto', 'error'); return; }
  try {
    await api('POST', '/configuracion/conceptos-cobro', { nombre, tipo, valor: Number(valor)||0 });
    $id('nuevo-concepto-nombre').value = '';
    $id('nuevo-concepto-valor').value  = '0';
    showToast('Concepto agregado', 'success');
    loadConceptosCobro();
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteConceptoCobro(id) {
  if (!confirm('¿Eliminar este concepto?')) return;
  try {
    await api('DELETE', '/configuracion/conceptos-cobro/' + id);
    showToast('Concepto eliminado', 'success');
    loadConceptosCobro();
  } catch(e) { showToast(e.message, 'error'); }
}

/* ═════════════════════════════════════════════════════════════════
   GLOBAL SEARCH (Command Palette)
   ─────────────────────────────────────────────────────────────────
   Modal con búsqueda en servicios, productos, personas, páginas y
   acciones rápidas. Atajo Ctrl+K. Scoring fuzzy + historial reciente
   en localStorage.
   ═════════════════════════════════════════════════════════════════ */

// ── Estado ────────────────────────────────────────────────────────
_gsState = { open: false, results: [], selectedIdx: 0, debounceId: null, lastQ: '' };
const GS_HISTORY_KEY = 'ts_search_history';
const GS_HISTORY_MAX = 8;

// ── Catálogo de páginas y acciones rápidas ────────────────────────
// Cada item: { type, label, hint, icon, page?, action?, perm? (función)}
function gsCatalogoPaginasYAcciones() {
  const tipo = currentUserData?.tipo;
  const isAdmin = tipo === 'root' || tipo === 'admin';
  const isRoot = tipo === 'root';

  // Visibilidad EXACTAMENTE alineada con el sidebar (líneas 7644-7660 de este archivo).
  // Si el sidebar no muestra el item, el palette tampoco — para no exponer atajos
  // a páginas a las que el usuario no tendría acceso real.
  const paginas = [
    { type:'pagina', label:'Dashboard',           icon:'fa-house',          page:'dashboard',     shortcut:'D',
      show: true },
    { type:'pagina', label:'Servicios',           icon:'fa-screwdriver-wrench', page:'services',  shortcut:'S',
      show: isAdmin || hasAnyPermiso('servicios') },
    { type:'pagina', label:'Punto de venta (POS)',icon:'fa-cash-register',  page:'pos',           shortcut:'V',
      show: isAdmin || hasPermiso('ventas','crear') || hasAnyPermiso('cortes') },
    { type:'pagina', label:'Productos',           icon:'fa-box',            page:'productos',     shortcut:'P',
      show: isAdmin || hasAnyPermiso('productos') },
    { type:'pagina', label:'Personas',            icon:'fa-address-book',   page:'personas',      shortcut:'C',
      show: isAdmin || hasAnyPermiso('personas') || hasAnyPermiso('clientes') },
    { type:'pagina', label:'Listas de precios',   icon:'fa-tags',           page:'listas-precios',shortcut:'I',
      show: isAdmin },
    { type:'pagina', label:'Reportes',            icon:'fa-chart-bar',      page:'reportes',      shortcut:'R',
      show: isAdmin || hasAnyPermiso('reportes') || hasAnyPermiso('auditoria') },
    { type:'pagina', label:'Empresas',            icon:'fa-building',       page:'empresas',      shortcut:'E',
      show: isRoot },
    { type:'pagina', label:'Locales / Sucursales',icon:'fa-store',          page:'locales',       shortcut:'L',
      show: isAdmin || hasAnyPermiso('locales') },
    { type:'pagina', label:'Configuración',       icon:'fa-gear',           page:'configuracion', shortcut:'A',
      show: isAdmin },
    { type:'pagina', label:'Sandbox',             icon:'fa-flask',          page:'sandbox',       shortcut:'B',
      show: isRoot },
    { type:'pagina', label:'Mi perfil',           icon:'fa-user',           page:'profile',       shortcut:'M',
      show: true },
  ].filter(p => p.show);

  // Acciones rápidas: respetan permisos puntuales también.
  const acciones = [
    { type:'accion', label:'Crear nuevo servicio',   icon:'fa-plus',  hint:'Abrir formulario',
      show: isAdmin || hasPermiso('servicios','crear'), action: () => { goTo('services',null); setTimeout(()=>openModal(),120); } },
    { type:'accion', label:'Abrir POS',              icon:'fa-cash-register', hint:'Terminal de venta',
      show: isAdmin || hasPermiso('ventas','crear') || hasAnyPermiso('cortes'), action: () => goTo('pos',null) },
    { type:'accion', label:'Cambiar contraseña',     icon:'fa-lock',  hint:'En tu perfil',
      show: true, action: () => { goTo('profile',null); setTimeout(()=>$id('prof-pass-actual')?.focus(),200); } },
    { type:'accion', label:'Cambiar tema oscuro',    icon:'fa-moon',  hint:'Apariencia',
      show: true, action: () => setTheme('dark') },
    { type:'accion', label:'Cambiar tema claro',     icon:'fa-sun',   hint:'Apariencia',
      show: true, action: () => setTheme('light') },
    { type:'accion', label:'Cambiar idioma a Español', icon:'fa-language', hint:'Apariencia',
      show: true, action: () => setLanguage('es') },
    { type:'accion', label:'Cambiar idioma a English', icon:'fa-language', hint:'Apariencia',
      show: true, action: () => setLanguage('en') },
    { type:'accion', label:'Cerrar sesión',          icon:'fa-right-from-bracket', hint:'',
      show: true, action: () => logout() },
  ].filter(a => a.show);

  return [...paginas, ...acciones];
}

// ── Scoring fuzzy ─────────────────────────────────────────────────
// Devuelve un score >= 0 (0 = no match). Mayor = más relevante.
function gsFuzzyScore(query, text) {
  if (!text) return 0;
  const q = String(query).toLowerCase().trim();
  const t = String(text).toLowerCase();
  if (!q) return 1; // sin query, devuelve algo positivo (orden por defecto)
  if (t === q) return 10000;
  if (t.startsWith(q)) return 5000 - (t.length - q.length);
  const idx = t.indexOf(q);
  if (idx >= 0) return 2000 - idx * 5;
  // fuzzy: todos los chars del query aparecen en orden en text
  let qi = 0, ti = 0, score = 0, lastMatch = -2;
  while (qi < q.length && ti < t.length) {
    if (q[qi] === t[ti]) {
      score += (ti === lastMatch + 1) ? 8 : 2;
      lastMatch = ti;
      qi++;
    }
    ti++;
  }
  return qi === q.length ? Math.max(1, score) : 0;
}

function gsBestScore(query, fields) {
  let best = 0;
  for (const f of fields) {
    const s = gsFuzzyScore(query, f);
    if (s > best) best = s;
  }
  return best;
}

// ── Historial ──────────────────────────────────────────────────────
function gsLoadHistory() {
  try { return JSON.parse(localStorage.getItem(GS_HISTORY_KEY) || '[]'); } catch { return []; }
}
function gsSaveHistory(item) {
  // item: { type, label, icon, page?, action_id?, ref? }
  try {
    const h = gsLoadHistory().filter(x => !(x.type === item.type && x.label === item.label));
    h.unshift({ ...item, ts: Date.now() });
    localStorage.setItem(GS_HISTORY_KEY, JSON.stringify(h.slice(0, GS_HISTORY_MAX)));
  } catch {}
}

// ── Apertura / cierre del modal ───────────────────────────────────
function openGlobalSearch() {
  if (_gsState.open) return;
  _gsState.open = true;
  _gsState.selectedIdx = 0;
  const ov = $id('gs-overlay');
  ov.style.display = 'flex';
  const inp = $id('gs-input');
  inp.value = '';
  inp.focus();
  gsRender(''); // muestra historial o sugerencias
}

function closeGlobalSearch() {
  _gsState.open = false;
  $id('gs-overlay').style.display = 'none';
  if (_gsState.debounceId) { clearTimeout(_gsState.debounceId); _gsState.debounceId = null; }
}

// ── Render principal ──────────────────────────────────────────────
async function gsRender(q) {
  const cont = $id('gs-results');
  q = (q || '').trim();
  _gsState.lastQ = q;

  // Caso sin query: mostrar historial + sugerencias top
  if (q.length < 1) {
    const hist = gsLoadHistory();
    const sugerencias = gsCatalogoPaginasYAcciones().slice(0, 6);
    let html = '';
    if (hist.length) {
      html += gsRenderGroup('Reciente', hist.map((h, i) => ({ ...h, _hidx: i })), 'fa-clock-rotate-left');
    }
    html += gsRenderGroup('Sugerencias', sugerencias, 'fa-bolt');
    cont.innerHTML = html || `<div style="padding:40px;text-align:center;color:var(--text3);font-size:13px;">Empieza a escribir para buscar…</div>`;
    _gsState.results = [...(hist || []), ...sugerencias];
    gsHighlightSelected();
    gsAttachClickHandlers();
    return;
  }

  if (q.length < 2) {
    cont.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text3);font-size:13px;">Escribe al menos 2 caracteres…</div>`;
    return;
  }

  // Buscar páginas y acciones (frontend, instantáneo)
  const catalogo = gsCatalogoPaginasYAcciones();
  const paginas = catalogo
    .filter(c => c.type === 'pagina')
    .map(p => ({ ...p, _score: gsBestScore(q, [p.label]) }))
    .filter(p => p._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);
  const acciones = catalogo
    .filter(c => c.type === 'accion')
    .map(a => ({ ...a, _score: gsBestScore(q, [a.label, a.hint || '']) }))
    .filter(a => a._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);

  // Llamar al backend (servicios, productos, personas)
  cont.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text3);font-size:13px;"><i class="fa-solid fa-spinner fa-spin"></i> Buscando…</div>`;
  let backend = { servicios: [], productos: [], personas: [] };
  try {
    backend = await api('GET', '/search?q=' + encodeURIComponent(q));
  } catch (e) { /* silent */ }
  // Si la query cambió mientras esperábamos, abortar
  if (_gsState.lastQ !== q) return;

  const servicios = (backend.servicios || []).map(s => ({
    type:'servicio', label: (s.folio || '#'+s.id) + ' — ' + (s.cliente_nombre || 'Sin cliente'),
    hint: [s.modelo, s.falla].filter(Boolean).join(' · '),
    icon:'fa-screwdriver-wrench', ref: s, _score: gsBestScore(q, [s.folio, s.cliente_nombre, s.modelo, s.falla, s.cliente_telefono]),
    action: () => { closeGlobalSearch(); goTo('services',null); setTimeout(()=>viewDetail(s.id), 150); }
  })).sort((a,b) => b._score - a._score).slice(0, 5);

  const productos = (backend.productos || []).map(p => ({
    type:'producto', label: p.nombre,
    hint: [p.codigo || p.sku || p.folio, '$'+(p.venta||0), 'stock '+(p.existencia||0)].filter(Boolean).join(' · '),
    icon:'fa-box', ref: p, _score: gsBestScore(q, [p.nombre, p.codigo, p.sku, p.folio]),
    action: () => { closeGlobalSearch(); goTo('productos',null); setTimeout(()=>openProductoModal(p.id), 150); }
  })).sort((a,b) => b._score - a._score).slice(0, 5);

  const personas = (backend.personas || []).map(p => ({
    type:'persona', label: p.nombre,
    hint: [p.tipo, p.correo, p.telefono, p.nombre_local].filter(Boolean).join(' · '),
    icon: p.tipo ? 'fa-user-tie' : 'fa-user', ref: p, _score: gsBestScore(q, [p.nombre, p.correo, p.telefono]),
    action: () => { closeGlobalSearch(); goTo('personas',null); setTimeout(()=>openPersonaModal(p.id), 150); }
  })).sort((a,b) => b._score - a._score).slice(0, 5);

  // Render agrupado
  let html = '';
  if (servicios.length) html += gsRenderGroup('Servicios',  servicios,  'fa-screwdriver-wrench');
  if (productos.length) html += gsRenderGroup('Productos',  productos,  'fa-box');
  if (personas.length)  html += gsRenderGroup('Personas',   personas,   'fa-address-book');
  if (paginas.length)   html += gsRenderGroup('Páginas',    paginas,    'fa-window-maximize');
  if (acciones.length)  html += gsRenderGroup('Acciones',   acciones,   'fa-bolt');

  if (!html) {
    html = `<div style="padding:40px;text-align:center;color:var(--text3);font-size:13px;">
      <i class="fa-solid fa-magnifying-glass" style="font-size:24px;opacity:0.4;display:block;margin-bottom:8px;"></i>
      Sin resultados para "<b>${escHtml(q)}</b>"
    </div>`;
    _gsState.results = [];
  } else {
    _gsState.results = [...servicios, ...productos, ...personas, ...paginas, ...acciones];
  }
  cont.innerHTML = html;
  _gsState.selectedIdx = 0;
  gsHighlightSelected();
  gsAttachClickHandlers();
}

function gsRenderGroup(title, items, headerIcon) {
  const rows = items.map((it, _) => {
    const hint = it.hint ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;">${escHtml(it.hint)}</div>` : '';
    // Si tiene shortcut Y el input está vacío (mostramos sugerencias o historial), mostramos el atajo
    const showShortcut = it.shortcut && (!_gsState.lastQ || _gsState.lastQ.length === 0);
    const shortcutBadge = showShortcut
      ? `<kbd style="background:var(--bg3);border:1px solid var(--border);padding:2px 7px;border-radius:5px;font-family:monospace;font-size:11px;color:var(--text2);font-weight:700;flex-shrink:0;">${it.shortcut}</kbd>`
      : '';
    return `<div class="gs-row" data-idx="" style="display:flex;align-items:center;gap:11px;padding:9px 16px;cursor:pointer;border-radius:6px;margin:0 8px;">
      <div style="width:30px;height:30px;border-radius:7px;background:var(--bg3);display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:13px;flex-shrink:0;">
        <i class="fa-solid ${it.icon || 'fa-circle'}"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(it.label)}</div>
        ${hint}
      </div>
      ${shortcutBadge}
      <i class="fa-solid fa-arrow-turn-down fa-rotate-90" style="font-size:10px;color:var(--text3);opacity:0;" data-arrow></i>
    </div>`;
  }).join('');
  return `<div style="padding:8px 0;">
    <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;padding:4px 18px 6px;display:flex;align-items:center;gap:6px;">
      <i class="fa-solid ${headerIcon}" style="font-size:9px;"></i> ${title}
    </div>
    ${rows}
  </div>`;
}

// Devuelve el item del catálogo cuyo shortcut coincide con la letra
function gsFindByShortcut(letter) {
  if (!letter) return null;
  const L = letter.toUpperCase();
  return gsCatalogoPaginasYAcciones().find(it => it.shortcut === L) || null;
}

function gsAttachClickHandlers() {
  const rows = $id('gs-results').querySelectorAll('.gs-row');
  rows.forEach((row, i) => {
    row.setAttribute('data-idx', String(i));
    row.onclick = () => { _gsState.selectedIdx = i; gsExecuteSelected(); };
    row.onmouseenter = () => { _gsState.selectedIdx = i; gsHighlightSelected(); };
  });
}

function gsHighlightSelected() {
  const rows = $id('gs-results').querySelectorAll('.gs-row');
  rows.forEach((row, i) => {
    if (i === _gsState.selectedIdx) {
      row.style.background = 'rgba(240,165,0,0.12)';
      row.querySelector('[data-arrow]').style.opacity = '1';
      row.scrollIntoView({ block: 'nearest' });
    } else {
      row.style.background = '';
      const arrow = row.querySelector('[data-arrow]');
      if (arrow) arrow.style.opacity = '0';
    }
  });
}

function gsExecuteSelected() {
  const item = _gsState.results[_gsState.selectedIdx];
  if (!item) return;
  // Guardar en historial (no guardamos resultados de búsqueda en sí, sí guardamos lo clickeado)
  gsSaveHistory({
    type: item.type, label: item.label, hint: item.hint || '', icon: item.icon,
    page: item.page, ref: item.ref, _restore: true,
  });
  // Ejecutar acción
  if (item.page) {
    closeGlobalSearch();
    goTo(item.page, null);
  } else if (item.action) {
    closeGlobalSearch();
    item.action();
  } else if (item.type === 'servicio' && item.ref) {
    closeGlobalSearch();
    goTo('services', null);
    setTimeout(() => viewDetail(item.ref.id), 150);
  } else if (item.type === 'producto' && item.ref) {
    closeGlobalSearch();
    goTo('productos', null);
    setTimeout(() => openProductoModal(item.ref.id), 150);
  } else if (item.type === 'persona' && item.ref) {
    closeGlobalSearch();
    goTo('personas', null);
    setTimeout(() => openPersonaModal(item.ref.id), 150);
  } else {
    closeGlobalSearch();
  }
}

// ── Listeners (input + teclado) ───────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Ctrl+K / Cmd+K abre la búsqueda
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openGlobalSearch();
    return;
  }
  if (!_gsState.open) return;
  if (e.key === 'Escape') { e.preventDefault(); closeGlobalSearch(); }
  else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (_gsState.results.length) {
      _gsState.selectedIdx = (_gsState.selectedIdx + 1) % _gsState.results.length;
      gsHighlightSelected();
    }
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (_gsState.results.length) {
      _gsState.selectedIdx = (_gsState.selectedIdx - 1 + _gsState.results.length) % _gsState.results.length;
      gsHighlightSelected();
    }
  }
  else if (e.key === 'Enter') { e.preventDefault(); gsExecuteSelected(); }
  else {
    // Atajos por letra: solo cuando el input está VACÍO (no se está escribiendo).
    // Si el usuario empezó a escribir, las letras se interpretan como texto normal.
    const inp = $id('gs-input');
    const inputVacio = !inp || !inp.value || inp.value.length === 0;
    const sinModif = !e.ctrlKey && !e.metaKey && !e.altKey;
    const esLetra = /^[a-zA-Z]$/.test(e.key);
    if (inputVacio && sinModif && esLetra) {
      const item = gsFindByShortcut(e.key);
      if (item) {
        e.preventDefault();
        // Ejecutar igual que si lo hubieran clickeado
        gsSaveHistory({
          type: item.type, label: item.label, hint: item.hint || '', icon: item.icon,
          page: item.page, shortcut: item.shortcut,
        });
        closeGlobalSearch();
        if (item.page) goTo(item.page, null);
        else if (item.action) item.action();
      }
    }
  }
});

// Input con debounce
document.addEventListener('DOMContentLoaded', () => {
  const inp = $id('gs-input');
  if (!inp) return;
  inp.addEventListener('input', (e) => {
    const q = e.target.value;
    if (_gsState.debounceId) clearTimeout(_gsState.debounceId);
    _gsState.debounceId = setTimeout(() => gsRender(q), 250);
  });
});
