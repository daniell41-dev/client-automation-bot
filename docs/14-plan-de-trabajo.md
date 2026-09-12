# 14 - Plan de trabajo — de la demo al SaaS "Nexo"

> Contrato de trabajo entre el dueño del repo y el agente.
> Las decisiones de la sección 2 están **cerradas**: no re-discutirlas, ejecutarlas.
> Las convenciones de la sección 3 son **obligatorias**.
>
> Versión 2 (sept-2026): alcance reducido a **un solo rubro (estética)** y a un
> circuito mínimo admin → cliente. Ver el registro de cambios al final.

---

## 1. Dónde estamos

- **`main` contiene solo el scaffold de `create-next-app`.** Todo el proyecto real
  (bot, portal, back office, Supabase, IA) vive en `develop`.
- Ya existe y funciona: arquitectura de puertos y adaptadores, cadena de respaldo de
  IA (Gemini → Groq → Cerebras → custom), multi-tenancy en Supabase con RLS, modo
  agente con JSON validado por Zod, 322 tests en Vitest, y los scripts `pnpm sim`,
  `pnpm ai:doctor`, `pnpm seed:supabase`.
- El diseño hi-fi está en el bundle `design_handoff_flujo_bot_whatsapp/`
  (README con tokens y mapeo a Supabase, TASKS con 35 tareas, 18 capturas).
  **Todavía no está publicado en el repo**: `docs/09-diseno-nexo.md` es una copia
  vieja del README a la que le faltan los modales, el detalle de negocio y los
  menús de fila. Lo arregla T-19.

---

## 2. Decisiones de arquitectura (cerradas)

### 2.1 No hay backend separado
Las **Server Actions son la API**. `src/app/portal/actions.ts` y
`src/app/backoffice/actions.ts` cumplen el rol de un REST: endpoint generado por
Next, ejecución en servidor, sesión del usuario y RLS activas, tipos de punta a punta.

No crear un repo aparte, ni Express, ni tRPC. Se reevalúa solo cuando aparezca
un segundo consumidor (app móvil nativa, integración de terceros) o un proceso
largo (cron de seguimientos). En ese caso se expone `/api/v1` encima de las
mismas funciones de `core/`, que ya es independiente de Next.

### 2.2 Una sola base de datos
Un único proyecto de Supabase. Clientes y negocios son una relación 1:N, no
dominios independientes: separarlos costaría integridad referencial, joins y RLS
coherente, sin ganar nada. Además el free tier da solo 2 proyectos activos y el
segundo se reserva para staging.

### 2.3 Un solo rubro en la v1: estética
La v1 se construye para **un rubro: estética y belleza** — el que ya está en la
demo (uñas, depilación, limpieza facial, pestañas). Un solo vertical, campos
fijos, cero abstracción especulativa.

Esto **no** cambia el principio: sigue prohibido cualquier `if (rubro === "...")`
dentro de `core/`. Lo que cambia es que no se construye todavía la maquinaria para
soportar rubros con formas distintas. La decisión de cómo se hará (sección 2.4)
queda escrita y aplazada, no descartada.

### 2.4 Catálogo multi-rubro: escrito, aplazado hasta el segundo rubro
Cuando entre el segundo rubro (gastronomía, comercio…), el `Service` del core
mantiene los campos que el motor necesita en cualquier vertical y todo lo
específico va en un saco `extras`:

```ts
export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  disponible?: boolean;
  reservable?: boolean;
  durationMinutes?: number;
  /** Campos propios del rubro: { stock: 12, foto: "url", receta: "..." } */
  extras?: Record<string, string | number | boolean>;
}
```

La plantilla del rubro (`rubros.template.catalogo`) define las **etiquetas** de los
campos base y el **schema** de los extras:

```jsonc
{
  "labelSingular": "Plato",
  "labelPlural": "Menú",
  "camposBase": { "name": "Plato", "price": "Precio", "description": "Descripción" },
  "camposExtra": [
    { "key": "foto",      "label": "Foto",      "tipo": "imagen" },
    { "key": "categoria", "label": "Categoría", "tipo": "texto" },
    { "key": "stock",     "label": "Stock",     "tipo": "numero", "requerido": false }
  ],
  "citas": { "tipo": "reserva_mesa" }
}
```

