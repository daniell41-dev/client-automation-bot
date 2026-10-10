# ADRs — Decisiones de arquitectura

Architecture Decision Records del proyecto. Cada entrada documenta una decisión
real (hubo una elección entre alternativas), no una convención obvia. No se
reescriben entradas existentes: una decisión superada se marca `superseded` y se
agrega una entrada nueva que la referencia.

---

## ADR-001: Motor determinista con modo agente separado (la IA decide, el motor valida)

**Status:** accepted

**Contexto:** El motor basado en reglas y listas de keywords (`isMenuRequest`,
`looksLikeDate`, etc.) no escalaba a mensajes nuevos de clientes, y ya se pagaba
una llamada a IA por turno solo para reformular el tono de una respuesta ya
decidida por reglas — sin aprovechar su capacidad real de decidir.

**Decisión:** En modo agente (default), la IA recibe el contexto completo
(catálogo, horarios, historial) y devuelve un JSON de acciones (`agent-schema.ts`)
que el motor determinista valida contra el estado real antes de aplicarlas
(`runAgentTurn()` en `src/core/ai/agent.ts`). El modo guiado (reglas fijas, la IA
solo reformula tono) se mantiene como interruptor de negocio
(`BusinessConfig.ai.modo`) y como red de seguridad automática si
`runAgentTurn()` devuelve `null` (falla de red, JSON inválido, etc.).

**Consecuencias:**
- Facilita: el motor entiende mensajes nuevos sin agregar keywords a mano, y la
  IA se usa donde aporta valor real (decidir acciones), no solo estilo.
- Complica: cada acción que devuelve la IA debe validarse explícitamente contra
  el estado real antes de aplicarse (más superficie de validación), y quedan dos
  caminos de ejecución (guiado y agente) que hay que mantener y probar en
  paralelo.

---

## ADR-002: Stock en tabla propia con descuento atómico, no en `negocios.config`

**Status:** accepted

**Contexto:** `negocios.config` es una columna JSONB que se reescribe entera en
cada guardado del portal. Si el stock viviera ahí, una venta y una edición de
catálogo simultáneas se pisarían el contador.

**Decisión:** El stock vive en su propia tabla (`inventario`, migración
`supabase/migrations/0010_inventario.sql`) y se descuenta con una función SQL
(`descontar_stock_carrito`) que usa `FOR UPDATE` para bloquear las filas
involucradas dentro de la misma transacción, serializando descuentos
concurrentes del mismo producto en vez de dejar que la app haga
lectura-resta-escritura.

**Consecuencias:**
- Facilita: el descuento de stock es seguro ante concurrencia sin lógica
  adicional en la aplicación.
- Complica: el adaptador local en JSON (pensado para desarrollo de un solo
  proceso) no tiene esta garantía y queda documentado como limitación explícita
  en `src/core/storage/factory.ts` — el comportamiento de stock difiere entre
  entornos.

---

## ADR-003: Aprobación de la dueña por WhatsApp, no por un dashboard

**Status:** accepted

**Contexto:** Cuando hay un pedido pendiente (`stage: "esperando_aprobacion"`),
alguien tiene que confirmarlo o rechazarlo. La dueña ya revisa el WhatsApp del
negocio todo el día; no un panel del portal.

**Decisión:** La dueña acepta o rechaza respondiendo SÍ/NO por WhatsApp al mismo
número del negocio. El webhook detecta que el remitente es
`config.notifyPhoneNumber` y llama a `handleOwnerApproval()` en vez del funnel
normal de cliente (`src/core/handle.ts`), sin mezclarse con `handleIncoming`.
`interpretarRespuestaDueña()` (`src/core/engine/approval.ts`) devuelve `null`
ante un mensaje ambiguo, a diferencia del funnel de cliente, donde "no-sí" ya se
interpreta como negativo.

**Consecuencias:**
- Facilita: no hay que construir ni mantener un dashboard de aprobación; la
  dueña actúa desde el canal que ya usa.
- Complica: la resolución es FIFO (limitación conocida y documentada en el
  código) y cualquier ambigüedad en la respuesta bloquea el pedido hasta que la
  dueña responda con claridad; no queda registro de la decisión fuera del
  historial de WhatsApp.

**Confianza:** más débil que ADR-001 y ADR-002. No se encontró en el repo una
discusión textual del tipo "se evaluó un dashboard y se descartó" — la
alternativa descartada es una inferencia razonable a partir del patrón de
diseño (reutilizar el canal de notificación ya evaluado en
`docs/10-notificaciones-y-pedidos.md`), no una cita explícita como en los otros
dos casos.

---

## ADR-004: El pedido es una entidad propia, no un estado del lead

**Status:** accepted (T-30). Reemplaza la parte "resolución FIFO" de ADR-003.

**Contexto:** Desde T-21 el lead ERA el pedido: el carrito vivía en `lead.items`
y el estado de la venta en `lead.stage`. Eso dejaba tres problemas sin
solución posible:
- La dueña no tenía a qué pedido referirse al responder SÍ, así que
  `handleOwnerApproval` aprobaba el pendiente **más viejo**. Con dos pedidos
  abiertos, revisar el comprobante de B y responder SÍ confirmaba A, aunque A
  nunca hubiera pagado. Es exactamente el hueco que usa un pantallazo falso.
- La referencia de Wompi era `lead.id`, que se repite en todos los pedidos de
  un mismo cliente.
- No había dónde registrar lo que pasa después de aprobar (listo, entregado,
  código de retiro) sin seguir cargando campos en el lead.

**Decisión:** Cada carrito confirmado por el cliente crea una fila en `pedidos`
(migración `0015_pedidos.sql`):
- **Número corto por negocio** (#1, #2, …), asignado por `crear_pedido` en la
  misma transacción que incrementa un contador propio (`pedido_contadores`).
  El contador no vive en `negocios` porque esa fila la puede escribir la dueña
  desde el portal.
- **Ítems copiados** (nombre y precio al momento de pedir).
- **Ciclo de vida propio** (`src/core/engine/pedido-estado.ts`):
  `esperando_pago → por_verificar → aprobado → listo → entregado`, más
  `rechazado` y `vencido` como finales. Una transición inválida lanza; por
  ejemplo, un webhook atrasado no puede aprobar un pedido ya rechazado.
- El lead vuelve a ser la conversación. `handle.ts` crea y mueve el pedido en
  modo best-effort: si la tabla no existe todavía, la charla sigue como antes.

**Consecuencias:**
- Facilita:
  - T-31: aprobar por número o botón, sin FIFO.
  - T-34: referencia de Wompi = id del pedido.
  - T-37: código de retiro.
  - T-38: panel de pedidos.
  - Además, queda registro de cada decisión fuera de WhatsApp.
- Complica: dos lugares con estado (lead y pedido) que tienen que moverse
  juntos. Mientras convivan, el lead sigue siendo quien decide la conversación
  y el pedido es el registro de la venta. Un pedido que nunca se resuelve queda
  en `esperando_pago` hasta que exista el vencimiento (T-32).
