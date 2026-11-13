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

## 2. El dominio (cuando se compre)

Registro **A** del dominio (o subdominio, ej. `app.nexo.com.co`) → `100.23.146.236`.
Después cambiar `DOMINIO` y `NEXT_PUBLIC_SITE_URL` (paso 4 y secreto del paso 5), y
publicar una release (paso 6). Hasta entonces se usa `100-23-146-236.sslip.io`.

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
- `DOMINIO=100-23-146-236.sslip.io` (o el dominio cuando exista)
- `NEXT_PUBLIC_SITE_URL=https://100-23-146-236.sslip.io`
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
- **Backups:** la base y los archivos están en Supabase. El VPS no guarda nada que no se
  pueda reconstruir (paso 8).
- **Si el servidor se reinicia:** los contenedores vuelven solos (`restart: unless-stopped`).
- **Espacio en disco:** cada versión desplegada deja su imagen (~250 MB). Cada tanto,
  `docker image ls` y borrar las versiones viejas con `docker image rm nexo-app:vX.Y.Z`.

### Monitor con alertas al celular (T-65, obligatorio antes de vender)

La app expone `https://100-23-146-236.sslip.io/api/health`: responde **200** si la app y la
base (Supabase) andan, y **503** si la base no contesta. Un monitor externo la llama
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
