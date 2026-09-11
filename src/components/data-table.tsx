/**
 * Tabla del design system: header gris en uppercase, filas con hover suave.
 * Presentacional: recibe headers y filas ya renderizadas.
 */

export function DataTable({
  headers,
  rows,
  emptyText = "Sin datos todavía.",
}: {
  headers: string[];
  /** Cada fila = celdas ya renderizadas (mismo largo que headers). */
  rows: { key: string; cells: React.ReactNode[] }[];
  emptyText?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-surface-3">
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-4 py-10 text-center text-sm text-ink-soft"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.key}
                className="border-t border-line transition-colors hover:bg-surface-3"
              >
                {row.cells.map((cell, i) => (
                  <td key={i} className="px-4 py-3 align-middle">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
