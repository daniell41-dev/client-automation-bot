# Plan mayoristas (nov-2026): pantalones al por mayor y lo que sirve a todos

Primer cliente fuera de restaurantes y estética: un negocio de **pantalones al por mayor**
en Cúcuta. De la reunión salieron cinco tareas. Están pensadas para ese rubro, pero se
construyen **genéricas**, para que las tenga cualquier negocio (restaurante, estética,
tienda) sin código especial por rubro.

Trabajamos **dos personas en paralelo** sobre este repo. Este archivo dice qué hace cada
una, en qué orden y cómo no pisarse.

> **Si eres un agente leyendo esto desde otra sesión:** lee primero `AGENTS.md` (las 7
> reglas del repo) y después solo las tareas asignadas a tu persona. No tomes tareas de
> la otra columna sin que te lo pidan.

---

## 1. Quién hace qué

| Tarea | Qué es | Persona | Depende de | Migración reservada |
|---|---|---|---|---|
| **T-104** | Referencias y tallas en el producto (variantes) | Daniel | — | `0026` (si hace falta) |
| **T-105** | Quitar o cambiar algo de un producto ("sin arroz") | Daniel | T-104 (mismo carrito) | — |
| **T-106** | Seguimiento automático del pedido, sin spam | Daniel | — | `0027` |
| **T-120** | Saber de qué anuncio escribe el cliente | Socia | — | `0030` |
| **T-121** | Catálogo en PDF opcional, al saludar | Socia | — | `0031` |

T-103 es este documento.

**Números de tarea reservados:** Daniel, T-103 a T-119; socia, T-120 a T-139. Una tarea
nueva toma el siguiente libre de su rango, así no chocan ramas ni entradas del CHANGELOG.

**Migraciones reservadas:** Daniel, 0026 a 0029; socia, 0030 a 0034. Si una tarea no
necesita la suya, el número queda sin usar: no pasa nada, Supabase las corre en orden
igual. **Nunca** tomar un número de migración del rango del otro.

---

## 2. Cómo trabajamos en paralelo sin pisarnos

1. **Una rama por tarea**, que sale de `develop` actualizado (`git pull` antes de crearla):
   `feat/T-120-origen-anuncio`, etc. Un PR por tarea, a `develop` (regla 1 de `AGENTS.md`).
2. **Antes de abrir el PR**, traer `develop` otra vez (`git merge origin/develop`) y correr
   los 4 checks (`pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`).
3. **Archivos compartidos.** Los dos vamos a tocar estos, pero en partes distintas:
   - `src/core/types.ts`: cada tarea agrega campos en **su** interfaz (ver cada tarea) y no
     reordena ni reformatea lo demás.
   - `src/core/config-schema.ts`: cada tarea agrega **su** bloque.
   - `src/core/handle.ts`: cambios chicos y localizados. Si una tarea necesita reestructurar
     `handle.ts`, **parar y avisar** antes (regla 7).
   - `CHANGELOG.md`: cada uno agrega su línea bajo `[Sin publicar]`. El conflicto se
     resuelve dejando las dos.
4. **Comentarios en español explicando el porqué**, tests primero, `src/core` sin `next/*`
   ni SDKs, y toda escritura a `negocios.config` pasa por Zod (reglas 2 a 5).
5. **Si una tarea resulta más grande** de lo que dice aquí, parar y comentarlo en el PR.

---

## 3. Tareas de Daniel

### T-104 · Referencias y tallas en el producto

**Para qué.** El mayorista vende "Jean Ref 102" en tallas 28 a 40, y el comprador pide
"6 de la 30 y 6 de la 32". Hoy un producto tiene un solo precio y nada más: no hay forma de
decir la talla.

**Diseño (genérico, sirve para otros rubros):**
- `Service` (en `src/core/types.ts`) suma dos campos opcionales:
  - `referencia?: string`: el código del mayorista ("102", "JX-55"). El bot lo reconoce
    cuando el cliente lo escribe.
  - `variantes?: { nombre: string; opciones: string[] }`: por ejemplo
    `{ nombre: "Talla", opciones: ["28","30","32","34"] }`. El `nombre` lo pone el dueño,
    así sirve igual para "Color", "Término de la carne" o "Tamaño".
- `CartItem` suma `variante?: string`. El mismo producto en dos tallas son **dos ítems** del
  carrito (`{serviceId, variante: "30", cantidad: 6}` y `{… "32", cantidad: 6}`).
- El precio es el mismo para todas las variantes. Precio por variante, por volumen y
  stock por talla quedan **fuera** (ver §5).

**Alcance:**
- Tipos y `businessConfigSchema` (Zod) con los campos nuevos, todos opcionales: un
  negocio sin ellos se comporta igual que hoy.
