import { useMemo, useState } from "react";
import { motion, useReducedMotion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Account } from "@/types/account";
import type { Transaction } from "@/types/transaction";
import AccountCard from "@/components/AccountCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Pila de tarjetas tipo billetera: la activa al frente y las demás apiladas detrás
// (se asoman sus bordes superiores). Se cambia deslizando la del frente, con las
// flechas/puntos o tocando el borde de una de atrás. Sin contenedores con scroll:
// nada recorta la sombra ni se sale de la columna.
const PEEK = 14; // px que asoma cada tarjeta de atrás
const VISIBLE_BEHIND = 2;
const SPRING = { type: "spring" as const, stiffness: 320, damping: 34, mass: 0.9 };

const CardCarousel = ({
  accounts,
  transactions,
  onAdd,
}: {
  accounts: Account[];
  transactions: Transaction[];
  onAdd: () => void;
}) => {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const n = accounts.length;
  const multiple = n > 1;
  const current = Math.min(active, Math.max(n - 1, 0));
  const behind = Math.min(n - 1, VISIBLE_BEHIND);

  // Ingresos y gastos de cada cuenta a partir de sus movimientos
  const stats = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const t of transactions) {
      const s = map.get(t.account_id) ?? { income: 0, expense: 0 };
      if (t.type === "income") s.income += t.amount;
      else if (t.type === "expense") s.expense += t.amount;
      map.set(t.account_id, s);
    }
    return map;
  }, [transactions]);

  const go = (delta: number) => setActive((current + delta + n) % n);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -500) go(1);
    else if (info.offset.x > 70 || info.velocity.x > 500) go(-1);
  };

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label="Tus cuentas y tarjetas"
      onKeyDown={(e) => {
        if (!multiple) return;
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
    >
      {/* Todas las tarjetas comparten la misma celda: la altura es la de la más alta */}
      <div className="grid" style={{ paddingTop: behind * PEEK }}>
        {accounts.map((a, i) => {
          const rel = (i - current + n) % n; // 0 = frente
          const hidden = rel > VISIBLE_BEHIND;
          const s = stats.get(a.id) ?? { income: 0, expense: 0 };
          const front = rel === 0;
          return (
            <motion.div
              key={a.id}
              className={cn("relative h-full [grid-area:1/1]", !front && "cursor-pointer")}
              style={{ zIndex: n - rel, transformOrigin: "50% 0%" }}
              initial={false}
              animate={{
                y: front ? 0 : -rel * PEEK,
                scale: front ? 1 : 1 - rel * 0.045,
                opacity: hidden ? 0 : front ? 1 : 1 - rel * 0.18,
                filter: front ? "brightness(1)" : `brightness(${1 - rel * 0.12})`,
              }}
              transition={reduce ? { duration: 0 } : SPRING}
              drag={front && multiple && !reduce ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.55}
              dragSnapToOrigin
              onDragEnd={front ? onDragEnd : undefined}
              onClick={front ? undefined : () => setActive(i)}
              aria-hidden={!front}
            >
              {/* Las de atrás se dibujan en modo vista previa: sin botones enfocables */}
              <AccountCard
                account={a}
                totalIncome={s.income}
                totalExpenses={s.expense}
                totalBalance={s.income - s.expense}
                preview={!front}
                className={cn("h-full", !front && "pointer-events-none")}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Controles */}
      <div className="mt-3 flex min-h-9 items-center justify-between gap-3">
        {multiple ? (
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => go(-1)} aria-label="Tarjeta anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center" role="tablist" aria-label="Elegir tarjeta">
              {accounts.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={i === current}
                  aria-label={a.name}
                  onClick={() => setActive(i)}
                  className="flex h-8 items-center px-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      "block h-1.5 rounded-full transition-all duration-300 ease-out-expo",
                      i === current ? "w-5 bg-primary" : "w-1.5 bg-border",
                    )}
                  />
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => go(1)} aria-label="Tarjeta siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-1 text-[12px] text-muted-foreground" aria-live="polite">
              {accounts[current]?.name}
            </span>
          </div>
        ) : (
          <span />
        )}
        <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={onAdd}>
          <Plus className="h-4 w-4" /> Agregar tarjeta
        </Button>
      </div>
    </div>
  );
};

export default CardCarousel;
