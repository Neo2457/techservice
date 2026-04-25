# TechService Pro — Contexto del Proyecto

## Descripción
CRM + POS para talleres de reparación de equipos. SPA (Single Page Application) con backend Node.js/Express y base de datos SQLite en memoria (sql.js/WASM).

## Stack Técnico
- **Backend**: Node.js + Express + TypeScript
- **Base de datos**: SQLite via `sql.js` (WASM) — se persiste como archivo binario
- **Frontend**: HTML/CSS/JS vanilla — un único archivo `public/index.html` (~15000+ líneas)
- **Auth**: JWT con middleware `authMiddleware`, `adminOnly`, `rootOnly`
- **Dev**: `npm run dev` → `ts-node --transpile-only src/index.ts`
- **Puerto**: 3000 por defecto

## Estructura del Proyecto
```
src/
  index.ts                        — servidor Express + static files
  config/
    db.ts                         — getDB(), run(), get(), all(), persistDB()
    initDB.ts                     — migraciones de esquema (ALTER TABLE con try/catch)
  controllers/
    authController.ts
    clientesController.ts
    configuracionController.ts    — incluye conceptos_cobro y etiquetas
    cortesController.ts           — incluye getCorteDetalle
    empresasController.ts
    importController.ts
    listasController.ts
    localesController.ts
    logsController.ts
    notificacionesController.ts
    personasController.ts
    productosController.ts
    sandboxController.ts
    serviciosController.ts        — incluye cobrarServicio, getPagosServicioReporte
    ticketPlantillasController.ts
    usuariosController.ts
    ventasController.ts
  middleware/
    auth.ts                       — authMiddleware, adminOnly, rootOnly
    permisos.ts                   — checkPermiso(modulo, accion)
  routes/
    index.ts                      — todas las rutas bajo /api
  utils/
    autoCorte.ts
    folio.ts
    logger.ts                     — registrarLog()
public/
  index.html                      — SPA completo (toda la UI + lógica JS)
  js/
    qrcode.min.js                 — generación de QR codes
    html5-qrcode.min.js           — escaneo de QR con cámara
  uploads/logos/                  — logos subidos
```

## Roles de Usuario
- **root**: Acceso total, ve todas las empresas, gestiona sandboxes
- **admin**: Gestiona su empresa, locales, usuarios, configuración
- **empleado**: Acceso limitado por permisos granulares (`userPermisos[modulo][accion]`)

---

## Módulos Implementados

### Backend — Rutas en `/api`

| Módulo | Rutas |
|--------|-------|
| Auth | POST /auth/login, GET/PUT /auth/profile, PUT /auth/change-password, PUT /auth/switch-local |
| Servicios | GET /servicios, POST /servicios, GET/PUT/DELETE /servicios/:id |
| Servicios pagos | GET /servicios/:id/pagos, POST /servicios/:id/cobrar, GET /servicios/pagos |
| Clientes | CRUD /clientes |
| Productos | GET /productos, POST /productos, GET/PUT/DELETE /productos/:id |
| Ventas | POST /ventas, GET /ventas, GET /ventas/:id, POST /ventas/:id/finalizar |
| Cortes | POST /cortes/abrir, GET /cortes/activo, POST /cortes/:id/cerrar, GET /cortes, GET /cortes/:id/detalle |
| Empresas | CRUD (crear/borrar solo root) |
| Locales | CRUD |
| Usuarios | CRUD + permisos |
| Configuración | GET/PUT /configuracion + upload logo + tickets |
| Conceptos de cobro | GET/POST/PUT/DELETE /configuracion/conceptos-cobro |
| Ticket Plantillas | CRUD /ticket-plantillas |
| Listas de Precios | CRUD + asignación a clientes |
| Logs (auditoría) | GET /logs (admin/root only) |
| Sandbox | CRUD (root only) |

### Frontend — Páginas del SPA

| ID de página | Descripción |
|-------------|-------------|
| `page-dashboard` | Dashboard con estadísticas y ventas recientes |
| `page-services` | Gestión de servicios (CRUD, estados, tickets) |
| `page-reportes` | Reportes con 4 tabs: Ventas / Servicios / Cortes / Créditos |
| `page-pos` | Terminal de venta (POS) — productos y servicios |
| `page-productos` | Gestión de productos/inventario + impresión de etiquetas |
| `page-clientes` | Gestión de clientes |
| `page-listas-precios` | Listas de precios especiales |
| `page-usuarios` | Gestión de usuarios y permisos |
| `page-empresas` | Gestión de empresas (root) |
| `page-locales` | Gestión de locales/sucursales |
| `page-configuracion` | Configuración accordion (13 secciones) |
| `page-sandbox` | Modo sandbox para pruebas (root) |
| `page-profile` | Perfil del usuario |

