# 04 - Agregar un negocio nuevo

Cuando cierras una venta con un negocio, lo configuras **sin tocar `core/`**. Solo creas
un archivo de config y registras su slug. Esto demuestra el eje de personalización por
**rubro**.

## Pasos

### 1. Copia la plantilla

```bash
cp -r src/businesses/_template src/businesses/<slug>
```

Usa un `slug` corto en minúsculas con guiones, p. ej. `unas-glam`, `seguros-carlos`.

### 2. Edita `src/businesses/<slug>/config.ts`

Ajusta los datos del negocio:

- **Identidad**: `slug`, `name`, mensaje de bienvenida.
- **Servicios**: lista de `Service` (nombre, descripción, precio, duración). El menú y la
  info por servicio salen de aquí.
- **Mensajes**: plantillas con variables `{{nombre}}`, `{{servicio}}`, etc. Incluye
  `askConfirm` (la pregunta de confirmación antes de agendar) y `captured` (el mensaje cuando la
  cita queda agendada).
- **Seguimientos**: los textos para 2h / 1 día / 3 días.
- **Agenda** (opcional): `bookingUrl` (Calendly/agenda) que el bot comparte al cerrar.

> No hay lógica aquí, solo **datos**. El comportamiento lo pone el motor genérico.

### 3. Registra el slug en `src/businesses/registry.ts`

Asocia el `phone_number_id` de WhatsApp del negocio (o su slug, para el simulador) con su
config. Así el webhook sabe qué negocio responde cuando entra un mensaje.

```ts
// src/businesses/registry.ts (ejemplo)
import { esteticaBella } from "./estetica-bella/config";
import { unasGlam } from "./unas-glam/config";

export const registry = {
  byPhoneNumberId: {
    "111111111111111": esteticaBella,
    "222222222222222": unasGlam,
  },
  bySlug: {
    "estetica-bella": esteticaBella,
    "unas-glam": unasGlam,
  },
};
```

### 4. Pruébalo offline

```bash
pnpm sim "Hola, quiero información" --business unas-glam
```

Verás la conversación con los servicios, precios y mensajes del negocio nuevo —
**funcionando sin haber tocado `core/`**.

> La firma exacta del comando `sim` (flags disponibles) se documenta en el README cuando
> se implementa la feature del simulador.

### 5. Conecta WhatsApp (cuando haya credenciales)

Sigue [`05-whatsapp-setup.md`](./05-whatsapp-setup.md) para enlazar el número del negocio
con el webhook.

## Checklist

- [ ] Carpeta `businesses/<slug>/` creada a partir de `_template`
- [ ] `config.ts` con servicios, precios y mensajes reales del negocio
- [ ] Slug y `phone_number_id` registrados en `registry.ts`
- [ ] Probado con `pnpm sim`
- [ ] **No** se modificó ningún archivo de `core/`
