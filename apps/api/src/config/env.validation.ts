const SAME_SITE_VALUES = new Set(["lax", "strict", "none"]);
const LOCALHOST_PATTERN = /(^|:\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i;

type RawEnv = Record<string, unknown>;

export function validateEnvConfig(raw: RawEnv) {
  const env = { ...raw };

  const nodeEnv = asString(env.NODE_ENV, "development").toLowerCase();
  const isProd = nodeEnv === "production";
  const databaseUrl = requireString(env.DATABASE_URL, "DATABASE_URL");
  const jwtAccessSecret = requireString(env.JWT_ACCESS_SECRET, "JWT_ACCESS_SECRET");
  const fieldEncryptionKey = asString(env.FIELD_ENCRYPTION_KEY, "");
  const authCookieSecure = asBoolean(env.AUTH_COOKIE_SECURE, false);
  const authCookieSameSite = asString(env.AUTH_COOKIE_SAME_SITE, "lax").toLowerCase();
  const corsOrigins = splitList(env.CORS_ORIGIN, [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]);
  const trustProxy = asBoolean(env.TRUST_PROXY, false);
  const authDevExposeOtp = asBoolean(env.AUTH_DEV_EXPOSE_OTP, false);
  const authDevExposeResetToken = asBoolean(env.AUTH_DEV_EXPOSE_RESET_TOKEN, false);
  const devMasterOtp = asString(env.DEV_MASTER_OTP, "");
  const assetSigningSecret = asString(env.ASSET_SIGNING_SECRET, "");
  const digitalIdSecret = asString(env.DIGITAL_ID_SECRET, "");

  if (!SAME_SITE_VALUES.has(authCookieSameSite)) {
    throw new Error("AUTH_COOKIE_SAME_SITE must be one of: lax, strict, none");
  }

  if (authCookieSameSite === "none" && !authCookieSecure) {
    throw new Error("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE is 'none'");
  }

  if (!Number.isFinite(asNumber(env.PORT, 4000)) || asNumber(env.PORT, 4000) <= 0) {
    throw new Error("PORT must be a positive number");
  }

  const photoMaxMb = asNumber(env.PHOTO_MAX_MB, 40);
  if (!Number.isFinite(photoMaxMb) || photoMaxMb <= 0 || photoMaxMb > 80) {
    throw new Error("PHOTO_MAX_MB must be a positive number not greater than 80");
  }

  if (isProd) {
    assertStrongSecret(jwtAccessSecret, "JWT_ACCESS_SECRET");
    assertStrongSecret(fieldEncryptionKey, "FIELD_ENCRYPTION_KEY");
    assertStrongSecret(assetSigningSecret, "ASSET_SIGNING_SECRET");
    assertStrongSecret(digitalIdSecret, "DIGITAL_ID_SECRET");

    if (!authCookieSecure) {
      throw new Error("AUTH_COOKIE_SECURE must be true in production");
    }

    if (!trustProxy) {
      throw new Error("TRUST_PROXY must be true in production behind TLS termination");
    }

    if (corsOrigins.some((origin) => LOCALHOST_PATTERN.test(origin))) {
      throw new Error("CORS_ORIGIN must not contain localhost-style origins in production");
    }

    if (devMasterOtp) {
      throw new Error("DEV_MASTER_OTP must not be set in production");
    }

    if (authDevExposeOtp) {
      throw new Error("AUTH_DEV_EXPOSE_OTP must be false in production");
    }

    if (authDevExposeResetToken) {
      throw new Error("AUTH_DEV_EXPOSE_RESET_TOKEN must be false in production");
    }
  }

  return {
    ...env,
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_SECRET: jwtAccessSecret,
    FIELD_ENCRYPTION_KEY: fieldEncryptionKey,
    AUTH_COOKIE_SECURE: String(authCookieSecure),
    AUTH_COOKIE_SAME_SITE: authCookieSameSite,
    CORS_ORIGIN: corsOrigins.join(","),
    TRUST_PROXY: String(trustProxy),
    AUTH_DEV_EXPOSE_OTP: String(authDevExposeOtp),
    AUTH_DEV_EXPOSE_RESET_TOKEN: String(authDevExposeResetToken),
    DEV_MASTER_OTP: devMasterOtp,
    ASSET_SIGNING_SECRET: assetSigningSecret,
    DIGITAL_ID_SECRET: digitalIdSecret,
    PHOTO_MAX_MB: String(photoMaxMb)
  };
}

function requireString(value: unknown, key: string) {
  const out = asString(value, "").trim();
  if (!out) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return out;
}

function asString(value: unknown, fallback: string) {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function asBoolean(value: unknown, fallback: boolean) {
  const normalized = asString(value, fallback ? "true" : "false").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function asNumber(value: unknown, fallback: number) {
  const raw = asString(value, String(fallback)).trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitList(value: unknown, fallback: string[]) {
  const raw = asString(value, fallback.join(","));
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function assertStrongSecret(value: string, key: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${key} is required in production`);
  }
  if (normalized.length < 32) {
    throw new Error(`${key} must be at least 32 characters in production`);
  }
  if (/(replace_with_|changeme|example|dev_access_secret|savjax-dev)/i.test(normalized)) {
    throw new Error(`${key} must not use a placeholder or development secret in production`);
  }
}
