# Plan T-22 / T-23 — Visión por imagen y cierre del módulo Tienda

> Guardar como `docs/15-plan-vision-tienda.md`.
> Continúa `docs/14-plan-de-trabajo.md`. Rige el mismo contrato: `core/` sin
> `next/*`, test por módulo, una rama y un PR por sub-tarea, plantilla de PR obligatoria.

---

## 0. Estado verificado de `develop` (15-sep-2026)

Verificado ejecutando `pnpm install`, `tsc --noEmit` y `pnpm test`:
**625 tests pasan, 54 archivos verdes, 0 errores de tipos.**

Lo que YA existe y este plan da por sentado (no reconstruir):

| Pieza | Dónde | Estado |
|---|---|---|
| Stock con descuento atómico | `0010_inventario.sql`, `descontar_stock_carrito` | Hecho, con `for update` |
| `fijar_stock` desde el portal | `0010_inventario.sql` | Hecho |
| Carrito del lead | `0009_lead_items.sql` (`leads.items` jsonb) | Hecho |
| Repositorio de inventario | `core/storage/inventory-repository.ts` + adaptadores json/supabase | Hecho |
| Modo por ítem (cita vs pedido) | `core/engine/modo-item.ts` | Hecho |
| Flujo de pedido | `core/engine/flows/pedido.ts`, `pedido-lifecycle.ts` | Hecho |
| Aprobación del dueño | `core/engine/approval.ts` | Hecho |
| `Service.stock`, `CatalogoConfig` | `core/types.ts` | Hecho |
| Cadena de respaldo IA | `core/ai/resilient.ts` | Hecho (solo texto) |
| Consumo por negocio | `0005_uso_ia.sql`, `usage-repository.ts` | Hecho |

**El módulo Tienda está en ~80%.** Este plan cierra el 20% que falta (T-22) y
agrega visión (T-23). No es empezar de cero.

### Lo que falta y este plan resuelve

1. `parseInbound` descarta todo lo que no sea `type === "text"` — una foto hoy
   se ignora en silencio, el cliente no recibe nada.
2. `ILLMProvider` no tiene forma de recibir una imagen.
3. `presets.ts` no declara qué modelo ve y cuál no; `gpt-oss-20b` y
   `llama3.1-8b` son solo texto.
4. Nada avisa al dueño cuando el stock queda bajo.
5. `descontar_stock_carrito` existe pero hay que confirmar que el flujo de
   aprobación la llama al confirmar, no antes.

---

## 1. Decisiones cerradas (no re-discutir)

### 1.1 La visión es OCR + búsqueda, no reconocimiento visual
El modelo NO adivina qué producto es comparando formas. Extrae **texto y marca
visibles** de la foto y con eso se busca en el catálogo del negocio.

Razón: en repuestos y farmacias la mayoría de las fotos son de cajas, etiquetas
y envases con referencia impresa, y ahí el OCR es confiable. Una pieza suelta
sin marca no se puede identificar con certeza, y un bot que afirma mal quema la
credibilidad del dueño.

### 1.2 El bot propone, no afirma
- **Match exacto por referencia/código** → puede afirmar: "Sí, es el filtro
  90915-YZZE1, lo tenemos a $8".
- **Match por tipo/categoría** → propone hasta 3 candidatos y pregunta.
- **Sin match** → pide el nombre o la referencia por texto. Nunca inventa.

### 1.3 Las imágenes no se guardan
Se procesan en memoria y se descartan. No van a Supabase Storage ni a
`sesiones`. Son fotos de clientes finales y, en el caso de pagos, contienen
datos bancarios. En el historial queda solo la descripción en texto.

### 1.4 Farmacias: prohibido el récipe
El rubro farmacéutico debe tener una regla dura: fotos de caja/envase se
procesan; **fotos de récipes o fórmulas médicas NO**. El bot responde que ese
trámite se hace en persona. Es dato de salud y abre responsabilidad legal en
Colombia y Venezuela. Requiere test explícito.

### 1.5 Cadena de respaldo con visión
`gemini-3.5-flash-lite` ve imágenes. Los otros dos presets no. Para mensajes
con imagen la cadena es: **Gemini → Groq Llama 4 Scout → plantilla de respaldo**
("No pude ver bien la imagen, ¿me dices el nombre o la referencia?").
Nunca un error silencioso ni un mensaje vacío.

Llama 4 Scout está en preview según la doc de Groq: va como respaldo, nunca
como principal.

