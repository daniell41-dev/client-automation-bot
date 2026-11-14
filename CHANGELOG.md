# Changelog

Versiones de Nexo. Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/);
números: [versionado semántico](https://semver.org/lang/es/) (ver
`docs/01-git-flow.md` → "Versiones y releases").

## [Sin publicar]

### Cambios
- Landing (T-95): talones de la comanda del pedido #128 entre secciones (nota de voz, total
  confirmado, comprobante con faltante y pedido aprobado) que salen de su ranura al bajar.
- Landing (T-94): el precio se muestra como un ticket que se suma ("Su cuenta": instalación $0,
  14 días $0, permanencia 0 meses, y abajo desde $79.900 al mes); las líneas se imprimen al bajar.
- Landing (T-93): en "Así funciona" la línea se llena de azul al bajar, el número de cada paso
  se enciende cuando la línea lo alcanza y su escena entra desde su lado.
- Landing (T-92): una línea de escaneo baja por el comprobante de ejemplo al hacer scroll y
  cada dato recibe su marca cuando la línea pasa: tres revisados y la fecha en ámbar ("Hace 12 días").
- Landing (T-91): el teléfono del hero se siente como un WhatsApp de verdad: la nota de voz
  avanza mientras se escucha, arriba dice "escribiendo…" y salen los tres puntos antes de cada
  respuesta, los checks del resumen se ponen azules y el monto que no cuadra se subraya.
- SEO (T-89): título y descripción nuevos con el mensaje del hero; la imagen para redes
  (1200×630) ahora se genera con código desde el título y el precio, sin dominio fijo; los
  datos estructurados suman `SoftwareApplication` con oferta en COP solo si hay precio
  configurado.

### Arreglos
- Páginas legales: el contacto del responsable muestra un solo teléfono (+57 322 683 7610).
- Citas (T-88): "Corte caballero" ya no agenda "Corte dama" cuando dos servicios comparten una
  palabra clave; la hora que viene en el primer mensaje ("¿tiene turno hoy a las 5?") se
  recuerda en vez de volver a pedirla; y "p. m." llega bien a la confirmación (antes "p . me").

### Nuevo
- Landing de venta en la portada (T-80): qué hace Nexo, cómo funciona, para qué negocios,
  instalación y preguntas frecuentes, con botones "Escríbanos por WhatsApp" (número en
  `NEXT_PUBLIC_WHATSAPP_VENTAS`; sin él llevan a la demo).
- Landing (T-81): precio desde $79.900 al mes con instalación gratis y 14 días de prueba, y
  respuestas confirmadas sobre el número y el tiempo de instalación (unos 30 minutos).
- Hero animado (T-82): el teléfono muestra en bucle una nota de voz, el resumen, un comprobante
  que no cuadra y el aviso para aprobar; solo CSS y quieto con "reducir movimiento". Chips de
  instalación gratis, 14 días de prueba y sin permanencia.
- Landing (T-83): sección del comprobante anotado. Un comprobante de ejemplo con las cuatro
  preguntas que Nexo revisa (monto, cuenta, referencia, fecha), que aparecen al bajar.
- Landing (T-84): "Lo que se pierde" pasa de tres tarjetas a un chat sin responder ("Visto por
  última vez: nadie.") y tres frases grandes.
- Landing (T-85): el precio pasa a una tarjeta con "Desde $79.900 al mes", condiciones, qué
  incluye y la garantía de los 14 días (igual que los Términos).
- Landing (T-86): sección "Detrás de Nexo hay una persona de Cúcuta" y foto en el cierre. Solo
  aparecen cuando se configuran el nombre y la foto del responsable (hoy no aparecen).
- Landing (T-87): "Así funciona" pasa a una línea de tiempo con escenas del chat, y "Para qué
  negocios" a pestañas con conversaciones de ejemplo tomadas de las respuestas reales del bot.

### Cambios
- El bot le habla de usted al cliente y a la dueña, en español de Colombia (T-78): sin voseo en
  los mensajes, las plantillas de rubro ni los prompts de la IA. `pnpm quitar:voseo` corrige lo
  que ya está guardado en la base.
- Las pantallas (portal, back office, login, demo y errores) también hablan de usted (T-79), y el
  tono "Cercano" del bot ya no tutea al cliente.

## [1.0.2] — 2026-11-13

### Arreglos
- Las fuentes (Plus Jakarta Sans y Sora) quedan dentro del proyecto (T-77): el build ya no
  las descarga de Google, que empezó a responder en un formato que tumbaba el build.
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
