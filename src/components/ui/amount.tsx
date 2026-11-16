import { useEffect, useRef, useState } from "react"
import { animate, useReducedMotion } from "framer-motion"
import { cn } from "@/utils"

// Monto grande con jerarquía tipográfica (símbolo pequeño, enteros grandes, decimales
// atenuados) que cuenta suavemente hasta su valor cuando cambia.

const SYMBOL: Record<string, string> = { PEN: "S/", USD: "US$", EUR: "€" }

const split = (value: number) => {
  const fixed = Math.abs(value).toFixed(2)
  const [int, dec] = fixed.split(".")
  return {
    sign: value < 0 ? "−" : "",
    int: Number(int).toLocaleString("es-PE"),
    dec,
  }
}

interface AmountProps {
  value: number
  currency?: string
  hidden?: boolean
  className?: string
  symbolClassName?: string
  decimalsClassName?: string
}

export function Amount({
  value,
  currency = "PEN",
  hidden,
  className,
  symbolClassName,
  decimalsClassName,
}: AmountProps) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? value : 0)
  const from = useRef(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      from.current = value
      return
    }
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(v),
    })
    from.current = value
    return () => controls.stop()
  }, [value, reduce])

  const v = split(reduce ? value : shown)
  return (
    <span className={cn("num inline-flex items-baseline whitespace-nowrap", className)} aria-label={hidden ? "Monto oculto" : undefined}>
      <span className={cn("mr-1 text-[0.45em] font-medium opacity-70", symbolClassName)}>{SYMBOL[currency] ?? currency}</span>
      {hidden ? (
        <span aria-hidden="true">••••••</span>
      ) : (
        <>
          <span>
            {v.sign}
            {v.int}
          </span>
          <span className={cn("text-[0.55em] opacity-60", decimalsClassName)}>.{v.dec}</span>
        </>
      )}
    </span>
  )
}
