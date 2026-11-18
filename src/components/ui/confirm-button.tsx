import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { registerConfirmSource } from "@/lib/celebrate"
import { WAVE_PALETTE, WAVE_PALETTE_LIGHT, easeInOutCubic, fitCanvas, makeParticles, rimGradient, strokeRim, traceFront } from "@/lib/waves"

// Botón para todo lo que genera una petición (guardar, confirmar, eliminar, enviar…).
// Mientras carga, una onda de luz de marca cruza el botón (sin bajar su opacidad), el texto
// pasa a `loadingText` y se ignoran más toques. Con "reducir movimiento" la onda se queda
// quieta y solo respira (sin desplazamiento).
//
// Dos formas de uso:
//   controlado:  <ConfirmButton loading={saving} loadingText="Guardando…" onClick={save}>Guardar</ConfirmButton>
//   automático:  <ConfirmButton loadingText="Eliminando…" onClick={async () => { await borrar() }}>Eliminar</ConfirmButton>
//                (si onClick devuelve una promesa y no pasas `loading`, el botón carga solo)

const SWEEP = 1.5 // s por pasada
const START_AT = 0.12 // arranca con el frente ya dentro del botón: se ve desde el primer instante
const MIN_AUTO_MS = 800 // en modo automático, la onda dura al menos esto

