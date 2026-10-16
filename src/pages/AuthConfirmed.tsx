import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, MailWarning, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import FinwatLogo from "@/assets/FinwatLogo";
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
import { getAuthErrorMessage } from "@/lib/authErrors";
import { resendConfirmation } from "@/api/authService";

type Status = "loading" | "success" | "confirmed" | "expired" | "error";

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_BOT_NUMBER as string | undefined;

// Supabase devuelve el error en el hash (#error_code=...) o en la query (?error_code=...)
const readAuthError = () => {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  return {
    code: hash.get("error_code") ?? query.get("error_code"),
    description: hash.get("error_description") ?? query.get("error_description"),
  };
};

// Leer al cargar el módulo: supabase-js procesa el enlace y limpia la URL
// antes de que el componente se monte
const initialAuthError =
  window.location.pathname === "/auth/confirmed" ? readAuthError() : { code: null, description: null };

const AuthConfirmed = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const resolve = async () => {
      // initialize() espera a que supabase-js procese el token/código del enlace y devuelve su error
      const { error: initError } = await supabase.auth.initialize();
      const urlError = readAuthError();
      const errorCode =
        initialAuthError.code ??
        urlError.code ??
        (initError as { details?: { code?: string } } | null)?.details?.code ??
        (initError ? "unknown" : null);

      if (errorCode) {
        setStatus(errorCode === "otp_expired" ? "expired" : "error");
      } else {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setName(data.session.user.user_metadata?.name?.split(" ")[0] ?? "");
          setStatus("success");
        } else {
          // El correo ya quedó confirmado, pero el enlace se abrió en otro navegador
          setStatus("confirmed");
        }
      }
      // Quitar tokens y errores de la URL
      window.history.replaceState(null, "", window.location.pathname);
    };

    resolve();
  }, []);

  const handleResend = async () => {
    if (!email.trim()) return;
    setIsResending(true);
    try {
      await resendConfirmation(email.trim());
      toast({
        title: "Te enviamos un nuevo enlace",
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

  const whatsappUrl = WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${encodeURIComponent("Hola Finwat 👋")}`
    : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-2 flex items-center justify-center gap-1">
            <FinwatLogo size={40} />
            inwat
          </h1>
          <p className="text-sm font-medium bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Descubre a dónde se va tu dinero.
          </p>
        </div>

        <Card className="border-border/50 shadow-xl bg-card/50 backdrop-blur-sm">
          {status === "loading" && (
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Confirmando tu cuenta…</p>
            </CardContent>
          )}

          {(status === "success" || status === "confirmed") && (
            <>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    className="bg-green-500/10 p-4 rounded-full"
                  >
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                  </motion.div>
                </div>
                <CardTitle>
                  {status === "success" && name ? `¡Listo, ${name}!` : "¡Cuenta confirmada!"}
                </CardTitle>
                <CardDescription>
                  {status === "success"
                    ? "Tu correo está verificado y tu cuenta ya está activa."
                    : "Tu correo está verificado. Inicia sesión para empezar."}
                </CardDescription>
              </CardHeader>
              {status === "success" && whatsappUrl && (
                <CardContent>
                  <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Siguiente paso</p>
                    Escríbele al bot de Finwat por WhatsApp y registra tu primer gasto, por ejemplo:{" "}
                    <span className="italic">"almuerzo 15"</span>.
                  </div>
                </CardContent>
              )}
              <CardFooter className="flex flex-col space-y-3">
                {status === "success" ? (
                  <>
                    <Button className="w-full" onClick={() => navigate("/", { replace: true })}>
                      Ir a mi cuenta
                    </Button>
                    {whatsappUrl && (
                      <Button variant="outline" className="w-full" asChild>
                        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Abrir WhatsApp
                        </a>
                      </Button>
                    )}
                  </>
                ) : (
                  <Button className="w-full" onClick={() => navigate("/login", { replace: true })}>
                    Iniciar sesión
                  </Button>
                )}
              </CardFooter>
            </>
          )}

          {(status === "expired" || status === "error") && (
            <>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-2">
                  <div className="bg-amber-500/10 p-4 rounded-full">
                    <MailWarning className="h-10 w-10 text-amber-500" />
                  </div>
                </div>
                <CardTitle>
                  {status === "expired" ? "Este enlace ya venció" : "No pudimos confirmar tu cuenta"}
                </CardTitle>
                <CardDescription>
                  {status === "expired"
                    ? "Por seguridad, los enlaces vencen y solo sirven una vez. Pide uno nuevo con tu correo:"
                    : "El enlace no es válido. Pide uno nuevo con tu correo:"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </CardContent>
              <CardFooter className="flex flex-col space-y-3">
                <Button className="w-full" onClick={handleResend} disabled={isResending || !email.trim()}>
                  {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar nuevo enlace"}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate("/login", { replace: true })}>
                  Ya confirmé, iniciar sesión
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default AuthConfirmed;
