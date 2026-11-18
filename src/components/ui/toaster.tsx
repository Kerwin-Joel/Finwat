"use client"

import { AlertCircle, Check } from "lucide-react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

// Notificaciones: ícono que dice de qué se trata (check verde / alerta), texto en blanco
// sobre marino o rojo, y deslizar hacia arriba para cerrarlas.
export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider swipeDirection="up" duration={5000}>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const error = variant === "destructive"
        return (
          <Toast key={id} variant={variant} duration={error ? 7000 : 5000} {...props}>
            <span
              className={
                error
                  ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20"
                  : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300"
              }
              aria-hidden="true"
            >
              {error ? <AlertCircle className="h-5 w-5" /> : <Check className="h-5 w-5" strokeWidth={2.6} />}
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
