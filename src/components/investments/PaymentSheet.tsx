import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Sparkles, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { investmentService } from "@/api/investmentService";
import { formatCents, parseAmountToCents } from "@/utils/money";
import { formatDay, limaNow, limaToIso } from "@/utils/investmentDates";
import type {
  Contribution,
  InterestSchedule,
  LineSummary,
  Payment,
  PaymentKind,
  PaymentMethod,
  PaymentResult,
} from "@/types/investment";
import { PAYMENT_METHODS } from "@/types/investment";
import BottomSheet from "./BottomSheet";
import { AllocationBars, AmountInput, Chips, Field, VoucherPicker } from "./fields";
import { SuccessCheck, WarningList } from "./primitives";
import WaveLoader from "./WaveLoader";
import { capitalOutstandingByContribution } from "@/utils/investmentCalc";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { celebrate } from "@/lib/celebrate";

type Method = Exclude<PaymentMethod, "reinversion">;
type Step = 0 | 1 | 2 | 3; // voucher → datos → imputación → listo
const STEPS = ["Voucher", "Datos", "Imputación"];

const kindOptions = (commission: "none" | "some" | "all"): { value: PaymentKind; label: string }[] => [
  { value: "interes", label: commission === "all" ? "Comisión" : commission === "some" ? "Intereses o comisión" : "Intereses" },
  { value: "capital", label: "Devolución de capital" },
  { value: "mixto", label: commission === "all" ? "Comisión + capital" : "Ambos" },
];

// Mínimo que se muestra el loader de imputación (para que no parpadee)
const MIN_LOADER_MS = 1100;

interface Suggestion {
  key: string;
  title: string;
  detail: string;
  cents: number;
  kind: PaymentKind;
  manual: Record<string, string> | null;
}

