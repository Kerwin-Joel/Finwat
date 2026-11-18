import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { investmentService } from "@/api/investmentService";
import { formatCents } from "@/utils/money";
import { formatDay, relativeDay } from "@/utils/investmentDates";
import { limaDate } from "@/utils/investmentCalc";
import type { InterestSchedule, InvestmentCurrency, LineSummary, ReturnType } from "@/types/investment";
import BottomSheet from "./BottomSheet";
import WaveLoader from "./WaveLoader";
import { ScheduleBadge } from "./primitives";
import { EASE_OUT } from "@/lib/motion";

// Detalle de un indicador de Inversiones: qué cuotas lo forman, de qué gestor, de qué
// aporte, con su fecha y monto. Usa las mismas reglas que el resumen de la base:
//   esperado  → cuotas que vencen este mes (monto de la cuota)
//   cobrado   → cuotas de este mes con algo pagado (lo pagado)
//   pendiente → cuotas de este mes aún por cobrar (lo que falta)
//   vencido   → cuotas vencidas por cobrar (lo que falta)
//   rendimiento → todo lo cobrado en intereses y comisiones (lo pagado)

export type KpiKind = "esperado" | "cobrado" | "pendiente" | "vencido" | "rendimiento";

const META: Record<KpiKind, { title: string; empty: string; hint: string }> = {
  esperado: { title: "Esperado del mes", empty: "No vence ninguna cuota este mes.", hint: "Cuotas que vencen este mes" },
  cobrado: { title: "Cobrado del mes", empty: "Aún no te pagan cuotas de este mes.", hint: "Lo que ya te pagaron de las cuotas de este mes" },
  pendiente: { title: "Pendiente del mes", empty: "No queda nada por cobrar este mes.", hint: "Lo que falta cobrar de este mes" },
  vencido: { title: "Vencido", empty: "No tienes cuotas vencidas. Todo al día.", hint: "Cuotas cuya fecha ya pasó y siguen sin pagarse" },
  rendimiento: { title: "Rendimiento", empty: "Aún no cobras intereses ni comisiones.", hint: "Todo lo cobrado en intereses y comisiones" },
};

type Contrib = { id: string; line_id: string; return_type: ReturnType; amount_cents: number; contributed_at: string; status: string };
type Row = { s: InterestSchedule; amount: number; contrib?: Contrib };

