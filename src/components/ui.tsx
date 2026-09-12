"use client";

/**
 * Primitivos del design system "Nexo" (ver docs/design/README.md).
 * Componentes presentacionales compartidos por portal, back office y demo.
 */

import { Search } from "lucide-react";

/* ─── Toggle ────────────────────────────────────────────────────────────── */

export function Toggle({
  checked,
  onChange,
  disabled,
  size = "md",
  label,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  /** md = 36×20 (listas); sm = 30×18 (denso). */
  size?: "sm" | "md";
  label?: string;
}) {
  const w = size === "md" ? "w-9" : "w-[30px]";
  const h = size === "md" ? "h-5" : "h-[18px]";
  const knob = size === "md" ? "h-4 w-4" : "h-[14px] w-[14px]";
  const shift = size === "md" ? "translate-x-4" : "translate-x-3";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex ${w} ${h} shrink-0 items-center rounded-full transition-colors duration-150 ${
        checked ? "bg-success" : "bg-line-input"
      } ${disabled ? "opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block ${knob} transform rounded-full bg-white shadow transition-transform duration-150 ${
          checked ? shift : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/* ─── Pill (estados / plan / rol) ───────────────────────────────────────── */

const PILL_TONES = {
  success: "bg-success-bg text-success-ink",
  warn: "bg-warn-bg text-warn-ink",
  info: "bg-primary-tint text-primary-hover",
  neutral: "bg-surface-2 text-ink-mid",
} as const;

export function Pill({
  tone = "neutral",
  dot,
  children,
}: {
  tone?: keyof typeof PILL_TONES;
  /** Punto de color a la izquierda (p. ej. estado Activo/Pausado). */
  dot?: boolean;
  children: React.ReactNode;
}) {
  const dotColor =
    tone === "success" ? "bg-success" : tone === "warn" ? "bg-warn" : "bg-ink-soft";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL_TONES[tone]}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />}
      {children}
    </span>
  );
}

/* ─── Segmented control (tabs con pill activo) ──────────────────────────── */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex rounded-[10px] bg-surface-2 p-1 ${className ?? ""}`}
      role="tablist"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
            value === opt.value
              ? "bg-white text-ink shadow-card"
              : "text-ink-mid hover:text-ink"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Card ──────────────────────────────────────────────────────────────── */

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-5 shadow-card ${className ?? ""}`}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-[15px] font-bold text-ink">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-[13px] text-ink-soft">{subtitle}</p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/* ─── StatCard (KPIs, número en Sora) ───────────────────────────────────── */

export function StatCard({
  label,
  value,
  delta,
  deltaTone = "success",
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "success" | "neutral";
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[13px] text-ink-mid">{label}</p>
      <p className="mt-1 font-display text-[27px] font-bold leading-none text-ink">
        {value}
      </p>
      {delta && (
        <p
          className={`mt-1.5 text-xs font-semibold ${
            deltaTone === "success" ? "text-success-ink" : "text-ink-soft"
          }`}
        >
          {delta}
        </p>
      )}
    </div>
  );
}

/* ─── Avatar (iniciales) ────────────────────────────────────────────────── */

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function Avatar({
  name,
  size = "md",
  tone = "primary",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  tone?: "primary" | "dark" | "soft";
}) {
  const sizes = { sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs", lg: "h-11 w-11 text-sm" };
  const tones = {
    primary: "bg-primary text-white",
    dark: "bg-bo-sidebar text-white",
    soft: "bg-primary-tint text-primary-hover",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${sizes[size]} ${tones[tone]}`}
    >
      {initials(name) || "?"}
    </span>
  );
}

/* ─── SearchInput ───────────────────────────────────────────────────────── */

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-nexo w-full bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-soft"
      />
    </div>
  );
}

/* ─── EmptyState ────────────────────────────────────────────────────────── */

export function EmptyState({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-2 bg-surface p-10 text-center">
      <p className="font-semibold text-ink-mid">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
