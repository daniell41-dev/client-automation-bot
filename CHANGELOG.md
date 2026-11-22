# Changelog

Versiones de Aurela (antes Nexo). Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/);
números: [versionado semántico](https://semver.org/lang/es/) (ver
`docs/01-git-flow.md` → "Versiones y releases").

## [Sin publicar]

### Nuevo
- Seguimiento automático de pedidos a medias (T-106): si un cliente deja un pedido sin cerrar, el bot le escribe para retomarlo a las 2 horas y, si sigue sin responder, al día siguiente. Nunca más de dos veces por silencio, solo en el horario del negocio (o de 8 a. m. a 8 p. m.), solo dentro de las 24 h gratis de WhatsApp y nunca a quien pidió "no me escriban". Se enciende en Configuración, con los dos mensajes editables. Necesita la migración `0027` y un cron en el VPS (`docs/19-vps.md`).

### Nuevo
- Referencias y tallas en los productos (T-104): en el catálogo cada producto puede tener una referencia ("102") y opciones con el nombre que elija el negocio (tallas, colores, tamaños). El bot pregunta la talla antes de cerrar el pedido, entiende "6 de la 30 y 6 de la 32", no acepta una talla que no existe y reconoce "mándeme la 102". La talla aparece en el resumen, en el aviso a la dueña y en el panel de pedidos; el inventario suma las tallas del mismo producto.

### Nuevo
- Respaldo diario de la base desde el VPS (T-101): `deploy/respaldo-db.sh` saca una copia con `pg_dump` cada noche y guarda las últimas 14. El despliegue copia el script; la configuración (una sola vez) está en `docs/19-vps.md`.

### Arreglos
- `/api/health` responde 503 si en producción faltan las variables de Supabase (T-100): antes respondía 200 con "sin configurar" mientras la app guardaba en un archivo que se borra en cada despliegue, y el monitor no avisaba.

## [1.2.0] — 2026-11-18

### Seguridad
- Límite de mensajes por número (T-99): si un mismo contacto manda más de 15 mensajes en un minuto o 120 en una hora, se le avisa una vez que espere y no se gasta IA en el resto hasta que baje el ritmo. La dueña no tiene límite.
- Defensa contra inyección de prompt (T-98): antes de mandarle al cliente lo que escribió la IA, se revisa que no prometa precios, descuentos o regalos que el negocio no tiene ni deje ver sus instrucciones; si pasa, se manda una respuesta segura. En el modo guiado, la versión reformulada por la IA solo se usa si no cambia montos ni números de cuenta. Los prompts del agente, de comprobantes y de fotos tratan lo que manda el cliente como datos, nunca como órdenes. Batería de ataques en `src/core/ai/inyeccion.test.ts`.
- Cabeceras de seguridad en todo el sitio (T-97): ninguna otra página puede mostrar la app dentro de un marco, HTTPS obligatorio, sin adivinar tipos de archivo, sin filtrar rutas al salir, cámara/micrófono/ubicación apagados y sin anunciar la versión de Next.

## [1.1.1] — 2026-11-16

### Arreglos
- Landing: la línea de escaneo del comprobante se dibuja como un escáner (estela suave, línea corta y la etiqueta "Revisando…"), pasa por detrás del texto y solo se muestra en escritorio; en el celular parecía una raya de error. Los checks de cada dato siguen apareciendo en los dos.

## [1.1.0] — 2026-11-15

### Nuevo
- Marca Aurela: el producto pasa a llamarse Aurela en toda la app (landing, login, portal,
  back office, páginas legales, SEO y mensajes del bot), con paleta ciruela y oro, logo de la
  burbuja con corona y favicons nuevos.
- Landing de venta en la portada (T-80 a T-87): qué hace Aurela, cómo funciona, para qué
  negocios, instalación, precio (desde $79.900 al mes, instalación gratis, 14 días de prueba,
  sin permanencia) y preguntas frecuentes. La sección "Quién está detrás" solo aparece cuando
  se configuran el nombre y la foto del responsable.
- Animaciones de la landing (T-91 a T-95), solo con CSS y quietas con "reducir movimiento":
  - el teléfono del hero cuenta un pedido con final feliz (nota de voz, resumen, comprobante,
    "Pago verificado", la dueña aprueba y el cliente recibe su código de retiro);
  - una línea de escaneo recorre el comprobante de ejemplo y marca cada dato (la fecha, en
    ámbar: "Hace 12 días");
  - "Así funciona" se llena al bajar y cada paso se enciende;
  - el precio es un ticket "Su cuenta" que se imprime línea por línea;
  - talones del pedido #128 entre secciones.
- SEO (T-89): título "Aurela · Pedidos, citas y pagos por WhatsApp en Cúcuta", imagen para
  redes generada con código y datos estructurados con la oferta en COP.

### Cambios
- El bot y todas las pantallas le hablan de usted al cliente y a la dueña, en español de
  Colombia (T-78, T-79). `pnpm quitar:voseo --aplicar` corrige lo que ya está guardado en la
  base: correrlo el día de esta release.
- Cada botón de WhatsApp de la landing dice qué va a pasar ("Probarlo en mi negocio", "Pedir
  instalación gratis"…); solo la barra fija del celular dice "Escríbanos por WhatsApp".
- Los chats de ejemplo muestran todas las respuestas reales del bot, sin saltos ni notas de
  "conversación de ejemplo".

### Arreglos
- Citas (T-88): "Corte caballero" ya no agenda "Corte dama" cuando dos servicios comparten una
  palabra clave; la hora del primer mensaje ("¿tiene turno hoy a las 5?") se recuerda; y
  "p. m." llega bien a la confirmación.
- Login: "Volver al inicio" y el logo llevan a la página principal (antes solo se podía volver
  con el botón atrás del navegador).
- Páginas legales: el contacto del responsable muestra un solo teléfono.

## [1.0.2] — 2026-11-15

### Cambios
- Dominio propio (T-96): la app responde en `soyaurela.com`, y `www.soyaurela.com` lleva
  ahí. Durante el cambio también sigue respondiendo en la dirección anterior
  (`DOMINIO_ANTERIOR`), para que el webhook de Meta y los links de Supabase no se corten.

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
