export const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateShort = (date: string): string => {
  return date.slice(0, 10); // Retorna directamente yyyy-mm-dd
};

export const isToday = (date: string): boolean => {
    const today = new Date();
    const target = new Date(date);
    return today.toDateString() === target.toDateString();
};

export const isThisWeek = (date: string): boolean => {
    const today = new Date();
    const target = new Date(date);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    return target >= startOfWeek && target <= today;
};
