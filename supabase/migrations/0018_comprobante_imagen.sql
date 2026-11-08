-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 0018: la foto del comprobante, guardada (T-38b).
--
-- Hasta acá la imagen se procesaba en memoria y se descartaba: la dueña veía
-- lo que la IA LEYÓ del comprobante, pero nunca el comprobante. En un día de
-- muchos pedidos, mirar la foto al lado del pedido es la forma rápida de
-- notar un pantallazo editado.
--
-- Bucket PRIVADO: un comprobante trae nombre, banco y a veces número de
-- cuenta del cliente. Nunca se sirve con una URL pública; el panel genera una
-- URL firmada que vence. La ruta es `<negocio_id>/<comprobante_id>`, y la
-- política deja leer solo la carpeta de los negocios de quien consulta.
--
-- Aplicar en el SQL Editor del dashboard de Supabase, después de 0001-0017.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.comprobantes
  add column imagen_path text;

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

-- Solo lectura para la dueña: sube el bot (service role, que no pasa por RLS).
create policy comprobantes_imagen_own on storage.objects
  for select using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] in (
      select id::text from public.negocios where owner_id = auth.uid()
    )
  );

create policy comprobantes_imagen_admin on storage.objects
  for select using (bucket_id = 'comprobantes' and public.is_admin());
