import { supabase } from "../lib/supabase";
import type {
  Contribution,
  ContributionInput,
  ContributionResult,
  CreateLineInput,
  InterestSchedule,
  InvestmentsOverview,
  LineDetail,
  LineSummary,
  Payment,
  PaymentInput,
  PaymentResult,
  RateChange,
  ReturnMode,
} from "../types/investment";
import { newId, prepareVoucher } from "../utils/voucherFile";

// Toda escritura va por RPC atómicas en Postgres (el motor de intereses vive en la BD).
// Las lecturas de detalle usan RLS: el usuario solo ve las líneas donde participa.

const VOUCHER_BUCKET = "investment-vouchers";

/** Errores de Postgres → mensaje en español para el usuario */
export const investmentErrorMessage = (error: unknown): string => {
  const e = error as { message?: string; code?: string; details?: string } | null;
  const msg = e?.message ?? "";
  if (e?.code === "PGRST202" || /Could not find the function/i.test(msg)) {
    return "El módulo de inversiones aún no está activado en la base de datos.";
  }
  // Solo es "sin conexión" si el fetch en sí falló (no cualquier error del cliente)
  if (/^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/i.test(msg)) {
    return "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }
  return msg || "Ocurrió un error inesperado";
};

const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.error(`[inversiones] ${fn}`, error);
    throw new Error(investmentErrorMessage(error));
  }
  return data as T;
};

