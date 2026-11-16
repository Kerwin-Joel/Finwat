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
import type { Account, CreateAccountRequest, UpdateAccountRequest } from "../types/account";

/** Mensaje claro si la migración 016 aún no está aplicada */
const accountError = (error: { message?: string; code?: string }) => {
  if (/card_network|card_style|card_kind|last4|bank_name|credit_limit|set_default_account/.test(error.message ?? "")) {
    return new Error("Falta activar las tarjetas personalizables en la base de datos (migración 016).");
  }
  return new Error(error.message || "No se pudo guardar la cuenta");
};

export const getAccounts = async (): Promise<Account[]> => {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Account[];
};

export const updateAccount = async (id: string, patch: UpdateAccountRequest): Promise<Account> => {
  const { data, error } = await supabase.from("accounts").update(patch).eq("id", id).select().single();
  if (error) throw accountError(error);
  return data as Account;
};

/** Nada se borra: la cuenta se archiva y deja de mostrarse (sus movimientos se conservan) */
export const archiveAccount = async (id: string): Promise<void> => {
  const { error } = await supabase.from("accounts").update({ is_active: false }).eq("id", id);
  if (error) throw accountError(error);
};

/** Cambia la cuenta principal (donde el bot de WhatsApp registra) en una sola operación */
export const setDefaultAccount = async (id: string): Promise<void> => {
  const { error } = await supabase.rpc("set_default_account", { p_account_id: id });
  if (error) throw accountError(error);
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

  const card = {
    card_network: payload.card_network ?? null,
    card_kind: payload.card_kind ?? null,
    last4: payload.last4 ?? null,
    bank_name: payload.bank_name ?? null,
    credit_limit: payload.credit_limit ?? null,
    ...(payload.card_style ? { card_style: payload.card_style } : {}),
  };
  const hasCardFields = Object.values(card).some((v) => v !== null && v !== undefined);

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name: payload.name,
      type: payload.type ?? "cash",
      currency: payload.currency ?? "PEN",
      balance: payload.initialBalance ?? 0,
      is_default: false,
      ...(hasCardFields ? card : {}),
    })
    .select()
    .single();

  if (error) throw accountError(error);
  return data as Account;
};
