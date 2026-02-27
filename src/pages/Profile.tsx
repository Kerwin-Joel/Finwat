import { LogOut, Settings, HelpCircle, CreditCard, Camera, Edit2, Lock, Palette } from 'lucide-react';
import { useState } from 'react';
import useAuthStore from '../stores/authStore';
import useAccountStore from '../stores/accountStore';
import useTransactionStore from '../stores/transactionStore';
import useThemeStore from '../stores/themeStore';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import EditProfileModal from '../components/EditProfileModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import ProfilePhotoModal from '../components/ProfilePhotoModal';
import HelpSupportModal from '../components/HelpSupportModal';
import CategorySettingsModal from '../components/CategorySettingsModal';

// Preset color palette for custom theme
const PRESET_COLORS = [
    // Light backgrounds
    { name: 'Púrpura Claro', primary: '262 83% 58%', background: '260 20% 98%', foreground: '260 25% 10%', variant: 'light' },
    { name: 'Azul Claro', primary: '221 83% 53%', background: '220 20% 98%', foreground: '220 25% 10%', variant: 'light' },
    { name: 'Verde Claro', primary: '142 76% 36%', background: '140 20% 98%', foreground: '140 25% 10%', variant: 'light' },
    { name: 'Naranja Claro', primary: '25 95% 53%', background: '25 20% 98%', foreground: '25 25% 10%', variant: 'light' },
    { name: 'Rosa Claro', primary: '330 81% 60%', background: '330 20% 98%', foreground: '330 25% 10%', variant: 'light' },
    { name: 'Turquesa Claro', primary: '189 94% 43%', background: '190 20% 98%', foreground: '190 25% 10%', variant: 'light' },
    { name: 'Rojo Claro', primary: '0 72% 51%', background: '0 20% 98%', foreground: '0 25% 10%', variant: 'light' },
    { name: 'Amarillo Claro', primary: '45 93% 47%', background: '45 20% 98%', foreground: '45 25% 10%', variant: 'light' },
    { name: 'Índigo Claro', primary: '239 84% 67%', background: '240 20% 98%', foreground: '240 25% 10%', variant: 'light' },
    { name: 'Esmeralda Claro', primary: '160 84% 39%', background: '160 20% 98%', foreground: '160 25% 10%', variant: 'light' },
    // Dark backgrounds
    { name: 'Púrpura Oscuro', primary: '262 83% 58%', background: '260 10% 8%', foreground: '0 0% 98%', variant: 'dark' },
    { name: 'Azul Oscuro', primary: '221 83% 53%', background: '220 10% 8%', foreground: '0 0% 98%', variant: 'dark' },
    { name: 'Verde Oscuro', primary: '142 76% 36%', background: '140 10% 8%', foreground: '0 0% 98%', variant: 'dark' },
    { name: 'Naranja Oscuro', primary: '25 95% 53%', background: '25 10% 8%', foreground: '0 0% 98%', variant: 'dark' },
    { name: 'Rosa Oscuro', primary: '330 81% 60%', background: '330 10% 8%', foreground: '0 0% 98%', variant: 'dark' },
    { name: 'Turquesa Oscuro', primary: '189 94% 43%', background: '190 10% 8%', foreground: '0 0% 98%', variant: 'dark' },
    { name: 'Rojo Oscuro', primary: '0 72% 51%', background: '0 10% 8%', foreground: '0 0% 98%', variant: 'dark' },
    { name: 'Amarillo Oscuro', primary: '45 93% 47%', background: '45 10% 8%', foreground: '0 0% 98%', variant: 'dark' },
    { name: 'Índigo Oscuro', primary: '239 84% 67%', background: '240 10% 8%', foreground: '0 0% 98%', variant: 'dark' },
    { name: 'Esmeralda Oscuro', primary: '160 84% 39%', background: '160 10% 8%', foreground: '0 0% 98%', variant: 'dark' },
];

