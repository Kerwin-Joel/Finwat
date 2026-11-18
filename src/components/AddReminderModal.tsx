import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Clock } from "lucide-react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { useToast } from "../hooks/use-toast";
import useAuthStore from "../stores/authStore";
import { reminderService } from "../api/reminderService";
import type { Reminder, ReminderType, ReminderRecurrence } from "../types/reminder";
import BottomSheet from "@/components/investments/BottomSheet";
import { AmountInput, Chips, Field } from "@/components/investments/fields";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { celebrate } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import { reminderLocal } from "@/utils/reminderTime";

// Crear o editar un recordatorio, con el mismo estilo que los formularios de Inversiones.
// La hora es opcional (interruptor). Se guarda en UTC como lo espera el bot de WhatsApp;
// al editar se convierte de vuelta a la hora local.

interface AddReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (reminder: Reminder) => void;
  /** Si viene, el modal edita este recordatorio */
  reminder?: Reminder | null;
  onUpdated?: (reminder: Reminder) => void;
}

const TYPE_OPTIONS: { value: ReminderType; label: string }[] = [
  { value: "free", label: "📝 Libre" },
  { value: "service", label: "⚡ Servicio" },
  { value: "debt", label: "💸 Deuda" },
  { value: "credit_card", label: "💳 Tarjeta" },
];

const RECURRENCE_OPTIONS: { value: ReminderRecurrence; label: string }[] = [
  { value: "none", label: "No repetir" },
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
];

type Advance = "0" | "1" | "3" | "7";
const ADVANCE_OPTIONS: { value: Advance; label: string }[] = [
  { value: "0", label: "El mismo día" },
  { value: "1", label: "1 día antes" },
  { value: "3", label: "3 días antes" },
  { value: "7", label: "1 semana antes" },
];

/** Fecha/hora locales → lo que guarda la base (UTC si hay hora) */
const toStored = (date: string, time: string | null) => {
  if (!time) return { due_date: date, due_time: null as string | null };
  const iso = new Date(`${date}T${time}:00`).toISOString();
  return { due_date: iso.slice(0, 10), due_time: iso.slice(11, 19) };
};

