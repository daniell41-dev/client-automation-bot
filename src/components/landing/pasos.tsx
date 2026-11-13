/** T-80: lista numerada reutilizada por "Así funciona" y "Cómo es la instalación". */

export function Pasos({ pasos, oscura = false }: { pasos: string[]; oscura?: boolean }) {
  return (
    <ol className={`mt-8 grid gap-4 ${pasos.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
      {pasos.map((paso, i) => (
        <li
          key={paso}
          className={`rounded-2xl p-5 ${oscura ? "border border-white/10 bg-white/5" : "border border-line bg-surface shadow-card"}`}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-[15px] font-bold text-white">
            {i + 1}
          </span>
          <p className={`mt-4 text-[16px] font-semibold leading-snug ${oscura ? "text-white" : "text-ink"}`}>{paso}</p>
        </li>
      ))}
    </ol>
  );
}
