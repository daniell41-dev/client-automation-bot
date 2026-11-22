# Nexo en un VPS propio (T-61)

Cómo poner Nexo en línea 24/7 en un servidor propio, sin Vercel y sin ngrok.

**Qué se mueve y qué no:**

| | Dónde vive |
|---|---|
| La app (bot, portal, back office) | **El VPS**, en Docker, detrás de Traefik (HTTPS automático) |
| Base de datos, login, fotos de comprobantes, QR | **Supabase** (sin cambios: backups y mantenimiento son de ellos) |

Costo: el VPS (US$7/mes en Lightsail) + el dominio (~US$1/mes). Supabase sigue gratis
mientras se prueba; Pro (USD 25) cuando haya clientes que pagan.

Archivos que usa esta guía: `Dockerfile`, `.github/workflows/deploy.yml` (T-74),
`deploy/docker-compose.yml`, `deploy/.env.production.example`.

---

## 1. El servidor (hecho el 9-nov-2026)

**AWS Lightsail**, región **Oregón (us-west-2a)**, la misma de Supabase: cada consulta a
la base tarda 1–2 ms en vez de cientos.

| | |
|---|---|
| Instancia | `nexo-prod`: Ubuntu 24.04 LTS, 1 GB RAM, 2 vCPU, 40 GB SSD, doble pila (US$7/mes) |
| IP estática | `nexo-ip` = **100.23.146.236** (no cambia al reiniciar) |
| Firewall (Lightsail → Redes) | SSH 22, HTTP 80, HTTPS 443 |
| Dirección mientras no haya dominio | `https://100-23-146-236.sslip.io` |
| Alerta de gasto | Presupuesto "Nexo mensual" de US$15 en AWS Budgets |

Para entrar al servidor: Lightsail → `nexo-prod` → **Conectar mediante SSH** (terminal en
el navegador; no funciona en ventana de incógnito). Si se queda cargando, **Reiniciar** la
instancia y volver a intentar.

## 2. El dominio: soyaurela.com (T-96)

Comprado en Hostinger (15-nov-2026, 3 años; renueva el 15-nov-2029 a 61.900 COP/año).
En Hostinger → Dominios → soyaurela.com → **DNS / Nameservers** quedan solo estos dos
registros (los nameservers siguen siendo los de Hostinger):

| Tipo | Nombre | Contenido |
|---|---|---|
| A | `@` | `100.23.146.236` |
| A | `www` | `100.23.146.236` |

`www.soyaurela.com` redirige solo a `soyaurela.com` (lo hace Traefik, ver
`deploy/docker-compose.yml`). Comprobar que el DNS ya llegó: dnschecker.org →
`soyaurela.com`, tipo A → `100.23.146.236`.

### Pasar de sslip.io al dominio, sin cortar el servicio

El orden importa: el webhook de Meta y los links de Supabase apuntan a la dirección
vieja, así que la app sigue respondiendo en las dos hasta que se actualizan.

1. **GitHub → Secrets:** `NEXT_PUBLIC_SITE_URL` = `https://soyaurela.com` (se incrusta
   al compilar: tiene que estar antes de la release).
2. **Servidor** (`nano /opt/nexo/.env.production`, paso 4):
   - `DOMINIO=soyaurela.com`
   - `DOMINIO_ANTERIOR=100-23-146-236.sslip.io` ← la vieja sigue andando mientras tanto
   - `NEXT_PUBLIC_SITE_URL=https://soyaurela.com`
3. **Publicar la release** (paso 6). Traefik pide los certificados de `soyaurela.com` y
   `www.soyaurela.com` solo (tarda menos de un minuto).
4. Abrir `https://soyaurela.com` y `https://soyaurela.com/api/health` (tiene que decir ok).
5. **Meta** (paso 7): URL del webhook → `https://soyaurela.com/api/webhook/whatsapp`.
   Verificar y guardar, y mandarle un mensaje de prueba al número.
6. **Supabase** (paso 7): Site URL → `https://soyaurela.com`; en Redirect URLs agregar
   `https://soyaurela.com/**` (dejar la vieja hasta el paso 8).
7. **Monitor** (paso 9): cambiar la URL a `https://soyaurela.com/api/health`.
8. Cuando todo funcione con el dominio: borrar `DOMINIO_ANTERIOR` del `.env.production`,
   `cd /opt/nexo && docker compose --env-file .env.production up -d`, y quitar la URL
   vieja de Supabase.

## 3. Preparar el servidor (una sola vez, hecho)

