import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useToast } from "../hooks/use-toast";
import useTransactionStore from "../stores/transactionStore";
import useAccountStore from "../stores/accountStore";
import useCategoryStore from "../stores/categoryStore";
import type {
  TransactionCategory,
  TransactionType,
} from "../types/transaction";

// shadcn utils alias workaround if not using `@/lib/utils`
// Ensure this path matches where shadcn utils are. Usually `src/lib/utils.ts` or `src/utils/utils.ts`?
// The user asked for `src/utils` structure. Shadcn default is `src/lib/utils`.
// I'll assume I need to create `src/lib/utils.ts` OR import from where standard shadcn put it.
// Checking file listing earlier: shadcn usually creates `lib/utils` or `utils/cn`.
// I will assume `lib/utils` exists if standard init ran, OR I should create it to be safe.
// Wait, I ran `add button` etc. `add` commands create `lib/utils.ts` if it doesn't exist?
// My `components.json` pointed utils to `@/utils`. So it should be in `src/utils`.
// But I haven't seen `src/utils/cn.ts` or `utils.ts` created yet.
// I should verify where `clsx` helper is.
// I will check `src/utils` content in next step or just implement a local `cn` here if needed, but better to use the one from shadcn.
// For now, I'll import from `../lib/utils` (default) or `../utils/utils` (if I configured it).
// My components.json said `"utils": "@/utils"`. So shadcn *should* have created `src/utils/cn.ts` or similar when I installed `button`.
// I will check `src/utils` in a moment. For now I'll import from `../lib/utils` as a fallback or `../utils`.

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { addTransaction } = useTransactionStore();
  const { accounts } = useAccountStore();
  const { categories } = useCategoryStore();
  const { toast } = useToast();

  // const [type, setType] = useState<TransactionType>('expense');
  // const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TransactionCategory>("OTROS");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [date, setDate] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !accountId) return;

    setIsSubmitting(true);
    try {
      await addTransaction({
        type,
        amount: parseFloat(amount),
        description,
        category,
        account_id: accountId,
        transaction_date: format(date, "yyyy-MM-dd"),
      });
      toast({
        title: "Movimiento registrado",
        // description: `${type === "income" ? "Ingreso" : "Gasto"} de S/. ${amount} guardado.`,
        description: `${type === "income" ? "Ingreso" : "Gasto"} de S/. ${amount} guardado.`,
      });
      onClose();
      // Reset form
      setAmount("");
      setDescription("");
    } catch (error) {
      console.log(error);
      toast({
        title: "Error",
        description: "No se pudo guardar el movimiento.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nuevo Movimiento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              type="button"
              //   variant={type === "expense" ? "default" : "outline"}
              //   className={cn(
              //     type === "expense" && "bg-red-600 hover:bg-red-700",
              //   )}
              //   onClick={() => setType("expense")}
              variant={type === "expense" ? "default" : "outline"}
              className={cn(
                type === "expense" && "bg-red-600 hover:bg-red-700",
              )}
              onClick={() => setType("expense")}
            >
              Egreso
            </Button>
            <Button
              type="button"
              //   variant={type === "income" ? "default" : "outline"}
              //   className={cn(
              //     type === "income" && "bg-green-600 hover:bg-green-700",
              //   )}
              //   onClick={() => setType("income")}
              variant={type === "income" ? "default" : "outline"}
              className={cn(
                type === "income" && "bg-green-600 hover:bg-green-700",
              )}
              onClick={() => setType("income")}
            >
              Ingreso
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Monto</Label>
            <Input
              id="amount"
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
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
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
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
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
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar y Confirmar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTransactionModal;
