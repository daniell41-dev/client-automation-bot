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

const labelCls = "mb-1.5 block text-sm font-semibold text-ink";
const inputCls = "input-nexo w-full px-3.5 py-2.5 text-sm text-ink";

const NOMBRE_FORMATO: Record<FormatoArchivo, string> = {
  tiendanube: "Exportación de Tienda Nube",
  aurela: "Plantilla de Aurela",
  otro: "Archivo propio",
};

/** Campos que la dueña puede emparejar en un archivo propio. */
const CAMPOS: { campo: keyof MapeoColumnas; etiqueta: string; obligatorio?: boolean }[] = [
  { campo: "referencia", etiqueta: "Referencia o código", obligatorio: true },
  { campo: "nombre", etiqueta: "Nombre", obligatorio: true },
  { campo: "precio", etiqueta: "Precio", obligatorio: true },
  { campo: "categoria", etiqueta: "Categoría" },
  { campo: "descripcion", etiqueta: "Descripción" },
  { campo: "stock", etiqueta: "Unidades disponibles" },
  { campo: "disponible", etiqueta: "Disponible (Sí/No)" },
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
      setAviso("Este archivo es de Excel. Ábralo en Excel y use Archivo → Guardar como → «CSV UTF-8» (o «CSV delimitado por comas»), y suba ese.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAviso("El archivo pesa más de 5 MB. Revise que sea la lista de productos.");
      return;
    }
    const t = parsearCsv(decodificar(await file.arrayBuffer()));
    if (t.encabezados.length === 0 || t.filas.length === 0) {
      setAviso("El archivo está vacío o no tiene filas de productos.");
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
        <ArrowLeft className="h-4 w-4" /> Volver al menú
      </Link>

      <Card
        title="Importar productos"
        subtitle="Cargue todos sus productos de una vez desde un archivo. Si vende en Tienda Nube, suba la exportación de productos tal cual. Si un producto ya existe (misma referencia), se actualiza; los que no vengan en el archivo no se tocan."
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover">
            <FileUp className="h-4 w-4" />
            {archivo ? "Elegir otro archivo" : "Elegir archivo (CSV)"}
            <input type="file" accept=".csv,text/csv,.xlsx,.xls" className="sr-only" onChange={(e) => elegirArchivo(e.target.files?.[0])} />
          </label>
          <button
            type="button"
            onClick={descargarPlantilla}
            className="inline-flex items-center gap-2 rounded-[10px] border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-3"
          >
            <Download className="h-4 w-4" /> Descargar plantilla
          </button>
          {archivo && (
            <span className="text-sm text-ink-mid">
              {archivo} · {NOMBRE_FORMATO[formato]} · {tabla?.filas.length} filas
            </span>
          )}
        </div>
        {aviso && <p className="mt-3 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-ink">{aviso}</p>}
        <p className="mt-3 text-xs text-ink-soft">
          Columnas que se leen: referencia, nombre, precio, categoría, descripción, tallas, colores, unidades disponibles y
          disponible. Las demás (costos, proveedores, medidas) se ignoran y nunca se guardan.
        </p>
      </Card>

      {/* Paso 2: emparejar columnas, solo si el archivo no es de un formato conocido. */}
      {tabla && formato === "otro" && (
        <Card title="¿Qué columna es cada cosa?" subtitle="No reconocimos el formato del archivo. Revise lo que adivinamos y corrija si hace falta.">
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
                  <option value="">— No usar —</option>
                  {tabla.encabezados.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {!completo && <p className="mt-3 text-sm text-warn-ink">Elija las columnas de referencia, nombre y precio para continuar.</p>}
        </Card>
      )}

      {/* Paso 3: vista previa */}
      {lectura && (
        <Card title="Vista previa" subtitle="Todavía no se ha guardado nada.">
          {tienePromo && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line p-3">
              <span className="text-sm text-ink">
                <span className="font-semibold">Usar el precio promocional</span>
                <span className="block text-xs text-ink-mid">El archivo trae precio normal y promocional. Apagado, se usa el normal.</span>
              </span>
              <Toggle checked={usarPromo} onChange={setUsarPromo} label="Usar el precio promocional" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Nuevos", combinacion?.resumen.nuevos ?? 0],
              ["Se actualizan", combinacion?.resumen.actualizados ?? 0],
              ["Sin cambios", combinacion?.resumen.sinCambios ?? 0],
              ["Filas con error", lectura.errores.length],
            ].map(([t, n]) => (
              <div key={t} className="rounded-xl border border-line p-3">
                <p className="text-xs text-ink-mid">{t}</p>
                <p className="text-2xl font-extrabold text-ink">{n}</p>
              </div>
            ))}
          </div>

          {lectura.errores.length > 0 && (
            <div className="mt-4 rounded-xl bg-warn-bg p-3 text-sm text-warn-ink">
              <p className="font-semibold">Estas filas no se van a cargar:</p>
              <ul className="mt-1 list-disc pl-5">
                {lectura.errores.slice(0, 15).map((e, i) => (
                  <li key={i}>{e.fila > 0 ? `Fila ${e.fila}: ` : ""}{e.mensaje}</li>
                ))}
              </ul>
              {lectura.errores.length > 15 && <p className="mt-1">…y {lectura.errores.length - 15} más.</p>}
            </div>
          )}
          {lectura.avisos.length > 0 && (
            <details className="mt-3 text-sm text-ink-mid">
              <summary className="cursor-pointer">{lectura.avisos.length} aviso(s)</summary>
              <ul className="mt-1 list-disc pl-5">
                {lectura.avisos.slice(0, 15).map((a, i) => (
                  <li key={i}>Fila {a.fila}: {a.mensaje}</li>
                ))}
              </ul>
            </details>
          )}

          {lectura.productos.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-ink-mid">
                  <tr>
                    <th className="py-1 pr-3">Ref.</th>
                    <th className="py-1 pr-3">Nombre</th>
                    <th className="py-1 pr-3">Categoría</th>
                    <th className="py-1 pr-3">Precio</th>
                    <th className="py-1">Opciones</th>
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
                <p className="mt-2 text-xs text-ink-mid">…y {lectura.productos.length - 8} productos más.</p>
              )}
            </div>
          )}

          {/* Paso 4: confirmar */}
          {lectura.productos.length > 0 && (
            <ActionForm action={importarProductos} submitLabel={`Importar ${lectura.productos.length} productos`} className="mt-5 space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="productos" value={JSON.stringify(lectura.productos)} />
              <p className="text-xs text-ink-soft">Podrá deshacer esta importación desde esta misma pantalla.</p>
            </ActionForm>
          )}
        </Card>
      )}

      {respaldo && (
        <Card
          title="Deshacer la última importación"
          subtitle={`Vuelve el menú a como estaba antes de importar (${respaldo.cantidad} productos, ${new Date(respaldo.fecha).toLocaleString(locale)}).`}
        >
          <ActionForm action={deshacerImportacion} submitLabel="Deshacer importación">
            <input type="hidden" name="slug" value={slug} />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
