export const formatCurrency = (amount: number, currency: string = 'PEN'): string => {
    if (currency === 'PEN') {
        return `S/. ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (currency === 'USD') {
        return `$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (currency === 'EUR') {
        return `€ ${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatShortCurrency = (amount: number): string => {
    if (amount >= 1000000) return `S/. ${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `S/. ${(amount / 1000).toFixed(1)}K`;
    return formatCurrency(amount);
};
