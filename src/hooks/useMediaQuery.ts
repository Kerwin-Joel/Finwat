import { useSyncExternalStore } from "react";

/** true mientras el media query coincida (se actualiza al cambiar el tamaño) */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** md: tablet y escritorio */
export const useIsDesktop = () => useMediaQuery("(min-width: 768px)");
