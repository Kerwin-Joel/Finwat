import { supabase } from "../lib/supabase";
import type {
  Loan,
  CreateLoanDTO,
  LoanPayment,
} from "../types/loan";

export const loanService = {
  async getAll(userId: string): Promise<Loan[]> {
    const { data, error } = await supabase
      .from("loans")
      .select(
        "*, bank_details:loan_bank_details(*), installments:loan_installments(*)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<Loan> {
    const { data, error } = await supabase
      .from("loans")
      .select(
        "*, bank_details:loan_bank_details(*), installments:loan_installments(*)",
      )
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(userId: string, dto: CreateLoanDTO): Promise<Loan> {
    const { bank_details, ...loanData } = dto;

    const { data: loan, error } = await supabase
      .from("loans")
      .insert({
        ...loanData,
        user_id: userId,
        balance_remaining: loanData.principal,
      })
      .select()
      .single();
    if (error) throw error;

    // Guardar detalles bancarios si aplica
    if (bank_details && loan.type === "bank") {
      await supabase
        .from("loan_bank_details")
        .insert({ ...bank_details, loan_id: loan.id });
    }

    // Generar cronograma automático si tiene cuotas
    if (loan.installments_total > 1 && loan.installment_amount) {
      await loanService.generateInstallments(loan);
    }

    return loanService.getById(loan.id);
  },

  async generateInstallments(loan: Loan): Promise<void> {
    const installments = [];
    const startDate = new Date(loan.start_date + "T00:00:00Z");

    for (let i = 1; i <= loan.installments_total; i++) {
      const dueDate = new Date(startDate);

      switch (loan.interest_period) {
        case "weekly":
          dueDate.setUTCDate(dueDate.getUTCDate() + 7 * i);
          break;
        case "biweekly":
          dueDate.setUTCDate(dueDate.getUTCDate() + 14 * i);
          break;
        case "monthly":
          dueDate.setUTCMonth(dueDate.getUTCMonth() + i);
          break;
        case "bimonthly":
          dueDate.setUTCMonth(dueDate.getUTCMonth() + 2 * i);
          break;
        case "quarterly":
          dueDate.setUTCMonth(dueDate.getUTCMonth() + 3 * i);
          break;
        case "semiannual":
          dueDate.setUTCMonth(dueDate.getUTCMonth() + 6 * i);
          break;
        case "annual":
          dueDate.setUTCFullYear(dueDate.getUTCFullYear() + i);
          break;
      }

      // Calcular interés simple o compuesto
      let interestAmount = 0;
      const rate = (loan.interest_rate ?? 0) / 100;

      if (loan.interest_type === "simple") {
        interestAmount = loan.principal * rate;
      } else {
        const totalWithInterest = loan.principal * Math.pow(1 + rate, i);
        const prevTotal = loan.principal * Math.pow(1 + rate, i - 1);
        interestAmount = totalWithInterest - prevTotal;
      }

      const insuranceAmount = loan.bank_details?.insurance ?? 0;
      const principalAmount =
        (loan.installment_amount ?? 0) - interestAmount - insuranceAmount;

      installments.push({
        loan_id: loan.id,
        installment_number: i,
        due_date: dueDate.toISOString().split("T")[0],
        amount: loan.installment_amount,
        principal_amount: Math.max(0, principalAmount),
        interest_amount: interestAmount,
        insurance_amount: insuranceAmount,
        status: "pending",
      });
    }

    await supabase.from("loan_installments").insert(installments);
  },

  async update(
    id: string,
    updates: Partial<Loan>,
  ): Promise<void> {
    // Guardar historial de cambios
    const { data: current } = await supabase
      .from("loans")
      .select("*")
      .eq("id", id)
      .single();

    if (current) {
      const history = Object.entries(updates)
        .filter(([key, val]) => current[key] !== val && key !== "updated_at")
        .map(([key, val]) => ({
          loan_id: id,
          field_changed: key,
          old_value: String(current[key] ?? ""),
          new_value: String(val ?? ""),
        }));

      if (history.length > 0) {
        await supabase.from("loan_history").insert(history);
      }
    }

    const { error } = await supabase
      .from("loans")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  async addPayment(
    loanId: string,
    amount: number,
    paymentDate: string,
    notes?: string,
  ): Promise<void> {
    // Registrar pago
    await supabase.from("loan_payments").insert({
      loan_id: loanId,
      amount,
      payment_date: paymentDate,
      notes,
    });

    // Actualizar saldo restante
    const { data: loan } = await supabase
      .from("loans")
      .select(
        "balance_remaining, installments_paid, installments_total, installment_amount",
      )
      .eq("id", loanId)
      .single();

    if (!loan) return;

    const newBalance = Math.max(0, loan.balance_remaining - amount);
    const newInstallmentsPaid = loan.installments_paid + 1;
    const newStatus = newBalance === 0 ? "paid" : "active";

    await supabase
      .from("loans")
      .update({
        balance_remaining: newBalance,
        installments_paid: newInstallmentsPaid,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", loanId);

    // Marcar cuota como pagada
    const { data: nextInstallment } = await supabase
      .from("loan_installments")
      .select("id")
      .eq("loan_id", loanId)
      .eq("status", "pending")
      .order("installment_number", { ascending: true })
      .limit(1)
      .single();

    if (nextInstallment) {
      await supabase
        .from("loan_installments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", nextInstallment.id);
    }
  },

  async getPayments(loanId: string): Promise<LoanPayment[]> {
    const { data, error } = await supabase
      .from("loan_payments")
      .select("*")
      .eq("loan_id", loanId)
      .order("payment_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getHistory(loanId: string) {
    const { data, error } = await supabase
      .from("loan_history")
      .select("*")
      .eq("loan_id", loanId)
      .order("changed_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("loans").delete().eq("id", id);
    if (error) throw error;
  },

  async updateOverdueStatus(userId: string): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("loans")
      .update({ status: "overdue", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "active")
      .lt("due_date", today);
  },
};