Dos cosas a tener en cuenta el día que se implemente (T-09/T-10):
- `durationMinutes` pasa de obligatorio a opcional, y **el motor lo usa**:
  `calendar-event.ts` calcula el fin del evento con él y la plantilla `serviceInfo`
  lo muestra. No es solo un cambio de tipos.
- `rubros.template` hoy se valida con `businessConfigSchema`, y Zod **descarta en
  silencio las claves desconocidas**: si se guarda `catalogo` dentro del template
  sin un schema propio, se pierde al leerlo. Hace falta un schema de plantilla
  (BusinessConfig + `catalogo`), no reusar el de negocio.

### 2.5 Tono y conocimiento de la IA
Ya modelado, no inventar estructuras nuevas:
- **Tono** → `PersonaConfig { name, tone, language }` en `core/types.ts`, por canal.
  El segmented "Cercano / Neutral / Formal" del diseño escribe tres presets de
  texto en `tone`. El input "Nombre del bot" escribe en `name`.
- **Conocimiento** → `ai.knowledge` (textarea libre), que el prompt combina con
  `services[]` (catálogo) y `ai.reglas[]` (keyword → respuesta, con prioridad
  sobre la IA).
- La **plantilla del rubro** aporta los defaults; el negocio los sobreescribe.

### 2.6 Quién crea los negocios: el administrador
**El administrador**, desde el back office, con un solo modal
(`14-modal-nuevo-negocio.png`): nombre del negocio + **cliente dueño** + **rubro
plantilla** + WhatsApp + plan. El negocio nace `Pausado`.

Consecuencias que esto cierra:
- Se **elimina** la creación de negocios desde el portal (`/portal/negocios/nuevo`
  y `crearNegocio` en `portal/actions.ts`). El portal solo configura lo que ya existe.
- Al crear el negocio, la misma action **crea también la fila de `asignaciones`**
  (cliente ↔ rubro) si no existe. El admin escribe por la política `negocios_admin`
  y no la necesita para sí mismo, pero la asignación es lo que le da al cliente
  acceso coherente a su rubro y lo que hace que `negocios_own` siga significando algo.

### 2.7 Qué puede tocar el cliente en la v1
Exactamente tres cosas, y nada más:
1. **Servicios**: nombre, precio, descripción, categoría y disponibilidad.
2. **El bot**: nombre y tono (Cercano / Neutral / Formal).
3. **Conocimiento del negocio**: el textarea libre con el que la IA responde lo que
   no está en el catálogo (horarios especiales, medios de pago, dirección).

Las secciones **Citas y reservas**, **Respuestas y flujos** y **Conversaciones** se
**ocultan del menú del portal** (T-16). El código se queda en el repo: no se borra
nada, solo deja de ofrecerse. Una sección a medio terminar frente a un cliente que
paga es peor que una sección que todavía no existe.

Ojo con el efecto colateral: hoy el textarea de conocimiento vive **dentro** de
"Respuestas y flujos". Al ocultar esa sección hay que mover ese campo a
Configuración (T-17), o el cliente se queda sin la pieza que más mejora las
respuestas del bot.

### 2.8 Estado del cliente: Server Components, no React Query
Todo el portal y el back office siguen con Server Components + Server Actions +
`revalidatePath`. **No instalar TanStack Query** hasta que exista una pantalla con
polling real (la bandeja de Conversaciones en vivo es la única candidata, y está
fuera del alcance de la v1). El caching que hace falta hoy es en el servidor, no en
el navegador (ver T-06).

### 2.9 Notion
GitHub Issues + GitHub Projects es la única fuente de verdad de las tareas.
No sincronizar con Notion.

---

## 3. Cómo trabaja el agente

1. **Una rama por tarea**, desde `develop`: `feat/T-03-rls-fix`, `fix/T-05-webhook-ack`,
   `docs/T-19-handoff`. **Un PR por tarea**, nunca agrupar. Hasta que T-01 publique
   `main`, todas las ramas salen de `develop` y vuelven a `develop`.
