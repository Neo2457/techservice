# Deploy de TechService Pro a Hostinger (Business Hosting + Node.js Web App)

Guía paso a paso para desplegar TechService Pro desde GitHub a Hostinger usando la
funcionalidad **Node.js Web App** del hPanel.

- **Repo GitHub:** `https://github.com/Neo2457/techservice.git`
- **Dominio temporal:** `lavenderblush-partridge-596040.hostingersite.com`
- **Plan:** Hostinger Business Web Hosting (con Node.js habilitado)
- **Stack desplegado:** Node.js + Express + TypeScript + sql.js (SQLite WASM)

---

## 0. Preparación local — antes de tocar Hostinger

### 0.1 Confirmar que el código actual está en GitHub

```bash
cd /Users/neo2457/Documents/Progra/techservice
git status
git log -1 --oneline
git remote -v
```

Si hay cambios sin commitear:

```bash
git add .
git commit -m "Preparar deploy a Hostinger"
git push origin main
```

### 0.2 Confirmar que `.env` NO está en GitHub

```bash
git ls-files | grep -E "^\.env$"
```

Debe devolver vacío. Si por error está commiteado, hay que removerlo del historial:

```bash
git rm --cached .env
git commit -m "Sacar .env del repo"
git push
```

(El `.gitignore` ya lo excluye, así que sólo aplica si se subió antes por accidente.)

### 0.3 Verificar scripts de package.json

Ya están correctos en tu repo:

| Script | Comando | Uso |
|--------|---------|-----|
| `build` | `tsc -p tsconfig.build.json` | Compila TypeScript a `dist/` con strict relajado para producción |
| `start` | `node dist/index.js` | Arranca el server compilado |
| `dev`   | `npx ts-node --transpile-only src/index.ts` | Solo desarrollo local |

Hostinger ejecutará `build` al desplegar y luego `start` para mantener la app viva.

---

## 1. Crear la Node.js Web App en hPanel

1. Entra a **hpanel.hostinger.com** → inicia sesión.
2. Sidebar izquierda → **Websites** → botón **Add Website**.
3. Selecciona **Node.js Apps** (no "WordPress" ni "Empty website").
4. En el flujo de creación elige **Import Git Repository**.
5. Haz clic en **Authorize GitHub** y conecta tu cuenta GitHub (`Neo2457`).
   - GitHub te pedirá permisos. Acepta para todos los repos o sólo para `techservice`.
6. Una vez autorizado, busca y selecciona el repo: `Neo2457/techservice`.
7. Branch: **main** (lo cambiaremos después si quieres usar `develop` para staging).

Hostinger detectará el framework automáticamente. Como no es Next.js / React puro,
probablemente lo marque como **"Other / Custom Node.js"**.

---

## 2. Configurar build, entry file y output

En la pantalla de configuración de la app rellena así:

| Campo | Valor | Notas |
|-------|-------|-------|
| **Application root** | `/` (raíz del repo) | Donde está `package.json` |
| **Node.js version** | `20.x` (LTS) | Mínimo `18.x`. Tu `tsconfig.json` apunta a ES2020. |
| **Build command** | `npm install && npm run build` | Instala deps + compila TypeScript |
| **Output directory** | `dist` | Donde tsc deja los `.js` |
| **Application startup file / Entry file** | `dist/index.js` | El compilado |
| **Start command** (si lo pide) | `node dist/index.js` | Equivale a `npm start` |

> **Importante:** En tu `package.json` ya hay `"main": "dist/index.js"`, así que esto
> es consistente.

---

## 3. Variables de entorno (Environment Variables)

En la sección **Environment Variables** del panel de la app agrega estas variables.
**No subas el archivo `.env`** — Hostinger las inyecta como env vars del proceso Node.

| Variable | Valor sugerido | Notas |
|----------|----------------|-------|
| `NODE_ENV` | `production` | Activa optimizaciones |
| `PORT` | (lo asigna Hostinger automáticamente) | NO lo fuerces. Tu código ya usa `process.env.PORT \|\| 3000`. |
| `JWT_SECRET` | `94a0192f723f51eaed35fd8f12364d1a4cc434ba0c1a269338de4a8331a53efb447ce01bbf52f60b13f5d8b7fd6ff781` | **Generado nuevo para producción** — distinto al de desarrollo. |
| `JWT_EXPIRES_IN` | `24h` | Duración del token de sesión |
| `DB_PATH` | `./database/techservice.db` | Path relativo al cwd. Hostinger persiste el filesystem. |
| `UPLOAD_PATH` | `./public/uploads` | Logos y archivos subidos |

