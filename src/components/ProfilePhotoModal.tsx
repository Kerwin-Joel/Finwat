import { useState, useRef } from 'react';
import { Camera, Upload, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from './ui/dialog';
import { useToast } from '../hooks/use-toast';
import useAuthStore from '../stores/authStore';

interface ProfilePhotoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({ isOpen, onClose }) => {
    const { user, updateProfilePhoto, isLoading } = useAuthStore();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [previewUrl, setPreviewUrl] = useState<string | null>(user?.photoUrl || null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast({
                title: 'Error',
                description: 'Por favor selecciona una imagen válida',
                variant: 'destructive',
            });
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast({
                title: 'Error',
                description: 'La imagen no debe superar los 5MB',
                variant: 'destructive',
            });
            return;
        }

        // Convert to base64 for preview and storage
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!previewUrl) {
            toast({
                title: 'Error',
                description: 'Por favor selecciona una imagen',
                variant: 'destructive',
            });
            return;
        }

        try {
            await updateProfilePhoto(previewUrl);
            toast({
                title: 'Foto actualizada',
                description: 'Tu foto de perfil se ha actualizado correctamente.',
            });
            onClose();
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'No se pudo actualizar la foto',
                variant: 'destructive',
            });
        }
    };

    const handleRemove = async () => {
        try {
            await updateProfilePhoto('');
            setPreviewUrl(null);
            toast({
                title: 'Foto eliminada',
                description: 'Tu foto de perfil se ha eliminado.',
            });
            onClose();
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'No se pudo eliminar la foto',
                variant: 'destructive',
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        Foto de Perfil
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div className="flex flex-col items-center gap-4">
                        {previewUrl ? (
                            <div className="relative">
                                <img
                                    src={previewUrl}
                                    alt="Preview"
                                    className="w-32 h-32 rounded-full object-cover border-4 border-primary"
                                />
                            </div>
                        ) : (
                            <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border-4 border-dashed border-muted-foreground/30">
                                <Camera className="h-12 w-12 text-muted-foreground" />
                            </div>
                        )}

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading}
                            >
                                <Upload className="mr-2 h-4 w-4" />
                                Seleccionar Imagen
                            </Button>
                            {previewUrl && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleRemove}
                                    disabled={isLoading}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar
                                </Button>
                            )}
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                            Formatos aceptados: JPG, PNG, GIF<br />
                            Tamaño máximo: 5MB
                        </p>
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading || !previewUrl}>
                        {isLoading ? 'Guardando...' : 'Guardar Foto'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ProfilePhotoModal;