2. **Test primero.** Todo módulo nuevo o modificado en `core/` lleva su `.test.ts`
   en Vitest. `pnpm test` tiene que pasar antes de abrir el PR.
3. **`core/` no importa `next/*` ni SDKs de terceros.** Si una tarea parece exigirlo,
   la solución es un adaptador, no una excepción.
4. **Comentarios en español explicando el _por qué_**, no el _qué_. Seguir el estilo
   de los archivos existentes (`resilient.ts` es la referencia).
5. **Toda escritura a `negocios.config` o `rubros.template` pasa por Zod** antes de
   tocar la base.
6. **Antes del PR:** `pnpm test` + `pnpm exec tsc --noEmit` + `pnpm lint` + `pnpm build`.
7. Si una tarea resulta más grande de lo descrito, **parar y comentar en el issue**
   antes de escribir código.

---

## 4. Backlog

Cada tarea trae *Criterio de aceptación* (lo que hace pasar el PR) y *Cómo lo pruebo yo*
(lo que hace el humano en el navegador antes de aprobar).

Los números de tarea son **estables**: si una tarea se aplaza no se renumera el resto,
para no romper los issues que ya existan.

---

### Fase 0 — Desbloquear (nada avanza sin esto)

**T-01 · Publicar `develop` en `main`**
Revisar y mergear el PR abierto. Dejar `main` como la rama que refleja el proyecto real.
Actualizar el `README.md` de la raíz (hoy es el de `create-next-app`) con: qué es el
proyecto, cómo levantarlo, y el índice de `docs/`.

- **Criterio:** `main` tiene el código de `develop`. `pnpm install && pnpm test && pnpm build` pasa en limpio.
- **Cómo lo pruebo yo:** clono el repo en una carpeta nueva, `pnpm install`, `pnpm sim "hola"` y veo la conversación en consola.

---

**T-02 · `AGENTS.md` real**
El actual tiene 4 líneas sobre Next.js. Reescribirlo con: el principio de `core/`
sin dependencias de framework, la exigencia de tests en Vitest, el estilo de
comentarios, la validación con Zod al escribir, y un enlace a este plan.

- **Criterio:** `AGENTS.md` cubre los 7 puntos de la sección 3. `CLAUDE.md` sigue siendo `@AGENTS.md`.
- **Cómo lo pruebo yo:** lo leo. Si un desarrollador nuevo puede seguir la convención sin preguntarme, está bien.

---

**T-03 · Arreglar dos bugs de RLS** (migración `0003_fix_rls.sql`)

En `0001_schema_inicial.sql` hay dos referencias de columna sin calificar que
Postgres resuelve contra la tabla interna de la subconsulta:

```sql
-- rubros_asignados: `id` resuelve a asignaciones.id, no a rubros.id
--   → la condición es a.rubro_id = a.id → nunca es verdad
--   → un cliente NO puede leer los rubros que tiene asignados.
where a.rubro_id = id and a.user_id = auth.uid()

-- negocios_own (with check): `rubro_id` resuelve a asignaciones.rubro_id
--   → la condición es a.rubro_id = a.rubro_id → siempre verdad
--   → un cliente puede crear un negocio en un rubro que NO le fue asignado.
where a.rubro_id = rubro_id and a.user_id = auth.uid()
```

Arreglo: calificar con el nombre de la tabla (`rubros.id`, `negocios.rubro_id`).

El segundo es un hueco de seguridad real: desde la UI no se explota (la action
chequea la asignación antes de insertar), pero ese chequeo vive en el servidor de
Next — con la anon key y una sesión válida se puede insertar directo contra
PostgREST. RLS es justamente lo que debe frenar ese camino.

- **Criterio:** migración `0003` + test de integración con dos usuarios que demuestra
  que (a) el cliente A lee su rubro asignado, (b) el cliente A **no** puede crear un
  negocio en un rubro asignado solo a B, (c) A **sí** puede crear en el suyo (que el
  fix no rompa el caso legítimo). El test se salta solo si no hay base de pruebas
  configurada, para que `pnpm test` siga verde en cualquier máquina.
