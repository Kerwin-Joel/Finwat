import { motion } from "framer-motion";
import type { Transaction } from "../types/transaction";
import useCategoryStore from "../stores/categoryStore";
import { formatCurrency } from "../utils/formatCurrency";
import { formatDateShort } from "../utils/dateUtils";
import WhatsAppIcon from "@/assets/WhatsAppIcon";

interface TransactionItemProps {
  transaction: Transaction;
  index: number;
  onClick?: (transaction: Transaction) => void;
}

const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  index,
  onClick,
}) => {
  const { getCategory } = useCategoryStore();
  const categoryData = getCategory(transaction.category);
  const isIncome = transaction.type === "income";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="flex items-center justify-between py-3 border-b border-border/40 last:border-0 hover:bg-muted/30 px-2 rounded-lg transition-colors cursor-pointer"
      onClick={() => onClick?.(transaction)}
    >
      <div className="flex items-center space-x-3 overflow-hidden">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg shadow-sm overflow-hidden relative"
          style={{
            backgroundColor: `${categoryData.color}20`,
            border: `1px solid ${categoryData.color}40`,
          }}
        >
          {categoryData.type === "image" ? (
            <img
              src={categoryData.icon}
              alt={categoryData.label}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span>{categoryData.icon}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {transaction.description}
          </p>
          {/* <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <span className="font-medium" style={{ color: categoryData.color }}>
              {categoryData.label}
            </span>
            <span>•</span>
            <span>{formatDateShort(transaction.transaction_date)}</span>
          </div> */}
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            {transaction.source === "whatsapp" && (
              <>
                <WhatsAppIcon color={categoryData.color} />
              </>
            )}
            <span className="font-medium" style={{ color: categoryData.color }}>
              {categoryData.label}
            </span>
            <span>•</span>
            <span>{formatDateShort(transaction.transaction_date)}</span>
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-2">
        <p
          className={`text-sm font-bold ${isIncome ? "text-green-500" : "text-red-500"}`}
        >
          {isIncome ? "+" : "-"}
          {formatCurrency(transaction.amount)}
        </p>
      </div>
    </motion.div>
  );
};

export default TransactionItem;
