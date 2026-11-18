import { useId } from "react";
import { FINWAT_LOGO_PATH } from "./finwatLogoPath";

// Cada logo usa su propio id de degradado: si dos compartieran id y el primero estuviera
// oculto (p. ej. la barra lateral en el celular), el navegador dejaría el otro sin color.
const FinwatLogo = ({ size = 64 }: { size?: number }) => {
  const gradientId = `finwat-gradient-${useId().replace(/:/g, "")}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 130 130"
      fill="none"
      aria-hidden="true"
    >
      <path d={FINWAT_LOGO_PATH} fill={`url(#${gradientId})`} />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="130" y2="130" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00aaff" />
          <stop offset="0.5" stopColor="#0066ff" />
          <stop offset="1" stopColor="#003899" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default FinwatLogo;
