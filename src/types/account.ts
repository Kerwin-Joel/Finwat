// export type CardNetwork = 'VISA' | 'MASTERCARD' | 'AMEX' | 'DINERS' | 'EFECTIVO' | 'BILLETERA_DIGITAL';

// export interface Account {
//     id: string;
//     userId: string;
//     name: string;
//     cardNetwork: CardNetwork;
//     balance: number;
//     totalIncome: number;
//     totalExpenses: number;
//     lastFourDigits?: string;
//     createdAt: string;
// }

// export interface CreateAccountRequest {
//     name: string;
//     cardNetwork: CardNetwork;
//     lastFourDigits?: string;
//     initialBalance?: number;
// }
export type CardNetwork =
  | "VISA"
  | "MASTERCARD"
  | "AMEX"
  | "DINERS"
  | "EFECTIVO"
  | "BILLETERA_DIGITAL";
export type AccountType = "cash" | "bank" | "card" | "wallet" | "other";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  balance: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Campos extra para compatibilidad con UI
  cardNetwork?: CardNetwork;
  totalIncome?: number;
  totalExpenses?: number;
  lastFourDigits?: string;
}

export interface CreateAccountRequest {
  name: string;
  type?: AccountType;
  currency?: string;
  cardNetwork?: CardNetwork;
  lastFourDigits?: string;
  initialBalance?: number;
}