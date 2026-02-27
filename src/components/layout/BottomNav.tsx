import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Receipt, Zap, Wallet, User } from 'lucide-react';
import { ROUTES } from '../../constants/routes';

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { icon: Home, label: 'Home', path: ROUTES.HOME },
        { icon: Receipt, label: 'Movimientos', path: ROUTES.TRANSACTIONS },
        { icon: Zap, label: 'Servicios', path: ROUTES.SERVICES },
        { icon: Wallet, label: 'Cuentas', path: ROUTES.ACCOUNTS },
        { icon: User, label: 'Perfil', path: ROUTES.PROFILE },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-t border-border pb-safe">
            <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? 'text-primary' : 'text-muted-foreground'
                                }`}
                        >
                            <div className="relative">
                                <item.icon className="w-6 h-6" />
                                {isActive && (
                                    <motion.div
                                        layoutId="nav-pill"
                                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                                        initial={false}
                                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                    />
                                )}
                            </div>
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default BottomNav;
