import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CATEGORIES } from "../constants/categories";
import { supabase } from "../lib/supabase";
import type { TransactionCategory } from "../types/transaction";

export interface CategoryConfig {
  label: string;
  icon: string;
  color: string;
  type?: "emoji" | "image";
  isCustom?: boolean;
}

interface CategoryState {
  categories: Record<string, CategoryConfig>;
  updateCategoryIcon: (
    key: string,
    icon: string,
    type: "emoji" | "image",
    userId?: string,
  ) => void;
  addCategory: (key: string, config: CategoryConfig, userId?: string) => void;
  deleteCategory: (key: string, userId?: string) => void;
  resetCategories: (userId?: string) => void;
  loadCustomCategories: (userId: string) => Promise<void>;
  getCategory: (key: string) => CategoryConfig;
}

const syncToSupabase = async (
  userId: string,
  customCategories: Record<string, CategoryConfig>,
) => {
  await supabase
    .from("profiles")
    .update({ custom_categories: customCategories })
    .eq("id", userId);
};

const getCustomOnly = (cats: Record<string, CategoryConfig>) =>
  Object.fromEntries(Object.entries(cats).filter(([, v]) => v.isCustom));

const useCategoryStore = create<CategoryState>()(
  persist(
    (set, get) => ({
      categories: CATEGORIES,

      loadCustomCategories: async (userId: string) => {
        const { data } = await supabase
          .from("profiles")
          .select("custom_categories")
          .eq("id", userId)
          .single();

        if (
          data?.custom_categories &&
          Object.keys(data.custom_categories).length > 0
        ) {
          set((state) => ({
            categories: { ...CATEGORIES, ...data.custom_categories },
          }));
        }
      },

      updateCategoryIcon: (key, icon, type, userId) => {
        set((state) => {
          const updated = {
            ...state.categories,
            [key]: { ...state.categories[key], icon, type },
          };
          if (userId) syncToSupabase(userId, getCustomOnly(updated));
          return { categories: updated };
        });
      },

      addCategory: (key, config, userId) => {
        const normalizedKey = key.toUpperCase().replace(/\s+/g, "_");
        set((state) => {
          const updated = {
            ...state.categories,
            [normalizedKey]: { ...config, isCustom: true },
          };
          if (userId) syncToSupabase(userId, getCustomOnly(updated));
          return { categories: updated };
        });
      },

      deleteCategory: (key, userId) => {
        set((state) => {
          const updated = { ...state.categories };
          delete updated[key];
          if (userId) syncToSupabase(userId, getCustomOnly(updated));
          return { categories: updated };
        });
      },

      resetCategories: (userId) => {
        set({ categories: CATEGORIES });
        if (userId) syncToSupabase(userId, {});
      },

      getCategory: (key) => {
        const state = get();
        return (
          state.categories[key] ?? CATEGORIES["OTROS" as TransactionCategory]
        );
      },
    }),
    { name: "finwat_categories" },
  ),
);

export default useCategoryStore;
