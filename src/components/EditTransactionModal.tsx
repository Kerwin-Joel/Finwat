import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import TypeToggle from "@/components/transactions/TypeToggle";
import { formatCurrency } from "@/utils/formatCurrency";
import { format } from "date-fns";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { DatePicker } from "./ui/calendar";
import { useToast } from "../hooks/use-toast";
import useTransactionStore from "../stores/transactionStore";
import useAccountStore from "../stores/accountStore";
import type {
  Transaction,
  TransactionCategory,
  TransactionType,
} from "../types/transaction";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import useCategoryStore from "../stores/categoryStore";
import { parseDate } from "@/utils/dateUtils";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { celebrate } from "@/lib/celebrate";

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
}) => {
  const { updateTransaction, deleteTransaction } = useTransactionStore();
  const { accounts } = useAccountStore();
  const { toast } = useToast();

  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TransactionCategory>("OTROS");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { categories } = useCategoryStore();

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(transaction.amount.toString());
      setDescription(transaction.description ?? "");
      setCategory(transaction.category);
      setAccountId(transaction.account_id); // ✅
      setDate(parseDate(transaction.transaction_date)); // ✅
    }
  }, [transaction]);

  const dirty =
    !!transaction &&
    (type !== transaction.type ||
      parseFloat(amount || "0") !== Number(transaction.amount) ||
      description !== (transaction.description ?? "") ||
      category !== transaction.category ||
      accountId !== transaction.account_id ||
      format(date, "yyyy-MM-dd") !== transaction.transaction_date);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction || !amount || !description || !accountId) return;

    setIsSubmitting(true);
    try {
      await updateTransaction(transaction.id, {
        type,
        amount: parseFloat(amount),
        description,
        category,
        account_id: accountId,
        transaction_date: format(date, "yyyy-MM-dd"),
      });
      await celebrate();
      toast({
        title: "Movimiento actualizado",
        description: "Los cambios se han guardado correctamente.",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error: " + error,
        description: "No se pudo actualizar el movimiento.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;
    setIsDeleting(true);
    try {
      await deleteTransaction(transaction.id);
      toast({
        title: "Movimiento eliminado",
        description: "El registro ha sido eliminado permanentemente.",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error: " + error,
        description: "No se pudo eliminar el movimiento.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar movimiento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <TypeToggle id="edit-type" value={type} onChange={setType} />

          <div className="space-y-2">
            <Label htmlFor="edit-amount">Monto</Label>
            <Input
              id="edit-amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg font-bold"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Descripción</Label>
            <Input
              id="edit-description"
              placeholder="¿Qué compraste?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={category}
                onValueChange={(val) => setCategory(val as TransactionCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categories).map(
                    ([key, { label, icon, type }]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center">
                          {type === "image" ? (
                            <img
                              src={icon}
                              alt=""
                              className="w-5 h-5 mr-2 rounded-full object-cover"
                            />
                          ) : (
                            <span className="mr-2">{icon}</span>
                          )}
                          {label}
                        </div>
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cuenta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                      {acc.last4 ? ` •••• ${acc.last4}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* <div className="space-y-2">
            <Label>Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? (
                    format(date, "PPP", { locale: es })
                  ) : (
                    <span>Seleccionar fecha</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div> */}

          {/* -------- */}
          <div className="space-y-2">
            <Label>Fecha</Label>
            <DatePicker date={date} onDateChange={setDate} />
          </div>
          <div className="flex flex-col gap-1.5 pt-3">
            <ConfirmButton
              type="submit"
              size="lg"
              className="w-full"
              disabled={!dirty}
              loading={isSubmitting}
              loadingText="Guardando…"
            >
              {dirty ? "Guardar cambios" : "Sin cambios"}
            </ConfirmButton>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isDeleting || isSubmitting}
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar movimiento
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[360px] rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar este movimiento?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminará «{description || "sin descripción"}» por{" "}
                    {formatCurrency(parseFloat(amount || "0"))}. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:gap-2">
                  <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
                  <ConfirmButton
                    variant="destructive"
                    onClick={handleDelete}
                    loading={isDeleting}
                    loadingText="Eliminando…"
                  >
                    Eliminar
                  </ConfirmButton>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditTransactionModal;
