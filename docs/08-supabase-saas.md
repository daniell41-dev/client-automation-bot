# 08 - SaaS con Supabase: portal, back office y demo

La plataforma escala de bot single-tenant a un SaaS multi-tenant:

| Sección | Ruta | Quién entra | Qué hace |
|---------|------|-------------|----------|
| **Portal** | `/portal` | Clientes (login) | Ve los negocios que el admin le creó y configura servicios, mensajes y persona del bot |
| **Back office** | `/backoffice` | Solo admin | Crea usuarios, crea rubros (plantillas verticales), **crea los negocios de cada cliente desde una plantilla** y ve todos los negocios/leads |
| **Demo** | `/demo` | Público (sin login) | Ve el negocio de ejemplo y prueba el bot en un chat |

**Conceptos:**
- **Rubro** = plantilla vertical (estética, barbería, spa…). La crea el admin con servicios, mensajes y persona por defecto.
- **Negocio** = la copia personalizada que el cliente crea a partir de un rubro asignado. Su `config` (JSONB) es lo que usa el motor del bot.
- El bot resuelve el negocio dinámicamente: primero en Supabase (por `slug` o por `whatsapp_phone_number_id`), y si no hay credenciales cae al registry estático de código.

Todo corre gratis: **Vercel Hobby** (Next.js completo) + **Supabase Free** (Postgres + Auth).

---

## 1. Crear el proyecto en Supabase

1. Entra a <https://supabase.com> y crea una cuenta (gratis, sin tarjeta).
2. **New project**: elige nombre, contraseña de base de datos y la región más cercana.
3. Cuando termine de aprovisionar, ve a **Settings → API** y copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ solo servidor, nunca la expongas

## 2. Aplicar el esquema

En el dashboard, abre **SQL Editor → New query** y pega el contenido completo de
cada migración, **en orden**, ejecutando una por una:

1. `supabase/migrations/0001_schema_inicial.sql` — crea las 6 tablas (`profiles`,
   `rubros`, `asignaciones`, `negocios`, `leads`, `sesiones`), el trigger de
   perfiles y todas las políticas RLS.
2. `supabase/migrations/0002_sesiones_cliente.sql` — el cliente puede LEER las
   sesiones (conversaciones) de sus propios negocios, para la bandeja
   "Conversaciones" del portal.
3. `supabase/migrations/0003_fix_rls.sql` — corrige dos políticas de `0001` que
   comparaban una columna sin calificar contra la subconsulta equivocada (un
   cliente no podía leer sus rubros asignados, y podía crear un negocio en un
   rubro que no le fue asignado). Test de regresión: `pnpm test:rls` (sección
   "Probar las políticas de RLS" de `docs/06-testing-guide.md`).
4. `supabase/migrations/0004_mensajes_procesados.sql` — tabla de idempotencia
   por `message.id` de WhatsApp, para que un reintento de Meta no duplique la
   respuesta del bot (T-05). Solo la usa el bot (service role); sin políticas
   para `authenticated`/`anon`.
5. `supabase/migrations/0005_uso_ia.sql` — tabla y función `registrar_uso_ia`
   para medir el consumo de IA por negocio/día/proveedor (T-07). Igual
   criterio que `0004`: solo el bot la toca.

## 3. Desactivar la confirmación de email

Los usuarios los crea el admin desde el back office (no hay registro público), así que:

1. **Authentication → Sign In / Up → Email**.
2. Desactiva **Confirm email**.

## 4. Configurar `.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> Con estas variables, Supabase pasa a ser el **almacén principal** (leads y sesiones incluidos). Google Sheets queda como opción secundaria y el JSON local como fallback sin credenciales.

## 5. Seed: datos de demostración + primer admin

```bash
pnpm seed:supabase --admin tucorreo@dominio.com TuContraseña123
```

Crea (idempotente, puedes repetirlo):
- Usuario demo (`demo@demo.local`, rol `invitado`) — dueño del negocio de ejemplo.
- Rubro `estetica` con la plantilla de Estética Bella (`es_demo`).
- Negocio `demo-estetica` (`es_demo`) — el que usa `/demo`.
- Tu usuario **admin** para entrar al back office.

## 6. Probar en local

```bash
pnpm dev
```

