import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useToast } from "../hooks/use-toast";
import useAuthStore from "../stores/authStore";
import { loanService } from "../api/loanService";
import type {
  Loan,
  LoanType,
  LoanDirection,
  InterestPeriod,
  InterestType,
} from "../types/loan";

interface AddLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (loan: Loan) => void;
}

const LOAN_TYPES: { value: LoanType; label: string; icon: string }[] = [
  { value: "personal", label: "Personal", icon: "🤝" },
  { value: "bank", label: "Bancario", icon: "🏦" },
  { value: "credit_card", label: "Tarjeta Crédito", icon: "💳" },
];

const INTEREST_PERIODS: { value: InterestPeriod; label: string }[] = [
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
  { value: "bimonthly", label: "Bimestral" },
  { value: "quarterly", label: "Trimestral" },
  { value: "semiannual", label: "Semestral" },
  { value: "annual", label: "Anual" },
];

const AddLoanModal: React.FC<AddLoanModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { user } = useAuthStore();
  const { toast } = useToast();

  // Paso actual (1: tipo/dirección, 2: datos básicos, 3: interés, 4: banco si aplica)
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Paso 1
  const [type, setType] = useState<LoanType>("personal");
  const [direction, setDirection] = useState<LoanDirection>("given");

  // Paso 2
  const [entityName, setEntityName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [dueDate, setDueDate] = useState("");
  const [installmentsTotal, setInstallmentsTotal] = useState("1");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [notes, setNotes] = useState("");

  // Paso 3
  const [interestRate, setInterestRate] = useState("");
  const [interestPeriod, setInterestPeriod] =
    useState<InterestPeriod>("monthly");
  const [interestType, setInterestType] = useState<InterestType>("simple");

  // Paso 4 - Bancario
  const [bankName, setBankName] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [tea, setTea] = useState("");
  const [tem, setTem] = useState("");
  const [tcea, setTcea] = useState("");
  const [insurance, setInsurance] = useState("");
  const [disbursementDate, setDisbursementDate] = useState("");

  const totalSteps = type === "bank" ? 4 : 3;

  const reset = () => {
    setStep(1);
    setType("personal");
    setDirection("given");
    setEntityName("");
    setPrincipal("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setInstallmentsTotal("1");
    setInstallmentAmount("");
    setNotes("");
    setInterestRate("");
    setInterestPeriod("monthly");
    setInterestType("simple");
    setBankName("");
    setContractNumber("");
    setTea("");
    setTem("");
    setTcea("");
    setInsurance("");
    setDisbursementDate("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleNext = () => {
    if (step === 2 && !entityName.trim()) {
      toast({ title: "Ingresa el nombre", variant: "destructive" });
      return;
    }
    if (step === 2 && !principal) {
      toast({ title: "Ingresa el monto", variant: "destructive" });
      return;
    }
    setStep((prev) => prev + 1);
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const loan = await loanService.create(user.id, {
        type,
        direction,
        entity_name: entityName.trim(),
        principal: parseFloat(principal),
        interest_rate: interestRate ? parseFloat(interestRate) : 0,
        interest_period: interestPeriod,
        interest_type: interestType,
        start_date: startDate,
        due_date: dueDate || undefined,
        installments_total: parseInt(installmentsTotal) || 1,
        installment_amount: installmentAmount
          ? parseFloat(installmentAmount)
          : undefined,
        notes: notes.trim() || undefined,
        bank_details:
          type === "bank"
            ? {
                bank_name: bankName || undefined,
                contract_number: contractNumber || undefined,
                tea: tea ? parseFloat(tea) : undefined,
                tem: tem ? parseFloat(tem) : undefined,
                tcea: tcea ? parseFloat(tcea) : undefined,
                insurance: insurance ? parseFloat(insurance) : undefined,
                disbursement_date: disbursementDate || undefined,
              }
            : undefined,
      });
      onCreated(loan);
      reset();
      toast({ title: "💰 Préstamo registrado" });
    } catch {
      toast({ title: "Error al registrar préstamo", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>💰 Nuevo Préstamo</DialogTitle>
          <div className="flex gap-1 mt-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${i + 1 <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* PASO 1 — Tipo y dirección */}
          {step === 1 && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Tipo de préstamo
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {LOAN_TYPES.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setType(opt.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-colors ${
                        type === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Dirección
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDirection("given")}
                    className={`p-3 rounded-lg border text-sm transition-colors ${
                      direction === "given"
                        ? "border-green-500 bg-green-500/10 text-green-500"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    ↑ Yo presté
                  </button>
                  <button
                    onClick={() => setDirection("received")}
                    className={`p-3 rounded-lg border text-sm transition-colors ${
                      direction === "received"
                        ? "border-red-400 bg-red-400/10 text-red-400"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    ↓ Me prestaron
                  </button>
                </div>
              </div>
            </>
          )}

          {/* PASO 2 — Datos básicos */}
          {step === 2 && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  {direction === "given"
                    ? "Nombre del deudor *"
                    : "Nombre del acreedor *"}
                </Label>
                <Input
                  placeholder={
                    direction === "given" ? "Ej: Juan Pérez" : "Ej: Banco BCP"
                  }
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Monto *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    S/.
                  </span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Fecha inicio *
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Fecha vencimiento
                  </Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    N° cuotas
                  </Label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={installmentsTotal}
                    onChange={(e) => setInstallmentsTotal(e.target.value)}
                    min="1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Monto por cuota
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      S/.
                    </span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={installmentAmount}
                      onChange={(e) => setInstallmentAmount(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Notas (opcional)
                </Label>
                <Textarea
                  placeholder="Detalles adicionales..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </>
          )}

          {/* PASO 3 — Interés */}
          {step === 3 && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Tasa de interés (%)
                </Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Deja en 0 si no aplica interés
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Período de interés
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {INTEREST_PERIODS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setInterestPeriod(opt.value)}
                      className={`p-2 rounded-lg border text-xs transition-colors ${
                        interestPeriod === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Tipo de interés
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setInterestType("simple")}
                    className={`p-2.5 rounded-lg border text-xs transition-colors ${
                      interestType === "simple"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    Simple
                  </button>
                  <button
                    onClick={() => setInterestType("compound")}
                    className={`p-2.5 rounded-lg border text-xs transition-colors ${
                      interestType === "compound"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    Compuesto
                  </button>
                </div>
              </div>

              {/* Resumen */}
              {principal && (
                <div className="p-3 bg-muted/30 rounded-lg space-y-1">
                  <p className="text-xs font-semibold">Resumen</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Monto principal
                    </span>
                    <span>S/. {parseFloat(principal).toFixed(2)}</span>
                  </div>
                  {interestRate && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Interés por período
                      </span>
                      <span>
                        S/.{" "}
                        {(
                          (parseFloat(principal) * parseFloat(interestRate)) /
                          100
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {installmentsTotal && installmentAmount && (
                    <div className="flex justify-between text-xs font-semibold border-t border-border pt-1 mt-1">
                      <span>Total a pagar</span>
                      <span>
                        S/.{" "}
                        {(
                          parseInt(installmentsTotal) *
                          parseFloat(installmentAmount)
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* PASO 4 — Datos bancarios */}
          {step === 4 && type === "bank" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Banco
                  </Label>
                  <Input
                    placeholder="Ej: BCP, BBVA..."
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    N° Contrato
                  </Label>
                  <Input
                    placeholder="Opcional"
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    TEA (%)
                  </Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={tea}
                    onChange={(e) => setTea(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    TEM (%)
                  </Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={tem}
                    onChange={(e) => setTem(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    TCEA (%)
                  </Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={tcea}
                    onChange={(e) => setTcea(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Seguro desgravamen
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      S/.
                    </span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={insurance}
                      onChange={(e) => setInsurance(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Fecha desembolso
                  </Label>
                  <Input
                    type="date"
                    value={disbursementDate}
                    onChange={(e) => setDisbursementDate(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Botones navegación */}
        <div className="flex gap-2 pt-2">
          {step > 1 && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setStep((prev) => prev - 1)}
            >
              Atrás
            </Button>
          )}
          {step < totalSteps ? (
            <Button className="flex-1" onClick={handleNext}>
              Siguiente
            </Button>
          ) : (
            <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : "💰 Registrar Préstamo"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddLoanModal;
