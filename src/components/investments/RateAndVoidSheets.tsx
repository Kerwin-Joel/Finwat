import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { investmentService } from "@/api/investmentService";
import { formatCents, formatRate, parsePercentToRate } from "@/utils/money";
import { formatDay } from "@/utils/investmentDates";
import type { Contribution, InterestSchedule, LineSummary } from "@/types/investment";
import BottomSheet from "./BottomSheet";
import { Field } from "./fields";

// ------------------------------------------------------------------ Cambio de tasa
/** Por aporte (desde un periodo) o para toda la línea (desde una fecha). Nunca toca cuotas pagadas. */
export const RateChangeSheet = ({
  open,
  onOpenChange,
  summary,
  contribution,
  schedules,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  summary: LineSummary;
  contribution: Contribution | null; // null = toda la línea
  schedules: InterestSchedule[];
  onDone: () => void;
}) => {
  const { toast } = useToast();
  const own = contribution ? schedules.filter((s) => s.contribution_id === contribution.id) : [];
  const firstFree =
    own.filter((s) => s.amount_paid_cents === 0 && s.amount_waived_cents === 0 && s.status !== "anulada")
      .map((s) => s.period_number)
      .sort((a, b) => a - b)[0] ?? (own.length ? Math.max(...own.map((s) => s.period_number)) + 1 : 1);
  const lastPaid = Math.max(0, ...own.filter((s) => s.amount_paid_cents > 0 || s.amount_waived_cents > 0).map((s) => s.period_number));

  const [rate, setRate] = useState("");
  const [fromPeriod, setFromPeriod] = useState(String(Math.max(firstFree, lastPaid + 1)));
  const [effective, setEffective] = useState(summary.today);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const rateValue = parsePercentToRate(rate);
  const from = Number(fromPeriod);
  const errors = {
    rate: rate && rateValue === null ? "Tasa entre 0 y 100" : null,
    from:
      contribution && (!Number.isInteger(from) || from < 1)
        ? "Periodo no válido"
        : contribution && from <= lastPaid
          ? `El periodo ${lastPaid} ya tiene pagos: elige desde el ${lastPaid + 1}`
          : null,
  };
  const ready = rateValue !== null && !!reason.trim() && !errors.from;
  const affected = contribution
    ? own.filter((s) => s.period_number >= from && s.status !== "anulada")
    : [];

  const submit = async () => {
    if (!ready || saving || rateValue === null) return;
    setSaving(true);
    try {
      if (contribution) {
        await investmentService.changeContributionRate(contribution.id, rateValue, from, reason.trim());
      } else {
        await investmentService.changeLineRate(summary.line_id, rateValue, effective, reason.trim());
      }
      toast({ title: `Tasa cambiada a ${formatRate(rateValue)}` });
      onOpenChange(false);
      setRate("");
      setReason("");
      onDone();
    } catch (err) {
      toast({ title: "No se cambió la tasa", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Cambiar tasa"
      description={
        contribution
          ? `Aporte del ${formatDay(contribution.contributed_at)} (${formatCents(contribution.amount_cents, summary.currency)}) · hoy ${formatRate(contribution.monthly_rate)}`
          : `Todos los aportes activos con ${summary.manager_display_name}`
      }
      footer={
        <Button className="h-11 w-full" onClick={submit} disabled={!ready || saving}>
          {saving ? "Guardando…" : "Cambiar tasa"}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field id="r-rate" label="Nueva tasa mensual %" error={errors.rate}>
            <Input id="r-rate" className="h-11 tabular-nums" inputMode="decimal" autoFocus value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
          {contribution ? (
            <Field id="r-from" label="Desde el periodo" error={errors.from}>
              <Input id="r-from" className="h-11" inputMode="numeric" value={fromPeriod} onChange={(e) => setFromPeriod(e.target.value)} />
            </Field>
          ) : (
            <Field id="r-eff" label="Desde la fecha" hint="Aplica a los periodos que empiecen ese día o después">
              <Input id="r-eff" type="date" className="h-11" value={effective} onChange={(e) => setEffective(e.target.value)} />
            </Field>
          )}
        </div>
        <Field id="r-reason" label="Motivo">
          <Textarea id="r-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Acordamos bajar la tasa" />
        </Field>
        <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          Las cuotas ya pagadas no cambian. {contribution && affected.length > 0 && rateValue !== null
            ? `Se recalculan ${affected.length} cuota(s): ${formatCents(Math.round(contribution.amount_cents * rateValue), summary.currency)} al mes con el capital actual.`
            : ""}
        </p>
      </div>
    </BottomSheet>
  );
};

// ------------------------------------------------------------------ Anular
export const VoidSheet = ({
  open,
  onOpenChange,
  target,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: { type: "contribution" | "payment"; id: string; label: string } | null;
  onDone: () => void;
}) => {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!target || !reason.trim() || saving) return;
    setSaving(true);
    try {
      await investmentService.voidMovement(target.type, target.id, reason.trim());
      toast({ title: "Movimiento anulado" });
      setReason("");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast({ title: "No se pudo anular", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={target?.type === "payment" ? "Anular pago" : "Anular aporte"}
      description={target?.label}
      footer={
        <Button variant="destructive" className="h-11 w-full" onClick={submit} disabled={!reason.trim() || saving}>
          {saving ? "Anulando…" : "Anular"}
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Nada se borra: el movimiento queda en el historial como anulado y se revierte su efecto en las cuotas y saldos.
        </p>
        <Field id="v-reason" label="Motivo (obligatorio)">
          <Textarea id="v-reason" rows={3} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </BottomSheet>
  );
};
