import type { User } from "../types/auth";
// import axiosInstance from './axiosInstance';

export const getProfile = async (): Promise<User> => {
  // MOCK - reemplazar con: const { data } = await axiosInstance.get('/user/profile'); return data.data;
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    id: "1",
    name: "Hildaxd Wilson",
    email: "hilda@email.com",
    phone: "987654321",
    createdAt: new Date().toISOString(),
  };
};

export const updateProfile = async (updates: Partial<User>): Promise<User> => {
  // MOCK - reemplazar con: const { data } = await axiosInstance.put('/user/profile', updates); return data.data;
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return {
    id: "1",
    name: "Hilda Wilson",
    email: "hilda@email.com",
    phone: "987654321",
    ...updates,
    createdAt: new Date().toISOString(),
  };
};
