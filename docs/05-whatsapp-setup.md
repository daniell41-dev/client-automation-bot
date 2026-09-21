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
| `WHATSAPP_TEMPLATE_APROBACION` | Opcional (T-25). Nombre de la plantilla para avisarle a la dueña fuera de la ventana de 24h — ver §7. |
| `WHATSAPP_TEMPLATE_IDIOMA` | Opcional. Idioma de esa plantilla (default `es`). |

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

Si `WHATSAPP_APP_SECRET` **no está configurado**, el webhook responde `503` y no procesa
nada: sin el secreto no hay forma de distinguir un evento de Meta de uno de cualquier
otro, y la URL del webhook es pública. Para probar sin Meta usá `pnpm sim` o
`/api/dev/simulate`; si aun así necesitás postearle al webhook real a mano en desarrollo,
`WHATSAPP_ALLOW_UNSIGNED=true` lo habilita (nunca en producción).

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

## 7. Plantilla para el aviso a la dueña (T-25)

El aviso de "pedido nuevo, respondé SÍ/NO" **lo inicia el bot**: la dueña no escribió
nada antes. Si su último mensaje al número del negocio tiene más de 24h, Meta rechaza
el texto libre con el código **131047** y el aviso **no se entrega** — la dueña nunca se
entera del pedido y el cliente queda esperando.

Por eso el canal intenta primero el texto libre (completo y sin costo de conversación
cuando la ventana está abierta) y, **solo si Meta lo rechaza por ventana cerrada**,
reintenta con una plantilla aprobada. Sin `WHATSAPP_TEMPLATE_APROBACION` configurada no
hay reintento: el aviso falla igual que antes y queda en el log.

### Texto a cargar en Meta

En **WhatsApp Manager → Plantillas de mensajes → Crear plantilla**:

- **Nombre**: `aviso_pedido_aprobacion` (el mismo que pongas en `WHATSAPP_TEMPLATE_APROBACION`)
- **Categoría**: `Utility` (no `Marketing` — es una notificación transaccional de algo
  que el cliente pidió; `Marketing` se aprueba peor y cuesta más)
- **Idioma**: Español (`es`)
- **Cuerpo**:

```
Tenés un pedido nuevo en {{1}}.
Cliente: {{2}}
Pedido: {{3}}
Respondé SÍ para aceptarlo o NO para rechazarlo.
```

- **Ejemplos** (Meta los pide para aprobar): `{{1}}` = `Estética Bella`,
  `{{2}}` = `Laura Pérez`, `{{3}}` = `2x Harina 1 Kg · 1x Aceite 1 Lt · Total: $45.000`

La aprobación suele tardar entre unos minutos y un día.

### Detalles que importan

- **Los parámetros no admiten saltos de línea** ni tabs ni más de 4 espacios seguidos:
  Meta rechaza el envío entero. El adaptador ya los aplana a `·` (`aplanarParametro`),
  por eso el ejemplo de `{{3}}` va en una sola línea.
- **La plantilla lleva menos información que el texto libre**: no incluye las señales de
  riesgo del comprobante ni las alertas de stock bajo. Es a propósito — lleva lo mínimo
  para decidir, y cuando la dueña responde SÍ/NO **se reabre la ventana de 24h**, así que
  el resto de la conversación vuelve a ser texto libre.
- **El aviso informativo de cita confirmada no usa plantilla**: no espera respuesta y no
  bloquea nada, así que si cae fuera de la ventana simplemente no se envía. Si en algún
  momento se quiere cubrir, hace falta registrar una plantilla aparte (el texto fijo es
  distinto).

## Checklist

- [ ] `.env.local` con las 4 variables
- [ ] Webhook verificado en el panel de Meta
- [ ] Firma `X-Hub-Signature-256` validada
- [ ] Mensaje de prueba crea lead y recibe respuesta
- [ ] Plantilla `aviso_pedido_aprobacion` aprobada en Meta y su nombre en
      `WHATSAPP_TEMPLATE_APROBACION` (§7)