### 1.6 Una captura NO verifica un pago. Nunca.

Esta es la decisión más importante del plan y no es negociable.

Existe una industria de fraude dedicada exactamente a esto. `NequiDz V2` replica
la interfaz de Nequi y genera comprobantes con logos, colores, códigos QR falsos
y hasta simulación de movimientos; hay bots de Telegram que por unos 50.000 COP
generan un comprobante con el nombre, monto y referencia que se les pida. Algunas
versiones consultan el número de celular y traen el **nombre real del titular**,
así que el comprobante falso muestra los datos correctos del destinatario. El
patrón de la estafa es siempre el mismo: muestran el comprobante, se llevan el
producto, y el dinero nunca llega.

En Venezuela el problema es idéntico con capturas de Pago Móvil.

**Consecuencia de diseño:** el bot NUNCA dice "pago confirmado" a partir de una
imagen. Lo que la IA aporta acá no es verificación, es **digitación y triaje**:
convierte la captura en datos estructurados y le ahorra al dueño teclear y
comparar. La verificación la da una de dos cosas, nunca el OCR:

- **el dueño mirando su propia app del banco**, o
- **una pasarela de pago con webhook firmado**.

Dos niveles, y el producto ofrece los dos:

| | Nivel 1 — Triaje asistido | Nivel 2 — Verificación real |
|---|---|---|
| Cómo | Captura → OCR → señales de riesgo → el dueño aprueba | Link de pago con referencia única → webhook firmado |
| Qué garantiza | Nada por sí solo. Acelera y ordena la decisión del dueño | El pago ocurrió. Certeza criptográfica |
| Requisitos | Ninguno | Cuenta de comercio (NIT / cuenta jurídica) |
| Para quién | Todos, incluido el negocio informal | El que pueda afiliarse |

El Nivel 2 es el que de verdad resuelve el problema, y además cierra la venta
dentro de la conversación. El Nivel 1 existe porque muchos negocios pequeños de
la zona no van a tener cuenta de comercio, y para ellos "que el bot me ordene los
comprobantes y me avise si algo huele mal" ya es un salto enorme frente a hoy.

### 1.7 Lo que el bot SÍ puede detectar sin banco
Estas señales no prueban que un pago sea real, pero atrapan al defraudador
perezoso y no cuestan un centavo. Son motor puro, sin IA:

- **Referencia repetida.** La misma referencia usada dos veces en el mismo
  negocio. Es la señal más fuerte que existe sin API bancaria.
- **Monto distinto** al total del pedido.
- **Cuenta o teléfono destino** que no coincide con el registrado del negocio.
- **Fecha vieja** (comprobante de hace más de N horas) o futura.
- **Ráfaga**: varios "pagos" del mismo contacto en pocos minutos.

El bot presenta las señales al dueño; el dueño decide. El bot nunca rechaza solo,
porque un falso positivo le cuesta un cliente real.

---

## 2. T-22 — Cerrar el módulo Tienda

### T-22.1 · Conectar el descuento de stock a la confirmación
Auditar `pedido-lifecycle.ts` y `approval.ts`: `descontar_stock_carrito` debe
llamarse **solo cuando el pedido queda confirmado**, nunca al armar el carrito.
Si `{"ok": false, "faltantes": [...]}`, el bot avisa qué producto no alcanza y
ofrece ajustar cantidad.

- **Criterio:** test de dos pedidos concurrentes del último ítem — uno pasa, el
  otro recibe faltante. Test de que armar carrito no descuenta nada.
- **Cómo lo pruebo yo:** `pnpm sim` pido 2 unidades de un producto con stock 1;
  el bot me dice que solo hay 1. Reviso la tabla `inventario` y el stock no bajó
  hasta confirmar.

### T-22.2 · Alerta de stock bajo al dueño
Umbral configurable por negocio (`catalogo.stockMinimo`, default 3). Al cruzarlo
tras una venta, mensaje al dueño: "Quedan 2 unidades de Harina PAN".
Una sola alerta por producto por día — sin esto, cinco ventas seguidas son cinco
mensajes y el dueño silencia el bot.

- **Criterio:** test de que la segunda venta del mismo día no repite la alerta.
- **Cómo lo pruebo yo:** dejo un producto en 4, vendo 2, recibo la alerta; vendo
  1 más y no llega una segunda.

### T-22.3 · Stock en el editor de catálogo del portal
El campo `stock` aparece solo si `catalogo.campos.stock === true`. Al guardar
llama `fijar_stock`, no reescribe el JSONB.

