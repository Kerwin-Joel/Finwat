import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Wallet,
  MessageCircle,
  BarChart2,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { Button } from "./ui/button";

const ONBOARDING_KEY = "finwat_onboarding_done";

const steps = [
  {
    icon: <Wallet size={48} className="text-primary" />,
    title: "¡Bienvenido a FinWat! 👋",
    description:
      "Tu gestor financiero personal. Registra tus ingresos y gastos en segundos, desde la app o por WhatsApp.",
    action: null,
  },
  {
    icon: <span className="text-6xl">💸</span>,
    title: "Registra un movimiento",
    description:
      'Toca el botón verde "+" en la pantalla principal. Ingresa el monto, descripción, categoría y fecha. ¡Listo!',
    action: {
      label: "Entendido, lo haré",
      hint: "Confirma que entendiste cómo registrar un movimiento",
    },
  },
  {
    icon: <MessageCircle size={48} className="text-green-500" />,
    title: "Usa WhatsApp 📱",
    description:
      'También puedes registrar movimientos escribiéndole a FinWat por WhatsApp. Ejemplo: "Gasté 50 soles en taxi" y lo registramos automáticamente.',
    action: {
      label: "Genial, lo usaré",
      hint: "Confirma que entendiste cómo usar WhatsApp",
    },
  },
  {
    icon: <BarChart2 size={48} className="text-blue-500" />,
    title: "Revisa tu balance 📊",
    description:
      'En la pantalla principal verás tu balance actualizado con tus ingresos y gastos. En "Movimientos" puedes filtrar, buscar y editar cualquier registro.',
    action: {
      label: "Perfecto, entendido",
      hint: "Confirma que entendiste cómo ver tu balance",
    },
  },
  {
    icon: <Shield size={48} className="text-purple-500" />,
    title: "Tus datos están seguros 🔒",
    description:
      "Tu información financiera es privada y solo tú puedes verla. FinWat usa encriptación de nivel bancario para proteger tus datos.",
    action: null,
  },
];

const OnboardingModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) setIsOpen(true);
  }, []);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const requiresConfirmation = !!step.action;

  const handleNext = () => {
    if (requiresConfirmation && !confirmed) return;
    setConfirmed(false);
    if (isLast) {
      localStorage.setItem(ONBOARDING_KEY, "true");
      setIsOpen(false);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setConfirmed(false);
    setCurrentStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl relative"
        >
          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? "w-6 bg-primary"
                    : i < currentStep
                      ? "w-3 bg-primary/50"
                      : "w-3 bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="text-center space-y-4 mb-6"
            >
              <div className="flex justify-center">{step.icon}</div>
              <h2 className="text-xl font-bold">{step.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Confirmation checkbox */}
          {requiresConfirmation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <button
                onClick={() => setConfirmed(!confirmed)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  confirmed
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground"
                }`}
              >
                <CheckCircle2
                  size={20}
                  className={
                    confirmed ? "text-primary" : "text-muted-foreground"
                  }
                />
                <span className="text-sm font-medium text-left">
                  {step.action?.label}
                </span>
              </button>
              {!confirmed && (
                <p className="text-xs text-muted-foreground mt-1.5 text-center">
                  {step.action?.hint}
                </p>
              )}
            </motion.div>
          )}

          {/* Navigation */}
          <div className="flex gap-3">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-none"
              >
                <ChevronLeft size={16} />
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={requiresConfirmation && !confirmed}
              className="flex-1 gap-1"
            >
              {isLast ? "¡Empezar!" : "Siguiente"}
              {!isLast && <ChevronRight size={16} />}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingModal;