```bash
sudo apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get -y upgrade
# Swap de 2 GB: colchón por si la app pide más de 1 GB en un pico.
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
# Docker, y la carpeta de la app.
curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker ubuntu
sudo mkdir -p /opt/nexo && sudo chown ubuntu:ubuntu /opt/nexo
# Llave SOLO para los despliegues desde GitHub (no es la de AWS).
ssh-keygen -t ed25519 -f ~/.ssh/nexo_deploy -N "" -C "github-deploy"
cat ~/.ssh/nexo_deploy.pub >> ~/.ssh/authorized_keys
sudo reboot
```

Las actualizaciones de seguridad de Ubuntu ya vienen activadas (`unattended-upgrades`).
El servidor **no** tiene el código ni lo compila: recibe la imagen hecha (paso 6).

## 4. Los secretos del servidor (`/opt/nexo/.env.production`)

```bash
nano /opt/nexo/.env.production
```

Pegar el contenido de `deploy/.env.production.example` completado con los valores de tu
`.env.local`, y además:
- `DOMINIO=soyaurela.com` (antes del dominio era `100-23-146-236.sslip.io`; para
  cambiarlo, ver el paso 2)
- `NEXT_PUBLIC_SITE_URL=https://soyaurela.com`
- `ACME_EMAIL=` el correo para avisos del certificado HTTPS

Guardar: **Ctrl+O**, Enter, **Ctrl+X**. Después `chmod 600 /opt/nexo/.env.production`
(solo lo lee el usuario del servidor). Este archivo nunca va a GitHub.

## 5. Los secretos de GitHub (una sola vez)

GitHub → el repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secreto | Valor |
|---|---|
| `VPS_HOST` | `100.23.146.236` |
| `VPS_SSH_KEY` | La llave privada de despliegue: en el servidor, `cat ~/.ssh/nexo_deploy`, copiar TODO (incluidas las líneas `-----BEGIN…` y `-----END…`) |
| `NEXT_PUBLIC_SUPABASE_URL` | El mismo de `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | El mismo de `.env.local` |
| `NEXT_PUBLIC_SITE_URL` | `https://100-23-146-236.sslip.io` |
| `NEXT_PUBLIC_WHATSAPP_VENTAS` | (Opcional, T-80) El WhatsApp de ventas para la landing, formato `57XXXXXXXXXX` |
| `NEXT_PUBLIC_INSTAGRAM` | (Opcional, T-80) El Instagram de Nexo: usuario o URL |

Las `NEXT_PUBLIC_*` van acá porque Next las incrusta al compilar, y la compilación
es en GitHub. Las dos de la landing son opcionales: si faltan, el despliegue no falla y
los botones "Escríbanos por WhatsApp" llevan a `/demo`. Como quedan dentro del HTML, un
cambio de número necesita publicar una release nueva para verse. Los demás secretos (WhatsApp, IA, service role) **no** se cargan en
GitHub: solo viven en el `.env.production` del servidor.

## 6. Desplegar una versión

**Publicar una release en GitHub** (`docs/01-git-flow.md` → "Versiones y releases").
El workflow `.github/workflows/deploy.yml` (Actions → "Desplegar") construye la imagen,
la manda al servidor, la levanta y espera a que `/api/health` responda. Tarda 5–8
minutos; si la app no arranca, el paso falla y muestra los registros.

**Volver a una versión anterior:** Actions → "Desplegar" → **Run workflow** → escribir la
versión (ej. `v1.0.1`). Ojo: si la versión nueva trajo una migración de base, volver
atrás el código no la deshace.

Ver los registros en el servidor (`[Agent]`, `[WhatsApp]`…, igual que en `pnpm dev`):

```bash
cd /opt/nexo && docker compose --env-file .env.production logs -f app
```

Ctrl+C para salir (la app sigue corriendo).

## 7. Apuntar Meta y Supabase al servidor

1. **Meta:** tu app → Casos de uso → WhatsApp → Personalizar → Configuración →
   **Webhook**:
   - URL de devolución de llamada: `https://100-23-146-236.sslip.io/api/webhook/whatsapp`
   - Token de verificación: el mismo `WHATSAPP_VERIFY_TOKEN`.
   - Verificar y guardar.
2. **Supabase:** Authentication → **URL Configuration**:
   - Site URL: `https://100-23-146-236.sslip.io`
   - Redirect URLs: agregar `https://100-23-146-236.sslip.io/**`
   Sin esto, los correos de invitación y de "olvidé mi contraseña" apuntan a localhost.

Desde acá ya no hace falta `pnpm dev` ni ngrok: escribirle al número del negocio
funciona con la compu apagada.

## 8. Si el servidor se rompe

No guarda nada que no se pueda reconstruir: crear otra instancia igual (paso 1), pasarle
la IP estática, repetir los pasos 3 y 4, actualizar `VPS_SSH_KEY` con la llave nueva y
desplegar la última versión (paso 6). Unos 20 minutos.

