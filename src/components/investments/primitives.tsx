import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleSlash,
  Clock,
  HandCoins,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCents } from "@/utils/money";
import type {
  InvestmentWarning,
  LineHealth,
  ReconStatus,
  ScheduleDisplayStatus,
} from "@/types/investment";
import { RECON_LABEL, SCHEDULE_LABEL } from "@/types/investment";
import { WaveReveal } from "@/components/ui/wave-reveal";

// ------------------------------------------------------------------ CountUp
/** Cifra que cuenta hasta su valor (~600 ms). Sin animación si el usuario la reduce. */
export const CountUp = ({
  cents,
  currency = "PEN",
  className,
}: {
  cents: number;
  currency?: string;
  className?: string;
}) => {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? cents : 0);
  const prev = useRef(reduce ? cents : 0);

  useEffect(() => {
    if (reduce) {
      prev.current = cents;
      return;
    }
    const controls = animate(prev.current, cents, {
      type: "spring",
      stiffness: 90,
      damping: 20,
      restDelta: 0.5,
      onUpdate: (v) => setValue(Math.round(v)),
    });
    prev.current = cents;
    return () => controls.stop();
  }, [cents, reduce]);

  return (
    <span className={cn("tabular-nums", className)}>
      {formatCents(reduce ? cents : value, currency)}
    </span>
  );
};

// ------------------------------------------------------------------ ProgressRing
export const ProgressRing = ({
  value,
  size = 56,
  stroke = 6,
  label,
  overflow = false,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  label?: ReactNode;
  overflow?: boolean;
}) => {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="inv-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5b8cff" />
            <stop offset="100%" stopColor="#1a44c4" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={overflow ? "#f97316" : "url(#inv-ring)"}
          initial={{ pathLength: reduce ? clamped : 0 }}
          animate={{ pathLength: clamped }}
          transition={{ duration: reduce ? 0 : 0.8, ease: "easeOut" }}
        />
      </svg>
      {label !== undefined && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
          {label}
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ estados
const SCHEDULE_STYLE: Record<
  ScheduleDisplayStatus,
  { cls: string; Icon: typeof Circle }
> = {
  programada: { cls: "bg-muted text-muted-foreground", Icon: Circle },
  por_vencer: { cls: "bg-sky-500/15 text-sky-400", Icon: Clock },
  vencida: { cls: "bg-orange-500/15 text-orange-400", Icon: AlertTriangle },
  parcial: { cls: "bg-amber-500/15 text-amber-400", Icon: CircleDashed },
  pagada: { cls: "bg-emerald-500/15 text-emerald-400", Icon: CheckCircle2 },
  condonada: { cls: "bg-violet-500/15 text-violet-400", Icon: HandCoins },
  anulada: {
    cls: "bg-muted text-muted-foreground line-through",
    Icon: CircleSlash,
  },
};

export const ScheduleBadge = ({
  status,
  partial,
  daysLate,
}: {
  status: ScheduleDisplayStatus;
  partial?: boolean;
  daysLate?: number;
}) => {
  const { cls, Icon } = SCHEDULE_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        cls,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {SCHEDULE_LABEL[status]}
      {partial && status === "vencida" ? " · parcial" : ""}
      {daysLate && daysLate > 0 ? ` · ${daysLate} d` : ""}
    </span>
  );
};

const HEALTH: Record<
  LineHealth,
  { label: string; cls: string; Icon: typeof Circle }
> = {
  al_dia: { label: "Al día", cls: "text-emerald-400", Icon: CheckCircle2 },
  por_vencer: { label: "Por vencer", cls: "text-sky-400", Icon: Clock },
  vencido: {
    label: "Con vencidos",
    cls: "text-orange-400",
    Icon: AlertTriangle,
  },
};

export const HealthIndicator = ({
  health,
  className,
}: {
  health: LineHealth;
  className?: string;
}) => {
  const { label, cls, Icon } = HEALTH[health];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        cls,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
};

export const ReconBadge = ({ status }: { status: ReconStatus }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
      status === "confirmado" && "bg-emerald-500/15 text-emerald-400",
      status === "pendiente_contraparte" && "bg-muted text-muted-foreground",
      status === "observado" && "bg-orange-500/15 text-orange-400",
      status === "anulado" && "bg-muted text-muted-foreground line-through",
    )}
  >
    {RECON_LABEL[status]}
  </span>
);

// ------------------------------------------------------------------ advertencias
export const WarningList = ({
  warnings,
}: {
  warnings: InvestmentWarning[];
}) => {
  if (!warnings.length) return null;
  return (
    <ul className="space-y-2" aria-live="polite">
      {warnings.map((w, i) => {
        const info = w.code === "saldo_a_favor";
        return (
          <li
            key={`${w.code}-${i}`}
            className={cn(
              "flex gap-2 rounded-lg border p-3 text-xs",
              info
                ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                : "border-orange-500/40 bg-orange-500/10 text-orange-300",
            )}
          >
            {info ? (
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            )}
            <span>{w.message}</span>
          </li>
        );
      })}
    </ul>
  );
};

// ------------------------------------------------------------------ otros
export const Stat = ({
  label,
  children,
  tone = "default",
  className,
}: {
  label: string;
  children: ReactNode;
  tone?: "default" | "good" | "warn" | "muted";
  className?: string;
}) => (
  <div
    className={cn(
      "surface flex flex-col justify-between gap-1.5 p-4",
      className,
    )}
  >
    <p className="eyebrow text-muted-foreground">{label}</p>
    <p
      className={cn(
        "mt-1 text-base font-bold tabular-nums",
        tone === "good" && "text-emerald-400",
        tone === "warn" && "text-orange-400",
        tone === "muted" && "text-muted-foreground",
      )}
    >
      {children}
    </p>
  </div>
);

/** Check animado al confirmar una operación */
/** Pantalla de éxito: la onda de marca revela el resultado y luego se dibuja el check */
export const SuccessCheck = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) => {
  const reduce = useReducedMotion();
  return (
    <WaveReveal>
      <div
        className="flex flex-col items-center gap-3 py-8 text-center"
        role="status"
      >
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
          <motion.circle
            cx="36"
            cy="36"
            r="32"
            fill="none"
            stroke="#10b981"
            strokeWidth="4"
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              duration: reduce ? 0 : 0.4,
              delay: reduce ? 0 : 0.55,
            }}
          />
          <motion.path
            d="M22 37 L32 47 L51 27"
            fill="none"
            stroke="#10b981"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : 0.9 }}
          />
        </svg>
        <p className="text-base font-semibold">{title}</p>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </WaveReveal>
  );
};

export const EmptyState = ({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center gap-2 py-10 text-center">
    <div className="text-muted-foreground/40">{icon}</div>
    <p className="text-sm font-medium">{title}</p>
    {description && (
      <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
    )}
    {action && <div className="pt-2">{action}</div>}
  </div>
);
