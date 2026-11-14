import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { investmentService } from "@/api/investmentService";
import useInvestmentStore from "@/stores/investmentStore";
import { parseAmountToCents, parsePercentToRate } from "@/utils/money";
import type { InvestmentCurrency, ReturnMode } from "@/types/investment";
import BottomSheet from "./BottomSheet";
import { AmountInput, Chips, Field } from "./fields";

const NewLineSheet = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fetchOverview = useInvestmentStore((s) => s.fetchOverview);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState<InvestmentCurrency>("PEN");
  const [committed, setCommitted] = useState("");
  const [rate, setRate] = useState("10");
  const [mode, setMode] = useState<ReturnMode>("periodo_completo");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const committedCents = committed.trim() ? parseAmountToCents(committed) : 0;
  const rateValue = parsePercentToRate(rate);
  const phoneDigits = phone.replace(/\D/g, "");
  const errors = {
    name: !name.trim() ? "Escribe el nombre del gestor" : null,
    committed: committedCents === null ? "Monto no válido" : null,
    rate: rateValue === null ? "Escribe una tasa entre 0 y 100" : null,
    phone: phoneDigits && (phoneDigits.length < 9 || phoneDigits.length > 15) ? "Celular no válido" : null,
  };
  const valid = !Object.values(errors).some(Boolean);

  const reset = () => {
    setName("");
    setPhone("");
    setCurrency("PEN");
    setCommitted("");
    setRate("10");
    setMode("periodo_completo");
    setNotes("");
    setTouched(false);
  };

  const submit = async () => {
    setTouched(true);
    if (!valid || saving) return;
    setSaving(true);
    try {
      const lineId = await investmentService.createLine({
        manager_display_name: name.trim(),
        manager_phone: phoneDigits || null,
        currency,
        committed_amount_cents: committedCents ?? 0,
        default_monthly_rate: rateValue ?? 0.1,
        interest_on_return_mode: mode,
        notes: notes.trim() || null,
      });
      toast({ title: `Línea con ${name.trim()} creada` });
      reset();
      onOpenChange(false);
      fetchOverview();
      navigate(`/investments/${lineId}`);
    } catch (err) {
      toast({ title: "No se pudo crear la línea", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo gestor"
      description="Una línea por cada persona que administra tu dinero."
      footer={
        <Button className="h-11 w-full" onClick={submit} disabled={saving}>
          {saving ? "Creando…" : "Crear línea"}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field id="nl-name" label="Nombre del gestor" error={touched ? errors.name : null}>
          <Input
            id="nl-name"
            className="h-11"
            placeholder="Ej. Tío Juan"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={(touched && !!errors.name) || undefined}
          />
        </Field>
        <Field
          id="nl-phone"
          label="Celular (opcional)"
          hint="Para invitarlo más adelante a conciliar"
          error={touched ? errors.phone : null}
        >
          <Input
            id="nl-phone"
            className="h-11"
            inputMode="tel"
            placeholder="9XX XXX XXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field id="nl-currency" label="Moneda">
          <Chips
            label="Moneda"
            value={currency}
            onChange={setCurrency}
            options={[
              { value: "PEN", label: "Soles (S/)" },
              { value: "USD", label: "Dólares (US$)" },
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="nl-committed" label="Cupo / meta" error={touched ? errors.committed : null} hint="Lo que planeas entregarle">
            <AmountInput id="nl-committed" value={committed} onChange={setCommitted} currency={currency} />
          </Field>
          <Field id="nl-rate" label="Tasa mensual" error={touched ? errors.rate : null} hint="Lo que te paga">
            <div className="relative">
              <Input
                id="nl-rate"
                className="h-11 pr-8 tabular-nums"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          </Field>
        </div>
        <Field
          id="nl-mode"
          label="Si te devuelve capital a mitad de mes"
          hint={
            mode === "periodo_completo"
              ? "El interés baja desde el mes siguiente."
              : "Ese mes se cobra proporcional a los días con cada capital."
          }
        >
          <Chips
            label="Interés al devolver capital"
            value={mode}
            onChange={setMode}
            options={[
              { value: "periodo_completo", label: "Mes completo" },
              { value: "prorrateo_diario", label: "Prorrateo diario" },
            ]}
          />
        </Field>
        <Field id="nl-notes" label="Notas (opcional)">
          <Textarea id="nl-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </BottomSheet>
  );
};

export default NewLineSheet;
