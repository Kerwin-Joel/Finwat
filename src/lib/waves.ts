// Motor de ondas de Finwat (canvas 2D, sin dependencias). Inspirado en las transiciones
// "distortion waves": un frente curvo con borde iridiscente que respira, estela suave y
// partículas que saltan del origen. Lo usan WaveLoader, ConfirmButton y celebrate().

export const WAVE_PALETTE = ["#ffc915", "#7ec4ff", "#b428e6", "#eb64a0", "#ffb07a", "#9aa0ff", "#7fd9ee"];

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3.2);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const hexAlpha = (a: number) =>
  Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0");

/** Degradado iridiscente a lo largo de una línea; los "bultos" de color se desplazan con t */
export const rimGradient = (
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t: number,
  alpha: number,
) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  const shift = (t * 0.18) % 1;
  const a = hexAlpha(alpha);
  WAVE_PALETTE.forEach((c, i) => g.addColorStop((i / WAVE_PALETTE.length + shift) % 1, c + a));
  g.addColorStop(0, WAVE_PALETTE[0] + a);
  g.addColorStop(1, WAVE_PALETTE[0] + a);
  return g;
};

/**
 * Traza el frente de onda. vertical: avanza hacia arriba (pos = y); horizontal: avanza hacia
 * la derecha (pos = x). El centro va adelante y los bordes atrás; ondula con el tiempo.
 */
export const traceFront = (
  ctx: CanvasRenderingContext2D,
  orientation: "vertical" | "horizontal",
  pos: number,
  span: number,
  amp: number,
  t: number,
) => {
  ctx.beginPath();
  const segs = 40;
  for (let i = 0; i <= segs; i++) {
    const s = (i / segs) * span;
    const u = (s - span / 2) / (span / 2);
    const lump = Math.sin(u * 3.4 + t * 2.2) * amp * 0.18;
    const off = amp * u * u + lump;
    const x = orientation === "vertical" ? s : pos - off;
    const y = orientation === "vertical" ? pos + off : s;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
};

/** Capas del borde: anchas y difusas → finas e intensas, y una línea blanca encima */
export const strokeRim = (
  ctx: CanvasRenderingContext2D,
  draw: (shift: number) => void,
  gradient: (alpha: number) => CanvasGradient,
  fade: number,
  scale = 1,
  hairline = 0.9,
) => {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const layers: [number, number][] = [
    [60, 0.14],
    [34, 0.26],
    [16, 0.5],
    [6, 0.85],
  ];
  for (const [w, a] of layers) {
    ctx.lineWidth = w * scale;
    ctx.strokeStyle = gradient(a * fade);
    draw(w * scale * 0.2);
    ctx.stroke();
  }
  if (hairline > 0) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(255,255,255,${hairline * fade})`;
    draw(0);
    ctx.stroke();
  }
};

export interface WaveParticle {
  angle: number;
  speed: number;
  size: number;
  color: string;
  twinkle: number;
  sway: number;
  delay: number;
}

/** Partículas en abanico alrededor de `direction` (radianes) con apertura `spread` */
export const makeParticles = (count: number, direction = -Math.PI / 2, spread = 1.9): WaveParticle[] =>
  Array.from({ length: count }, (_, i) => ({
    angle: direction + (Math.random() - 0.5) * spread,
    speed: 0.35 + Math.random() * 0.65,
    size: 0.8 + Math.random() * 1.6,
    color: WAVE_PALETTE[i % WAVE_PALETTE.length],
    twinkle: 4 + Math.random() * 6,
    sway: (Math.random() - 0.5) * 18,
    delay: Math.random() * 0.25,
  }));

/** Ajusta el canvas al tamaño CSS con devicePixelRatio; devuelve el tamaño en px CSS */
export const fitCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: r.width, height: r.height };
};

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
