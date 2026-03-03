import { useState } from "react";
import { Plus, PenLine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";

const WhatsAppIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-5 h-5 fill-white"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.11 1.522 5.83L.044 23.956l6.305-1.654A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.371l-.36-.214-3.732.979 1.001-3.648-.235-.374A9.818 9.818 0 1112 21.818z" />
  </svg>
);

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_BOT_NUMBER;

interface FABButtonProps {
  onClick: () => void;
}

const fabOptions = [
  {
    id: "whatsapp",
    label: "Registrar por WhatsApp",
    icon: <WhatsAppIcon />,
    className: "bg-[#25D366] hover:bg-[#1ebe5d] shadow-green-900/30",
    pulse: "bg-[#25D366]/30",
  },
  {
    id: "manual",
    label: "Agregar manualmente",
    icon: <PenLine className="w-5 h-5 text-white" />,
    className: "bg-green-600 hover:bg-green-700 shadow-green-900/20",
    pulse: "bg-green-500/20",
  },
];

const FABButton: React.FC<FABButtonProps> = ({ onClick }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleManual = () => {
    setIsOpen(false);
    onClick();
  };

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=Hola%20FinWat%2C%20quiero%20registrar%20un%20movimiento`;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3">
        <AnimatePresence>
          {isOpen &&
            fabOptions.map((option, index) => (
              <motion.div
                key={option.id}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 24,
                  delay: (fabOptions.length - index) * 0.05,
                }}
                className="flex items-center gap-3"
              >
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{
                    delay: (fabOptions.length - index) * 0.05 + 0.1,
                  }}
                  className="bg-card border border-border text-foreground text-xs font-medium px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap"
                >
                  {option.label}
                </motion.span>

                <div className="relative">
                  {option.id === "whatsapp" ? (
                    <motion.a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsOpen(false)}
                      className="block"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Button
                        size="icon"
                        className={`h-12 w-12 rounded-full shadow-lg border-0 ${option.className}`}
                      >
                        {option.icon}
                      </Button>
                    </motion.a>
                  ) : (
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Button
                        size="icon"
                        onClick={handleManual}
                        className={`h-12 w-12 rounded-full shadow-lg border-0 ${option.className}`}
                      >
                        {option.icon}
                      </Button>
                    </motion.div>
                  )}
                  <div
                    className={`absolute inset-0 rounded-full animate-ping -z-10 ${option.pulse}`}
                  />
                </div>
              </motion.div>
            ))}
        </AnimatePresence>

        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="relative"
        >
          <Button
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            className="h-14 w-14 rounded-full bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20 border-0"
          >
            <motion.div
              animate={{ rotate: isOpen ? 45 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Plus className="h-8 w-8 text-white" />
            </motion.div>
          </Button>
          <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping -z-10" />
        </motion.div>
      </div>
    </>
  );
};

export default FABButton;
