import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import FinwatLogo from "@/assets/FinwatLogo";

const SplashScreen = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/");
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-6">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
      >
        <FinwatLogo size={100} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="text-4xl font-bold tracking-tight text-primary"
      >
        Finwat
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        className="text-sm font-medium bg-gradient-to-r from-[#00F5FF] to-[#3B82F6] bg-clip-text text-transparent tracking-wide drop-shadow-[0_0_8px_rgba(0,245,255,0.5)]"
      >
        Descubre a dónde se va tu dinero.
      </motion.p>

      <motion.div
        className="absolute bottom-16 w-32 h-1 bg-muted rounded-full overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-[#00F5FF] to-[#3B82F6] rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ delay: 0.9, duration: 1.4, ease: "easeInOut" }}
        />
      </motion.div>
    </div>
  );
};

export default SplashScreen;