> **¿Por qué un `JWT_SECRET` distinto al local?** Si reusas el mismo secreto que ya
> está en tu `.env` local (que pudo verse en tu computadora, en backups, etc.), un
> atacante con ese secreto podría forjar tokens válidos. El de arriba es nuevo y único.
> Guárdalo en algún gestor de contraseñas.

---

## 4. Conectar el dominio temporal

Para arrancar con `lavenderblush-partridge-596040.hostingersite.com`:

1. En el panel de la Node.js App → pestaña **Domains** (o **Connect Domain**).
2. Si Hostinger te dejó conectarlo automáticamente al crear la app, salta este paso.
3. Si no: selecciona el subdominio temporal y asígnaselo a esta app.
4. **SSL**: en la sección **Security → SSL**, activa Let's Encrypt si no está ya.
   En subdominios `*.hostingersite.com` Hostinger normalmente lo provee gratis.

> Cuando tengas tu dominio definitivo, el flujo es el mismo: agregar el dominio en
> hPanel, esperar propagación DNS, activar SSL.

---

## 5. Primer deploy

1. En la pantalla de la app → botón **Deploy** (o **Deploy Now**).
2. Hostinger:
   - Hace `git clone` / `git pull` del repo.
   - Corre `npm install && npm run build`.
   - Lanza `node dist/index.js` con las env vars configuradas.
3. Mira el log de despliegue en vivo. Si falla, normalmente es por:
   - Falta una env var → revísalas.
   - Versión Node incorrecta → cámbiala a 20.x.
   - Error de TypeScript estricto → arregla en local, push, redeploy.

Cuando termine OK, el status será **Running** / verde.

---

## 6. Verificación post-deploy

Abre en el navegador:

```
https://lavenderblush-partridge-596040.hostingersite.com/api/health
```

Deberías ver:

```json
{"ok":true,"version":"1.0.0","timestamp":"2026-..."}
```

Luego abre la raíz:

```
https://lavenderblush-partridge-596040.hostingersite.com/
```

Debe cargar el SPA (login de TechService Pro).

### 6.1 Login inicial (cuentas seed)

El `initDB.ts` siembra usuarios sólo si la BD está vacía:

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin` | `1234` | root |
| `empresa` | `1234` | admin TS |
| `carlos@electrofix.mx` | `1234` | admin EF |

> **CRÍTICO:** Entra como `admin / 1234` y **cambia la contraseña inmediatamente**
> desde tu perfil. Considera también borrar las cuentas demo `empresa` y
> `carlos@electrofix.mx` si no las vas a usar.

---

## 7. Auto-deploy desde GitHub (workflow recomendado)

En el panel de la app → **Settings → Auto Deploy** → activar.

Esto hace que cada `git push` a la branch configurada (main) dispare un deploy.

### Workflow sugerido para "pruebas ahora, producción después"

Cuando estés listo para separar entornos:

1. En GitHub crea una branch `develop`:
   ```bash
   git checkout -b develop
   git push -u origin develop
   ```
2. Crea una **segunda Node.js App** en Hostinger apuntando a `develop`.
3. Asígnale otro subdominio: `dev.tudominio.com` o el siguiente temporal de Hostinger.
4. Trabajas siempre en `develop`, mergeas a `main` cuando quieres "promover" a prod.

```
[local] → push a develop → deploy auto a dev.tudominio.com
              ↓ (cuando funciona OK)
         merge a main → deploy auto a tudominio.com