- **Cómo lo pruebo yo:** aplico `0003` en el SQL Editor, entro con una cuenta cliente
  y abro **`/portal/negocios/nuevo`** (no `/portal`, que lista negocios, no rubros):
  antes dice "No tenés rubros asignados", después aparece el rubro.
  *Nota:* esa página desaparece en T-11; a partir de ahí la verificación manual es
  crear el negocio desde el back office y confirmar que el cliente lo ve.

---

**T-04 · Sanear los modelos de IA**
Correr `pnpm ai:doctor` y corregir `src/core/ai/presets.ts` con los IDs reales que
devuelve el diagnóstico. Verificar en particular que `gemini-3.5-flash-lite` exista
(el catálogo público solo menciona 3.1 Flash-Lite). `CEREBRAS_API_KEY` ya está en
`.env.example`.

Nota de límites vigentes a sept-2026, para elegir el orden de la cadena:
| Proveedor | Límite gratis | Riesgo |
|---|---|---|
| Gemini 3.1 Flash-Lite | 15 RPM · 1.000 req/día · por proyecto | Los modelos Pro ya no son gratis |
| Groq `gpt-oss-20b` | 30 RPM · 1.000 req/día · **200.000 tokens/día** · por organización | El tope de tokens es el que muerde primero |
| Cerebras | 1M tokens/día · 30 RPM · **contexto 8K** | 8K no alcanza para modo agente con catálogo grande |

- **Criterio:** `pnpm ai:doctor` pasa en verde para los tres proveedores, incluido el paso 4 (`runAgent` real).
- **Cómo lo pruebo yo:** corro `pnpm ai:doctor` y veo tres OK. Después `pnpm sim "hola, qué servicios tienen"` y la respuesta se lee reformulada, no como plantilla cruda.

---

**T-19 · Publicar el handoff de diseño en el repo**
Copiar el bundle a `docs/design/`: `README.md`, `TASKS.md` y `screenshots/` (18 png).
Retirar `docs/09-diseno-nexo.md`, que es una copia vieja del mismo README (le faltan
los modales, el detalle de negocio y los menús de fila), dejando en su lugar un
puntero a la ubicación nueva. Actualizar el índice de `docs/00-overview.md`.

- **Criterio:** `docs/design/README.md` es idéntico al del bundle y las 18 capturas están versionadas. Ningún doc apunta ya a `09-diseno-nexo.md`.
- **Cómo lo pruebo yo:** abro `docs/design/screenshots/14-modal-nuevo-negocio.png` desde GitHub y se ve.

---

### Fase 1 — El circuito de la v1 (admin crea → cliente configura)

Es el corazón del producto reducido: **yo creo el negocio y se lo asigno a su dueña;
ella entra y ajusta tono, conocimiento y servicios; el bot responde con eso.**

---

**T-11 · Modal "Nuevo / Editar negocio" en el back office**
Implementar `14-modal-nuevo-negocio.png`: nombre, **cliente dueño** (lista con radio),
**rubro plantilla** (con preview de los campos que hereda), WhatsApp, plan. El negocio
nace `Pausado` y con 0 leads.

Además, en la misma tarea (decisión 2.6):
- `crearNegocio` se **mueve** a `backoffice/actions.ts` y crea también la fila de
  `asignaciones` (cliente ↔ rubro) si no existe, de forma idempotente.
- Se **elimina** `/portal/negocios/nuevo` y la tarjeta punteada "Agregar otro negocio"
  del portal.
- Se agregan `actualizarNegocio` y `eliminarNegocio` (el borrado, con confirmación:
  ver T-13).

- **Criterio:** el bloque "Campos que hereda este negocio" se actualiza al cambiar de
  rubro. El negocio creado aparece en la tabla como Pausado. El cliente dueño lo ve
  en su `/portal` sin ningún paso manual extra en la base. El portal ya no ofrece
  crear negocios.
