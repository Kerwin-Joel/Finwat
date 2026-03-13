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

  async update(id: string, dto: Partial<CreateReminderDTO>): Promise<void> {
    const { error } = await supabase
      .from("reminders")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
};
