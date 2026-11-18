import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { FINWAT_LOGO_PATH } from "@/assets/finwatLogoPath";
import { EASE_IN_OUT, EASE_OUT } from "@/lib/motion";

// Splash tras iniciar sesión: aurora a pantalla completa, el isotipo se traza y se
// rellena, aparece la marca y la pantalla se desvanece con un leve zoom al entrar.
const TOTAL_MS = 2000;
const EXIT_MS = 420;

const SplashScreen = () => {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const total = reduce ? 900 : TOTAL_MS;
    const exit = setTimeout(() => setLeaving(true), total - EXIT_MS);
    const go = setTimeout(() => navigate("/", { replace: true }), total);
    return () => {
      clearTimeout(exit);
      clearTimeout(go);
    };
  }, [navigate, reduce]);

  return (
    <motion.div
      className="hero-aurora fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      role="status"
      aria-label="Cargando Finwat"
      initial={{ opacity: 0 }}
      animate={leaving ? { opacity: 0, scale: 1.04 } : { opacity: 1, scale: 1 }}
      transition={{ duration: leaving ? EXIT_MS / 1000 : 0.35, ease: leaving ? EASE_IN_OUT : EASE_OUT }}
    >
      {/* Halo de luz que respira detrás del logo */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute h-[420px] w-[420px] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(140,180,255,0.45), rgba(140,180,255,0) 70%)" }}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={reduce ? { opacity: 0.8, scale: 1 } : { opacity: [0, 0.9, 0.65], scale: [0.7, 1.05, 1] }}
        transition={{ duration: 1.6, ease: EASE_OUT }}
      />

      {/* Isotipo: primero el contorno se traza, luego se rellena */}
      <motion.svg
        width="92"
        height="92"
        viewBox="-2 -2 134 134"
        className="relative"
        aria-hidden="true"
        initial={{ scale: reduce ? 1 : 0.94 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.2, ease: EASE_OUT }}
      >
        <motion.path
          d={FINWAT_LOGO_PATH}
          fill="#ffffff"
          stroke="#ffffff"
          strokeWidth={1.6}
          strokeLinejoin="round"
          initial={reduce ? { pathLength: 1, fillOpacity: 1 } : { pathLength: 0, fillOpacity: 0 }}
          animate={{ pathLength: 1, fillOpacity: 1 }}
          transition={{
            pathLength: { duration: 0.95, ease: EASE_IN_OUT },
            fillOpacity: { duration: 0.45, delay: 0.75, ease: EASE_OUT },
          }}
        />
      </motion.svg>

      {/* Marca */}
      <motion.p
        className="relative mt-7 text-[34px] font-semibold text-white"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, letterSpacing: "0.12em" }}
        animate={{ opacity: 1, y: 0, letterSpacing: "-0.03em" }}
        transition={{ duration: 0.9, delay: reduce ? 0 : 0.55, ease: EASE_OUT }}
      >
        Finwat
      </motion.p>
      <motion.p
        className="relative mt-2 text-[14px] text-white/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: reduce ? 0 : 0.85, ease: EASE_OUT }}
      >
        Tu dinero, por fin claro.
      </motion.p>

      {/* Progreso: línea fina */}
      <motion.div
        className="absolute bottom-[max(3.5rem,calc(env(safe-area-inset-bottom)+2.5rem))] h-[3px] w-28 overflow-hidden rounded-full bg-white/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : 0.6, duration: 0.4 }}
        aria-hidden="true"
      >
        <motion.div
          className="h-full origin-left rounded-full bg-white"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: reduce ? 0 : 0.7, duration: reduce ? 0.6 : (TOTAL_MS - 700 - EXIT_MS) / 1000, ease: EASE_IN_OUT }}
        />
      </motion.div>
    </motion.div>
  );
};

export default SplashScreen;
