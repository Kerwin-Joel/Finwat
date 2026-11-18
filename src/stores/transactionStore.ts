import { create } from "zustand";
import type {
  Transaction,
  CreateTransactionRequest,
  TransactionFilters,
  SortOption,
} from "../types/transaction";
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "../api/transactionService";

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  filters: TransactionFilters;
  sortOption: SortOption;
  /** Movimiento recién creado o editado: su fila muestra la onda una vez */
  highlightId: string | null;
  clearHighlight: () => void;
  fetchTransactions: (filters?: TransactionFilters) => Promise<void>;
  addTransaction: (payload: CreateTransactionRequest) => Promise<void>;
  updateTransaction: (
    id: string,
    updates: Partial<CreateTransactionRequest>,
  ) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  setFilters: (filters: TransactionFilters) => void;
  setSortOption: (option: SortOption) => void;
  clearFilters: () => void;
}

const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  isLoading: false,
  error: null,
  filters: {},
  sortOption: "DATE_DESC",
  highlightId: null,
  clearHighlight: () => set({ highlightId: null }),

  fetchTransactions: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const transactions = await getTransactions(filters);
      // Apply initial sort
      const sorted = sortTransactions(transactions, get().sortOption);
      set({ transactions: sorted, isLoading: false, filters: filters || {} });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Error al cargar movimientos",
        isLoading: false,
      });
    }
  },

  // Crear/editar/eliminar no ponen la lista en "cargando" (antes se reemplazaba por
  // esqueletos y saltaba) y propagan el error: el modal solo celebra si de verdad se guardó.
  addTransaction: async (payload) => {
    try {
      const newTransaction = await createTransaction(payload);
      set((state) => ({
        transactions: sortTransactions([newTransaction, ...state.transactions], state.sortOption),
        highlightId: newTransaction.id,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Error al crear movimiento" });
      throw err;
    }
  },

  updateTransaction: async (id, updates) => {
    try {
      const updatedTx = await updateTransaction(id, updates);
      set((state) => ({
        transactions: sortTransactions(
          state.transactions.map((t) => (t.id === id ? updatedTx : t)),
          state.sortOption,
        ),
        highlightId: id,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Error al actualizar movimiento" });
      throw err;
    }
  },

  deleteTransaction: async (id) => {
    try {
      await deleteTransaction(id);
      set((state) => ({ transactions: state.transactions.filter((t) => t.id !== id) }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Error al eliminar movimiento" });
      throw err;
    }
  },

  setFilters: (filters) => set({ filters }),
  setSortOption: (sortOption) => {
    set((state) => ({
      sortOption,
      transactions: sortTransactions(state.transactions, sortOption),
    }));
  },
  clearFilters: () => set({ filters: {} }),
}));

// Helper function
const sortTransactions = (
  transactions: Transaction[],
  sortOption: SortOption,
): Transaction[] => {
  return [...transactions].sort((a, b) => {
    if (sortOption === "AMOUNT_DESC") return b.amount - a.amount;
    if (sortOption === "AMOUNT_ASC") return a.amount - b.amount;
    // DATE_DESC default
    return (
      new Date(b.transaction_date).getTime() -
      new Date(a.transaction_date).getTime()
    );

    // return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
};

export default useTransactionStore;
