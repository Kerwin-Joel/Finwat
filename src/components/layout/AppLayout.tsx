import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import SideNav from "./SideNav";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import useAuthStore from "@/stores/authStore";
import useCategoryStore from "@/stores/categoryStore";
import { pageVariants } from "@/lib/motion";

const AppLayout = () => {
  const location = useLocation();
  const reduce = useReducedMotion();
  const { user } = useAuthStore();
  const { loadCustomCategories } = useCategoryStore();

  useEffect(() => {
    if (user?.id) loadCustomCategories(user.id);
  }, [user?.id]);

  // Páginas con layout propio de escritorio usan todo el ancho; el resto, una columna cómoda
  const wide = location.pathname === "/" || location.pathname.startsWith("/investments");

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background pb-28 text-foreground md:pb-10 md:pl-[84px] lg:pl-[248px]">
      <SideNav />
      <div
        className={`relative mx-auto min-h-[80dvh] max-w-md ${
          wide ? "md:max-w-3xl lg:max-w-6xl" : "md:max-w-2xl"
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={location.pathname}
            variants={reduce ? undefined : pageVariants}
            initial={reduce ? { opacity: 0 } : "initial"}
            animate={reduce ? { opacity: 1 } : "enter"}
            exit={reduce ? { opacity: 0 } : "exit"}
            className="px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pt-8 lg:px-10"
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
