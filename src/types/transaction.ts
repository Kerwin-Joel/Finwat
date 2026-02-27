// export type TransactionType = 'income' | 'expense';

// export type TransactionCategory =
//     | 'SALUD'
//     | 'TRABAJO'
//     | 'NEGOCIO'
//     | 'ALIMENTACION'
//     | 'TRANSPORTE'
//     | 'ENTRETENIMIENTO'
//     | 'EDUCACION'
//     | 'VIVIENDA'
//     | 'SERVICIOS'
//     | 'OTROS';

// export interface Transaction {
//     id: string;
//     userId: string;
//     accountId: string;
//     type: TransactionType;
//     category: TransactionCategory;
//     amount: number;
//     description: string;
//     date: string;
//     createdAt: string;
// }

// export interface CreateTransactionRequest {
//     accountId: string;
//     type: TransactionType;
//     category: TransactionCategory;
//     amount: number;
//     description: string;
//     date: string;
// }

// export interface TransactionFilters {
//     category?: TransactionCategory;
//     type?: TransactionType;
//     startDate?: string;
//     endDate?: string;
//     accountId?: string;
// }

// export type SortOption = 'DATE_DESC' | 'AMOUNT_DESC' | 'AMOUNT_ASC';

export type TransactionType =
  | "income"
  | "expense"
  | "debt_given"
  | "debt_received";
export type TransactionSource =
  | "app"
  | "whatsapp"
  | "import"
  | "api"
  | "scheduled";
export type TransactionStatus = "completed" | "pending" | "cancelled";

export type TransactionCategory =
  | "SALUD"
  | "TRABAJO"
  | "NEGOCIO"
  | "ALIMENTACION"
  | "TRANSPORTE"
  | "ENTRETENIMIENTO"
  | "EDUCACION"
  | "VIVIENDA"
  | "SERVICIOS"
  | "OTROS";

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  currency: string;
  description?: string;
  tags?: string[];
  transaction_date: string;
  created_at: string;
  updated_at: string;
  source: TransactionSource;
  source_metadata?: Record<string, unknown>;
  status: TransactionStatus;
  // Deudas
  counterpart_name?: string;
  counterpart_phone?: string;
  due_date?: string;
  is_settled?: boolean;
  settled_at?: string;
  notes?: string;
  attachment_url?: string;
}

export interface CreateTransactionRequest {
  account_id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description?: string;
  transaction_date: string;
  source?: TransactionSource;
  tags?: string[];
  notes?: string;
  // Deudas
  counterpart_name?: string;
  counterpart_phone?: string;
  due_date?: string;
}

export interface TransactionFilters {
  category?: TransactionCategory;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  account_id?: string;
  status?: TransactionStatus;
}

export type SortOption = "DATE_DESC" | "AMOUNT_DESC" | "AMOUNT_ASC";
