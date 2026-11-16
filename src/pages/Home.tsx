import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  DollarSign,
  FileText,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  RefreshCcw,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import useAuthStore from "../stores/authStore";
import useAccountStore from "../stores/accountStore";
import useTransactionStore from "../stores/transactionStore";
import AccountCard from "../components/AccountCard";
import TransactionList from "../components/TransactionList";
import AddTransactionModal from "../components/AddTransactionModal";
import { SkeletonAccountCard } from "../components/SkeletonLoader";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import type { TransactionFilters, SortOption, Transaction } from "../types/transaction";
import OnboardingModal from "@/components/OnboardingModal";
import EditTransactionModal from "@/components/EditTransactionModal";
import WhatsAppIcon from "@/assets/WhatsAppIcon";
import { riseItem, staggerContainer } from "@/lib/motion";

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_BOT_NUMBER;

const greeting = () => {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Lima" }).format(new Date()),
  );
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
};

/** Mosaico de acceso rápido: ícono en cuadrado oscuro + etiqueta en mayúsculas */
const QuickAction = ({
  icon: Icon,
  label,
  onClick,
  href,
  custom,
}: {
  icon?: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
  custom?: React.ReactNode;
}) => {
  const content = (
    <>
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground [&_svg]:h-4 [&_svg]:w-4">
        {custom ?? (Icon && <Icon className="h-4 w-4" strokeWidth={2.2} />)}
      </span>
      <span className="eyebrow text-foreground/80">{label}</span>
    </>
  );
  const cls =
    "surface flex aspect-[1/1.02] w-full flex-col items-start justify-between p-3 transition-transform duration-200 ease-out-expo active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <motion.div variants={riseItem}>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls} aria-label={label}>
          {content}
        </a>
      ) : (
        <button type="button" onClick={onClick} className={cls} aria-label={label}>
          {content}
        </button>
      )}
    </motion.div>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { user, logout } = useAuthStore();
  const { accounts, fetchAccounts, isLoading: loadingAccounts } = useAccountStore();
  const { transactions, fetchTransactions, isLoading: loadingTransactions } = useTransactionStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
  }, []);

  const mainAccount = accounts[0];

  // Calcular siempre desde TODAS las transacciones
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  const totalBalance = totalIncome - totalExpenses;

  // Filtros locales solo para la lista
  const [localFilters, setLocalFilters] = useState<TransactionFilters>({});
  const [localSortOption, setLocalSortOption] = useState<SortOption>("DATE_DESC");

  const filteredTransactions = transactions
    .filter((t) => {
      if (localFilters.type && t.type !== localFilters.type) return false;
      if (localFilters.category && t.category !== localFilters.category) return false;
      if (localFilters.startDate && t.transaction_date < localFilters.startDate) return false;
      if (localFilters.endDate && t.transaction_date > localFilters.endDate) return false;
      return true;
    })
    .sort((a, b) => {
      if (localSortOption === "AMOUNT_DESC") return b.amount - a.amount;
      if (localSortOption === "AMOUNT_ASC") return a.amount - b.amount;
      return b.transaction_date.localeCompare(a.transaction_date);
    });

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsEditModalOpen(true);
  };
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedTransaction(null);
  };

  const go = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <div className="relative space-y-5 pb-6">
      {/* Encabezado */}
      <header className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 border border-border/70 shadow-soft">
            <AvatarImage src={user?.photoUrl} />
            <AvatarFallback className="bg-primary text-[15px] font-semibold text-primary-foreground">
              {user?.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-[12px] text-muted-foreground">{greeting()}</p>
            <h1 className="text-[17px] font-semibold leading-tight tracking-[-0.02em]">{firstName || "Hola"}</h1>
          </div>
        </div>
        <Button variant="outline" size="icon" className="shadow-soft" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {/* Balance */}
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

      {/* Accesos rápidos */}
      <motion.nav
        aria-label="Accesos rápidos"
        className="grid grid-cols-4 gap-2.5"
        variants={staggerContainer}
        initial={reduce ? false : "hidden"}
        animate="show"
      >
        <QuickAction icon={Plus} label="Agregar" onClick={() => setIsAddModalOpen(true)} />
        <QuickAction label="WhatsApp" href={`https://wa.me/${WHATSAPP_NUMBER}`} custom={<WhatsAppIcon color="currentColor" />} />
        <QuickAction icon={TrendingUp} label="Invertir" onClick={() => navigate("/investments")} />
        <QuickAction icon={LayoutGrid} label="Más" onClick={() => setMenuOpen(true)} />
      </motion.nav>

      {/* Movimientos */}
      <section aria-label="Movimientos recientes">
        <TransactionList
          transactions={filteredTransactions}
          isLoading={loadingTransactions}
          filters={localFilters}
          onFilterChange={setLocalFilters}
          sortOption={localSortOption}
          onSortChange={setLocalSortOption}
          onTransactionClick={handleTransactionClick}
          limit={10}
        />
        {transactions.length > 10 && (
          <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={() => navigate("/transactions")}>
            Ver todos los movimientos
          </Button>
        )}
      </section>

      <EditTransactionModal isOpen={isEditModalOpen} onClose={handleCloseEditModal} transaction={selectedTransaction} />

      {/* Menú lateral */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-left text-xl tracking-[-0.025em]">Menú</SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-1 py-6">
            <p className="eyebrow px-3 pb-2 text-muted-foreground">Secciones</p>
            {[
              { icon: Bell, label: "Recordatorios", path: "/reminders" },
              { icon: DollarSign, label: "Préstamos", path: "/loans" },
              { icon: TrendingUp, label: "Inversiones con gestores", path: "/investments" },
            ].map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => go(item.path)}
                className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
                  <item.icon className="h-4 w-4" />
                </span>
                {item.label}
              </button>
            ))}
            {[
              { icon: FileText, label: "Reportes" },
              { icon: Users, label: "Deudas compartidas" },
              { icon: Target, label: "Metas de ahorro" },
            ].map((item) => (
              <div key={item.label} className="flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] text-muted-foreground" aria-disabled="true">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-muted">
                  <item.icon className="h-4 w-4" />
                </span>
                {item.label}
                <span className="eyebrow ml-auto rounded-full bg-muted px-2 py-0.5 text-[9px]">Pronto</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-border pt-4">
            <Button variant="outline" className="w-full justify-start" onClick={() => window.location.reload()}>
              <RefreshCcw className="h-4 w-4" /> Recargar datos
            </Button>
            <Button variant="ghost" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={logout}>
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AddTransactionModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      <OnboardingModal />
    </div>
  );
};

export default Home;