// tone "light": sobre botones de color (marino, azul, rojo) → onda luminosa.
// tone "brand": sobre botones claros (outline, ghost, secondary) → onda en azul de marca.
const ButtonWave = ({ calm, tone }: { calm: boolean; tone: "light" | "brand" }) => {
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

    const palette = tone === "brand" ? WAVE_PALETTE : WAVE_PALETTE_LIGHT
    const glow = tone === "brand" ? "0,122,255" : "214,230,255"
    const glowSoft = tone === "brand" ? "0,170,255" : "126,196,255"
    let particles = makeParticles(8, 0, 1.2, palette)
    let lastCycle = -1
    const start = performance.now() - START_AT * SWEEP * 1000
    let raf = 0

    const draw = (now: number) => {
      const { width: w, height: h } = size
      const t = (now - start) / 1000
      ctx.clearRect(0, 0, w, h)

      // Brillo de fondo inmediato: el botón "se enciende" apenas empieza a cargar
      const pulse = 0.5 + 0.5 * Math.sin(t * (calm ? 3.2 : 4.2))
      const base = ctx.createLinearGradient(0, 0, w, 0)
      base.addColorStop(0, `rgba(${glowSoft},${0.05 + 0.05 * pulse})`)
      base.addColorStop(0.5, `rgba(${glow},${0.08 + 0.07 * pulse})`)
      base.addColorStop(1, `rgba(${glowSoft},${0.05 + 0.05 * pulse})`)
      ctx.fillStyle = base
      ctx.fillRect(0, 0, w, h)

      if (!calm) {
        const cycle = Math.floor(t / SWEEP)
        const p = (t % SWEEP) / SWEEP
        if (cycle !== lastCycle) {
          lastCycle = cycle
          particles = makeParticles(8, 0, 1.2, palette)
        }
        const amp = Math.min(12, h * 0.3)
        const x = -amp * 0.5 + easeInOutCubic(p) * (w + amp * 2)
        const fade = p > 0.88 ? (1 - p) / 0.12 : 1

        // Estela: lo que ya cruzó la onda queda iluminado
        const wake = ctx.createLinearGradient(Math.max(0, x - w * 0.6), 0, x, 0)
        wake.addColorStop(0, `rgba(${glow},0)`)
        wake.addColorStop(1, `rgba(${glow},${(tone === "brand" ? 0.14 : 0.26) * fade})`)
        ctx.fillStyle = wake
        traceFront(ctx, "horizontal", x, h, amp, t)
        ctx.lineTo(0, h)
        ctx.lineTo(0, 0)
        ctx.closePath()
        ctx.fill()

        strokeRim(
          ctx,
          (shift) => traceFront(ctx, "horizontal", x - shift, h, amp, t),
          (a) => rimGradient(ctx, 0, 0, 0, h, t, a, palette),
          fade,
          Math.max(0.45, h / 52),
          tone === "brand" ? 0.35 : 0.85,
          tone === "brand" ? 1.5 : 1.8,
        )

        for (const pt of particles) {
          const life = (p - pt.delay) / 0.7
          if (life <= 0 || life >= 1) continue
          const px = x - 4 + Math.cos(pt.angle) * life * pt.speed * 46
          const py = h / 2 + Math.sin(pt.angle) * life * pt.speed * h * 0.9
          ctx.globalAlpha = (1 - life) * fade * 0.85
          ctx.fillStyle = pt.color
          ctx.beginPath()
          ctx.arc(px, py, pt.size, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [calm, tone])

  return (
    <motion.canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    />
  )
}

const isThenable = (v: unknown): v is PromiseLike<unknown> =>
  !!v && typeof (v as { then?: unknown }).then === "function"

export interface ConfirmButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Controlado: muestra la onda y bloquea el botón. Si no se pasa, carga solo con onClick async */
  loading?: boolean
  /** Texto mientras carga (por defecto, el mismo contenido) */
  loadingText?: React.ReactNode
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => unknown
}

const ConfirmButton = React.forwardRef<HTMLButtonElement, ConfirmButtonProps>(
  ({ loading, loadingText, children, className, disabled, onClick, ...props }, ref) => {
    const reduce = !!useReducedMotion()
    const innerRef = React.useRef<HTMLButtonElement | null>(null)
    const [autoLoading, setAutoLoading] = React.useState(false)
    const mounted = React.useRef(true)
    React.useEffect(
      () => () => {
        mounted.current = false
      },
      [],
    )
    const isLoading = loading ?? autoLoading

    const setRefs = (el: HTMLButtonElement | null) => {
      innerRef.current = el
      if (typeof ref === "function") ref(el)
      else if (ref) ref.current = el
    }

    React.useEffect(() => {
      if (isLoading) registerConfirmSource(innerRef.current)
    }, [isLoading])

    const busyLabel = loadingText ?? children

    return (
      <Button
        ref={setRefs}
        {...props}
        // Mientras carga queda deshabilitado (tampoco reenvía el formulario con Enter) pero a color
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        onClick={(e) => {
          if (isLoading) {
            e.preventDefault()
            return
          }
          const result = onClick?.(e)
          if (loading === undefined && isThenable(result)) {
            setAutoLoading(true)
            const started = performance.now()
            Promise.resolve(result).finally(() => {
              // Mínimo visible para que una respuesta rápida igual muestre la onda
              const left = MIN_AUTO_MS - (performance.now() - started)
              setTimeout(() => {
                if (mounted.current) setAutoLoading(false)
              }, Math.max(0, left))
            })
          }
        }}
        className={cn("relative isolate overflow-hidden", isLoading && "disabled:opacity-100", className)}
      >
        {isLoading && (
          <ButtonWave
            calm={reduce}
            tone={props.variant && ["outline", "ghost", "secondary", "link"].includes(props.variant) ? "brand" : "light"}
          />
        )}
        {/* Ambos textos ocupan la misma celda: el ancho no salta al cambiar */}
        <span className="relative grid place-items-center">
          <motion.span
            className="col-start-1 row-start-1 inline-flex items-center gap-2"
            aria-hidden={isLoading || undefined}
            initial={false}
            animate={{ opacity: isLoading ? 0 : 1, y: isLoading && !reduce ? -3 : 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.span>
          <motion.span
            className="col-start-1 row-start-1 inline-flex items-center gap-2"
            aria-hidden={!isLoading || undefined}
            initial={false}
            animate={{ opacity: isLoading ? 1 : 0, y: isLoading || reduce ? 0 : 3 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
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
