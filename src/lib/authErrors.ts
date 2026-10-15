// Traduce los errores de Supabase Auth a mensajes en español para el usuario
const MESSAGES: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed:
    "Tu correo aún no está confirmado. Revisa tu bandeja de entrada.",
  user_already_exists: "Ya existe una cuenta con este correo.",
  email_exists: "Ya existe una cuenta con este correo.",
  weak_password: "La contraseña es muy débil. Usa al menos 6 caracteres.",
  signup_disabled: "El registro de nuevas cuentas está deshabilitado.",
  over_email_send_rate_limit:
    "Se enviaron demasiados correos. Espera unos minutos e intenta de nuevo.",
  over_request_rate_limit:
    "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
  same_password: "La nueva contraseña debe ser distinta a la actual.",
  otp_expired: "El enlace expiró o ya fue usado. Solicita uno nuevo.",
  email_address_invalid: "El correo no es válido.",
};

export const getAuthErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== "object") return fallback;
  const { code, message } = error as { code?: string; message?: string };

  if (code && MESSAGES[code]) return MESSAGES[code];
  if (message?.includes("Failed to fetch") || message?.includes("NetworkError")) {
    return "No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.";
  }
  if (message?.includes("Invalid login credentials")) return MESSAGES.invalid_credentials;
  if (message?.includes("Email not confirmed")) return MESSAGES.email_not_confirmed;
  if (message?.includes("already registered")) return MESSAGES.user_already_exists;
  return message || fallback;
};

export const isEmailNotConfirmed = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  ((error as { code?: string }).code === "email_not_confirmed" ||
    !!(error as { message?: string }).message?.includes("Email not confirmed"));
