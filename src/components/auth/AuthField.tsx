import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Campo "relleno" de las pantallas de acceso: etiqueta pequeña dentro de la caja,
// sin borde, con anillo azul suave al enfocar.

export const FieldBox = ({
  label,
  htmlFor,
  trailing,
  children,
  invalid,
}: {
  label: string;
  htmlFor?: string;
  trailing?: ReactNode;
  children: ReactNode;
  invalid?: boolean;
}) => (
  <div
    className={cn(
      "flex items-center gap-3 rounded-2xl bg-secondary px-4 py-2.5 ring-1 ring-transparent transition-[box-shadow,background-color] duration-200 ease-out-expo",
      "focus-within:bg-card focus-within:ring-2 focus-within:ring-brand/35",
      invalid && "ring-destructive/50",
    )}
  >
    <div className="min-w-0 flex-1">
      <label htmlFor={htmlFor} className="block text-[11.5px] font-medium text-muted-foreground">
        {label}
      </label>
      <div className="mt-0.5">{children}</div>
    </div>
    {trailing}
  </div>
);

export const AuthInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full bg-transparent text-[15px] font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/60",
        className,
      )}
      {...props}
    />
  ),
);
AuthInput.displayName = "AuthInput";