- **Cómo lo pruebo yo:** entro como admin a `/backoffice/negocios`, creo "Estética Bella"
  con la plantilla de estética y se lo asigno a una cuenta cliente; cierro sesión, entro
  con esa cuenta y el negocio está ahí con su catálogo.

---

**T-16 · Reducir el portal a lo que el cliente puede tocar**
Ocultar del menú lateral **Citas y reservas**, **Respuestas y flujos** y
**Conversaciones** (decisión 2.7). El cliente queda con Resumen, Catálogo y
Configuración. No borrar el código de esas secciones ni sus rutas: solo dejan de
aparecer en la navegación, detrás de una constante de alcance en un único lugar
para poder reactivarlas sin buscar por todo el repo.

- **Criterio:** el sidebar del portal muestra exactamente tres ítems. Ninguna otra
  pantalla enlaza a las secciones ocultas (el Resumen tiene links a Conversaciones y
  a la checklist: hay que revisarlos). `pnpm build` sin rutas huérfanas.
- **Cómo lo pruebo yo:** entro al portal como cliente y no veo forma de llegar a Citas, Respuestas ni Conversaciones.

---

**T-17 · Configuración = nombre del bot + tono + conocimiento**
Mover el textarea "Información del negocio" (`ai.knowledge`) desde "Respuestas y
flujos" a la pantalla de Configuración, junto al nombre del bot y el segmented de
tono que ya existen. Es el único punto donde el cliente le enseña algo al bot que no
sea un precio.

- **Criterio:** guardar el textarea persiste en `config.ai.knowledge` (validado con
  Zod, como todo lo demás) y el bot lo usa en la siguiente respuesta. El toggle
  "Cerebro con IA" (`ai.enabled`) viaja con él.
- **Cómo lo pruebo yo:** escribo "Aceptamos transferencia y Zelle" en Configuración, guardo, y en el chat de prueba le pregunto al bot cómo puedo pagar: lo responde.

---

**T-18 · Catálogo alineado al diseño**
Revisar el editor de Catálogo contra `04-catalogo.png`: lista con toggle de
disponibilidad, card "Editar producto" (nombre, precio, categoría, descripción) y
preview de WhatsApp en vivo. Los campos ya existen; la tarea es cerrar la brecha
visual y de interacción, y que el label de la sección salga del rubro
("Servicios" para estética).

- **Criterio:** la pantalla se corresponde con la captura. Agregar y eliminar un
  servicio funciona. El preview refleja el cambio al instante.
- **Cómo lo pruebo yo:** agrego "Uñas esculpidas · $80.000", lo veo en el preview, guardo, y el bot lo ofrece en `pnpm sim`.

---

### Fase 2 — Que el bot aguante tráfico real

**T-05 · El webhook responde 200 antes de procesar**
Hoy `POST /api/webhook/whatsapp` hace todo en línea (resolver negocio, llamar IA,
guardar lead, enviar respuesta) y recién ahí contesta a Meta. Meta espera un ACK
rápido: si tarda, **reintenta el mismo mensaje y el bot responde dos veces**.
Además `runAgent` tiene timeout de 20s y Vercel Hobby corta a 10s.

Arreglo: validar la firma, devolver `200` inmediatamente, y procesar el mensaje
dentro de `after()` de `next/server`.

- **Criterio:** el handler responde en menos de 100 ms. Test que verifica que el
  procesamiento ocurre después del ACK. Idempotencia por `message.id` para que un
  reintento de Meta no duplique la respuesta.
- **Cómo lo pruebo yo:** `POST` al webhook con un payload de ejemplo dos veces con el mismo `message.id` y confirmo que el lead se creó una sola vez.

---

**T-06 · Cachear la resolución del negocio**
`resolveBusinessByPhoneNumberId` hace un `select` a Supabase **por cada mensaje
entrante de cada negocio**, para leer una config que cambia una vez por semana.
Un negocio con 500 mensajes/día son 500 lecturas evitables.

Cachear con `unstable_cache`/`cacheLife` de Next, con invalidación explícita desde
`guardarConfigParcial` y desde las actions del back office que tocan el negocio.