- **Criterio:** un rubro con `campos.stock: false` no muestra el campo. Guardar
  el catálogo no pisa el stock descontado por ventas.
- **Cómo lo pruebo yo:** vendo 3 unidades, entro al portal, guardo el catálogo
  sin tocar el stock, y el valor sigue descontado.

---

## 3. T-23 — Visión por imagen

Cinco PRs en orden estricto. Cada uno se mergea con tests verdes antes del siguiente.

### T-23.1 · `parseInbound` acepta imágenes (PR 1/5)
Extender `MetaMessage` con `image?: { id, mime_type, caption? }` y
`ParsedWhatsAppMessage` con `image?: { mediaId, mimeType, caption? }`.
El `text` pasa a ser el `caption` si viene, o cadena vacía.

Mantener el descarte de los demás tipos (audio, sticker, ubicación) pero
registrar en log cuáles llegan — sirve para saber qué pedir después.

- **Criterio:** tests con payload real de imagen con y sin caption; los payloads
  de texto siguen pasando idénticos (sin regresión en `parse.test.ts`).
- **Cómo lo pruebo yo:** ningún cambio visible todavía — solo `pnpm test` verde.

### T-23.2 · Adaptador de descarga de media de Meta (PR 2/5)
`core/channels/whatsapp/media.ts`: `GET /{media_id}` para obtener la URL
temporal, luego descarga con el token. Devuelve `{ base64, mimeType }`.

Límites duros (según la doc de Groq y Gemini): rechazar > 4 MB en base64 y mime
distinto de `image/jpeg`, `image/png`, `image/webp`. Timeout de 10 s.
Sin reintentos: si falla, cae a la plantilla de respaldo.

- **Criterio:** tests con fetch simulado para éxito, 404, timeout y archivo
  sobredimensionado. Nunca lanza excepción sin controlar.
- **Cómo lo pruebo yo:** todavía nada visible.

### T-23.3 · `supportsVision` y `describeImage` en el provider (PR 3/5)
1. `supportsVision: boolean` en cada preset de `presets.ts` (Gemini `true`, Groq
   y Cerebras `false`).
2. Agregar `groq-vision` con `meta-llama/llama-4-scout-17b-16e-instruct`.
3. Método nuevo en `ILLMProvider`:

```ts
/**
 * Lee una imagen del cliente y devuelve lo que se VE, sin interpretar ni
 * afirmar qué producto del catálogo es — ese cruce lo hace el motor.
 * `null` si el modelo no ve imágenes o la respuesta no valida.
 */
describeImage(input: ImageInput): Promise<ImageDescription | null>;
```

4. `ImageDescription` validada con Zod (mismo patrón que `agent-schema.ts`):
   `{ tipoProducto, marca?, textoVisible: string[], categoria?, esRecipeMedico: boolean, confianza: "alta"|"media"|"baja" }`.
5. `ResilientProvider`: para entradas con imagen, saltar los proveedores con
   `supportsVision: false` en vez de intentar y fallar.

- **Criterio:** test de que la cadena salta Groq texto y Cerebras; test de que
  con todos caídos devuelve `null` y no lanza; test de JSON inválido → `null`.
- **Cómo lo pruebo yo:** `pnpm ai:doctor` sigue verde y reporta cuáles ven imágenes.

### T-23.4 · Búsqueda de producto por descripción (PR 4/5)
`core/engine/buscar-producto.ts`, función pura, sin IA adentro:
recibe `ImageDescription` + catálogo, devuelve candidatos ordenados.

Prioridad: (1) `textoVisible` coincide con una referencia/código de `keywords`
→ match exacto; (2) marca + tipo → candidatos; (3) solo categoría → hasta 3
candidatos; (4) nada → `[]`.

Reusa la normalización de `text-normalize.ts`. Nunca devuelve un ítem con
`disponible === false`.

- **Criterio:** tests con catálogo de repuestos (match por referencia), de
  farmacia (match por marca) y caso sin match. Función pura, sin I/O.
- **Cómo lo pruebo yo:** `pnpm test` verde.

### T-23.5 · Conectar el flujo en `handle.ts` (PR 5/5)
Orden: descargar media → `describeImage` → si `esRecipeMedico` y el rubro es
farmacéutico, responder la plantilla de rechazo y cortar → `buscarProducto` →
armar respuesta según cantidad de candidatos (1 = afirma, 2-3 = propone,
0 = pide referencia por texto).