const Profile = () => {
    const { user, logout } = useAuthStore();
    const { accounts } = useAccountStore();
    const { transactions } = useTransactionStore();
    const { theme, setTheme, customColors, setCustomColors } = useThemeStore();

    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [isProfilePhotoOpen, setIsProfilePhotoOpen] = useState(false);
    const [isHelpSupportOpen, setIsHelpSupportOpen] = useState(false);
    const [isCategorySettingsOpen, setIsCategorySettingsOpen] = useState(false);

    if (!user) return null;

    return (
        <div className="space-y-6 pt-2 pb-20">
            <h1 className="text-2xl font-bold">Mi Perfil</h1>

            <div className="flex flex-col items-center space-y-4 py-6">
                <div className="relative group">
                    <Avatar className="h-24 w-24 border-4 border-card shadow-xl">
                        <AvatarImage src={user.photoUrl} />
                        <AvatarFallback className="text-2xl">{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <button
                        onClick={() => setIsProfilePhotoOpen(true)}
                        className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:scale-110 transition-transform"
                        aria-label="Cambiar foto de perfil"
                    >
                        <Camera className="h-4 w-4" />
                    </button>
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-bold">{user.name}</h2>
                    <p className="text-muted-foreground">{user.email}</p>
                    {user.phone && <p className="text-sm text-muted-foreground">{user.phone}</p>}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditProfileOpen(true)}
                    className="mt-2"
                >
                    <Edit2 className="mr-2 h-4 w-4" />
                    Editar Perfil
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <span className="text-xs text-muted-foreground">Cuentas Activas</span>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="flex items-center space-x-2">
                            <CreditCard className="h-5 w-5 text-primary" />
                            <span className="text-2xl font-bold">{accounts.length}</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <span className="text-xs text-muted-foreground">Movimientos</span>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="flex items-center space-x-2">
                            <Settings className="h-5 w-5 text-primary" />
                            <span className="text-2xl font-bold">{transactions.length}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">Apariencia</h3>
                <div className="grid grid-cols-3 gap-2">
                    <Button
                        variant={theme === 'light' ? 'default' : 'outline'}
                        onClick={() => setTheme('light')}
                        className="w-full"
                    >
                        Claro
                    </Button>
                    <Button
                        variant={theme === 'dark' ? 'default' : 'outline'}
                        onClick={() => setTheme('dark')}
                        className="w-full"
                    >
                        Oscuro
                    </Button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={theme === 'custom' ? 'default' : 'outline'}
                                className="w-full"
                            >
                                Personal
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-medium leading-none mb-3">Personalizar Tema</h4>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Selecciona tu combinación de colores favorita
                                    </p>
                                </div>

                                {/* Light Variants */}
                                <div>
                                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Temas Claros</h5>
                                    <div className="grid grid-cols-5 gap-2">
                                        {PRESET_COLORS.filter(c => c.variant === 'light').map((color) => (
                                            <button
                                                key={color.name}
                                                className="w-full aspect-square rounded-md border-2 hover:scale-110 transition-transform relative overflow-hidden"
                                                style={{
                                                    borderColor: customColors.primary === color.primary && customColors.background === color.background
                                                        ? 'hsl(var(--foreground))'
                                                        : 'transparent'
                                                }}
                                                onClick={() => {
                                                    setCustomColors({ primary: color.primary, background: color.background, foreground: color.foreground });
                                                    setTheme('custom');
                                                }}
                                                title={color.name}
                                            >
                                                <div className="absolute inset-0" style={{ backgroundColor: `hsl(${color.background})` }} />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: `hsl(${color.primary})` }} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Dark Variants */}
                                <div>
                                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Temas Oscuros</h5>
                                    <div className="grid grid-cols-5 gap-2">
                                        {PRESET_COLORS.filter(c => c.variant === 'dark').map((color) => (
                                            <button
                                                key={color.name}
                                                className="w-full aspect-square rounded-md border-2 hover:scale-110 transition-transform relative overflow-hidden"
                                                style={{
                                                    borderColor: customColors.primary === color.primary && customColors.background === color.background
                                                        ? 'hsl(var(--foreground))'
                                                        : 'transparent'
                                                }}
                                                onClick={() => {
                                                    setCustomColors({ primary: color.primary, background: color.background, foreground: color.foreground });
                                                    setTheme('custom');
                                                }}
                                                title={color.name}
                                            >
                                                <div className="absolute inset-0" style={{ backgroundColor: `hsl(${color.background})` }} />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: `hsl(${color.primary})` }} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">Configuración</h3>

                <Button
                    variant="ghost"
                    className="w-full justify-start h-auto py-3 px-4"
                    onClick={() => setIsChangePasswordOpen(true)}
                >
                    <div className="flex items-start flex-col text-left w-full">
                        <div className="flex items-center w-full">
                            <Lock className="mr-3 h-5 w-5" />
                            <span>Cambiar Contraseña</span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-8">Actualiza tu contraseña de acceso</span>
                    </div>
                </Button>
                <Separator />
                <Button
                    variant="ghost"
                    className="w-full justify-start h-auto py-3 px-4"
                    onClick={() => setIsCategorySettingsOpen(true)}
                >
                    <div className="flex items-start flex-col text-left w-full">
                        <div className="flex items-center w-full">
                            <Palette className="mr-3 h-5 w-5" />
                            <span>Personalizar Categorías</span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-8">Editar los iconos de las categorías</span>
                    </div>
                </Button>
                <Separator />
                <Button
                    variant="ghost"
                    className="w-full justify-start h-auto py-3 px-4"
                    onClick={() => setIsHelpSupportOpen(true)}
                >
                    <div className="flex items-start flex-col text-left w-full">
                        <div className="flex items-center w-full">
                            <HelpCircle className="mr-3 h-5 w-5" />
                            <span>Ayuda y Soporte</span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-8">FAQ, guía de usuario y contacto</span>
                    </div>
                </Button>
            </div>

            <div className="pt-6">
                <Button variant="destructive" className="w-full" onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
                </Button>
            </div>

            {/* Modals */}
            <EditProfileModal
                isOpen={isEditProfileOpen}
                onClose={() => setIsEditProfileOpen(false)}
            />
            <ChangePasswordModal
                isOpen={isChangePasswordOpen}
                onClose={() => setIsChangePasswordOpen(false)}
            />
            <ProfilePhotoModal
                isOpen={isProfilePhotoOpen}
                onClose={() => setIsProfilePhotoOpen(false)}
            />
            <HelpSupportModal
                isOpen={isHelpSupportOpen}
                onClose={() => setIsHelpSupportOpen(false)}
            />
            <CategorySettingsModal
                isOpen={isCategorySettingsOpen}
                onClose={() => setIsCategorySettingsOpen(false)}
            />
        </div>
    );
};

export default Profile;
