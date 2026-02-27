import { Check, Clock, User } from 'lucide-react';
import { Button } from './ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from './ui/sheet';
import { Badge } from './ui/badge';
import type { FinancialService } from '../types/service';
import { formatCurrency } from '../utils/formatCurrency';
import { useToast } from '../hooks/use-toast';
import useServicesStore from '../stores/servicesStore';
import useAuthStore from '../stores/authStore';

interface ServiceDetailModalProps {
    service: FinancialService | null;
    onClose: () => void;
}

const ServiceDetailModal: React.FC<ServiceDetailModalProps> = ({ service, onClose }) => {
    const { requestService } = useServicesStore();
    const { user } = useAuthStore();
    const { toast } = useToast();

    if (!service) return null;

    const handleRequest = async () => {
        if (!user) return;
        try {
            await requestService({
                serviceId: service.id,
                userId: user.id,
            });
            toast({
                title: 'Solicitud enviada',
                description: `Has solicitado ${service.title}. Te contactaremos pronto.`,
            });
            onClose();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo procesar la solicitud.',
                variant: 'destructive',
            });
        }
    };

    return (
        <Sheet open={!!service} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl sm:max-w-md sm:mx-auto">
                <SheetHeader className="text-left space-y-4">
                    <div className="flex items-center space-x-4">
                        <div className="text-4xl bg-muted p-3 rounded-2xl">{service.icon}</div>
                        <div>
                            <Badge variant="outline" className="mb-2">{service.category.replace(/_/g, ' ')}</Badge>
                            <SheetTitle className="text-xl">{service.title}</SheetTitle>
                        </div>
                    </div>
                </SheetHeader>

                <div className="py-6 space-y-6 overflow-y-auto max-h-[calc(85vh-180px)] pr-2">
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                        <div className="flex items-center space-x-2">
                            <Clock className="text-muted-foreground h-4 w-4" />
                            <span className="text-sm font-medium">{service.estimatedTime}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <User className="text-muted-foreground h-4 w-4" />
                            <span className="text-sm font-medium">{service.reviewCount} reseñas</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-semibold">Descripción</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {service.longDescription}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-semibold">Requisitos</h3>
                        <ul className="space-y-2">
                            {service.requirements.map((req, i) => (
                                <li key={i} className="flex items-start text-sm text-muted-foreground">
                                    <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                                    <span>{req}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {service.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                </div>

                <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 bg-background border-t border-border">
                    <div className="w-full flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">Precio</span>
                            <span className="text-xl font-bold">
                                {service.price ? formatCurrency(service.price) : 'Gratuito'}
                            </span>
                        </div>
                        <Button onClick={handleRequest} className="w-2/3" size="lg">
                            Solicitar Servicio
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
};

export default ServiceDetailModal;