## 9. Mantenimiento

- **Actualizaciones de seguridad del sistema:** automáticas (`unattended-upgrades`, viene con Ubuntu).
- **Certificado HTTPS:** Traefik lo renueva solo.
- **Backups:** el plan gratis de Supabase **no** guarda copias recuperables: el VPS saca
  una cada noche (ver "Respaldo diario de la base", abajo). Las fotos de comprobantes
  siguen solo en Supabase. Con Supabase Pro (USD 25) hay copias diarias de ellos además.
- **Si el servidor se reinicia:** los contenedores vuelven solos (`restart: unless-stopped`).
- **Espacio en disco:** cada versión desplegada deja su imagen (~250 MB). Cada tanto,
  `docker image ls` y borrar las versiones viejas con `docker image rm nexo-app:vX.Y.Z`.

### Respaldo diario de la base (T-101, obligatorio mientras Supabase sea gratis)

`deploy/respaldo-db.sh` saca cada noche una copia completa de la base con `pg_dump`
(pedidos, clientes, negocios, configuración y usuarios del login) y guarda las últimas 14
en `/opt/nexo/respaldos/`. Cada despliegue copia el script al servidor; esto se configura
**una sola vez**:

1. **La cadena de conexión.** Supabase → el proyecto → botón **Connect** (arriba) →
   pestaña **Connection string** → **Session pooler** (no "Direct connection": esa es
   solo IPv6 y Docker en el VPS sale por IPv4). Copiar la URI; se ve así:
   `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres`.
   Cambiar `[YOUR-PASSWORD]` por la contraseña de la base (si no se acuerda:
   Project Settings → Database → **Reset database password**; la app no la usa, así
   que cambiarla no rompe nada).
2. **Ver la versión de Postgres** de Supabase: Project Settings → **Infrastructure** →
   "Postgres version". Si empieza por 15 o 17, sirve la imagen por defecto
   (`postgres:17-alpine`). Si es más nueva (18…), agregar `PG_IMAGEN=postgres:18-alpine`
   en el archivo del paso 3.
3. **Guardar el secreto en el servidor** (SSH, paso 1). Crear el archivo con el editor:
   ```bash
   sudo nano /opt/nexo/respaldo.env
   ```
   Escribir una sola línea, con la URI entre comillas simples:
   ```
   SUPABASE_DB_URL='postgresql://postgres.<ref>:LA-CONTRASEÑA@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
   ```
   Guardar con **Ctrl+O**, Enter, y salir con **Ctrl+X**. Después dejarlo legible solo por root:
   ```bash
   sudo chmod 600 /opt/nexo/respaldo.env
   ```
4. **El script**, si todavía no llegó con un despliegue (llega con la release que trae
   T-101). Mientras tanto se puede bajar a mano:
   ```bash
   sudo curl -fsSL -o /opt/nexo/respaldo-db.sh https://raw.githubusercontent.com/daniell41-dev/client-automation-bot/main/deploy/respaldo-db.sh
   sudo chmod 700 /opt/nexo/respaldo-db.sh
   ```
5. **Probarlo a mano:**
   ```bash
   sudo /opt/nexo/respaldo-db.sh
   ```
   Tiene que terminar con `[respaldo] ok: /opt/nexo/respaldos/aurela-AAAA-MM-DD.dump (…)`.
   Si dice `password authentication failed`, la contraseña del paso 1 está mal; si dice
   `server version mismatch`, ajustar `PG_IMAGEN` (paso 2).
6. **Programarlo todas las noches** (3:17 a. m. de Colombia = 08:17 UTC, la hora del servidor):
   ```bash
   echo '17 8 * * * root /opt/nexo/respaldo-db.sh >> /var/log/aurela-respaldo.log 2>&1' | sudo tee /etc/cron.d/aurela-respaldo
   ```
   Al día siguiente, `ls -lh /opt/nexo/respaldos` debe mostrar el archivo nuevo y
   `tail /var/log/aurela-respaldo.log` la línea `ok`.
7. **Opcional, alerta si deja de correr:** crear una cuenta gratis en **healthchecks.io**
   → New check → periodo 1 día, gracia 2 horas → copiar la URL de ping y agregar en
   `/opt/nexo/respaldo.env` la línea `RESPALDO_PING_URL='https://hc-ping.com/...'`.
   Si una noche no llega el ping, avisa por correo.

