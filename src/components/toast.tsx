"use client";

/**
 * Toasts de éxito/error (T-13). Se montan una sola vez en el layout raíz
 * (`<ToastProvider>`) y cualquier client component los dispara con
 * `useToast().notify(...)`.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastType = "success" | "error";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  notify: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((type: ToastType, message: string) => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), type, message }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDone }: { toast: ToastItem; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  const tone =
    toast.type === "success"
      ? "border-success/30 bg-success-bg text-success-ink"
      : "border-warn-ink/30 bg-warn-bg text-warn-ink";

  return (
    <div
      role="status"
      className={`pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-sm font-semibold shadow-card ${tone}`}
    >
      {toast.message}
    </div>
  );
}

/** Dispara un toast desde cualquier client component descendiente de `<ToastProvider>`. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() debe usarse dentro de <ToastProvider>.");
  return ctx;
}
