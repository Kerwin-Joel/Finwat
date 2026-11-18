import { create } from "zustand";
import { investmentService } from "../api/investmentService";
import type { InvestmentsOverview, LineDetail } from "../types/investment";

// Estado del módulo de inversiones. Nada financiero es optimista: tras cada escritura
// se vuelve a leer de la BD (que es la que calcula cuotas, saldos e imputaciones).

interface InvestmentState {
  overview: InvestmentsOverview | null;
  overviewLoading: boolean;
  overviewError: string | null;
  details: Record<string, LineDetail | undefined>;
  detailLoading: Record<string, boolean | undefined>;
  detailError: Record<string, string | undefined>;
  fetchOverview: () => Promise<void>;
  fetchLine: (lineId: string) => Promise<void>;
  refreshAfterWrite: (lineId?: string) => Promise<void>;
  reset: () => void;
}

const useInvestmentStore = create<InvestmentState>((set, get) => ({
  overview: null,
  overviewLoading: false,
  overviewError: null,
  details: {},
  detailLoading: {},
  detailError: {},

  fetchOverview: async () => {
    set({ overviewLoading: true, overviewError: null });
    try {
      const overview = await investmentService.getOverview();
      set({ overview, overviewLoading: false });
    } catch (err) {
      set({
        overviewError: err instanceof Error ? err.message : "Error al cargar inversiones",
        overviewLoading: false,
      });
    }
  },

  fetchLine: async (lineId) => {
    set((s) => ({
      detailLoading: { ...s.detailLoading, [lineId]: true },
      detailError: { ...s.detailError, [lineId]: undefined },
    }));
    try {
      const detail = await investmentService.getLineDetail(lineId);
      set((s) => ({
        details: { ...s.details, [lineId]: detail },
        detailLoading: { ...s.detailLoading, [lineId]: false },
      }));
    } catch (err) {
      set((s) => ({
        detailLoading: { ...s.detailLoading, [lineId]: false },
        detailError: {
          ...s.detailError,
          [lineId]: err instanceof Error ? err.message : "Error al cargar la línea",
        },
      }));
    }
  },

  refreshAfterWrite: async (lineId) => {
    await Promise.all([get().fetchOverview(), lineId ? get().fetchLine(lineId) : Promise.resolve()]);
  },

  reset: () => set({ overview: null, details: {}, detailLoading: {}, detailError: {}, overviewError: null }),
}));

export default useInvestmentStore;
