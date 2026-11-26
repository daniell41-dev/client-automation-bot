"use client";

/**
 * T-117: pantalla "Importar productos". Todo el trabajo con el archivo pasa
 * aquí, en el navegador de la dueña: el servidor nunca procesa un archivo
 * arbitrario, solo recibe los productos ya leídos y los vuelve a validar.
 *
 * Pasos: 1) elegir el archivo, 2) (solo si no se reconoce el formato)
 * decir qué columna es cada cosa, 3) ver qué va a pasar (nuevos,
 * actualizados, filas con error) y 4) confirmar. Nada se guarda antes del 4.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, FileUp } from "lucide-react";
import { parsearCsv, type TablaCsv } from "@/core/catalogo/csv";
import {
  ENCABEZADOS_PLANTILLA_AURELA,
  combinarCatalogo,
  detectarFormato,
  leerProductos,
  mapeoDeFormato,
  type FormatoArchivo,
  type MapeoColumnas,
} from "@/core/catalogo/importar";
import type { Service } from "@/core/types";
import { ActionForm } from "@/components/action-form";
import { Card, Toggle } from "@/components/ui";
import { deshacerImportacion, importarProductos } from "@/app/portal/actions";
import { formato as conDatos, textos } from "@/textos";

/** T-131+: textos de esta pantalla en `src/textos/es.json` (portal.importar). */
const tt = textos.portal.importar;

const labelCls = "mb-1.5 block text-sm font-semibold text-ink";
const inputCls = "input-nexo w-full px-3.5 py-2.5 text-sm text-ink";

const NOMBRE_FORMATO: Record<FormatoArchivo, string> = {
  tiendanube: tt.formatos.tiendanube,
  aurela: tt.formatos.aurela,
  otro: tt.formatos.otro,
};

/** Campos que la dueña puede emparejar en un archivo propio. */
const CAMPOS: { campo: keyof MapeoColumnas; etiqueta: string; obligatorio?: boolean }[] = [
  { campo: "referencia", etiqueta: tt.campos.referencia, obligatorio: true },
  { campo: "nombre", etiqueta: tt.campos.nombre, obligatorio: true },
  { campo: "precio", etiqueta: tt.campos.precio, obligatorio: true },
  { campo: "categoria", etiqueta: tt.campos.categoria },
  { campo: "descripcion", etiqueta: tt.campos.descripcion },
  { campo: "stock", etiqueta: tt.campos.stock },
  { campo: "disponible", etiqueta: tt.campos.disponible },
];

/**
 * Excel en español guarda los CSV en Windows-1252 (Tienda Nube también); si
 * se lee como UTF-8, "Categorías" sale con símbolos raros y no se reconoce.
 * Se prueba UTF-8 estricto y, si falla, Windows-1252.
 */
