import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Home, Receipt, Zap, Wallet, User, TrendingUp } from 'lucide-react';
import { ROUTES } from '../../constants/routes';
import { SPRING_SOFT } from '@/lib/motion';

// Barra flotante tipo píldora: la sección activa se expande con su etiqueta y la
// cápsula marina se desliza entre ítems (layoutId).
const navItems = [
    { icon: Home, label: 'Inicio', path: ROUTES.HOME },
    { icon: Receipt, label: 'Movimientos', path: ROUTES.TRANSACTIONS },
    { icon: TrendingUp, label: 'Inversiones', path: ROUTES.INVESTMENTS },
    { icon: Zap, label: 'Servicios', path: ROUTES.SERVICES },
    { icon: Wallet, label: 'Análisis', path: ROUTES.ACCOUNTS },
    { icon: User, label: 'Perfil', path: ROUTES.PROFILE },
];

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const reduce = useReducedMotion();
    const transition = reduce ? { duration: 0 } : SPRING_SOFT;

    return (
        <nav
            aria-label="Navegación principal"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
        >
            <LayoutGroup id="bottom-nav">
                <motion.ul
                    layout
                    transition={transition}
                    className="pointer-events-auto mx-auto flex h-16 max-w-md items-center justify-between gap-1 rounded-full border border-border/70 bg-card/85 px-2 shadow-float backdrop-blur-xl supports-[backdrop-filter]:bg-card/70"
                >
                    {navItems.map((item) => {
                        const isActive =
                            item.path === ROUTES.HOME
                                ? location.pathname === item.path
                                : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                        return (
                            <motion.li
                                key={item.path}
                                layout
                                transition={transition}
                                className="min-w-0 basis-0"
                                // la píldora activa crece según el largo de su etiqueta
                                style={{ flexGrow: isActive ? 1 + item.label.length * 0.17 : 1 }}
                            >
                                <button
                                    type="button"
                                    onClick={() => navigate(item.path)}
                                    aria-label={item.label}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={`relative flex h-12 w-full min-w-0 items-center justify-center gap-1.5 rounded-full px-2.5 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring ${
                                        isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {isActive && (
                                        <motion.span
                                            layoutId="nav-active"
                                            transition={transition}
                                            className="absolute inset-0 rounded-full bg-primary"
                                        />
                                    )}
                                    <item.icon className="relative h-[19px] w-[19px] shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                                    {isActive && (
                                        <motion.span
                                            key={item.path}
                                            initial={reduce ? false : { opacity: 0, x: -4 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.25, delay: reduce ? 0 : 0.08 }}
                                            className="relative min-w-0 truncate text-[11.5px] font-medium tracking-[-0.015em]"
                                        >
                                            {item.label}
                                        </motion.span>
                                    )}
                                </button>
                            </motion.li>
                        );
                    })}
                </motion.ul>
            </LayoutGroup>
        </nav>
    );
};

export default BottomNav;
