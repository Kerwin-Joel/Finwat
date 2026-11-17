// Estallido de onda al confirmar: el frente iridiscente sale del botón hacia afuera con
// partículas. Se dibuja en un canvas fijo sobre toda la app (debajo de los toasts), así se
// ve aunque el modal del botón se cierre en ese mismo momento.
import { easeOutCubic, makeParticles, prefersReducedMotion, rimGradient } from "./waves";

const DURATION = 1000;
const REACH = 150; // px que crece el anillo

// Último ConfirmButton que empezó a cargar: celebrate() sin argumentos sale de ahí.
let lastEl: HTMLElement | null = null;
let lastRect: DOMRect | null = null;

export const registerConfirmSource = (el: HTMLElement | null) => {
  lastEl = el;
  lastRect = el?.getBoundingClientRect() ?? null;
};

const resolveRect = (target?: HTMLElement | DOMRect | null): DOMRect | null => {
  if (target instanceof DOMRect) return target;
  if (target) return target.getBoundingClientRect();
  if (lastEl?.isConnected) {
    const r = lastEl.getBoundingClientRect();
    if (r.width > 0) return r;
  }
  return lastRect;
};

const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
};

/** Lanza la onda desde `target` (o desde el último ConfirmButton que guardó algo) */
export const celebrate = (target?: HTMLElement | DOMRect | null) => {
  if (typeof document === "undefined" || prefersReducedMotion()) return;
  const rect = resolveRect(target);
  if (!rect || rect.width === 0) return;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "90",
  } as CSSStyleDeclaration);
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const particles = makeParticles(56, 0, Math.PI * 2);
  const start = performance.now();

  const frame = (now: number) => {
    const p = Math.min(1, (now - start) / DURATION);
    const t = (now - start) / 1000;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Anillo: el contorno del botón crece hacia afuera y se desvanece
    const grow = easeOutCubic(p) * REACH;
    const fade = Math.pow(1 - p, 1.4);
    const x = rect.left - grow;
    const y = rect.top - grow * 0.7;
    const w = rect.width + grow * 2;
    const h = rect.height + grow * 1.4;
    const radius = rect.height / 2 + grow * 0.7;
    ctx.lineJoin = "round";
    const layers: [number, number][] = [
      [30, 0.16],
      [16, 0.3],
      [7, 0.6],
      [2.5, 0.9],
    ];
    for (const [lw, a] of layers) {
      ctx.lineWidth = lw * (1 - p * 0.5);
      ctx.strokeStyle = rimGradient(ctx, x, y, x + w, y + h, t, a * fade);
      roundedRect(ctx, x, y, w, h, radius);
      ctx.stroke();
    }
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = `rgba(255,255,255,${0.85 * fade})`;
    roundedRect(ctx, x, y, w, h, radius);
    ctx.stroke();

    // Destello suave al centro, solo al inicio
    if (p < 0.35) {
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rect.width * 0.7);
      glow.addColorStop(0, `rgba(126,196,255,${0.35 * (1 - p / 0.35)})`);
      glow.addColorStop(1, "rgba(126,196,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - rect.width, cy - rect.width, rect.width * 2, rect.width * 2);
    }

    // Partículas desde el borde del botón hacia afuera
    for (const pt of particles) {
      const life = (p - pt.delay * 0.6) / 0.85;
      if (life <= 0 || life >= 1) continue;
      const dist = easeOutCubic(life) * pt.speed * REACH * 1.25;
      const ox = Math.cos(pt.angle) * (rect.width / 2);
      const oy = Math.sin(pt.angle) * (rect.height / 2);
      const px = cx + ox + Math.cos(pt.angle) * dist;
      const py = cy + oy + Math.sin(pt.angle) * dist + life * life * 18;
      ctx.globalAlpha = (1 - life) * (0.55 + 0.45 * Math.sin(t * pt.twinkle + pt.sway));
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(px, py, pt.size * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (p < 1) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
};