- **Criterio:** test que demuestra que N mensajes del mismo negocio hacen 1 lectura.
  Guardar en el portal invalida el caché y el siguiente mensaje usa la config nueva.
- **Cómo lo pruebo yo:** cambio el nombre del bot en Configuración, mando un mensaje por `pnpm sim` y el bot ya se presenta con el nombre nuevo.

---

**T-07 · Tabla `uso_ia` y medición de consumo**
Sin esto no hay forma de saber cuándo hay que pagar.

```sql
create table public.uso_ia (
  negocio_id uuid references negocios(id) on delete cascade,
  dia date not null,
  proveedor text not null,
  llamadas int not null default 0,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  fallbacks int not null default 0,   -- veces que cayó a plantilla
  primary key (negocio_id, dia, proveedor)
);
```

Registrar desde `ResilientProvider`: cada llamada, cada paso al siguiente proveedor
y cada caída a plantilla.

- **Criterio:** después de correr `pnpm sim` varias veces, la tabla tiene filas coherentes.
- **Cómo lo pruebo yo:** consulto la tabla en el SQL Editor de Supabase y veo el consumo del día.

---

**T-08 · `negocio_id` como clave foránea en `leads` y `sesiones`**
Hoy se enlazan por `business_slug` (texto). Si el slug cambia quedan huérfanos; si
se borra el negocio, quedan registros. Agregar `negocio_id uuid references
negocios(id) on delete cascade`, con backfill, manteniendo el slug como columna de
conveniencia para el motor.

- **Criterio:** migración con backfill. Borrar un negocio de prueba arrastra sus leads y sesiones.
- **Cómo lo pruebo yo:** creo un negocio, genero un lead por `pnpm sim`, borro el negocio y confirmo que el lead desapareció.

---

### Fase 3 — Validación y UX de formularios

**T-12 · Zod en los formularios de la v1**
Los schemas ya existen en `core/config-schema.ts` pero solo se usan al escribir en
la base. Exportar los sub-schemas y validar también en el cliente antes de enviar,
con el mismo objeto Zod en ambos lados. Alcance: los formularios que sobreviven a
T-16 (Catálogo, Configuración) y el modal de negocio del back office.

- **Criterio:** cada formulario muestra errores por campo. La Server Action valida de
  nuevo (nunca confiar en el cliente).
- **Cómo lo pruebo yo:** dejo un campo requerido vacío y veo el error sin que se recargue la página; mando el mismo payload por consola saltándome el formulario y la acción lo rechaza igual.

---

**T-13 · Confirmación de borrado y toasts**
Modal de confirmación antes de eliminar negocio, usuario o rubro, con aviso de
impacto ("este rubro tiene 2 negocios asociados"). Toasts de éxito y error.

- **Criterio:** ningún borrado ocurre sin confirmación explícita.
- **Cómo lo pruebo yo:** intento borrar un rubro con negocios y veo el aviso antes de confirmar.

---

### Fase 4 — Automatización

**T-14 · Plantilla de PR e instalación de la GitHub Action**
`.github/pull_request_template.md` con la estructura de la sección 5, y
`/install-github-app` para habilitar `@claude` en issues y PRs. Incluir aquí el
workflow que corre el test de RLS de T-03 contra un Postgres de servicio.

- **Criterio:** un PR de prueba trae la sección "Cómo probarlo" completa y el test de RLS corre en CI.

---

**T-15 · Alarma de deprecación de modelos**
GitHub Action programada (lunes y jueves) que corre `pnpm ai:doctor`. Si un
proveedor falla, abre un issue con el error exacto y el catálogo de modelos
disponibles para esa key.

- **Criterio:** forzando un modelo inválido en el entorno del workflow, se abre el issue.
- **Cómo lo pruebo yo:** disparo el workflow a mano con un `GROQ_MODEL` inexistente y reviso el issue creado.

---

### Aplazadas hasta el segundo rubro

No empezar hasta que exista un negocio real de otro rubro. Diseño en la sección 2.4.

- **T-09 · `Service.extras` + schema en la plantilla del rubro.**
- **T-10 · Formulario de catálogo generado desde la plantilla.**

