import { create } from "zustand";
import type { User } from "../types/auth";
import {
  login,
  register,
  logout,
  updateProfile,
  changePassword,
  ensureProfile,
} from "../api/authService";
import type { LoginRequest, RegisterRequest } from "../types/auth";
import { supabase } from "@/lib/supabase";
import { getAuthErrorMessage } from "@/lib/authErrors";

let authListenerStarted = false;

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  /** Devuelve true si la cuenta necesita confirmar el correo antes de entrar */
  register: (data: RegisterRequest) => Promise<{ needsConfirmation: boolean }>;
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
    if (authListenerStarted) return;
    authListenerStarted = true;

    set({ isInitializing: true });
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        set({
          user: mapUser(session?.user ?? null),
          token: session?.access_token ?? null,
          isAuthenticated: !!session,
        });
      })
      .catch(() => set({ user: null, token: null, isAuthenticated: false }))
      .finally(() => set({ isLoading: false, isInitializing: false }));

    supabase.auth.onAuthStateChange((event, session) => {
      // Cubre login, sesión restaurada y confirmación de correo
      if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        // setTimeout: no llamar a Supabase dentro del callback (puede bloquear el cliente de auth)
        setTimeout(() => ensureProfile(session.user), 0);
      }
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
        error: getAuthErrorMessage(err, "Error al iniciar sesión"),
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
      return { needsConfirmation: !data.session };
    } catch (err) {
      set({
        error: getAuthErrorMessage(err, "Error al registrarse"),
        isLoading: false,
      });
      throw err;
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
      const email = useAuthStore.getState().user?.email;
      if (!email) throw new Error("No hay una sesión activa");
      if (newPassword.length < 8) {
        throw new Error("La contraseña debe tener al menos 8 caracteres");
      }
      await changePassword(email, oldPassword, newPassword);
      set({ isLoading: false });
    } catch (err) {
      const message = getAuthErrorMessage(err, "Error al cambiar contraseña");
      set({
        error:
          (err as { code?: string })?.code === "invalid_credentials"
            ? "La contraseña actual es incorrecta."
            : message,
        isLoading: false,
      });
      throw new Error(useAuthStore.getState().error ?? message);
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
