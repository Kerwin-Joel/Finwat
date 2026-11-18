import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
  WAVE_PALETTE,
  easeInOutCubic,
  fitCanvas,
  makeParticles,
  rimGradient,
  strokeRim,
  traceFront,
} from "@/lib/waves"

// Una sola pasada de la onda de marca sobre un elemento (p. ej. la fila del movimiento que
// acabas de agregar): el frente cruza de izquierda a derecha y deja un brillo azul que se
// apaga. Va dentro de un contenedor `relative isolate overflow-hidden` (queda detrás del contenido). Con movimiento reducido
// solo queda el brillo que se desvanece.

const DURATION = 1300

const WaveSweep = ({ delay = 0, onDone }: { delay?: number; onDone?: () => void }) => {
  const reduce = useReducedMotion()
  const ref = React.useRef<HTMLCanvasElement>(null)
  const doneRef = React.useRef(onDone)
  React.useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  React.useEffect(() => {
    if (reduce) {
      const t = setTimeout(() => doneRef.current?.(), delay + 1400)
      return () => clearTimeout(t)
    }
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const size = fitCanvas(canvas, ctx)
    const particles = makeParticles(10, 0, 1.2, WAVE_PALETTE)
    let raf = 0
    let start = 0
    const frame = (now: number) => {
      if (!start) start = now + delay
      const p = Math.max(0, Math.min(1, (now - start) / DURATION))
      const t = (now - start) / 1000
      const { width: w, height: h } = size
      ctx.clearRect(0, 0, w, h)
      if (now >= start) {
        const amp = Math.min(12, h * 0.25)
        const x = -amp + easeInOutCubic(p) * (w + amp * 2.5)
        const fade = p > 0.85 ? (1 - p) / 0.15 : 1
        const wake = ctx.createLinearGradient(Math.max(0, x - w * 0.5), 0, x, 0)
        wake.addColorStop(0, "rgba(0,122,255,0)")
        wake.addColorStop(1, `rgba(0,122,255,${0.12 * fade})`)
        ctx.fillStyle = wake
        traceFront(ctx, "horizontal", x, h, amp, t)
        ctx.lineTo(0, h)
        ctx.lineTo(0, 0)
        ctx.closePath()
        ctx.fill()
        strokeRim(
          ctx,
          (shift) => traceFront(ctx, "horizontal", x - shift, h, amp, t),
          (a) => rimGradient(ctx, 0, 0, 0, h, t, a, WAVE_PALETTE),
          fade,
          Math.max(0.4, h / 60),
          0.4,
          1.4,
        )
        for (const pt of particles) {
          const life = (p - pt.delay) / 0.7
          if (life <= 0 || life >= 1) continue
          ctx.globalAlpha = (1 - life) * fade * 0.7
          ctx.fillStyle = pt.color
          ctx.beginPath()
          ctx.arc(x - 4 + Math.cos(pt.angle) * life * pt.speed * 50, h / 2 + Math.sin(pt.angle) * life * pt.speed * h, pt.size, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }
      if (p < 1) raf = requestAnimationFrame(frame)
      else doneRef.current?.()
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [reduce, delay])

  return (
    <>
      {/* Brillo de fondo que marca la fila y se apaga */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-brand/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 2.2, delay: delay / 1000, times: [0, 0.15, 0.6, 1], ease: "easeInOut" }}
      />
      {!reduce && <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 h-full w-full" />}
    </>
  )
}

export { WaveSweep }
