import type { FinancialService, ServiceRequestPayload, ServiceRequest } from '../types/service';
import { MOCK_SERVICES } from '../constants/services';
// import axiosInstance from './axiosInstance';

export const getServices = async (): Promise<FinancialService[]> => {
    // MOCK - reemplazar con: const { data } = await axiosInstance.get('/services'); return data.data;
    await new Promise(resolve => setTimeout(resolve, 600));
    return MOCK_SERVICES;
};

export const getServiceById = async (id: string): Promise<FinancialService | undefined> => {
    // MOCK - reemplazar con: const { data } = await axiosInstance.get(`/services/${id}`); return data.data;
    return MOCK_SERVICES.find((s) => s.id === id);
};

export const requestService = async (payload: ServiceRequestPayload): Promise<ServiceRequest> => {
    // MOCK - reemplazar con: const { data } = await axiosInstance.post('/services/request', payload); return data.data;
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
        id: `req-${Date.now()}`,
        serviceId: payload.serviceId,
        userId: payload.userId,
        status: 'PENDIENTE',
        notes: payload.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
};

export const getUserServiceRequests = async (userId: string): Promise<ServiceRequest[]> => {
    // MOCK - reemplazar con: const { data } = await axiosInstance.get(`/services/requests?userId=${userId}`); return data.data;
    console.log('Fetching requests for user', userId);
    return [];
};
