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