const AddReminderModal: React.FC<AddReminderModalProps> = ({ isOpen, onClose, onCreated, reminder, onUpdated }) => {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const editing = !!reminder;

  const [type, setType] = useState<ReminderType>("free");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [hasTime, setHasTime] = useState(false);
  const [dueTime, setDueTime] = useState("09:00");
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>("none");
  const [notifyAdvance, setNotifyAdvance] = useState<Advance>("0");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cargar el recordatorio a editar (o limpiar para uno nuevo) cada vez que se abre
  useEffect(() => {
    if (!isOpen) return;
    if (reminder) {
      const local = reminderLocal(reminder);
      setType(reminder.type);
      setTitle(reminder.title);
      setAmount(reminder.amount != null ? String(reminder.amount) : "");
      setDueDate(local.date);
      setHasTime(!!local.time);
      setDueTime(local.time || "09:00");
      setRecurrence(reminder.recurrence);
      const adv = String(reminder.notify_advance);
      setNotifyAdvance((["0", "1", "3", "7"].includes(adv) ? adv : "0") as Advance);
      setNotes(reminder.notes ?? "");
    } else {
      setType("free");
      setTitle("");
      setAmount("");
      setDueDate("");
      setHasTime(false);
      setDueTime("09:00");
      setRecurrence("none");
      setNotifyAdvance("0");
      setNotes("");
    }
    setTouched(false);
  }, [isOpen, reminder]);

  const amountNumber = amount.trim() ? Number(amount.replace(",", ".")) : null;
  const errors = {
    title: touched && !title.trim() ? "Escribe un título" : null,
    date: touched && !dueDate ? "Elige la fecha" : null,
    amount: amountNumber !== null && (!Number.isFinite(amountNumber) || amountNumber < 0) ? "Monto no válido" : null,
    time: touched && hasTime && !dueTime ? "Elige la hora" : null,
  };

  const submit = async () => {
    setTouched(true);
    if (!title.trim() || !dueDate || errors.amount || (hasTime && !dueTime) || saving) return;
    if (!user?.id) return;
    setSaving(true);
    const stored = toStored(dueDate, hasTime ? dueTime : null);
    const dto = {
      title: title.trim(),
      type,
      amount: amountNumber ?? undefined,
      due_date: stored.due_date,
      due_time: stored.due_time ?? undefined,
      notify_advance: Number(notifyAdvance),
      recurrence,
      notes: notes.trim() || undefined,
    };
    try {
      if (editing && reminder) {
        // Si cambió fecha, hora o aviso, el bot debe volver a avisar
        const scheduleChanged =
          stored.due_date !== reminder.due_date ||
          (stored.due_time ?? null) !== (reminder.due_time ?? null) ||
          Number(notifyAdvance) !== reminder.notify_advance;
        await reminderService.update(reminder.id, {
          ...dto,
          amount: amountNumber,
          due_time: stored.due_time,
          notes: notes.trim() || null,
          ...(scheduleChanged ? { last_notified_at: null } : {}),
        });
        await celebrate();
        onUpdated?.({ ...reminder, ...dto });
        toast({ title: "Recordatorio actualizado" });
      } else {
        const created = await reminderService.create(user.id, dto);
        await celebrate();
        onCreated?.(created);
        toast({ title: "🔔 Recordatorio creado" });
      }
      onClose();
    } catch {
      toast({ title: editing ? "No se actualizó el recordatorio" : "No se creó el recordatorio", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={isOpen}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Editar recordatorio" : "Nuevo recordatorio"}
      description={editing ? undefined : "Te avisamos por WhatsApp antes de la fecha."}
      footer={
        <ConfirmButton className="h-11 w-full" onClick={submit} loading={saving} loadingText="Guardando…">
          {editing ? "Guardar cambios" : "Crear recordatorio"}
        </ConfirmButton>
      }
    >
      <div className="space-y-4">
        <Field id="rem-type" label="Tipo">
          <Chips label="Tipo de recordatorio" value={type} onChange={setType} options={TYPE_OPTIONS} />
        </Field>

        <Field id="rem-title" label="Título" error={errors.title}>
          <Input
            id="rem-title"
            className="h-11"
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
        </Field>

        <Field id="rem-amount" label="Monto (opcional)" error={errors.amount}>
          <AmountInput id="rem-amount" value={amount} onChange={setAmount} invalid={!!errors.amount} />
        </Field>

        <Field id="rem-date" label="Fecha" error={errors.date}>
          <Input id="rem-date" type="date" className="h-11" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>

        {/* Hora opcional: interruptor claro y el campo aparece con suavidad */}
        <div className="rounded-2xl border border-border/70 bg-card">
          <button
            type="button"
            role="switch"
            aria-checked={hasTime}
            onClick={() => setHasTime((v) => !v)}
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block text-sm font-medium">Agregar hora</span>
                <span className="block text-[11.5px] text-muted-foreground">
                  {hasTime ? "Te avisamos a esa hora" : "Opcional · sin hora te avisamos en la mañana"}
                </span>
              </span>
            </span>
            <span
              aria-hidden="true"
              className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200", hasTime ? "bg-brand" : "bg-muted-foreground/30")}
            >
              <motion.span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft"
                initial={false}
                animate={{ left: hasTime ? 18 : 2 }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }}
              />
            </span>
          </button>
          <AnimatePresence initial={false}>
            {hasTime && (
              <motion.div
                initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4">
                  <Field id="rem-time" label="Hora" error={errors.time}>
                    <Input id="rem-time" type="time" className="h-11" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
                  </Field>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Field id="rem-advance" label="Avisar por WhatsApp">
          <Chips label="Aviso anticipado" value={notifyAdvance} onChange={setNotifyAdvance} options={ADVANCE_OPTIONS} />
        </Field>

        <Field id="rem-recurrence" label="Repetición">
          <Chips label="Repetición" value={recurrence} onChange={setRecurrence} options={RECURRENCE_OPTIONS} />
        </Field>

        <Field id="rem-notes" label="Notas (opcional)">
          <Textarea id="rem-notes" rows={2} className="resize-none" placeholder="Detalles adicionales…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </BottomSheet>
  );
};

export default AddReminderModal;