**Restaurar** (cuando algo se borró). Primero hacer un respaldo del estado actual (paso 5),
por si acaso. Después, desde el servidor:
```bash
cd /opt/nexo && sudo bash -c 'source respaldo.env && docker run --rm -i postgres:17-alpine \
  pg_restore --clean --if-exists --no-owner --no-privileges --schema=public \
  -d "$SUPABASE_DB_URL" < respaldos/aurela-AAAA-MM-DD.dump'
```
Eso devuelve las tablas de la app al estado de esa noche (lo de después se pierde). Para
una sola tabla, agregar `--table=pedidos`. Los usuarios del login (`auth`) van en el mismo
archivo, pero en el mismo proyecto no hace falta restaurarlos (Supabase no los borra con
la base). Si hay dudas, mejor pedir ayuda antes de correrlo: `--clean` borra lo actual.

**Si el VPS se pierde, se pierden también estos respaldos.** Cubren el caso de "algo
borró la base", no el de "se cayó todo". Para lo segundo: Supabase Pro cuando haya
clientes que paguen.

### Seguimiento automático de pedidos a medias (T-106)

Cada negocio lo enciende en Portal → Configuración → "Seguimiento automático" (apagado por
defecto). Para que funcione, el servidor tiene que llamar a la app cada 15 minutos. Se
configura **una sola vez**:

1. **Migración:** correr `supabase/migrations/0027_seguimientos.sql` en el SQL Editor de
   Supabase.
2. **El secreto.** En el servidor, generar uno:
   ```bash
   openssl rand -hex 32
   ```
   Copiar el resultado y agregarlo al final de `/opt/nexo/.env.production` (con
   `sudo nano /opt/nexo/.env.production`): `CRON_SECRET=lo-que-salió`. Después reiniciar
   la app: `cd /opt/nexo && sudo docker compose --env-file .env.production up -d app`.
3. **Guardar el mismo secreto para el cron** en un archivo que solo lea root:
   ```bash
   sudo nano /opt/nexo/cron.env
   ```
   Una línea: `CRON_SECRET=lo-mismo-del-paso-2`. Guardar y `sudo chmod 600 /opt/nexo/cron.env`.
4. **Probarlo a mano:**
   ```bash
   sudo bash -c 'source /opt/nexo/cron.env && curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://soyaurela.com/api/cron/seguimientos'
   ```
   Debe responder algo como `{"ok":true,"negocios":1,"enviados":0}`. Un `401` es que el
   secreto no coincide con el de `.env.production`; un `503`, que la app no lo tiene (falta el
   reinicio del paso 2).
5. **Programarlo cada 15 minutos:**
   ```bash
   echo '*/15 * * * * root . /opt/nexo/cron.env && curl -fsS -m 60 -X POST -H "Authorization: Bearer $CRON_SECRET" https://soyaurela.com/api/cron/seguimientos >> /var/log/aurela-seguimientos.log 2>&1' | sudo tee /etc/cron.d/aurela-seguimientos
   ```

Las reglas (máximo 2 por silencio del cliente, solo en horario, solo dentro de las 24 h de
WhatsApp, nunca a quien pidió "no me escriban") viven en `src/core/engine/seguimientos.ts`.

### Monitor con alertas al celular (T-65, obligatorio antes de vender)

La app expone `https://100-23-146-236.sslip.io/api/health`: responde **200** si la app y la
base (Supabase) andan, y **503** si la base no contesta o si faltan las variables de Supabase
(T-100: sin ellas la app guardaría en un archivo que se borra en cada despliegue). Un monitor externo la llama
cada minuto y avisa si falla — así uno se entera antes que el cliente.

1. Crear cuenta gratis en **UptimeRobot** (uptimerobot.com) o **Better Stack**
   (betterstack.com/uptime).
2. Nuevo monitor → tipo **HTTP(s)** → URL `https://100-23-146-236.sslip.io/api/health` →
   intervalo **1–5 minutos** (lo que permita el plan gratis).
3. Alertas: correo, y la app del monitor en el celular (notificaciones push) o
   Telegram.
4. Probarlo: `cd /opt/nexo && docker compose --env-file .env.production stop app` → tiene que llegar la alerta en
   pocos minutos → el mismo comando con `start app` → llega el aviso de que volvió.

Si el servidor se cae un rato, **no se pierden mensajes**: Meta reintenta los webhooks
y llegan cuando vuelve (comprobado en la prueba real con ngrok caído).

### Portainer (opcional)

Para ver los contenedores desde el navegador en vez de la terminal:

```bash
docker run -d --name portainer --restart=unless-stopped -p 127.0.0.1:9443:9443 \
  -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data \
  portainer/portainer-ce:latest
```

Queda escuchando solo en el servidor (no expuesto a internet). Para abrirlo desde tu
compu: `ssh -i tu-llave.pem -L 9443:127.0.0.1:9443 ubuntu@100.23.146.236` y entrar a `https://localhost:9443`.
