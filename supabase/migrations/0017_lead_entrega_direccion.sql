-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0017: modalidad de entrega y dirección en `leads` (T-36).
--
-- `entrega` existía en el lead desde antes pero nunca se guardó en Supabase:
-- se perdía al recargar el lead entre un mensaje y el siguiente. La 0009
-- asumía que la modalidad "rara vez sobrevive más de un mensaje", y con la
-- dirección de un pedido a domicilio eso ya no es cierto: el cliente elige
-- "Domicilio", después escribe la dirección y después confirma — tres
-- mensajes distintos.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0016
-- y ANTES de desplegar el código de T-36: el bot escribe estas columnas en
-- cada mensaje, y sin ellas Supabase rechaza el guardado del lead.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.leads
  add column entrega text,
  add column direccion text;
