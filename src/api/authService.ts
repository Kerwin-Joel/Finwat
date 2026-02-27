import { supabase } from "@/lib/supabase";
import type {
  LoginRequest,
  RegisterRequest,
  User,
} from "../types/auth";
// import axiosInstance from './axiosInstance'; // descomentar cuando el backend esté listo

export const login = async (credentials: LoginRequest) => {
  // MOCK - reemplazar con: const { data } = await axiosInstance.post('/auth/login', credentials); return data;
  // Simulate delay
  //   await new Promise((resolve) => setTimeout(resolve, 1000));
  //   return {
  //     user: {
  //       id: "1",
  //       name: "Hilda Wilson",
  //       email: credentials.email,
  //       phone: "987654321",
  //       createdAt: new Date().toISOString(),
  //     },
  //     token: "mock_token_123",
  //     refreshToken: "mock_refresh_token_123",
  //   };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (error) throw error;
  console.log("DATA:", data);
  console.log("ERROR:", error);
  return data;
};

export const register = async (userData: RegisterRequest) => {
  // MOCK - reemplazar con: const { response } = await axiosInstance.post('/auth/register', data); return response;
  // await new Promise(resolve => setTimeout(resolve, 1000));
  // return {
  //     user: { id: '2', name: data.name, email: data.email, phone: data.phone, createdAt: new Date().toISOString() },
  //     token: 'mock_token_456',
  //     refreshToken: 'mock_refresh_token_456',
  // };

  const { data, error } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password,
    options: {
      data: {
        name: userData.name,
        phone: userData.phone,
      },
    },
  });
  console.log("DATA:", data);
  console.log("ERROR:", error);
  if (error) throw error;
  return data;
};

export const logout = async (): Promise<void> => {
  // MOCK - reemplazar con: await axiosInstance.post('/auth/logout');
  //   localStorage.removeItem("finwat_token");
  //   localStorage.removeItem("finwat_user");

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const updateProfile = async (data: Partial<User>) => {
  const { error } = await supabase.auth.updateUser({
    data: {
      name: data.name,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth,
      photoUrl: data.photoUrl,
    },
  });
  if (error) throw error;
};