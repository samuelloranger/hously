export const AUTH_ENDPOINTS = {
  ME: "/api/auth/me",
  LOGIN: "/api/auth/login",
  LOGOUT: "/api/auth/logout",
  FORGOT_PASSWORD: "/api/auth/forgot-password",
  RESET_PASSWORD: "/api/auth/reset-password",
  ACCEPT_INVITATION: "/api/auth/accept-invitation",
  PASSKEY_REGISTER_OPTIONS: "/api/auth/passkey/register/options",
  PASSKEY_REGISTER_VERIFY: "/api/auth/passkey/register/verify",
  PASSKEY_AUTHENTICATE_OPTIONS: "/api/auth/passkey/authenticate/options",
  PASSKEY_AUTHENTICATE_VERIFY: "/api/auth/passkey/authenticate/verify",
  PASSKEY_CREDENTIALS: "/api/auth/passkey/credentials",
} as const;
