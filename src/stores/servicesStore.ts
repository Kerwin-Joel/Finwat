import { create } from 'zustand';
import type { FinancialService, ServiceRequest, ServiceRequestPayload } from '../types/service';
import { getServices, requestService, getUserServiceRequests } from '../api/servicesService';

interface ServicesState {
    services: FinancialService[];
    myRequests: ServiceRequest[];
    isLoading: boolean;
    error: string | null;
    selectedService: FinancialService | null;
    fetchServices: () => Promise<void>;
    fetchMyRequests: (userId: string) => Promise<void>;
    requestService: (payload: ServiceRequestPayload) => Promise<void>;
    setSelectedService: (service: FinancialService | null) => void;
}

const useServicesStore = create<ServicesState>((set) => ({
    services: [],
    myRequests: [],
    isLoading: false,
    error: null,
    selectedService: null,

    fetchServices: async () => {
        set({ isLoading: true, error: null });
        try {
            const services = await getServices();
            set({ services, isLoading: false });
        } catch (err) {
            set({ error: err instanceof Error ? err.message : 'Error al cargar servicios', isLoading: false });
        }
    },

    fetchMyRequests: async (userId) => {
        try {
            const requests = await getUserServiceRequests(userId);
            set({ myRequests: requests });
        } catch (err) {
            set({ error: err instanceof Error ? err.message : 'Error al cargar solicitudes' });
        }
    },

    requestService: async (payload) => {
        set({ isLoading: true });
        try {
            const request = await requestService(payload);
            set((state) => ({ myRequests: [...state.myRequests, request], isLoading: false }));
        } catch (err) {
            set({ error: err instanceof Error ? err.message : 'Error al solicitar servicio', isLoading: false });
        }
    },

    setSelectedService: (service) => set({ selectedService: service }),
}));

export default useServicesStore;
