import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Banknote, Eye, EyeOff, Landmark, Wallet } from "lucide-react";
import type { Account } from "../types/account";
import { toNumber } from "../types/account";
import { formatCurrency } from "../utils/formatCurrency";
import { Amount } from "./ui/amount";
import FinwatLogo from "@/assets/FinwatLogo";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import NetworkMark from "./cards/NetworkMark";
import { CARD_STYLE_CLASS, accountSubtitle, isCredit } from "./cards/cardStyle";

interface AccountCardProps {
  account: Account;
  totalIncome?: number;
  totalExpenses?: number;
  totalBalance?: number;
  /** Vista previa (editor): sin animación de entrada ni botón de ocultar */
  preview?: boolean;
  className?: string;
}

// Tarjeta personalizable: diseño (card_style), red (Visa/Mastercard/Amex/Diners) y tipo.
// Débito/efectivo/billetera: saldo + ingresos/gastos. Crédito: deuda + disponible/consumos.
const AccountCard: React.FC<AccountCardProps> = ({
  account,
  totalIncome = 0,
  totalExpenses = 0,
  totalBalance = 0,
  preview,
  className,
}) => {
  const [showBalance, setShowBalance] = useState(true);
  const reduce = useReducedMotion();
  const credit = isCredit(account);
  const limit = toNumber(account.credit_limit);
  const debt = Math.max(-totalBalance, 0);
  const available = limit > 0 ? limit - debt : null;
  const styleClass = CARD_STYLE_CLASS[account.card_style ?? "aurora"] ?? "hero-aurora";
  const TypeIcon = account.type === "cash" ? Banknote : account.type === "wallet" ? Wallet : account.type === "bank" ? Landmark : null;
  const visible = preview || showBalance;

  return (
    <motion.section
      initial={reduce || preview ? false : { opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE_OUT }}
      aria-label={`${account.name}, ${accountSubtitle(account)}`}
      className={cn(styleClass, "overflow-hidden rounded-[28px] p-5 shadow-float transition-[background] duration-500 md:p-7", className)}
    >
      {/* Marca de agua del logo */}
      <div className="pointer-events-none absolute -right-12 -top-12 opacity-[0.07]" aria-hidden="true">
        <div className="brightness-0 invert">
          <FinwatLogo size={190} />
        </div>
      </div>

      <div className="relative flex items-center justify-between gap-3">
        <span className="glass-on-hero inline-flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium text-white/90">
          {account.is_default && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" aria-label="Cuenta principal" />}
          <span className="truncate">
            {account.name || "Nueva cuenta"} · {accountSubtitle(account)}
          </span>
        </span>
        {!preview && (
          <button
            type="button"
            onClick={() => setShowBalance(!showBalance)}
            aria-label={showBalance ? "Ocultar montos" : "Mostrar montos"}
            aria-pressed={!showBalance}
            className="glass-on-hero flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition-transform duration-200 ease-out-expo active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        )}
      </div>

      <div className="relative mt-7">
        <p className="text-[13px] text-white/65">{credit ? "Deuda actual" : account.is_default ? "Balance total" : "Saldo"}</p>
        <Amount
          value={credit ? debt : totalBalance}
          currency={account.currency ?? "PEN"}
          hidden={!visible}
          className="mt-1 text-[44px] font-light leading-none tracking-[-0.045em] text-white md:text-[54px]"
        />
      </div>

      <div className="relative mt-7 grid grid-cols-2 gap-2.5">
        <div className="glass-on-hero rounded-2xl px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[11px] text-white/70">
            <ArrowDownLeft size={13} className="text-emerald-300" aria-hidden="true" />
            {credit ? (available !== null ? "Disponible" : "Pagos") : "Ingresos"}
          </div>
          <p className="num mt-1 text-[15px] font-medium text-white">
            {!visible ? "••••" : credit && available !== null ? formatCurrency(available) : `+${formatCurrency(totalIncome)}`}
          </p>
        </div>
        <div className="glass-on-hero rounded-2xl px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[11px] text-white/70">
            <ArrowUpRight size={13} className="text-rose-300" aria-hidden="true" /> {credit ? "Consumos" : "Gastos"}
          </div>
          <p className="num mt-1 text-[15px] font-medium text-white">{visible ? `−${formatCurrency(totalExpenses)}` : "••••"}</p>
        </div>
      </div>

      {/* Pie: banco, últimos dígitos y red */}
      {(account.bank_name || account.last4 || account.card_network || TypeIcon) && (
        <div className="relative mt-5 flex items-center justify-between gap-3 text-[12.5px] text-white/75">
          <span className="flex min-w-0 items-center gap-2">
            {TypeIcon && <TypeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span className="truncate">{account.bank_name}</span>
            {account.last4 && <span className="num shrink-0 tracking-[0.12em] text-white/90">•••• {account.last4}</span>}
          </span>
          <NetworkMark network={account.card_network} />
        </div>
      )}
    </motion.section>
  );
};

export default AccountCard;
