import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import useServicesStore from '../stores/servicesStore';
import ServiceCard from '../components/ServiceCard';
import ServiceDetailModal from '../components/ServiceDetailModal';
import { Input } from '../components/ui/input';
import { SkeletonServiceCard } from '../components/SkeletonLoader';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

const Services = () => {
    const { services, fetchServices, isLoading, selectedService, setSelectedService } = useServicesStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');

    useEffect(() => {
        fetchServices();
    }, [fetchServices]);

    const filteredServices = services.filter((s) => {
        const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'ALL' || s.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-6 pt-2 pb-20">
            <div className="space-y-4">
                <h1 className="text-2xl font-bold">Servicios Financieros</h1>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar servicios..."
                        className="pl-9 bg-card"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <Tabs defaultValue="ALL" onValueChange={setCategoryFilter} className="w-full overflow-x-auto">
                    <TabsList className="w-full justify-start h-9 bg-transparent p-0 gap-2">
                        <TabsTrigger value="ALL" className="rounded-full border border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Todos</TabsTrigger>
                        <TabsTrigger value="SCORE_CREDITICIO" className="rounded-full border border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Crédito</TabsTrigger>
                        <TabsTrigger value="COMPRA_DIVISAS" className="rounded-full border border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Divisas</TabsTrigger>
                        <TabsTrigger value="INVERSIONES" className="rounded-full border border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Inversiones</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <SkeletonServiceCard key={i} />)
                ) : (
                    filteredServices.map((service) => (
                        <ServiceCard
                            key={service.id}
                            service={service}
                            onClick={() => setSelectedService(service)}
                        />
                    ))
                )}
            </div>

            <ServiceDetailModal
                service={selectedService}
                onClose={() => setSelectedService(null)}
            />
        </div>
    );
};

export default Services;