export const investmentService = {
  getOverview: () => rpc<InvestmentsOverview>("investments_overview", { p_include_closed: false }),

  getLineSummary: (lineId: string) => rpc<LineSummary>("line_summary", { p_line_id: lineId }),

  async getLineDetail(lineId: string): Promise<LineDetail> {
    // line_summary genera primero las cuotas pendientes; luego se leen las tablas
    const summary = await investmentService.getLineSummary(lineId);
    const [contribs, schedules, payments, rates] = await Promise.all([
      supabase.from("contributions").select("*").eq("line_id", lineId).order("contributed_at", { ascending: true }),
      supabase.from("interest_schedules_view").select("*").eq("line_id", lineId).order("due_date", { ascending: true }),
      supabase
        .from("payments")
        .select("*, allocations:payment_allocations(id, target_type, schedule_id, contribution_id, amount_cents, voided_at)")
        .eq("line_id", lineId)
        .order("paid_at", { ascending: false }),
      supabase.from("rate_changes").select("*").eq("line_id", lineId).order("created_at", { ascending: false }),
    ]);
    for (const r of [contribs, schedules, payments, rates]) {
      if (r.error) throw new Error(investmentErrorMessage(r.error));
    }
    return {
      summary,
      contributions: (contribs.data ?? []) as Contribution[],
      schedules: (schedules.data ?? []) as InterestSchedule[],
      payments: (payments.data ?? []) as Payment[],
      rateChanges: (rates.data ?? []) as RateChange[],
    };
  },

  createLine: (input: CreateLineInput) =>
    rpc<string>("create_investment_line", {
      p_manager_display_name: input.manager_display_name,
      p_manager_phone: input.manager_phone ?? null,
      p_currency: input.currency,
      p_committed_amount_cents: input.committed_amount_cents,
      p_default_monthly_rate: input.default_monthly_rate,
      p_interest_on_return_mode: input.interest_on_return_mode,
      p_due_soon_days: input.due_soon_days ?? 3,
      p_payment_grace_days: input.payment_grace_days ?? 0,
      p_notes: input.notes ?? null,
    }),

  updateLine: (
    lineId: string,
    patch: Partial<{
      manager_display_name: string;
      manager_phone: string | null;
      committed_amount_cents: number;
      default_monthly_rate: number;
      interest_on_return_mode: ReturnMode;
      due_soon_days: number;
      payment_grace_days: number;
      notes: string | null;
    }>,
  ) => rpc<LineSummary>("update_investment_line", { p_line_id: lineId, p_patch: patch }),

  closeLine: (lineId: string, reason: string) =>
    rpc<void>("close_investment_line", { p_line_id: lineId, p_reason: reason }),

  registerContribution: (input: ContributionInput, dryRun: boolean) =>
    rpc<ContributionResult>("register_contribution", {
      p_line_id: input.line_id,
      p_amount_cents: input.amount_cents,
      p_contributed_at: input.contributed_at,
      p_monthly_rate: input.monthly_rate ?? null,
      p_anchor_day: input.anchor_day ?? null,
      p_grace_months: input.grace_months ?? 0,
      p_method: input.method,
      p_source_bank: input.source_bank ?? null,
      p_operation_code: input.operation_code ?? null,
      p_voucher_path: input.voucher_path ?? null,
      p_voucher_hash: input.voucher_hash ?? null,
      p_notes: input.notes ?? null,
      p_dry_run: dryRun,
      p_return_type: input.return_type ?? "tasa",
      p_fixed_amount_cents: input.fixed_amount_cents ?? null,
    }),

  /** Edita un aporte: datos no financieros en el lugar; si cambia monto/fecha/rendimiento, lo corrige */
  updateContribution: (contributionId: string, input: ContributionInput, reason?: string) =>
    rpc<{ contribution_id: string; corrected: boolean }>("update_contribution", {
      p_contribution_id: contributionId,
      p_amount_cents: input.amount_cents,
      p_contributed_at: input.contributed_at,
      p_return_type: input.return_type ?? "tasa",
      p_monthly_rate: input.monthly_rate ?? null,
      p_fixed_amount_cents: input.fixed_amount_cents ?? null,
      p_anchor_day: input.anchor_day ?? null,
      p_grace_months: input.grace_months ?? 0,
      p_method: input.method,
      p_source_bank: input.source_bank ?? null,
      p_operation_code: input.operation_code ?? null,
      p_notes: input.notes ?? null,
      p_reason: reason ?? null,
    }),

  registerPayment: (input: PaymentInput, dryRun: boolean) =>
    rpc<PaymentResult>("register_payment_with_allocations", {
      p_line_id: input.line_id,
      p_amount_cents: input.amount_cents,
      p_paid_at: input.paid_at,
      p_method: input.method,
      p_kind: input.kind,
      p_allocations: input.allocations?.length ? input.allocations : null,
      p_source_bank: input.source_bank ?? null,
      p_operation_code: input.operation_code ?? null,
      p_voucher_path: input.voucher_path ?? null,
      p_voucher_hash: input.voucher_hash ?? null,
      p_notes: input.notes ?? null,
      p_dry_run: dryRun,
    }),

  changeContributionRate: (contributionId: string, newRate: number, fromPeriod: number, reason: string) =>
    rpc<{ contributions_changed: number }>("change_rate", {
      p_new_rate: newRate,
      p_reason: reason,
      p_contribution_id: contributionId,
      p_from_period: fromPeriod,
    }),

  changeLineRate: (lineId: string, newRate: number, effectiveDate: string, reason: string) =>
    rpc<{ contributions_changed: number }>("change_rate", {
      p_new_rate: newRate,
      p_reason: reason,
      p_line_id: lineId,
      p_effective_date: effectiveDate,
    }),

  voidMovement: (type: "contribution" | "payment", id: string, reason: string) =>
    rpc<void>("void_movement", { p_type: type, p_id: id, p_reason: reason }),

  /** Comprime, calcula el hash y sube el voucher a investment-vouchers/{lineId}/... */
  async uploadVoucher(lineId: string, file: File): Promise<{ path: string; hash: string | null }> {
    const prepared = await prepareVoucher(file);
    const path = `${lineId}/${newId()}.${prepared.extension}`;
    const { error } = await supabase.storage
      .from(VOUCHER_BUCKET)
      .upload(path, prepared.blob, { contentType: prepared.contentType, upsert: false });
    if (error) throw new Error(investmentErrorMessage(error));
    return { path, hash: prepared.hash };
  },

  /** URL firmada de corta duración (5 min) para ver un voucher */
  async getVoucherUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(VOUCHER_BUCKET).createSignedUrl(path, 300);
    if (error || !data) throw new Error(investmentErrorMessage(error));
    return data.signedUrl;
  },
};
