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

Necesitás una cuenta personal de Facebook — es solo el login del panel de desarrolladores,
no hace falta usarla como red social.

1. Andá a <https://developers.facebook.com/> → **Mis aplicaciones** → **Crear app**.
2. **Detalles de la aplicación**: ponele un nombre.
   ⚠️ El nombre **no puede contener** `WhatsApp`, `Meta`, `Facebook`, `Insta` ni `Gram` —
   Meta rechaza la app por política de marca y hay que empezar de nuevo.
3. **Casos de uso**: elegí **"Otros"** en el filtro de la izquierda y, de la lista,
   **"Crea una aplicación sin un caso de uso"** (el ícono con el círculo tachado). WhatsApp
   ya no aparece como "caso de uso" en este wizard — se agrega después, como producto.
   No uses la opción "Otro (This option is going away soon)": Meta avisa que la va a
   eliminar.
4. **Empresa**: seleccioná un portafolio comercial existente o creá uno nuevo. **No hace
   falta que esté verificado todavía** — alcanza con conectarlo. El nombre del portafolio
   es puramente administrativo y se puede renombrar después desde
   `business.facebook.com` → Configuración del negocio → Información de la empresa, sin
   afectar nada de lo ya configurado.
5. **Requisitos** e **Información general**: revisá y confirmá → **Crear aplicación**.

### Agregar el producto WhatsApp

1. Ya con la app creada, **"Añadir casos de uso"** → marcá **"Conecta con los clientes a
   través de WhatsApp"** → **Guardar** → **Añadir a la aplicación** (el aviso de "pasos
   adicionales" es solo para cuando publiques la app; no aplica todavía).
2. En el panel de la app, entrá a **"Personaliza el caso de uso Conectar con los clientes
   a través de WhatsApp"** → elegí tu portafolio → **Continuar**. Vas a llegar a
   **"Información general"** con **"Integrar con API"** ya seleccionado (es lo que
   necesita el bot; la otra opción, "Hazte socio", es para otro tipo de integración).
3. Entrá a **"Paso 1. Pruébala"**. Ahí Meta te da, sin costo:
   - Un **número de prueba** (de Meta, no tuyo)
   - Su **Phone Number ID** (se ve, por ejemplo, en la URL del `curl` de ejemplo que
     muestra esa misma pantalla)
   - Un botón para **generar un token de acceso temporal** (dura 24h)
4. En **"Destinatario"**, agregá tu propio WhatsApp — Meta te va a mandar un código de
   verificación por WhatsApp para confirmarlo. **Mientras la app no esté publicada, el
   número de prueba solo puede intercambiar mensajes con los números que agregues acá**
   (hasta 5).
5. Copiá `WHATSAPP_PHONE_NUMBER_ID` (el Phone Number ID) y `WHATSAPP_ACCESS_TOKEN` (el
   token generado).
6. `WHATSAPP_APP_SECRET`: **Configuración de la aplicación → Información básica →
   "Clave secreta de la aplicación" → Mostrar**. Si esa página te carga en blanco, es
   casi siempre un bloqueador de anuncios/privacidad (uBlock, Brave Shields, etc.)
   interfiriendo con `fbcdn.net` — desactivalo para `developers.facebook.com` o probá en
   una ventana de incógnito.
7. `WHATSAPP_VERIFY_TOKEN`: **te lo inventás vos** (cualquier texto, ej.
   `nexo-bot-2026`). Solo tiene que coincidir entre tu `.env.local` y el panel de Meta.

## 2. Exponer el webhook con una URL pública HTTPS

Meta necesita una URL pública. En desarrollo, usa un túnel:

```bash
pnpm dev                      # arranca Next en http://localhost:3000
# en otra terminal:
ngrok http 3000               # o: cloudflared tunnel --url http://localhost:3000
```

Tu webhook será: `https://<tu-tunel>/api/webhook/whatsapp`. En producción, la URL de
Vercel u otro host.