function decodificar(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** La plantilla con `;` y BOM: así Excel en español la abre en columnas y con tildes. */
function descargarPlantilla() {
  const filas = [
    ENCABEZADOS_PLANTILLA_AURELA,
    ["B203", "Jean bota campana azul hielo", "99900", "Bota Campana", "Tiro alto, 3 pinzas", "6, 8, 10, 12, 14, 16", "", "", "Sí"],
    ["C10", "Correa de cuero", "35000", "Accesorios", "Cuero genuino", "", "Negro, Café", "12", "Sí"],
  ];
  const csv = "﻿" + filas.map((f) => f.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-productos-aurela.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportarProductos({
  slug,
  catalogoActual,
  currency,
  locale,
  respaldo,
}: {
  slug: string;
  catalogoActual: Service[];
  currency: string;
  locale: string;
  respaldo: { fecha: string; cantidad: number } | null;
}) {
  const [archivo, setArchivo] = useState<string>("");
  const [tabla, setTabla] = useState<TablaCsv | null>(null);
  const [formato, setFormato] = useState<FormatoArchivo>("otro");
  const [mapeo, setMapeo] = useState<Partial<MapeoColumnas>>({});
  const [usarPromo, setUsarPromo] = useState(false);
  const [aviso, setAviso] = useState<string>("");

  const precio = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }),
    [locale, currency],
  );

  const elegirArchivo = async (file: File | undefined) => {
    setAviso("");
    setTabla(null);
    if (!file) return;
    if (/\.(xlsx?|ods)$/i.test(file.name)) {
      setAviso(tt.avisos.excel);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAviso(tt.avisos.muyPesado);
      return;
    }
    const t = parsearCsv(decodificar(await file.arrayBuffer()));
    if (t.encabezados.length === 0 || t.filas.length === 0) {
      setAviso(tt.avisos.vacio);
      return;
    }
    const f = detectarFormato(t.encabezados);
    setArchivo(file.name);
    setTabla(t);
    setFormato(f);
    setMapeo(mapeoDeFormato(f, t.encabezados));
    setUsarPromo(false);
  };

  const completo = Boolean(mapeo.referencia && mapeo.nombre && mapeo.precio);
  const lectura = useMemo(
    () => (tabla && completo ? leerProductos(tabla.encabezados, tabla.filas, mapeo as MapeoColumnas, { usarPrecioPromocional: usarPromo }) : null),
    [tabla, mapeo, completo, usarPromo],
  );
  const combinacion = useMemo(
    () => (lectura && lectura.productos.length ? combinarCatalogo(catalogoActual, lectura.productos) : null),
    [lectura, catalogoActual],
  );
  const tienePromo = Boolean(mapeo.precioPromocional && tabla?.encabezados.includes(mapeo.precioPromocional));

  return (
    <div className="mx-auto max-w-4xl space-y-4 fade-up">
      <Link href={`/portal/negocios/${slug}/catalogo`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mid hover:text-ink">
        <ArrowLeft className="h-4 w-4" />{tt.volverAlMenu}</Link>

      <Card
        title={tt.importarProductos}
        subtitle={tt.cargueTodosSusProductos}
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover">
            <FileUp className="h-4 w-4" />
            {archivo ? tt.elegirOtroArchivo : tt.elegirArchivoCsv}
            <input type="file" accept=".csv,text/csv,.xlsx,.xls" className="sr-only" onChange={(e) => elegirArchivo(e.target.files?.[0])} />
          </label>
          <button
            type="button"
            onClick={descargarPlantilla}
            className="inline-flex items-center gap-2 rounded-[10px] border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-3"
          >
            <Download className="h-4 w-4" />{tt.descargarPlantilla}</button>
          {archivo && (
            <span className="text-sm text-ink-mid">
              {archivo} · {NOMBRE_FORMATO[formato]} · {tabla?.filas.length}{tt.filas}</span>
          )}
        </div>
        {aviso && <p className="mt-3 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-ink">{aviso}</p>}
        <p className="mt-3 text-xs text-ink-soft">{tt.columnasQueSeLeen}</p>
      </Card>

      {/* Paso 2: emparejar columnas, solo si el archivo no es de un formato conocido. */}
      {tabla && formato === "otro" && (
        <Card title={tt.queColumnaEsCada} subtitle={tt.noReconocimosElFormato}>
          <div className="grid gap-3 sm:grid-cols-2">
            {CAMPOS.map(({ campo, etiqueta, obligatorio }) => (
              <div key={campo}>
                <label className={labelCls} htmlFor={`map-${campo}`}>
                  {etiqueta}
                  {obligatorio && " *"}
                </label>
                <select
                  id={`map-${campo}`}
                  className={inputCls}
                  value={(mapeo[campo] as string | undefined) ?? ""}
                  onChange={(e) => setMapeo((m) => ({ ...m, [campo]: e.target.value || undefined }))}
                >
                  <option value="">{tt.noUsar}</option>
                  {tabla.encabezados.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {!completo && <p className="mt-3 text-sm text-warn-ink">{tt.elijaLasColumnasDe}</p>}
        </Card>
      )}

      {/* Paso 3: vista previa */}
      {lectura && (
        <Card title={tt.vistaPrevia} subtitle={tt.todaviaNoSeHa}>
          {tienePromo && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line p-3">
              <span className="text-sm text-ink">
                <span className="font-semibold">{tt.usarElPrecioPromocional}</span>
                <span className="block text-xs text-ink-mid">{tt.elArchivoTraePrecio}</span>
              </span>
              <Toggle checked={usarPromo} onChange={setUsarPromo} label={tt.usarElPrecioPromocional} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [tt.resumen.nuevos, combinacion?.resumen.nuevos ?? 0],
              [tt.resumen.actualizan, combinacion?.resumen.actualizados ?? 0],
              [tt.resumen.sinCambios, combinacion?.resumen.sinCambios ?? 0],
              [tt.resumen.conError, lectura.errores.length],
            ].map(([t, n]) => (
              <div key={t} className="rounded-xl border border-line p-3">
                <p className="text-xs text-ink-mid">{t}</p>
                <p className="text-2xl font-extrabold text-ink">{n}</p>
              </div>
            ))}
          </div>

          {lectura.errores.length > 0 && (
            <div className="mt-4 rounded-xl bg-warn-bg p-3 text-sm text-warn-ink">
              <p className="font-semibold">{tt.estasFilasNoSe}</p>
              <ul className="mt-1 list-disc pl-5">
                {lectura.errores.slice(0, 15).map((e, i) => (
                  <li key={i}>{e.fila > 0 ? `Fila ${e.fila}: ` : ""}{e.mensaje}</li>
                ))}
              </ul>
              {lectura.errores.length > 15 && <p className="mt-1">{tt.y}{lectura.errores.length - 15}{tt.mas}</p>}
            </div>
          )}
          {lectura.avisos.length > 0 && (
            <details className="mt-3 text-sm text-ink-mid">
              <summary className="cursor-pointer">{lectura.avisos.length}{tt.avisoS}</summary>
              <ul className="mt-1 list-disc pl-5">
                {lectura.avisos.slice(0, 15).map((a, i) => (
                  <li key={i}>{tt.fila}{a.fila}: {a.mensaje}</li>
                ))}
              </ul>
            </details>
          )}

          {lectura.productos.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-ink-mid">
                  <tr>
                    <th className="py-1 pr-3">{tt.ref}</th>
                    <th className="py-1 pr-3">{tt.nombre}</th>
                    <th className="py-1 pr-3">{tt.categoria}</th>
                    <th className="py-1 pr-3">{tt.precio}</th>
                    <th className="py-1">{tt.opciones}</th>
                  </tr>
                </thead>
                <tbody>
                  {lectura.productos.slice(0, 8).map((p) => (
                    <tr key={p.id} className="border-t border-line align-top">
                      <td className="py-1.5 pr-3 font-semibold">{p.referencia}</td>
                      <td className="py-1.5 pr-3">{p.name}</td>
                      <td className="py-1.5 pr-3">{p.categoria}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{precio.format(p.price)}</td>
                      <td className="py-1.5 text-ink-mid">{p.detalles?.map((d) => `${d.nombre}: ${d.opciones.join(", ")}`).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lectura.productos.length > 8 && (
                <p className="mt-2 text-xs text-ink-mid">{tt.y}{lectura.productos.length - 8}{tt.productosMas}</p>
              )}
            </div>
          )}

          {/* Paso 4: confirmar */}
          {lectura.productos.length > 0 && (
            <ActionForm action={importarProductos} submitLabel={`Importar ${lectura.productos.length} productos`} className="mt-5 space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="productos" value={JSON.stringify(lectura.productos)} />
              <p className="text-xs text-ink-soft">{tt.podraDeshacerEstaImportacion}</p>
            </ActionForm>
          )}
        </Card>
      )}

      {respaldo && (
        <Card
          title={tt.deshacerLaUltimaImportacion}
          subtitle={conDatos(tt.deshacerDetalle, { n: respaldo.cantidad, fecha: new Date(respaldo.fecha).toLocaleString(locale) })}
        >
          <ActionForm action={deshacerImportacion} submitLabel={tt.deshacerImportacion}>
            <input type="hidden" name="slug" value={slug} />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