1. **`/demo`** — sin login: ve el negocio de ejemplo y chatea con el bot.
2. **`/login`** — entra con tu admin → te lleva a `/backoffice`.
3. **Back office → Usuarios**: invita un usuario cliente.
4. **Back office → Negocios**: card "Nuevo negocio" — elegí ese cliente como dueño y un rubro (plantilla); el negocio nace **Pausado**. Esto también le asigna el rubro al cliente automáticamente (no hace falta el paso extra en Asignaciones).
5. Activá el bot desde el detalle del negocio (`/backoffice/negocios/<id>` → "Activar bot").
6. Cierra sesión, entra con el cliente → `/portal`: el negocio ya está ahí; entra a **Catálogo** y **Configuración** para editar servicios, tono y conocimiento de la IA.
7. El bot ya responde con esa config:
   ```bash
   curl -s -X POST http://localhost:3000/api/dev/simulate \
     -H 'Content-Type: application/json' \
     -d '{"message":"Hola","business":"<slug-de-tu-negocio>","from":"prueba-1"}'
   ```
8. Los leads aparecen en el detalle del negocio en el portal (y globalmente en `/backoffice/leads`).

## 7. Desplegar gratis en Vercel

1. Sube el repo a GitHub y entra a <https://vercel.com> (plan Hobby, gratis).
2. **Import Project** → elige el repo. Framework: Next.js (auto).
3. En **Environment Variables** agrega las 3 de Supabase + las que uses de WhatsApp/IA (ver `docs/11-proveedor-ia.md`).
4. Deploy. Cada push a la rama conectada redespliega.

### Conectar WhatsApp en producción

- El webhook queda en `https://<tu-app>.vercel.app/api/webhook/whatsapp`.
- Cada negocio guarda su **phone number ID** desde el portal (Editar → Conexión de WhatsApp); el webhook resuelve el negocio por ese ID.

## 8. Límites de los planes gratis (y mitigaciones)

| Límite | Impacto | Mitigación |
|--------|---------|------------|
| Supabase Free: el proyecto **se pausa tras ~1 semana sin actividad** | El bot deja de responder hasta reactivarlo | Ping periódico externo (p. ej. cron-job.org llamando a `/demo` cada día) o reactivación manual en el dashboard |
| Supabase Free: 500 MB de base | Miles de leads caben de sobra | Nada por ahora |
| Supabase Free: máx. 2 proyectos activos | — | Usa un solo proyecto para todo |
| Vercel Hobby: funciones serverless con timeout de 10 s | El webhook ya responde 200 rápido; la IA suele tardar < 2 s | Cada proveedor tiene un timeout interno de 8 s (`docs/11-proveedor-ia.md`); si se pone lento, usar un modelo más rápido (`*_MODEL` en `.env.local`) |
| Vercel Hobby: sin crons útiles | Los follow-ups automáticos no se auto-envían | Fase futura (worker externo o upgrade) |

## 9. Checklist manual (lo que los tests no cubren)

Los tests unitarios cubren los adaptadores, el resolver y el schema con fakes. Esto se verifica a mano tras el deploy:

- [ ] RLS: un cliente NO ve negocios/leads de otro cliente (probar con 2 cuentas).
- [ ] `/backoffice` redirige a `/portal` si entras con un cliente.
- [ ] `/portal` y `/backoffice` redirigen a `/login` sin sesión.
- [ ] Anónimo solo ve datos demo en `/demo` (y `/api/dev/simulate` en producción solo acepta el negocio demo).
- [ ] Un cliente **no** puede crear un negocio insertando directo contra la API con su sesión (la RLS lo bloquea aunque se salte el formulario) — ver `pnpm test:rls`.
- [ ] Al crear un negocio desde el back office, el cliente dueño lo ve de inmediato en su `/portal` (la asignación del rubro se crea sola).
- [ ] El trigger crea el profile al crear un usuario desde el back office.

## 10. Arquitectura (referencia rápida)

```
Supabase (Postgres + Auth)
├── profiles      ← trigger desde auth.users · role: admin|cliente|invitado
├── rubros        ← plantillas verticales (template JSONB) · es_demo
├── asignaciones  ← user ↔ rubro
├── negocios      ← config JSONB (BusinessConfig) · slug · whatsapp_phone_number_id · es_demo
├── leads         ← escritos por el bot (service role)
└── sesiones      ← memoria de conversación (últimos 10 turnos)

Código
├── src/lib/supabase/          ← clientes: admin (service role), server (cookies), anon, middleware
├── src/core/storage/adapters/supabase/  ← repos del bot tras la interfaz SupabaseDb
├── src/core/storage/factory.ts          ← prioridad Supabase > Sheets > JSON
├── src/core/config-schema.ts            ← validación Zod del BusinessConfig
├── src/businesses/resolve.ts            ← negocio por slug/phone_number_id con fallback a código
├── src/proxy.ts                         ← protege /portal y /backoffice
└── src/app/{portal,backoffice,demo,login}/  ← las tres secciones + auth
```
