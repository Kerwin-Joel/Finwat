import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY } from "@/lib/motion";
import type { TransactionType } from "@/types/transaction";

// Selector Egreso / Ingreso como control segmentado (iOS): una sola pista y una píldora
// que se desliza a la opción elegida. El color va en el ícono y el texto, no en todo el
// botón, para que no parezca una acción.

const OPTIONS: { value: TransactionType; label: string; icon: typeof ArrowUpRight; tone: string }[] = [
  { value: "expense", label: "Egreso", icon: ArrowUpRight, tone: "text-red-600 dark:text-red-400" },
  { value: "income", label: "Ingreso", icon: ArrowDownLeft, tone: "text-emerald-600 dark:text-emerald-400" },
];

const TypeToggle = ({
  value,
  onChange,
  id = "type-toggle",
}: {
  value: TransactionType;
  onChange: (v: TransactionType) => void;
  /** Distinto por modal para que la píldora no salte entre ellos */
  id?: string;
}) => {
  const reduce = useReducedMotion();
  return (
    <div role="radiogroup" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
      {OPTIONS.map((o) => {
        const active = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex h-10 items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? o.tone : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`${id}-pill`}
                className="absolute inset-0 rounded-full bg-card shadow-soft ring-1 ring-border/60"
                transition={reduce ? { duration: 0 } : SPRING_SNAPPY}
              />
            )}
            <Icon className="relative h-4 w-4" aria-hidden="true" />
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TypeToggle;
