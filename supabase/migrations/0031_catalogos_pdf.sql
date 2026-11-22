-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0031: catálogo en PDF del negocio (T-121).
--
-- La dueña sube el PDF de su catálogo desde el portal (Configuración) y el
-- bot se lo manda al cliente por WhatsApp al saludar (si ella lo activó) o
-- cuando el cliente pide "el catálogo".
--
-- Bucket PÚBLICO, igual que `pagos-qr` (0022): WhatsApp descarga el archivo
-- desde el link que le pasa el bot, sin credenciales. Por eso el portal le
-- avisa a la dueña, junto al botón de subir, que no suba nada privado: quien
-- tenga el link lo puede abrir. La escritura no es pública: sube el servidor
-- (service role) después de comprobar que el negocio es de quien sube, así
-- que no hace falta ninguna política de insert.
--
-- Tope de 10 MB y solo PDF, para que nadie use el bucket de hosting.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0030.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogos', 'catalogos', true, 10485760, array['application/pdf'])
on conflict (id) do nothing;
