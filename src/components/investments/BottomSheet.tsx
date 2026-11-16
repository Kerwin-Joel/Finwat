import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                className={cn(
                  "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl border border-b-0 border-border bg-background shadow-2xl focus:outline-none",
                  className,
                )}
                initial={reduce ? { opacity: 0 } : { y: "100%" }}
                animate={reduce ? { opacity: 1 } : { y: 0 }}
                exit={reduce ? { opacity: 0 } : { y: "100%" }}
                transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 36 }}
                drag={reduce ? false : "y"}
                dragControls={controls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.7 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 120 || info.velocity.y > 600) onOpenChange(false);
                }}
              >
                <div
                  className="cursor-grab touch-none px-5 pb-2 pt-3 active:cursor-grabbing"
                  onPointerDown={(e) => controls.start(e)}
                >
                  <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />
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
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
                {footer && (
                  <div className="border-t border-border/60 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                    {footer}
                  </div>
                )}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
};

export default BottomSheet;
