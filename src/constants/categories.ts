import type { TransactionCategory } from '../types/transaction';

export const CATEGORIES: Record<TransactionCategory, { label: string; icon: string; color: string }> = {
    SALUD: { label: 'Salud', icon: '🏥', color: '#ef4444' },
    TRABAJO: { label: 'Trabajo', icon: '💼', color: '#22c55e' },
    NEGOCIO: { label: 'Negocio', icon: '📊', color: '#3b82f6' },
    ALIMENTACION: { label: 'Alimentación', icon: '🍔', color: '#f97316' },
    TRANSPORTE: { label: 'Transporte', icon: '🚗', color: '#8b5cf6' },
    ENTRETENIMIENTO: { label: 'Entretenimiento', icon: '🎬', color: '#ec4899' },
    EDUCACION: { label: 'Educación', icon: '📚', color: '#06b6d4' },
    VIVIENDA: { label: 'Vivienda', icon: '🏠', color: '#84cc16' },
    SERVICIOS: { label: 'Servicios', icon: '⚡', color: '#eab308' },
    OTROS: { label: 'Otros', icon: '📦', color: '#6b7280' },
};
