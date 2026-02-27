import { useEffect, useState, useRef } from "react";
import { Menu, LogOut, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";
import useAuthStore from "../stores/authStore";
import useAccountStore from "../stores/accountStore";
import useTransactionStore from "../stores/transactionStore";
import AccountCard from "../components/AccountCard";
import TransactionList from "../components/TransactionList";
import FABButton from "../components/FABButton";
import AddTransactionModal from "../components/AddTransactionModal";
import { SkeletonAccountCard } from "../components/SkeletonLoader";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import type { TransactionFilters, SortOption } from "../types/transaction";

const Home = () => {
  const { user, logout } = useAuthStore();
  const {
    accounts,
    fetchAccounts,
    isLoading: loadingAccounts,
  } = useAccountStore();
  //   const {
  //     transactions,
  //     fetchTransactions,
  //     isLoading: loadingTransactions,
  //     filters,
  //     setFilters,
  //     sortOption,
  //     setSortOption,
  //   } = useTransactionStore();
  const {
    transactions,
    fetchTransactions,
    isLoading: loadingTransactions,
  } = useTransactionStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  //   useEffect(() => {
  //     fetchAccounts();
  //     fetchTransactions(filters);
  //   }, [fetchAccounts, fetchTransactions, filters]);
  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
  }, []);

  // For MVP, just show the first account or a consolidated view.
  // The user requirement says "If multiple accounts exist, show the first account or a consolidated summary."
  // I'll show the first account for simplicity, or a dummy "Total" account if I had logic for it.
  // Let's pick the first account.
    const mainAccount = accounts[0];

  //   const totalIncome = transactions
  //     .filter((t) => t.type === "income")
  //     .reduce((sum, t) => sum + t.amount, 0);

  //   const totalExpenses = transactions
  //     .filter((t) => t.type === "expense")
  //     .reduce((sum, t) => sum + t.amount, 0);

  //   const totalBalance = totalIncome - totalExpenses;

  // Calcular siempre desde TODAS las transacciones
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalBalance = totalIncome - totalExpenses;

  // Filtros locales solo para la lista
  const [localFilters, setLocalFilters] = useState<TransactionFilters>({});
  const [localSortOption, setLocalSortOption] =
    useState<SortOption>("DATE_DESC");

  const filteredTransactions = transactions
    .filter((t) => {
      if (localFilters.type && t.type !== localFilters.type) return false;
      if (localFilters.category && t.category !== localFilters.category)
        return false;
      if (localFilters.startDate && t.transaction_date < localFilters.startDate)
        return false;
      if (localFilters.endDate && t.transaction_date > localFilters.endDate)
        return false;
      return true;
    })
    .sort((a, b) => {
      if (localSortOption === "AMOUNT_DESC") return b.amount - a.amount;
      if (localSortOption === "AMOUNT_ASC") return a.amount - b.amount;
      return b.transaction_date.localeCompare(a.transaction_date);
    });
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowTopShadow(scrollTop > 0);
      // Show bottom shadow if we are not at the very bottom (with a small buffer)
      setShowBottomShadow(scrollHeight - scrollTop - clientHeight > 10);
    }
  };

  // Check scroll state initially and on transactions change
  useEffect(() => {
    handleScroll();
    // Also add logic to check when window resizes if needed, but flex layout handles mostly.
    // We re-check when transactions load.
  }, [transactions]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4 relative">
      {/* Fixed Header Section */}
      <div className="shrink-0 space-y-6 pt-2 px-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10 border border-border">
              <AvatarImage src={user?.photoUrl} />
              <AvatarFallback>{user?.name?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs text-muted-foreground">Hola,</p>
              <h2 className="text-sm font-bold">{user?.name}</h2>
            </div>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Menú</SheetTitle>
              </SheetHeader>
              <div className="py-6 space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" /> Recargar Datos
                </Button>
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={logout}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Account Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          {loadingAccounts || !mainAccount ? (
            <SkeletonAccountCard />
          ) : (
            <AccountCard
              account={mainAccount}
              totalIncome={totalIncome}
              totalExpenses={totalExpenses}
              totalBalance={totalBalance}
            />
          )}
        </motion.div>
      </div>

      {/* Scrollable Recent Transactions Container Wrapper */}
      <div className="flex-1 relative min-h-0">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto -mx-4 px-4 pb-4"
        >
          <TransactionList
            transactions={filteredTransactions}
            isLoading={loadingTransactions}
            filters={localFilters}
            onFilterChange={setLocalFilters}
            sortOption={localSortOption}
            onSortChange={setLocalSortOption}
            showScrollShadow={showTopShadow}
            limit={20}
          />
        </div>

        {/* Bottom Scroll Indicator Shadow */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none transition-opacity duration-300 ${
            showBottomShadow ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      {/* Buttom to add transaction */}
      <FABButton onClick={() => setIsAddModalOpen(true)} />

      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
};

export default Home;
