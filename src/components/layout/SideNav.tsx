import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  DollarSign,
  Home,
  LogOut,
  Receipt,
  TrendingUp,
  User,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import FinwatLogo from "@/assets/FinwatLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import useAuthStore from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { SPRING_SOFT } from "@/lib/motion";

// Navegación lateral para tablet (riel de íconos, md) y escritorio (barra completa, lg).
const MAIN: { icon: LucideIcon; label: string; path: string }[] = [
  { icon: Home, label: "Inicio", path: "/" },
  { icon: Receipt, label: "Movimientos", path: "/transactions" },
  { icon: TrendingUp, label: "Inversiones", path: "/investments" },
  { icon: Zap, label: "Servicios", path: "/services" },
  { icon: Wallet, label: "Análisis", path: "/accounts" },
];
const MORE: { icon: LucideIcon; label: string; path: string }[] = [
  { icon: Bell, label: "Recordatorios", path: "/reminders" },
  { icon: DollarSign, label: "Préstamos", path: "/loans" },
];

const isActivePath = (pathname: string, path: string) =>
  path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);

const Item = ({ icon: Icon, label, path }: { icon: LucideIcon; label: string; path: string }) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const reduce = useReducedMotion();
    const active = isActivePath(pathname, path);
    return (
      <li>
        <button
          type="button"
          onClick={() => navigate(path)}
          title={label}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative flex h-11 w-full items-center justify-center gap-3 rounded-xl text-[14px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring lg:justify-start lg:px-3.5",
            active ? "text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {active && (
            <motion.span
              layoutId="side-active"
              transition={reduce ? { duration: 0 } : SPRING_SOFT}
              className="absolute inset-0 rounded-xl bg-primary"
            />
          )}
          <Icon className="relative h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
          <span className="relative hidden lg:inline">{label}</span>
        </button>
      </li>
    );
};

const SideNav = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  return (
    <aside
      aria-label="Navegación principal"
      className="fixed inset-y-0 left-0 z-40 hidden w-[84px] flex-col border-r border-border/70 bg-card/80 px-3 py-5 backdrop-blur-xl md:flex lg:w-[248px] lg:px-4"
    >
      <button
        type="button"
        onClick={() => navigate("/")}
        className="mb-8 flex items-center justify-center gap-2.5 rounded-xl py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:justify-start lg:px-2"
        aria-label="Finwat, ir al inicio"
      >
        <FinwatLogo size={28} />
        <span className="hidden text-[18px] font-bold tracking-[-0.03em] lg:inline">Finwat</span>
      </button>

      <LayoutGroup id="side-nav">
        <nav className="flex-1 space-y-6 overflow-y-auto">
          <ul className="space-y-1">
            {MAIN.map((i) => (
              <Item key={i.path} {...i} />
            ))}
          </ul>
          <div>
            <p className="eyebrow mb-2 hidden px-3.5 text-muted-foreground lg:block">Más</p>
            <div className="mx-auto mb-2 h-px w-8 bg-border lg:hidden" aria-hidden="true" />
            <ul className="space-y-1">
              {MORE.map((i) => (
                <Item key={i.path} {...i} />
              ))}
            </ul>
          </div>
        </nav>

        <div className="space-y-1 border-t border-border/70 pt-4">
          <ul>
            <Item icon={User} label="Perfil" path="/profile" />
          </ul>
          <div className="hidden items-center gap-3 rounded-xl px-2 py-2 lg:flex">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.photoUrl} />
              <AvatarFallback className="bg-primary text-[13px] font-semibold text-primary-foreground">
                {user?.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{user?.name}</p>
              <p className="truncate text-[11.5px] text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="flex h-11 w-full items-center justify-center gap-3 rounded-xl text-[14px] font-medium text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring lg:justify-start lg:px-3.5"
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span className="hidden lg:inline">Cerrar sesión</span>
          </button>
        </div>
      </LayoutGroup>
    </aside>
  );
};

export default SideNav;
