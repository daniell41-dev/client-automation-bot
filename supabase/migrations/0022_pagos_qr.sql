-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0022: imagen del QR de cobro del negocio (T-45).
--
-- La dueña sube el QR de su Nequi / Bancolombia / Bre-B desde el portal y el
-- bot se lo manda al cliente junto con los datos de las cuentas.
--
-- Bucket PÚBLICO, a diferencia de `comprobantes` (0018): WhatsApp descarga la
-- imagen desde el link que le pasa el bot, sin credenciales, y un QR de cobro
-- está hecho justamente para compartirse — no trae nada que no se le dé a
-- cada cliente. Lo que no es público es la escritura: sube el servidor
-- (service role) después de comprobar que el negocio es de quien sube, así
-- que no hace falta ninguna política de insert.
--
-- Tope de 2 MB y solo imágenes, para que nadie use el bucket de hosting.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0021.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pagos-qr', 'pagos-qr', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
