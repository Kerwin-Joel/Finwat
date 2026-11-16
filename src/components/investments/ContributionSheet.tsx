import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { investmentService } from "@/api/investmentService";
import { formatCents, formatRate, parseAmountToCents, parsePercentToRate } from "@/utils/money";
import { formatDay } from "@/utils/investmentDates";
import type { ContributionResult, LineSummary, PaymentMethod } from "@/types/investment";
import { PAYMENT_METHODS } from "@/types/investment";
import BottomSheet from "./BottomSheet";
import { AmountInput, Chips, Field, VoucherPicker } from "./fields";
import { ProgressRing, SuccessCheck, WarningList } from "./primitives";

type Method = Exclude<PaymentMethod, "reinversion">;

const ContributionSheet = ({
  open,
  onOpenChange,
  summary,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  summary: LineSummary;
  onDone: () => void;
}) => {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(summary.today);
  const [rate, setRate] = useState(String(Math.round(summary.default_monthly_rate * 10000) / 100));
  const [method, setMethod] = useState<Method>("transferencia");
  const [operation, setOperation] = useState("");
  const [bank, setBank] = useState("");
  const [grace, setGrace] = useState("0");
  const [anchor, setAnchor] = useState("");
  const [notes, setNotes] = useState("");
  const [voucher, setVoucher] = useState<File | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [preview, setPreview] = useState<ContributionResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const cents = parseAmountToCents(amount);
  const rateValue = parsePercentToRate(rate);
  const graceValue = Number(grace || 0);
  const anchorValue = anchor ? Number(anchor) : null;
  const inputErrors = {
    amount: amount && (!cents || cents <= 0) ? "Monto no válido" : null,
    date: date > summary.today ? "La fecha no puede ser futura" : null,
    rate: rateValue === null ? "Tasa entre 0 y 100" : null,
    grace: !Number.isInteger(graceValue) || graceValue < 0 || graceValue > 24 ? "Entre 0 y 24 meses" : null,
    anchor: anchorValue !== null && (!Number.isInteger(anchorValue) || anchorValue < 1 || anchorValue > 31) ? "Entre 1 y 31" : null,
  };
  const ready = !!cents && cents > 0 && !Object.values(inputErrors).some(Boolean);

  const input = {
    line_id: summary.line_id,
    amount_cents: cents ?? 0,
    contributed_at: date,
    monthly_rate: rateValue,
    anchor_day: anchorValue,
    grace_months: graceValue,
    method,
    source_bank: bank.trim() || null,
    operation_code: operation.trim() || null,
    notes: notes.trim() || null,
  };

  // Previsualización con dry_run (debounce): interés mensual, primer vencimiento y cupo
  useEffect(() => {
    if (!open || !ready) {
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
  }, [open, ready, cents, date, rateValue, graceValue, anchorValue, method, operation]);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setAmount("");
      setOperation("");
      setBank("");
      setNotes("");
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
      toast({ title: "No se registró el aporte", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const p = preview?.preview;
  const committed = summary.committed_cents;

  return (
    <BottomSheet
      open={open}
      onOpenChange={close}
      title={done ? "Aporte registrado" : `Aporte a ${summary.manager_display_name}`}
      description={done ? undefined : "Cada aporte genera su propio interés en su fecha aniversario."}
      footer={
        done ? (
          <Button className="h-11 w-full" onClick={() => close(false)}>
            Listo
          </Button>
        ) : (
          <Button className="h-11 w-full" onClick={submit} disabled={!ready || saving}>
            {saving ? "Registrando…" : cents ? `Registrar ${formatCents(cents, summary.currency)}` : "Registrar aporte"}
          </Button>
        )
      }
    >
      {done ? (
        <SuccessCheck
          title={`${formatCents(cents ?? 0, summary.currency)} entregados`}
          subtitle={p ? `Primera cuota de ${formatCents(p.monthly_interest_cents, summary.currency)} el ${formatDay(p.first_due_date)}` : undefined}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field id="c-amount" label="Monto entregado" error={inputErrors.amount}>
              <AmountInput id="c-amount" value={amount} onChange={setAmount} currency={summary.currency} autoFocus invalid={!!inputErrors.amount} />
            </Field>
            <Field id="c-date" label="Fecha" error={inputErrors.date}>
              <Input id="c-date" type="date" className="h-11" value={date} max={summary.today} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>

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

          <Field id="c-voucher" label="Voucher (opcional)">
            <VoucherPicker file={voucher} onChange={setVoucher} uploading={saving && !!voucher} />
          </Field>

          <button
            type="button"
            className="flex min-h-11 items-center gap-1 text-sm text-muted-foreground"
            onClick={() => setAdvanced((a) => !a)}
            aria-expanded={advanced}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${advanced ? "rotate-180" : ""}`} aria-hidden="true" />
            Tasa, gracia y día de pago
          </button>
          {advanced && (
            <div className="grid grid-cols-3 gap-3">
              <Field id="c-rate" label="Tasa %" error={inputErrors.rate}>
                <Input id="c-rate" className="h-11 tabular-nums" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
              </Field>
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

          <Field id="c-notes" label="Nota (opcional)">
            <Textarea id="c-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          {/* Previsualización del impacto */}
          {p && (
            <div className="space-y-3 surface p-4" aria-live="polite">
              <p className="text-xs font-medium text-muted-foreground">Así queda</p>
              <div className="flex items-center gap-4">
                <ProgressRing
                  value={committed > 0 ? p.delivered_after_cents / committed : 0}
                  overflow={committed > 0 && p.delivered_after_cents > committed}
                  label={committed > 0 ? `${Math.round((p.delivered_after_cents / committed) * 100)}%` : "—"}
                />
                <div className="space-y-1 text-sm">
                  <p>
                    Interés mensual{" "}
                    <span className="font-semibold tabular-nums">{formatCents(p.monthly_interest_cents, summary.currency)}</span>{" "}
                    <span className="text-muted-foreground">({formatRate(p.monthly_rate)})</span>
                  </p>
                  <p className="text-muted-foreground">
                    Primera cuota el {formatDay(p.first_due_date)} · luego cada día {p.anchor_day}
                  </p>
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
          {previewError && (
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
