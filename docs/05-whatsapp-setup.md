# 05 - Setup de WhatsApp Cloud API

Cómo conectar el bot a un número real de WhatsApp. Mientras tramitas la cuenta, puedes
desarrollar y demostrar todo con el **simulador offline** (`pnpm sim`) — esta guía es
para cuando ya tengas credenciales.

## Variables de entorno

Los secretos viven en `.env.local` (gitignored). El repo solo trae `.env.example` con las
claves vacías. Copia y rellena:

```bash
cp .env.example .env.local
```

| Variable | Para qué |
|----------|----------|
| `WHATSAPP_VERIFY_TOKEN` | Token que tú inventas; Meta lo envía al verificar el webhook. |
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso de la app de Meta para llamar a la Graph API. |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de WhatsApp Business (no el número en sí). |
| `WHATSAPP_APP_SECRET` | Secreto de la app; valida la firma `X-Hub-Signature-256`. |

> **Nunca** commitees `.env.local` ni pegues estos valores en el código o en issues/PRs.

## 1. Crear la app en Meta

1. Crea una app en <https://developers.facebook.com/> y agrega el producto **WhatsApp**.
2. Obtén el `WHATSAPP_PHONE_NUMBER_ID` y un `WHATSAPP_ACCESS_TOKEN`.
3. Copia el **App Secret** de la app → `WHATSAPP_APP_SECRET`.

## 2. Exponer el webhook con una URL pública HTTPS

Meta necesita una URL pública. En desarrollo, usa un túnel:

```bash
pnpm dev                      # arranca Next en http://localhost:3000
# en otra terminal:
ngrok http 3000               # o: cloudflared tunnel --url http://localhost:3000
```

Tu webhook será: `https://<tu-tunel>/api/webhook/whatsapp`. En producción, la URL de
Vercel u otro host.

## 3. Verificación del webhook (`hub.challenge`)

Al registrar la URL, Meta hace un `GET` con `hub.mode`, `hub.verify_token` y
`hub.challenge`. El handler:

1. Comprueba que `hub.verify_token` == `WHATSAPP_VERIFY_TOKEN`.
2. Responde con el valor de `hub.challenge` en texto plano.

Si coincide, Meta marca el webhook como verificado. Configura el mismo
`WHATSAPP_VERIFY_TOKEN` en el panel de Meta y en tu `.env.local`.

## 4. Firma de los eventos (`X-Hub-Signature-256`)

Cada `POST` de Meta trae el header `X-Hub-Signature-256` = `sha256=<hmac>`, un HMAC-SHA256
del **cuerpo crudo** usando `WHATSAPP_APP_SECRET`. El handler recalcula el HMAC sobre el
body sin parsear y lo compara; si no coincide, rechaza la petición. Esto evita que
cualquiera falsifique mensajes.

> Importante: la firma se calcula sobre el **raw body**, así que hay que leer el cuerpo
> como texto antes de hacer `JSON.parse`.

## 5. La ventana de 24 horas

WhatsApp solo permite mensajes **de formato libre** dentro de las **24 horas** posteriores
al último mensaje del cliente. Fuera de esa ventana, solo se pueden enviar **plantillas de
mensaje (HSM) previamente aprobadas** por Meta.

Implicación para este proyecto: las respuestas inmediatas del bot caen dentro de la
ventana (no hay problema). Pero los **seguimientos** (2h está OK; 1 día y 3 días pueden
caer fuera) y los **recordatorios/postventa** requerirán plantillas aprobadas. Por eso el
**envío automático de seguimientos es fase 2**: el MVP solo **calcula** qué seguimientos
tocan; enviarlos vendrá con el cron + las plantillas aprobadas.

## 6. Probar

- **Verify**: `GET https://<tu-url>/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=12345`
  debe responder `12345`.
- **Receive**: envía un WhatsApp al número de prueba; deberías ver el lead creado (en
  `/admin` o en el archivo de datos) y la respuesta automática.

## Checklist

- [ ] `.env.local` con las 4 variables
- [ ] Webhook verificado en el panel de Meta
- [ ] Firma `X-Hub-Signature-256` validada
- [ ] Mensaje de prueba crea lead y recibe respuesta