```

---

## 8. Persistencia de datos importante

Tu app guarda datos en el filesystem en dos lugares:

| Path | Qué guarda | Persistencia |
|------|-----------|--------------|
| `./database/techservice.db` | Toda la BD SQLite | Persistente entre deploys mientras Hostinger no resetee la app. |
| `./public/uploads/logos/` | Logos subidos por empresas | Igual. |

> **Riesgo:** Si Hostinger borra el filesystem en cada deploy (algunos PaaS lo hacen),
> perderías la BD. **Después del primer deploy**, conecta por SSH (hPanel → Advanced →
> SSH Access) y verifica que el archivo `database/techservice.db` siga existiendo
> después de hacer un segundo deploy con un cambio mínimo.
>
> Si lo borra → hay que mover la BD fuera del directorio de la app. Para eso te puedo
> guiar después, no es complicado.

### Backups

En hPanel → **Files → Backups** puedes activar backups automáticos diarios. Hazlo.
También puedes descargar manualmente el archivo `database/techservice.db` por SFTP
cada cierto tiempo.

---

## 9. Troubleshooting común

### Error: "Cannot find module 'xxx'" o "tsc: command not found"
- El proyecto incluye un `.npmrc` con `production=false` que fuerza la instalación
  de devDependencies aunque `NODE_ENV=production` esté seteado. Además `typescript`
  y `@types/node` se movieron de `devDependencies` a `dependencies` por la misma razón.
- Si aún falla, el build command en hPanel debe ser:
  ```
  npm install --include=dev && npm run build
  ```

### La app se cae con "EADDRINUSE" o no arranca
- Tienes hardcoded `PORT=3000` en algún lado. Tu `index.ts` está OK porque usa
  `process.env.PORT || 3000`. Si ves este error, revisa que no estés sobreescribiendo
  `PORT` en la sección Environment Variables.

### 502 Bad Gateway
- El proceso Node se cayó al arrancar. Mira los **Application Logs** en hPanel.
- Causa típica: error en `initDB()` por permisos del directorio `database/`. Conecta
  por SSH y crea el directorio manualmente: `mkdir -p ~/domains/.../database`.

### "Hostinger detected your framework as Next.js"
- En la pantalla de configuración cambia framework a **Other / Custom**.

### sql.js no encuentra el `.wasm`
- Muy raro, pero si pasa: el `node_modules/sql.js/dist/sql-wasm.wasm` debe quedar
  empaquetado. Como `node_modules` se reinstala en el server con `npm install`, debería
  estar siempre presente. Si no, reporta el log.

### TypeScript falla en build con `strict: true`
- El proyecto usa `tsconfig.build.json` para producción (con strict relajado) y
  `tsconfig.json` (estricto) para desarrollo. Si tsc falla en build, asegúrate que
  el script `build` en `package.json` apunte a `tsc -p tsconfig.build.json`.

---

## 10. Checklist post-deploy de seguridad

- [ ] Cambiar contraseña del usuario `admin` (root)
- [ ] Borrar o cambiar contraseña de usuarios seed (`empresa`, `carlos@electrofix.mx`)
- [ ] Confirmar `JWT_SECRET` en Hostinger ≠ al de tu `.env` local
- [ ] Confirmar `NODE_ENV=production` activo
- [ ] Activar SSL (HTTPS forzado) en hPanel → Security
- [ ] Activar backups automáticos en hPanel → Files → Backups
- [ ] (Opcional) Restringir SSH access a tu IP en hPanel → Advanced → SSH

---

## 11. Comandos útiles después del deploy

Conectado por SSH a Hostinger:

```bash
# Ver logs de la app
tail -f ~/logs/nodejs/techservice.log    # ruta exacta varía, hPanel te la dice

# Forzar restart manual
touch ~/domains/lavenderblush-partridge-596040.hostingersite.com/public_html/tmp/restart.txt
# (Passenger detecta este archivo y reinicia el proceso)

# Ver tamaño de la BD
ls -lh ~/.../database/techservice.db
```

---

## Notas finales sobre TechService Pro específicamente

- **Carga de logos**: el endpoint de upload guarda en `public/uploads/logos/`.
  Verifica permisos de escritura en ese directorio después del primer deploy.
- **WhatsApp**: si tienes integración WhatsApp configurada en `Configuración → wa`,
  los webhooks deberán apuntar a tu nuevo dominio HTTPS.
- **Etiquetas con QR / Code128**: son canvas puro en frontend, no requieren cambios.
- **Auto-corte scheduler** (`startAutoCorteScheduler`): corre con `setInterval` en
  el proceso Node. Si Hostinger duerme la app por inactividad, el scheduler se pausa.
  Si esto te afecta, monitorea con un servicio externo tipo UptimeRobot que pinguee
  `/api/health` cada 5 minutos.
