import { create } from "zustand";
import type { Account, CreateAccountRequest, UpdateAccountRequest } from "../types/account";
import { toNumber } from "../types/account";
import {
  archiveAccount,
  createAccount,
  getAccounts,
  setDefaultAccount,
  updateAccount,
} from "../api/accountService";

interface AccountState {
  accounts: Account[];
  isLoading: boolean;
  error: string | null;
  fetchAccounts: () => Promise<void>;
  /** Crea la cuenta; si makeDefault, además la vuelve principal. Lanza el error para la UI. */
  addAccount: (payload: CreateAccountRequest, makeDefault?: boolean) => Promise<Account>;
  editAccount: (id: string, patch: UpdateAccountRequest) => Promise<void>;
  archive: (id: string) => Promise<void>;
  makeDefault: (id: string) => Promise<void>;
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

  addAccount: async (payload, makeDefault) => {
    const created = await createAccount(payload);
    if (makeDefault) await setDefaultAccount(created.id);
    await get().fetchAccounts();
    return created;
  },

  editAccount: async (id, patch) => {
    await updateAccount(id, patch);
    await get().fetchAccounts();
  },

  archive: async (id) => {
    await archiveAccount(id);
    await get().fetchAccounts();
  },

  makeDefault: async (id) => {
    await setDefaultAccount(id);
    await get().fetchAccounts();
  },

  getTotalBalance: () => get().accounts.reduce((sum, acc) => sum + toNumber(acc.balance), 0),
  getTotalIncome: () => 0, // se calcula desde transactions
  getTotalExpenses: () => 0, // se calcula desde transactions
}));

export default useAccountStore;
