// import { motion } from "framer-motion";
// import {
//   Eye,
//   EyeOff,
//   TrendingUp,
//   TrendingDown,
//   CreditCard,
// } from "lucide-react";
// import type { Account } from "../types/account";
// import { formatCurrency } from "../utils/formatCurrency";
// import { useState } from "react";

// interface AccountCardProps {
//   account: Account;
// }

// const AccountCard: React.FC<AccountCardProps> = ({ account }) => {
//   const [showBalance, setShowBalance] = useState(true);

//   return (
//     <motion.div
//       initial={{ scale: 0.95, opacity: 0 }}
//       animate={{ scale: 1, opacity: 1 }}
//       transition={{ duration: 0.3 }}
//       className="relative w-full h-auto min-h-[200px] rounded-2xl bg-gradient-to-br from-card to-background border border-border p-6 shadow-lg overflow-hidden"
//     >
//       <div className="absolute top-0 right-0 p-6 opacity-5">
//         <CreditCard size={120} />
//       </div>

//       <div className="relative z-10 flex flex-col h-full justify-between space-y-6">
//         <div className="flex justify-between items-start">
//           <div>
//             <p className="text-sm text-muted-foreground font-medium mb-1">
//               {account.name}
//             </p>
//             <div className="flex items-center space-x-2">
//               <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
//                 {/* {account.cardNetwork} */}
//                 {account.cardNetwork ?? account.type}
//               </span>
//               {account.lastFourDigits && (
//                 <span className="text-xs text-muted-foreground">
//                   •••• {account.lastFourDigits}
//                 </span>
//               )}
//             </div>
//           </div>
//           <button
//             onClick={() => setShowBalance(!showBalance)}
//             className="p-2 hover:bg-muted rounded-full transition-colors"
//           >
//             {showBalance ? (
//               <Eye size={20} className="text-muted-foreground" />
//             ) : (
//               <EyeOff size={20} className="text-muted-foreground" />
//             )}
//           </button>
//         </div>

//         <div>
//           <p className="text-sm text-muted-foreground mb-1">Balance total</p>
//           <h2 className="text-3xl font-bold tracking-tight text-foreground">
//             {showBalance ? formatCurrency(account.balance) : "S/. ••••••"}
//           </h2>
//         </div>

//         <div className="flex justify-between items-center pt-4 border-t border-border/50">
//           <div className="flex items-center space-x-2">
//             <div className="p-1.5 bg-green-500/10 rounded-full">
//               <TrendingUp size={16} className="text-green-500" />
//             </div>
//             <div>
//               <p className="text-[10px] text-muted-foreground">Ingresos</p>
//               <p className="text-sm font-semibold text-green-500">
//                 {/* {showBalance ? `+${formatCurrency(account.totalIncome)}` : '••••'} */}
//                 {showBalance
//                   ? `+${formatCurrency(account.totalIncome ?? 0)}`
//                   : "••••"}
//               </p>
//             </div>
//           </div>
//           <div className="flex items-center space-x-2">
//             <div className="p-1.5 bg-red-500/10 rounded-full">
//               <TrendingDown size={16} className="text-red-500" />
//             </div>
//             <div>
//               <p className="text-[10px] text-muted-foreground">Gastos</p>
//               <p className="text-sm font-semibold text-red-500">
//                 {/* {showBalance
//                   ? `-${formatCurrency(account.totalExpenses)}`
//                   : "••••"} */}
//                 {showBalance
//                   ? `-${formatCurrency(account.totalExpenses ?? 0)}`
//                   : "••••"}
//               </p>
//             </div>
//           </div>
//         </div>
//       </div>
//     </motion.div>
//   );
// };

// export default AccountCard;

import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  CreditCard,
  Banknote,
} from "lucide-react";
import type { Account } from "../types/account";
import { formatCurrency } from "../utils/formatCurrency";
import { useState } from "react";

interface AccountCardProps {
  account: Account;
  totalIncome?: number;
  totalExpenses?: number;
  totalBalance?: number;
}

const accountTypeConfig = {
  cash: { label: "Efectivo", icon: Banknote, color: "#22c55e" },
  bank: { label: "Banco", icon: Building2, color: "#3b82f6" },
  card: { label: "Tarjeta", icon: CreditCard, color: "#8b5cf6" },
  wallet: { label: "Billetera", icon: Wallet, color: "#f59e0b" },
  other: { label: "Otro", icon: Wallet, color: "#6b7280" },
};

const AccountCard: React.FC<AccountCardProps> = ({
  account,
  totalIncome = 0,
  totalExpenses = 0,
  totalBalance = 0,
}) => {
  const [showBalance, setShowBalance] = useState(true);
  const typeConfig = accountTypeConfig[account.type] || accountTypeConfig.other;
  const TypeIcon = typeConfig.icon;

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative w-full h-auto min-h-[200px] rounded-2xl bg-gradient-to-br from-card to-background border border-border p-6 shadow-lg overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-6 opacity-5">
        <CreditCard size={120} />
      </div>

      <div className="relative z-10 flex flex-col h-full justify-between space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-2">
              {account.name}
            </p>
            {/* Badge mejorado */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full w-fit"
              style={{
                backgroundColor: `${typeConfig.color}20`,
                border: `1px solid ${typeConfig.color}40`,
              }}
            >
              <TypeIcon size={12} style={{ color: typeConfig.color }} />
              <span
                className="text-xs font-semibold"
                style={{ color: typeConfig.color }}
              >
                {typeConfig.label}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            {showBalance ? (
              <Eye size={20} className="text-muted-foreground" />
            ) : (
              <EyeOff size={20} className="text-muted-foreground" />
            )}
          </button>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">Balance total</p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {showBalance ? formatCurrency(totalBalance) : "S/. ••••••"}
          </h2>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-border/50">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-green-500/10 rounded-full">
              <TrendingUp size={16} className="text-green-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Ingresos</p>
              <p className="text-sm font-semibold text-green-500">
                {showBalance ? `+${formatCurrency(totalIncome)}` : "••••"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-red-500/10 rounded-full">
              <TrendingDown size={16} className="text-red-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Gastos</p>
              <p className="text-sm font-semibold text-red-500">
                {showBalance ? `-${formatCurrency(totalExpenses)}` : "••••"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AccountCard;
