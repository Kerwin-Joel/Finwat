import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import { motion, AnimatePresence } from "framer-motion";

const AppLayout = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 relative overflow-hidden">
      <div className="max-w-md mx-auto min-h-[80dvh] relative">
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-4"
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
