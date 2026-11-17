import { useEffect, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { investmentService } from "@/api/investmentService";
import { formatCents, formatRate, parseAmountToCents, parsePercentToRate } from "@/utils/money";
import { formatDay } from "@/utils/investmentDates";

/** Misma fecha un mes después (para proponer la fecha de pago de un préstamo) */
const plusOneMonth = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const next = new Date(Date.UTC(y, m, Math.min(d, last)));
  return next.toISOString().slice(0, 10);
};
import type { Contribution, ContributionResult, LineSummary, PaymentMethod, ReturnType } from "@/types/investment";
import { PAYMENT_METHODS, RETURN_TYPE_OPTIONS } from "@/types/investment";
import BottomSheet from "./BottomSheet";
import { AmountInput, Chips, Field, VoucherPicker } from "./fields";
import { ProgressRing, SuccessCheck, WarningList } from "./primitives";

type Method = Exclude<PaymentMethod, "reinversion">;

/** Registrar un aporte nuevo, o editar uno existente (contribution). */
const ContributionSheet = ({
  open,
  onOpenChange,
  summary,
  onDone,
  contribution,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  summary: LineSummary;
  onDone: () => void;
  contribution?: Contribution | null;
}) => {
  const { toast } = useToast();
  const editing = !!contribution;
  const [amount, setAmount] = useState(contribution ? (contribution.amount_cents / 100).toFixed(2) : "");
  const [date, setDate] = useState(contribution?.contributed_at ?? summary.today);
  const [returnType, setReturnType] = useState<ReturnType>(contribution?.return_type ?? "tasa");
  const [rate, setRate] = useState(
    String(Math.round(Number(contribution && contribution.return_type === "tasa" ? contribution.monthly_rate : summary.default_monthly_rate) * 10000) / 100),
  );
  const [fixed, setFixed] = useState(contribution?.fixed_amount_cents ? (contribution.fixed_amount_cents / 100).toFixed(2) : "");
  const [repayDate, setRepayDate] = useState(contribution?.repayment_date ?? plusOneMonth(contribution?.contributed_at ?? summary.today));
  const [method, setMethod] = useState<Method>((contribution?.method as Method) ?? "transferencia");
  const [operation, setOperation] = useState(contribution?.operation_code ?? "");
  const [bank, setBank] = useState(contribution?.source_bank ?? "");
  const [grace, setGrace] = useState(String(contribution?.grace_months ?? 0));
  const [anchor, setAnchor] = useState(contribution ? String(contribution.anchor_day) : "");
  const [notes, setNotes] = useState(contribution?.notes ?? "");
  const [reason, setReason] = useState("");
  const [voucher, setVoucher] = useState<File | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [preview, setPreview] = useState<ContributionResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const cents = parseAmountToCents(amount);
  const rateValue = parsePercentToRate(rate);
  const fixedCents = fixed.trim() ? parseAmountToCents(fixed) : null;
  const graceValue = Number(grace || 0);
  const anchorValue = anchor ? Number(anchor) : null;
  const inputErrors = {
    amount: amount && (!cents || cents <= 0) ? "Monto no válido" : null,
    date: date > summary.today ? "La fecha no puede ser futura" : null,
    rate: returnType === "tasa" && rateValue === null ? "Tasa entre 0 y 100" : null,
    fixed:
      returnType === "monto_fijo" && (!fixedCents || fixedCents <= 0)
        ? "Indica el monto mensual"
        : returnType === "comision" && (!fixedCents || fixedCents <= 0)
          ? "Indica la comisión"
          : null,
    repay: returnType === "comision" && (!repayDate || repayDate <= date) ? "Debe ser después de la fecha del préstamo" : null,
    grace: !Number.isInteger(graceValue) || graceValue < 0 || graceValue > 24 ? "Entre 0 y 24 meses" : null,
    anchor: anchorValue !== null && (!Number.isInteger(anchorValue) || anchorValue < 1 || anchorValue > 31) ? "Entre 1 y 31" : null,
  };
  const ready = !!cents && cents > 0 && !Object.values(inputErrors).some(Boolean);

  const input = {
    line_id: summary.line_id,
    amount_cents: cents ?? 0,
    contributed_at: date,
    return_type: returnType,
    monthly_rate: returnType === "tasa" ? rateValue : null,
    fixed_amount_cents: returnType === "monto_fijo" || returnType === "comision" ? fixedCents : null,
    repayment_date: returnType === "comision" ? repayDate : null,
    anchor_day: returnType === "comision" ? null : anchorValue,
    grace_months: returnType === "comision" ? 0 : graceValue,
    method,
    source_bank: bank.trim() || null,
    operation_code: operation.trim() || null,
    notes: notes.trim() || null,
  };

  // ¿La edición cambia el cálculo? Entonces se corrige (anula + registra nuevo)
  const financialChange =
    editing &&
    contribution &&
    (cents !== contribution.amount_cents ||
      date !== contribution.contributed_at ||
      returnType !== contribution.return_type ||
      (returnType === "tasa" && rateValue !== Number(contribution.monthly_rate)) ||
      ((returnType === "monto_fijo" || returnType === "comision") && fixedCents !== Number(contribution.fixed_amount_cents)) ||
      (returnType === "comision"
        ? repayDate !== contribution.repayment_date
        : (anchorValue ?? Number(date.slice(8, 10))) !== contribution.anchor_day || graceValue !== contribution.grace_months));

  // Previsualización con dry_run (debounce): rendimiento mensual, primer vencimiento y cupo
  useEffect(() => {
    if (!open || !ready || editing) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await investmentService.registerContribution(input, true);
        if (!cancelled) {
          setPreview(r);
          setPreviewError(null);
        }
      } catch (err) {
        if (!cancelled) setPreviewError((err as Error).message);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready, cents, date, returnType, rateValue, fixedCents, repayDate, graceValue, anchorValue, method, operation]);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o && !editing) {
      setAmount("");
      setOperation("");
      setBank("");
      setNotes("");
      setFixed("");
      setVoucher(null);
      setPreview(null);
      setDone(false);
      setDate(summary.today);
    }
  };

  const submit = async () => {
    if (!ready || saving) return;
    setSaving(true);
    try {
      if (editing && contribution) {
        const r = await investmentService.updateContribution(contribution.id, input, reason.trim() || undefined);
        toast({
          title: r.corrected ? "Aporte corregido" : "Aporte actualizado",
          description: r.corrected ? "El anterior quedó anulado en el historial y sus cuotas se recalcularon." : undefined,
        });
        onDone();
        onOpenChange(false);
        return;
      }
      let voucherPath: string | null = null;
      let voucherHash: string | null = null;
      if (voucher) {
        const up = await investmentService.uploadVoucher(summary.line_id, voucher);
        voucherPath = up.path;
        voucherHash = up.hash;
      }
      const r = await investmentService.registerContribution(
        { ...input, voucher_path: voucherPath, voucher_hash: voucherHash },
        false,
      );
      setPreview(r);
      setDone(true);
      onDone();
    } catch (err) {
      toast({ title: editing ? "No se guardó el aporte" : "No se registró el aporte", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const p = preview?.preview;
  const committed = summary.committed_cents;
  const monthlyLabel = (pv: NonNullable<typeof p>) =>
    pv.return_type === "comision"
      ? `Comisión de ${formatCents(pv.commission_cents ?? 0, summary.currency)}`
      : pv.return_type === "sin_interes"
      ? "Sin interés: solo se controla el capital"
      : pv.return_type === "monto_fijo"
        ? `Pago fijo de ${formatCents(pv.monthly_interest_cents, summary.currency)} al mes`
        : `Interés mensual ${formatCents(pv.monthly_interest_cents, summary.currency)} (${formatRate(pv.monthly_rate)})`;

  return (
    <BottomSheet
      open={open}
      onOpenChange={close}
      title={done ? "Aporte registrado" : editing ? "Editar aporte" : `Aporte a ${summary.manager_display_name}`}
      description={done ? undefined : editing ? undefined : "Cada aporte genera su propio rendimiento en su fecha aniversario."}
      footer={
        done ? (
          <Button className="h-11 w-full" onClick={() => close(false)}>
            Listo
          </Button>
        ) : (
          <Button className="h-11 w-full" onClick={submit} disabled={!ready || saving}>
            {saving
              ? "Guardando…"
              : editing
                ? financialChange
                  ? "Corregir aporte"
                  : "Guardar cambios"
                : cents
                  ? `Registrar ${formatCents(cents, summary.currency)}`
                  : "Registrar aporte"}
          </Button>
        )
      }
    >
      {done ? (
        <SuccessCheck
          title={`${formatCents(cents ?? 0, summary.currency)} entregados`}
          subtitle={
            p
              ? p.return_type === "comision" && p.first_due_date
                ? `${monthlyLabel(p)} + capital el ${formatDay(p.first_due_date)}`
                : p.first_due_date
                  ? `${monthlyLabel(p)} · primera cuota el ${formatDay(p.first_due_date)}`
                  : monthlyLabel(p)
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field id="c-amount" label="Monto entregado" error={inputErrors.amount}>
              <AmountInput id="c-amount" value={amount} onChange={setAmount} currency={summary.currency} autoFocus={!editing} invalid={!!inputErrors.amount} />
            </Field>
            <Field id="c-date" label="Fecha" error={inputErrors.date}>
              <Input id="c-date" type="date" className="h-11" value={date} max={summary.today} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>

          <Field
            id="c-return"
            label="Cómo te paga"
            hint={
              returnType === "tasa"
                ? "Un porcentaje del capital cada mes"
                : returnType === "monto_fijo"
                  ? "Una cantidad fija cada mes, sin importar el capital"
                  : returnType === "comision"
                    ? "Préstamo al 0 %: en la fecha de pago te paga una comisión y te devuelve el capital"
                    : "No paga interés; solo te devuelve el capital"
            }
          >
            <Chips label="Tipo de rendimiento" value={returnType} onChange={setReturnType} options={RETURN_TYPE_OPTIONS} />
          </Field>
          {returnType === "tasa" && (
            <Field id="c-rate" label="Tasa mensual %" error={inputErrors.rate}>
              <Input id="c-rate" className="h-11 tabular-nums" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </Field>
          )}
          {returnType === "monto_fijo" && (
            <Field id="c-fixed" label="Monto fijo mensual" error={inputErrors.fixed}>
              <AmountInput id="c-fixed" value={fixed} onChange={setFixed} currency={summary.currency} invalid={!!inputErrors.fixed} />
            </Field>
          )}

          {returnType === "comision" && (
            <div className="grid grid-cols-2 gap-3">
              <Field id="c-commission" label="Comisión" error={inputErrors.fixed}>
                <AmountInput id="c-commission" value={fixed} onChange={setFixed} currency={summary.currency} invalid={!!inputErrors.fixed} />
              </Field>
              <Field id="c-repay" label="Fecha de pago" error={inputErrors.repay}>
                <Input id="c-repay" type="date" className="h-11" value={repayDate} min={date} onChange={(e) => setRepayDate(e.target.value)} />
              </Field>
            </div>
          )}

          <Field id="c-method" label="Cómo se lo diste">
            <Chips label="Método" value={method} onChange={setMethod} options={PAYMENT_METHODS} />
          </Field>

          {method !== "efectivo" && (
            <div className="grid grid-cols-2 gap-3">
              <Field id="c-op" label="N.° de operación">
                <Input id="c-op" className="h-11" value={operation} onChange={(e) => setOperation(e.target.value)} />
              </Field>
              <Field id="c-bank" label="Banco / app">
                <Input id="c-bank" className="h-11" value={bank} onChange={(e) => setBank(e.target.value)} />
              </Field>
            </div>
          )}

          {!editing && (
            <Field id="c-voucher" label="Voucher (opcional)">
              <VoucherPicker file={voucher} onChange={setVoucher} uploading={saving && !!voucher} />
            </Field>
          )}

          {returnType !== "sin_interes" && returnType !== "comision" && (
            <>
              <button
                type="button"
                className="flex min-h-11 items-center gap-1 text-sm text-muted-foreground"
                onClick={() => setAdvanced((a) => !a)}
                aria-expanded={advanced}
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${advanced ? "rotate-180" : ""}`} aria-hidden="true" />
                Gracia y día de pago
              </button>
              {advanced && (
                <div className="grid grid-cols-2 gap-3">
                  <Field id="c-grace" label="Gracia (meses)" error={inputErrors.grace}>
                    <Input id="c-grace" className="h-11" inputMode="numeric" value={grace} onChange={(e) => setGrace(e.target.value)} />
                  </Field>
                  <Field id="c-anchor" label="Día de pago" error={inputErrors.anchor}>
                    <Input
                      id="c-anchor"
                      className="h-11"
                      inputMode="numeric"
                      placeholder={date ? String(Number(date.slice(8, 10))) : ""}
                      value={anchor}
                      onChange={(e) => setAnchor(e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </>
          )}

          <Field id="c-notes" label="Nota (opcional)">
            <Textarea id="c-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          {editing && financialChange && (
            <div className="space-y-3 rounded-2xl bg-secondary p-4">
              <p className="flex gap-2 text-[13px] text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                Cambiaste monto, fecha o rendimiento: el aporte se corrige. El anterior queda anulado en el historial y
                sus cuotas se recalculan. Solo se puede si aún no tiene pagos.
              </p>
              <Field id="c-reason" label="Motivo (opcional)">
                <Input id="c-reason" className="h-11" placeholder="Ej. Era 500, no 300" value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
          )}

          {/* Previsualización del impacto */}
          {p && !editing && (
            <div className="surface space-y-3 p-4" aria-live="polite">
              <p className="text-xs font-medium text-muted-foreground">Así queda</p>
              <div className="flex items-center gap-4">
                <ProgressRing
                  value={committed > 0 ? p.delivered_after_cents / committed : 0}
                  overflow={committed > 0 && p.delivered_after_cents > committed}
                  label={committed > 0 ? `${Math.round((p.delivered_after_cents / committed) * 100)}%` : "—"}
                />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{monthlyLabel(p)}</p>
                  {p.first_due_date && p.return_type === "comision" && (
                    <p className="text-muted-foreground">
                      El {formatDay(p.first_due_date)} te paga {formatCents((p.commission_cents ?? 0) + (cents ?? 0), summary.currency)}:
                      comisión + capital
                    </p>
                  )}
                  {p.first_due_date && p.return_type !== "comision" && (
                    <p className="text-muted-foreground">
                      Primera cuota el {formatDay(p.first_due_date)} · luego cada día {p.anchor_day}
                    </p>
                  )}
                  {committed > 0 && (
                    <p className="text-muted-foreground">
                      Entregado {formatCents(p.delivered_after_cents, summary.currency)} de {formatCents(committed, summary.currency)}
                    </p>
                  )}
                </div>
              </div>
              <WarningList warnings={preview?.warnings ?? []} />
            </div>
          )}
          {previewError && !editing && (
            <p className="text-xs text-orange-400" role="alert">
              {previewError}
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  );
};

export default ContributionSheet;
