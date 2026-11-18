export type CardNetwork =
  | "VISA"
  | "MASTERCARD"
  | "AMEX"
  | "DINERS"
  | "EFECTIVO"
  | "BILLETERA_DIGITAL";
export type AccountType = "cash" | "bank" | "card" | "wallet" | "other";

/** Red de la tarjeta (columna accounts.card_network) */
export type CardNetworkId = "visa" | "mastercard" | "amex" | "diners" | "otra";
/** Débito o crédito (columna accounts.card_kind) */
export type CardKind = "debito" | "credito";
/** Diseño de la tarjeta (columna accounts.card_style) */
export type CardStyle = "aurora" | "medianoche" | "oceano" | "esmeralda" | "atardecer" | "oro";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  /** numeric en Postgres: puede llegar como string */
  balance: number | string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Personalización (migración 016; null en cuentas antiguas)
  card_network?: CardNetworkId | null;
  card_kind?: CardKind | null;
  last4?: string | null;
  bank_name?: string | null;
  card_style?: CardStyle | null;
  credit_limit?: number | string | null;
  sort_order?: number | null;
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
  card_network?: CardNetworkId | null;
  card_kind?: CardKind | null;
  last4?: string | null;
  bank_name?: string | null;
  card_style?: CardStyle;
  credit_limit?: number | null;
}

export type UpdateAccountRequest = Partial<
  Pick<Account, "name" | "type" | "currency" | "card_network" | "card_kind" | "last4" | "bank_name" | "card_style" | "credit_limit">
>;

export const CARD_STYLES: { value: CardStyle; label: string }[] = [
  { value: "aurora", label: "Aurora" },
  { value: "medianoche", label: "Medianoche" },
  { value: "oceano", label: "Océano" },
  { value: "esmeralda", label: "Esmeralda" },
  { value: "atardecer", label: "Atardecer" },
  { value: "oro", label: "Oro" },
];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  card: "Tarjeta",
  bank: "Cuenta bancaria",
  cash: "Efectivo",
  wallet: "Billetera digital",
  other: "Cuenta",
};

export const toNumber = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};
