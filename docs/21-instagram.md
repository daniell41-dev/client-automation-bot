# Instagram de Aurela: comentario → DM (T-108)

Quien comenta **ALMUERZO** o **CITA** en un Reel o una publicación de Aurela recibe un DM con
un gancho y el enlace a soyaurela.com, y debajo de su comentario aparece "¡Le escribí por
DM! 📩". Los textos y las palabras viven en `src/lib/instagram-respuestas.ts`.

Es la **primera pieza del canal de Instagram**: el webhook (`/api/webhook/instagram`) y el
cliente de la API (`src/core/channels/instagram/`) los reusa después el bot de los negocios
(plan aparte, de la socia: T-122 en adelante).

## Por qué no necesita la revisión de Meta

Funciona con **la cuenta de Instagram de Aurela**, que es nuestra. Meta da "acceso estándar"
sin revisión para cuentas propias o administradas. La revisión (App Review) y la verificación
del negocio solo hacen falta para conectar cuentas **de terceros** (los clientes).

## Lo que hace

- Responde solo al comentario principal (no a respuestas dentro de un hilo) y nunca a los
  comentarios de la propia cuenta.
- La palabra va como palabra completa: "Cita por favor" sí, "felicitaciones" no.
- Un DM por persona cada 24 h, aunque comente en varios Reels.
- Meta permite una respuesta privada por comentario, dentro de los 7 días.
- Si Meta reintenta el aviso, el mismo comentario no se contesta dos veces.

## Configuración (una sola vez)

1. **Cuenta profesional.** En la app de Instagram de Aurela: Configuración → Tipo de cuenta y
   herramientas → **Cambiar a cuenta profesional** (empresa o creador).
2. **El producto Instagram en la app de Meta.** developers.facebook.com → Mis apps → la app de
   Aurela → **Agregar producto** → **Instagram** → **Configuración de la API con inicio de
   sesión de Instagram** (API setup with Instagram login).
3. **Permisos** (acceso estándar): `instagram_business_basic`,
   `instagram_business_manage_comments` e `instagram_business_manage_messages`.
4. **Conectar la cuenta y generar el token.** En esa misma pantalla, "Generar tokens de acceso"
   → **Agregar cuenta** → iniciar sesión con el Instagram de Aurela y aceptar. Copiar el token
   (dura 60 días) a una nota privada. Si Meta pide agregar la cuenta como **evaluador de
   Instagram** (Roles de la app), hacerlo y aceptar la invitación desde la app de Instagram
   (Configuración → Apps y sitios web).
5. **El App Secret de Instagram.** En la misma sección, en la configuración del inicio de
   sesión con Instagram, está el **Instagram App Secret**: es distinto del de WhatsApp.
6. **El webhook.** En "Configurar webhooks":
   - URL de devolución de llamada: `https://soyaurela.com/api/webhook/instagram`
   - Token de verificación: uno inventado (generarlo con `openssl rand -hex 16`).
   - Suscribirse al campo **`comments`**.
   Primero hay que cargar las variables del paso 7 y reiniciar la app; si no, Meta no puede
   verificar la URL.
7. **Variables en el servidor** (`/opt/nexo/.env.production`, después reiniciar la app con
   `docker compose --env-file .env.production up -d --force-recreate app`):
   ```
   INSTAGRAM_ACCESS_TOKEN=el-token-del-paso-4
   INSTAGRAM_APP_SECRET=el-secreto-del-paso-5
   INSTAGRAM_VERIFY_TOKEN=el-token-inventado-del-paso-6
   ```
   Opcionales: `INSTAGRAM_RESPUESTA_PUBLICA=false` (solo DM, sin respuesta pública) e
   `INSTAGRAM_API_VERSION` (por defecto `v23.0`).
8. **Probar.** Desde **otra** cuenta de Instagram, comentar `ALMUERZO` en una publicación de
   Aurela. Debe llegar el DM y aparecer la respuesta pública. En el servidor:
   `docker compose --env-file .env.production logs -f app` muestra
   `[Instagram] DM enviado por el comentario …`. Si dice `firma inválida`, el App Secret no es
   el de Instagram (paso 5).

## Renovar el token (cada menos de 60 días)

El token de Instagram vence a los 60 días. Para renovarlo (desde el servidor, con el token
actual todavía vigente):
```bash
curl -sS "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=TOKEN_ACTUAL"
```
La respuesta trae un `access_token` nuevo: reemplazarlo en `.env.production` y reiniciar la
app. Automatizar esta renovación queda como tarea del canal de Instagram.
