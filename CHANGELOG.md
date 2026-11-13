# Changelog

Versiones de Nexo. Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/);
números: [versionado semántico](https://semver.org/lang/es/) (ver
`docs/01-git-flow.md` → "Versiones y releases").

## [Sin publicar]

## [1.0.2] — 2026-11-13

### Arreglos
- Panel de pedidos (T-76): se refresca al volver a la pestaña, al reconectarse y cada
  30 s mientras está a la vista; antes una devolución podía no aparecer hasta recargar.
- Traefik pasa de v3.1 a v3.6 (T-75): con Docker 29 la v3.1 no veía la app y no sacaba
  el certificado HTTPS.

## [1.0.1] — 2026-11-09

### Operación
- Despliegue automático (T-74): al publicar una release, GitHub Actions construye la
  imagen, la manda al VPS y la levanta; también se puede desplegar a mano una versión
  anterior. El servidor ya no compila (1 GB de RAM alcanza).

## [1.0.0] — 2026-11-08

Primera versión de producción: el circuito completo de un pedido por WhatsApp, probado
de punta a punta con un negocio real (Sabores del Sur, Cúcuta).

### El bot por WhatsApp
- Agente con IA (Gemini, con respaldo en Groq) sobre un motor determinista: entiende
  lenguaje natural, pero el pedido siempre pasa por un resumen con total que el cliente
  confirma.
- Pedidos de varios productos con stock atómico, domicilio con costo configurable o
  recoger en el local, y código de retiro al aprobar.
- Citas y reservas para negocios de servicios.
- Notas de voz: el cliente puede pedir por audio (T-46).
- Datos de pago: varias cuentas y QR que el bot le manda al cliente (T-45).

### Pagos y fraude
- Lectura del comprobante con IA y señales de riesgo: monto distinto, cuenta que no es
  del negocio, referencia repetida, fecha vieja o futura, ráfaga.
- La dueña aprueba o rechaza cada pedido con botones de WhatsApp (plantilla de Meta
  cuando su ventana de 24 h está cerrada).
- Pagó de menos: "Pedir el resto" y suma de comprobantes (T-66).
- Devoluciones: el bot pide la cuenta al cliente y el panel lleva la cuenta (T-67).
- Wompi como pasarela opcional.

### Portal de la dueña
- Catálogo, horarios, respuestas, configuración y conversaciones.
- Panel de pedidos en vivo: por verificar, en preparación, listo, entregado; foto del
  comprobante y señales; sección de devoluciones.
- Invitación por correo, "olvidé mi contraseña" y asistente de primer ingreso.
- Revisado en celular a 320 px (T-73); más rápido (T-69).

### Back office
- Negocios, rubros, usuarios y asignaciones; medidores de uso de IA y de WhatsApp.

### Sitio público
- Landing, demo, login con marca (T-68), favicon e imagen para compartir (T-71),
  páginas de error en español (T-72).
- Política de privacidad, términos y borrado de datos (T-70).

### Operación
- Imagen Docker y despliegue en VPS con Traefik y HTTPS automático (T-61).
- `/api/health` para el monitor de caídas (T-65).

[1.0.1]: https://github.com/daniell41-dev/client-automation-bot/releases/tag/v1.0.1
[1.0.0]: https://github.com/daniell41-dev/client-automation-bot/releases/tag/v1.0.0
