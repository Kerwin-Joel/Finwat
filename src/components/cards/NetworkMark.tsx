import type { CardNetworkId } from "@/types/account";
import { cn } from "@/lib/utils";

// Marcas simplificadas de las redes de tarjeta (para identificarlas de un vistazo).
const NetworkMark = ({ network, className }: { network?: CardNetworkId | null; className?: string }) => {
  if (!network || network === "otra") return null;

  if (network === "mastercard") {
    return (
      <svg viewBox="0 0 48 30" className={cn("h-7 w-auto", className)} role="img" aria-label="Mastercard">
        <circle cx="17" cy="15" r="13" fill="#EB001B" />
        <circle cx="31" cy="15" r="13" fill="#F79E1B" />
        <path d="M24 4.2a13 13 0 0 1 0 21.6 13 13 0 0 1 0-21.6Z" fill="#FF5F00" />
      </svg>
    );
  }
  if (network === "amex") {
    return (
      <span
        className={cn(
          "inline-flex h-6 items-center rounded-[5px] bg-[#1F72CD] px-1.5 text-[10px] font-extrabold italic tracking-[0.04em] text-white",
          className,
        )}
        role="img"
        aria-label="American Express"
      >
        AMEX
      </span>
    );
  }
  if (network === "diners") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold text-white/90", className)} role="img" aria-label="Diners Club">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10 6.5v11M14 6.5v11" stroke="currentColor" strokeWidth="2" />
        </svg>
        Diners
      </span>
    );
  }
  // visa
  return (
    <span
      className={cn("text-[22px] font-extrabold italic leading-none tracking-[-0.02em] text-white", className)}
      role="img"
      aria-label="Visa"
    >
      VISA
    </span>
  );
};

export default NetworkMark;
