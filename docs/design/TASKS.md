# Flujo de tareas — qué falta para llevar el diseño a producción

Backlog para Claude Code sobre el repo `client-automation-bot` (Next.js + Tailwind + Supabase).
El diseño de referencia y sus pantallas están descritos en `README.md`; las capturas, en `screenshots/`.

Convención de estado:
- **[Diseñado]** — existe en el prototipo, falta implementarlo.
- **[Falta diseño]** — todavía no está resuelto visualmente; hay que diseñarlo antes o durante.

---

## Fase 0 — Base y auth
1. **[Diseñado]** Pantalla de login con Supabase Auth (email/contraseña + Google). Leer `profiles.role` y redirigir: `admin → /backoffice`, `cliente → /portal`.
   - Nota: el selector de rol del prototipo es sólo demo. En producción el rol viene de la base, no del formulario.
2. **[Diseñado]** Middleware que protege `/portal` y `/backoffice`, y redirige según rol.
3. **[Falta diseño]** Recuperar contraseña, aceptar invitación / definir contraseña, verificación de email.
4. **[Falta diseño]** Estados de error de login (credenciales inválidas, cuenta suspendida) y loading del botón.

## Fase 1 — Back office: lectura
5. **[Diseñado]** Layout del back office (sidebar oscuro, topbar con acción primaria por sección).
6. **[Diseñado]** Negocios: tabla + 4 stats calculados desde datos reales.
7. **[Diseñado]** Usuarios: tabla con rol y rubros asignados.
8. **[Diseñado]** Rubros (plantillas): grid de cards con campos y tipo de citas.
9. **[Diseñado]** Leads: tabla (sin exportación por ahora).
10. **[Falta diseño]** Estados vacíos de cada tabla ("todavía no hay negocios"), skeletons de carga, paginación y filtros/orden.

## Fase 2 — Back office: escritura (CRUD)
11. **[Diseñado]** Modal **Nuevo/Editar negocio**: cliente dueño, rubro-plantilla, campos heredados (preview), WhatsApp, plan. Nace `Pausado`.
12. **[Diseñado]** Modal **Invitar/Editar usuario**: rol y rubros asignados (escribe en `profiles` + `asignaciones`); disparar email de invitación.
13. **[Diseñado]** Modal **Nueva/Editar plantilla de rubro**: nombre, **campos del CRUD**, tipo de citas, estado Borrador/Publicado.
14. **[Diseñado]** Menús de fila: ver detalle, editar, pausar/activar bot, eliminar.
15. **[Diseñado]** Detalle de negocio: métricas, plantilla heredada, datos, eliminar.
16. **[Falta diseño]** **Confirmación de borrado** (hoy elimina directo) y avisos de impacto: qué pasa con los negocios de un rubro que se elimina, o con los negocios de un usuario eliminado.
17. **[Falta diseño]** Validación de formularios (campos requeridos, email duplicado) y toasts de éxito/error.
18. **[Falta diseño]** Editar una plantilla que ya tiene negocios: migración de campos (renombrar/eliminar un campo con datos cargados).

## Fase 3 — Portal cliente
19. **[Diseñado]** Grid de rubros/negocios asignados + "Agregar otro negocio".
20. **[Diseñado]** Shell del panel (switcher de negocio, nav, toggle del bot).
21. **[Diseñado]** Resumen: KPIs, checklist "Completá tu bot", conversaciones recientes.
22. **[Diseñado]** Catálogo: lista + formulario + disponibilidad, con preview de WhatsApp en vivo.
    - **[Falta diseño]** Los campos del formulario deben **generarse desde la plantilla del rubro** (form dinámico), no ser fijos.
    - **[Falta diseño]** Carga de imágenes (Supabase Storage): dropzone, recorte, estado de subida.
23. **[Diseñado]** Citas: servicios reservables, horarios, próximas reservas.
    - **[Falta diseño]** Calendario real (vista semana/día), excepciones y feriados, duración y solapamiento, cancelar/reprogramar.
24. **[Diseñado]** Respuestas y flujos: conocimiento para IA, reglas por palabra clave, botones de menú, fallback y derivación.
    - **[Falta diseño]** Reordenar botones (drag), editar palabras clave de una regla, probar una respuesta contra el bot real.
25. **[Diseñado]** Conversaciones: bandeja + hilo, "Tomar chat".
    - **[Falta diseño]** Tiempo real (suscripción), no leídos, búsqueda, adjuntos, notas internas.
26. **[Diseñado]** Configuración: datos del negocio, nombre y tono del bot.
    - **[Falta diseño]** **Conectar WhatsApp** (flujo completo: QR o API oficial, estados conectado/caído/reconectando). Es la pieza más crítica que falta.
    - **[Falta diseño]** Medios de pago y envíos (aparece en el checklist del Resumen pero no tiene pantalla).

## Fase 4 — Bot y datos
27. **[Diseñado, parcial]** Resolver el negocio dinámicamente desde Supabase (ya existe con fallback); alimentarlo con catálogo, horarios, reglas y knowledge del portal.
28. **[Falta diseño]** Prioridad IA vs. reglas y logs de por qué respondió lo que respondió (debug para el cliente).
29. **[Falta diseño]** Captura de leads: qué convierte una conversación en lead y con qué estados.
30. **[Diseñado]** `/demo`: chat público con negocio de ejemplo (reutiliza el componente de preview).

## Fase 5 — Móvil y pulido
31. **[Diseñado]** Portal responsive: preview apilado bajo el editor, tab bar inferior en el panel.
32. **[Falta diseño]** Back office en móvil (las tablas de 6–7 columnas no entran; hacen falta cards).
33. **[Falta diseño]** Accesibilidad: foco visible, navegación por teclado en menús y modales, `aria` en toggles.
34. **[Falta diseño]** Onboarding del primer negocio (wizard) y estado "sin negocios" del portal.
35. **[Falta diseño]** Roles extra: agente/empleado con acceso sólo a Conversaciones (hoy el diseño asume un solo dueño).

---

## Orden sugerido
Fase 0 → 1 → 2 → 3 (Catálogo y Configuración/WhatsApp primero, que desbloquean el bot) → 4 → 5.

## Decisiones abiertas para el dueño del producto
- ¿Cómo se conecta WhatsApp: API oficial de Meta o sesión por QR? Define toda la Fase de conexión.
- ¿Los planes Free/Pro tienen límites reales (negocios, mensajes)? Si sí, hace falta diseñar los bloqueos.
- ¿Un cliente puede crear negocios por su cuenta o siempre los crea el administrador?
- ¿Se necesita el rol agente/empleado en la primera versión?
