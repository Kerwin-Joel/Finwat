import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { registerConfirmSource } from "@/lib/celebrate"
import { WAVE_PALETTE_LIGHT, easeInOutCubic, fitCanvas, makeParticles, rimGradient, strokeRim, traceFront } from "@/lib/waves"

// Botón para guardar o confirmar operaciones. Mientras `loading`, una onda iridiscente
// cruza el botón (sin bajar su opacidad) y el texto pasa a `loadingText`; ignora más toques.
// Al terminar bien, llama a celebrate() (lib/celebrate) y la onda sale disparada del botón.
//
//   <ConfirmButton loading={saving} loadingText="Guardando…" onClick={save}>Guardar</ConfirmButton>

const SWEEP = 1.35 // s por pasada

const ButtonWave = () => {
  const ref = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    let size = fitCanvas(canvas, ctx)
    const ro = new ResizeObserver(() => {
      size = fitCanvas(canvas, ctx)
    })
    ro.observe(canvas)

    let particles = makeParticles(14, 0, 1.4, WAVE_PALETTE_LIGHT)
    let lastCycle = -1
    const start = performance.now()
    let raf = 0

    const draw = (now: number) => {
      const { width: w, height: h } = size
      const t = (now - start) / 1000
      const cycle = Math.floor(t / SWEEP)
      const p = (t % SWEEP) / SWEEP
      if (cycle !== lastCycle) {
        lastCycle = cycle
        particles = makeParticles(14, 0, 1.4, WAVE_PALETTE_LIGHT)
      }
      ctx.clearRect(0, 0, w, h)

      const amp = Math.min(18, h * 0.42)
      const x = -amp + easeInOutCubic(p) * (w + amp * 2.4)
      const fade = p < 0.08 ? p / 0.08 : p > 0.9 ? (1 - p) / 0.1 : 1

      // Estela: lo que ya cruzó la onda queda iluminado
      const wake = ctx.createLinearGradient(0, 0, x, 0)
      wake.addColorStop(0, "rgba(126,196,255,0)")
      wake.addColorStop(1, `rgba(214,230,255,${0.3 * fade})`)
      ctx.fillStyle = wake
      traceFront(ctx, "horizontal", x, h, amp, t)
      ctx.lineTo(0, h)
      ctx.lineTo(0, 0)
      ctx.closePath()
      ctx.fill()

      strokeRim(
        ctx,
        (shift) => traceFront(ctx, "horizontal", x - shift, h, amp, t),
        (a) => rimGradient(ctx, 0, 0, 0, h, t, a, WAVE_PALETTE_LIGHT),
        fade,
        Math.max(0.35, h / 64),
        0.8,
      )

      for (const pt of particles) {
        const life = (p - pt.delay) / 0.7
        if (life <= 0 || life >= 1) continue
        const px = x - 4 + Math.cos(pt.angle) * life * pt.speed * 46
        const py = h / 2 + Math.sin(pt.angle) * life * pt.speed * h * 0.9
        ctx.globalAlpha = (1 - life) * fade
        ctx.fillStyle = pt.color
        ctx.beginPath()
        ctx.arc(px, py, pt.size * 0.9, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <motion.canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    />
  )
}

export interface ConfirmButtonProps extends ButtonProps {
  /** Muestra la onda y bloquea el botón */
  loading?: boolean
  /** Texto mientras carga (por defecto, el mismo contenido) */
  loadingText?: React.ReactNode
}

const ConfirmButton = React.forwardRef<HTMLButtonElement, ConfirmButtonProps>(
  ({ loading = false, loadingText, children, className, disabled, onClick, ...props }, ref) => {
    const reduce = useReducedMotion()
    const innerRef = React.useRef<HTMLButtonElement | null>(null)
    const setRefs = (el: HTMLButtonElement | null) => {
      innerRef.current = el
      if (typeof ref === "function") ref(el)
      else if (ref) ref.current = el
    }

    React.useEffect(() => {
      if (loading) registerConfirmSource(innerRef.current)
    }, [loading])

    const busyLabel = loadingText ?? children

    return (
      <Button
        ref={setRefs}
        {...props}
        // Mientras carga queda deshabilitado (tampoco reenvía el formulario con Enter) pero a color
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        onClick={(e) => {
          if (loading) {
            e.preventDefault()
            return
          }
          onClick?.(e)
        }}
        className={cn("relative isolate overflow-hidden", loading && "disabled:opacity-100", className)}
      >
        {loading && !reduce && <ButtonWave />}
        {/* Ambos textos ocupan la misma celda: el ancho no salta al cambiar */}
        <span className="relative grid place-items-center">
          <motion.span
            className="col-start-1 row-start-1 inline-flex items-center gap-2"
            aria-hidden={loading || undefined}
            initial={false}
            animate={{ opacity: loading ? 0 : 1, y: loading && !reduce ? -6 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.span>
          <motion.span
            className="col-start-1 row-start-1 inline-flex items-center gap-2"
            aria-hidden={!loading || undefined}
            initial={false}
            animate={{ opacity: loading ? 1 : 0, y: loading || reduce ? 0 : 6 }}
            transition={{ duration: 0.2 }}
          >
            {busyLabel}
          </motion.span>
        </span>
      </Button>
    )
  },
)
ConfirmButton.displayName = "ConfirmButton"

export { ConfirmButton }
