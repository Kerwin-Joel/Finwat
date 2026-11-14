import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
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
  PaymentKind,
  PaymentMethod,
  PaymentResult,
} from "@/types/investment";
import { PAYMENT_METHODS } from "@/types/investment";
import BottomSheet from "./BottomSheet";
import { AllocationBars, AmountInput, Chips, Field, VoucherPicker } from "./fields";
import { SuccessCheck, WarningList } from "./primitives";

type Method = Exclude<PaymentMethod, "reinversion">;
type Step = 0 | 1 | 2 | 3; // voucher → datos → imputación → listo
const STEPS = ["Voucher", "Datos", "Imputación"];

const KIND_OPTIONS: { value: PaymentKind; label: string }[] = [
  { value: "interes", label: "Intereses" },
  { value: "capital", label: "Devolución de capital" },
  { value: "mixto", label: "Ambos" },
];

const PaymentSheet = ({
  open,
  onOpenChange,
  summary,
  schedules,
  contributions,
  initialKind = "interes",
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  summary: LineSummary;
  schedules: InterestSchedule[];
  contributions: Contribution[];
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
    try {
      const r = await investmentService.registerPayment(
        { ...baseInput, allocations: manual ? manualAllocations.items : null },
        true,
      );
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
          <Button
            className="h-11 flex-1"
            disabled={!preview || saving || loadingPreview || (manual && kind === "capital" && manualAllocations.rest !== 0)}
            onClick={confirm}
          >
            {saving ? "Registrando…" : `Confirmar ${formatCents(cents ?? 0, summary.currency)}`}
          </Button>
        )}
      </div>
    );

  return (
    <BottomSheet open={open} onOpenChange={close} title={title} footer={footer}>
      {step < 3 && (
        <ol className="mb-4 flex gap-2" aria-label="Pasos">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1" aria-current={i === step ? "step" : undefined}>
              <div className={`h-1 rounded-full ${i <= step ? "bg-[#0066ff]" : "bg-muted"}`} />
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
              <Field id="p-kind" label="¿Qué está pagando?">
                <Chips label="Tipo de pago" value={kind} onChange={setKind} options={KIND_OPTIONS} />
              </Field>
              <Field id="p-amount" label="Monto" error={dataErrors.amount}>
                <AmountInput id="p-amount" value={amount} onChange={setAmount} currency={summary.currency} autoFocus invalid={!!dataErrors.amount} />
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
                          Cuota {formatDay(s.due_date, "d MMM")} · P{s.period_number}
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
                          Capital del aporte {formatDay(c.contributed_at, "d MMM yyyy")}
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

              {loadingPreview && <div className="h-24 animate-pulse rounded-xl bg-muted" aria-label="Calculando imputación" />}
              {!loadingPreview && preview && (
                <div className="space-y-3 rounded-xl border border-border/60 bg-card/60 p-4">
                  <p className="text-xs font-medium text-muted-foreground">Así se reparte</p>
                  <AllocationBars allocations={preview.allocations} currency={summary.currency} />
                </div>
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
              <AllocationBars allocations={preview.allocations} currency={summary.currency} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </BottomSheet>
  );
};

export default PaymentSheet;
