import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CATEGORIES } from '../constants/categories';
import type { TransactionCategory } from '../types/transaction';

export interface CategoryConfig {
    label: string;
    icon: string;
    color: string;
    type?: 'emoji' | 'image';
}

interface CategoryState {
    categories: Record<TransactionCategory, CategoryConfig>;
    updateCategoryIcon: (categoryKey: TransactionCategory, newIcon: string, type: 'emoji' | 'image') => void;
    resetCategories: () => void;
    getCategory: (key: TransactionCategory) => CategoryConfig;
}

const useCategoryStore = create<CategoryState>()(
    persist(
        (set, get) => ({
            categories: CATEGORIES,

            updateCategoryIcon: (categoryKey, newIcon, type) => {
                set((state) => ({
                    categories: {
                        ...state.categories,
                        [categoryKey]: {
                            ...state.categories[categoryKey],
                            icon: newIcon,
                            type: type,
                        },
                    },
                }));
            },

            resetCategories: () => {
                set({ categories: CATEGORIES });
            },

            getCategory: (key) => {
                const state = get();
                return state.categories[key] || CATEGORIES[key];
            },
        }),
        {
            name: 'finwat_categories',
        }
    )
);

export default useCategoryStore;