### Cargar el webhook en Meta

En **"Paso 2. Configuración de producción" → "Configurar Webhooks"**:

- **URL de devolución de llamada**: `https://<tu-url>/api/webhook/whatsapp`
- **Identificador de verificación**: el mismo valor que `WHATSAPP_VERIFY_TOKEN`
- **Verificar y guardar**

Debajo, en **"Campos de webhook"**, confirmá que **`messages`** esté suscrito (Meta lo
suele activar solo, junto con otros campos como `message_template_status_update`).

⚠️ **Este paso NO alcanza por sí solo** — ver el problema más común en la sección de abajo.

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

## 8. Problemas comunes al conectar por primera vez

Encontrados armando la conexión real por primera vez — quedan acá para no repetir la
misma vuelta la próxima vez que se dé de alta un número.

### El mensaje real nunca llega al webhook (el más importante)

**Síntoma**: la verificación del webhook (`hub.challenge`) da `200 OK`, la URL está bien
escrita, mandás un WhatsApp real al número de prueba y **no pasa nada** — ni en la
terminal de `pnpm dev` ni en el inspector de ngrok (`http://127.0.0.1:4040`). Sin
embargo, en Meta, dentro de "Paso 1. Pruébala → Comprobar webhooks de prueba", el evento
`messages` con tu texto real **sí aparece** — Meta lo procesó, solo que no te lo mandó.

**Causa**: cargar la URL del webhook en la app **no suscribe automáticamente** tu cuenta
de WhatsApp Business a esa app. Son dos cosas separadas en la API de Meta. La cuenta de
prueba puede terminar suscrita, por defecto, a una app interna de Meta
(`WA DevX Webhook Events 1P App`) en vez de a la tuya — por eso el evento se genera pero
nunca sale hacia tu servidor.

**Diagnóstico** (con el `WHATSAPP_ACCESS_TOKEN` vigente y el ID de tu WABA — se ve en el
JSON de "Comprobar webhooks de prueba", campo `entry[0].id`):

```bash
curl -X GET "https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps?access_token=<TOKEN>"
```

Si la respuesta trae una app que no es la tuya (o `{"data":[]}`), ahí está el problema.

**Arreglo**:

```bash
curl -X POST "https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps?access_token=<TOKEN>"
```

Responde `{"success":true}`. No hace falta sacar la otra app suscrita — una WABA puede
tener varias apps suscritas a la vez, cada una recibe los eventos en su propio webhook.

> En **Windows con PowerShell**, `curl` es un alias de `Invoke-WebRequest` y no entiende
> `-X`. Usá `curl.exe` (con la extensión) para forzar el binario real.

### El token de acceso temporal vence a las 24h

Si un `curl` empieza a devolver `"Error validating access token... Session has expired"`,
generá uno nuevo desde "Paso 1. Pruébala → Generar Identificador", actualizá
`WHATSAPP_ACCESS_TOKEN` en `.env.local` y reiniciá `pnpm dev` (las env vars no se
recargan solas). Para no repetir esto cada 24h en desarrollo activo, ver "Próximos pasos".

### El número de prueba no tiene ningún negocio asociado

El webhook puede estar perfecto y aun así el bot no contesta: si `phone_number_id` (el
que llega en el payload real, **no necesariamente igual al que aparece truncado en el
`curl` de ejemplo de la UI de Meta** — copiá el valor completo) no está mapeado a ningún
negocio, `resolveBusinessByPhoneNumberId` devuelve `null` y el mensaje se descarta en
silencio (a propósito — ver `src/app/api/webhook/whatsapp/route.ts`).

Para probar en local sin Supabase, en `src/businesses/registry.ts`:

```ts
const PHONE_NUMBER_ID_TO_SLUG: Record<string, string> = {
  "<phone_number_id real de tu número de prueba>": "estetica-bella",
};
```

