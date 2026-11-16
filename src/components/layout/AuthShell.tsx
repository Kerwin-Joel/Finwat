import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import FinwatLogo from "@/assets/FinwatLogo";
import { EASE_OUT } from "@/lib/motion";

// Pantallas de acceso: héroe "aurora" con titular en mayúsculas y la tarjeta del
// formulario montada encima, como en la referencia de banca móvil.
const AuthShell = ({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
}) => {
  const reduce = useReducedMotion();
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="hero-aurora overflow-hidden rounded-b-[36px] px-6 pb-28 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="pointer-events-none absolute -right-16 top-6 opacity-[0.09]" aria-hidden="true">
          <div className="brightness-0 invert">
            <FinwatLogo size={260} />
          </div>
        </div>
        <motion.div
          className="relative mx-auto max-w-md"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        >
          <div className="flex items-center gap-2">
            <div className="brightness-0 invert">
              <FinwatLogo size={28} />
            </div>
            <span className="text-[17px] font-semibold tracking-[-0.02em]">Finwat</span>
          </div>
          <h1 className="mt-10 text-[34px] font-semibold uppercase leading-[0.95] tracking-[-0.045em]">{title}</h1>
          <p className="mt-4 max-w-[19rem] text-[14px] leading-relaxed text-white/72">{subtitle}</p>
        </motion.div>
      </header>
      <motion.main
        className="relative mx-auto -mt-16 max-w-md px-4 pb-10"
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: reduce ? 0 : 0.08, ease: EASE_OUT }}
      >
        {children}
      </motion.main>
    </div>
  );
};

export default AuthShell;
