import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addMonths, endOfMonth, format, getDay, parseISO, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, ChevronLeft, ChevronRight, FileImage, Pencil, Percent, Plus, Receipt, Trash2, Wallet, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { investmentService } from "@/api/investmentService";
import { centsToAmount, formatCents, formatRate, parseAmountToCents } from "@/utils/money";
import { capitalOutstandingByContribution } from "@/utils/investmentCalc";
import { formatDay, relativeDay } from "@/utils/investmentDates";
import type { Contribution, InterestSchedule, LineDetail, Payment, ReturnMode } from "@/types/investment";
import { METHOD_LABEL } from "@/types/investment";
import { AmountInput, Chips, Field } from "./fields";
import { CountUp, EmptyState, ProgressRing, ReconBadge, ScheduleBadge, Stat } from "./primitives";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { celebrate } from "@/lib/celebrate";

const stagger = { show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

// =================================================================== Resumen
export const SummaryTab = ({ detail }: { detail: LineDetail }) => {
  const { summary: s, schedules } = detail;
  const cur = s.currency;

  // Cobrado vs esperado por mes de vencimiento (últimos 6 meses con cuotas)
  const chart = useMemo(() => {
    const byMonth = new Map<string, { mes: string; esperado: number; cobrado: number }>();
    for (const sc of schedules) {
      if (sc.status === "anulada" || sc.due_date > s.today) continue;
      const key = sc.due_date.slice(0, 7);
      const row = byMonth.get(key) ?? { mes: format(parseISO(`${key}-01`), "MMM yy", { locale: es }), esperado: 0, cobrado: 0 };
      row.esperado += centsToAmount(sc.amount_due_cents);
      row.cobrado += centsToAmount(sc.amount_paid_cents);
      byMonth.set(key, row);
    }
    return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([, v]) => v);
  }, [schedules, s.today]);

  const committedPct = s.committed_cents > 0 ? s.delivered_cents / s.committed_cents : 0;

  return (
    <motion.div className="space-y-4" initial="hidden" animate="show" variants={stagger}>
      <motion.div variants={item} className="grid grid-cols-2 gap-3">
        <Stat label="Mis registros">
          <CountUp cents={s.pending_total_cents} currency={cur} />
        </Stat>
        <Stat label="Conciliado" tone="muted">
          <span className="text-[13px] font-medium">
            {s.manager_linked ? "Pendiente" : "Al unirse el gestor"}
          </span>
        </Stat>
        <Stat label="Vencido" tone={s.overdue_cents > 0 ? "warn" : "default"}>
          <CountUp cents={s.overdue_cents} currency={cur} />
        </Stat>
        <Stat label="Saldo a favor">
          <CountUp cents={s.credit_balance_cents} currency={cur} />
        </Stat>
      </motion.div>

      {s.next_due && (
        <motion.div variants={item} className="surface p-4">
          <p className="text-xs text-muted-foreground">Próximo vencimiento</p>
          <div className="mt-1 flex items-baseline justify-between">
            <p className="text-lg font-bold tabular-nums">{formatCents(s.next_due.amount_cents, cur)}</p>
            <p className="text-sm">
              {formatDay(s.next_due.due_date)} · <span className="text-muted-foreground">{relativeDay(s.next_due.due_date, s.today)}</span>
            </p>
          </div>
        </motion.div>
      )}

      <motion.div variants={item} className="flex items-center gap-4 surface p-4">
        <ProgressRing
          size={72}
          stroke={7}
          value={committedPct}
          overflow={s.committed_cents > 0 && s.delivered_cents > s.committed_cents}
          label={s.committed_cents > 0 ? `${Math.round(committedPct * 100)}%` : "—"}
        />
        <div className="space-y-1 text-sm">
          <p>
            Entregado <span className="font-semibold tabular-nums">{formatCents(s.delivered_cents, cur)}</span>
          </p>
          <p className="text-muted-foreground">
            {s.committed_cents > 0
              ? `Cupo ${formatCents(s.committed_cents, cur)} · por entregar ${formatCents(s.to_deliver_cents, cur)}`
              : "Sin cupo definido"}
          </p>
          <p className="text-muted-foreground">
            Capital vigente {formatCents(s.capital_outstanding_cents, cur)}
            {s.capital_returned_cents > 0 ? ` · devuelto ${formatCents(s.capital_returned_cents, cur)}` : ""}
          </p>
        </div>
      </motion.div>

      <motion.div variants={item} className="surface p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-medium">Cobrado vs esperado</p>
          <p className="text-xs text-muted-foreground">
            Total cobrado {formatCents(s.interest_collected_total_cents, cur)}
          </p>
        </div>
        {chart.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Aún no hay cuotas vencidas</p>
        ) : (
          <div className="h-48" role="img" aria-label="Gráfico de intereses cobrados frente a esperados por mes">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.15} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip
                  formatter={(v) => formatCents(Math.round(Number(v) * 100), cur)}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="esperado" name="Esperado" fill="#64748b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cobrado" name="Cobrado" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// =================================================================== Aportes
export const ContributionsTab = ({
  detail,
  onAdd,
  onEdit,
  onChangeRate,
  onVoid,
}: {
  detail: LineDetail;
  onAdd: () => void;
  onEdit: (c: Contribution) => void;
  onChangeRate: (c: Contribution) => void;
  onVoid: (c: Contribution) => void;
}) => {
  const { contributions, schedules, payments, summary: s } = detail;
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  const isInvestor = s.role === "investor";
  const capitalOut = useMemo(() => capitalOutstandingByContribution(contributions, payments), [contributions, payments]);

  // Orden por próximo vencimiento: primero los que vencen antes; luego los sin cuotas
  // pendientes (sin interés o liquidados) del más reciente al más antiguo; anulados al final.
  const ordered = useMemo(() => {
    const nextDue = new Map<string, string>();
    for (const sc of schedules) {
      if ((sc.status === "programada" || sc.status === "parcial") && sc.outstanding_cents > 0) {
        const cur = nextDue.get(sc.contribution_id);
        if (!cur || sc.due_date < cur) nextDue.set(sc.contribution_id, sc.due_date);
      }
    }
    // Préstamo con comisión: el capital también vence en la fecha de pago
    for (const c of contributions) {
      if (c.status === "activo" && c.return_type === "comision" && c.repayment_date && (capitalOut.get(c.id) ?? 0) > 0) {
        const cur = nextDue.get(c.id);
        if (!cur || c.repayment_date < cur) nextDue.set(c.id, c.repayment_date);
      }
    }
    const rank = (c: Contribution) => (c.status === "anulado" ? 2 : nextDue.has(c.id) ? 0 : 1);
    // Los eliminados (anulados) no se listan aquí: viven en la pestaña Auditoría
    return contributions
      .filter((c) => c.status !== "anulado")
      .map((c) => ({ c, next: nextDue.get(c.id) ?? null }))
      .sort((a, b) => {
        const r = rank(a.c) - rank(b.c);
        if (r !== 0) return r;
        if (a.next && b.next) return a.next.localeCompare(b.next);
        return b.c.contributed_at.localeCompare(a.c.contributed_at);
      });
  }, [contributions, schedules, capitalOut]);

  const returnLabel = (c: Contribution) =>
    c.return_type === "comision"
      ? `Comisión ${formatCents(Number(c.fixed_amount_cents), s.currency)}`
      : c.return_type === "sin_interes"
      ? "Sin interés"
      : c.return_type === "monto_fijo"
        ? `${formatCents(Number(c.fixed_amount_cents), s.currency)} fijo al mes`
        : `${formatRate(Number(c.monthly_rate))} mensual`;

  if (ordered.length === 0) {
    return (
      <EmptyState
        icon={<Wallet className="h-10 w-10" />}
        title={`Aún no le has dado capital a ${s.manager_display_name}`}
        description="Registra cada entrega con su fecha: cada aporte genera su propio interés mensual."
        action={
          isInvestor && (
            <Button className="h-11 gap-1" onClick={onAdd}>
              <Plus className="h-4 w-4" /> Registrar primer aporte
            </Button>
          )
        }
      />
    );
  }

  return (
    <motion.ol className="relative space-y-3 border-l border-border/60 pl-4" initial="hidden" animate="show" variants={stagger}>
      {ordered.map(({ c, next }) => {
        const own = schedules.filter((x) => x.contribution_id === c.id);
        const expanded = open === c.id;
        const anulado = c.status === "anulado";
        return (
          <motion.li key={c.id} variants={item} layout={!reduce} className="relative">
            <span
              className={cn(
                "absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full",
                anulado ? "bg-muted" : c.status === "liquidado" ? "bg-emerald-500" : "bg-brand",
              )}
              aria-hidden="true"
            />
            <div className={cn("surface", anulado && "opacity-60")}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-3 p-4 text-left"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : c.id)}
              >
                <div>
                  <p className={cn("text-sm font-semibold tabular-nums", anulado && "line-through")}>
                    {formatCents(c.amount_cents, s.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDay(c.contributed_at)} · {returnLabel(c)} · {METHOD_LABEL[c.method]}
                    {c.grace_months > 0 ? ` · ${c.grace_months} mes(es) de gracia` : ""}
                  </p>
                  {next && !anulado && (
                    <p
                      className={cn(
                        "mt-0.5 text-[11.5px] font-medium",
                        next < s.today ? "text-orange-500 dark:text-orange-300" : "text-foreground/80",
                      )}
                    >
                      {c.return_type === "comision" ? "Fecha de pago" : "Próximo vencimiento"}: {formatDay(next, "d MMM")} ·{" "}
                      {relativeDay(next, s.today)}
                    </p>
                  )}
                  {c.return_type === "comision" && c.status === "activo" && (capitalOut.get(c.id) ?? 0) > 0 && (
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground tabular-nums">
                      Capital por devolver {formatCents(capitalOut.get(c.id) ?? 0, s.currency)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {anulado ? (
                    <span className="text-[11px] text-muted-foreground">Anulado</span>
                  ) : c.status === "liquidado" ? (
                    <span className="text-[11px] text-emerald-400">Liquidado</span>
                  ) : (
                    <ReconBadge status={c.recon_status} />
                  )}
                  <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
                </div>
              </button>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 border-t border-border/60 p-4">
                      {c.void_reason && <p className="text-xs text-muted-foreground">Motivo de anulación: {c.void_reason}</p>}
                      {c.operation_code && <p className="text-xs text-muted-foreground">Operación {c.operation_code}</p>}
                      {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                      {own.length > 0 && (
                        <ul className="space-y-2">
                          {own.map((sc) => (
                            <ScheduleRow
                              key={sc.id}
                              sc={sc}
                              currency={s.currency}
                              label={c.return_type === "comision" ? "Comisión" : undefined}
                            />
                          ))}
                        </ul>
                      )}
                      {isInvestor && !anulado && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {c.recon_status !== "confirmado" && (
                            <Button variant="outline" size="sm" className="h-11 gap-1" onClick={() => onEdit(c)}>
                              <Pencil className="h-4 w-4" /> Editar
                            </Button>
                          )}
                          {c.status === "activo" && c.return_type === "tasa" && (
                            <Button variant="outline" size="sm" className="h-11 gap-1" onClick={() => onChangeRate(c)}>
                              <Percent className="h-4 w-4" /> Cambiar tasa
                            </Button>
                          )}
                          {c.recon_status !== "confirmado" && (
                            <Button variant="ghost" size="sm" className="h-11 gap-1 text-muted-foreground hover:text-destructive" onClick={() => onVoid(c)}>
                              <Trash2 className="h-4 w-4" /> Eliminar
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.li>
        );
      })}
    </motion.ol>
  );
};

const ScheduleRow = ({ sc, currency, label }: { sc: InterestSchedule; currency: string; label?: string }) => (
  <li className="flex items-center justify-between gap-2 text-xs">
    <div>
      <p>
        {label ?? `P${sc.period_number}`} · {formatDay(sc.due_date)}
      </p>
      <p className="text-muted-foreground tabular-nums">
        {formatCents(sc.amount_due_cents, currency)}
        {sc.amount_paid_cents > 0 && sc.status !== "pagada" ? ` · pagado ${formatCents(sc.amount_paid_cents, currency)}` : ""}
      </p>
    </div>
    <ScheduleBadge status={sc.display_status} partial={sc.status === "parcial"} daysLate={sc.days_late} />
  </li>
);

// =================================================================== Calendario
const DOT: Record<string, string> = {
  pagada: "bg-emerald-500",
  condonada: "bg-violet-500",
  vencida: "bg-orange-500",
  por_vencer: "bg-sky-400",
  parcial: "bg-amber-400",
  programada: "bg-muted-foreground",
};

export const CalendarTab = ({ detail }: { detail: LineDetail }) => {
  const { schedules, summary: s } = detail;
  const [month, setMonth] = useState(() => startOfMonth(parseISO(s.today)));
  const [selected, setSelected] = useState<string | null>(s.today);

  const visible = schedules.filter((x) => x.status !== "anulada");
  const byDay = useMemo(() => {
    const m = new Map<string, InterestSchedule[]>();
    for (const x of visible) m.set(x.due_date, [...(m.get(x.due_date) ?? []), x]);
    return m;
  }, [visible]);

  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const offset = (getDay(first) + 6) % 7; // semana empieza en lunes
  const days = Array.from({ length: last.getDate() }, (_, i) => format(new Date(first.getFullYear(), first.getMonth(), i + 1), "yyyy-MM-dd"));
  const dayItems = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Mes anterior">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <p className="text-sm font-semibold capitalize" aria-live="polite">
          {format(month, "MMMM yyyy", { locale: es })}
        </p>
        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Mes siguiente">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground" aria-hidden="true">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Vencimientos del mes">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {days.map((d) => {
          const its = byDay.get(d) ?? [];
          const isToday = d === s.today;
          const isSel = d === selected;
          const statuses = [...new Set(its.map((x) => x.display_status))];
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              aria-selected={isSel}
              aria-label={`${formatDay(d)}${its.length ? `, ${its.length} cuota(s)` : ""}`}
              onClick={() => setSelected(d)}
              className={cn(
                "flex h-11 flex-col items-center justify-center rounded-lg text-xs tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSel ? "bg-brand/15 font-semibold" : "hover:bg-muted",
                isToday && "ring-1 ring-brand",
              )}
            >
              {Number(d.slice(8))}
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {statuses.slice(0, 3).map((st) => (
                  <span key={st} className={cn("h-1.5 w-1.5 rounded-full", DOT[st])} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {[
          ["pagada", "Pagada"],
          ["vencida", "Vencida"],
          ["por_vencer", "Por vencer"],
          ["parcial", "Parcial"],
          ["programada", "Programada"],
        ].map(([k, l]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", DOT[k])} /> {l}
          </span>
        ))}
      </div>
      {selected && (
        <div className="surface p-4">
          <p className="mb-2 text-xs text-muted-foreground">{formatDay(selected, "EEEE d 'de' MMMM")}</p>
          {dayItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin vencimientos este día</p>
          ) : (
            <ul className="space-y-2">
              {dayItems.map((sc) => (
                <li key={sc.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    Aporte {formatDay(sc.contributed_at, "d MMM")} · P{sc.period_number}
                    <span className="block tabular-nums text-muted-foreground">{formatCents(sc.amount_due_cents, s.currency)}</span>
                  </span>
                  <ScheduleBadge status={sc.display_status} partial={sc.status === "parcial"} daysLate={sc.days_late} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

// =================================================================== Pagos
export const PaymentsTab = ({
  detail,
  onAdd,
  onVoid,
}: {
  detail: LineDetail;
  onAdd: () => void;
  onVoid: (p: Payment) => void;
}) => {
  const { schedules, contributions, summary: s } = detail;
  // Los pagos eliminados (anulados) se ven en la pestaña Auditoría
  const payments = useMemo(() => detail.payments.filter((p) => p.status !== "anulado"), [detail.payments]);
  const { toast } = useToast();
  const [viewer, setViewer] = useState<{ url: string; pdf: boolean } | null>(null);
  const [zoom, setZoom] = useState(false);

  const openVoucher = async (path: string) => {
    try {
      const url = await investmentService.getVoucherUrl(path);
      setZoom(false);
      setViewer({ url, pdf: path.endsWith(".pdf") });
    } catch (err) {
      toast({ title: "No se pudo abrir el voucher", description: (err as Error).message, variant: "destructive" });
    }
  };

  const describe = (p: Payment) =>
    p.allocations
      .filter((a) => !a.voided_at || p.status === "anulado")
      .map((a) => {
        if (a.target_type === "schedule") {
          const sc = schedules.find((x) => x.id === a.schedule_id);
          return `${formatCents(a.amount_cents, s.currency)} → cuota ${sc ? formatDay(sc.due_date, "d MMM") : ""}`;
        }
        if (a.target_type === "capital") {
          const c = contributions.find((x) => x.id === a.contribution_id);
          return `${formatCents(a.amount_cents, s.currency)} → capital${c ? ` (${formatDay(c.contributed_at, "d MMM")})` : ""}`;
        }
        return `${formatCents(a.amount_cents, s.currency)} → saldo a favor`;
      });

  if (payments.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="h-10 w-10" />}
        title="Aún no hay pagos"
        description={`Cuando ${s.manager_display_name} te pague, regístralo con su voucher.`}
        action={
          <Button className="h-11 gap-1" onClick={onAdd}>
            <Plus className="h-4 w-4" /> Registrar pago
          </Button>
        }
      />
    );
  }

  return (
    <>
      <motion.ul className="space-y-3" initial="hidden" animate="show" variants={stagger}>
        {payments.map((p) => {
          const anulado = p.status === "anulado";
          return (
            <motion.li key={p.id} variants={item} className={cn("surface p-4", anulado && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={cn("text-sm font-semibold tabular-nums", anulado && "line-through")}>
                    {formatCents(p.amount_cents, s.currency)}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {p.kind === "capital" ? "Devolución de capital" : p.kind === "mixto" ? "Interés + capital" : "Intereses"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.paid_at).toLocaleString("es-PE", {
                      timeZone: "America/Lima",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {METHOD_LABEL[p.method]}
                    {p.operation_code ? ` · Op. ${p.operation_code}` : ""}
                  </p>
                </div>
                <ReconBadge status={p.recon_status} />
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                {describe(p).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
              {p.void_reason && <p className="mt-1 text-[11px] text-muted-foreground">Anulado: {p.void_reason}</p>}
              <div className="mt-2 flex gap-2">
                {p.voucher_path && (
                  <ConfirmButton variant="outline" size="sm" className="h-11 gap-1" onClick={() => openVoucher(p.voucher_path!)} loadingText="Abriendo…">
                    <FileImage className="h-4 w-4" /> Voucher
                  </ConfirmButton>
                )}
                {!anulado && p.recon_status !== "confirmado" && (
                  <Button variant="ghost" size="sm" className="h-11 gap-1 text-muted-foreground hover:text-destructive" onClick={() => onVoid(p)}>
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </Button>
                )}
              </div>
            </motion.li>
          );
        })}
      </motion.ul>

      <AnimatePresence>
        {viewer && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Voucher"
            onClick={() => setViewer(null)}
            onKeyDown={(e) => e.key === "Escape" && setViewer(null)}
          >
            {viewer.pdf ? (
              <a href={viewer.url} target="_blank" rel="noreferrer" className="rounded-lg bg-background px-4 py-3 text-sm underline">
                Abrir PDF del voucher
              </a>
            ) : (
              <motion.img
                src={viewer.url}
                alt="Voucher del pago"
                className="max-h-full max-w-full cursor-zoom-in rounded-lg object-contain"
                animate={{ scale: zoom ? 2 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                drag={zoom}
                dragConstraints={{ left: -300, right: 300, top: -300, bottom: 300 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setZoom((z) => !z);
                }}
              />
            )}
            <button
              type="button"
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-background/80 text-foreground"
              aria-label="Cerrar voucher"
              autoFocus
              onClick={() => setViewer(null)}
            >
              <XCircle className="h-5 w-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// =================================================================== Ajustes
export const SettingsTab = ({
  detail,
  onSaved,
  onChangeLineRate,
}: {
  detail: LineDetail;
  onSaved: () => void;
  onChangeLineRate: () => void;
}) => {
  const { summary: s } = detail;
  const { toast } = useToast();
  const [name, setName] = useState(s.manager_display_name);
  const [phone, setPhone] = useState(s.manager_phone ?? "");
  const [committed, setCommitted] = useState(s.committed_cents ? (s.committed_cents / 100).toFixed(2) : "");
  const [mode, setMode] = useState<ReturnMode>(s.interest_on_return_mode);
  const [dueSoon, setDueSoon] = useState(String(s.due_soon_days));
  const [grace, setGrace] = useState(String(s.payment_grace_days));
  const [saving, setSaving] = useState(false);
  const [closeReason, setCloseReason] = useState("");

  const isInvestor = s.role === "investor";
  const committedCents = committed.trim() ? parseAmountToCents(committed) : 0;

  const save = async () => {
    if (!name.trim() || committedCents === null) {
      toast({ title: "Revisa el nombre y el cupo", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await investmentService.updateLine(s.line_id, {
        manager_display_name: name.trim(),
        manager_phone: phone.replace(/\D/g, "") || null,
        committed_amount_cents: committedCents,
        interest_on_return_mode: mode,
        due_soon_days: Math.max(0, Math.min(31, Number(dueSoon) || 0)),
        payment_grace_days: Math.max(0, Math.min(31, Number(grace) || 0)),
      });
      await celebrate();
      toast({ title: "Ajustes guardados" });
      onSaved();
    } catch (err) {
      toast({ title: "No se guardaron los ajustes", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const closeLine = async () => {
    try {
      await investmentService.closeLine(s.line_id, closeReason.trim());
      toast({ title: "Línea cerrada y archivada" });
      onSaved();
    } catch (err) {
      toast({ title: "No se pudo cerrar", description: (err as Error).message, variant: "destructive" });
    }
  };

  if (!isInvestor) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Solo el inversionista cambia los ajustes de la línea.</p>;
  }
  if (s.status === "cerrada") {
    return <p className="py-6 text-center text-sm text-muted-foreground">Esta línea está cerrada.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <Field id="s-name" label="Nombre del gestor">
          <Input id="s-name" className="h-11" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="s-phone" label="Celular">
          <Input id="s-phone" className="h-11" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field id="s-committed" label="Cupo / meta" hint="El historial de cambios queda en la auditoría">
          <AmountInput id="s-committed" value={committed} onChange={setCommitted} currency={s.currency} />
        </Field>
        <Field id="s-mode" label="Interés al devolver capital" hint="Solo recalcula cuotas aún no pagadas">
          <Chips
            label="Modo de devolución"
            value={mode}
            onChange={setMode}
            options={[
              { value: "periodo_completo", label: "Mes completo" },
              { value: "prorrateo_diario", label: "Prorrateo diario" },
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="s-soon" label="Avisar días antes">
            <Input id="s-soon" className="h-11" inputMode="numeric" value={dueSoon} onChange={(e) => setDueSoon(e.target.value)} />
          </Field>
          <Field id="s-grace" label="Días de tolerancia">
            <Input id="s-grace" className="h-11" inputMode="numeric" value={grace} onChange={(e) => setGrace(e.target.value)} />
          </Field>
        </div>
        <ConfirmButton className="h-11 w-full" onClick={save} loading={saving} loadingText="Guardando…">
          Guardar ajustes
        </ConfirmButton>
      </div>

      <div className="space-y-2 rounded-xl border border-border/60 p-4">
        <p className="text-sm font-medium">Tasa de la línea: {formatRate(s.default_monthly_rate)}</p>
        <p className="text-xs text-muted-foreground">Cambia la tasa de todos los aportes activos desde una fecha. Lo pagado no cambia.</p>
        <Button variant="outline" className="h-11 w-full gap-1" onClick={onChangeLineRate}>
          <Percent className="h-4 w-4" /> Cambiar tasa de la línea
        </Button>
      </div>

      <div className="space-y-2 rounded-xl border border-border/60 p-4">
        <p className="text-sm font-medium">Invitar al gestor</p>
        <p className="text-xs text-muted-foreground">
          Pronto: {s.manager_display_name} podrá ver lo que debe, registrar sus pagos y conciliar contigo.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-border/60 p-4">
        <p className="text-sm font-medium">Cerrar línea</p>
        {s.status === "liquidada" ? (
          <>
            <p className="text-xs text-muted-foreground">Ya no hay capital ni intereses pendientes. Cerrarla la archiva.</p>
            <Textarea rows={2} placeholder="Motivo (opcional)" value={closeReason} onChange={(e) => setCloseReason(e.target.value)} aria-label="Motivo del cierre" />
            <ConfirmButton variant="outline" className="h-11 w-full" onClick={closeLine} loadingText="Cerrando…">
              Cerrar y archivar
            </ConfirmButton>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Disponible cuando no quede capital ni intereses pendientes (capital vigente {formatCents(s.capital_outstanding_cents, s.currency)}).
          </p>
        )}
      </div>
    </div>
  );
};
