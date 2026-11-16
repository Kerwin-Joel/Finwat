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
import { CountUp } from "@/components/investments/primitives";
import { Amount } from "@/components/ui/amount";
import { EASE_OUT, SPRING_SNAPPY } from "@/lib/motion";
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
  const [editContribution, setEditContribution] = useState<Contribution | null>(null);
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

      <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:space-y-0">
      <div className="space-y-4 lg:sticky lg:top-8">
      {/* Encabezado */}
      <motion.header
        className="hero-aurora overflow-hidden rounded-[28px] p-5 shadow-float"
        initial={reduce ? false : { opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em]">{s.manager_display_name}</h1>
            <p className="mt-0.5 text-[12px] text-white/65">
              {formatRate(s.default_monthly_rate)} mensual · {s.interest_on_return_mode === "periodo_completo" ? "mes completo" : "prorrateo diario"}
              {loading ? " · actualizando…" : ""}
            </p>
          </div>
          <span className="glass-on-hero rounded-full px-3 py-1 text-[11px] font-medium text-white/90">
            {closed ? "Cerrada" : s.status === "liquidada" ? "Liquidada" : s.health === "vencido" ? "Con vencidos" : s.health === "por_vencer" ? "Por vencer" : "Al día"}
          </span>
        </div>
        <p className="mt-6 text-[12px] text-white/65">Capital vigente</p>
        <Amount
          value={s.capital_outstanding_cents / 100}
          currency={s.currency}
          className="mt-0.5 text-[38px] font-light leading-none tracking-[-0.045em]"
        />
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="glass-on-hero rounded-2xl px-3.5 py-2.5">
            <p className="text-[11px] text-white/65">Por cobrar</p>
            <CountUp cents={s.pending_total_cents} currency={s.currency} className={cn("mt-0.5 block text-[14px] font-medium", s.overdue_cents > 0 ? "text-orange-200" : "text-white")} />
          </div>
          <div className="glass-on-hero rounded-2xl px-3.5 py-2.5">
            <p className="text-[11px] text-white/65">Próxima cuota</p>
            <p className="num mt-0.5 text-[14px] font-medium text-white">
              {s.next_due ? `${formatCents(s.next_due.amount_cents, s.currency)} · ${formatDay(s.next_due.due_date, "d MMM")}` : "—"}
            </p>
          </div>
        </div>
        {s.overdue_count > 0 && (
          <p className="mt-3 text-[12px] text-orange-200">
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

      </div>
      <div className="min-w-0 space-y-4">
      {/* Tabs con indicador deslizante */}
      <div role="tablist" aria-label="Secciones de la línea" className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:w-fit md:rounded-full md:border md:border-border/70 md:bg-card md:p-1 md:shadow-soft [&::-webkit-scrollbar]:hidden">
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
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="inv-tab-indicator"
                  className="absolute inset-0 rounded-full bg-primary"
                  transition={reduce ? { duration: 0 } : SPRING_SNAPPY}
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
            onEdit={(c) => setEditContribution(c)}
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
      </div>
      </div>

      {isInvestor && (
        <ContributionSheet open={showContribution} onOpenChange={setShowContribution} summary={s} onDone={refresh} />
      )}
      {isInvestor && editContribution && (
        <ContributionSheet
          key={editContribution.id}
          open
          onOpenChange={(o) => !o && setEditContribution(null)}
          summary={s}
          contribution={editContribution}
          onDone={refresh}
        />
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
