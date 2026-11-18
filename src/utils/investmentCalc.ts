import type { Contribution, LineDetail, Payment } from "@/types/investment";

/** Capital que aún debe cada aporte (aporte − devoluciones de capital vigentes) */
export const capitalOutstandingByContribution = (contributions: Contribution[], payments: Payment[]) => {
  const returned = new Map<string, number>();
  for (const p of payments) {
    if (p.status === "anulado") continue;
    for (const a of p.allocations ?? []) {
      if (a.target_type !== "capital" || a.voided_at || !a.contribution_id) continue;
      returned.set(a.contribution_id, (returned.get(a.contribution_id) ?? 0) + Number(a.amount_cents));
    }
  }
  const out = new Map<string, number>();
  for (const c of contributions) {
    if (c.status === "anulado") continue;
    out.set(c.id, Math.max(0, Number(c.amount_cents) - (returned.get(c.id) ?? 0)));
  }
  return out;
};

/** Préstamos con comisión cuyo capital ya debió devolverse y sigue pendiente */
export const overdueCommissionCapital = (detail: LineDetail) => {
  const out = capitalOutstandingByContribution(detail.contributions, detail.payments);
  return detail.contributions
    .filter(
      (c) =>
        c.status === "activo" &&
        c.return_type === "comision" &&
        c.repayment_date &&
        c.repayment_date < detail.summary.today &&
        (out.get(c.id) ?? 0) > 0,
    )
    .map((c) => ({ contribution: c, cents: out.get(c.id) ?? 0 }));
};

/** Mes actual (YYYY-MM) en Lima a partir de `today` (YYYY-MM-DD) */
export const monthKey = (iso: string) => iso.slice(0, 7);

/** Fecha (YYYY-MM-DD) en hora de Lima de un timestamp ISO */
export const limaDate = (ts: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(ts),
  );

/** Lo cobrado en el mes de `today`: total y desglose por intereses/comisiones, capital y saldo a favor */
export const collectedThisMonth = (payments: Payment[], today: string) => {
  const key = monthKey(today);
  let total = 0;
  let income = 0;
  let capital = 0;
  let credit = 0;
  let count = 0;
  for (const p of payments) {
    if (p.status === "anulado" || monthKey(limaDate(p.paid_at)) !== key) continue;
    total += Number(p.amount_cents);
    count += 1;
    for (const a of p.allocations ?? []) {
      if (a.voided_at) continue;
      const v = Number(a.amount_cents);
      if (a.target_type === "schedule") income += v;
      else if (a.target_type === "capital") capital += v;
      else credit += v;
    }
  }
  return { total, income, capital, credit, count };
};
