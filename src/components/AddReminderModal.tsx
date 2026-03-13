import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useToast } from "../hooks/use-toast";
import useAuthStore from "../stores/authStore";
import { reminderService } from "../api/reminderService";
import type {
  Reminder,
  ReminderType,
  ReminderRecurrence,
} from "../types/reminder";

interface AddReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (reminder: Reminder) => void;
}

const TYPE_OPTIONS: { value: ReminderType; label: string; icon: string }[] = [
  { value: "free", label: "Recordatorio libre", icon: "📝" },
  { value: "service", label: "Servicio", icon: "⚡" },
  { value: "debt", label: "Deuda/Préstamo", icon: "💸" },
  { value: "credit_card", label: "Tarjeta de crédito", icon: "💳" },
];

const RECURRENCE_OPTIONS: { value: ReminderRecurrence; label: string }[] = [
  { value: "none", label: "No repetir" },
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
];

const ADVANCE_OPTIONS = [
  { value: 0, label: "El mismo día" },
  { value: 1, label: "1 día antes" },
  { value: 3, label: "3 días antes" },
  { value: 7, label: "1 semana antes" },
];

const AddReminderModal: React.FC<AddReminderModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [type, setType] = useState<ReminderType>("free");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [hasTime, setHasTime] = useState(false);
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>("none");
  const [notifyAdvance, setNotifyAdvance] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setType("free");
    setTitle("");
    setAmount("");
    setDueDate("");
    setDueTime("");
    setHasTime(false);
    setRecurrence("none");
    setNotifyAdvance(0);
    setNotes("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim() || !dueDate) {
      toast({ title: "Completa el título y la fecha", variant: "destructive" });
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    try {
      const reminder = await reminderService.create(user.id, {
        title: title.trim(),
        type,
        amount: amount ? parseFloat(amount) : undefined,
        due_date: dueDate,
        due_time: hasTime && dueTime ? dueTime : undefined,
        notify_advance: notifyAdvance,
        recurrence,
        notes: notes.trim() || undefined,
      });
      onCreated(reminder);
      reset();
      toast({ title: "🔔 Recordatorio creado" });
    } catch {
      toast({ title: "Error al crear recordatorio", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🔔 Nuevo Recordatorio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Tipo
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors ${
                    type === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Título *
            </Label>
            <Input
              placeholder={
                type === "service"
                  ? "Ej: Pago de luz"
                  : type === "debt"
                    ? "Ej: Cuota préstamo banco"
                    : type === "credit_card"
                      ? "Ej: Pago tarjeta Visa"
                      : "Ej: Renovar seguro"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Monto (opcional) */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Monto (opcional)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                S/.
              </span>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Fecha */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Fecha de vencimiento *
            </Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Hora */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">
                Hora específica
              </Label>
              <button
                onClick={() => setHasTime(!hasTime)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  hasTime
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground"
                }`}
              >
                {hasTime ? "Activada" : "Opcional"}
              </button>
            </div>
            {hasTime && (
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            )}
          </div>

          {/* Aviso anticipado */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Avisar por WhatsApp
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {ADVANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNotifyAdvance(opt.value)}
                  className={`p-2 rounded-lg border text-xs transition-colors ${
                    notifyAdvance === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recurrencia */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Repetición
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {RECURRENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRecurrence(opt.value)}
                  className={`p-2 rounded-lg border text-xs transition-colors ${
                    recurrence === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
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
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : "🔔 Crear Recordatorio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddReminderModal;
