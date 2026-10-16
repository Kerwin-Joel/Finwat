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
      emailRedirectTo: window.location.origin,
      data: {
        name: userData.name,
        phone: userData.phone,
      },
    },
  });
  if (error) throw error;
  // Con confirmación de correo activa, Supabase no devuelve error para correos
  // ya registrados: devuelve un usuario sin identidades.
  if (data.user && data.user.identities?.length === 0) {
    throw Object.assign(new Error("User already registered"), {
      code: "user_already_exists",
    });
  }
  return data;
};

export const sendPasswordReset = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
};

export const resendConfirmation = async (email: string) => {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
};

export const changePassword = async (
  email: string,
  currentPassword: string,
  newPassword: string,
) => {
  // Verifica la contraseña actual antes de cambiarla
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) throw verifyError;

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
};

export const logout = async (): Promise<void> => {
  // MOCK - reemplazar con: await axiosInstance.post('/auth/logout');
  //   localStorage.removeItem("finwat_token");
  //   localStorage.removeItem("finwat_user");

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// El bot de WhatsApp busca el teléfono en profiles.phone con formato 51XXXXXXXXX (solo dígitos)
const normalizePhone = (phone?: string) => phone?.replace(/\D/g, "") || undefined;

const PHONE_TAKEN_MESSAGE =
  "Ese número de teléfono ya está registrado en otra cuenta Finwat.";

const isUniqueViolation = (error: { code?: string } | null) =>
  error?.code === "23505";

export const updateProfile = async (data: Partial<User>) => {
  const phone = normalizePhone(data.phone);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // profiles es lo que usan el bot y el resto de la app; user_metadata solo es una copia
  const profileUpdates: Record<string, string> = {};
  if (data.name) profileUpdates.full_name = data.name;
  if (phone) profileUpdates.phone = phone;

  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdates)
      .eq("id", user.id);
    if (isUniqueViolation(profileError)) throw new Error(PHONE_TAKEN_MESSAGE);
    if (profileError) throw profileError;
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      name: data.name,
      phone,
      dateOfBirth: data.dateOfBirth,
      photoUrl: data.photoUrl,
    },
  });
  if (error) throw error;
};

// Crea la fila de profiles si el registro no la creó (sin perfil la app da 406 y el bot no reconoce al usuario)
export const ensureProfile = async (user: {
  id: string;
  user_metadata?: { name?: string; phone?: string };
}) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error verificando perfil:", error);
    return;
  }
  if (data) return;

  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    full_name: user.user_metadata?.name ?? "",
    phone: normalizePhone(user.user_metadata?.phone) ?? null,
    is_active: true,
  });

  if (isUniqueViolation(insertError)) {
    console.error(PHONE_TAKEN_MESSAGE, insertError);
    return;
  }
  if (insertError) console.error("Error creando perfil:", insertError);
};