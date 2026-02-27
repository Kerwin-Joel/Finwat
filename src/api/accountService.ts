// import type { Account, CreateAccountRequest } from '../types/account';
// // import axiosInstance from './axiosInstance';

// const MOCK_ACCOUNTS: Account[] = [
//     { id: 'acc-1', userId: '1', name: 'Cuenta Principal', cardNetwork: 'VISA', balance: 290000, totalIncome: 270000, totalExpenses: 530, lastFourDigits: '4521', createdAt: new Date().toISOString() },
//     { id: 'acc-2', userId: '1', name: 'Débito BCP', cardNetwork: 'MASTERCARD', balance: 15000, totalIncome: 50000, totalExpenses: 35000, lastFourDigits: '8834', createdAt: new Date().toISOString() },
// ];

// export const getAccounts = async (): Promise<Account[]> => {
//     // MOCK - reemplazar con: const { data } = await axiosInstance.get('/accounts'); return data.data;
//     await new Promise(resolve => setTimeout(resolve, 500));
//     return MOCK_ACCOUNTS;
// };

// export const getAccountById = async (id: string): Promise<Account | undefined> => {
//     // MOCK
//     return MOCK_ACCOUNTS.find((acc) => acc.id === id);
// };

// export const createAccount = async (payload: CreateAccountRequest): Promise<Account> => {
//     // MOCK - reemplazar con: const { data } = await axiosInstance.post('/accounts', payload); return data.data;
//     await new Promise(resolve => setTimeout(resolve, 1000));
//     return {
//         id: `acc-${Date.now()}`,
//         userId: '1',
//         name: payload.name,
//         cardNetwork: payload.cardNetwork,
//         balance: payload.initialBalance || 0,
//         totalIncome: 0,
//         totalExpenses: 0,
//         lastFourDigits: payload.lastFourDigits,
//         createdAt: new Date().toISOString(),
//     };
// };
import { supabase } from "../lib/supabase";
import type { Account, CreateAccountRequest } from "../types/account";

export const getAccounts = async (): Promise<Account[]> => {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("is_default", { ascending: false });

  if (error) throw error;
  return data as Account[];
};

export const getAccountById = async (
  id: string,
): Promise<Account | undefined> => {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Account;
};

export const createAccount = async (
  payload: CreateAccountRequest,
): Promise<Account> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name: payload.name,
      type: payload.type ?? "cash",
      currency: payload.currency ?? "USD",
      balance: payload.initialBalance ?? 0,
      is_default: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Account;
};
