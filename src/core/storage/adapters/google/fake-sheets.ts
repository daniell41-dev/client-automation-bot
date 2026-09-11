/**
 * Fake en memoria de `SheetsApi` para tests (sin red ni credenciales).
 *
 * Modela cada pestaña como una matriz de filas, con la fila 0 = encabezados.
 * Soporta los rangos que usan los adaptadores: "Tab!A2:N", "Tab!A{n}:N{n}",
 * "Tab!A2:E", etc.
 */

import type { SheetsApi } from "@/core/storage/adapters/google/auth";

interface FakeSheets extends SheetsApi {
  /** Devuelve las filas crudas de una pestaña (incluido el encabezado). */
  dump(tab: string): string[][];
}

/** Parsea el inicio/fin de fila de un rango A1 ("A2:N" → {start:2}). */
function parseRange(range: string): { tab: string; start: number; end?: number } {
  const [tab, a1] = range.split("!");
  const m = a1.match(/^[A-Z]*(\d+)?(?::[A-Z]*(\d+)?)?$/);
  const start = m?.[1] ? Number(m[1]) : 1;
  const end = m?.[2] ? Number(m[2]) : undefined;
  return { tab, start, end };
}

export function makeFakeSheets(): FakeSheets {
  const tabs = new Map<string, string[][]>();

  return {
    dump(tab: string): string[][] {
      return tabs.get(tab) ?? [];
    },

    async ensureSheet(title: string, headers: string[]): Promise<void> {
      if (!tabs.has(title)) tabs.set(title, [[...headers]]);
    },

    async getValues(range: string): Promise<string[][]> {
      const { tab, start, end } = parseRange(range);
      const rows = tabs.get(tab) ?? [];
      return rows.slice(start - 1, end ?? rows.length).map((r) => [...r]);
    },

    async updateValues(range: string, values: string[][]): Promise<void> {
      const { tab, start } = parseRange(range);
      const rows = tabs.get(tab) ?? [];
      rows[start - 1] = [...values[0]];
      tabs.set(tab, rows);
    },

    async appendValues(range: string, values: string[][]): Promise<void> {
      const { tab } = parseRange(range);
      const rows = tabs.get(tab) ?? [];
      for (const v of values) rows.push([...v]);
      tabs.set(tab, rows);
    },
  };
}
