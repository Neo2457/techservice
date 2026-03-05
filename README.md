# TechService Pro — CRM + POS Admin

Sistema integral de gestión para talleres de reparación.  
Backend en **TypeScript + Express + SQLite**, frontend en HTML/CSS/JS vanilla.

---

## 📁 Estructura del proyecto

```
techservice/
├── src/
│   ├── index.ts                 ← Punto de entrada del servidor
│   ├── config/
│   │   ├── db.ts                ← Conexión SQLite singleton
│   │   └── initDB.ts            ← Esquema y datos iniciales
│   ├── controllers/
│   │   ├── authController.ts    ← Login, perfil, contraseña
│   │   ├── clientesController.ts← CRUD clientes (separado de servicios)
│   │   └── serviciosController.ts← CRUD servicios + reportes + dashboard
│   ├── middleware/
│   │   └── auth.ts              ← Validación JWT
│   ├── routes/
│   │   └── index.ts             ← Todas las rutas API
│   └── utils/
│       └── folio.ts             ← Generador de folios: TS050326001
├── public/
│   ├── index.html               ← Frontend admin (tu HTML)
│   └── uploads/                 ← Imágenes subidas
├── database/
│   └── techservice.db           ← SQLite (se crea automático)
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 🎓 Mini-clase: Cómo ejecutar el proyecto en Mac

### Paso 1 — Verifica que tienes Node.js instalado
Abre la **Terminal** (Cmd+Espacio → "Terminal") y escribe:
```bash
node --version
# Debe mostrar algo como: v18.17.0 o v20.x.x

npm --version
# Debe mostrar algo como: 9.x.x o 10.x.x
```

### Paso 2 — Ve a la carpeta del proyecto
```bash
# Navega a donde está la carpeta techservice
# Por ejemplo, si la pusiste en el Escritorio:
cd ~/Desktop/techservice

# O en Documentos:
cd ~/Documents/techservice

# Confirma que estás en el lugar correcto:
ls
# Debes ver: src/ public/ package.json tsconfig.json etc.
```

### Paso 3 — Instala las dependencias
```bash
npm install
```
> Esto descarga todos los paquetes necesarios (express, sqlite, etc.)
> Se crea automáticamente la carpeta `node_modules/` — puede tardar 30-60 segundos.

### Paso 4 — Crea el archivo de variables de entorno
```bash
cp .env.example .env
```
> Puedes editar `.env` para cambiar el puerto o la clave JWT, pero los valores default funcionan.

### Paso 5 — Inicia el servidor en modo desarrollo
```bash
npm run dev
```
> Verás en la terminal:
> ```
>   ╔════════════════════════════════════════╗
>   ║   TechService Pro — Servidor activo    ║
>   ║   http://localhost:3000               ║
>   ╚════════════════════════════════════════╝
> ```

### Paso 6 — Abre el sistema en el navegador
Abre Safari, Chrome o Firefox y ve a:
```
http://localhost:3000
```
Verás el login. Usa:
- **Usuario:** `admin`
- **Contraseña:** `1234`

---

## 🔄 Comandos disponibles

| Comando | ¿Qué hace? |
|---------|-----------|
| `npm run dev` | Inicia en desarrollo con **auto-reload** (reinicia solo al cambiar código) |
| `npm run build` | Compila TypeScript → JavaScript en carpeta `dist/` |
| `npm start` | Inicia la versión compilada (para producción) |
| `npm run db:init` | Crea/reinicia la base de datos manualmente |

---

## 🌐 Endpoints de la API

Todos los endpoints (excepto login) requieren header:
```
Authorization: Bearer <token>
```

### Autenticación
```
POST   /api/auth/login            → { correo, contrasena }
GET    /api/auth/profile          → Datos del usuario actual
PUT    /api/auth/profile          → Actualizar nombre, teléfono, foto
PUT    /api/auth/change-password  → { contrasena_actual, contrasena_nueva }
```

### Dashboard
```
GET    /api/dashboard             → Estadísticas generales
```

### Clientes (separados de servicios ✅)
```
GET    /api/clientes              → Lista con búsqueda ?q=nombre
GET    /api/clientes/:id          → Detalle + historial servicios + compras
POST   /api/clientes              → Crear cliente
PUT    /api/clientes/:id          → Actualizar cliente
DELETE /api/clientes/:id          → Eliminar (protegido si tiene servicios activos)
```

### Servicios
```
GET    /api/servicios             → Lista con filtros ?q=&estado=&garantia=&desde=&hasta=
GET    /api/servicios/:id         → Detalle con datos del cliente
POST   /api/servicios             → Crear (genera folio automático)
PUT    /api/servicios/:id         → Actualizar
DELETE /api/servicios/:id         → Eliminar
GET    /api/servicios/reporte     → Datos financieros con ?desde=&hasta=&estado=
```

---

## 🗄️ Base de datos — Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `empresa` | Datos del negocio (1 por instalación) |
| `locales` | Sucursales del negocio |
| `usuario` | Cuentas con acceso al sistema |
| `clientes` | Clientes **separados** del servicio — reutilizables en POS |
| `servicios` | Órdenes de reparación con folio automático |
| `productos` | Inventario / catálogo |
| `ventas` + `ventas_detalle` | Punto de venta |
| `creditos` + `abonos` | Cuentas por cobrar |
| `empleados` | RH completo |
| `listas_precios` | Precios diferenciados por cliente |

### 📋 Formato del folio
```
[INICIALES EMPRESA][DDMMAA][ID con padding]
Ejemplo: TS050326001
         ^^          ← Iniciales de "TechService" → TS
           ^^^^^^    ← Fecha 05 de marzo 2026 → 050326
                 ^^^  ← ID del registro → 001
```
Las iniciales se configuran en la tabla `empresa.iniciales`.

---

## 🔧 Solución de problemas comunes

**Error: `command not found: ts-node-dev`**
```bash
npm install   # Asegúrate de haber instalado dependencias
```

**Error: `SQLITE_CANTOPEN`**
```bash
mkdir -p database   # Crea la carpeta si no existe
```

**Puerto 3000 ya en uso**
Edita `.env` y cambia `PORT=3001`, luego reinicia.

**La BD quedó en estado raro**
```bash
rm database/techservice.db
npm run dev   # Se recreará automáticamente
```

---

## 📌 Notas sobre la migración desde la BD original

La BD original `u263716822_celulares` tenía los datos del **cliente y el dispositivo mezclados** en la tabla `clientes`. En esta nueva versión:

- ✅ `clientes` → solo datos personales del cliente (nombre, tel, correo, dirección)
- ✅ `servicios` → datos del dispositivo (modelo, serie, falla, garantía, costos)
- ✅ Un cliente puede tener **múltiples servicios** sin duplicar sus datos
- ✅ Los mismos clientes se usan en **ventas del POS** y **créditos**
- ✅ Foreign keys activas con `ON DELETE RESTRICT` para proteger integridad

---

*TechService Pro v1.0 — Desarrollado con TypeScript, Express y SQLite*
