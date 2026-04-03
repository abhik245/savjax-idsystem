import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

type JsonLike = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

const SENSITIVE_KEYS = new Set([
  "address",
  "addressciphertext",
  "parentmobile",
  "parentmobileciphertext",
  "phone",
  "mobile",
  "principalphone",
  "principalemail",
  "parentname",
  "parentnameciphertext",
  "bloodgroup",
  "dateofbirth",
  "dob",
  "photokey",
  "photoanalysisjson",
  "payloadjson",
  "payloadciphertext",
  "refreshtoken",
  "accesstoken",
  "password",
  "passwordhash",
  "token",
  "otp"
]);

@Injectable()
export class DataProtectionService {
  private readonly logger = new Logger(DataProtectionService.name);
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<string>("FIELD_ENCRYPTION_KEY")?.trim();
    const isProd = (this.configService.get<string>("NODE_ENV") || "development") === "production";

    if (!configured && isProd) {
      throw new Error("FIELD_ENCRYPTION_KEY is required in production");
    }

    if (!configured) {
      this.logger.warn("FIELD_ENCRYPTION_KEY not set. Using development fallback key.");
    }

    this.key = createHash("sha256")
      .update(configured || "savjax-dev-field-encryption-key")
      .digest();
  }

  encryptJson(value: JsonLike | undefined): string | null {
    if (value === undefined) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const plaintext = Buffer.from(JSON.stringify(value), "utf8");
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
  }

  decryptJson<T = unknown>(value?: string | null): T | null {
    if (!value) return null;
    const [ivRaw, tagRaw, ciphertextRaw] = value.split(".");
    if (!ivRaw || !tagRaw || !ciphertextRaw) return null;
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        Buffer.from(ivRaw, "base64")
      );
      decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(ciphertextRaw, "base64")),
        decipher.final()
      ]).toString("utf8");
      return JSON.parse(decrypted) as T;
    } catch {
      return null;
    }
  }

  encryptText(value?: string | null): string | null {
    const raw = value?.trim();
    if (!raw) return null;
    return this.encryptJson(raw);
  }

  stableHash(value?: string | null): string | null {
    const raw = value?.trim();
    if (!raw) return null;
    return createHash("sha256").update(this.key).update(":").update(raw).digest("hex");
  }

  decryptText(value?: string | null, fallback?: string | null): string | null {
    const decrypted = this.decryptJson<unknown>(value);
    if (typeof decrypted === "string") return decrypted;
    return fallback ?? null;
  }

  maskPhone(value?: string | null) {
    const raw = (value || "").trim();
    if (!raw) return raw;
    if (raw.length <= 4) return "*".repeat(raw.length);
    return `${"*".repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}`;
  }

  maskName(value?: string | null) {
    const raw = (value || "").trim();
    if (!raw) return raw;
    if (raw.length <= 2) return `${raw[0] || "*"}*`;
    return `${raw[0]}${"*".repeat(Math.max(raw.length - 2, 1))}${raw.slice(-1)}`;
  }

  maskEmail(value?: string | null) {
    const raw = (value || "").trim();
    if (!raw || !raw.includes("@")) return raw;
    const [local, domain] = raw.split("@");
    if (!local) return `***@${domain}`;
    const visible = local.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
  }

  maskAddress(value?: string | null) {
    const raw = (value || "").trim();
    if (!raw) return raw;
    if (raw.length <= 12) return `${raw.slice(0, 3)}${"*".repeat(Math.max(raw.length - 3, 1))}`;
    return `${raw.slice(0, 6)}${"*".repeat(Math.max(raw.length - 10, 4))}${raw.slice(-4)}`;
  }

  redactForLogs<T>(value: T): T {
    return this.redactValue(value) as T;
  }

  private redactValue(value: unknown, keyHint?: string): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redactValue(item));
    }
    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      Object.entries(value as Record<string, unknown>).forEach(([key, current]) => {
        result[key] = this.redactValue(current, key);
      });
      return result;
    }

    if (!keyHint || typeof value !== "string") return value;
    const normalizedKey = keyHint.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (!SENSITIVE_KEYS.has(normalizedKey)) return value;

    if (normalizedKey.includes("email")) return this.maskEmail(value);
    if (normalizedKey.includes("phone") || normalizedKey.includes("mobile")) {
      return this.maskPhone(value);
    }
    if (normalizedKey.includes("address")) return this.maskAddress(value);
    if (normalizedKey.includes("name")) return this.maskName(value);
    if (normalizedKey === "photokey") return "[REDACTED_PHOTO_KEY]";
    if (normalizedKey === "otp") return "[REDACTED_OTP]";
    if (normalizedKey.includes("token")) return "[REDACTED_TOKEN]";
    if (normalizedKey.includes("password")) return "[REDACTED_SECRET]";
    return "[REDACTED]";
  }
}
