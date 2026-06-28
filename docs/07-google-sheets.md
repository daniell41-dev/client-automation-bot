# 07 - Persistencia en Google Sheets

El bot puede guardar los **leads** y la **memoria de conversación** en una hoja de Google
Sheets, en vez de los archivos JSON locales (`data/`). Así la data vive en un lugar que el
equipo puede ver y editar, y cuando un cliente vuelve a escribir, el bot ya tiene memoria:
el motor retoma desde la etapa guardada y la IA recupera el contexto de tono.

Es **opcional**. Sin las variables de Google configuradas, el bot cae automáticamente a los
archivos JSON locales y funciona igual (degradación elegante, como con `GROQ_API_KEY`).

## Cómo funciona

Al recibir un mensaje, el webhook elige el backend con
`createLeadRepository()` / `createSessionRepository()` (`src/core/storage/factory.ts`):

- Si están las 3 variables de Google → usa Google Sheets.
- Si no → usa `JsonLeadRepository` / `SessionJsonRepository`.

La hoja termina con dos pestañas, creadas automáticamente la primera vez:

| Pestaña | Contenido | Columnas |
|---------|-----------|----------|
| `Leads` | Un lead por fila (upsert por `id`) | id, businessSlug, channel, contact, name, serviceId, tentativeDate, state, stage, createdAt, updatedAt, lastInboundAt, followUpsSent, notes |
| `Sesiones` | Una conversación por contacto | businessSlug, contact, channel, updatedAt, history (JSON, últimos 10 turnos) |

## 1. Crear el proyecto y habilitar la API

1. Entra a <https://console.cloud.google.com/> y crea un proyecto (o usa uno existente).
2. En **APIs y servicios → Biblioteca**, busca **Google Sheets API** y habilítala.

## 2. Crear la cuenta de servicio

1. En **APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio**.
2. Ponle un nombre (p. ej. `bot-sheets`) y créala. No necesita roles del proyecto.
3. Abre la cuenta creada → pestaña **Claves → Agregar clave → Crear clave nueva → JSON**.
4. Se descarga un archivo JSON. De ahí saldrán dos valores:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key`  → `GOOGLE_PRIVATE_KEY`

## 3. Crear la hoja y COMPARTIRLA con la cuenta de servicio

1. Crea una hoja en <https://sheets.google.com>. No hace falta crear pestañas a mano: el bot
   crea `Leads` y `Sesiones` con sus encabezados la primera vez.
2. Copia el **ID de la hoja** de la URL:
   `https://docs.google.com/spreadsheets/d/`**`<ESTE_ID>`**`/edit` → `GOOGLE_SHEETS_SPREADSHEET_ID`.
3. **Paso clave (el que más se olvida):** pulsa **Compartir** y comparte la hoja con el
   `client_email` de la cuenta de servicio, con permiso de **Editor**. Sin esto, la API
   responde 403.

## 4. Configurar `.env.local`

```bash
GOOGLE_SHEETS_SPREADSHEET_ID=tu-id-de-la-hoja
GOOGLE_SERVICE_ACCOUNT_EMAIL=bot-sheets@tu-proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

Notas:
- La `private_key` va **entre comillas**; los saltos de línea quedan como `\n` literales
  (el bot los normaliza a saltos reales).
- **Nunca** commitees `.env.local` ni el archivo JSON de la cuenta de servicio (`.env.local`
  ya está en `.gitignore`).

## 5. Verificación

1. Con las variables puestas, corre el webhook (`pnpm dev`) y envía un mensaje de prueba (o
   usa el endpoint de simulación). Debe aparecer:
   - una fila en la pestaña **Leads** con el contacto y su `state`/`stage`,
   - una fila en **Sesiones** con el historial en JSON.
2. Escribe de nuevo con el mismo contacto: la fila del lead se **actualiza** (no se duplica) y
   el historial crece hasta un máximo de 10 turnos.
3. Quita las variables de Google: el bot vuelve a los archivos JSON locales sin errores.

## El simulador (`pnpm sim`)

Por defecto, el simulador usa almacenamiento **local** (memoria/JSON en `data/sim/`) para no
escribir en la hoja real durante las pruebas. Si quieres probar Sheets end-to-end con el
simulador, exporta las variables de Google en tu shell antes de correrlo; aun así, considera
usar una hoja de pruebas aparte para no ensuciar la de producción.