---

## POS — Terminal de Venta

### Carrito (`posCart`)
Array de items con dos tipos:

**Tipo `producto`:**
```javascript
{ type:'producto', rowId, productoId, codigo, nombre,
  precioOriginal, precioUnitario, cantidad, subtotal }
```

**Tipo `servicio`:**
```javascript
{ type:'servicio', rowId, servicioId, folio, clienteNombre, modelo, falla,
  cobradoAnterior,   // srv.anticipo al momento de agregar
  saldo,             // costo_total - cobradoAnterior
  montoCobrar,       // monto que se cobra al cliente (auto-llenado por concepto)
  costoRefaccion,    // costo interno de piezas — NO se suma al total del cliente
  concepto,          // concepto seleccionado (de conceptos_cobro)
  descripcion }
```

### Regla crítica: `costoRefaccion`
- Es un costo **interno** para calcular utilidad: `utilidad = costo_total - costo_refaccion`
- **NUNCA** se suma al total cobrado al cliente
- Se guarda en `servicios.costo_refaccion` via el endpoint `/servicios/:id/cobrar` (campo opcional)
- No genera registro en `pagos_servicio`

### Flujo de cobro unificado
1. `posCobrar()` → `cobrarUnificado()` → valida monto > 0 por servicio
2. Si hay servicios → `showPosConfirmarModal()` → confirmación visual
3. `confirmarCobro()`:
   - Productos: `POST /ventas`
   - Servicios: `POST /servicios/:id/cobrar` (con `costo_refaccion` opcional)
4. Reset carrito

### Conceptos de cobro
- Configurables en Configuración → "Conceptos de cobro"
- Tabla `conceptos_cobro(id, empresa_id, nombre, tipo, valor, orden)`
- `tipo = 'fijo'` → auto-llena `montoCobrar = valor`
- `tipo = 'liquidacion'` → auto-llena `montoCobrar = saldo` (restante del servicio)
- Se cargan al iniciar POS en variable `posConceptosCobro[]`
- El primer concepto configurado es el default al agregar un servicio

### Cálculo de saldo al agregar servicio
```javascript
const cobradoAnterior = srv.anticipo || 0;  // usa campo sincronizado, no suma pagos
const saldo = Math.max(0, srv.costo_total - cobradoAnterior);
```

### Pago dividido (split)
- `toggleSplitPago()` activa modo split
- `posPagos[]` array con `{metodo, monto}`
- `updateSplitPendiente()` valida que suma de pagos = total
- Total = `prodTotal (subtotales) + srvTotal (solo montoCobrar)`

---

## Servicios — Flujo de Cobros

### Tabla `pagos_servicio`
```sql
id, servicio_id, monto, metodo, concepto, descripcion,
usuario_id, local_id, empresa_id, fecha,
fuera_caja INTEGER DEFAULT 0   -- 1 si se registró sin corte abierto
```

### Al crear un servicio con anticipo
- Si `anticipo > 0` en el formulario → se crea automáticamente un registro en `pagos_servicio`
- Si hay corte abierto → `fuera_caja = 0` (incluido en el corte)
- Si no hay corte → `fuera_caja = 1` (badge "Fuera de caja" en reportes)
- El campo `servicios.anticipo` se sincroniza con `SUM(pagos_servicio)` tras cada cobro

### Endpoint `POST /servicios/:id/cobrar`
```typescript
{ monto, metodo, concepto, descripcion, costo_refaccion? }
```
- Inserta en `pagos_servicio`
- Sincroniza `servicios.anticipo = SUM(pagos_servicio WHERE servicio_id=?)`
- Si `costo_refaccion` presente → actualiza `servicios.costo_refaccion` (solo el campo, no genera pago)

---

## Cortes de Caja

### Detalle de corte
- `GET /cortes/:id/detalle` → `{ corte, ventas, pagosServicio }`
- Filtra ventas y cobros de servicios por `local_id`, `empresa_id` y rango de fechas
- `pagosServicio` incluye campo `fuera_caja`
- Modal `corte-detalle-modal` muestra resumen + tabla de ventas + tabla de cobros de servicios
- Botón imprimir genera ticket térmico 58mm

