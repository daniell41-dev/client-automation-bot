# 10 - Notificaciones por WhatsApp y modalidad de pedido

Responde a una pregunta central: **¿cómo se entera la dueña de un negocio de que el bot acaba de confirmar algo?** Hasta ahora la respuesta era "abriendo el portal". Esta guía cubre las dos piezas que lo resuelven:

1. **Notificación por WhatsApp** — la dueña recibe un mensaje en su celular personal apenas se confirma una cita/pedido.
2. **Modalidad de pedido** — para negocios donde el cliente puede *retirar* o *consumir en el local* (típico de un restaurante), el bot pregunta cuál de las dos prefiere.

Ambas son **opcionales por negocio**: si no las configurás, el bot se comporta exactamente igual que antes.

---

## 1. Notificación por WhatsApp a la dueña

### Cómo funciona

Cuando el lead pasa a `datos_completos` (el cliente confirmó con "sí"), además de agendar en el calendario (si está configurado), el bot le manda un WhatsApp a la dueña con un resumen:

```
🔔 Estética Bella: confirmación nueva
Cliente: Laura
Servicio: Limpieza facial
Fecha/hora: mañana a las 3pm
```

- Usa el **mismo número de WhatsApp Business** del negocio (`WhatsApp phone number ID`) para enviar — solo cambia el destinatario, que es el celular personal de la dueña.
- Es un mensaje de texto plano (no pasa por IA): siempre dice lo mismo, sin sorpresas.
- Solo se dispara **una vez** por confirmación (se detecta la transición al estado, no el estado en sí — si el cliente sigue escribiendo después no se repite).
- Si el envío falla (red, token vencido), no rompe la respuesta al cliente: solo se registra el error en los logs.

### Configurarla

Desde el portal: **Configuración → Notificaciones → Tu número de WhatsApp**, en formato internacional sin espacios ni `+` (ej. `573001234567`). Vacío = sin notificaciones.

En código (`BusinessConfig.notifyPhoneNumber`):

```ts
notifyPhoneNumber: "573001234567",
```

### Requisitos

- Necesita `WHATSAPP_ACCESS_TOKEN` configurado (el mismo que ya usa el bot para responder). Sin token, no se envían notificaciones — el resto del bot sigue funcionando igual.
- El simulador (`pnpm sim`, `/api/dev/simulate`) **no envía notificaciones reales** — es un entorno de prueba sin credenciales de Meta.

---

## 2. Modalidad de pedido (retirar / comer en el local)

### El problema que resuelve

El funnel del bot está pensado como una **reserva para otro momento** (nombre → fecha tentativa → confirmar). Eso funciona bien para una cita de estética, pero un restaurante tiene un matiz: el cliente puede querer **retirar su pedido** o **quedarse a comer ahí**. Sin esta distinción, el bot le pregunta "¿qué día?" a alguien que quiere su comida ya.

### Cómo funciona

Si el negocio activa `pedidos`, se inserta un paso nuevo en el funnel, **entre el nombre y la fecha**:

```
Cliente: Hola, quiero un bife de chorizo
Bot:     Bife de chorizo: ... Precio: $8.900. ¿Cuál es tu nombre?
Cliente: Carlos
Bot:     ¿Vas a retirar tu pedido o prefieres comer en el local?
         [Retirar en el local]  [Comer en el local]
Cliente: Retirar
Bot:     ¿Qué día te gustaría agendar?
Cliente: En 20 minutos
Bot:     ¿Te confirmo Bife de chorizo para en 20 minutos, Carlos?
Cliente: Sí
Bot:     ¡Listo Carlos! Tu Bife de chorizo para en 20 minutos quedó agendado.
```

- La respuesta del cliente se interpreta de forma flexible: coincide con el texto completo de la opción, con una palabra significativa de la opción ("retiro" → "Retirar en el local"), o con el número de la lista (1/2).
- La modalidad elegida queda guardada en el lead (`entrega`) y disponible como variable `{{entrega}}` en `askConfirm` y `captured`, si querés mencionarla explícitamente en esos mensajes.
- También aparece en la notificación a la dueña (sección 1) si está configurada.
- **Sin `pedidos` configurado, no cambia nada**: el funnel sigue siendo nombre → fecha → confirmar, como hasta ahora.

### Configurarla

Desde el portal: **Citas y reservas → Modalidad de pedido**. Activás el toggle, escribís la pregunta y de 2 a 4 opciones.

En código (`BusinessConfig.pedidos`):

```ts
pedidos: {
  enabled: true,
  pregunta: "¿Vas a retirar tu pedido o prefieres comer en el local?",
  opciones: ["Retirar en el local", "Comer en el local"],
},
```

---

## Alcance actual y lo que falta

Esta fase resuelve **la mitad del problema original**: la dueña ahora se entera en el momento (WhatsApp) y el bot distingue "para ya" de "para otro día" mediante la modalidad. Lo que **no** incluye todavía:

- Un flujo de **pedido inmediato** separado de la reserva (seguimos usando el mismo campo `tentativeDate` tipo texto libre — el cliente escribe "en 20 minutos" y el bot lo trata igual que "el viernes"). Un panel de "Pedidos activos" con tiempos de preparación es una fase futura.
- Notificaciones por otros canales (push del navegador, email) — se evaluaron pero se priorizó WhatsApp por ser el canal que la dueña ya revisa todo el día.

## Archivos clave

- `src/core/types.ts` — `BusinessConfig.notifyPhoneNumber`, `BusinessConfig.pedidos` (`PedidosConfig`), `Lead.entrega`, stage `esperando_entrega`.
- `src/core/config-schema.ts` — validación Zod de ambos campos.
- `src/core/engine/intake.ts` — `matchEntrega()`.
- `src/core/engine/responder.ts` — rama `esperando_entrega` + helper `nextAfterName()`.
- `src/core/handle.ts` — `OwnerNotifier`, `notifyOwner()` (dispara junto con el calendario al confirmar).
- `src/app/api/webhook/whatsapp/route.ts` — reutiliza el mismo `WhatsAppChannel` como notifier.
- `src/app/portal/negocios/[slug]/citas/` — UI de "Modalidad de pedido".
- `src/app/portal/negocios/[slug]/configuracion/` — UI de "Notificaciones".
