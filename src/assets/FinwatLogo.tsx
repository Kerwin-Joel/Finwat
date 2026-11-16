import { FINWAT_LOGO_PATH } from "./finwatLogoPath";

const FinwatLogo = ({ size = 64 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 130 130"
    fill="none"
  >
    <path
      d={FINWAT_LOGO_PATH}
      fill="url(#finwat_gradient)"
    />
    <defs>
      <linearGradient
        id="finwat_gradient"
        x1="0"
        y1="0"
        x2="130"
        y2="130"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#00aaff" />
        <stop offset="0.5" stopColor="#0066ff" />
        <stop offset="1" stopColor="#003899" />
      </linearGradient>
    </defs>
  </svg>
);

export default FinwatLogo;