const PaymentSheet = ({
  open,
  onOpenChange,
  summary,
  schedules,
  contributions,
  payments = [],
  initialKind = "interes",
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  summary: LineSummary;
  schedules: InterestSchedule[];
  contributions: Contribution[];
  payments?: Payment[];
  initialKind?: PaymentKind;
  onDone: () => void;
}) => {
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const now = limaNow();

  const [step, setStep] = useState<Step>(0);
  const [voucher, setVoucher] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(now.date);
  const [time, setTime] = useState(now.time);
  const [method, setMethod] = useState<Method>("yape");
  const [kind, setKind] = useState<PaymentKind>(initialKind);
  const [operation, setOperation] = useState("");
  const [bank, setBank] = useState("");
  const [notes, setNotes] = useState("");
  const [manual, setManual] = useState(false);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PaymentResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setKind(initialKind);
  }, [open, initialKind]);

  const cents = parseAmountToCents(amount);
  const dataErrors = {
    amount: amount && (!cents || cents <= 0) ? "Monto no válido" : null,
    date: date > summary.today ? "La fecha no puede ser futura" : null,
  };
  const dataReady = !!cents && cents > 0 && !dataErrors.date;

  const pendingSchedules = useMemo(
    () =>
      schedules
        .filter((s) => (s.status === "programada" || s.status === "parcial") && s.outstanding_cents > 0)
        .sort((a, b) => a.due_date.localeCompare(b.due_date)),
    [schedules],
  );
  // Préstamos con comisión
  const commissionIds = useMemo(
    () => new Set(contributions.filter((c) => c.return_type === "comision").map((c) => c.id)),
    [contributions],
  );
  const activeAll = contributions.filter((c) => c.status === "activo");
  const commissionMode: "none" | "some" | "all" =
    activeAll.length > 0 && activeAll.every((c) => c.return_type === "comision")
      ? "all"
      : activeAll.some((c) => c.return_type === "comision")
        ? "some"
        : "none";

  // Montos sugeridos: lo vencido y, por cada préstamo con comisión, "solo comisión" o "comisión + capital"
  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    const capitalOut = capitalOutstandingByContribution(contributions, payments);
    const loans = contributions
      .filter((c) => c.status === "activo" && c.return_type === "comision" && c.repayment_date)
      .sort((a, b) => (a.repayment_date ?? "").localeCompare(b.repayment_date ?? ""));
    for (const c of loans.slice(0, 2)) {
      const sc = pendingSchedules.find((x) => x.contribution_id === c.id);
      const cap = capitalOut.get(c.id) ?? 0;
      const when = formatDay(c.repayment_date ?? "", "d MMM");
      if (sc) {
        out.push({
          key: `com-${c.id}`,
          title: "Solo comisión",
          detail: `Préstamo de ${formatCents(c.amount_cents, summary.currency)} · ${when}`,
          cents: sc.outstanding_cents,
          kind: "interes",
          manual: { [`s:${sc.id}`]: (sc.outstanding_cents / 100).toFixed(2) },
        });
      }
      if (cap > 0) {
        const manualVals: Record<string, string> = { [`c:${c.id}`]: (cap / 100).toFixed(2) };
        if (sc) manualVals[`s:${sc.id}`] = (sc.outstanding_cents / 100).toFixed(2);
        out.push({
          key: `all-${c.id}`,
          title: sc ? "Comisión + capital" : "Devuelve el capital",
          detail: `Préstamo de ${formatCents(c.amount_cents, summary.currency)} · ${when}`,
          cents: cap + (sc?.outstanding_cents ?? 0),
          kind: sc ? "mixto" : "capital",
          manual: manualVals,
        });
      }
    }
    const overdue = pendingSchedules
      .filter((x) => x.due_date <= summary.today && !commissionIds.has(x.contribution_id))
      .reduce((a, x) => a + x.outstanding_cents, 0);
    if (overdue > 0) {
      out.unshift({
        key: "overdue",
        title: "Lo vencido",
        detail: "Cuotas de interés a la fecha",
        cents: overdue,
        kind: "interes",
        manual: null,
      });
    }
    return out;
  }, [contributions, payments, pendingSchedules, commissionIds, summary.currency, summary.today]);

  const [picked, setPicked] = useState<string | null>(null);
  const pickSuggestion = (sg: Suggestion) => {
    setPicked(sg.key);
    setAmount((sg.cents / 100).toFixed(2));
    setKind(sg.kind);
    setManual(!!sg.manual);
    setManualValues(sg.manual ?? {});
  };
  // Si cambias monto o tipo a mano, la imputación vuelve a ser automática
  const resetPicked = () => {
    if (!picked) return;
    setPicked(null);
    setManual(false);
    setManualValues({});
  };
  const changeAmount = (v: string) => {
    setAmount(v);
    resetPicked();
  };
  const changeKind = (k: PaymentKind) => {
    setKind(k);
    resetPicked();
  };

  const activeContributions = useMemo(
    () => contributions.filter((c) => c.status === "activo" && c.contributed_at <= date),
    [contributions, date],
  );

  // Imputación manual → arreglo para la RPC (lo que sobra va a saldo a favor si es interés)
  const manualAllocations = useMemo(() => {
    const items: { target_type: "schedule" | "capital" | "credit"; schedule_id?: string; contribution_id?: string; amount_cents: number }[] = [];
    let sum = 0;
    for (const [key, raw] of Object.entries(manualValues)) {
      const v = parseAmountToCents(raw);
      if (!v) continue;
      const [type, id] = key.split(":");
      items.push(type === "s" ? { target_type: "schedule", schedule_id: id, amount_cents: v } : { target_type: "capital", contribution_id: id, amount_cents: v });
      sum += v;
    }
    const rest = (cents ?? 0) - sum;
    if (rest > 0 && kind !== "capital") items.push({ target_type: "credit", amount_cents: rest });
    return { items, rest };
  }, [manualValues, cents, kind]);

  const baseInput = {
    line_id: summary.line_id,
    amount_cents: cents ?? 0,
    paid_at: limaToIso(date, time),
    method,
    kind,
    source_bank: bank.trim() || null,
    operation_code: operation.trim() || null,
    notes: notes.trim() || null,
  };

  const runPreview = async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    const started = Date.now();
    const settle = () => new Promise((r) => setTimeout(r, Math.max(0, MIN_LOADER_MS - (Date.now() - started))));
    try {
      const r = await investmentService.registerPayment(
        { ...baseInput, allocations: manual ? manualAllocations.items : null },
        true,
      );
      await settle();
      setPreview(r);
      if (!manual) {
        // Prellenar el modo manual con la propuesta automática
        const vals: Record<string, string> = {};
        for (const a of r.allocations) {
          if (a.target_type === "schedule" && a.schedule_id) vals[`s:${a.schedule_id}`] = (a.amount_cents / 100).toFixed(2);
          if (a.target_type === "capital" && a.contribution_id) vals[`c:${a.contribution_id}`] = (a.amount_cents / 100).toFixed(2);
        }
        setManualValues(vals);
      }
    } catch (err) {
      await settle();
      setPreview(null);
      setPreviewError((err as Error).message);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (step === 2) runPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setStep(0);
      setVoucher(null);
      setAmount("");
      setOperation("");
      setBank("");
      setNotes("");
      setManual(false);
      setManualValues({});
      setPicked(null);
      setPreview(null);
      setPreviewError(null);
      const n = limaNow();
      setDate(n.date);
      setTime(n.time);
    }
  };

  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let voucherPath: string | null = null;
      let voucherHash: string | null = null;
      if (voucher) {
        const up = await investmentService.uploadVoucher(summary.line_id, voucher);
        voucherPath = up.path;
        voucherHash = up.hash;
      }
      const r = await investmentService.registerPayment(
        {
          ...baseInput,
          allocations: manual ? manualAllocations.items : null,
          voucher_path: voucherPath,
          voucher_hash: voucherHash,
        },
        false,
      );
      celebrate();
      setPreview(r);
      setStep(3);
      onDone();
    } catch (err) {
      toast({ title: "No se registró el pago", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const title = step === 3 ? "Pago registrado" : kind === "capital" ? "Devolución de capital" : "Registrar pago";
  const isCommissionSchedule = (sc: InterestSchedule) => commissionIds.has(sc.contribution_id);

  const footer =
    step === 3 ? (
      <Button className="h-11 w-full" onClick={() => close(false)}>
        Listo
      </Button>
    ) : (
      <div className="flex gap-2">
        {step > 0 && (
          <Button variant="outline" className="h-11" onClick={() => setStep((s) => (s - 1) as Step)} aria-label="Paso anterior">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        {step === 0 && (
          <Button className="h-11 flex-1" onClick={() => setStep(1)}>
            {voucher ? "Continuar" : "Seguir sin voucher"}
          </Button>
        )}
        {step === 1 && (
          <Button className="h-11 flex-1" disabled={!dataReady} onClick={() => setStep(2)}>
            Ver imputación
          </Button>
        )}
        {step === 2 && (
          <ConfirmButton
            className="h-11 flex-1"
            disabled={!preview || loadingPreview || (manual && kind === "capital" && manualAllocations.rest !== 0)}
            loading={saving}
            loadingText="Registrando…"
            onClick={confirm}
          >
            {`Confirmar ${formatCents(cents ?? 0, summary.currency)}`}
          </ConfirmButton>
        )}
      </div>
    );

  return (
    <BottomSheet open={open} onOpenChange={close} title={title} footer={footer}>
      {step < 3 && (
        <ol className="mb-4 flex gap-2" aria-label="Pasos">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1" aria-current={i === step ? "step" : undefined}>
              <div className={`h-1 rounded-full ${i <= step ? "bg-brand" : "bg-muted"}`} />
              <p className={`mt-1 text-[11px] ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
            </li>
          ))}
        </ol>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
        >
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sube la captura de Yape/Plin o la constancia de la transferencia. Es opcional en efectivo.
              </p>
              <VoucherPicker file={voucher} onChange={setVoucher} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden="true" /> Montos sugeridos
                  </p>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {suggestions.map((sg) => {
                      const active = picked === sg.key;
                      return (
                        <button
                          key={sg.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() => pickSuggestion(sg)}
                          className={cn(
                            "min-h-11 shrink-0 rounded-2xl border px-3.5 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active ? "border-brand bg-brand/10" : "border-border/70 bg-card hover:bg-secondary",
                          )}
                        >
                          <span className="block text-[12px] text-muted-foreground">{sg.title}</span>
                          <span className="num block text-[15px] font-semibold tracking-[-0.02em]">{formatCents(sg.cents, summary.currency)}</span>
                          <span className="block text-[11px] text-muted-foreground">{sg.detail}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <Field id="p-kind" label="¿Qué está pagando?">
                <Chips label="Tipo de pago" value={kind} onChange={changeKind} options={kindOptions(commissionMode)} />
              </Field>
              <Field id="p-amount" label="Monto" error={dataErrors.amount}>
                <AmountInput id="p-amount" value={amount} onChange={changeAmount} currency={summary.currency} autoFocus invalid={!!dataErrors.amount} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="p-date" label="Fecha" error={dataErrors.date}>
                  <Input id="p-date" type="date" className="h-11" value={date} max={summary.today} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field id="p-time" label="Hora">
                  <Input id="p-time" type="time" className="h-11" value={time} onChange={(e) => setTime(e.target.value)} />
                </Field>
              </div>
              <Field id="p-method" label="Método">
                <Chips label="Método" value={method} onChange={setMethod} options={PAYMENT_METHODS} />
              </Field>
              {method !== "efectivo" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field id="p-op" label="N.° de operación">
                    <Input id="p-op" className="h-11" value={operation} onChange={(e) => setOperation(e.target.value)} />
                  </Field>
                  <Field id="p-bank" label="Banco / app de origen">
                    <Input id="p-bank" className="h-11" value={bank} onChange={(e) => setBank(e.target.value)} />
                  </Field>
                </div>
              )}
              <Field id="p-notes" label="Nota (opcional)">
                <Textarea id="p-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4" aria-live="polite">
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  {formatCents(cents ?? 0, summary.currency)} · {formatDay(date)}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 gap-1"
                  aria-pressed={manual}
                  onClick={() => setManual((m) => !m)}
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  {manual ? "Automática" : "Ajustar"}
                </Button>
              </div>

              {manual ? (
                <div className="space-y-3">
                  {kind !== "capital" &&
                    pendingSchedules.map((s) => (
                      <div key={s.id} className="flex items-center gap-3">
                        <label htmlFor={`m-s-${s.id}`} className="flex-1 text-xs">
                          {isCommissionSchedule(s) ? `Comisión · vence ${formatDay(s.due_date, "d MMM")}` : `Cuota ${formatDay(s.due_date, "d MMM")} · P${s.period_number}`}
                          <span className="block text-muted-foreground">debe {formatCents(s.outstanding_cents, summary.currency)}</span>
                        </label>
                        <Input
                          id={`m-s-${s.id}`}
                          inputMode="decimal"
                          className="h-11 w-28 text-right tabular-nums"
                          value={manualValues[`s:${s.id}`] ?? ""}
                          onChange={(e) => setManualValues((v) => ({ ...v, [`s:${s.id}`]: e.target.value }))}
                        />
                      </div>
                    ))}
                  {kind !== "interes" &&
                    activeContributions.map((c) => (
                      <div key={c.id} className="flex items-center gap-3">
                        <label htmlFor={`m-c-${c.id}`} className="flex-1 text-xs">
                          {c.return_type === "comision" ? "Capital del préstamo" : "Capital del aporte"} {formatDay(c.contributed_at, "d MMM yyyy")}
                          <span className="block text-muted-foreground">aporte de {formatCents(c.amount_cents, summary.currency)}</span>
                        </label>
                        <Input
                          id={`m-c-${c.id}`}
                          inputMode="decimal"
                          className="h-11 w-28 text-right tabular-nums"
                          value={manualValues[`c:${c.id}`] ?? ""}
                          onChange={(e) => setManualValues((v) => ({ ...v, [`c:${c.id}`]: e.target.value }))}
                        />
                      </div>
                    ))}
                  <p className={`text-xs ${manualAllocations.rest < 0 || (kind === "capital" && manualAllocations.rest !== 0) ? "text-orange-400" : "text-muted-foreground"}`}>
                    {manualAllocations.rest < 0
                      ? `Te pasaste por ${formatCents(-manualAllocations.rest, summary.currency)}`
                      : manualAllocations.rest > 0
                        ? kind === "capital"
                          ? `Faltan asignar ${formatCents(manualAllocations.rest, summary.currency)}`
                          : `${formatCents(manualAllocations.rest, summary.currency)} quedan como saldo a favor`
                        : "Todo asignado"}
                  </p>
                  <Button variant="outline" className="h-11 w-full" onClick={runPreview} disabled={loadingPreview || manualAllocations.rest < 0}>
                    Validar imputación
                  </Button>
                </div>
              ) : null}

              {loadingPreview && (
                <WaveLoader
                  label="Calculando la imputación"
                  steps={
                    kind === "capital"
                      ? ["Revisando el capital vigente", "Ordenando los aportes", "Repartiendo la devolución"]
                      : [
                          commissionMode === "all" ? "Buscando comisiones pendientes" : "Buscando cuotas pendientes",
                          "Aplicando de la más antigua a la más nueva",
                          kind === "mixto" ? "Repartiendo el capital" : "Revisando saldo a favor",
                        ]
                  }
                />
              )}
              {!loadingPreview && preview && (
                <motion.div
                  className="space-y-3 surface p-4"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p className="text-xs font-medium text-muted-foreground">Así se reparte</p>
                  <AllocationBars allocations={preview.allocations} currency={summary.currency} commissionIds={commissionIds} />
                </motion.div>
              )}
              {preview && <WarningList warnings={preview.warnings} />}
              {previewError && (
                <p className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-xs text-orange-300" role="alert">
                  {previewError}
                </p>
              )}
            </div>
          )}

          {step === 3 && preview && (
            <div className="space-y-4">
              <SuccessCheck
                title={`${formatCents(cents ?? 0, summary.currency)} registrados`}
                subtitle={summary.manager_linked ? "Queda pendiente de confirmación" : undefined}
              />
              <AllocationBars allocations={preview.allocations} currency={summary.currency} commissionIds={commissionIds} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </BottomSheet>
  );
};

export default PaymentSheet;
