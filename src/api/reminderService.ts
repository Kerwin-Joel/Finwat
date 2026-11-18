import { supabase } from "../lib/supabase";
import type { Reminder, CreateReminderDTO } from "../types/reminder";

export const reminderService = {
  async getAll(userId: string): Promise<Reminder[]> {
    const { data, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async create(userId: string, dto: CreateReminderDTO): Promise<Reminder> {
    const { data, error } = await supabase
      .from("reminders")
      .insert({ ...dto, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async complete(id: string): Promise<void> {
    const { error } = await supabase
      .from("reminders")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  async dismiss(id: string): Promise<void> {
    const { error } = await supabase
      .from("reminders")
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    if (error) throw error;
  },

  // null limpia el campo (p. ej. quitar la hora o el monto); last_notified_at: null hace
  // que el bot vuelva a avisar si cambió la fecha, la hora o el aviso.
  async update(
    id: string,
    dto: Partial<Omit<CreateReminderDTO, "amount" | "due_time" | "notes">> & {
      amount?: number | null;
      due_time?: string | null;
      notes?: string | null;
      last_notified_at?: string | null;
    },
  ): Promise<void> {
    const { error } = await supabase
      .from("reminders")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
};
