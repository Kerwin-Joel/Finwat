import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Transaction } from "../types/transaction";
import useCategoryStore from "../stores/categoryStore";
import { formatCurrency } from "../utils/formatCurrency";
import { EASE_OUT } from "@/lib/motion";

// Gastos del mes en curso (Lima) agrupados por categoría: total + top 5 con barras.
const MonthSpending = ({ transactions, className }: { transactions: Transaction[]; className?: string }) => {
  const { getCategory } = useCategoryStore();
  const reduce = useReducedMotion();

  const { total, rows, monthLabel } = useMemo(() => {
    const now = new Date();
    const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit" })
      .format(now)
      .slice(0, 7);
    const byCat = new Map<string, number>();
    let sum = 0;
    for (const t of transactions) {
      if (t.type !== "expense" || !t.transaction_date.startsWith(ym)) continue;
      sum += t.amount;
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
    }
    const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      total: sum,
      rows: sorted,
      monthLabel: now.toLocaleDateString("es-PE", { month: "long", timeZone: "America/Lima" }),
    };
  }, [transactions]);

  const max = rows[0]?.[1] ?? 0;

  return (
    <section aria-labelledby="month-spending" className={`surface p-5 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="month-spending" className="text-[15px] font-semibold tracking-[-0.015em]">
          Gastos de <span className="capitalize">{monthLabel}</span>
        </h2>
        <p className="num text-[15px] font-semibold">{formatCurrency(total)}</p>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted-foreground">Aún no registras gastos este mes.</p>
      ) : (
        <ul className="mt-4 space-y-3.5">
          {rows.map(([cat, amount], i) => {
            const c = getCategory(cat);
            const pct = max > 0 ? amount / max : 0;
            return (
              <li key={cat}>
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[14px]"
                      style={{ backgroundColor: `${c.color}18` }}
                      aria-hidden="true"
                    >
                      {c.type === "image" ? <img src={c.icon} alt="" className="h-full w-full object-cover" /> : c.icon}
                    </span>
                    <span className="truncate font-medium">{c.label}</span>
                  </span>
                  <span className="num shrink-0 text-muted-foreground">{formatCurrency(amount)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <motion.div
                    className="h-full origin-left rounded-full"
                    style={{ backgroundColor: c.color }}
                    initial={{ scaleX: reduce ? pct : 0 }}
                    animate={{ scaleX: pct }}
                    transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : 0.15 + i * 0.05, ease: EASE_OUT }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default MonthSpending;
