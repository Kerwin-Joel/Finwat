import type { Account, CardKind, CardNetworkId, CardStyle } from "@/types/account";
import { ACCOUNT_TYPE_LABEL } from "@/types/account";

export const CARD_STYLE_CLASS: Record<CardStyle, string> = {
  aurora: "hero-aurora",
  medianoche: "card-medianoche",
  oceano: "card-oceano",
  esmeralda: "card-esmeralda",
  atardecer: "card-atardecer",
  oro: "card-oro",
};

export const NETWORK_LABEL: Record<CardNetworkId, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  diners: "Diners Club",
  otra: "Otra",
};

export const KIND_LABEL: Record<CardKind, string> = { debito: "Débito", credito: "Crédito" };

/** "Tarjeta de crédito", "Débito", "Efectivo"… */
export const accountSubtitle = (a: Pick<Account, "type" | "card_kind" | "bank_name">): string => {
  if (a.type === "card") return a.card_kind ? KIND_LABEL[a.card_kind] : "Tarjeta";
  return ACCOUNT_TYPE_LABEL[a.type] ?? "Cuenta";
};

export const isCredit = (a: Pick<Account, "type" | "card_kind">) => a.type === "card" && a.card_kind === "credito";
