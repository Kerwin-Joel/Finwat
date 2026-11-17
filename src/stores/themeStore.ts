import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** system = sigue el modo claro/oscuro del teléfono o la computadora */
export type Theme = 'light' | 'dark' | 'system' | 'custom';
export type ResolvedTheme = 'light' | 'dark' | 'custom';

export interface CustomColors {
    primary: string; // HSL format: "262 83% 58%"
    background: string; // HSL format: "260 20% 98%"
    foreground: string; // HSL format: "260 25% 10%"
}

interface ThemeState {
    theme: Theme;
    customColors: CustomColors;
    setTheme: (theme: Theme) => void;
    setCustomColors: (colors: CustomColors) => void;
}

const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'light', // Rediseño 2026-11: claro con héroe marino (se puede cambiar en Perfil)
            customColors: {
                primary: '262 83% 58%', // Default purple
                background: '260 20% 98%', // Light purple background
                foreground: '260 25% 10%', // Dark text for light background
            },
            setTheme: (theme) => set({ theme }),
            setCustomColors: (customColors) => set({ customColors }),
        }),
        {
            name: 'theme-storage',
            // v1: con el rediseño, quien tenía el oscuro por defecto pasa una vez al claro.
            version: 1,
            migrate: (persisted, version) => {
                const state = persisted as ThemeState;
                if (version < 1 && state?.theme === 'dark') return { ...state, theme: 'light' };
                return state;
            },
        }
    )
);

export default useThemeStore;

const DARK_QUERY = '(prefers-color-scheme: dark)';
const systemPrefersDark = () =>
    typeof window !== 'undefined' && !!window.matchMedia?.(DARK_QUERY).matches;

/** Tema efectivo: resuelve "system" con la preferencia del dispositivo y la sigue en vivo */
export const useResolvedTheme = (): ResolvedTheme => {
    const theme = useThemeStore((s) => s.theme);
    const [prefersDark, setPrefersDark] = useState(systemPrefersDark);
    useEffect(() => {
        if (theme !== 'system' || !window.matchMedia) return;
        const mq = window.matchMedia(DARK_QUERY);
        const onChange = () => setPrefersDark(mq.matches);
        onChange();
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, [theme]);
    if (theme === 'system') return prefersDark ? 'dark' : 'light';
    return theme;
};
