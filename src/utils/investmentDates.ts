import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// Fechas de negocio del módulo de inversiones: vienen como 'YYYY-MM-DD' (hora de Lima).

export const formatDay = (iso: string, pattern = "d MMM yyyy"): string =>
  format(parseISO(iso), pattern, { locale: es });

export const daysBetween = (fromIso: string, toIso: string): number =>
  differenceInCalendarDays(parseISO(toIso), parseISO(fromIso));

/** "hoy", "mañana", "en 5 días", "ayer", "hace 3 días" */
export const relativeDay = (iso: string, todayIso: string): string => {
  const d = daysBetween(todayIso, iso);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  if (d === -1) return "ayer";
  return d > 0 ? `en ${d} días` : `hace ${-d} días`;
};

/** Fecha y hora actuales en Lima para inputs: { date: 'YYYY-MM-DD', time: 'HH:mm' } */
export const limaNow = (): { date: string; time: string } => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}` };
};

/** Fecha + hora de Lima (UTC−5, sin horario de verano) → ISO con zona */
export const limaToIso = (date: string, time: string): string => `${date}T${time || "12:00"}:00-05:00`;