- Portal → Catálogo: campos "Referencia" y "Variantes" (nombre más lista de opciones) al
  crear o editar un producto.
- Agente (`agent-schema.ts` y `agent-prompt.ts`): si el producto tiene variantes, el bot
  pregunta cuál antes de confirmar, acepta varias en un mismo mensaje y rechaza una opción
  que no existe. Acción nueva, o extender `guardar_cantidad`, con `variante` validada
  contra las opciones del producto.
- El resumen del pedido, el aviso a la dueña y el panel de pedidos muestran la variante
  ("2x Jean Ref 102 · Talla 30").
- Filtro de T-98: los precios siguen saliendo del catálogo, nada cambia ahí.

**Pruebas:** schema con y sin variantes; el agente no acepta una talla inexistente; dos
tallas del mismo producto quedan como dos ítems; el resumen y el aviso muestran la talla.

### T-105 · Quitar o cambiar algo de un producto ("sin arroz, sin ensalada")

**Para qué.** El cliente quiere el bistec "sin salsa" o la bandeja "sin arroz". El bot
tiene que entenderlo, anotarlo en el pedido y que la dueña lo vea al preparar. Sirve
también para "ruedo de 2 cm" en ropa o "sin esmalte" en estética.

**Diseño:**
- `CartItem` suma `nota?: string` (máx. ~140 caracteres): "sin arroz, sin ensalada".
- Acción del agente `anotar_cambio { servicioId, variante?, nota }`. La IA solo transcribe
  lo que pidió el cliente; **no cambia el precio**.
- La nota aparece en el resumen ("1x Bistec a la plancha — sin salsa"), en el aviso a la
  dueña y en el panel de pedidos.
- **Agregados** ("con doble queso", "extra papas") **no se cobran solos**. Se anotan igual
  y el bot dice "se lo confirma el negocio", porque pueden costar. Cobrarlos es otra tarea.
- Interruptor por negocio en Configuración, "Aceptar cambios en los productos", encendido
  por defecto. Apagado, el bot dice amablemente que los productos van como están.

**Ojo:** el filtro de T-98 (`filtro-respuesta.ts`) bloquea "sin costo" como regalo. "Sin
arroz" no lo dispara, pero hay que agregar un test que lo asegure.

**Pruebas:** la nota se guarda en el ítem correcto; no altera el total; aparece en resumen,
aviso y panel; con el interruptor apagado no se anota; "sin arroz" pasa el filtro de T-98.

### T-106 · Seguimiento automático del pedido, sin sonar a spam

**Para qué.** Un cliente pregunta, arma medio pedido y desaparece. El bot le escribe más
tarde para retomarlo, como lo haría un buen vendedor, sin insistir de más.

**Qué existe hoy:** `src/core/engine/followups.ts` ya calcula **qué** seguimiento toca
(umbrales en `config.followUps`, `lead.followUpsSent`) y está testeado. **Nadie lo
envía**: no hay cron ni ruta que lo llame.

**Diseño:**
- Ruta `POST /api/cron/seguimientos`, protegida con un secreto (`CRON_SECRET` en
  `.env.production`, comparado en tiempo constante). En el VPS, un cron la llama cada 15
  minutos (mismo patrón que el respaldo de T-101, documentado en `docs/19-vps.md`).
- Reglas anti-spam, todas en `src/core` y testeadas:
  - Solo leads con algo **pendiente**: carrito sin confirmar, pregunta sin responder,
    esperando comprobante. Nunca a quien ya compró, rechazó o pidió no recibir mensajes.
  - Máximo **2 seguimientos** por conversación, por defecto a las 2 h y a las 20 h.
  - **Solo dentro de la ventana de 24 h** de WhatsApp, donde el texto libre no cuesta. Fuera
    de ella Meta exige plantilla aprobada y cobra; eso queda fuera de esta tarea.
  - **No de noche**: solo dentro del horario del negocio (`horarios`); si cae fuera, se
    corre al siguiente horario hábil, si sigue dentro de las 24 h.
  - Si el cliente responde, se cancela lo pendiente. Si dice "no gracias" o "no me
    escriban", no se le escribe más (marca en el lead).
  - El mensaje **retoma el pedido**, no ofrece cosas nuevas: "¿Le dejo listo el pedido de
    2 docenas del Jean 102 talla 30? 🙌". Lo arma el sistema con lo que hay en el carrito;
    si se usa IA para el tono, pasa por `reformulacionSegura` (T-98).
- Portal → Configuración: encender o apagar, y editar el texto de cada seguimiento.

**Migración `0027`:** la columna o índice que haga falta para buscar rápido los leads con
seguimiento pendiente, y la marca de "no escribir más".

**Pruebas:** cada regla anti-spam por separado; la ruta rechaza sin secreto; un lead que
respondió no recibe el seguimiento; fuera de horario se corre.

