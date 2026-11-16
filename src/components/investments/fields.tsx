import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FileText, ImagePlus, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatCents } from "@/utils/money";
import { formatDay } from "@/utils/investmentDates";
import { MAX_VOUCHER_BYTES } from "@/utils/voucherFile";
import type { PlannedAllocation } from "@/types/investment";

// ------------------------------------------------------------------ Field
export const Field = ({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-xs">
      {label}
    </Label>
    {children}
    {error ? (
      <p id={`${id}-error`} className="text-xs text-orange-400" role="alert">
        {error}
      </p>
    ) : hint ? (
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    ) : null}
  </div>
);

// ------------------------------------------------------------------ AmountInput
export const AmountInput = ({
  id,
  value,
  onChange,
  currency = "PEN",
  invalid,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  currency?: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) => (
  <div className="relative">
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
      {currency === "USD" ? "US$" : "S/"}
    </span>
    <Input
      id={id}
      inputMode="decimal"
      autoComplete="off"
      placeholder="0.00"
      value={value}
      autoFocus={autoFocus}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined}
      onChange={(e) => onChange(e.target.value)}
      className={cn("h-11 pl-11 text-base tabular-nums", invalid && "border-orange-500")}
    />
  </div>
);

// ------------------------------------------------------------------ Chips (selector simple)
export function Chips<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ VoucherPicker
export const VoucherPicker = ({
  file,
  onChange,
  uploading,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  uploading?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(
    () => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/") && f.type !== "application/pdf") {
      setError("Sube una foto o un PDF del voucher");
      return;
    }
    if (f.type === "application/pdf" && f.size > MAX_VOUCHER_BYTES) {
      setError("El PDF pesa más de 10 MB");
      return;
    }
    onChange(f);
  };

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        aria-label="Elegir voucher"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-2">
          {preview ? (
            <img src={preview} alt="Vista previa del voucher" className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{file.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {uploading ? "Subiendo…" : "Se comprime antes de subir"}
            </p>
          </div>
          {uploading ? (
            <Loader2 className="mr-3 h-5 w-5 animate-spin text-muted-foreground" aria-label="Subiendo" />
          ) : (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Quitar voucher"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[72px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ImagePlus className="h-5 w-5" aria-hidden="true" />
          Foto o PDF del voucher
        </button>
      )}
      {error && (
        <p className="text-xs text-orange-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ AllocationBars
/** Cómo se reparte un pago: una barra por cuota/aporte que se llena con lo que cubre. */
export const AllocationBars = ({
  allocations,
  currency,
}: {
  allocations: PlannedAllocation[];
  currency: string;
}) => {
  const reduce = useReducedMotion();
  return (
    <ul className="space-y-3">
      {allocations.map((a, i) => {
        const total =
          a.target_type === "schedule"
            ? a.outstanding_before_cents ?? a.amount_cents
            : a.target_type === "capital"
              ? a.capital_before_cents ?? a.amount_cents
              : a.amount_cents;
        const pct = total > 0 ? Math.min(1, a.amount_cents / total) : 1;
        const title =
          a.target_type === "schedule"
            ? `Cuota del ${a.due_date ? formatDay(a.due_date, "d MMM") : ""} (periodo ${a.period_number})`
            : a.target_type === "capital"
              ? `Devolución de capital · aporte del ${a.contributed_at ? formatDay(a.contributed_at, "d MMM yyyy") : ""}`
              : "Saldo a favor";
        const covered = a.target_type === "schedule" && a.amount_cents >= total;
        return (
          <li key={`${a.target_type}-${a.schedule_id ?? a.contribution_id ?? "credit"}-${i}`}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{title}</span>
              <span className="font-semibold tabular-nums">{formatCents(a.amount_cents, currency)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <motion.div
                className={cn(
                  "h-full origin-left rounded-full",
                  a.target_type === "credit" ? "bg-sky-400" : covered ? "bg-emerald-500" : "bg-brand",
                )}
                initial={{ scaleX: reduce ? pct : 0 }}
                animate={{ scaleX: pct }}
                transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : i * 0.05, ease: "easeOut" }}
              />
            </div>
            {a.target_type === "schedule" && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {covered
                  ? "Queda pagada"
                  : `Queda parcial · faltan ${formatCents(total - a.amount_cents, currency)}`}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
};
