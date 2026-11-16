import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import useAuthStore from "../stores/authStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useToast } from "../hooks/use-toast";
import PhoneInputField from "../components/ui/phone-input";
import "react-phone-number-input/style.css";
import { isValidPhoneNumber } from "react-phone-number-input";
import AuthShell from "@/components/layout/AuthShell";
import { getAuthErrorMessage } from "@/lib/authErrors";
import { resendConfirmation } from "@/api/authService";

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
          Toma el
          <br />
          control hoy
        </>
      }
      subtitle="Crea tu cuenta gratis y empieza a ordenar tus gastos, recordatorios e inversiones en un solo lugar."
    >
        <Card className="shadow-float">
          {pendingEmail ? (
            <>
              <CardHeader>
                <CardTitle>Confirma tu correo</CardTitle>
                <CardDescription>Solo falta un paso para activar tu cuenta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-center py-4">
                <div className="flex justify-center">
                  <div className="bg-green-500/10 p-4 rounded-full">
                    <MailCheck className="h-8 w-8 text-green-500" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enviamos un enlace de confirmación a{" "}
                  <span className="font-medium text-foreground">{pendingEmail}</span>.
                  Ábrelo para activar tu cuenta y luego inicia sesión.
                </p>
              </CardContent>
              <CardFooter className="flex flex-col space-y-3">
                <Button className="w-full" onClick={() => navigate("/login")}>
                  Ir a iniciar sesión
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={handleResend}
                  disabled={isResending}
                >
                  {isResending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Reenviar correo"
                  )}
                </Button>
              </CardFooter>
            </>
          ) : (
          <>
          <CardHeader>
            <CardTitle>Crear cuenta</CardTitle>
            <CardDescription>Completa tus datos para comenzar</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit} noValidate>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input
                  id="name"
                  placeholder="Juan Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Celular</Label>
                <PhoneInputField
                  value={phone}
                  onChange={(val) => setPhone(val)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {formError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg"
                >
                  <span>⚠️</span>
                  <span>{formError}</span>
                </motion.div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  "Registrarse"
                )}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                ¿Ya tienes una cuenta?{" "}
                <Link
                  to="/login"
                  className="text-primary hover:underline font-medium"
                >
                  Inicia sesión
                </Link>
              </div>
            </CardFooter>
          </form>
          </>
          )}
        </Card>
    </AuthShell>
  );
};

export default Register;
