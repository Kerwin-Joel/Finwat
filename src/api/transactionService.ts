// import type { Transaction, CreateTransactionRequest, TransactionFilters } from '../types/transaction';
// // import axiosInstance from './axiosInstance';

// const MOCK_TRANSACTIONS: Transaction[] = [
//     { id: 't-1', userId: '1', accountId: 'acc-1', type: 'expense', category: 'SALUD', amount: 20.00, description: 'Pastilla vitamina C', date: '2026-01-30', createdAt: new Date().toISOString() },
//     { id: 't-2', userId: '1', accountId: 'acc-1', type: 'income', category: 'TRABAJO', amount: 4500.00, description: 'Sueldo mensual empresa', date: '2026-01-28', createdAt: new Date().toISOString() },
//     { id: 't-3', userId: '1', accountId: 'acc-1', type: 'income', category: 'NEGOCIO', amount: 500.00, description: 'Ventas producto online', date: '2026-01-27', createdAt: new Date().toISOString() },
//     { id: 't-4', userId: '1', accountId: 'acc-1', type: 'expense', category: 'ALIMENTACION', amount: 85.50, description: 'Supermercado Wong', date: '2026-01-26', createdAt: new Date().toISOString() },
//     { id: 't-5', userId: '1', accountId: 'acc-2', type: 'expense', category: 'TRANSPORTE', amount: 45.00, description: 'Uber semanal', date: '2026-01-25', createdAt: new Date().toISOString() },
//     { id: 't-6', userId: '1', accountId: 'acc-2', type: 'income', category: 'NEGOCIO', amount: 1200.00, description: 'Freelance diseño web', date: '2026-01-24', createdAt: new Date().toISOString() },
// ];

// export const getTransactions = async (filters?: TransactionFilters): Promise<Transaction[]> => {
//     // MOCK - reemplazar con: const { data } = await axiosInstance.get('/transactions', { params: filters }); return data.data;
//     await new Promise(resolve => setTimeout(resolve, 800));
//     let result = MOCK_TRANSACTIONS;
//     if (filters?.category) result = result.filter((t) => t.category === filters.category);
//     if (filters?.type) result = result.filter((t) => t.type === filters.type);
//     if (filters?.accountId) result = result.filter((t) => t.accountId === filters.accountId);
//     if (filters?.startDate) {
//         result = result.filter((t) => {
//             if (!filters.startDate) return true;
//             return new Date(t.date) >= new Date(filters.startDate);
//         });
//     }
//     if (filters?.endDate) {
//         result = result.filter((t) => {
//             if (!filters.endDate) return true;
//             return new Date(t.date) <= new Date(filters.endDate);
//         });
//     }
//     return result;
// };

// export const createTransaction = async (payload: CreateTransactionRequest): Promise<Transaction> => {
//     // MOCK - reemplazar con: const { data } = await axiosInstance.post('/transactions', payload); return data.data;
//     await new Promise(resolve => setTimeout(resolve, 1000));
//     return {
//         id: `t-${Date.now()}`,
//         userId: '1',
//         ...payload,
//         createdAt: new Date().toISOString(),
//     };
// };

// export const updateTransaction = async (id: string, updates: Partial<CreateTransactionRequest>): Promise<Transaction> => {
//     // MOCK - replace with API call
//     await new Promise(resolve => setTimeout(resolve, 800));
//     return {
//         id,
//         userId: '1',
//         type: updates.type || 'expense',
//         amount: updates.amount || 0,
//         description: updates.description || '',
//         category: updates.category || 'OTROS',
//         accountId: updates.accountId || '',
//         date: updates.date || new Date().toISOString(),
//         createdAt: new Date().toISOString(), // In real app, this wouldn't change
//         ...updates
//     } as Transaction;
// };

// export const deleteTransaction = async (_id: string): Promise<void> => {
//     // MOCK - replace with API call
//     await new Promise(resolve => setTimeout(resolve, 800));
// };

import { supabase } from "../lib/supabase";
import type {
  Transaction,
  CreateTransactionRequest,
  TransactionFilters,
} from "../types/transaction";

export const getTransactions = async (
  filters?: TransactionFilters,
): Promise<Transaction[]> => {
  let query = supabase
    .from("transactions")
    .select("*")
    .order("transaction_date", { ascending: false });

  if (filters?.type) query = query.eq("type", filters.type);
  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.account_id) query = query.eq("account_id", filters.account_id);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.startDate)
    query = query.gte("transaction_date", filters.startDate);
  if (filters?.endDate) query = query.lte("transaction_date", filters.endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data as Transaction[];
};

export const createTransaction = async (
  payload: CreateTransactionRequest,
): Promise<Transaction> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.log(user);
    throw new Error("No autenticado");
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      ...payload,
      user_id: user.id,
      source: payload.source ?? "app",
      status: "completed",
    })
    .select()
    .single();
  console.log("data");
  console.log(data);
  console.log("data");
  console.log("error");
  console.log(error);
  console.log("error");

  if (error) throw error;
  return data as Transaction;
};

export const updateTransaction = async (
  id: string,
  updates: Partial<CreateTransactionRequest>,
): Promise<Transaction> => {
  const { data, error } = await supabase
    .from("transactions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Transaction;
};

export const deleteTransaction = async (id: string): Promise<void> => {
  const { error } = await supabase.from("transactions").delete().eq("id", id);

  if (error) throw error;
};

export const settleDebt = async (id: string): Promise<Transaction> => {
  const { data, error } = await supabase
    .from("transactions")
    .update({ is_settled: true, settled_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Transaction;
};
