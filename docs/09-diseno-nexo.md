# Handoff: Nexo — Bot de WhatsApp por rubros (Back office + Portal cliente + Móvil)

## Overview
Plataforma SaaS para que un negocio automatice su atención por WhatsApp. Un **dueño de negocio** se loguea, elige el **rubro/negocio** que quiere gestionar y edita el **catálogo/menú**, las **citas/reservas** y las **respuestas del bot (IA + reglas)**; a la derecha ve una **vista previa en vivo del chat de WhatsApp**. Por encima existe un **back office** para el **dueño de la aplicación (admin)** que da de alta usuarios y negocios, crea **rubros-plantilla** (que definen qué campos gestiona cada negocio) y ve todos los leads.

Este handoff cubre el flujo completo diseñado en el prototipo:
- **Login** con selector de rol (Dueño de negocio / Administrador).
- **Portal cliente** (`/portal`): grid de rubros → panel → Resumen, Catálogo, Citas, Respuestas, Conversaciones, Configuración.
- **Back office** (`/backoffice`): Negocios, Usuarios, Rubros (plantillas), Leads.
- **Vista móvil** de las pantallas clave del portal.

## About the Design Files
Los archivos de este bundle son **referencias de diseño creadas en HTML** (`Flujo Bot WhatsApp.dc.html`), no código de producción para copiar tal cual. Muestran el **look & feel y el comportamiento** buscados. La tarea es **recrear estos diseños dentro del repo existente** `client-automation-bot` (Next.js 16 + React 19 + Tailwind v4) usando sus patrones y su capa de datos (Supabase). El HTML está construido con un runtime propio de componentes (`support.js`); **no** hay que portar ese runtime: sólo tomar layout, tokens, copy e interacciones y reimplementarlos como componentes React/Tailwind.

Para abrir el prototipo localmente: servir la carpeta y abrir `Flujo Bot WhatsApp.dc.html` (necesita `support.js` en el mismo directorio, incluido en el bundle).

## Fidelity
**Alta fidelidad (hi-fi).** Colores, tipografía, espaciados, radios e interacciones son finales. Recrear la UI pixel-perfect con los tokens listados abajo. Los datos son de ejemplo (mock); conectar a Supabase según el mapeo del final.

---

## Roles y ruteo
Tres roles (columna `role` en `profiles`): `admin`, `cliente`, `invitado`.
- **Login** → según rol: `admin` ⇒ `/backoffice`, `cliente` ⇒ `/portal`. (En el prototipo el rol se elige con tabs sólo para demo; en producción sale de Supabase Auth + `profiles.role`.)
- Middleware protege `/portal` y `/backoffice`. RLS por rol en cada tabla.

---

## Screens / Views

