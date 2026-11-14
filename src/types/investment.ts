// Inversiones con gestores — tipos. Todos los montos en céntimos (bigint en la BD → number aquí).

export type InvestmentCurrency = "PEN" | "USD";
export type LineStatus = "activa" | "liquidada" | "cerrada";
export type ReturnMode = "periodo_completo" | "prorrateo_diario";
export type LineHealth = "al_dia" | "por_vencer" | "vencido";
export type LineRole = "investor" | "manager";
export type PaymentMethod = "yape" | "plin" | "transferencia" | "efectivo" | "reinversion" | "otro";
export type PaymentKind = "interes" | "capital" | "mixto";
export type ReconStatus = "pendiente_contraparte" | "confirmado" | "observado" | "anulado";
export type ScheduleStatus = "programada" | "parcial" | "pagada" | "condonada" | "anulada";
export type ScheduleDisplayStatus = ScheduleStatus | "por_vencer" | "vencida";

export interface InvestmentWarning {
  code: "cupo_excedido" | "operacion_duplicada" | "voucher_duplicado" | "saldo_a_favor" | string;
  message: string;
  delivered_after_cents?: number;
  committed_cents?: number;
  excess_cents?: number;
}

export interface LineSummary {
  line_id: string;
  manager_display_name: string;
  manager_phone: string | null;
  manager_linked: boolean;
  currency: InvestmentCurrency;
  status: LineStatus;
  default_monthly_rate: number;
  interest_on_return_mode: ReturnMode;
  due_soon_days: number;
  payment_grace_days: number;
  today: string;
  committed_cents: number;
  delivered_cents: number;
  to_deliver_cents: number;
  capital_outstanding_cents: number;
  capital_returned_cents: number;
  contributions_count: number;
  credit_balance_cents: number;
  monthly_interest_expected_cents: number;
  month_collected_cents: number;
  month_pending_cents: number;
  overdue_cents: number;
  overdue_count: number;
  due_soon_count: number;
  pending_total_cents: number;
  interest_collected_total_cents: number;
  next_due: { due_date: string; amount_cents: number; count: number } | null;
  health: LineHealth;
  pending_recon_count: number;
  role: LineRole;
}

export interface CurrencyKpis {
  capital_outstanding_cents: number;
  monthly_interest_expected_cents: number;
  month_collected_cents: number;
  month_pending_cents: number;
  overdue_cents: number;
  interest_collected_total_cents: number;
  committed_cents: number;
  delivered_cents: number;
  lines_count: number;
}

export interface InvestmentsOverview {
  today: string;
  kpis: Partial<Record<InvestmentCurrency, CurrencyKpis>>;
  lines: LineSummary[];
}

export interface Contribution {
  id: string;
  line_id: string;
  amount_cents: number;
  contributed_at: string;
  anchor_day: number;
  monthly_rate: number;
  grace_months: number;
  method: PaymentMethod;
  source_bank: string | null;
  operation_code: string | null;
  voucher_path: string | null;
  recon_status: ReconStatus;
  status: "activo" | "liquidado" | "anulado";
  void_reason: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface InterestSchedule {
  id: string;
  contribution_id: string;
  line_id: string;
  period_number: number;
  period_start: string;
  due_date: string;
  base_capital_cents: number;
  rate: number;
  amount_due_cents: number;
  amount_paid_cents: number;
  amount_waived_cents: number;
  outstanding_cents: number;
  status: ScheduleStatus;
  display_status: ScheduleDisplayStatus;
  days_late: number;
  paid_at: string | null;
  contributed_at: string;
  contribution_amount_cents: number;
}

export interface PaymentAllocation {
  id: string;
  target_type: "schedule" | "capital" | "credit";
  schedule_id: string | null;
  contribution_id: string | null;
  amount_cents: number;
  voided_at: string | null;
}

export interface Payment {
  id: string;
  line_id: string;
  amount_cents: number;
  paid_at: string;
  method: PaymentMethod;
  source_bank: string | null;
  operation_code: string | null;
  voucher_path: string | null;
  kind: PaymentKind;
  recon_status: ReconStatus;
  status: "activo" | "anulado";
  void_reason: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  allocations: PaymentAllocation[];
}

export interface RateChange {
  id: string;
  contribution_id: string;
  from_period: number;
  old_rate: number;
  new_rate: number;
  reason: string;
  created_at: string;
  voided_at: string | null;
}

/** Ítem de la imputación propuesta/aplicada que devuelve la RPC de pagos */
export interface PlannedAllocation {
  target_type: "schedule" | "capital" | "credit";
  amount_cents: number;
  schedule_id?: string;
  contribution_id?: string;
  due_date?: string;
  period_number?: number;
  outstanding_before_cents?: number;
  contributed_at?: string;
  capital_before_cents?: number;
}

export interface PaymentResult {
  dry_run: boolean;
  payment_id?: string;
  paid_date: string;
  allocations: PlannedAllocation[];
  credit_cents: number;
  warnings: InvestmentWarning[];
}

export interface ContributionPreview {
  monthly_interest_cents: number;
  monthly_rate: number;
  anchor_day: number;
  first_period_start: string;
  first_due_date: string;
  delivered_before_cents: number;
  delivered_after_cents: number;
  committed_cents: number;
}

export interface ContributionResult {
  dry_run: boolean;
  contribution_id?: string;
  warnings: InvestmentWarning[];
  preview: ContributionPreview;
}

export interface CreateLineInput {
  manager_display_name: string;
  manager_phone?: string | null;
  currency: InvestmentCurrency;
  committed_amount_cents: number;
  default_monthly_rate: number;
  interest_on_return_mode: ReturnMode;
  due_soon_days?: number;
  payment_grace_days?: number;
  notes?: string | null;
}

export interface ContributionInput {
  line_id: string;
  amount_cents: number;
  contributed_at: string;
  monthly_rate?: number | null;
  anchor_day?: number | null;
  grace_months?: number;
  method: Exclude<PaymentMethod, "reinversion">;
  source_bank?: string | null;
  operation_code?: string | null;
  voucher_path?: string | null;
  voucher_hash?: string | null;
  notes?: string | null;
}

export interface PaymentInput {
  line_id: string;
  amount_cents: number;
  paid_at: string; // ISO con zona
  method: Exclude<PaymentMethod, "reinversion">;
  kind: PaymentKind;
  allocations?: { target_type: "schedule" | "capital" | "credit"; schedule_id?: string; contribution_id?: string; amount_cents: number }[] | null;
  source_bank?: string | null;
  operation_code?: string | null;
  voucher_path?: string | null;
  voucher_hash?: string | null;
  notes?: string | null;
}

export interface LineDetail {
  summary: LineSummary;
  contributions: Contribution[];
  schedules: InterestSchedule[];
  payments: Payment[];
  rateChanges: RateChange[];
}

export const PAYMENT_METHODS: { value: Exclude<PaymentMethod, "reinversion">; label: string }[] = [
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "otro", label: "Otro" },
];

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  reinversion: "Reinversión",
  otro: "Otro",
};

export const RECON_LABEL: Record<ReconStatus, string> = {
  pendiente_contraparte: "Por confirmar",
  confirmado: "Confirmado",
  observado: "Observado",
  anulado: "Anulado",
};

export const SCHEDULE_LABEL: Record<ScheduleDisplayStatus, string> = {
  programada: "Programada",
  por_vencer: "Por vencer",
  vencida: "Vencida",
  parcial: "Parcial",
  pagada: "Pagada",
  condonada: "Condonada",
  anulada: "Anulada",
};