**Disparador:** el día que haya que dar de alta un negocio que no sea de estética.
Antes de eso, cualquier campo nuevo se agrega al `Service` fijo y listo.

---

### Pendiente de decisión del dueño del producto

No empezar estas hasta tener respuesta:
- **Conexión de WhatsApp:** ¿API oficial de Meta o sesión por QR? Define toda la
  pantalla de Configuración → Conectar WhatsApp, que es la pieza crítica que falta
  para que la v1 sirva en producción.
- **Planes Free/Pro:** ¿tienen límites reales de negocios o mensajes? Si sí, hay
  que diseñar los bloqueos.
- **Rol agente/empleado** con acceso solo a Conversaciones: queda fuera de la v1 por
  la decisión 2.7; revisar cuando se reactive esa sección.

---

## 5. Plantilla de PR (obligatoria)

```markdown
## Qué cambió
<2–4 líneas en prosa. Nada de listar archivos.>

## Por qué
<La decisión detrás del cambio, no la descripción del diff.>

## Cómo probarlo
- [ ] Ir a `<ruta exacta>`
- [ ] Entrar con `<usuario / dato de ejemplo>`
- [ ] Debe pasar `<resultado esperado>`
- [ ] Caso de error: `<qué hago>` → `<qué debe pasar>`

## Qué NO cubre
<Lo que queda fuera de alcance y por qué.>

Closes #<issue>
```

La sección "Cómo probarlo" es obligatoria y tiene que ser ejecutable sin leer el
diff: rutas reales, credenciales de ejemplo, resultado esperado concreto.

---

## 6. Cuándo dejar el free tier

| Señal | Qué significa | Acción |
|---|---|---|
| `uso_ia.fallbacks` sube de forma sostenida | Los tres proveedores se agotan el mismo día | Gemini Tier 1 (pago por uso) |
| Tokens de IA > ~800K/día sumando proveedores | Al borde del techo combinado | Igual que arriba |
| Base de datos > 350 MB | Las `sesiones` con historial JSON crecen rápido | Purgar sesiones viejas; Supabase Pro si no alcanza |
| Egress > 3,5 GB/mes | Techo de 5 GB + 5 GB cacheado | Revisar que T-06 esté haciendo su trabajo |
| **Primer cliente que paga** | Ya no se puede tolerar un corte | **Supabase Pro. No negociable.** |

El último es el único que no es técnico, y es el que manda. Cruzado un límite del
free tier, Supabase devuelve `402` en todos los servicios hasta que se actualice el
plan o se reinicie el período: con un cliente pagando, eso es un incidente, no un ahorro.

---

## 7. Registro de cambios

**v2 — sept-2026.** Se reduce el alcance a un circuito mínimo verificable en
producción con un solo negocio real.

| Cambio | Antes (v1) | Ahora (v2) |
|---|---|---|
| Rubros | Multi-rubro desde el arranque | **Solo estética**; el resto, cuando aparezca el segundo negocio |
| Campos dinámicos (T-09/T-10) | Fase 2, en el camino crítico | **Aplazadas**, con disparador explícito |
| Creación de negocios | Decisión tomada, sin tarea que la ejecutara | T-11 la ejecuta: mueve la action, crea la asignación y borra la pantalla del portal |
| Portal | Seis secciones | **Tres**: Resumen, Catálogo, Configuración (T-16) |
| Conocimiento de la IA | Dentro de "Respuestas y flujos" | Se mueve a Configuración (T-17), o se perdía al ocultar esa sección |
| Diseño | Se asumía publicado en el repo | T-19 lo publica en `docs/design/` y retira la copia vieja |

Correcciones de la v1 detectadas al revisar el código:
- T-03 decía verificar los rubros en `/portal`; esa pantalla lista **negocios**. Los
  rubros asignados se ven en `/portal/negocios/nuevo`.
- T-04 pedía agregar `CEREBRAS_API_KEY` a `.env.example`: ya estaba.
- La sección 2.4 (ex 2.3) no mencionaba que `durationMinutes` lo usa el motor ni que
  `businessConfigSchema` descarta `catalogo` en silencio.
