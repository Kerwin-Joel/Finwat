// Estallido de onda al confirmar: el frente sale del botón hacia afuera en dos anillos con
// partículas. Se dibuja en un canvas fijo sobre toda la app (debajo de los toasts), así se
// ve aunque el modal del botón se cierre en ese mismo momento.
//
// `await celebrate()` primero espera a que la onda del botón se haya visto un mínimo
// (MIN_WAVE_MS desde que empezó a cargar): si el servidor responde en 200 ms, el usuario
// igual percibe que la operación ocurrió. Luego lanza el estallido y sigue el flujo.
import { WAVE_PALETTE, WAVE_PALETTE_LIGHT, easeOutCubic, makeParticles, prefersReducedMotion, rimGradient } from "./waves";

const DURATION = 1400;
const REACH = 80; // px que crece el anillo (contenido, no invade la pantalla)
const MIN_WAVE_MS = 700;

// Último ConfirmButton que empezó a cargar: celebrate() sin argumentos sale de ahí.
let lastEl: HTMLElement | null = null;
let lastRect: DOMRect | null = null;
let loadingSince = 0;

export const registerConfirmSource = (el: HTMLElement | null) => {
  lastEl = el;
  lastRect = el?.getBoundingClientRect() ?? null;
  loadingSince = performance.now();
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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const burst = (rect: DOMRect) => {
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
  const particles = makeParticles(20, 0, Math.PI * 2);
  const start = performance.now();

  // Un anillo: el contorno del botón crece hacia afuera y se desvanece
  const ring = (p: number, t: number, strength: number) => {
    if (p <= 0 || p >= 1) return;
    const grow = easeOutCubic(p) * REACH;
    const fade = Math.pow(1 - p, 1.6) * strength;
    const x = rect.left - grow;
    const y = rect.top - grow * 0.7;
    const w = rect.width + grow * 2;
    const h = rect.height + grow * 1.4;
    const radius = rect.height / 2 + grow * 0.7;
    ctx.lineJoin = "round";
    const layers: [number, number, string[]][] = [
      [22, 0.08, WAVE_PALETTE],
      [12, 0.16, WAVE_PALETTE],
      [5, 0.32, WAVE_PALETTE],
      [1.5, 0.55, WAVE_PALETTE_LIGHT],
    ];
    for (const [lw, a, pal] of layers) {
      ctx.lineWidth = lw * (1 - p * 0.45);
      ctx.strokeStyle = rimGradient(ctx, x, y, x + w, y + h, t, a * fade, pal);
      roundedRect(ctx, x, y, w, h, radius);
      ctx.stroke();
    }
  };

  const frame = (now: number) => {
    const p = Math.min(1, (now - start) / DURATION);
    const t = (now - start) / 1000;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Destello al centro, solo al inicio
    if (p < 0.3) {
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rect.width * 0.75);
      glow.addColorStop(0, `rgba(0,122,255,${0.12 * (1 - p / 0.3)})`);
      glow.addColorStop(1, "rgba(0,122,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - rect.width, cy - rect.width, rect.width * 2, rect.width * 2);
    }

    ring(p / 0.9, t, 1);
    ring((p - 0.18) / 0.82, t, 0.3); // eco del anillo, muy tenue

    // Partículas desde el borde del botón hacia afuera
    for (const pt of particles) {
      const life = (p - pt.delay * 0.6) / 0.85;
      if (life <= 0 || life >= 1) continue;
      const dist = easeOutCubic(life) * pt.speed * REACH * 1.1;
      const ox = Math.cos(pt.angle) * (rect.width / 2);
      const oy = Math.sin(pt.angle) * (rect.height / 2);
      const px = cx + ox + Math.cos(pt.angle) * dist;
      const py = cy + oy + Math.sin(pt.angle) * dist + life * life * 18;
      ctx.globalAlpha = (1 - life) * (0.6 + 0.4 * Math.sin(t * pt.twinkle + pt.sway)) * 0.5;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(px, py, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (p < 1) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
};

/**
 * Éxito: espera a que la onda del botón se haya visto lo mínimo y lanza el estallido desde
 * `target` (o desde el último ConfirmButton que guardó algo). Usar con `await` antes de
 * cerrar el modal o pasar a la pantalla de éxito.
 */
export const celebrate = async (target?: HTMLElement | DOMRect | null) => {
  if (typeof document === "undefined" || prefersReducedMotion()) return;
  const wait = MIN_WAVE_MS - (performance.now() - loadingSince);
  if (loadingSince && wait > 0 && wait <= MIN_WAVE_MS) await sleep(wait);
  const rect = resolveRect(target);
  if (!rect || rect.width === 0) return;
  burst(rect);
};

/** Solo espera a que la onda del botón se vea lo mínimo (sin estallido; p. ej. al eliminar) */
export const holdWave = async () => {
  if (typeof document === "undefined" || prefersReducedMotion()) return;
  const wait = MIN_WAVE_MS - (performance.now() - loadingSince);
  if (loadingSince && wait > 0 && wait <= MIN_WAVE_MS) await sleep(wait);
};
