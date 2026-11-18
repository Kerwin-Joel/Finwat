import * as React from "react"
import { useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  WAVE_PALETTE,
  easeInOutCubic,
  fitCanvas,
  makeParticles,
  rimGradient,
  strokeRim,
  traceFront,
} from "@/lib/waves"

// Revela un contenido con la onda de marca, como en la referencia: el frente sube desde
// abajo (desde donde estaba el botón) y lo que queda detrás ya es el resultado. Se usa en
// las pantallas de éxito (aporte registrado, pago registrado, correo enviado…).
// Con movimiento reducido muestra el contenido directo.

const DURATION = 1300

const WaveReveal = ({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  /** ms antes de empezar */
  delay?: number
}) => {
  const reduce = useReducedMotion()
  const contentRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [done, setDone] = React.useState(!!reduce)

  React.useEffect(() => {
    if (reduce) return
    const canvas = canvasRef.current
    const content = contentRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || !content) return
    const size = fitCanvas(canvas, ctx)
    const particles = makeParticles(12)
    let raf = 0
    let start = 0

    const frame = (now: number) => {
      if (!start) start = now + delay
      const p = Math.max(0, Math.min(1, (now - start) / DURATION))
      const t = (now - start) / 1000
      const { width: w, height: h } = size
      const amp = Math.min(22, h * 0.14)
      const y = h + amp - easeInOutCubic(p) * (h + amp * 2.6)

      // Lo que ya cruzó la onda queda visible
      const reveal = Math.max(0, Math.min(100, (y / h) * 100))
      content.style.clipPath = `inset(${reveal}% 0 0 0)`
      content.style.opacity = String(Math.min(1, p * 1.8))

      ctx.clearRect(0, 0, w, h)
      const fade = p > 0.85 ? (1 - p) / 0.15 : 1
      const wake = ctx.createLinearGradient(0, y, 0, y + h * 0.6)
      wake.addColorStop(0, `rgba(0,122,255,${0.07 * fade})`)
      wake.addColorStop(1, "rgba(0,122,255,0)")
      ctx.fillStyle = wake
      traceFront(ctx, "vertical", y, w, amp, t)
      ctx.lineTo(w, h)
      ctx.lineTo(0, h)
      ctx.closePath()
      ctx.fill()
      strokeRim(
        ctx,
        (shift) => traceFront(ctx, "vertical", y + shift, w, amp, t),
        (a) => rimGradient(ctx, 0, 0, w, 0, t, a, WAVE_PALETTE),
        fade,
        0.55,
      )
      for (const pt of particles) {
        const life = (p - pt.delay) / 0.7
        if (life <= 0 || life >= 1) continue
        const px = w / 2 + Math.cos(pt.angle) * life * pt.speed * w * 0.55
        const py = h + Math.sin(pt.angle) * life * pt.speed * h * 1.2
        ctx.globalAlpha = (1 - life) * fade * 0.5
        ctx.fillStyle = pt.color
        ctx.beginPath()
        ctx.arc(px, py, pt.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      if (p < 1) raf = requestAnimationFrame(frame)
      else {
        content.style.clipPath = ""
        content.style.opacity = ""
        setDone(true)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [reduce, delay])

  return (
    <div className={cn("relative", className)}>
      <div ref={contentRef} style={done ? undefined : { clipPath: "inset(100% 0 0 0)", opacity: 0 }}>
        {children}
      </div>
      {!done && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      )}
    </div>
  )
}

export { WaveReveal }
