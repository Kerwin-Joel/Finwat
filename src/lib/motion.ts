import type { Transition, Variants } from "framer-motion";

// Un solo lenguaje de movimiento para toda la app: salida "expo" (rápida al inicio,
// muy suave al final) y springs críticamente amortiguados (sin rebote).

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

export const SPRING_SOFT: Transition = { type: "spring", stiffness: 260, damping: 32, mass: 0.9 };
export const SPRING_SNAPPY: Transition = { type: "spring", stiffness: 420, damping: 38 };

export const DURATION = { fast: 0.18, base: 0.32, slow: 0.5 };

/** Contenedor que escalona a sus hijos (40 ms) */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.04 } },
};

/** Hijo que sube 10 px y aparece */
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base + 0.08, ease: EASE_OUT } },
};

/** Transición entre páginas */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, y: -4, transition: { duration: DURATION.fast, ease: EASE_IN_OUT } },
};