---

## 4. Tareas de la socia

### T-120 · Saber de qué anuncio escribe el cliente

**Para qué.** El negocio pauta en Instagram y Facebook con anuncios que abren WhatsApp
("Click to WhatsApp"). Quiere saber qué anuncio le trajo cada cliente, y que el bot sepa de
qué producto viene a preguntar.

**Cómo funciona en Meta (verificar en la documentación oficial de la WhatsApp Cloud API,
"referral" en webhooks de mensajes):** cuando alguien escribe desde un anuncio que abre
WhatsApp, el **primer mensaje** llega al webhook con un objeto `referral` dentro del
mensaje. Trae, entre otros: `source_type` ("ad" o "post"), `source_id` (id del anuncio),
`source_url`, `headline`, `body`, `media_type`, `image_url`/`video_url` y `ctwa_clid`.

**Importante:** esto cubre los anuncios que **abren WhatsApp**. Los que abren el chat de
Instagram (Direct) llegan por otra API que el bot todavía no tiene. Eso es la tarea de
Instagram, aparte y no planificada aquí.

**Alcance:**
- `src/core/channels/whatsapp/parse.ts`: leer `referral` y ponerlo en
  `IncomingMessage.origen?: { tipo: "anuncio" | "publicacion"; id?: string; titulo?: string;
  texto?: string; url?: string }` (en `src/core/types.ts`, interfaz `IncomingMessage`).
- Guardarlo en el lead la **primera vez** (no se pisa con mensajes siguientes):
  `Lead.origen`. **Migración `0030`:** columna `origen jsonb` en `leads`.
- El agente recibe el origen como contexto ("el cliente viene del anuncio «Jeans clásicos
  desde $35.000»") para ir directo a ese producto. Es contexto, no órdenes: va en la parte
  de datos del prompt, igual que lo demás del cliente (ver `REGLAS_SEGURIDAD`).
- Aviso a la dueña y panel de pedidos: "Llegó por: anuncio «…»".
- Portal: en Conversaciones o en el resumen, cuántos clientes llegaron por cada anuncio
  (conteo simple; las gráficas no son parte de esta tarea).

**Fuera de alcance:** mandar conversiones de vuelta a Meta con `ctwa_clid` (Conversions
API); anuncios hacia Instagram Direct.

**Pruebas:** `parse.ts` con un payload de ejemplo con `referral` y otro sin él; el origen se
guarda solo la primera vez; aparece en el aviso a la dueña.

### T-121 · Catálogo en PDF opcional al saludar

**Para qué.** Muchos mayoristas ya tienen su catálogo en PDF. El dueño lo sube una vez y
decide si el bot lo manda en el primer mensaje.

**Alcance:**
- Portal → Configuración: subir un PDF (máximo ~10 MB, solo `application/pdf`),
  reemplazarlo o quitarlo, más un interruptor "Enviar el catálogo al saludar" y el nombre
  con que lo recibe el cliente ("Catálogo Jeans 2026.pdf").
- Almacenamiento en Supabase Storage, bucket nuevo `catalogos`, mismo patrón que los QR de
  pago (`BUCKET_QR` en `src/app/portal/actions.ts`). **Migración `0031`:** el bucket y sus
  políticas.
- Config del negocio (pasa por `businessConfigSchema`, Zod): `catalogoPdf?: { url: string;
  nombreArchivo: string; enviarAlSaludar: boolean }`.
- `OutgoingMessage` suma `documento?: { url: string; nombreArchivo: string }`, y
  `src/core/channels/whatsapp/send.ts` lo envía como mensaje tipo `document` de la Cloud
  API, con el `link` público y el `filename`.
- Si `enviarAlSaludar`: al primer mensaje del cliente, el bot manda el saludo y después el
  PDF. Además, si el cliente pide "el catálogo" en cualquier momento, se lo manda (regla
  rápida o acción del agente).

**Ojo:** el PDF lo baja Meta desde la URL, así que tiene que ser pública. No subir ahí nada
privado; el portal debe decirlo junto al botón de subir.

**Pruebas:** schema con y sin catálogo; `send.ts` arma bien el mensaje `document`; con el
interruptor apagado no se manda al saludar pero sí cuando lo piden.

---

## 5. Pendientes del rubro, sin dueño todavía

Salieron de la reunión o se ven venir. No empezar sin asignarlas aquí primero:

- Precio por volumen (unidad, docena o "curva" de tallas) y mínimo de compra mayorista.
- Inventario por talla.
- Envío por transportadora (ciudad, costo, número de guía).
- Resumen diario de ventas por WhatsApp a la dueña, y costo/ganancia estimada.
- Carga masiva del catálogo desde Excel.
- Canal de Instagram (mensajes directos), plan aparte.
