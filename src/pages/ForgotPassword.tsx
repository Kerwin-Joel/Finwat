import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
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
import { supabase } from "../lib/supabase";
import FinwatLogo from "../assets/FinwatLogo";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo enviar el correo",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <FinwatLogo size={72} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-2">
            Finwat
          </h1>
          <p className="text-sm font-medium bg-gradient-to-r from-[#00F5FF] to-[#3B82F6] bg-clip-text text-transparent tracking-wide drop-shadow-[0_0_8px_rgba(0,245,255,0.5)]">
            Descubre a dónde se va tu dinero.
          </p>
        </div>

        <Card className="border-border/50 shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Recuperar contraseña</CardTitle>
            <CardDescription>
              Te enviaremos un correo para restablecer tu contraseña
            </CardDescription>
          </CardHeader>

          {sent ? (
            <CardContent className="space-y-4 text-center py-6">
              <div className="flex justify-center">
                <div className="bg-green-500/10 p-4 rounded-full">
                  <Mail className="h-8 w-8 text-green-500" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Enviamos un correo a{" "}
                <span className="font-medium text-foreground">{email}</span>.
                Revisa tu bandeja de entrada y sigue las instrucciones.
              </p>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
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
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Enviar correo"
                  )}
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>

        <div className="text-center mt-4">
          <Link
            to="/login"
            className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
          >
            <ArrowLeft size={14} />
            Volver al inicio de sesión
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
