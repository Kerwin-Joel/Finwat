import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Account } from "@/types/account";
import type { Transaction } from "@/types/transaction";
import AccountCard from "@/components/AccountCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Carrusel de cuentas en el inicio.
// - Móvil con varias cuentas: la siguiente se asoma por la derecha (se desliza con el dedo).
// - Tablet/escritorio o una sola cuenta: la tarjeta ocupa todo el ancho.
// - Controles debajo (nunca encima de la tarjeta): flechas, puntos y "Agregar tarjeta".
const GAP = 12;

const CardCarousel = ({
  accounts,
  transactions,
  onAdd,
}: {
  accounts: Account[];
  transactions: Transaction[];
  onAdd: () => void;
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const multiple = accounts.length > 1;

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

  const onScroll = () => {
    const el = trackRef.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const i = Math.round(el.scrollLeft / (first.offsetWidth + GAP));
    setActive(Math.min(accounts.length - 1, Math.max(0, i)));
  };

  const goTo = (i: number) => {
    const el = trackRef.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const next = Math.min(accounts.length - 1, Math.max(0, i));
    el.scrollTo({ left: next * (first.offsetWidth + GAP), behavior: "smooth" });
  };

  return (
    <div role="region" aria-roledescription="carrusel" aria-label="Tus cuentas y tarjetas">
      {/* Pista: padding vertical para que la sombra de la tarjeta no se corte */}
      <div
        ref={trackRef}
        onScroll={onScroll}
        className={cn(
          "-mx-4 -my-6 flex snap-x snap-mandatory overflow-x-auto scroll-smooth scroll-px-4 px-4 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "md:-mx-3 md:scroll-px-3 md:px-3",
        )}
        style={{ gap: GAP }}
      >
        {accounts.map((a, i) => {
          const s = stats.get(a.id) ?? { income: 0, expense: 0 };
          return (
            <div
              key={a.id}
              className={cn(
                "shrink-0 snap-start transition-[opacity,transform] duration-500 ease-out-expo",
                multiple ? "w-[88%] md:w-full" : "w-full",
                multiple && i !== active && "scale-[0.97] opacity-60 md:scale-100 md:opacity-100",
              )}
              aria-roledescription="tarjeta"
              aria-label={`${a.name}, ${i + 1} de ${accounts.length}`}
            >
              <AccountCard account={a} totalIncome={s.income} totalExpenses={s.expense} totalBalance={s.income - s.expense} />
            </div>
          );
        })}
      </div>

      {/* Controles */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {multiple && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 md:inline-flex"
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
              aria-label="Tarjeta anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {multiple && (
            <div className="flex items-center" role="tablist" aria-label="Elegir tarjeta">
              {accounts.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-label={a.name}
                  onClick={() => goTo(i)}
                  className="flex h-8 items-center px-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      "block h-1.5 rounded-full transition-all duration-300 ease-out-expo",
                      i === active ? "w-5 bg-primary" : "w-1.5 bg-border",
                    )}
                  />
                </button>
              ))}
            </div>
          )}
          {multiple && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 md:inline-flex"
              onClick={() => goTo(active + 1)}
              disabled={active === accounts.length - 1}
              aria-label="Tarjeta siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={onAdd}>
          <Plus className="h-4 w-4" /> Agregar tarjeta
        </Button>
      </div>
    </div>
  );
};

export default CardCarousel;
