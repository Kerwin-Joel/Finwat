import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import useThemeStore, { type Theme } from "@/stores/themeStore";
import { SPRING_SNAPPY } from "@/lib/motion";

// Selector de apariencia al estilo de los ajustes de iOS/Android: cada opción muestra una
// miniatura de la app en ese modo. "Sistema" sigue el modo del teléfono en vivo.

type Option = { value: Extract<Theme, "light" | "dark" | "system">; label: string; hint: string; icon: LucideIcon };

const OPTIONS: Option[] = [
  { value: "light", label: "Claro", hint: "Siempre claro", icon: Sun },
  { value: "dark", label: "Oscuro", hint: "Siempre oscuro", icon: Moon },
  { value: "system", label: "Sistema", hint: "Automático", icon: Monitor },
];

const PALETTE = {
  light: { bg: "#f3f5fa", card: "#ffffff", line: "#e2e6ef", text: "#0b1230", pill: "#0d1638" },
  dark: { bg: "#0e1117", card: "#161a22", line: "#262b36", text: "#e8ebf1", pill: "#2563eb" },
};

/** Miniatura de la app: héroe azul, dos líneas de texto y una píldora de acción */
const Mini = ({ mode }: { mode: "light" | "dark" }) => {
  const c = PALETTE[mode];
  return (
    <div className="absolute inset-0 p-2" style={{ background: c.bg }}>
      <div
        className="h-[38%] rounded-md"
        style={{
          background:
            mode === "dark"
              ? "linear-gradient(160deg,#060b1d 0%,#0b1a52 45%,#3d63d1 100%)"
              : "linear-gradient(160deg,#050a1c 0%,#0a1748 40%,#1a44c4 75%,#8fb3ff 100%)",
        }}
      />
      <div className="mt-1.5 space-y-1 rounded-md p-1.5" style={{ background: c.card, boxShadow: `inset 0 0 0 1px ${c.line}` }}>
        <div className="h-1 w-3/4 rounded-full" style={{ background: c.text, opacity: 0.85 }} />
        <div className="h-1 w-1/2 rounded-full" style={{ background: c.text, opacity: 0.35 }} />
      </div>
      <div className="mt-1.5 h-2 w-full rounded-full" style={{ background: c.pill }} />
    </div>
  );
};

const ThemePicker = () => {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const reduce = useReducedMotion();

  return (
    <div role="radiogroup" aria-label="Apariencia" className="grid grid-cols-3 gap-2.5">
      {OPTIONS.map((o) => {
        const active = theme === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.value)}
            className={cn(
              "group flex flex-col items-center gap-2 rounded-2xl border p-2 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "border-brand bg-brand/5" : "border-border/70 bg-card hover:bg-accent",
            )}
          >
            <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-xl ring-1 ring-black/5 dark:ring-white/5">
              {o.value === "system" ? (
                <>
                  <Mini mode="light" />
                  {/* Mitad oscura en diagonal */}
                  <span className="absolute inset-0" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}>
                    <Mini mode="dark" />
                  </span>
                </>
              ) : (
                <Mini mode={o.value} />
              )}
              {active && (
                <motion.span
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white shadow-soft"
                  initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={SPRING_SNAPPY}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </motion.span>
              )}
            </span>
            <span className="flex items-center gap-1 text-[13px] font-semibold">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {o.label}
            </span>
            <span className="-mt-1.5 text-[11px] text-muted-foreground">{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ThemePicker;
