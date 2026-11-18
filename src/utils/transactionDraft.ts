import type { TransactionCategory, TransactionType } from "@/types/transaction";

// Borrador de un movimiento en los formularios de Nuevo/Editar movimiento.
export interface TransactionDraft {
  type: TransactionType;
  amount: string;
  description: string;
  category: TransactionCategory;
  accountId: string;
  date: string; // yyyy-MM-dd
}

export const draftErrors = (d: TransactionDraft, touched: boolean) => {
  const n = Number(d.amount.replace(",", "."));
  return {
    amount: touched && (!d.amount || !Number.isFinite(n) || n <= 0) ? "Ingresa un monto mayor a 0" : null,
    description: touched && !d.description.trim() ? "Escribe una descripción" : null,
    accountId: touched && !d.accountId ? "Elige una cuenta" : null,
    date: touched && !d.date ? "Elige la fecha" : null,
  };
};
