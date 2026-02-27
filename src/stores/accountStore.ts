import { create } from "zustand";
import type { Account, CreateAccountRequest } from "../types/account";
import { getAccounts, createAccount } from "../api/accountService";

interface AccountState {
  accounts: Account[];
  isLoading: boolean;
  error: string | null;
  fetchAccounts: () => Promise<void>;
  addAccount: (payload: CreateAccountRequest) => Promise<void>;
  getTotalBalance: () => number;
  getTotalIncome: () => number;
  getTotalExpenses: () => number;
}

const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  isLoading: false,
  error: null,

  fetchAccounts: async () => {
    set({ isLoading: true, error: null });
    try {
      const accounts = await getAccounts();
      set({ accounts, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Error al cargar cuentas",
        isLoading: false,
      });
    }
  },

  addAccount: async (payload) => {
    set({ isLoading: true });
    try {
      const newAccount = await createAccount(payload);
      set((state) => ({
        accounts: [...state.accounts, newAccount],
        isLoading: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Error al crear cuenta",
        isLoading: false,
      });
    }
  },

  getTotalBalance: () =>
    get().accounts.reduce((sum, acc) => sum + acc.balance, 0),
  getTotalIncome: () => 0, // se calculará desde transactions
  getTotalExpenses: () => 0, // se calculará desde transactions
}));

export default useAccountStore;
