import { useState } from 'react';
import { RefreshCcw, Image as ImageIcon, Smile } from 'lucide-react';
import { Button } from './ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from './ui/dialog';
import { Input } from './ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'; // Assuming Tabs component exists
import { useToast } from '../hooks/use-toast';
import useCategoryStore from '../stores/categoryStore';
import type { TransactionCategory } from '../types/transaction';

interface CategorySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CategorySettingsModal: React.FC<CategorySettingsModalProps> = ({ isOpen, onClose }) => {
    const { categories, updateCategoryIcon, resetCategories } = useCategoryStore();
    const { toast } = useToast();
    const [editingCategory, setEditingCategory] = useState<TransactionCategory | null>(null);

    // Edit state
    const [newIcon, setNewIcon] = useState('');
    const [iconType, setIconType] = useState<'emoji' | 'image'>('emoji');

    const handleEditStart = (key: TransactionCategory, currentIcon: string, type: 'emoji' | 'image' = 'emoji') => {
        setEditingCategory(key);
        setNewIcon(currentIcon);
        setIconType(type);
    };

    const handleSave = () => {
        if (editingCategory && newIcon) {
            updateCategoryIcon(editingCategory, newIcon, iconType);
            setEditingCategory(null);
            setNewIcon('');
            setIconType('emoji');
            toast({
                title: 'Categoría actualizada',
                description: 'La apariencia de la categoría ha sido actualizada.',
            });
        }
    };

    const handleReset = () => {
        if (confirm('¿Estás seguro de que quieres restablecer todas las categorías a sus valores por defecto?')) {
            resetCategories();
            toast({
                title: 'Categorías restablecidas',
                description: 'Todas las categorías han vuelto a sus valores originales.',
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span>🎨</span>
                        Personalizar Categorías
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={handleReset} className="text-xs">
                            <RefreshCcw className="mr-2 h-3 w-3" />
                            Restablecer Todo
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {(Object.entries(categories) as [TransactionCategory, typeof categories[TransactionCategory]][]).map(([key, config]) => (
                            <div key={key} className="flex flex-col p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-background border overflow-hidden relative"
                                            style={{ borderColor: config.color }}
                                        >
                                            {config.type === 'image' ? (
                                                <img
                                                    src={config.icon}
                                                    alt={config.label}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=?&background=random'; // Fallback
                                                    }}
                                                />
                                            ) : (
                                                <span>{config.icon}</span>
                                            )}
                                        </div>
                                        <span className="font-medium">{config.label}</span>
                                    </div>

                                    {editingCategory !== key && (
                                        <Button variant="ghost" size="sm" onClick={() => handleEditStart(key, config.icon, config.type)}>
                                            Editar
                                        </Button>
                                    )}
                                </div>

                                {editingCategory === key && (
                                    <div className="mt-4 p-3 bg-secondary/30 rounded-md">
                                        <Tabs value={iconType} onValueChange={(v) => setIconType(v as 'emoji' | 'image')} className="w-full">
                                            <TabsList className="grid w-full grid-cols-2 mb-3">
                                                <TabsTrigger value="emoji">
                                                    <Smile className="mr-2 h-4 w-4" /> Emoji
                                                </TabsTrigger>
                                                <TabsTrigger value="image">
                                                    <ImageIcon className="mr-2 h-4 w-4" /> Imagen URL
                                                </TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="emoji" className="mt-0">
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={newIcon}
                                                        onChange={(e) => setNewIcon(e.target.value)}
                                                        className="text-center text-lg"
                                                        placeholder="Emoji"
                                                        maxLength={2}
                                                        autoFocus
                                                    />
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    Usa el selector de emojis de tu teclado (Win + . o Cmd + Ctrl + Espacio)
                                                </p>
                                            </TabsContent>

                                            <TabsContent value="image" className="mt-0">
                                                <div className="space-y-3">
                                                    <Input
                                                        value={newIcon}
                                                        onChange={(e) => setNewIcon(e.target.value)}
                                                        placeholder="https://ejemplo.com/icono.png"
                                                        className="text-sm"
                                                        autoFocus
                                                    />
                                                    {newIcon && (
                                                        <div className="flex items-center gap-2 justify-center p-2 border rounded bg-background">
                                                            <span className="text-xs text-muted-foreground">Vista previa:</span>
                                                            <div className="w-8 h-8 rounded-full overflow-hidden border">
                                                                <img
                                                                    src={newIcon}
                                                                    alt="Preview"
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </TabsContent>
                                        </Tabs>

                                        <div className="flex justify-end gap-2 mt-4">
                                            <Button size="sm" variant="ghost" onClick={() => setEditingCategory(null)}>Cancelar</Button>
                                            <Button size="sm" onClick={handleSave}>Guardar Cambios</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={onClose}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CategorySettingsModal;
