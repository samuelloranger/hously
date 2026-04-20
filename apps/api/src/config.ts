import { z } from "zod/v4";

const commaSeparatedEmails = z
  .string()
  .optional()
  .default("")
  .transform((v) =>
    v
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean),
  );

const booleanString = z
  .string()
  .optional()
  .default("false")
  .transform((v) => v.toLowerCase() === "true");

const portNumber = z.coerce.number().int().min(1).max(65535);

const envSchema = z.object({
  // ── Core ──────────────────────────────────────────────
  NODE_ENV: z.string().optional().default("development"),
  API_PORT: portNumber.optional().default(3000),
  SECRET_KEY: z.string().min(1, "SECRET_KEY is required"),
  BASE_URL: z.url().optional().default("http://localhost:3000"),
  CORS_ORIGIN: z.string().optional().default("http://localhost:5173"),
  SERVE_STATIC: booleanString,
  LOG_LEVEL: z.string().optional().default("info"),
  TZ: z.string().optional().default("America/New_York"),

  // ── Database ──────────────────────────────────────────
  DATABASE_URL: z.string().optional().default(""),

  // ── Redis ─────────────────────────────────────────────
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional().default("redis"),
  REDIS_PORT: portNumber.optional().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).optional().default(0),

  // ── Image Storage ─────────────────────────────────────
  IMAGE_STORAGE_DIR: z.string().optional().default("./data/images"),

  // ── Access Control ────────────────────────────────────
  ALLOWED_EMAILS: commaSeparatedEmails,
  ADMIN_EMAILS: commaSeparatedEmails,

  // ── SMTP ──────────────────────────────────────────────
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: portNumber.optional().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional().default("noreply@localhost"),
  SMTP_FROM_NAME: z.string().optional().default("Hously"),

  // ── Web Push (VAPID) ──────────────────────────────────
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_CONTACT_EMAIL: z.string().optional().default("mailto:admin@localhost"),

  // ── APNs (iOS Push) ───────────────────────────────────
  APNS_TEAM_ID: z.string().optional(),
  APNS_KEY_ID: z.string().optional(),
  APNS_AUTH_KEY: z.string().optional(),
  APNS_TOPIC: z.string().optional(),
  APNS_PRODUCTION: booleanString,
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Reset cached config — for tests only. */
export function resetConfig(): void {
  cached = null;
}

export function loadConfig(): Env {
  if (cached) return cached;

  const raw = { ...process.env };
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`\n❌ Environment validation failed:\n${issues}\n`);
    process.exit(1);
  }

  cached = result.data;
  return cached;
}

// ── Derived helpers ───────────────────────────────────────────────────────────

export function getBaseUrl(): string {
  return loadConfig().BASE_URL;
}

export function getRedisUrl(): string {
  const env = loadConfig();
  if (env.REDIS_URL) return env.REDIS_URL;
  if (env.REDIS_PASSWORD) {
    return `redis://:${encodeURIComponent(env.REDIS_PASSWORD)}@${env.REDIS_HOST}:${env.REDIS_PORT}/${env.REDIS_DB}`;
  }
  return `redis://${env.REDIS_HOST}:${env.REDIS_PORT}/${env.REDIS_DB}`;
}

export function getSmtpConfig() {
  const env = loadConfig();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM,
    fromName: env.SMTP_FROM_NAME,
  };
}
