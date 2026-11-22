-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0030: de qué anuncio viene cada cliente (T-120).
--
-- Cuando alguien escribe desde un anuncio Click-to-WhatsApp, Meta manda el
-- `referral` con el anuncio en el primer mensaje. El bot lo guarda en el lead
-- la primera vez (nunca lo pisa) para:
--   · decirle a la dueña en el aviso "Llegó por: anuncio «…»",
--   · mostrarlo en el panel de pedidos,
--   · contar en el portal cuántos clientes trajo cada anuncio.
--
--   origen: { tipo: 'anuncio' | 'publicacion', id?, titulo?, texto?, url? }
--           null si el cliente escribió por su cuenta.
--
-- jsonb y no columnas sueltas: Meta no garantiza ningún campo y el bot lo lee
-- con `leerOrigen` (src/core/engine/origen.ts), que descarta lo mal formado.
-- La dueña lo lee con las políticas que ya tiene `leads` (`leads_own`, 0001).
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0029.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.leads
  add column if not exists origen jsonb;
