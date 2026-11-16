import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Account } from "@/types/account";
import type { Transaction } from "@/types/transaction";
import AccountCard from "@/components/AccountCard";
import { cn } from "@/lib/utils";

// Carrusel de cuentas en el inicio: desliza con el dedo (scroll-snap nativo),
// puntos indicadores, flechas en escritorio y, al final, "agregar tarjeta".
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

  // Ingresos, gastos y saldo de cada cuenta a partir de sus movimientos
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

  const slides = accounts.length + 1; // + "agregar"
  const multiple = accounts.length > 1;

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.firstElementChild as HTMLElement | null;
    const w = slide ? slide.offsetWidth + 12 : el.clientWidth;
    setActive(Math.min(slides - 1, Math.max(0, Math.round(el.scrollLeft / w))));
  };

  const goTo = (i: number) => {
    const el = trackRef.current;
    const target = el?.children[i] as HTMLElement | undefined;
    if (el && target) el.scrollTo({ left: target.offsetLeft - el.offsetLeft - (el.clientWidth - target.offsetWidth) / 2, behavior: "smooth" });
  };

  return (
    <div className="relative" role="region" aria-roledescription="carrusel" aria-label="Tus cuentas y tarjetas">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] md:-mx-1 md:px-1 [&::-webkit-scrollbar]:hidden"
      >
        {accounts.map((a, i) => {
          const s = stats.get(a.id) ?? { income: 0, expense: 0 };
          return (
            <div
              key={a.id}
              className={cn(
                "shrink-0 snap-center transition-[opacity,transform] duration-500 ease-out-expo",
                multiple ? "w-[90%]" : "w-full",
                multiple && i !== active && "scale-[0.97] opacity-70",
              )}
              aria-roledescription="tarjeta"
              aria-label={`${i + 1} de ${accounts.length}`}
            >
              <AccountCard account={a} totalIncome={s.income} totalExpenses={s.expense} totalBalance={s.income - s.expense} />
            </div>
          );
        })}
        <div className={cn("shrink-0 snap-center", multiple || accounts.length === 1 ? "w-[90%]" : "w-full")}>
          <button
            type="button"
            onClick={onAdd}
            className="flex h-full min-h-[236px] w-full flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-border bg-card/50 text-muted-foreground transition-colors duration-200 hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-[14px] font-semibold">Agregar tarjeta o cuenta</span>
            <span className="text-[12px]">Visa, Mastercard, Amex, débito o crédito</span>
          </button>
        </div>
      </div>

      {/* Indicadores */}
      <div className="mt-2 flex items-center justify-center gap-1.5" role="tablist" aria-label="Elegir tarjeta">
        {Array.from({ length: slides }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={i < accounts.length ? accounts[i].name : "Agregar tarjeta"}
            onClick={() => goTo(i)}
            className="flex h-6 items-center px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      {/* Flechas en tablet/escritorio */}
      {active > 0 && (
        <button
          type="button"
          onClick={() => goTo(active - 1)}
          aria-label="Tarjeta anterior"
          className="absolute left-2 top-[118px] hidden h-10 w-10 items-center justify-center rounded-full bg-card/90 text-foreground shadow-float backdrop-blur md:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {active < slides - 1 && (
        <button
          type="button"
          onClick={() => goTo(active + 1)}
          aria-label="Tarjeta siguiente"
          className="absolute right-2 top-[118px] hidden h-10 w-10 items-center justify-center rounded-full bg-card/90 text-foreground shadow-float backdrop-blur md:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default CardCarousel;
