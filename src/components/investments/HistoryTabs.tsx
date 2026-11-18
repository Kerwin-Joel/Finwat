import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  CircleSlash,
  History,
  Pencil,
  Percent,
  Plus,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import useAuthStore from "@/stores/authStore";
import { investmentService } from "@/api/investmentService";
import { formatCents, formatRate } from "@/utils/money";
import { formatDay } from "@/utils/investmentDates";
import type { AuditEntry, InterestSchedule, LineDetail } from "@/types/investment";
import { METHOD_LABEL } from "@/types/investment";
import { EmptyState, ScheduleBadge } from "./primitives";
import { riseItem, staggerContainer } from "@/lib/motion";

const limaDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

const monthLabel = (ym: string) => format(parseISO(`${ym}-01`), "MMMM yyyy", { locale: es });

// =================================================================== Historial mensual
interface MonthRow {
  ym: string;
  expected: number;
  collected: number;
  pending: number;
  schedules: InterestSchedule[];
  paymentsIn: number;
  paymentsCount: number;
  capitalOut: number; // aportes entregados
  capitalBack: number; // capital devuelto
}

/** Un resumen por mes: lo esperado, lo cobrado y lo pendiente/vencido, con su detalle. */
export const HistoryTab = ({ detail }: { detail: LineDetail }) => {
  const { schedules, payments, contributions, summary: s } = detail;
  const reduce = useReducedMotion();
  const currentYm = s.today.slice(0, 7);
  const [open, setOpen] = useState<string | null>(currentYm);

  const months = useMemo(() => {
    const map = new Map<string, MonthRow>();
    const get = (ym: string) => {
      let m = map.get(ym);
      if (!m) {
        m = { ym, expected: 0, collected: 0, pending: 0, schedules: [], paymentsIn: 0, paymentsCount: 0, capitalOut: 0, capitalBack: 0 };
        map.set(ym, m);
      }
      return m;
    };
    for (const sc of schedules) {
      if (sc.status === "anulada") continue;
      const m = get(sc.due_date.slice(0, 7));
      m.expected += sc.amount_due_cents;
      m.collected += sc.amount_paid_cents + sc.amount_waived_cents;
      m.pending += sc.outstanding_cents;
      m.schedules.push(sc);
    }
    for (const p of payments) {
      if (p.status === "anulado") continue;
      const m = get(limaDate(p.paid_at).slice(0, 7));
      m.paymentsIn += p.amount_cents;
      m.paymentsCount += 1;
      for (const a of p.allocations) if (a.target_type === "capital" && !a.voided_at) m.capitalBack += a.amount_cents;
    }
    for (const c of contributions) {
      if (c.status === "anulado") continue;
      get(c.contributed_at.slice(0, 7)).capitalOut += c.amount_cents;
    }
    return [...map.values()].sort((a, b) => b.ym.localeCompare(a.ym));
  }, [schedules, payments, contributions]);

  if (months.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-10 w-10" />}
        title="Aún no hay historial"
        description="Cada mes se guarda aquí: lo que te debían pagar, lo que cobraste y lo que quedó pendiente."
      />
    );
  }

  return (
    <motion.ol className="space-y-3" variants={staggerContainer} initial="hidden" animate="show">
      {months.map((m) => {
        const expanded = open === m.ym;
        const past = m.ym < currentYm;
        const future = m.ym > currentYm;
        const pct = m.expected > 0 ? Math.min(1, m.collected / m.expected) : m.expected === 0 ? 1 : 0;
        const state =
          m.expected === 0
            ? { label: "Sin cuotas", cls: "bg-muted text-muted-foreground" }
            : m.pending === 0
              ? { label: "Cobrado", cls: "bg-positive/10 text-positive" }
              : past
                ? { label: `Vencido ${formatCents(m.pending, s.currency)}`, cls: "bg-orange-500/10 text-orange-600 dark:text-orange-400" }
                : { label: `Pendiente ${formatCents(m.pending, s.currency)}`, cls: "bg-brand/10 text-brand" };
        return (
          <motion.li key={m.ym} variants={riseItem} className="surface overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : m.ym)}
              aria-expanded={expanded}
              className="w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-semibold capitalize tracking-[-0.015em]">{monthLabel(m.ym)}</p>
                  {m.ym === currentYm && <span className="rounded-full bg-primary px-2 py-0.5 text-[10.5px] font-semibold text-primary-foreground">En curso</span>}
                  {future && <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">Próximo</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", state.cls)}>{state.label}</span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", expanded && "rotate-180")} aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                <div>
                  <p className="text-muted-foreground">Esperado</p>
                  <p className="num mt-0.5 text-[14px] font-semibold">{formatCents(m.expected, s.currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cobrado</p>
                  <p className="num mt-0.5 text-[14px] font-semibold text-positive">{formatCents(m.collected, s.currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{past ? "Vencido" : "Pendiente"}</p>
                  <p className={cn("num mt-0.5 text-[14px] font-semibold", past && m.pending > 0 && "text-orange-600 dark:text-orange-400")}>
                    {formatCents(m.pending, s.currency)}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <motion.div
                  className="h-full origin-left rounded-full bg-positive"
                  initial={{ scaleX: reduce ? pct : 0 }}
                  animate={{ scaleX: pct }}
                  transition={{ duration: reduce ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </button>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 border-t border-border/60 p-4">
                    {(m.capitalOut > 0 || m.paymentsCount > 0 || m.capitalBack > 0) && (
                      <div className="flex flex-wrap gap-2 text-[12px]">
                        {m.capitalOut > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> Entregaste {formatCents(m.capitalOut, s.currency)}
                          </span>
                        )}
                        {m.paymentsCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
                            <ArrowDownLeft className="h-3.5 w-3.5 text-positive" aria-hidden="true" /> {m.paymentsCount} pago(s) por{" "}
                            {formatCents(m.paymentsIn, s.currency)}
                          </span>
                        )}
                        {m.capitalBack > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
                            <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" /> Te devolvió {formatCents(m.capitalBack, s.currency)} de capital
                          </span>
                        )}
                      </div>
                    )}
                    {m.schedules.length > 0 ? (
                      <ul className="divide-y divide-border/60">
                        {m.schedules
                          .sort((a, b) => a.due_date.localeCompare(b.due_date))
                          .map((sc) => (
                            <li key={sc.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                              <div>
                                <p className="font-medium">
                                  {formatDay(sc.due_date, "d MMM")} · aporte del {formatDay(sc.contributed_at, "d MMM yyyy")}
                                </p>
                                <p className="num text-[12px] text-muted-foreground">
                                  {formatCents(sc.amount_due_cents, s.currency)}
                                  {sc.amount_paid_cents > 0 && sc.status !== "pagada" ? ` · pagado ${formatCents(sc.amount_paid_cents, s.currency)}` : ""}
                                </p>
                              </div>
                              <ScheduleBadge status={sc.display_status} partial={sc.status === "parcial"} daysLate={sc.days_late} />
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-muted-foreground">Este mes no vencía ninguna cuota.</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.li>
        );
      })}
    </motion.ol>
  );
};

// =================================================================== Auditoría
const FIELD_LABEL: Record<string, string> = {
  method: "método",
  source_bank: "banco",
  operation_code: "n.° de operación",
  notes: "nota",
  committed_amount_cents: "cupo",
  default_monthly_rate: "tasa por defecto",
  interest_on_return_mode: "interés al devolver capital",
  manager_display_name: "nombre del gestor",
  manager_phone: "celular del gestor",
  due_soon_days: "aviso de vencimiento",
  payment_grace_days: "días de tolerancia",
};

interface AuditView {
  icon: LucideIcon;
  tone: "neutral" | "danger" | "brand" | "good";
  title: string;
  detail?: string;
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => Number(v ?? 0);

/** Traduce una fila de audit_log a una frase; null = cambio interno sin interés para el usuario */
const describeAudit = (e: AuditEntry, currency: string): AuditView | null => {
  const n = e.new_data ?? {};
  const o = e.old_data ?? {};
  const changed = (keys: string[]) => keys.filter((k) => str(n[k]) !== str(o[k]));

  if (e.table_name === "contributions") {
    const amount = formatCents(num(n.amount_cents || o.amount_cents), currency);
    if (e.action === "INSERT") {
      const kind =
        n.return_type === "comision"
          ? `comisión de ${formatCents(num(n.fixed_amount_cents), currency)} al ${formatDay(str(n.repayment_date))}`
          : n.return_type === "sin_interes"
          ? "sin interés"
          : n.return_type === "monto_fijo"
            ? `${formatCents(num(n.fixed_amount_cents), currency)} fijo al mes`
            : `${formatRate(num(n.monthly_rate))} mensual`;
      return { icon: Plus, tone: "brand", title: `Aporte registrado: ${amount}`, detail: `${formatDay(str(n.contributed_at))} · ${kind}` };
    }
    if (o.status !== "anulado" && n.status === "anulado") {
      return { icon: Trash2, tone: "danger", title: `Aporte eliminado: ${amount}`, detail: str(n.void_reason) };
    }
    if (o.status === "activo" && n.status === "liquidado") return { icon: ShieldCheck, tone: "good", title: `Aporte liquidado: ${amount}` };
    const edited = changed(["method", "source_bank", "operation_code", "notes"]);
    if (edited.length) {
      return {
        icon: Pencil,
        tone: "neutral",
        title: `Aporte editado: ${amount}`,
        detail: `Cambió ${edited.map((k) => FIELD_LABEL[k]).join(", ")}${
          edited.includes("method") ? ` (${METHOD_LABEL[o.method as keyof typeof METHOD_LABEL] ?? str(o.method)} → ${METHOD_LABEL[n.method as keyof typeof METHOD_LABEL] ?? str(n.method)})` : ""
        }`,
      };
    }
    return null;
  }

  if (e.table_name === "payments") {
    const amount = formatCents(num(n.amount_cents || o.amount_cents), currency);
    if (e.action === "INSERT") {
      const kind = n.kind === "capital" ? "devolución de capital" : n.kind === "mixto" ? "interés y capital" : "intereses";
      return { icon: ArrowDownLeft, tone: "good", title: `Pago registrado: ${amount}`, detail: `${kind} · ${METHOD_LABEL[n.method as keyof typeof METHOD_LABEL] ?? ""}` };
    }
    if (o.status !== "anulado" && n.status === "anulado") {
      return { icon: Trash2, tone: "danger", title: `Pago eliminado: ${amount}`, detail: str(n.void_reason) };
    }
    return null;
  }

  if (e.table_name === "rate_changes" && e.action === "INSERT") {
    return {
      icon: Percent,
      tone: "brand",
      title: `Tasa cambiada de ${formatRate(num(n.old_rate))} a ${formatRate(num(n.new_rate))}`,
      detail: `Desde el periodo ${str(n.from_period)} · ${str(n.reason)}`,
    };
  }

  if (e.table_name === "investment_lines") {
    if (e.action === "INSERT") return { icon: Plus, tone: "brand", title: `Línea creada con ${str(n.manager_display_name)}` };
    if (o.status !== "cerrada" && n.status === "cerrada") return { icon: CircleSlash, tone: "neutral", title: "Línea cerrada" };
    const edited = changed(Object.keys(FIELD_LABEL)).filter((k) => k in n);
    if (edited.length) {
      const parts = edited.map((k) =>
        k === "committed_amount_cents"
          ? `cupo ${formatCents(num(o[k]), currency)} → ${formatCents(num(n[k]), currency)}`
          : k === "default_monthly_rate"
            ? `tasa ${formatRate(num(o[k]))} → ${formatRate(num(n[k]))}`
            : FIELD_LABEL[k],
      );
      return { icon: Settings2, tone: "neutral", title: "Ajustes de la línea", detail: `Cambió ${parts.join(", ")}` };
    }
  }
  return null;
};

const TONE: Record<AuditView["tone"], string> = {
  neutral: "bg-muted text-muted-foreground",
  danger: "bg-destructive/10 text-destructive",
  brand: "bg-brand/10 text-brand",
  good: "bg-positive/10 text-positive",
};

/** Eliminados + línea de tiempo de todos los cambios (quién, qué, cuándo). */
export const AuditTab = ({ detail }: { detail: LineDetail }) => {
  const { summary: s, contributions, payments } = detail;
  const userId = useAuthStore((st) => st.user?.id);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    investmentService
      .getAuditLog(s.line_id)
      .then((rows) => !cancelled && setEntries(rows))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [s.line_id, reloadKey, contributions, payments]);

  const removed = [
    ...contributions.filter((c) => c.status === "anulado").map((c) => ({
      id: c.id,
      kind: "Aporte",
      amount: c.amount_cents,
      date: c.contributed_at,
      reason: c.void_reason,
    })),
    ...payments.filter((p) => p.status === "anulado").map((p) => ({
      id: p.id,
      kind: "Pago",
      amount: p.amount_cents,
      date: limaDate(p.paid_at),
      reason: p.void_reason,
    })),
  ];

  const events = (entries ?? [])
    .map((e) => ({ e, v: describeAudit(e, s.currency) }))
    .filter((x): x is { e: AuditEntry; v: AuditView } => x.v !== null);

  return (
    <div className="space-y-6">
      <section aria-labelledby="audit-removed" className="space-y-2">
        <h3 id="audit-removed" className="text-[15px] font-semibold tracking-[-0.015em]">
          Eliminados
        </h3>
        {removed.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No has eliminado aportes ni pagos.</p>
        ) : (
          <ul className="surface divide-y divide-border/60">
            {removed.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="text-[14px] font-semibold">
                    {r.kind} de <span className="num line-through decoration-destructive/60">{formatCents(r.amount, s.currency)}</span>
                  </p>
                  <p className="text-[12.5px] text-muted-foreground">
                    Del {formatDay(r.date)}
                    {r.reason ? ` · ${r.reason}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">Eliminado</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="audit-timeline" className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 id="audit-timeline" className="text-[15px] font-semibold tracking-[-0.015em]">
            Registro de cambios
          </h3>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCcw className="h-4 w-4" /> Actualizar
          </Button>
        </div>
        <p className="text-[12.5px] text-muted-foreground">Nada se borra: cada cambio queda con quién lo hizo y cuándo.</p>
        {error ? (
          <p className="text-[13px] text-destructive" role="alert">
            {error}
          </p>
        ) : entries === null ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="shimmer h-14 rounded-2xl" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Aún no hay cambios registrados.</p>
        ) : (
          <motion.ol className="relative space-y-1 border-l border-border/70 pl-5" variants={staggerContainer} initial="hidden" animate="show">
            {events.map(({ e, v }) => (
              <motion.li key={e.id} variants={riseItem} className="relative py-2">
                <span className={cn("absolute -left-[33px] top-2.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background", TONE[v.tone])} aria-hidden="true">
                  <v.icon className="h-3.5 w-3.5" />
                </span>
                <p className="text-[13.5px] font-medium">{v.title}</p>
                {v.detail && <p className="text-[12.5px] text-muted-foreground">{v.detail}</p>}
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {e.actor && e.actor === userId ? "Tú" : e.actor ? "Gestor" : "Sistema"} ·{" "}
                  {new Date(e.changed_at).toLocaleString("es-PE", {
                    timeZone: "America/Lima",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </motion.li>
            ))}
          </motion.ol>
        )}
      </section>
    </div>
  );
};
