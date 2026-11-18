import { formatCurrency } from "./formatCurrency";

// El módulo de inversiones trabaja en céntimos (enteros). Solo esta capa convierte a soles.

export const centsToAmount = (cents: number): number => Math.round(cents) / 100;

/** "1,234.5" / "1234,50" / "S/ 300" → céntimos. null si no es un monto válido. */
export const parseAmountToCents = (input: string): number | null => {
  const clean = input.replace(/[^\d.,]/g, "");
  if (!clean) return null;
  // La última coma o punto con 1–2 dígitos detrás es el separador decimal
  const m = clean.match(/^(.*?)[.,](\d{1,2})$/);
  const intPart = (m ? m[1] : clean).replace(/[.,]/g, "");
  const decPart = m ? m[2].padEnd(2, "0") : "00";
  if (!/^\d+$/.test(intPart || "0")) return null;
  const cents = Number(intPart || "0") * 100 + Number(decPart);
  return Number.isSafeInteger(cents) ? cents : null;
};

export const formatCents = (cents: number, currency: string = "PEN"): string =>
  formatCurrency(centsToAmount(cents), currency);

/** 0.1 → "10 %" ; 0.085 → "8.5 %" */
export const formatRate = (rate: number): string =>
  `${(Math.round(rate * 10000) / 100).toLocaleString("es-PE", { maximumFractionDigits: 2 })} %`;

/** "10" / "8,5" → 0.10 / 0.085 */
export const parsePercentToRate = (input: string): number | null => {
  const n = Number(input.replace(",", ".").replace(/[^\d.]/g, ""));
  if (!input.trim() || Number.isNaN(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 10000;
};
