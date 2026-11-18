import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import FinwatLogo from "@/assets/FinwatLogo";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";

// Pantallas de acceso (propuesta A).
// Móvil: la aurora ocupa la pantalla y el titular vive abajo, a la altura del pulgar.
//   - fullHero: la aurora es toda la pantalla (bienvenida); el formulario va en una hoja aparte.
//   - si no: la aurora es una banda superior y el formulario sube encima como hoja fija.
// Escritorio (md+): pantalla dividida, aurora a la izquierda y formulario a la derecha.
interface AuthShellProps {
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
  /** Contenido extra al pie del héroe, solo en móvil (p. ej. los botones de la bienvenida) */
  heroActions?: ReactNode;
  /** Móvil: aurora a pantalla completa y sin panel de formulario visible */
  fullHero?: boolean;
}

const AuthShell = ({ title, subtitle, children, heroActions, fullHero }: AuthShellProps) => {
  const reduce = useReducedMotion();
  const rise = (delay: number) => ({
    initial: reduce ? false : ({ opacity: 0, y: 16 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay: reduce ? 0 : delay, ease: EASE_OUT },
  });

  return (
    <div className="min-h-[100dvh] bg-background md:grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <header
        className={cn(
          "hero-aurora flex flex-col overflow-hidden px-6 pt-[max(1.25rem,env(safe-area-inset-top))]",
          "md:sticky md:top-0 md:m-3 md:h-[calc(100dvh-1.5rem)] md:rounded-[32px] md:px-12 md:pb-12 md:pt-10",
          fullHero ? "min-h-[100dvh] pb-[max(1.75rem,env(safe-area-inset-bottom))]" : "min-h-[38dvh] pb-14",
        )}
      >
        <div className="pointer-events-none absolute -right-20 top-16 text-white opacity-[0.09] md:-right-24 md:top-24" aria-hidden="true">
          <div className="brightness-0 invert">
            <FinwatLogo size={340} />
          </div>
        </div>

        <motion.div className="relative flex items-center gap-2" {...rise(0)}>
          <div className="brightness-0 invert">
            <FinwatLogo size={24} />
          </div>
          <span className="text-[17px] font-semibold tracking-[-0.02em]">Finwat</span>
        </motion.div>

        <div className="relative mt-auto pt-10">
          <motion.h1
            className="text-[40px] font-semibold leading-[1.02] tracking-[-0.04em] md:text-[56px]"
            {...rise(0.06)}
          >
            {title}
          </motion.h1>
          <motion.p className="mt-4 max-w-[21rem] text-[14.5px] leading-relaxed text-white/75 md:text-[16px]" {...rise(0.12)}>
            {subtitle}
          </motion.p>
          {heroActions && (
            <motion.div className="mt-7 md:hidden" {...rise(0.18)}>
              {heroActions}
            </motion.div>
          )}
        </div>
      </header>

      <main
        className={cn(
          "relative bg-background md:flex md:items-center md:justify-center md:px-12 md:py-12",
          fullHero ? "hidden md:flex" : "-mt-7 rounded-t-[28px] px-5 pb-10 pt-8 md:mt-0 md:rounded-none",
        )}
      >
        <motion.div className="mx-auto w-full max-w-[380px]" {...rise(0.1)}>
          {children}
        </motion.div>
      </main>
    </div>
  );
};

export default AuthShell;
