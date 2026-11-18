import type { Reminder } from "@/types/reminder";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Fecha y hora locales de un recordatorio. Si tiene hora, la base guarda fecha y hora en
 * UTC (así las lee el bot de WhatsApp): un recordatorio a las 11 p. m. en Lima queda con la
 * fecha del día siguiente en UTC. Aquí se convierte de vuelta para mostrarlo y editarlo.
 */
export const reminderLocal = (r: Pick<Reminder, "due_date" | "due_time">): { date: string; time: string } => {
  if (!r.due_time) return { date: r.due_date, time: "" };
  const d = new Date(`${r.due_date}T${r.due_time.slice(0, 8)}Z`);
  if (Number.isNaN(d.getTime())) return { date: r.due_date, time: "" };
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};
