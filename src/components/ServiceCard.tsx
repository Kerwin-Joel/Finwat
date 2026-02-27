import { motion } from 'framer-motion';
import { Star, Clock } from 'lucide-react';
import type { FinancialService } from '../types/service';
import { formatCurrency } from '../utils/formatCurrency';
import { Badge } from './ui/badge';

interface ServiceCardProps {
    service: FinancialService;
    onClick: () => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onClick }) => {
    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className="bg-card border border-border rounded-xl p-4 flex flex-col space-y-3 cursor-pointer hover:shadow-lg transition-shadow"
        >
            <div className="flex justify-between items-start">
                <div className="text-3xl bg-muted/50 p-2 rounded-full">{service.icon}</div>
                <div className="flex items-center space-x-1 bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-md">
                    <Star size={12} fill="currentColor" />
                    <span className="text-xs font-bold">{service.rating}</span>
                </div>
            </div>

            <div>
                <h4 className="font-semibold leading-tight mb-1">{service.title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
            </div>

            <div className="pt-2 flex items-center justify-between mt-auto">
                <Badge variant={service.price ? 'secondary' : 'outline'} className="text-xs">
                    {service.price ? formatCurrency(service.price) : 'Consultar'}
                </Badge>
                <div className="flex items-center text-xs text-muted-foreground">
                    <Clock size={12} className="mr-1" />
                    {service.estimatedTime}
                </div>
            </div>
        </motion.div>
    );
};

export default ServiceCard;
