import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { EASE_OUT } from "@/lib/motion";

// Bottom sheet accesible (Radix Dialog: foco atrapado, Esc, aria) con spring y
// arrastrar hacia abajo para cerrar desde la manija o el encabezado.

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

const BottomSheet = ({ open, onOpenChange, title, description, children, footer, className }: BottomSheetProps) => {
  const reduce = useReducedMotion();
  const controls = useDragControls();
  // Tablet y escritorio: modal centrado (sin arrastre); móvil: hoja inferior
  const desktop = useIsDesktop();

  const motionProps = desktop
    ? {
        initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 },
        animate: reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 },
        exit: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 },
        transition: reduce ? { duration: 0.15 } : { duration: 0.32, ease: EASE_OUT },
      }
    : {
        initial: reduce ? { opacity: 0 } : { y: "100%" },
        animate: reduce ? { opacity: 1 } : { y: 0 },
        exit: reduce ? { opacity: 0 } : { y: "100%" },
        transition: reduce ? { duration: 0.15 } : { type: "spring" as const, stiffness: 380, damping: 36 },
        drag: reduce ? false : ("y" as const),
        dragControls: controls,
        dragListener: false,
        dragConstraints: { top: 0, bottom: 0 },
        dragElastic: { top: 0, bottom: 0.7 },
        onDragEnd: (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onOpenChange(false);
        },
      };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-[#050a1c]/60 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              />
            </DialogPrimitive.Overlay>
            <div
              className={cn(
                "pointer-events-none fixed inset-0 z-50 flex",
                desktop ? "items-center justify-center p-6" : "items-end justify-center",
              )}
            >
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                className={cn(
                  "pointer-events-auto flex w-full flex-col border border-border bg-background shadow-2xl focus:outline-none",
                  desktop
                    ? "max-h-[86dvh] max-w-lg rounded-3xl"
                    : "max-h-[92dvh] max-w-md rounded-t-2xl border-b-0",
                  className,
                )}
                {...motionProps}
              >
                <div
                  className={cn("px-5 pb-2 pt-3", !desktop && "cursor-grab touch-none active:cursor-grabbing", desktop && "px-6 pt-5")}
                  onPointerDown={desktop ? undefined : (e) => controls.start(e)}
                >
                  {!desktop && <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <DialogPrimitive.Title className="text-[21px] font-bold tracking-[-0.03em]">{title}</DialogPrimitive.Title>
                      {description ? (
                        <DialogPrimitive.Description className="text-sm text-muted-foreground">
                          {description}
                        </DialogPrimitive.Description>
                      ) : (
                        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
                      )}
                    </div>
                    <DialogPrimitive.Close
                      className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Cerrar"
                    >
                      <X className="h-5 w-5" />
                    </DialogPrimitive.Close>
                  </div>
                </div>
                <div className={cn("flex-1 overflow-y-auto overscroll-contain px-5 pb-4", desktop && "px-6 pb-6")}>{children}</div>
                {footer && (
                  <div className={cn("border-t border-border/60 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3", desktop && "px-6 pb-5")}>
                    {footer}
                  </div>
                )}
              </motion.div>
            </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
};

export default BottomSheet;
