export type ServiceCategory =
    | 'SCORE_CREDITICIO'
    | 'COMPRA_DIVISAS'
    | 'VENTA_DIVISAS'
    | 'ASESOR_FINANCIERO'
    | 'PRESTAMOS_PERSONALES'
    | 'INVERSIONES'
    | 'SEGUROS'
    | 'DECLARACION_RENTA';

export type ServiceStatus = 'DISPONIBLE' | 'EN_PROCESO' | 'COMPLETADO' | 'SUSPENDIDO';

export interface FinancialService {
    id: string;
    category: ServiceCategory;
    title: string;
    description: string;
    longDescription: string;
    icon: string;
    price?: number;
    currency?: string;
    status: ServiceStatus;
    estimatedTime: string;
    requirements: string[];
    tags: string[];
    rating?: number;
    reviewCount?: number;
}

export interface ServiceRequestPayload {
    serviceId: string;
    userId: string;
    notes?: string;
}

export interface ServiceRequest {
    id: string;
    serviceId: string;
    userId: string;
    status: 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO' | 'COMPLETADO';
    notes?: string;
    createdAt: string;
    updatedAt: string;
}
