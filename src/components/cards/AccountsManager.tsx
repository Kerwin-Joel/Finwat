import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, CreditCard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import useAccountStore from "@/stores/accountStore";
import { formatCurrency } from "@/utils/formatCurrency";
import { cn } from "@/lib/utils";
import { riseItem, staggerContainer } from "@/lib/motion";
import type { Account } from "@/types/account";
import { toNumber } from "@/types/account";
import AccountSheet from "./AccountSheet";
import NetworkMark from "./NetworkMark";
import { CARD_STYLE_CLASS, accountSubtitle, isCredit } from "./cardStyle";

// Perfil → "Cuentas y tarjetas": lista, crear, editar, principal y archivar.
const AccountsManager = () => {
  const { accounts, fetchAccounts, isLoading } = useAccountStore();
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return (
    <section aria-labelledby="accounts-title" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 id="accounts-title" className="text-[17px] font-semibold tracking-[-0.02em]">
            Cuentas y tarjetas
          </h3>
          <p className="text-[12.5px] text-muted-foreground">Aparecen en tu inicio; desliza para verlas.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Agregar
        </Button>
      </div>

      {isLoading && accounts.length === 0 ? (
        <div className="surface h-[76px] shimmer" aria-busy="true" />
      ) : accounts.length === 0 ? (
        <button type="button" onClick={() => setCreating(true)} className="surface flex w-full items-center gap-3 p-4 text-left">
          <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Agrega tu primera tarjeta o cuenta
        </button>
      ) : (
        <motion.ul className="surface divide-y divide-border/60 overflow-hidden" variants={staggerContainer} initial="hidden" animate="show">
          {accounts.map((a) => {
            const balance = toNumber(a.balance);
            const credit = isCredit(a);
            return (
              <motion.li key={a.id} variants={riseItem}>
                <button
                  type="button"
                  onClick={() => setEditing(a)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      CARD_STYLE_CLASS[a.card_style ?? "aurora"],
                      "flex h-10 w-[60px] shrink-0 items-end justify-end overflow-hidden rounded-lg p-1.5 shadow-soft [&_*]:scale-[0.7] [&_*]:origin-bottom-right",
                    )}
                    aria-hidden="true"
                  >
                    <NetworkMark network={a.card_network} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold">{a.name}</span>
                      {a.is_default && (
                        <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[10.5px] font-semibold text-brand">Principal</span>
                      )}
                    </span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {accountSubtitle(a)}
                      {a.bank_name ? ` · ${a.bank_name}` : ""}
                      {a.last4 ? ` · •••• ${a.last4}` : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className={cn("num block text-[14px] font-semibold", credit && balance < 0 && "text-foreground")}>
                      {credit ? formatCurrency(Math.max(-balance, 0), a.currency) : formatCurrency(balance, a.currency)}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{credit ? "Deuda" : "Saldo"}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </motion.li>
            );
          })}
        </motion.ul>
      )}

      {creating && <AccountSheet key="new" open onOpenChange={(o) => !o && setCreating(false)} account={null} />}
      {editing && <AccountSheet key={editing.id} open onOpenChange={(o) => !o && setEditing(null)} account={editing} />}
    </section>
  );
};

export default AccountsManager;