Registrar en `uso_ia` como llamada con `proveedor` y una columna nueva
`imagenes int default 0` (migración `0011`), para poder cobrar el excedente.

En el historial de sesión guardar solo texto: `"[imagen] filtro de aceite Toyota"`.

- **Criterio:** test de extremo a extremo con imagen simulada para los tres
  casos. Test de que el récipe se rechaza en rubro farmacéutico. Test de que la
  imagen no se persiste en ningún lado.
- **Cómo lo pruebo yo:** `pnpm sim` con una imagen de prueba de una caja de
  repuesto; el bot responde con el producto del catálogo y su precio. Repito con
  una foto de algo que no está en el catálogo y el bot me pide la referencia.

---

## 4. T-24 — Confirmación de pago

Depende de T-23 (reusa la descarga de media y el provider con visión).
Regla que atraviesa todas las sub-tareas: **el bot nunca afirma que un pago es
real.** Ver §1.6.

### T-24.1 · Tabla `comprobantes` y detección de referencia repetida (PR 1/5)
Migración `0012`. Es la pieza antifraude más valiosa del módulo y no necesita
banco ni IA.

```sql
create table public.comprobantes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  referencia text,              -- normalizada: sin espacios, mayúsculas
  monto numeric(14,2),
  moneda text,                  -- "COP" | "VES"
  banco text,                   -- "nequi" | "bancolombia" | "mercantil" | ...
  fecha_comprobante timestamptz,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aprobado','rechazado')),
  señales jsonb,                -- resultado de T-24.3
  created_at timestamptz not null default now()
);

-- El corazón del antifraude: una referencia no se puede repetir en un negocio.
create unique index comprobantes_ref_unica
  on public.comprobantes (negocio_id, referencia)
  where referencia is not null;
```

RLS habilitada. El dueño puede leer los suyos; solo el service role escribe.

- **Criterio:** test de que insertar la misma referencia dos veces en el mismo
  negocio falla, y que la misma referencia en negocios distintos sí entra. Test
  de que el borrado del negocio arrastra sus comprobantes.
- **Cómo lo pruebo yo:** todavía nada visible; `pnpm test` verde.

### T-24.2 · `describePaymentReceipt` en el provider (PR 2/5)
Método nuevo en `ILLMProvider`, hermano de `describeImage`. Salida validada con
Zod, mismo patrón que `agent-schema.ts`:

```ts
{
  banco?: string;
  referencia?: string;
  monto?: number;
  moneda?: "COP" | "VES";
  fechaISO?: string;
  telefonoDestino?: string;
  nombreDestino?: string;
  legible: "completo" | "parcial" | "ilegible";
}
```

Todos los campos opcionales a propósito: una captura borrosa o recortada es el
caso normal, no la excepción. Si `legible === "ilegible"`, el bot pide que la
reenvíen más clara, no adivina.

Prohibido que este método emita juicio sobre validez. Devuelve lo que se ve.

- **Criterio:** tests con capturas simuladas de Nequi, Bancolombia y Pago Móvil;
  test de captura ilegible; test de JSON inválido → `null`.

### T-24.3 · Motor de señales de riesgo (PR 3/5)
`core/engine/señales-pago.ts`. Función **pura**, sin IA y sin I/O: recibe el
comprobante leído + el pedido + la config del negocio, devuelve las señales de
§1.7 con nivel `alta | media | baja`.

Ninguna señal rechaza por sí sola. El resultado se guarda en
`comprobantes.señales` y se le muestra al dueño.

- **Criterio:** un test por señal, más un caso limpio sin señales. Función pura,
  sin dependencias.
- **Cómo lo pruebo yo:** `pnpm test` verde.

### T-24.4 · Flujo de aprobación del dueño (PR 4/5)
Reusa `core/engine/approval.ts`. Al recibir una captura el bot:

1. Responde al cliente algo explícitamente no comprometedor: *"Recibí tu
   comprobante, se lo paso a [dueño] para confirmar y te aviso."*
   **Prohibido** decir "pago confirmado", "pago recibido" o equivalentes.
2. Le manda al dueño el resumen con los datos ya extraídos y las señales:
   *"Pedido #142 — María, $45.000. Comprobante: Nequi, ref 0834…, $45.000,
   hoy 2:14 pm. ⚠️ Esta referencia ya se usó el 12/09. ¿Confirmo?"*