**Esto es solo para probar en tu máquina — nunca se commitea.** Es un ID de tu propio
sandbox de Meta, no un dato del proyecto; si lo subís a una rama compartida, revertilo
antes de abrir el PR.

### `Error procesando webhook de WhatsApp` con `getaddrinfo ENOTFOUND ...supabase.co`

**Síntoma**: el webhook recibe el mensaje real (confirmado en el inspector de ngrok y en
"Comprobar webhooks de prueba" de Meta) pero la terminal de `pnpm dev` tira un error de
DNS apenas intenta resolver el negocio — nunca llega ni a mirar `registry.ts`.

**Causa**: `.env.local` tiene `NEXT_PUBLIC_SUPABASE_URL` y/o `SUPABASE_SERVICE_ROLE_KEY`
configuradas (ver `src/lib/supabase/admin.ts`), así que `resolveBusinessByPhoneNumberId`
intenta Supabase **antes** de caer al `registry.ts` local — y esa llamada no tiene
`try/catch`, así que si el proyecto de Supabase no resuelve (pausado, borrado, URL mal
copiada), el error se propaga hasta el `catch` general del webhook y aborta todo el
procesamiento del mensaje, sin llegar nunca al fallback.

**Arreglo rápido** (para seguir probando solo con el negocio local): comentar o borrar
**las dos** variables —`NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`— de
`.env.local` y reiniciar `pnpm dev`. Con ninguna de las dos presentes,
`createAdminClient()` devuelve `null` y el código usa `registry.ts` directo, sin intentar
Supabase. Si lo que hace falta es la base real, el problema está del lado de Supabase
(proyecto pausado/borrado o URL con un typo), no del bot.

## Próximos pasos

Lo que falta para pasar de "probé con el número de prueba de Meta" a "un negocio real
usando esto":

- [ ] **Verificación de negocio en Meta** — no hace falta empresa constituida: un
      trabajador independiente puede verificarse con su RUT de persona natural (o el
      registro tributario equivalente en otros países). Se puede seguir probando sin
      esto (con el límite de ~250 conversaciones iniciadas por el negocio cada 24h, que
      alcanza de sobra para 1-2 negocios de prueba).
- [ ] **Número dedicado por negocio real** — el número del negocio no puede tener
      WhatsApp normal instalado; el número de la dueña que recibe los avisos de
      aprobación **tiene que ser un número distinto** al del negocio (si no, el webhook
      no puede distinguir cliente de dueña — ver `notifyPhoneNumber` en
      `src/core/handle.ts`).
- [ ] **Token de acceso permanente** — el token temporal vence cada 24h. Para no
      regenerarlo a mano, hace falta crear un **Usuario del sistema** en el portafolio
      comercial y generar un token de sistema (no vence).
- [ ] **Publicar la app** — Meta pide, antes de publicarla: ícono (1024×1024), URL de
      política de privacidad y categoría. No es necesario mientras se prueba solo con
      números agregados a mano a la lista de destinatarios.
- [ ] **Plantilla `aviso_pedido_aprobacion` aprobada** (§7) — sin esto, el aviso a la
      dueña sigue funcionando solo dentro de la ventana de 24h.
- [ ] **Wompi contra su sandbox real** — el módulo de pagos (T-24.5) está armado y
      testeado con fixtures, pero nunca se probó contra una cuenta de comercio real de
      Wompi.

## Checklist

- [ ] `.env.local` con las 4 variables
- [ ] Webhook verificado en el panel de Meta
- [ ] App suscrita al WABA (`subscribed_apps` — ver §8, no pasa sola)
- [ ] Firma `X-Hub-Signature-256` validada
- [ ] Mensaje de prueba crea lead y recibe respuesta
- [ ] Plantilla `aviso_pedido_aprobacion` aprobada en Meta y su nombre en
      `WHATSAPP_TEMPLATE_APROBACION` (§7)
