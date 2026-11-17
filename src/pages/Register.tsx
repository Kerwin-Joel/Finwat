import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import useAuthStore from "../stores/authStore";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";
import { AuthInput, FieldBox } from "@/components/auth/AuthField";
import { EASE_OUT } from "@/lib/motion";
import PhoneInputField from "../components/ui/phone-input";
import "react-phone-number-input/style.css";
import { isValidPhoneNumber } from "react-phone-number-input";
import AuthShell from "@/components/layout/AuthShell";
import { getAuthErrorMessage } from "@/lib/authErrors";
import { resendConfirmation } from "@/api/authService";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { celebrate } from "@/lib/celebrate";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!name.trim() || !email.trim() || !password) {
      setFormError("Completa todos los campos.");
      return;
    }
    if (!phone || !isValidPhoneNumber(phone)) {
      setFormError("Ingresa un número de celular válido.");
      return;
    }
    if (password.length < 6) {
      setFormError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }

    try {
      const formattedPhone = phone.replace("+", "");
      const { needsConfirmation } = await register({
        name: name.trim(),
        email: email.trim(),
        phone: formattedPhone,
        password,
      });
      if (needsConfirmation) {
        setPendingEmail(email.trim());
        return;
      }
      celebrate();
      toast({
        title: "¡Cuenta creada!",
        description: "Bienvenido a FinWat.",
      });
      navigate("/splash");
    } catch (error) {
      setFormError(getAuthErrorMessage(error, "No se pudo crear la cuenta."));
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await resendConfirmation(pendingEmail);
      toast({
        title: "Correo reenviado",
        description: `Revisa la bandeja de ${pendingEmail}.`,
      });
    } catch (error) {
      toast({
        title: "No se pudo reenviar",
        description: getAuthErrorMessage(error, "Intenta de nuevo más tarde."),
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthShell
      title={
        <>
          Empieza a
          <br />
          ordenar tu dinero.
        </>
      }
      subtitle="Crea tu cuenta gratis: gastos, recordatorios e inversiones en un solo lugar."
    >
      <AnimatePresence mode="wait" initial={false}>
        {pendingEmail ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            className="space-y-5 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-positive/10">
              <MailCheck className="h-8 w-8 text-positive" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-[26px] font-bold tracking-[-0.035em]">Confirma tu correo</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                Enviamos un enlace a <span className="font-semibold text-foreground">{pendingEmail}</span>. Ábrelo para
                activar tu cuenta y luego inicia sesión.
              </p>
            </div>
            <div className="space-y-1.5">
              <Button size="lg" className="w-full" onClick={() => navigate("/login?ingresar")}>
                Ir a iniciar sesión
              </Button>
              <Button size="lg" variant="ghost" className="w-full" onClick={handleResend} disabled={isResending}>
                {isResending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Reenviando" /> : "Reenviar correo"}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            noValidate
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
          >
            <div className="mb-5">
              <h2 className="text-[28px] font-bold tracking-[-0.035em]">Crear cuenta</h2>
              <p className="mt-1 text-[14px] text-muted-foreground">Completa tus datos para comenzar</p>
            </div>
            <FieldBox label="Nombre completo" htmlFor="name">
              <AuthInput id="name" autoComplete="name" placeholder="Juan Pérez" value={name} onChange={(e) => setName(e.target.value)} />
            </FieldBox>
            <FieldBox label="Correo" htmlFor="email">
              <AuthInput
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FieldBox>
            <FieldBox label="Celular (el de tu WhatsApp)" htmlFor="phone">
              <PhoneInputField id="phone" bare value={phone} onChange={(val) => setPhone(val)} />
            </FieldBox>
            <FieldBox
              label="Contraseña · mínimo 6 caracteres"
              htmlFor="password"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="shrink-0 rounded-full px-2 py-1 text-[12.5px] font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              }
            >
              <AuthInput
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FieldBox>
            <FieldBox label="Confirmar contraseña" htmlFor="confirmPassword">
              <AuthInput
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </FieldBox>

            <AnimatePresence initial={false}>
              {formError && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                  className="overflow-hidden"
                  role="alert"
                >
                  <div className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>{formError}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <ConfirmButton type="submit" size="lg" className="mt-2 w-full" loading={isLoading} loadingText="Creando tu cuenta…">
              Crear cuenta
            </ConfirmButton>
            <p className="pt-2 text-center text-[13.5px] text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link to="/login?ingresar" className="font-semibold text-foreground hover:underline">
                Inicia sesión
              </Link>
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthShell>
  );
};

export default Register;
