import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Transaction } from "../types/transaction";
import useCategoryStore from "../stores/categoryStore";
import { formatCurrency } from "../utils/formatCurrency";
import { formatDate } from "../utils/dateUtils";
import WhatsAppIcon from "@/assets/WhatsAppIcon";
import { EASE_OUT } from "@/lib/motion";

interface TransactionItemProps {
  transaction: Transaction;
  index: number;
  onClick?: (transaction: Transaction) => void;
}

// layout: al reordenar, cada fila se desliza a su nueva posición (FLIP) en vez de saltar.
const TransactionItem = forwardRef<HTMLButtonElement, TransactionItemProps>(({
  transaction,
  index,
  onClick,
}, ref) => {
  const { getCategory } = useCategoryStore();
  const reduce = useReducedMotion();
  const categoryData = getCategory(transaction.category);
  const isIncome = transaction.type === "income";

  return (
    <motion.button
      ref={ref}
      type="button"
      layout={reduce ? false : "position"}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, transition: { duration: 0.2, ease: EASE_OUT } }}
      transition={{
        delay: Math.min(index, 10) * 0.035,
        duration: 0.45,
        ease: EASE_OUT,
        layout: { type: "spring", stiffness: 260, damping: 32, mass: 0.9, delay: 0 },
      }}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-3 text-left transition-colors duration-200 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-accent"
      onClick={() => onClick?.(transaction)}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg"
          style={{ backgroundColor: `${categoryData.color}18` }}
        >
          {categoryData.type === "image" ? (
            <img
              src={categoryData.icon}
              alt={categoryData.label}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span aria-hidden="true">{categoryData.icon}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium tracking-[-0.01em] text-foreground">
            {transaction.description}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            {transaction.source === "whatsapp" && <WhatsAppIcon color={categoryData.color} />}
            <span>{categoryData.label}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDate(transaction.transaction_date + "T12:00:00")}</span>
          </div>
        </div>
      </div>
      <p
        className={`num shrink-0 text-[14px] font-semibold ${isIncome ? "text-positive" : "text-foreground"}`}
      >
        {isIncome ? "+" : "−"}
        {formatCurrency(transaction.amount)}
      </p>
    </motion.button>
  );
});
TransactionItem.displayName = "TransactionItem";

export default TransactionItem;
