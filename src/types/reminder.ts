export type ReminderType = "debt" | "service" | "free" | "credit_card";
export type ReminderRecurrence = "none" | "daily" | "weekly" | "monthly";
export type ReminderStatus = "pending" | "completed" | "dismissed";

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  type: ReminderType;
  amount?: number;
  due_date: string;
  due_time?: string;
  notify_advance: number;
  recurrence: ReminderRecurrence;
  status: ReminderStatus;
  whatsapp_confirmed: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReminderDTO {
  title: string;
  type: ReminderType;
  amount?: number;
  due_date: string;
  due_time?: string;
  notify_advance: number;
  recurrence: ReminderRecurrence;
  notes?: string;
}
