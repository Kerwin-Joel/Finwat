import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Card, CardContent } from "./ui/card";
import { Separator } from "./ui/separator";
import { Edit2, Trash2, Plus, CreditCard } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "../hooks/use-toast";
import { loanService } from "../api/loanService";
import type { Loan, LoanPayment, LoanHistory } from "../types/loan";
import {
  LOAN_TYPE_CONFIG,
  LOAN_STATUS_CONFIG,
  INTEREST_PERIOD_LABEL,
} from "../types/loan";

interface LoanDetailModalProps {
  isOpen: boolean;
  loan: Loan;
  onClose: () => void;
  onUpdated: (loan: Loan) => void;
  onDeleted: (id: string) => void;
}

const formatCurrency = (n: number) => `S/. ${Number(n).toFixed(2)}`;

const LoanDetailModal: React.FC<LoanDetailModalProps> = ({
  isOpen,
  loan,
  onClose,
  onUpdated,
  onDeleted,
}) => {
  const { toast } = useToast();

  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [history, setHistory] = useState<LoanHistory[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Edición
  const [isEditing, setIsEditing] = useState(false);
  const [editEntityName, setEditEntityName] = useState(loan.entity_name);
  const [editNotes, setEditNotes] = useState(loan.notes ?? "");
  const [editDueDate, setEditDueDate] = useState(loan.due_date ?? "");
  const [editInstallmentAmount, setEditInstallmentAmount] = useState(
    loan.installment_amount?.toString() ?? "",
  );
  const [saving, setSaving] = useState(false);

  // Nuevo pago
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const typeConf = LOAN_TYPE_CONFIG[loan.type];
  const statusConf = LOAN_STATUS_CONFIG[loan.status];

  const totalExpected =
    loan.installment_amount && loan.installments_total
      ? loan.installment_amount * loan.installments_total
      : loan.principal;

  const totalPaid = totalExpected - loan.balance_remaining;
  const progress = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;

  useEffect(() => {
    if (isOpen) loadPaymentsAndHistory();
  }, [isOpen, loan.id]);

  const loadPaymentsAndHistory = async () => {
    setLoadingPayments(true);
    try {
      const [p, h] = await Promise.all([
        loanService.getPayments(loan.id),
        loanService.getHistory(loan.id),
      ]);
      setPayments(p);
      setHistory(h);
    } catch {
      toast({ title: "Error al cargar datos", variant: "destructive" });
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await loanService.update(loan.id, {
        entity_name: editEntityName.trim(),
        notes: editNotes.trim() || undefined,
        due_date: editDueDate || undefined,
        installment_amount: editInstallmentAmount
          ? parseFloat(editInstallmentAmount)
          : undefined,
      });
      const updated = await loanService.getById(loan.id);
      onUpdated(updated);
      setIsEditing(false);
      toast({ title: "✅ Préstamo actualizado" });
    } catch {
      toast({ title: "Error al actualizar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({ title: "Ingresa un monto válido", variant: "destructive" });
      return;
    }
    setSavingPayment(true);
    try {
      await loanService.addPayment(
        loan.id,
        parseFloat(paymentAmount),
        paymentDate,
        paymentNotes.trim() || undefined,
      );
      const updated = await loanService.getById(loan.id);
      onUpdated(updated);
      await loadPaymentsAndHistory();
      setShowAddPayment(false);
      setPaymentAmount("");
      setPaymentNotes("");
      toast({ title: "✅ Pago registrado" });
    } catch {
      toast({ title: "Error al registrar pago", variant: "destructive" });
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `¿Eliminar el préstamo "${loan.entity_name}"? Esta acción no se puede deshacer.`,
      )
    )
      return;
    try {
      await loanService.delete(loan.id);
      onDeleted(loan.id);
      toast({ title: "Préstamo eliminado" });
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  const FIELD_LABELS: Record<string, string> = {
    entity_name: "Nombre",
    notes: "Notas",
    due_date: "Fecha vencimiento",
    installment_amount: "Monto cuota",
    status: "Estado",
    balance_remaining: "Saldo restante",
    installments_paid: "Cuotas pagadas",
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{typeConf.icon}</span>
            {isEditing ? "Editar Préstamo" : loan.entity_name}
          </DialogTitle>
        </DialogHeader>

        {!isEditing ? (
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{typeConf.label}</Badge>
                <Badge className={statusConf.color} variant="outline">
                  {statusConf.label}
                </Badge>
                <Badge
                  variant={
                    loan.direction === "given" ? "default" : "destructive"
                  }
                >
                  {loan.direction === "given" ? "↑ Prestado" : "↓ Recibido"}
                </Badge>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 size={13} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-red-400"
                  onClick={handleDelete}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>

            {/* Montos */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">
                    Total a pagar
                  </p>
                  <p className="text-sm font-bold">
                    {formatCurrency(totalExpected)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Pagado</p>
                  <p className="text-sm font-bold text-green-500">
                    {formatCurrency(Math.max(0, totalPaid))}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Saldo</p>
                  <p className="text-sm font-bold text-red-400">
                    {formatCurrency(loan.balance_remaining)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Progreso */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {loan.installments_paid}/{loan.installments_total} cuotas
                  pagadas
                </span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Detalles */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-muted/30 rounded-lg">
                <p className="text-muted-foreground">Inicio</p>
                <p className="font-medium">
                  {format(parseISO(loan.start_date), "d MMM yyyy", {
                    locale: es,
                  })}
                </p>
              </div>
              {loan.due_date && (
                <div className="p-2 bg-muted/30 rounded-lg">
                  <p className="text-muted-foreground">Vencimiento</p>
                  <p className="font-medium">
                    {format(parseISO(loan.due_date), "d MMM yyyy", {
                      locale: es,
                    })}
                  </p>
                </div>
              )}
              {loan.interest_rate > 0 && (
                <div className="p-2 bg-muted/30 rounded-lg">
                  <p className="text-muted-foreground">Interés</p>
                  <p className="font-medium">
                    {loan.interest_rate}%{" "}
                    {INTEREST_PERIOD_LABEL[loan.interest_period]}
                  </p>
                </div>
              )}
              {loan.installment_amount && (
                <div className="p-2 bg-muted/30 rounded-lg">
                  <p className="text-muted-foreground">Cuota</p>
                  <p className="font-medium">
                    {formatCurrency(loan.installment_amount)}
                  </p>
                </div>
              )}
            </div>

            {/* Detalles bancarios */}
            {loan.bank_details && (
              <div className="p-3 bg-muted/20 rounded-lg space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1">
                  <CreditCard size={12} /> Datos bancarios
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {loan.bank_details.bank_name && (
                    <div>
                      <p className="text-muted-foreground">Banco</p>
                      <p className="font-medium">
                        {loan.bank_details.bank_name}
                      </p>
                    </div>
                  )}
                  {loan.bank_details.tea && (
                    <div>
                      <p className="text-muted-foreground">TEA</p>
                      <p className="font-medium">{loan.bank_details.tea}%</p>
                    </div>
                  )}
                  {loan.bank_details.tem && (
                    <div>
                      <p className="text-muted-foreground">TEM</p>
                      <p className="font-medium">{loan.bank_details.tem}%</p>
                    </div>
                  )}
                  {loan.bank_details.tcea && (
                    <div>
                      <p className="text-muted-foreground">TCEA</p>
                      <p className="font-medium">{loan.bank_details.tcea}%</p>
                    </div>
                  )}
                  {loan.bank_details.insurance && (
                    <div>
                      <p className="text-muted-foreground">Seguro</p>
                      <p className="font-medium">
                        {formatCurrency(loan.bank_details.insurance)}
                      </p>
                    </div>
                  )}
                  {loan.bank_details.contract_number && (
                    <div>
                      <p className="text-muted-foreground">Contrato</p>
                      <p className="font-medium">
                        {loan.bank_details.contract_number}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {loan.notes && (
              <p className="text-xs text-muted-foreground bg-muted/20 p-2 rounded-lg">
                📝 {loan.notes}
              </p>
            )}

            <Separator />

            <Tabs defaultValue="payments">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="payments" className="text-xs">
                  Pagos
                </TabsTrigger>
                <TabsTrigger value="installments" className="text-xs">
                  Cronograma
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs">
                  Historial
                </TabsTrigger>
              </TabsList>

              {/* Pagos */}
              <TabsContent value="payments" className="mt-3 space-y-3">
                {loan.status !== "paid" && (
                  <Button
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => setShowAddPayment(!showAddPayment)}
                  >
                    <Plus size={13} /> Registrar pago
                  </Button>
                )}

                {showAddPayment && (
                  <div className="p-3 border border-border rounded-lg space-y-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        S/.
                      </span>
                      <Input
                        type="number"
                        placeholder="Monto del pago"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="pl-9"
                        autoFocus
                      />
                    </div>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                    <Input
                      placeholder="Notas (opcional)"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1"
                        onClick={() => setShowAddPayment(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleAddPayment}
                        disabled={savingPayment}
                      >
                        {savingPayment ? "Guardando..." : "Guardar"}
                      </Button>
                    </div>
                  </div>
                )}

                {loadingPayments ? (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    Cargando...
                  </p>
                ) : payments.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    Sin pagos registrados
                  </p>
                ) : (
                  <div className="space-y-2">
                    {payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 bg-muted/20 rounded-lg"
                      >
                        <div>
                          <p className="text-xs font-medium">
                            {formatCurrency(p.amount)}
                          </p>
                          {p.notes && (
                            <p className="text-[10px] text-muted-foreground">
                              {p.notes}
                            </p>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {format(parseISO(p.payment_date), "d MMM yyyy", {
                            locale: es,
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Cronograma */}
              <TabsContent value="installments" className="mt-3">
                {!loan.installments || loan.installments.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    Sin cronograma registrado
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {loan.installments
                      .sort(
                        (a, b) => a.installment_number - b.installment_number,
                      )
                      .map((inst) => (
                        <div
                          key={inst.id}
                          className={`flex items-center justify-between p-2 rounded-lg border ${
                            inst.status === "paid"
                              ? "bg-green-500/5 border-green-500/20"
                              : inst.status === "overdue"
                                ? "bg-red-500/5 border-red-500/20"
                                : "bg-muted/20 border-border/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold ${
                                inst.status === "paid"
                                  ? "bg-green-500 text-white"
                                  : inst.status === "overdue"
                                    ? "bg-red-400 text-white"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {inst.installment_number}
                            </span>
                            <div>
                              <p className="text-xs font-medium">
                                {formatCurrency(inst.amount)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {format(parseISO(inst.due_date), "d MMM yyyy", {
                                  locale: es,
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {inst.interest_amount > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                Int: {formatCurrency(inst.interest_amount)}
                              </p>
                            )}
                            {inst.insurance_amount > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                Seg: {formatCurrency(inst.insurance_amount)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>

              {/* Historial */}
              <TabsContent value="history" className="mt-3">
                {history.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    Sin cambios registrados
                  </p>
                ) : (
                  <div className="space-y-2">
                    {history.map((h) => (
                      <div key={h.id} className="p-2 bg-muted/20 rounded-lg">
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-medium">
                            {FIELD_LABELS[h.field_changed] ?? h.field_changed}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(parseISO(h.changed_at), "d MMM, HH:mm", {
                              locale: es,
                            })}
                          </p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          <span className="line-through">
                            {h.old_value || "—"}
                          </span>
                          {" → "}
                          <span className="text-foreground">
                            {h.new_value || "—"}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          /* Formulario edición */
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Nombre
              </Label>
              <Input
                value={editEntityName}
                onChange={(e) => setEditEntityName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Fecha vencimiento
              </Label>
              <Input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
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
                  value={editInstallmentAmount}
                  onChange={(e) => setEditInstallmentAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Notas
              </Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsEditing(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? "Guardando..." : "✅ Guardar cambios"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LoanDetailModal;
