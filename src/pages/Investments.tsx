import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Plus, RefreshCcw, TrendingUp, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import useInvestmentStore from "@/stores/investmentStore";
import { formatCents } from "@/utils/money";
import { formatDay, relativeDay } from "@/utils/investmentDates";
import type { CurrencyKpis, InvestmentCurrency, LineSummary } from "@/types/investment";
import { CountUp, EmptyState, HealthIndicator, ProgressRing } from "@/components/investments/primitives";
import NewLineSheet from "@/components/investments/NewLineSheet";
import { Amount } from "@/components/ui/amount";
import { EASE_OUT, riseItem, staggerContainer } from "@/lib/motion";

const stagger = staggerContainer;
const item = riseItem;

const KPIS: { key: keyof CurrencyKpis; label: string; tone?: "warn" | "good" }[] = [
  { key: "capital_outstanding_cents", label: "Capital colocado" },
  { key: "monthly_interest_expected_cents", label: "Interés esperado del mes" },
  { key: "month_collected_cents", label: "Cobrado del mes", tone: "good" },
  { key: "month_pending_cents", label: "Pendiente del mes" },
  { key: "overdue_cents", label: "Vencido", tone: "warn" },
  { key: "interest_collected_total_cents", label: "Rendimiento", tone: "good" },
];

