import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import useTransactionStore from "../stores/transactionStore";
// import useAccountStore from '../stores/accountStore';
import TransactionList from "../components/TransactionList";
import EditTransactionModal from "../components/EditTransactionModal";
import { Input } from "../components/ui/input";
import { formatCurrency } from "../utils/formatCurrency";
import type { TransactionFilters, Transaction } from "../types/transaction";
import useAccountStore from "../stores/accountStore";

const Transactions = () => {
  const {
    transactions,
    fetchTransactions,
    isLoading,
    filters,
    setFilters,
    setSortOption,
  } = useTransactionStore();
  // const { getTotalIncome, getTotalExpenses } = useAccountStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { fetchAccounts } = useAccountStore();

  useEffect(() => {
    fetchAccounts();
    fetchTransactions(filters);
  }, [fetchTransactions, filters]);

  const filteredTransactions = transactions.filter((t) =>
    (t.description ?? "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // const totalIncome = getTotalIncome();
  // const totalExpenses = getTotalExpenses();
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const handleFilterChange = (newFilters: TransactionFilters) => {
    setFilters(newFilters);
  };

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedTransaction(null);
  };

  return (
    <div className="space-y-6 pt-2 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Movimientos</h1>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col">
          <span className="text-xs text-muted-foreground">
            Ingresos Totales
          </span>
          <span className="text-lg font-bold text-green-500">
            {formatCurrency(totalIncome)}
          </span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col">
          <span className="text-xs text-muted-foreground">Gastos Totales</span>
          <span className="text-lg font-bold text-red-500">
            {formatCurrency(totalExpenses)}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar movimiento..."
          className="pl-9 bg-card"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* List */}
      <TransactionList
        transactions={filteredTransactions}
        isLoading={isLoading}
        filters={filters}
        onFilterChange={handleFilterChange}
        sortOption={useTransactionStore((state) => state.sortOption)}
        onSortChange={setSortOption}
        enableAdvancedFilters={true}
        onTransactionClick={handleTransactionClick}
      />

      {/* Edit Modal */}
      <EditTransactionModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        transaction={selectedTransaction}
      />
    </div>
  );
};

export default Transactions;