### 1. Login  (`/login`)
- **Layout:** dos columnas a pantalla completa. Izquierda (flex 1.05): panel oscuro `#0E2033` con glow radial azul, logo "Nexo" arriba, titular grande, subtítulo, y un mini-chat de muestra (2 burbujas). Derecha (ancho 520, máx 46%): fondo blanco, formulario centrado máx 364px.
- **Componentes derecha:** título "Iniciar sesión" (800/25px), subtítulo (#667085); **segmented control de rol** (fondo `#F2F4F7`, pill activo blanco con sombra) con "Dueño de negocio" / "Administrador"; inputs Correo y Contraseña (borde `#D0D5DD`, radio 10, foco azul con ring `rgba(42,111,219,.12)`); link "¿Olvidaste tu contraseña?"; botón primario "Ingresar" (bg `#2A6FDB`, hover `#1F5BC0`, full width, radio 10); divisor "o"; botón outline "Continuar con Google"; pie "¿No tenés cuenta? Creá tu negocio".
- **Comportamiento:** "Ingresar"/Google → si rol Administrador ⇒ back office; si Dueño ⇒ grid de rubros.

### 2. Portal cliente — Selección de rubro  (`/portal`)
- **Propósito:** un cliente puede tener varios negocios/rubros; acá elige cuál gestionar.
- **Layout:** topbar blanca (logo + nombre usuario + avatar). Cuerpo centrado máx 900px: eyebrow "TUS NEGOCIOS" (azul), h1 "Hola, {nombre}", subtítulo, y **grid 2 columnas** de tarjetas.
- **Tarjeta de negocio:** icono en tile de color del rubro (44–52px, radio 13–14), pill de estado del bot (Activo verde / Pausado ámbar) arriba a la derecha, nombre (700/17.5px), "{rubro} · {tag}", pie con "{n} mensajes hoy" y "Abrir →". Hover: borde `#B2CCF4`, sombra elevada, translateY(-2px). Última tarjeta punteada "Agregar otro negocio".

### 3. Portal cliente — Shell del panel
- **Sidebar (250px, blanco):** logo; **switcher de negocio** (tile + nombre + rubro + chevrons; despliega lista de negocios + "Ver todos los rubros"); nav "GESTIÓN DEL BOT": Resumen, {Menú|Servicios|Catálogo} (label según rubro), Citas y reservas, Respuestas y flujos; grupo "ATENCIÓN": Conversaciones, Configuración; pie con usuario + logout. Ítem activo: texto `#1F5BC0`, fondo `rgba(42,111,219,.09)`.
- **Topbar (64px):** título + subtítulo de sección; a la derecha pill **toggle del bot** (Activo verde / Pausa ámbar, clickeable), campana con badge, avatar.
- **Área de contenido:** `overflow-y:auto; overflow-x:hidden; padding:20px`. Fila flex con wrap: **columna de trabajo** (flex 1 1 460px, min 420) + **columna de preview** (290px) que aparece sólo en editores.

### 4. Resumen (dashboard)
- Grid 4 KPIs (Mensajes hoy, Citas agendadas, Resueltas por el bot %, Tiempo de respuesta; número en Sora 700/27). Delta en verde.
- Card "Completá tu bot" (checklist 2/4 con barra de progreso; ítems con check verde / círculo vacío; botón "Continuar configuración").
- Card "Conversaciones recientes" (lista con avatar, nombre + badge Bot/Vos, último mensaje, hora).

### 5. Catálogo / Menú (editor + preview)
- **Columna de trabajo:** toolbar (buscador + botón "Agregar"); **lista de ítems** (tile con inicial, nombre, "{categoría} · {precio}", **toggle de disponibilidad**; ítem seleccionado con borde/fondo azul claro); debajo, **card "Editar producto"** con toggle Disponible y campos Nombre, Precio (prefijo $), Categoría, Descripción (textarea). Nota "Los cambios se reflejan al instante en el chat del bot →".
- **Preview (teléfono WhatsApp):** header verde `#008069` con avatar y "en línea/bot en pausa"; cuerpo `#EFEAE2` con separador "HOY"; burbujas entrantes blancas / salientes `#D9FDD3`; **tarjeta de producto** (imagen placeholder rayada con la inicial, categoría en verde, título, precio en `#008069`, descripción, CTA "Agregar al pedido"/"Reservar turno"); botones de respuesta rápida (blanco, texto `#0A94D6`); barra de input.
- **Live:** editar Nombre/Precio/Descripción o cambiar de ítem actualiza la tarjeta del preview al instante.

### 6. Citas y reservas (editor + preview)
- Card "Servicios reservables" (lista con icono calendario, nombre, meta, toggle on/off). Card "Horarios de atención" (filas día + rango + toggle; día off en gris). Card "Próximas reservas" (avatar, nombre, servicio · fecha, pill Confirmada/Pendiente).
- **Preview:** flujo de reserva — cliente pide turno → bot ofrece servicios (botones) → ofrece horarios (botones) → confirma la reserva.

### 7. Respuestas y flujos (IA + reglas) (editor + preview)
- Card "Cerebro con IA": icono, toggle on/off, textarea "Información del negocio" (conocimiento con el que responde la IA).
- Card "Reglas rápidas": lista de reglas = **chips de palabras clave** + input de respuesta; "+ Agregar regla". Nota: las reglas tienen prioridad sobre la IA.
- Card "Botones de menú" (accesos rápidos, reordenables) + Card "Si el bot no entiende" (mensaje fallback + toggle "Derivar a una persona").
- **Preview:** pregunta en lenguaje natural → nota "Respondido con IA" → respuesta; luego pregunta por palabra clave → nota "Regla · 'horario'" → respuesta de la regla; luego botones de menú. Editar la info o la respuesta de una regla cambia el preview en vivo.

### 8. Conversaciones (bandeja)
- Dos paneles: **lista de chats** (buscador + filas con avatar, nombre + badge Bot/Vos, último mensaje, hora, badge de no leídos verde) y **hilo activo** (header con avatar + "en línea", pill "Bot respondiendo" + botón "Tomar chat"; cuerpo estilo WhatsApp; input + enviar). Seleccionar un chat cambia el hilo.

### 9. Configuración
- Card "Datos del negocio": Nombre (solo lectura), Rubro (chip), WhatsApp conectado (con punto verde), Dirección.
- Card "El bot": Nombre del bot (editable), Tono (segmented Cercano/Neutral/Formal).

### 10. Back office — Shell (`/backoffice`, rol admin)
- **Sidebar oscuro (250px, `#101828`)** para distinguir del portal: logo "Nexo · BACK OFFICE"; nav PLATAFORMA: Negocios, Usuarios, Rubros (plantillas), Leads (ítem activo: texto blanco, fondo `rgba(255,255,255,.09)`); pie con "Ver portal cliente" (cambia a `/portal`) + usuario admin + logout.
- **Topbar:** título + subtítulo + botón de acción primaria por sección (Nuevo negocio / Invitar usuario / Nueva plantilla / Exportar CSV) + avatar.

### 11. Back office — Negocios
- Fila de 4 stats (Negocios activos, Clientes, Rubros, Leads hoy).
- **Tabla** (grid) columnas: NEGOCIO (tile + nombre), RUBRO, CLIENTE, ESTADO (pill Activo/Pausado con punto), LEADS (Sora), PLAN (pill Pro/Free). Muestra negocios de **todos** los clientes.

### 12. Back office — Usuarios y clientes
- **Tabla** columnas: USUARIO (avatar + nombre), EMAIL, ROL (pill Cliente/Administrador), NEGOCIOS (cantidad), RUBROS ASIGNADOS. Acción "Invitar usuario".

### 13. Back office — Rubros (plantillas)  ← define el CRUD de cada negocio
- Banner informativo: "Cada plantilla define los campos que un negocio de ese rubro podrá cargar (su CRUD) y el tipo de citas. Al asignar un rubro a un cliente, su negocio hereda esta estructura."
- **Grid 2 columnas de cards de plantilla:** tile de icono del rubro, nombre, "{n} negocios", pill estado (Publicado/Borrador), sección "CAMPOS DEL NEGOCIO" (chips: p.ej. Plato, Precio, Categoría, Foto, Disponible), "Citas: {tipo}", link "Editar plantilla".
- **Este es el punto donde el dueño de la app modela el CRUD** que luego el cliente rellena en el portal (Catálogo/Citas).

### 14. Back office — Leads
- **Tabla** columnas: NEGOCIO, CONTACTO, CANAL (WhatsApp con punto verde), FECHA, ESTADO (pill). Leads capturados por los bots de todos los negocios.

### 15. Vista móvil (pantallas clave del portal)
- Botón flotante "Vista móvil" (abajo-derecha, negro, sólo fuera de login/backoffice) abre una galería con 3 marcos de teléfono: **Login**, **Selección de rubro** (tarjetas apiladas), **Panel** (KPIs 2×2 + progreso + **tab bar inferior**: Resumen, Menú, Citas, Chats). Botón "Volver al escritorio".
- **Responsive del portal:** debajo de ~1080px el teléfono de preview se apila **debajo** del editor (no scroll horizontal). La columna de trabajo tiene min 420px; el preview 290px.

---

## Interactions & Behavior
- **Navegación por estado** (sin recarga): `screen` = login | rubros | app | backoffice | mobile; en portal `section`; en back office `adminSection`.
- **Toggles** (disponibilidad de ítem, servicio reservable, día, IA, handoff, bot activo): pista 36×20 (18–22 en el editor), knob blanco que desliza; verde `#12B76A` on / gris `#D0D5DD` off; transición .15s.
- **Live preview:** inputs controlados; cada cambio re-renderiza la burbuja/tarjeta del teléfono.
- **Switcher de negocio** y **tabs de rol/tono**: segmented con pill activo blanco + sombra.
- **Hover:** tarjetas (borde azul claro + sombra + translateY), botones (oscurecen), filas de lista (fondo `#F9FAFB`).
- **Entradas:** `fadeUp .3–.35s` al montar cada pantalla; dropdown del switcher `pop .14s`.
- **Focus inputs:** borde `#2A6FDB` + ring `rgba(42,111,219,.12)`.

## State Management
- **Global:** `screen`, `loginRole`.
- **Portal:** `activeBiz` (índice de negocio), `section`, `switcherOpen`, `statusById` (estado bot por negocio), `selById` (ítem seleccionado por negocio), `catalogs` (ítems por negocio), `hours`, `citasById`, `respById` (ai, knowledge, rules[], quick[], fallback, handoff), `convSel`, `botName`, `botTone`.
- **Back office:** `adminSection`; datos de negocios/usuarios/rubros(plantillas)/leads.
- En producción, cada uno mapea a queries Supabase (ver mapeo). Inputs controlados → mutaciones optimistas → persistencia.

## Design Tokens
**Tipografía:** `Plus Jakarta Sans` (400/500/600/700/800) UI; `Sora` (600/700) para números/KPIs. (En el repo ya está Geist; se puede migrar a Plus Jakarta Sans o mantener Geist — el sistema de layout no cambia.)
**Color — marca/UI**
- Primario `#2A6FDB`, hover `#1F5BC0`, claro `#4C8DFF`, tinte `#EFF5FF` / `rgba(42,111,219,.09)`
- Texto `#101828`, medio `#475467`, tenue `#98A2B3`, muy tenue `#B4BAC5`
- Superficie `#FFFFFF`, lienzo `#F6F7F9`, superficie-2 `#F2F4F7` / `#F9FAFB`
- Borde `#EAECF0` / `#E4E7EC`; borde input `#D0D5DD`
- Sidebar back office `#101828`
**Semánticos**
- Éxito `#12B76A` (texto `#067647`, bg `#ECFDF3`) · Aviso `#F79009` (texto `#B54708`, bg `#FFFAEB`)
**WhatsApp (preview)**
- Header `#008069`, fondo chat `#EFEAE2`, burbuja saliente `#D9FDD3`, entrante `#FFFFFF`, botón respuesta texto `#0A94D6`, sello "HOY" bg `#FFF6D5`
**Rubros (tinte / tinta de icono)**
- Gastronomía `#FFF1E6` / `#E8590C` · Servicios `#F3EEFF` / `#7C3AED` · Salud y Bienestar `#E7F7F0` / `#0E9F6E` · Comercio minorista `#EEF2F6` / `#475467`
**Radios:** 8, 9, 10, 11, 12, 14, 16; pills 20 / 30; teléfono 34–38.
**Sombras:** card `0 1px 2px rgba(16,24,40,.05)`; elevada `0 10px 28px -14px rgba(16,24,40,.22)`; FAB `0 14px 32px -10px rgba(16,24,40,.55)`.
**Espaciado:** base 4/8; padding de contenido 20–24; gaps 8/12/14/16.

## Assets / Iconos
- **Iconos:** SVG monolínea inline estilo Lucide (grid, bolsa, calendario, mensaje, chat, sliders, tijera, círculo/plato, cruz, campana, logout, buscar, enviar, chevrons, store, users, layers, inbox, swap). Reemplazar por el set de iconos del repo (p.ej. `lucide-react`).
- **Imágenes de producto:** placeholder rayado con inicial. En producción usar la foto del ítem (Supabase Storage).
- **Logo Nexo:** tile azul con glifo de burbuja de chat (placeholder de marca; sustituir por la marca real).
- **Sin logotipos de terceros:** el chat "evoca" WhatsApp con la paleta, sin reproducir el logo de WhatsApp.

## Mapeo al repo (client-automation-bot + Supabase)
- **/login** → Supabase Auth; leer `profiles.role`; redirigir admin→/backoffice, cliente→/portal. Middleware protege ambas.
- **/portal** (cliente, RLS = filas propias):
  - Grid de rubros ← `asignaciones` (rubros/negocios asignados al cliente).
  - Crear negocio desde plantilla ← `rubros` (plantilla) → inserta en `negocios`.
  - Catálogo/Citas/Respuestas ← contenido del `negocio` (campos según la plantilla del rubro).
  - Conversaciones/Leads ← `sesiones` / `leads` del negocio.
- **/backoffice** (admin, RLS = todo):
  - Negocios ← `negocios` (join `profiles` cliente, `rubros`).
  - Usuarios ← `profiles` (+ `asignaciones`).
  - Rubros (plantillas) ← `rubros`: nombre, estado, **campos del negocio (schema del CRUD)**, tipo de citas. Editar/crear plantilla + asignar a cliente (`asignaciones`).
  - Leads ← `leads` (todos).
- **/demo** → chat público = el componente de preview de WhatsApp con un negocio de ejemplo.
- **Bot** → resuelve negocio dinámicamente desde Supabase (orden: Supabase > Sheets del negocio > JSON local); las "Respuestas y flujos" = IA (knowledge) + reglas (keyword→respuesta) + fallback/handoff.

## Files
- `Flujo Bot WhatsApp.dc.html` — prototipo hi-fi completo (todas las pantallas de arriba).
- `support.js` — runtime del prototipo (sólo para poder abrir el HTML; **no** portar al repo).

## Screenshots
Capturas de referencia en `screenshots/` (en orden de flujo):
1. `01-login.png` — Login con selector de rol (Dueño / Administrador)
2. `02-rubros.png` — Portal: selección de rubro/negocio
3. `03-panel-resumen.png` — Portal: Resumen (KPIs + checklist + recientes)
4. `04-catalogo.png` — Portal: Catálogo/Menú + preview WhatsApp
5. `05-citas.png` — Portal: Citas y reservas + preview
6. `06-respuestas.png` — Portal: Respuestas y flujos (IA + reglas) + preview
7. `07-conversaciones.png` — Portal: bandeja de Conversaciones
8. `08-configuracion.png` — Portal: Configuración
9. `09-movil.png` — Vista móvil (login, rubros, panel con tab bar)
10. `10-backoffice-negocios.png` — Back office: Negocios
11. `11-backoffice-rubros-plantillas.png` — Back office: Rubros (plantillas / CRUD)
12. `12-backoffice-usuarios.png` — Back office: Usuarios y clientes
13. `13-backoffice-leads.png` — Back office: Leads

Nota: las capturas se tomaron a ~910px de ancho; en el editor, el teléfono de preview aparece debajo del formulario (a ≥1080px va al costado, como describe cada sección).
