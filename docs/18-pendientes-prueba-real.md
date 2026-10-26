# Pendientes de la prueba real (oct-2026)

Lo que quedó por hacer de la prueba de punta a punta con el número real del negocio
(SIM nueva, `phone_number_id` 1446492051875113, negocio "Sabores del Sur"). Cuando se
retome, seguir en este orden. La guía completa sigue siendo `docs/17-prueba-local.md`.

## 1. Antes de probar (una vez)

- [ ] Supabase: correr la migración `0023_duena_escribio.sql`.
- [ ] `git pull` en `develop` y reiniciar `pnpm dev` (sin reiniciar corre el código viejo).
- [ ] Opcional: `GEMINI_MODEL` con un modelo "flash" no lite (ver `pnpm ai:doctor`).

## 2. Plantilla de aviso a la dueña

- [x] Plantilla `aviso_pedido_aprobacion` creada en Meta (Servicio, Spanish, botones
      Aprobar / Rechazar, validez extendida) y enviada a revisión.
- [ ] Esperar que quede **Activa** en Administrador de WhatsApp → Administrar plantillas.
- [ ] `.env.local`:
      ```
      WHATSAPP_TEMPLATE_APROBACION=aviso_pedido_aprobacion
      WHATSAPP_TEMPLATE_IDIOMA=es
      WHATSAPP_TEMPLATE_BOTONES=true
      ```
- [ ] Si Meta pide método de pago para mandar plantillas: cargarlo en WhatsApp Manager.
- [ ] Si la terminal dice "template name does not exist" o algo del idioma: revisar el
      código de idioma que muestra Meta junto al nombre y ajustar `WHATSAPP_TEMPLATE_IDIOMA`.

## 3. Pruebas pendientes

Usar el plato "Plato de prueba" ($400) y **recoger en el local** para transferir poco.

- [ ] **Aviso con plantilla:** la dueña NO le escribe al bot antes. Pedido completo con
      comprobante real → le llega la plantilla con Aprobar / Rechazar → aprueba → al
      cliente le llega número de pedido y código de retiro.
- [ ] **Panel de pedidos:** el pedido aparece con la foto del comprobante; Listo (al
      cliente le llega el aviso) y Entregar con el código.
- [ ] **Comprobante repetido:** misma captura en un pedido nuevo → ⚠️ referencia repetida;
      la dueña rechaza y al cliente le llega el aviso.
- [ ] **Monto distinto:** 2 platos ($800) con comprobante de $400 → ⚠️ monto distinto.
- [ ] **Cuenta equivocada:** transferir a otra cuenta propia → ⚠️ se pagó a otro número.
- [ ] **Dos pedidos a la vez** (necesita un tercer celular): "sí" suelto no aprueba nada;
      "Aprobar #2" aprueba solo ese.
- [ ] **Nota de voz:** pedido completo por audios.
- [ ] **Medidor:** Back office → Negocios → columna "WhatsApp (mes)".

Si algo falla: captura del chat + las líneas `[Agent]` y `[WhatsApp]` de la terminal.

## 4. Antes de vender

- [ ] Verificación de la empresa en Meta (RUT de persona natural) — sin esto, 2 números.
- [ ] Publicar la app de Meta (pide URL de política de privacidad: falta la página `/privacidad`).
- [ ] Subir Nexo a Vercel (que no dependa de la compu ni de ngrok).
- [ ] Borrar el admin de ejemplo `tucorreo@dominio.com` (su clave quedó escrita en la conversación).
- [ ] Capa paga de Gemini con tope de gasto (límites diarios y privacidad), ver T-56.

## 5. Lo que se arregló durante la prueba (referencia)

T-47 a T-59: plato sin duración no se puede "reservar"; el pedido pasa siempre por el
resumen con total; el agente no pierde modalidad/dirección/nombre/carrito (campos exactos
en el prompt + alias); no inventa cuentas ni costos; costo de domicilio configurable;
la cantidad se fija y no se suma; "empezar de nuevo" vacía el carrito; quitar productos;
los envíos que Meta no entrega quedan en la terminal; el aviso a la dueña sale con
plantilla cuando su ventana de 24h está cerrada.