3. Solo con el sí del dueño: marca `aprobado`, descuenta stock (T-22.1) y le
   avisa al cliente.

Si el dueño no responde en N horas, recordatorio. Nunca auto-aprueba.

- **Criterio:** test de que el stock no se mueve hasta el sí del dueño; test de
  que el mensaje al cliente no contiene lenguaje de confirmación; test del
  camino de rechazo.
- **Cómo lo pruebo yo:** `pnpm sim`, mando una captura, confirmo que el cliente
  recibe "se lo paso al dueño" y que el stock sigue igual hasta que yo apruebo.

### T-24.5 · Link de pago con verificación real — Colombia (PR 5/5)
Este es el Nivel 2 y el que de verdad resuelve el fraude.

Adaptador `core/payments/` con interfaz `PaymentGateway` (mismo criterio que
`ILLMProvider` y `ChannelAdapter`: el core no conoce Wompi). Primera
implementación: **Wompi**, que es del ecosistema Bancolombia y soporta Nequi,
tarjetas y PSE.

Flujo: el bot genera un link de pago por API con `reference` = id del pedido y
`amount_in_cents` = total, se lo manda al cliente, y el pago se confirma por
**webhook**, no por la redirección. La documentación de Wompi es explícita en
que no hay que confiar en el redirect de éxito como única señal, porque PSE
puede tardar minutos en aprobarse.

Seguridad obligatoria: verificar la firma SHA-256 del evento antes de procesarlo
(`transaction.id + status + amount_in_cents + timestamp + eventKey`). Un webhook
sin firma válida se descarta en silencio. Estados a manejar: `APPROVED`,
`DECLINED`, `VOIDED`, `ERROR`, `PENDING`.

Con `APPROVED` verificado, el bot **sí puede** confirmar al cliente y descontar
stock sin intervención del dueño — es el único camino donde eso está permitido.

- **Criterio:** test de firma válida e inválida; test de idempotencia (Wompi
  reintenta); test de que un webhook `PENDING` no descuenta stock; test de que
  `DECLINED` avisa al cliente sin tocar el pedido.
- **Cómo lo pruebo yo:** con las llaves de sandbox de Wompi, genero un link
  desde `pnpm sim`, pago en el checkout de prueba, y veo el pedido pasar a
  confirmado solo cuando llega el webhook.

**Requisito comercial:** Wompi exige cuenta de comercio con NIT y Cámara de
Comercio. Un negocio informal no califica y se queda en Nivel 1 — por eso los
dos niveles conviven y el plan Nivel 1 nunca se retira.

---

## 5. Fuera de alcance

No empezar sin decisión explícita del dueño:

- **C2P Venezuela (Mercantil / Banesco).** La API de C2P de Mercantil permite
  validar pagos móviles automáticamente, y Banesco tiene su equivalente, pero
  ambas exigen ser **cliente jurídico afiliado al servicio**, con planilla y
  certificación con el banco. Es el Nivel 2 para Venezuela y vale mucho, pero la
  barrera de entrada la tiene que cruzar el dueño del negocio, no nosotros.
  Evaluar cuando haya un cliente venezolano con cuenta jurídica que lo pida.
- **Búsqueda por similitud visual con pgvector.** Versión 2. La búsqueda por
  texto tiene que estar medida y funcionando antes.
- **Topes de imágenes por plan.** Requiere decidir los planes comerciales primero.

---

## 6. Orden de ejecución

```
T-22.1 → T-22.2 → T-22.3            (cierra Tienda, sin costo de API)
   ↓
T-23.1 → T-23.2 → T-23.3 → T-23.4 → T-23.5    (visión)
   ↓
T-24.1 → T-24.2 → T-24.3 → T-24.4   (pagos, Nivel 1)
   ↓
T-24.5                               (pagos, Nivel 2 — necesita cuenta Wompi)
```

T-22 antes que T-23 a propósito: la visión sin stock confiable vende cosas que
no hay. T-23 antes que T-24 porque T-24 reusa la descarga de media y el provider
con visión.

**Antes de T-23.3 hace falta:** `CEREBRAS_API_KEY` ya en `.env.local`, y correr
`pnpm ai:doctor` para confirmar que `gemini-3.5-flash-lite` responde con la key
real (sigue sin verificarse desde el plan anterior).

**Antes de T-24.5 hace falta:** cuenta de Wompi en sandbox con llaves de prueba.
T-24.1 a T-24.4 no dependen de eso y se pueden hacer desde ya.
