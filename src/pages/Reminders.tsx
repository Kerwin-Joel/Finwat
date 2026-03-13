import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Bell,
  CheckCircle2,
  Clock,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { format, isPast, isToday, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { useToast } from "../hooks/use-toast";
import useAuthStore from "../stores/authStore";
import { reminderService } from "../api/reminderService";
import type { Reminder } from "../types/reminder";
import AddReminderModal from "@/components/AddReminderModal";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const TYPE_CONFIG = {
  debt: { label: "Deuda", icon: "💸", color: "bg-red-500/10 text-red-400" },
  service: {
    label: "Servicio",
    icon: "⚡",
    color: "bg-yellow-500/10 text-yellow-400",
  },
  free: {
    label: "Recordatorio",
    icon: "📝",
    color: "bg-blue-500/10 text-blue-400",
  },
  credit_card: {
    label: "Tarjeta",
    icon: "💳",
    color: "bg-purple-500/10 text-purple-400",
  },
};

const RECURRENCE_LABEL = {
  none: "",
  daily: "Diario",
  weekly: "Semanal",
  monthly: "Mensual",
};

const getDaysLabel = (due_date: string) => {
  const d = parseISO(due_date);
  if (isToday(d)) return { label: "Hoy", color: "text-yellow-400" };
  const diff = differenceInDays(d, new Date());
  if (diff < 0)
    return { label: `Venció hace ${Math.abs(diff)}d`, color: "text-red-400" };
  if (diff === 1) return { label: "Mañana", color: "text-orange-400" };
  return { label: `En ${diff} días`, color: "text-muted-foreground" };
};

const formatCurrency = (n?: number) => (n != null ? `S/. ${n.toFixed(2)}` : "");

const Reminders = () => {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchReminders = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await reminderService.getAll(user.id);
      setReminders(data);
    } catch {
      toast({ title: "Error al cargar recordatorios", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, [user?.id]);

  const pending = useMemo(
    () => reminders.filter((r) => r.status === "pending"),
    [reminders],
  );
  const completed = useMemo(
    () => reminders.filter((r) => r.status === "completed"),
    [reminders],
  );
  const overdue = useMemo(
    () =>
      pending.filter(
        (r) => isPast(parseISO(r.due_date)) && !isToday(parseISO(r.due_date)),
      ),
    [pending],
  );

  const handleComplete = async (id: string) => {
    await reminderService.complete(id);
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "completed" } : r)),
    );
    toast({ title: "✅ Recordatorio completado" });
  };

  const handleDelete = async (id: string) => {
    await reminderService.delete(id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Recordatorio eliminado" });
  };

  const ReminderCard = ({ reminder }: { reminder: Reminder }) => {
    const typeConf = TYPE_CONFIG[reminder.type];
    const daysInfo = getDaysLabel(reminder.due_date);
    const isOverdue =
      isPast(parseISO(reminder.due_date)) &&
      !isToday(parseISO(reminder.due_date));

    return (
      <motion.div variants={fadeUp}>
        <Card
          className={`border-border/50 bg-card/60 ${isOverdue ? "border-red-500/30" : ""}`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`p-2 rounded-full text-base ${typeConf.color}`}>
                  {typeConf.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">
                      {reminder.title}
                    </p>
                    {reminder.recurrence !== "none" && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 gap-1"
                      >
                        <RefreshCw size={8} />{" "}
                        {RECURRENCE_LABEL[reminder.recurrence]}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(reminder.due_date), "d 'de' MMMM", {
                        locale: es,
                      })}
                      {reminder.due_time &&
                        ` · ${reminder.due_time.slice(0, 5)}`}
                    </span>
                    {reminder.notify_advance > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        · Aviso {reminder.notify_advance}d antes
                      </span>
                    )}
                  </div>
                  {reminder.amount && (
                    <p className="text-sm font-bold text-primary mt-1">
                      {formatCurrency(reminder.amount)}
                    </p>
                  )}
                  {reminder.notes && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {reminder.notes}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`text-[11px] font-medium ${daysInfo.color}`}>
                  {daysInfo.label}
                </span>
                {reminder.status === "pending" && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-green-500 hover:text-green-400"
                      onClick={() => handleComplete(reminder.id)}
                    >
                      <CheckCircle2 size={15} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                      onClick={() => handleDelete(reminder.id)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4 pt-2 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recordatorios</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona tus pagos y avisos
          </p>
        </div>
        <Button size="sm" className="gap-1" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Nuevo
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-3 text-center">
            <Bell size={16} className="mx-auto mb-1 text-primary" />
            <p className="text-xl font-bold">{pending.length}</p>
            <p className="text-[10px] text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-3 text-center">
            <Clock size={16} className="mx-auto mb-1 text-red-400" />
            <p className="text-xl font-bold text-red-400">{overdue.length}</p>
            <p className="text-[10px] text-muted-foreground">Vencidos</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-3 text-center">
            <CheckCircle2 size={16} className="mx-auto mb-1 text-green-500" />
            <p className="text-xl font-bold text-green-500">
              {completed.length}
            </p>
            <p className="text-[10px] text-muted-foreground">Completados</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="pending">
            Pendientes ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completados ({completed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {loading ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              Cargando...
            </p>
          ) : pending.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Bell size={40} className="mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">
                No tienes recordatorios pendientes
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAdd(true)}
              >
                <Plus size={13} className="mr-1" /> Crear recordatorio
              </Button>
            </div>
          ) : (
            <motion.div
              className="space-y-3"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            >
              {overdue.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-400 mb-2">
                    ⚠️ Vencidos
                  </p>
                  {overdue.map((r) => (
                    <ReminderCard key={r.id} reminder={r} />
                  ))}
                </div>
              )}
              {pending.filter((r) => !overdue.includes(r)).length > 0 && (
                <div>
                  {overdue.length > 0 && (
                    <p className="text-xs font-semibold text-muted-foreground mb-2 mt-4">
                      Próximos
                    </p>
                  )}
                  {pending
                    .filter((r) => !overdue.includes(r))
                    .map((r) => (
                      <ReminderCard key={r.id} reminder={r} />
                    ))}
                </div>
              )}
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completed.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2
                size={40}
                className="mx-auto text-muted-foreground/30"
              />
              <p className="text-muted-foreground text-sm mt-2">
                Nada completado aún
              </p>
            </div>
          ) : (
            <motion.div
              className="space-y-3"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            >
              {completed.map((r) => (
                <motion.div key={r.id} variants={fadeUp}>
                  <Card className="border-border/50 bg-card/40 opacity-60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2
                          size={16}
                          className="text-green-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-through truncate">
                            {r.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(r.due_date), "d 'de' MMMM", {
                              locale: es,
                            })}
                            {r.amount && ` · ${formatCurrency(r.amount)}`}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-400"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </TabsContent>
      </Tabs>

      <AddReminderModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={(r) => {
          setReminders((prev) => [...prev, r]);
          setShowAdd(false);
        }}
      />
    </div>
  );
};

export default Reminders;
