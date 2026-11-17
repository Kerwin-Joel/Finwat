import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { investmentService } from "@/api/investmentService";
import { formatCents, formatRate, parsePercentToRate } from "@/utils/money";
import { formatDay } from "@/utils/investmentDates";
import type { Contribution, InterestSchedule, LineSummary } from "@/types/investment";
import { ShieldCheck } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { Field } from "./fields";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { celebrate } from "@/lib/celebrate";

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

  const currentRate = Number(contribution ? contribution.monthly_rate : summary.default_monthly_rate);
  // Prellenada con la tasa actual: solo hay que ajustarla
  const [rate, setRate] = useState(String(Math.round(currentRate * 10000) / 100));
  const [fromPeriod, setFromPeriod] = useState(String(Math.max(firstFree, lastPaid + 1)));
  const [effective, setEffective] = useState(summary.today);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const rateValue = parsePercentToRate(rate);
  const from = Number(fromPeriod);
  const errors = {
    rate:
      rateValue === null
        ? "Escribe una tasa entre 0 y 100"
        : rateValue === currentRate
          ? "Es la misma tasa actual: escribe la nueva"
          : null,
    from:
      contribution && (!Number.isInteger(from) || from < 1)
        ? "Periodo no válido"
        : contribution && from <= lastPaid
          ? `El periodo ${lastPaid} ya tiene pagos: elige desde el ${lastPaid + 1}`
          : null,
    effective: !contribution && !effective ? "Elige desde qué fecha" : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const affected = contribution
    ? own.filter((s) => s.period_number >= from && s.status !== "anulada")
    : [];

  const submit = async () => {
    // El botón siempre responde: si falta algo, se marca el campo en vez de no hacer nada
    setTouched(true);
    if (!valid || saving || rateValue === null) return;
    setSaving(true);
    const why = reason.trim() || "Cambio de tasa";
    try {
      if (contribution) {
        await investmentService.changeContributionRate(contribution.id, rateValue, from, why);
      } else {
        await investmentService.changeLineRate(summary.line_id, rateValue, effective, why);
      }
      celebrate();
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
          ? `Aporte del ${formatDay(contribution.contributed_at)} (${formatCents(contribution.amount_cents, summary.currency)}) · hoy ${formatRate(currentRate)}`
          : `Todos los aportes con tasa de ${summary.manager_display_name} · hoy ${formatRate(currentRate)}`
      }
      footer={
        <ConfirmButton className="h-11 w-full" onClick={submit} loading={saving} loadingText="Guardando…">
          {rateValue !== null && !errors.rate ? `Cambiar a ${formatRate(rateValue)}` : "Cambiar tasa"}
        </ConfirmButton>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field id="r-rate" label="Nueva tasa mensual %" error={touched ? errors.rate : null}>
            <Input
              id="r-rate"
              className="h-11 tabular-nums"
              inputMode="decimal"
              autoFocus
              value={rate}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setRate(e.target.value)}
              aria-invalid={(touched && !!errors.rate) || undefined}
            />
          </Field>
          {contribution ? (
            <Field id="r-from" label="Desde el periodo" error={errors.from} hint={`El periodo 1 vence 1 mes después del aporte`}>
              <Input id="r-from" className="h-11" inputMode="numeric" value={fromPeriod} onChange={(e) => setFromPeriod(e.target.value)} />
            </Field>
          ) : (
            <Field id="r-eff" label="Desde la fecha" hint="Aplica a los periodos que empiecen ese día o después" error={touched ? errors.effective : null}>
              <Input id="r-eff" type="date" className="h-11" value={effective} onChange={(e) => setEffective(e.target.value)} />
            </Field>
          )}
        </div>
        <Field id="r-reason" label="Motivo (opcional)">
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

  const isPayment = target?.type === "payment";
  const submit = async () => {
    if (!target || saving) return;
    setSaving(true);
    try {
      await investmentService.voidMovement(target.type, target.id, reason.trim() || "Eliminado por el usuario");
      toast({
        title: isPayment ? "Pago eliminado" : "Aporte eliminado",
        description: "Lo encontrarás en la pestaña Auditoría.",
      });
      setReason("");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast({ title: "No se pudo eliminar", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isPayment ? "Eliminar pago" : "Eliminar aporte"}
      description={target?.label}
      footer={
        <ConfirmButton variant="destructive" className="h-11 w-full" onClick={submit} loading={saving} loadingText="Eliminando…">
          Eliminar
        </ConfirmButton>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-2xl bg-secondary p-4 text-[13.5px] leading-relaxed">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <p>
            Se quitará de tus {isPayment ? "pagos" : "aportes"} y de los cálculos ({isPayment ? "las cuotas que cubría vuelven a quedar pendientes" : "sus cuotas dejan de contar"}).{" "}
            <span className="font-semibold">Queda guardado en Auditoría</span> con la fecha, el motivo y quién lo eliminó.
          </p>
        </div>
        <Field id="v-reason" label="Motivo (opcional)">
          <Textarea id="v-reason" rows={3} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Lo registré dos veces" />
        </Field>
      </div>
    </BottomSheet>
  );
};