---

## Productos

### Regla crítica: evitar ambigüedad en queries JOIN
Los queries de productos usan **columnas explícitas** (nunca `p.*`) al hacer JOIN con `empresa` porque ambas tablas tienen columna `nombre`. `sql.js` puede sobrescribir `p.nombre` con `e.nombre` al usar `SELECT p.*`:

```sql
-- CORRECTO:
SELECT p.id, p.folio, p.sku, p.codigo, p.tipo, p.nombre, p.compra, p.venta,
       p.existencia, p.local_id, p.empresa_id, p.fecha_creacion, p.precios,
       e.nombre as empresa_nombre, l.nombre_local as local_nombre
FROM productos p ...

-- NUNCA:
SELECT p.*, e.nombre as empresa_nombre ...  -- p.nombre puede ser sobrescrito
```

### IDs de formulario — regla de naming
El modal de productos usa `fp-prod-nombre` (no `fp-nombre`) para evitar conflicto con el modal de personas que también usa `fp-nombre`.

### Impresión de etiquetas
- Mini-QR en tabla → clic → `openLabelModal(canvasEl)`
- Botón "Imprimir etiqueta" en modal de edición → `printEtiquetaFromModal()`
- Modal `label-modal` tiene toggle **QR / Código de barras**
- Código de barras: encoder **Code128B** implementado en canvas puro (sin dependencias)
- `switchLabelTipo('qr'|'barcode')` cambia la vista en tiempo real
- `printLabel()` convierte canvas a PNG antes de imprimir

---

## Configuración — Secciones Accordion

`cfgToggle(id)` abre/cierra. Solo uno abierto a la vez.

| ID sección | Contenido |
|-----------|-----------|
| `general` | Datos empresa, logo, cobro base |
| `ticket-venta` | Campos visibles en ticket de venta |
| `ticket-servicio` | Campos visibles en ticket de servicio |
| `plantillas` | Plantillas de tickets personalizadas |
| `etiquetas` | Config etiquetas de productos (dimensiones, campos) |
| `wa` | Configuración WhatsApp |
| `notificaciones` | Config de notificaciones |
| `roles` | Definición de roles |
| `estados` | Estados personalizados de servicios |
| `tipos-productos` | Tipos de producto con prefijo y color |
| `conceptos-cobro` | Conceptos autofill del POS (fijo/liquidación) |
| `apariencia` | Tema y apariencia visual |
| `auditoria` | Logs de auditoría (admin/root only) |

### Regla de layout para páginas de configuración
`initPageLayout()` debe usar `display: block; overflow-y: auto` (NO `display: flex`) para páginas de configuración, o los `.cfg-collapse` se comprimen incorrectamente.

---

## Módulo de Reportes (`page-reportes`)

4 tabs. Activar con `goTo('reportes')`.

| Tab | Función | Modo |
|-----|---------|------|
| Ventas | `loadReporteVentas()` | Auto-carga al navegar |
| Servicios | `generateReport()` | Manual (botón) + sección "Cobros" |
| Cortes | `loadReporteCortes()` | Manual |
| Créditos | `loadReporteCreditos()` | Auto-carga |

### Tab Servicios — Cobros
- Función `loadCobrosServiciosReporte()` → `GET /servicios/pagos?desde=&hasta=`
- Muestra 4 cards de resumen (total, efectivo, tarjeta, transferencia)
- Tabla con badge "Fuera de caja" cuando `p.fuera_caja = 1`

---

## Ventas — Flujo de Crédito

1. POS crea venta con `metodo_pago='credito'` → `estado='credito_pendiente'`, stock NO se descuenta
2. Tab "Créditos" en reportes muestra ventas pendientes
3. Botón "Finalizar" → `POST /api/ventas/:id/finalizar` → reduce stock + marca completada
4. Los servicios en modo crédito se cobran en `efectivo` automáticamente

---

## Convenciones CSS / Diseño

- **Inputs**: `f-input`, `f-select`, `f-label` (NO usar `input-field`)
- **Badges método de pago**: `.badge-metodo .badge-efectivo/tarjeta/transferencia/credito/mixto`
- **Badges fuera de caja**: span naranja inline `background:rgba(255,165,0,0.15);color:orange`
- **Cards de resumen**: `.rs-card .income/.expenses/.profit/.services/.ventas/.tickets`
- **Accordion configuración**: `.cfg-collapse` con `.cfg-collapse-header` y `.cfg-collapse-body`
- **Tabs**: `.cfg-tab` y `.cfg-tab.active`
- **Scroll de páginas**: `initPageLayout()` IIFE envuelve contenido en `.page-content`
  - Páginas con scroll: `display:block; overflow-y:auto`
  - Páginas con tabla: `display:flex; flex-direction:column; overflow:hidden`
