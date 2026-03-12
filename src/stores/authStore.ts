import { create } from "zustand";
import type { User } from "../types/auth";
import { login, register, logout, updateProfile } from "../api/authService";
import type { LoginRequest, RegisterRequest } from "../types/auth";
import { supabase } from "@/lib/supabase";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  updateProfilePhoto: (photoUrl: string) => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
  initAuth: () => void;
  isInitializing: boolean; // solo para la carga inicial
}

const mapUser = (user: any): User | null => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.user_metadata?.name ?? "",
    phone: user.user_metadata?.phone,
    dateOfBirth: user.user_metadata?.dateOfBirth,
    photoUrl: user.user_metadata?.photoUrl,
    createdAt: user.created_at,
  };
};

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  error: null,
  isAuthenticated: false,
  isInitializing: true,

  //   ok
  initAuth: () => {
    set({ isInitializing: true });
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({
        user: mapUser(session?.user ?? null),
        token: session?.access_token ?? null,
        isAuthenticated: !!session,
        isLoading: false,
        isInitializing: false, // ✅
      });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({
        user: mapUser(session?.user ?? null),
        token: session?.access_token ?? null,
        isAuthenticated: !!session,
        isLoading: false,
      });
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        user: mapUser(session?.user ?? null),
        token: session?.access_token ?? null,
        isAuthenticated: !!session,
      });
    });
  },
  //   ok
  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const data = await login(credentials);
      set({
        user: mapUser(data.user),
        token: data.session?.access_token || null,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Error al iniciar sesión",
        isLoading: false,
        isAuthenticated: false, // ✅ asegura que no se autentique
        user: null,
      });
      throw err;
    }
  },
  //   ok
  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const data = await register(userData);
      set({
        user: mapUser(data.user),
        token: data.session?.access_token || null,
        isAuthenticated: !!data.session,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Error al registrarse",
        isLoading: false,
      });
    }
  },
  //   ok
  logout: async () => {
    await logout();
    set({ user: null, token: null, isAuthenticated: false });
  },

  updateUserProfile: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await updateProfile(data);
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) throw new Error("No user logged in");

      const updatedUser = { ...currentUser, ...data };
      set({ user: updatedUser, isLoading: false });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Error al actualizar perfil",
        isLoading: false,
      });
      throw err;
    }
  },

  changePassword: async (oldPassword, newPassword) => {
    set({ isLoading: true, error: null });
    try {
      // MOCK - simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("Verifying old password:", oldPassword); // Simulate verification
      // In real app, verify oldPassword and update
      if (newPassword.length < 8) {
        throw new Error("La contraseña debe tener al menos 8 caracteres");
      }
      set({ isLoading: false });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Error al cambiar contraseña",
        isLoading: false,
      });
      throw err;
    }
  },

  updateProfilePhoto: async (photoUrl) => {
    set({ isLoading: true, error: null });
    try {
      // MOCK - simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) throw new Error("No user logged in");

      const updatedUser = { ...currentUser, photoUrl };
      localStorage.setItem("finwat_user", JSON.stringify(updatedUser));
      set({ user: updatedUser, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Error al actualizar foto",
        isLoading: false,
      });
      throw err;
    }
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  clearError: () => set({ error: null }),
}));

export default useAuthStore;
