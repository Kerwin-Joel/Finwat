import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// Loader con ondas: un frente de color sube desde abajo (como una onda que sale del botón),
// con borde iridiscente que "respira", desenfoque detrás y partículas que saltan del origen.
// Canvas 2D, sin dependencias. Con movimiento reducido queda un brillo estático.

const PALETTE = ["#ffc915", "#7ec4ff", "#b428e6", "#eb64a0", "#ffb07a", "#9aa0ff", "#7fd9ee"];
const CYCLE = 2.3; // s por pasada
const PARTICLES = 46;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3.2);
// Arranca suave, cruza y se frena arriba (parecido a cubic-bezier(0.22, 1, 0.36, 1) pero más legible)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Particle {
  angle: number;
  speed: number;
  size: number;
  color: string;
  twinkle: number;
  sway: number;
  delay: number;
}

const makeParticles = (): Particle[] =>
  Array.from({ length: PARTICLES }, (_, i) => ({
    angle: -Math.PI / 2 + (Math.random() - 0.5) * 1.9,
    speed: 0.35 + Math.random() * 0.65,
    size: 0.8 + Math.random() * 1.6,
    color: PALETTE[i % PALETTE.length],
    twinkle: 4 + Math.random() * 6,
    sway: (Math.random() - 0.5) * 18,
    delay: Math.random() * 0.25,
  }));

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
    const id = setInterval(() => setStepIndex((i) => (i + 1) % steps.length), 1100);
    return () => clearInterval(id);
  }, [steps.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0;
    let width = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      width = r.width;
      h = r.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let particles = makeParticles();
    let lastCycle = -1;
    const start = performance.now();

    const rimGradient = (t: number, alpha: number) => {
      const g = ctx.createLinearGradient(0, 0, width, 0);
      // Los "bultos" de color se desplazan con el tiempo
      const shift = (t * 0.18) % 1;
      PALETTE.forEach((c, i) => {
        const off = (i / PALETTE.length + shift) % 1;
        g.addColorStop(off, c + Math.round(alpha * 255).toString(16).padStart(2, "0"));
      });
      g.addColorStop(0, PALETTE[0] + Math.round(alpha * 255).toString(16).padStart(2, "0"));
      g.addColorStop(1, PALETTE[0] + Math.round(alpha * 255).toString(16).padStart(2, "0"));
      return g;
    };

    // Curva del frente: el centro va adelante (más arriba), los bordes atrás; respira con el tiempo
    const frontPath = (y: number, amp: number, t: number) => {
      ctx.beginPath();
      const segs = 48;
      for (let i = 0; i <= segs; i++) {
        const x = (i / segs) * width;
        const u = (x - width / 2) / (width / 2);
        const lump = Math.sin(u * 3.4 + t * 2.2) * amp * 0.18;
        const yy = y + amp * u * u + lump;
        if (i === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
    };

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const cycle = Math.floor(t / CYCLE);
      const p = (t % CYCLE) / CYCLE;
      if (cycle !== lastCycle) {
        lastCycle = cycle;
        particles = makeParticles();
      }
      ctx.clearRect(0, 0, width, h);

      const amp = Math.min(46, h * 0.3);
      const travel = easeInOut(Math.min(1, p / 0.9));
      const y = h + amp * 0.2 - travel * (h + amp * 1.6);
      const fade = p < 0.06 ? p / 0.06 : p > 0.88 ? Math.max(0, (1 - p) / 0.12) : 1;

      // Estela: lo que ya cruzó la onda queda teñido suavemente
      const wake = ctx.createLinearGradient(0, y, 0, h);
      wake.addColorStop(0, `rgba(90,190,255,${0.24 * fade})`);
      wake.addColorStop(1, "rgba(90,190,255,0)");
      ctx.fillStyle = wake;
      frontPath(y, amp, t);
      ctx.lineTo(width, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // Borde iridiscente: capas anchas y difusas + línea fina blanca
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const layers: [number, number][] = [
        [60, 0.14],
        [34, 0.26],
        [16, 0.5],
        [6, 0.85],
      ];
      for (const [w, a] of layers) {
        ctx.lineWidth = w;
        ctx.strokeStyle = rimGradient(t, a * fade);
        frontPath(y + w * 0.2, amp, t);
        ctx.stroke();
      }
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * fade})`;
      frontPath(y, amp, t);
      ctx.stroke();

      // Partículas que salen del origen (abajo al centro), se abren y se apagan
      for (const pt of particles) {
        const life = (p - pt.delay) / 0.75;
        if (life <= 0 || life >= 1) continue;
        const dist = easeOut(life) * pt.speed * h * 1.15;
        const px = width / 2 + Math.cos(pt.angle) * dist * (width / h) * 0.55 + Math.sin(life * 6 + pt.sway) * pt.sway * 0.4;
        const py = h + 6 + Math.sin(pt.angle) * dist;
        const tw = 0.55 + 0.45 * Math.sin(t * pt.twinkle + pt.sway);
        ctx.globalAlpha = (1 - life) * tw * fade;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(px, py, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };

    if (reduce) {
      // Sin animación: un brillo quieto a media altura
      const tt = 0.6;
      ctx.clearRect(0, 0, width, h);
      ctx.lineWidth = 14;
      ctx.strokeStyle = rimGradient(tt, 0.35);
      frontPath(h * 0.45, Math.min(40, h * 0.25), tt);
      ctx.stroke();
    } else {
      raf = requestAnimationFrame(draw);
    }
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
      aria-label={label}
      className={cn("relative overflow-hidden rounded-2xl border border-border/60 bg-card", className)}
      style={{ height }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <div className="relative flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
        <p className="shimmer-text text-[14px] font-semibold tracking-[-0.01em]">{label}</p>
        <div className="h-4 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {current && (
              <motion.p
                key={current}
                className="text-[12px] text-muted-foreground"
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
  );
};

export default WaveLoader;