const KpiBreakdownSheet = ({
  kind,
  onOpenChange,
  lines,
  currency,
  today,
}: {
  kind: KpiKind | null;
  onOpenChange: (open: boolean) => void;
  lines: LineSummary[];
  currency: InvestmentCurrency;
  today: string;
}) => {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [data, setData] = useState<{ schedules: InterestSchedule[]; contributions: Contrib[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const currencyLines = useMemo(() => lines.filter((l) => l.currency === currency), [lines, currency]);
  const lineIds = useMemo(() => currencyLines.map((l) => l.line_id), [currencyLines]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r] = await Promise.all([
        investmentService.getPortfolioSchedules(lineIds),
        new Promise((res) => setTimeout(res, 600)), // el loader se alcanza a ver
      ]);
      setData(r as { schedules: InterestSchedule[]; contributions: Contrib[] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (kind) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, lineIds.join(",")]);

  const month = today.slice(0, 7);
  const groups = useMemo(() => {
    if (!data || !kind) return [];
    const contribById = new Map(data.contributions.map((c) => [c.id, c]));
    const rows: Row[] = [];
    for (const s of data.schedules) {
      const inMonth = s.due_date.slice(0, 7) === month;
      const open = (s.status === "programada" || s.status === "parcial") && s.outstanding_cents > 0;
      let amount = 0;
      if (kind === "esperado" && inMonth) amount = s.amount_due_cents;
      if (kind === "cobrado" && inMonth) amount = s.amount_paid_cents;
      if (kind === "pendiente" && inMonth && open) amount = s.outstanding_cents;
      if (kind === "vencido" && open && s.display_status === "vencida") amount = s.outstanding_cents;
      if (kind === "rendimiento") amount = s.amount_paid_cents;
      if (amount > 0) rows.push({ s, amount, contrib: contribById.get(s.contribution_id) });
    }
    if (kind === "rendimiento") rows.sort((a, b) => (b.s.paid_at ?? b.s.due_date).localeCompare(a.s.paid_at ?? a.s.due_date));
    else rows.sort((a, b) => a.s.due_date.localeCompare(b.s.due_date));

    const byLine = new Map<string, Row[]>();
    for (const r of rows) byLine.set(r.s.line_id, [...(byLine.get(r.s.line_id) ?? []), r]);
    return currencyLines
      .filter((l) => byLine.has(l.line_id))
      .map((l) => {
        const items = byLine.get(l.line_id)!;
        return { line: l, items, total: items.reduce((a, r) => a + r.amount, 0) };
      })
      .sort((a, b) => b.total - a.total);
  }, [data, kind, month, currencyLines]);

  const total = groups.reduce((a, g) => a + g.total, 0);
  const meta = kind ? META[kind] : null;

  const dateLine = (r: Row) => {
    const s = r.s;
    if (kind === "cobrado" || kind === "rendimiento") {
      return s.paid_at ? `Pagada el ${formatDay(limaDate(s.paid_at), "d MMM yyyy")}` : `Venció el ${formatDay(s.due_date, "d MMM")}`;
    }
    if (kind === "vencido") return `Venció el ${formatDay(s.due_date, "d MMM")} · ${s.days_late} día${s.days_late === 1 ? "" : "s"} de atraso`;
    return `Vence el ${formatDay(s.due_date, "d MMM")} · ${relativeDay(s.due_date, today)}`;
  };

  return (
    <BottomSheet
      open={kind !== null}
      onOpenChange={onOpenChange}
      title={meta?.title ?? ""}
      description={meta ? `${meta.hint}${data && !loading ? ` · ${formatCents(total, currency)}` : ""}` : undefined}
    >
      {loading ? (
        <WaveLoader label="Buscando las cuotas" steps={["Revisando tus gestores", "Sumando cada cuota"]} height={140} />
      ) : error ? (
        <div className="space-y-3 rounded-2xl border border-orange-500/40 bg-orange-500/10 p-4 text-sm text-orange-700 dark:text-orange-300" role="alert">
          <p>{error}</p>
          <Button variant="outline" className="h-11 gap-1" onClick={load}>
            <RefreshCcw className="h-4 w-4" /> Reintentar
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{meta?.empty}</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g, gi) => (
            <motion.section
              key={g.line.line_id}
              className="surface overflow-hidden"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: reduce ? 0 : gi * 0.05, ease: EASE_OUT }}
              aria-label={`${g.line.manager_display_name}: ${formatCents(g.total, currency)}`}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/investments/${g.line.line_id}`);
                }}
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{g.line.manager_display_name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {g.items.length} cuota{g.items.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="num text-[15px] font-semibold">{formatCents(g.total, currency)}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
              </button>
              <ul className="divide-y divide-border/50">
                {g.items.map((r) => {
                  const commission = r.contrib?.return_type === "comision";
                  return (
                    <li key={r.s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium">
                          {commission ? "Comisión" : `Cuota ${r.s.period_number}`}
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · aporte de {formatCents(r.s.contribution_amount_cents, currency)} del {formatDay(r.s.contributed_at, "d MMM")}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{dateLine(r)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={`num text-[14px] font-semibold ${
                            kind === "vencido" ? "text-orange-600 dark:text-orange-400" : kind === "cobrado" || kind === "rendimiento" ? "text-positive" : ""
                          }`}
                        >
                          {formatCents(r.amount, currency)}
                        </span>
                        {(kind === "esperado" || kind === "pendiente") && (
                          <ScheduleBadge status={r.s.display_status} partial={r.s.status === "parcial"} daysLate={r.s.days_late} />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          ))}
        </div>
      )}
    </BottomSheet>
  );
};

export default KpiBreakdownSheet;
