export type LoanType = "personal" | "bank" | "credit_card";
export type LoanDirection = "given" | "received";
export type LoanStatus = "active" | "paid" | "overdue" | "refinanced";
export type InterestPeriod =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "bimonthly"
  | "quarterly"
  | "semiannual"
  | "annual";
export type InterestType = "simple" | "compound";
export type InstallmentStatus = "pending" | "paid" | "overdue";

export interface Loan {
  id: string;
  user_id: string;
  type: LoanType;
  direction: LoanDirection;
  entity_name: string;
  principal: number;
  balance_remaining: number;
  interest_rate: number;
  interest_period: InterestPeriod;
  interest_type: InterestType;
  start_date: string;
  due_date?: string;
  installments_total: number;
  installments_paid: number;
  installment_amount?: number;
  status: LoanStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  bank_details?: LoanBankDetails;
  installments?: LoanInstallment[];
}

export interface LoanBankDetails {
  id: string;
  loan_id: string;
  bank_name?: string;
  contract_number?: string;
  tea?: number;
  tem?: number;
  tcea?: number;
  insurance?: number;
  disbursement_date?: string;
}

export interface LoanInstallment {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  principal_amount: number;
  interest_amount: number;
  insurance_amount: number;
  status: InstallmentStatus;
  paid_at?: string;
}

export interface LoanPayment {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  notes?: string;
  created_at: string;
}

export interface LoanHistory {
  id: string;
  loan_id: string;
  field_changed: string;
  old_value?: string;
  new_value?: string;
  changed_at: string;
}

export interface CreateLoanDTO {
  type: LoanType;
  direction: LoanDirection;
  entity_name: string;
  principal: number;
  interest_rate?: number;
  interest_period?: InterestPeriod;
  interest_type?: InterestType;
  start_date: string;
  due_date?: string;
  installments_total?: number;
  installment_amount?: number;
  notes?: string;
  bank_details?: Omit<LoanBankDetails, "id" | "loan_id">;
}

export const INTEREST_PERIOD_LABEL: Record<InterestPeriod, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export const LOAN_TYPE_CONFIG: Record<
  LoanType,
  { label: string; icon: string; color: string }
> = {
  personal: { label: "Personal", icon: "🤝", color: "#3b82f6" },
  bank: { label: "Bancario", icon: "🏦", color: "#8b5cf6" },
  credit_card: { label: "Tarjeta Crédito", icon: "💳", color: "#ec4899" },
};

export const LOAN_STATUS_CONFIG: Record<
  LoanStatus,
  { label: string; color: string }
> = {
  active: { label: "Activo", color: "text-blue-400" },
  paid: { label: "Pagado", color: "text-green-500" },
  overdue: { label: "Vencido", color: "text-red-400" },
  refinanced: { label: "Refinanciado", color: "text-yellow-400" },
};
