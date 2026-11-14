import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownLeft, ArrowLeft, Plus, Receipt, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import useInvestmentStore from "@/stores/investmentStore";
import { formatCents, formatRate } from "@/utils/money";
import { formatDay } from "@/utils/investmentDates";
import type { Contribution, Payment, PaymentKind } from "@/types/investment";
import { CountUp, HealthIndicator } from "@/components/investments/primitives";
import ContributionSheet from "@/components/investments/ContributionSheet";
import PaymentSheet from "@/components/investments/PaymentSheet";
import { RateChangeSheet, VoidSheet } from "@/components/investments/RateAndVoidSheets";
import {
  CalendarTab,
  ContributionsTab,
  PaymentsTab,
  SettingsTab,
  SummaryTab,
} from "@/components/investments/LineTabs";

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "aportes", label: "Aportes" },
  { id: "calendario", label: "Calendario" },
  { id: "pagos", label: "Pagos" },
  { id: "ajustes", label: "Ajustes" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const InvestmentLineDetail = () => {
  const { lineId = "" } = useParams();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const detail = useInvestmentStore((s) => s.details[lineId]);
  const loading = useInvestmentStore((s) => s.detailLoading[lineId]);
  const error = useInvestmentStore((s) => s.detailError[lineId]);
  const fetchLine = useInvestmentStore((s) => s.fetchLine);
  const refreshAfterWrite = useInvestmentStore((s) => s.refreshAfterWrite);

  const [tab, setTab] = useState<TabId>("resumen");
  const [showContribution, setShowContribution] = useState(false);
  const [paymentKind, setPaymentKind] = useState<PaymentKind | null>(null);
  const [rateTarget, setRateTarget] = useState<{ contribution: Contribution | null } | null>(null);
  const [voidTarget, setVoidTarget] = useState<{ type: "contribution" | "payment"; id: string; label: string } | null>(null);

  useEffect(() => {
    if (lineId) fetchLine(lineId);
  }, [lineId, fetchLine]);

  const refresh = () => refreshAfterWrite(lineId);

  if (!detail) {
    return (
      <div className="space-y-4 pb-24 pt-2">
        <Button variant="ghost" className="h-11 gap-1 px-2" onClick={() => navigate("/investments")}>
          <ArrowLeft className="h-4 w-4" /> Inversiones
        </Button>
        {error ? (
          <div className="space-y-3 rounded-xl border border-orange-500/40 bg-orange-500/10 p-4 text-sm text-orange-300" role="alert">
            <p>{error}</p>
            <Button variant="outline" className="h-11 gap-1" onClick={() => fetchLine(lineId)}>
              <RefreshCcw className="h-4 w-4" /> Reintentar
            </Button>
          </div>
        ) : (
          <div className="space-y-3" aria-busy="true" aria-label="Cargando línea">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-11 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        )}
      </div>
    );
  }

  const s = detail.summary;
  const isInvestor = s.role === "investor";
  const closed = s.status === "cerrada";

  return (
    <div className="space-y-4 pb-28 pt-2">
      <Button variant="ghost" className="h-11 gap-1 px-2" onClick={() => navigate("/investments")}>
        <ArrowLeft className="h-4 w-4" /> Inversiones
      </Button>

      {/* Encabezado */}
      <motion.header
        className="rounded-2xl border border-border/60 bg-gradient-to-br from-[#00aaff]/15 via-[#0066ff]/10 to-[#003899]/10 p-5"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{s.manager_display_name}</h1>
            <p className="text-xs text-muted-foreground">
              {formatRate(s.default_monthly_rate)} mensual · {s.interest_on_return_mode === "periodo_completo" ? "mes completo" : "prorrateo diario"}
              {loading ? " · actualizando…" : ""}
            </p>
          </div>
          {closed ? (
            <span className="text-xs text-muted-foreground">Cerrada</span>
          ) : s.status === "liquidada" ? (
            <span className="text-xs text-emerald-400">Liquidada</span>
          ) : (
            <HealthIndicator health={s.health} />
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div>
            <p className="text-[11px] text-muted-foreground">Capital</p>
            <CountUp cents={s.capital_outstanding_cents} currency={s.currency} className="text-sm font-bold" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Por cobrar</p>
            <CountUp cents={s.pending_total_cents} currency={s.currency} className={cn("text-sm font-bold", s.overdue_cents > 0 && "text-orange-400")} />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Próxima</p>
            <p className="text-sm font-bold">{s.next_due ? formatDay(s.next_due.due_date, "d MMM") : "—"}</p>
          </div>
        </div>
        {s.overdue_count > 0 && (
          <p className="mt-3 text-xs text-orange-300">
            {s.overdue_count} cuota(s) vencida(s) por {formatCents(s.overdue_cents, s.currency)}
          </p>
        )}
      </motion.header>

      {/* Acciones */}
      {!closed && (
        <div className="grid grid-cols-3 gap-2">
          {isInvestor && (
            <Button variant="outline" className="h-12 flex-col gap-0.5 text-xs" onClick={() => setShowContribution(true)}>
              <Plus className="h-4 w-4" /> Aporte
            </Button>
          )}
          <Button className="h-12 flex-col gap-0.5 text-xs" onClick={() => setPaymentKind("interes")}>
            <Receipt className="h-4 w-4" /> Pago
          </Button>
          <Button variant="outline" className="h-12 flex-col gap-0.5 text-xs" onClick={() => setPaymentKind("capital")}>
            <ArrowDownLeft className="h-4 w-4" /> Devolución
          </Button>
        </div>
      )}

      {/* Tabs con indicador deslizante */}
      <div role="tablist" aria-label="Secciones de la línea" className="-mx-4 flex gap-1 overflow-x-auto px-4">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative min-h-11 shrink-0 rounded-full px-4 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="inv-tab-indicator"
                  className="absolute inset-0 rounded-full bg-[#0066ff]/20"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">{t.label}</span>
            </button>
          );
        })}
      </div>

      <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "resumen" && <SummaryTab detail={detail} />}
        {tab === "aportes" && (
          <ContributionsTab
            detail={detail}
            onAdd={() => setShowContribution(true)}
            onChangeRate={(c) => setRateTarget({ contribution: c })}
            onVoid={(c: Contribution) =>
              setVoidTarget({
                type: "contribution",
                id: c.id,
                label: `Aporte de ${formatCents(c.amount_cents, s.currency)} del ${formatDay(c.contributed_at)}`,
              })
            }
          />
        )}
        {tab === "calendario" && <CalendarTab detail={detail} />}
        {tab === "pagos" && (
          <PaymentsTab
            detail={detail}
            onAdd={() => setPaymentKind("interes")}
            onVoid={(p: Payment) =>
              setVoidTarget({
                type: "payment",
                id: p.id,
                label: `Pago de ${formatCents(p.amount_cents, s.currency)}`,
              })
            }
          />
        )}
        {tab === "ajustes" && (
          <SettingsTab
            key={`${s.line_id}-${s.status}`}
            detail={detail}
            onSaved={refresh}
            onChangeLineRate={() => setRateTarget({ contribution: null })}
          />
        )}
      </section>

      {isInvestor && (
        <ContributionSheet open={showContribution} onOpenChange={setShowContribution} summary={s} onDone={refresh} />
      )}
      <PaymentSheet
        open={paymentKind !== null}
        onOpenChange={(o) => !o && setPaymentKind(null)}
        summary={s}
        schedules={detail.schedules}
        contributions={detail.contributions}
        initialKind={paymentKind ?? "interes"}
        onDone={refresh}
      />
      {rateTarget && (
        <RateChangeSheet
          key={rateTarget.contribution?.id ?? "line"}
          open
          onOpenChange={(o) => !o && setRateTarget(null)}
          summary={s}
          contribution={rateTarget.contribution}
          schedules={detail.schedules}
          onDone={refresh}
        />
      )}
      <VoidSheet open={voidTarget !== null} onOpenChange={(o) => !o && setVoidTarget(null)} target={voidTarget} onDone={refresh} />
    </div>
  );
};

export default InvestmentLineDetail;
