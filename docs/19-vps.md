# Nexo en un VPS propio (T-61)

Cómo poner Nexo en línea 24/7 en un servidor propio, sin Vercel y sin ngrok.

**Qué se mueve y qué no:**

| | Dónde vive |
|---|---|
| La app (bot, portal, back office) | **El VPS**, en Docker, detrás de Traefik (HTTPS automático) |
| Base de datos, login, fotos de comprobantes, QR | **Supabase** (sin cambios: backups y mantenimiento son de ellos) |

Costo: el VPS (~€4–5/mes) + el dominio. Supabase sigue gratis mientras se prueba; Pro
(USD 25) cuando haya clientes que pagan. Ver la discusión en el chat de oct-2026.

Archivos que usa esta guía: `Dockerfile`, `.dockerignore`, `deploy/docker-compose.yml`,
`deploy/.env.production.example`.

---

## 1. Contratar el VPS

1. Crear cuenta en un proveedor. Probado con la idea de **Hetzner Cloud**; sirven igual
   DigitalOcean, Vultr, Contabo, etc.
2. Crear el servidor:
   - **Ubicación:** EE. UU. costa este (Ashburn / Virginia / Nueva York): es la más
     cercana a Colombia y a Supabase.
   - **Imagen:** Ubuntu 24.04.
   - **Tamaño:** 2 vCPU y **4 GB de RAM** (el `docker build` de Next necesita memoria;
     con 2 GB hay que agregar swap, paso 3).
   - **SSH key:** cargar tu llave pública (más seguro que contraseña). Si no tenés una:
     en tu compu `ssh-keygen -t ed25519` y copiar el contenido de `~/.ssh/id_ed25519.pub`.
3. Anotar la **IP pública** del servidor.

## 2. Apuntar el dominio

En el proveedor del dominio, crear un registro **A**:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `bot` | la IP del VPS |

Queda `bot.tudominio.com`. Puede tardar unos minutos en propagarse
(`ping bot.tudominio.com` tiene que responder la IP del VPS).

## 3. Preparar el servidor (una sola vez)

```bash
ssh root@IP_DEL_VPS

apt update && apt upgrade -y
apt install -y git ufw unattended-upgrades   # actualizaciones de seguridad automáticas

# Docker
curl -fsSL https://get.docker.com | sh

# Firewall: solo SSH, http y https
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable

# Swap de 2 GB (seguro extra para el build; obligatorio si el VPS tiene 2 GB de RAM)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 4. Bajar el código

El repo es privado. Crear en GitHub un **token de solo lectura** de este repo:
GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained** →
Repository access: solo `client-automation-bot` → Permissions: **Contents: Read-only**.

```bash
cd /opt
git clone https://TU_TOKEN@github.com/daniell41-dev/client-automation-bot.git nexo
cd nexo
git checkout develop        # o main, cuando se publique
```

## 5. Configurar los secretos

```bash
cd /opt/nexo/deploy
cp .env.production.example .env.production
nano .env.production
```

Completar con los mismos valores de tu `.env.local` y, además:
- `DOMINIO=bot.tudominio.com`
- `ACME_EMAIL=` tu correo (Let's Encrypt avisa ahí si algo pasa con el certificado)
- `NEXT_PUBLIC_SITE_URL=https://bot.tudominio.com`

`.env.production` nunca se sube a GitHub (está en `.gitignore`).

## 6. Levantar

```bash
cd /opt/nexo/deploy
docker compose --env-file .env.production up -d --build
```

La primera vez tarda unos minutos (instala dependencias y compila). Después:
- `https://bot.tudominio.com/login` tiene que abrir el login con candado (HTTPS).
- `docker compose logs -f app` muestra los registros (`[Agent]`, `[WhatsApp]`…), igual
  que la terminal de `pnpm dev`. Ctrl+C para salir (la app sigue corriendo).

## 7. Apuntar Meta y Supabase al servidor

1. **Meta:** tu app → Casos de uso → WhatsApp → Personalizar → Configuración →
   **Webhook**:
   - URL de devolución de llamada: `https://bot.tudominio.com/api/webhook/whatsapp`
   - Token de verificación: el mismo `WHATSAPP_VERIFY_TOKEN`.
   - Verificar y guardar.
2. **Supabase:** Authentication → **URL Configuration**:
   - Site URL: `https://bot.tudominio.com`
   - Redirect URLs: agregar `https://bot.tudominio.com/**`
   Sin esto, los correos de invitación y de "olvidé mi contraseña" apuntan a localhost.

Desde acá ya no hace falta `pnpm dev` ni ngrok: escribirle al número del negocio
funciona con la compu apagada.

## 8. Actualizar a una versión nueva

```bash
cd /opt/nexo && git pull
cd deploy && docker compose --env-file .env.production up -d --build
```

Mientras se reinicia, la app termina de procesar los mensajes en curso (hasta 30 s).
Si Meta manda un mensaje justo en ese momento, lo reintenta solo.

## 9. Mantenimiento

- **Actualizaciones de seguridad del sistema:** automáticas (`unattended-upgrades`, paso 3).
- **Certificado HTTPS:** Traefik lo renueva solo.
- **Backups:** la base y los archivos están en Supabase. El VPS no guarda nada que no se
  pueda reconstruir con los pasos 4–6.
- **Si el servidor se reinicia:** los contenedores vuelven solos (`restart: unless-stopped`).
- **Espacio en disco:** cada build deja imágenes viejas; limpiar cada tanto con
  `docker image prune -f`.

### Portainer (opcional)

Para ver los contenedores desde el navegador en vez de la terminal:

```bash
docker run -d --name portainer --restart=unless-stopped -p 127.0.0.1:9443:9443 \
  -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data \
  portainer/portainer-ce:latest
```

Queda escuchando solo en el servidor (no expuesto a internet). Para abrirlo desde tu
compu: `ssh -L 9443:127.0.0.1:9443 root@IP_DEL_VPS` y entrar a `https://localhost:9443`.
