import { useState } from 'react';
import { HelpCircle, MessageCircle, BookOpen, Info, Send } from 'lucide-react';
import { Button } from './ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useToast } from '../hooks/use-toast';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from './ui/accordion';

interface HelpSupportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const HelpSupportModal: React.FC<HelpSupportModalProps> = ({ isOpen, onClose }) => {
    const { toast } = useToast();
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmitSupport = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!subject.trim() || !message.trim()) {
            toast({
                title: 'Error',
                description: 'Por favor completa todos los campos',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);
        // MOCK - simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        toast({
            title: 'Mensaje enviado',
            description: 'Nuestro equipo de soporte te responderá pronto.',
        });

        setSubject('');
        setMessage('');
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <HelpCircle className="h-5 w-5" />
                        Ayuda y Soporte
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="faq" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="faq">FAQ</TabsTrigger>
                        <TabsTrigger value="support">Soporte</TabsTrigger>
                        <TabsTrigger value="guide">Guía</TabsTrigger>
                        <TabsTrigger value="about">Acerca de</TabsTrigger>
                    </TabsList>

                    {/* FAQ Tab */}
                    <TabsContent value="faq" className="space-y-4">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="item-1">
                                <AccordionTrigger>¿Cómo agrego una nueva transacción?</AccordionTrigger>
                                <AccordionContent>
                                    Para agregar una transacción, ve a la página de Inicio o Movimientos y haz clic en el botón "+" flotante en la esquina inferior derecha. Completa el formulario con los detalles de la transacción y guarda.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-2">
                                <AccordionTrigger>¿Puedo editar o eliminar transacciones?</AccordionTrigger>
                                <AccordionContent>
                                    Sí, simplemente haz clic en cualquier transacción para abrir el modal de edición. Desde ahí puedes modificar los datos o eliminar la transacción por completo.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-3">
                                <AccordionTrigger>¿Cómo cambio el tema de la aplicación?</AccordionTrigger>
                                <AccordionContent>
                                    Ve a tu Perfil y en la sección "Apariencia" encontrarás tres opciones: Claro, Oscuro y Personal. Si eliges Personal, podrás seleccionar entre 20 combinaciones de colores diferentes.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-4">
                                <AccordionTrigger>¿Cómo filtro mis transacciones?</AccordionTrigger>
                                <AccordionContent>
                                    En la página de Movimientos, usa los filtros en la parte superior para buscar por categoría, rango de fechas o tipo de transacción (ingreso/gasto). También puedes usar la barra de búsqueda para encontrar transacciones específicas.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-5">
                                <AccordionTrigger>¿Mis datos están seguros?</AccordionTrigger>
                                <AccordionContent>
                                    Sí, todos tus datos se almacenan de forma segura. En esta versión de demostración, los datos se guardan localmente en tu navegador. En la versión de producción, utilizamos encriptación de extremo a extremo.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </TabsContent>

                    {/* Support Tab */}
                    <TabsContent value="support" className="space-y-4">
                        <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                            <MessageCircle className="h-5 w-5 mt-0.5 text-primary" />
                            <div className="flex-1">
                                <h4 className="font-medium mb-1">Contacta con Soporte</h4>
                                <p className="text-sm text-muted-foreground">
                                    ¿Tienes algún problema o sugerencia? Envíanos un mensaje y te responderemos lo antes posible.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmitSupport} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="subject">Asunto</Label>
                                <Input
                                    id="subject"
                                    placeholder="Describe brevemente tu consulta"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message">Mensaje</Label>
                                <Textarea
                                    id="message"
                                    placeholder="Describe tu problema o sugerencia en detalle..."
                                    value={message}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                                    rows={6}
                                    required
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                <Send className="mr-2 h-4 w-4" />
                                {isSubmitting ? 'Enviando...' : 'Enviar Mensaje'}
                            </Button>
                        </form>
                    </TabsContent>

                    {/* Guide Tab */}
                    <TabsContent value="guide" className="space-y-4">
                        <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                            <BookOpen className="h-5 w-5 mt-0.5 text-primary" />
                            <div className="flex-1">
                                <h4 className="font-medium mb-1">Guía de Usuario</h4>
                                <p className="text-sm text-muted-foreground">
                                    Aprende a sacar el máximo provecho de FinWat
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="border-l-4 border-primary pl-4 py-2">
                                <h4 className="font-medium mb-1">1. Gestiona tus Cuentas</h4>
                                <p className="text-sm text-muted-foreground">
                                    Crea y administra múltiples cuentas bancarias, tarjetas de crédito y efectivo. Cada transacción se asocia a una cuenta específica.
                                </p>
                            </div>

                            <div className="border-l-4 border-primary pl-4 py-2">
                                <h4 className="font-medium mb-1">2. Registra Transacciones</h4>
                                <p className="text-sm text-muted-foreground">
                                    Añade ingresos y gastos con categorías personalizadas. Puedes incluir descripciones, fechas y montos para un seguimiento detallado.
                                </p>
                            </div>

                            <div className="border-l-4 border-primary pl-4 py-2">
                                <h4 className="font-medium mb-1">3. Visualiza tu Dashboard</h4>
                                <p className="text-sm text-muted-foreground">
                                    El inicio muestra un resumen de tus finanzas: balance total, transacciones recientes y estadísticas rápidas.
                                </p>
                            </div>

                            <div className="border-l-4 border-primary pl-4 py-2">
                                <h4 className="font-medium mb-1">4. Personaliza tu Experiencia</h4>
                                <p className="text-sm text-muted-foreground">
                                    Cambia el tema, actualiza tu perfil y configura la app según tus preferencias desde la sección de Perfil.
                                </p>
                            </div>

                            <div className="border-l-4 border-primary pl-4 py-2">
                                <h4 className="font-medium mb-1">5. Usa Filtros y Búsqueda</h4>
                                <p className="text-sm text-muted-foreground">
                                    Encuentra transacciones específicas usando filtros por categoría, fecha o tipo. La búsqueda te ayuda a localizar movimientos rápidamente.
                                </p>
                            </div>
                        </div>
                    </TabsContent>

                    {/* About Tab */}
                    <TabsContent value="about" className="space-y-4">
                        <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                            <Info className="h-5 w-5 mt-0.5 text-primary" />
                            <div className="flex-1">
                                <h4 className="font-medium mb-1">Acerca de FinWat</h4>
                                <p className="text-sm text-muted-foreground">
                                    Tu compañero inteligente para la gestión financiera personal
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-muted-foreground">Versión</span>
                                <span className="font-medium">2.0.0</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-muted-foreground">Última actualización</span>
                                <span className="font-medium">Febrero 2026</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-muted-foreground">Desarrollado por</span>
                                <span className="font-medium">FinWat Team</span>
                            </div>
                        </div>

                        <div className="space-y-2 pt-4">
                            <Button variant="outline" className="w-full justify-start" asChild>
                                <a href="#" onClick={(e: React.MouseEvent) => { e.preventDefault(); toast({ title: 'Próximamente', description: 'Esta función estará disponible pronto' }); }}>
                                    Términos de Servicio
                                </a>
                            </Button>
                            <Button variant="outline" className="w-full justify-start" asChild>
                                <a href="#" onClick={(e: React.MouseEvent) => { e.preventDefault(); toast({ title: 'Próximamente', description: 'Esta función estará disponible pronto' }); }}>
                                    Política de Privacidad
                                </a>
                            </Button>
                            <Button variant="outline" className="w-full justify-start" asChild>
                                <a href="#" onClick={(e: React.MouseEvent) => { e.preventDefault(); toast({ title: 'Próximamente', description: 'Esta función estará disponible pronto' }); }}>
                                    Licencias de Código Abierto
                                </a>
                            </Button>
                        </div>

                        <div className="text-center text-xs text-muted-foreground pt-4">
                            © 2026 FinWat. Todos los derechos reservados.
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default HelpSupportModal;