- **NO usar** `width: fit-content` dentro de contenedores con `overflow-y: auto` — causa layout loops en Chrome

---

## Helpers JS

```javascript
// DOM y formato
$id(id)                    // document.getElementById
money(n)                   // formatea como moneda MX ($1,234.56)
fmtDatetime(d)             // fecha+hora en formato es-MX
escHtml(str)               // escapa HTML para evitar XSS
api(method, path, body)    // fetch con JWT, lanza error en !res.ok, maneja 401 → logout

// Permisos y UI
hasPermiso(mod, accion)    // verifica permisos del usuario actual
showToast(msg, type)       // notificación temporal ('success'|'error'|'info')
goTo(page, el)             // navega entre páginas del SPA
btnLoading(btn, bool)      // activa/desactiva spinner en botón
tableLoading(tbody, cols)  // muestra spinner en tabla

// Reportes
switchReporteTab(tab)      // cambia tab en página de reportes

// Etiquetas
openLabelModal(canvasEl)   // abre modal con datos del canvas mini-QR de la tabla
printEtiquetaFromModal()   // abre modal con datos del formulario de edición
switchLabelTipo('qr'|'barcode')  // cambia entre QR y código de barras
drawCode128(canvas, text)  // renderiza barcode Code128B en canvas (sin librerías)
```

---

## Variables Globales Relevantes

```javascript
// Sesión
currentUserData            // datos del usuario logueado
token                      // JWT token
userPermisos               // permisos del empleado actual

// POS
posCart                    // array de items en caja
posNextRowId               // contador de rowId para items
posSelectedMethod          // método de pago seleccionado
posSplitMode               // boolean: modo pago dividido
posPagos                   // array de pagos en modo split
posClienteId, posClienteNombre  // cliente seleccionado en POS
posListaInfo               // lista de precios activa
posConceptosCobro          // conceptos de cobro cargados de la API
labelTipoImpresion         // 'qr' | 'barcode'
labelCurrentCode           // código del producto en el modal de etiqueta

// Reportes
rvCurrentPage, rvTotalPages, rvTotalRows  // paginación reportes ventas
RV_LIMIT = 25              // registros por página en reporte ventas
creditosPendientes         // array de créditos pendientes

// Configuración
currentConfig              // objeto de configuración cargado de la API
allTiposProducto           // tipos de producto para el selector del modal
allEmpresas                // lista de empresas (root)
corteActivo                // corte de caja abierto actualmente
editingProductoId          // ID del producto en edición (null = nuevo)
```

---

## Migraciones de DB

En `src/config/initDB.ts`. Siempre con `try/catch` para idempotencia:

```typescript
try { db.run("ALTER TABLE tabla ADD COLUMN columna TIPO DEFAULT valor"); } catch(e) {}
```

### Tablas creadas en migraciones recientes
- `conceptos_cobro(id, empresa_id, nombre, tipo, valor, orden)` — autofill POS
- `pagos_servicio.fuera_caja INTEGER DEFAULT 0` — pagos fuera de corte
- `servicios.fecha_estado TEXT` — tracking de cambios de estado

---

## Comandos

```bash
npm run dev          # servidor en modo desarrollo (reiniciar para cambios .ts)
npm run build        # compila TypeScript
```

---

## Notas Importantes

- **Reiniciar servidor** después de cualquier cambio en archivos `.ts`
- El servidor usa `ts-node --transpile-only` (no hot-reload)
- La DB SQLite vive en memoria; `persistDB()` la guarda a disco — llamar siempre tras writes
- `public/index.html` es muy grande — usar `Grep` con `-n` y `Read` con `offset/limit`
- Los modales están fuera de `.page` para evitar problemas de z-index
- Validar `req.user!.localId` antes de INSERT en `ventas` y `pagos_servicio` — puede ser null si el usuario no tiene local asignado
- `get()` en `db.ts` mapea columnas por posición: si dos columnas tienen el mismo nombre en un JOIN, la última gana → siempre usar columnas explícitas con alias