const LineCard = ({ line, onOpen }: { line: LineSummary; onOpen: () => void }) => {
  const pct = line.committed_cents > 0 ? line.delivered_cents / line.committed_cents : 0;
  return (
    <motion.li variants={item}>
      <button
        type="button"
        onClick={onOpen}
        className="surface flex w-full items-center gap-4 p-4 text-left transition-transform duration-200 ease-out-expo active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Abrir línea con ${line.manager_display_name}`}
      >
        <ProgressRing
          value={pct}
          overflow={line.committed_cents > 0 && line.delivered_cents > line.committed_cents}
          label={line.committed_cents > 0 ? `${Math.round(pct * 100)}%` : <UserRound className="h-5 w-5 text-muted-foreground" />}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{line.manager_display_name}</p>
            {line.role === "manager" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Eres gestor</span>
            )}
            {line.pending_recon_count > 0 && (
              <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-400">
                {line.pending_recon_count} por confirmar
              </span>
            )}
          </div>
          <p className="text-sm tabular-nums">
            {formatCents(line.capital_outstanding_cents, line.currency)}
            <span className="text-muted-foreground"> colocados</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {line.status === "liquidada" ? (
              <span className="text-xs text-emerald-400">Liquidada</span>
            ) : (
              <HealthIndicator health={line.health} />
            )}
            {line.next_due && (
              <span className="text-xs text-muted-foreground">
                {formatCents(line.next_due.amount_cents, line.currency)} {relativeDay(line.next_due.due_date, line.today)}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </motion.li>
  );
};

const Investments = () => {
  const navigate = useNavigate();
  const { overview, overviewLoading, overviewError, fetchOverview } = useInvestmentStore();
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const currencies = useMemo(
    () => (Object.keys(overview?.kpis ?? {}) as InvestmentCurrency[]).sort((a, b) => (a === "PEN" ? -1 : b === "PEN" ? 1 : 0)),
    [overview],
  );
  const lines = useMemo(() => overview?.lines ?? [], [overview]);
  const sorted = useMemo(
    () =>
      [...lines].sort((a, b) => {
        const rank = { vencido: 0, por_vencer: 1, al_dia: 2 } as const;
        return rank[a.health] - rank[b.health] || a.manager_display_name.localeCompare(b.manager_display_name);
      }),
    [lines],
  );
  const upcoming = useMemo(
    () =>
      lines
        .filter((l) => l.next_due)
        .sort((a, b) => a.next_due!.due_date.localeCompare(b.next_due!.due_date))
        .slice(0, 4),
    [lines],
  );

  const loadingFirst = overviewLoading && !overview;

  return (
    <div className="space-y-5 pb-24 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.03em]">Inversiones</h1>
          <p className="text-sm text-muted-foreground">Tu capital con gestores</p>
        </div>
        <Button className="h-11 gap-1" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> Gestor
        </Button>
      </div>

      {overviewError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 text-sm text-orange-300" role="alert">
          <span>{overviewError}</span>
          <Button variant="ghost" size="sm" className="h-11 gap-1" onClick={() => fetchOverview()}>
            <RefreshCcw className="h-4 w-4" /> Reintentar
          </Button>
        </div>
      )}

      {/* KPIs */}
      {loadingFirst ? (
        <div className="space-y-3" aria-busy="true" aria-label="Cargando resumen">
          <div className="hero-aurora h-[196px] rounded-[28px] opacity-80" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-[76px] rounded-2xl" />
            <Skeleton className="h-[76px] rounded-2xl" />
          </div>
        </div>
      ) : (
        currencies.map((cur) => {
          const k = overview!.kpis[cur]!;
          return (
            <section key={cur} aria-label={`Resumen en ${cur === "PEN" ? "soles" : "dólares"}`} className="space-y-3">
              {/* Héroe: capital colocado */}
              <motion.div
                className="hero-aurora overflow-hidden rounded-[28px] p-5 shadow-float"
                initial={{ opacity: 0, y: 12, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: EASE_OUT }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] text-white/65">
                    Capital colocado{currencies.length > 1 ? ` · ${cur === "PEN" ? "soles" : "dólares"}` : ""}
                  </p>
                  <span className="glass-on-hero rounded-full px-2.5 py-1 text-[11px] text-white/85">Este mes</span>
                </div>
                <Amount
                  value={k.capital_outstanding_cents / 100}
                  currency={cur}
                  className="mt-1 text-[42px] font-light leading-none tracking-[-0.045em]"
                />
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {[
                    { label: "Esperado", v: k.monthly_interest_expected_cents },
                    { label: "Cobrado", v: k.month_collected_cents },
                    { label: "Pendiente", v: k.month_pending_cents },
                  ].map((s) => (
                    <div key={s.label} className="glass-on-hero rounded-2xl px-3 py-2.5">
                      <p className="text-[10.5px] leading-tight text-white/65">{s.label}</p>
                      <CountUp cents={s.v} currency={cur} className="mt-1 block text-[13px] font-medium text-white" />
                    </div>
                  ))}
                </div>
              </motion.div>
              <motion.div className="grid grid-cols-2 gap-3" initial="hidden" animate="show" variants={stagger}>
                {KPIS.filter((kpi) => kpi.key === "overdue_cents" || kpi.key === "interest_collected_total_cents").map((kpi) => (
                  <motion.div key={kpi.key} variants={item} className="surface p-4">
                    <p className="eyebrow text-muted-foreground">{kpi.label}</p>
                    <CountUp
                      cents={k[kpi.key]}
                      currency={cur}
                      className={`mt-1.5 block text-[17px] font-semibold ${
                        kpi.tone === "warn" && k[kpi.key] > 0 ? "text-orange-500" : kpi.tone === "good" && k[kpi.key] > 0 ? "text-positive" : ""
                      }`}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </section>
          );
        })
      )}

      {/* Próximos vencimientos */}
      {upcoming.length > 0 && (
        <section aria-labelledby="inv-upcoming" className="surface p-4">
          <h2 id="inv-upcoming" className="mb-2 text-sm font-semibold">
            Próximos vencimientos
          </h2>
          <ul className="space-y-2">
            {upcoming.map((l) => (
              <li key={l.line_id} className="flex items-center justify-between text-sm">
                <span>{l.manager_display_name}</span>
                <span className="tabular-nums">
                  {formatCents(l.next_due!.amount_cents, l.currency)}{" "}
                  <span className="text-xs text-muted-foreground">
                    {formatDay(l.next_due!.due_date, "d MMM")} · {relativeDay(l.next_due!.due_date, l.today)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Líneas */}
      <section aria-labelledby="inv-lines">
        <h2 id="inv-lines" className="mb-2 text-sm font-semibold">
          Gestores
        </h2>
        {loadingFirst ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-[92px] rounded-2xl" />
            ))}
          </div>
        ) : sorted.length === 0 && !overviewError ? (
          <EmptyState
            icon={<TrendingUp className="h-10 w-10" />}
            title="Aún no tienes gestores"
            description="Crea una línea por cada persona a la que le entregas capital. Finwat calcula los intereses de cada aporte y te avisa los vencimientos."
            action={
              <Button className="h-11 gap-1" onClick={() => setShowNew(true)}>
                <Plus className="h-4 w-4" /> Agregar mi primer gestor
              </Button>
            }
          />
        ) : (
          <motion.ul className="space-y-3" initial="hidden" animate="show" variants={stagger}>
            {sorted.map((l) => (
              <LineCard key={l.line_id} line={l} onOpen={() => navigate(`/investments/${l.line_id}`)} />
            ))}
          </motion.ul>
        )}
      </section>

      <NewLineSheet open={showNew} onOpenChange={setShowNew} />
    </div>
  );
};

export default Investments;
