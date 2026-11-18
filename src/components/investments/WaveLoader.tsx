import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import FinwatLogo from "@/assets/FinwatLogo";
import {
  easeInOutCubic,
  easeOutCubic,
  fitCanvas,
  makeParticles,
  rimGradient,
  strokeRim,
  traceFront,
} from "@/lib/waves";

// Loader de marca (motor en lib/waves): un frente azul Finwat sube desde abajo, deja una
// estela de luz y suelta partículas. El texto va sobre un chip de vidrio con el isotipo para
// que siempre se lea (contraste AA aunque la onda pase detrás). Anuncia el estado a lectores
// de pantalla (role=status, aria-busy) y con movimiento reducido queda quieto.

const CYCLE = 3; // s por pasada (lenta y suave)
const PARTICLES = 20;

const WaveLoader = ({
  label,
  steps = [],
  className,
  height = 156,
}: {
  label: string;
  steps?: string[];
  className?: string;
  height?: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (steps.length < 2) return;
    const id = setInterval(
      () => setStepIndex((i) => (i + 1) % steps.length),
      1100,
    );
    return () => clearInterval(id);
  }, [steps.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let size = fitCanvas(canvas, ctx);
    const ro = new ResizeObserver(() => {
      size = fitCanvas(canvas, ctx);
    });
    ro.observe(canvas);

    let particles = makeParticles(PARTICLES);
    let lastCycle = -1;
    const start = performance.now();
    let raf = 0;

    const frame = (t: number, p: number) => {
      const { width, height: h } = size;
      ctx.clearRect(0, 0, width, h);
      const amp = Math.min(30, h * 0.2);
      const y =
        h + amp * 0.2 - easeInOutCubic(Math.min(1, p / 0.9)) * (h + amp * 1.6);
      const fade =
        p < 0.06 ? p / 0.06 : p > 0.88 ? Math.max(0, (1 - p) / 0.12) : 1;

      // Estela: lo que ya cruzó la onda queda teñido suavemente
      const wake = ctx.createLinearGradient(0, y, 0, h);
      wake.addColorStop(0, `rgba(0,122,255,${0.08 * fade})`);
      wake.addColorStop(1, "rgba(0,122,255,0)");
      ctx.fillStyle = wake;
      traceFront(ctx, "vertical", y, width, amp, t);
      ctx.lineTo(width, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      strokeRim(
        ctx,
        (shift) => traceFront(ctx, "vertical", y + shift, width, amp, t),
        (a) => rimGradient(ctx, 0, 0, width, 0, t, a),
        fade,
      );

      // Partículas que salen del origen (abajo al centro), se abren y se apagan
      for (const pt of particles) {
        const life = (p - pt.delay) / 0.75;
        if (life <= 0 || life >= 1) continue;
        const dist = easeOutCubic(life) * pt.speed * h * 1.15;
        const px =
          width / 2 +
          Math.cos(pt.angle) * dist * (width / h) * 0.55 +
          Math.sin(life * 6 + pt.sway) * pt.sway * 0.4;
        const py = h + 6 + Math.sin(pt.angle) * dist;
        ctx.globalAlpha =
          (1 - life) *
          (0.55 + 0.45 * Math.sin(t * pt.twinkle + pt.sway)) *
          fade *
          0.55;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(px, py, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      const t = (now - start) / 1000;
      const cycle = Math.floor(t / CYCLE);
      if (cycle !== lastCycle) {
        lastCycle = cycle;
        particles = makeParticles(PARTICLES);
      }
      frame(t, (t % CYCLE) / CYCLE);
      raf = requestAnimationFrame(loop);
    };

    if (reduce)
      frame(0.6, 0.45); // un brillo quieto a media altura
    else raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduce]);

  const current = steps.length ? steps[stepIndex] : null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={cn("surface relative overflow-hidden", className)}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      <div className="relative flex h-full items-center justify-center px-4">
        <div className="flex max-w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-2.5 shadow-soft backdrop-blur-md">
          <motion.span
            className="shrink-0"
            aria-hidden="true"
            animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <FinwatLogo size={24} />
          </motion.span>
          <div className="min-w-0 text-left">
            <p className="shimmer-text truncate text-[14px] font-semibold tracking-[-0.01em]">
              {label}
            </p>
            <div className="h-4 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                {current && (
                  <motion.p
                    key={current}
                    className="truncate text-[12px] text-muted-foreground"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                    {current}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaveLoader;
