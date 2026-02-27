import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import useAccountStore from "../stores/accountStore";
import AccountCard from "../components/AccountCard";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useToast } from "../hooks/use-toast";
import { SkeletonAccountCard } from "../components/SkeletonLoader";
import useTransactionStore from "../stores/transactionStore";
import type { CardNetwork } from "../types/account";

const Accounts = () => {
  const { accounts, fetchAccounts, addAccount, isLoading } = useAccountStore();
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [network, setNetwork] = useState<CardNetwork>("VISA");
  const [digits, setDigits] = useState("");
  const [balance, setBalance] = useState("");
  const { transactions, fetchTransactions } = useTransactionStore();

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
  }, [fetchAccounts, fetchTransactions]);

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalBalance = totalIncome - totalExpenses;

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addAccount({
        name,
        cardNetwork: network,
        lastFourDigits: digits,
        initialBalance: parseFloat(balance || "0"),
      });
      setIsModalOpen(false);
      setName("");
      setDigits("");
      setBalance("");
      toast({ title: "Cuenta agregada exitosamente" });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear la cuenta",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 pt-2 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis Cuentas</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 rounded-full">
              <Plus size={16} /> Nueva
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Nueva Cuenta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddAccount} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nombre de la cuenta</Label>
                <Input
                  placeholder="Ej. BCP Ahorros"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Red / Tipo</Label>
                  <Select
                    value={network}
                    onValueChange={(val) => setNetwork(val as CardNetwork)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VISA">Visa</SelectItem>
                      <SelectItem value="MASTERCARD">Mastercard</SelectItem>
                      <SelectItem value="AMEX">Amex</SelectItem>
                      <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                      <SelectItem value="BILLETERA_DIGITAL">
                        Billetera Digital
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Últimos 4 dígitos</Label>
                  <Input
                    placeholder="1234"
                    maxLength={4}
                    value={digits}
                    onChange={(e) => setDigits(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Saldo Inicial</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full">
                Guardar Cuenta
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {isLoading
          ? Array.from({ length: 2 }).map((_, i) => (
              <SkeletonAccountCard key={i} />
            ))
          : accounts.map((acc) => (
              <AccountCard
                key={acc.id}
                account={acc}
                totalIncome={totalIncome}
                totalExpenses={totalExpenses}
                totalBalance={totalBalance}
              />
            ))}
      </div>
    </div>
  );
};

export default Accounts;
