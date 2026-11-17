import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import useAuthStore from "../stores/authStore";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";
import AuthShell from "@/components/layout/AuthShell";
import BottomSheet from "@/components/investments/BottomSheet";
import { AuthInput, FieldBox } from "@/components/auth/AuthField";
import { getAuthErrorMessage, isEmailNotConfirmed } from "@/lib/authErrors";
import { resendConfirmation } from "@/api/authService";
import { EASE_OUT } from "@/lib/motion";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { celebrate } from "@/lib/celebrate";

const Login = () => {
  const [params] = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(params.has("ingresar"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setNeedsConfirmation(false);
    if (!email.trim() || !password) {
      setLoginError("Ingresa tu correo y contraseña.");
      return;
    }

    try {
      await login({ email: email.trim(), password });
      celebrate();
      navigate("/splash");
    } catch (error) {
      setNeedsConfirmation(isEmailNotConfirmed(error));
      setLoginError(getAuthErrorMessage(error, "No se pudo iniciar sesión."));
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await resendConfirmation(email.trim());
      toast({
        title: "Correo reenviado",
        description: `Revisa la bandeja de ${email.trim()}.`,
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

  // El mismo formulario se usa en la hoja (móvil) y en el panel derecho (escritorio)
  const form = (prefix: string, withHeading: boolean) => (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      {withHeading && (
        <div className="mb-6">
          <h2 className="text-[28px] font-bold tracking-[-0.035em]">Hola de nuevo</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">Ingresa con tu correo</p>
        </div>
      )}
      <FieldBox label="Correo" htmlFor={`${prefix}-email`} invalid={!!loginError && !email.trim()}>
        <AuthInput
          id={`${prefix}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="ejemplo@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </FieldBox>
      <FieldBox
        label="Contraseña"
        htmlFor={`${prefix}-password`}
        invalid={!!loginError && !password}
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
          id={`${prefix}-password`}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </FieldBox>

      <div className="flex justify-end">
        <Link to="/forgot-password" className="py-1 text-[12.5px] font-semibold text-brand hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      <AnimatePresence initial={false}>
        {loginError && (
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
              <div>
                <p>{loginError}</p>
                {needsConfirmation && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="mt-1 font-semibold underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {isResending ? "Reenviando…" : "Reenviar correo de confirmación"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmButton type="submit" size="lg" className="mt-2 w-full" loading={isLoading} loadingText="Ingresando…">
        Ingresar
      </ConfirmButton>
      <p className="pt-2 text-center text-[13.5px] text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link to="/register" className="font-semibold text-foreground hover:underline">
          Crear cuenta
        </Link>
      </p>
    </form>
  );

  return (
    <>
      <AuthShell
        fullHero
        title={
          <>
            Tu dinero,
            <br />
            por fin claro.
          </>
        }
        subtitle="Registra por WhatsApp, recibe recordatorios y haz crecer tu capital."
        heroActions={
          <div className="space-y-1.5">
            <Button
              asChild
              size="lg"
              className="w-full bg-white text-[#0b1640] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] hover:bg-white/90"
            >
              <Link to="/register">Crear cuenta</Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="w-full text-white hover:bg-white/10 hover:text-white"
              onClick={() => setSheetOpen(true)}
            >
              Ya tengo cuenta
            </Button>
          </div>
        }
      >
        {form("d", true)}
      </AuthShell>

      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Hola de nuevo" description="Ingresa con tu correo">
        <div className="pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3">{form("m", false)}</div>
      </BottomSheet>
    </>
  );
};

export default Login;
