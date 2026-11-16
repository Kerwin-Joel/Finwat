import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff } from "lucide-react";
import type { Account } from "../types/account";
import { formatCurrency } from "../utils/formatCurrency";
import { Amount } from "./ui/amount";
import FinwatLogo from "@/assets/FinwatLogo";
import { EASE_OUT } from "@/lib/motion";

interface AccountCardProps {
  account: Account;
  totalIncome?: number;
  totalExpenses?: number;
  totalBalance?: number;
}

const accountTypeLabel: Record<string, string> = {
  cash: "Efectivo",
  bank: "Banco",
  card: "Tarjeta",
  wallet: "Billetera",
  other: "Cuenta",
};

// Tarjeta de balance "aurora": marino → azul eléctrico → celeste, con grano fino.
const AccountCard: React.FC<AccountCardProps> = ({
  account,
  totalIncome = 0,
  totalExpenses = 0,
  totalBalance = 0,
}) => {
  const [showBalance, setShowBalance] = useState(true);
  const reduce = useReducedMotion();

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE_OUT }}
      aria-label="Balance de tu cuenta"
      className="hero-aurora overflow-hidden rounded-[28px] p-5 shadow-float md:p-7"
    >
      {/* Marca de agua del logo */}
      <div className="pointer-events-none absolute -right-12 -top-12 opacity-[0.07]" aria-hidden="true">
        <div className="brightness-0 invert">
          <FinwatLogo size={190} />
        </div>
      </div>

      <div className="relative flex items-center justify-between">
        <span className="glass-on-hero inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium text-white/90">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
          {account.name} · {accountTypeLabel[account.type] ?? "Cuenta"}
        </span>
        <button
          type="button"
          onClick={() => setShowBalance(!showBalance)}
          aria-label={showBalance ? "Ocultar montos" : "Mostrar montos"}
          aria-pressed={!showBalance}
          className="glass-on-hero flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-transform duration-200 ease-out-expo active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>

      <div className="relative mt-7">
        <p className="text-[13px] text-white/65">Balance total</p>
        <Amount
          value={totalBalance}
          currency={account.currency ?? "PEN"}
          hidden={!showBalance}
          className="mt-1 text-[44px] font-light leading-none tracking-[-0.045em] text-white md:text-[54px]"
        />
      </div>

      <div className="relative mt-7 grid grid-cols-2 gap-2.5">
        <div className="glass-on-hero rounded-2xl px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[11px] text-white/70">
            <ArrowDownLeft size={13} className="text-emerald-300" aria-hidden="true" /> Ingresos
          </div>
          <p className="num mt-1 text-[15px] font-medium text-white">
            {showBalance ? `+${formatCurrency(totalIncome)}` : "••••"}
          </p>
        </div>
        <div className="glass-on-hero rounded-2xl px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[11px] text-white/70">
            <ArrowUpRight size={13} className="text-rose-300" aria-hidden="true" /> Gastos
          </div>
          <p className="num mt-1 text-[15px] font-medium text-white">
            {showBalance ? `−${formatCurrency(totalExpenses)}` : "••••"}
          </p>
        </div>
      </div>
    </motion.section>
  );
};

export default AccountCard;
