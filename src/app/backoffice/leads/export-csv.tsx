"use client";

/**
 * Botón "Exportar CSV": genera el archivo client-side con los leads ya
 * cargados por la página (sin round-trip extra).
 */

import { Download } from "lucide-react";

export interface LeadCsvRow {
  negocio: string;
  contacto: string;
  canal: string;
  fecha: string;
  estado: string;
}

export function ExportCsvButton({ rows }: { rows: LeadCsvRow[] }) {
  const exportar = () => {
    const encabezado = "negocio,contacto,canal,fecha,estado";
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const cuerpo = rows.map((r) =>
      [r.negocio, r.contacto, r.canal, r.fecha, r.estado].map(escape).join(","),
    );
    const blob = new Blob(["﻿" + [encabezado, ...cuerpo].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={exportar}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      Exportar CSV
    </button>
  );
}
