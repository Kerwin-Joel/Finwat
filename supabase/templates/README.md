# Correos de autenticación de Finwat

Plantillas HTML con la marca Finwat para los correos que envía Supabase Auth.
Se pegan a mano en **Supabase → Authentication → Emails → Templates**.

| Plantilla en Supabase | Archivo | Asunto (Subject) |
|---|---|---|
| Confirm signup | `confirm-signup.html` | Confirma tu cuenta Finwat ✅ |
| Reset password | `reset-password.html` | Restablece tu contraseña de Finwat |
| Change email address | `change-email.html` | Confirma tu nuevo correo en Finwat |
| Magic link | `magic-link.html` | Tu enlace para entrar a Finwat |

Variables que usan (las reemplaza Supabase): `{{ .ConfirmationURL }}`, `{{ .Email }}`,
`{{ .NewEmail }}` y `{{ .Data.name }}` (el nombre que la app manda en el registro).

El logo se carga desde `https://www.finwat.com/apple-touch-icon.png`, así que debe seguir publicado.

Vista previa local: con `npm run dev`, abrir `http://localhost:<puerto>/supabase/templates/confirm-signup.html`.

## Configuración necesaria en Supabase

**Authentication → URL Configuration**

- **Site URL:** `https://www.finwat.com` (si queda `http://localhost:…`, los enlaces de los correos llevan a localhost).
- **Redirect URLs:** agregar
  - `https://www.finwat.com/**`
  - `https://finwat.com/**`
  - `http://localhost:5174/**` (solo para desarrollo)

La app pide volver a `/auth/confirmed` tras confirmar; si esa URL no está permitida, Supabase la ignora y usa el Site URL.

**Authentication → Emails → SMTP Settings (recomendado)**

El SMTP por defecto de Supabase envía desde `noreply@mail.app.supabase.io`, con un límite bajo de correos por hora,
y no está pensado para producción. Con un SMTP propio (por ejemplo Resend, con el dominio `finwat.com` verificado)
los correos salen como `Finwat <hola@finwat.com>` y llegan menos a spam.
