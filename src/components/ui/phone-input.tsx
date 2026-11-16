import { forwardRef } from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "../../lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const CustomInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>((props, ref) => (
  <input
    {...props}
    ref={ref}
    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
  />
));

CustomInput.displayName = "CustomInput";

// Variante sin caja: para campos "rellenos" donde el contenedor ya dibuja el fondo
const BareInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>((props, ref) => (
  <input
    {...props}
    ref={ref}
    className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60"
  />
));

BareInput.displayName = "BareInput";

const PhoneInputField = ({ value, onChange, className, bare, id }: PhoneInputProps & { bare?: boolean; id?: string }) => {
  return (
    <PhoneInput
      id={id}
      international
      defaultCountry="PE"
      value={value}
      onChange={(val) => onChange(val ?? "")}
      className={cn("flex gap-2", bare && "items-center", className)}
      inputComponent={bare ? BareInput : CustomInput}
    />
  );
};

export default PhoneInputField;
