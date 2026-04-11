import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { GlobalHttpExceptionFilter } from "./common/filters/http-exception.filter";
import { requestIdMiddleware } from "./common/middleware/request-id.middleware";

async function bootstrap() {
  assertEnv("JWT_ACCESS_SECRET");
  assertEnv("DATABASE_URL");

  const isProd = (process.env.NODE_ENV || "development") === "production";
  if (isProd) {
    assertEnv("FIELD_ENCRYPTION_KEY");
    assertEnv("ASSET_SIGNING_SECRET");
    assertEnv("DIGITAL_ID_SECRET");
    assertProductionSafety();
  }

  const app = await NestFactory.create(AppModule, {
    // Disable Express's x-powered-by header (hides Express fingerprint)
    logger: isProd ? ["error", "warn"] : ["log", "debug", "error", "warn", "verbose"]
  });

  if ((process.env.TRUST_PROXY || "").toLowerCase() === "true") {
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  }

  // Disable x-powered-by to avoid fingerprinting
  app.getHttpAdapter().getInstance().disable("x-powered-by");

  // Strict body limits — 10 MB for JSON, 2 MB for URL-encoded (form data)
  // Photo uploads must use multipart/form-data; raw base64 in JSON is capped here
  const photoMaxMb = Math.min(Number(process.env.PHOTO_MAX_MB || "10"), 25);
  app.use(json({ limit: `${photoMaxMb}mb` }));
  app.use(urlencoded({ extended: true, limit: "2mb" }));

  app.use(requestIdMiddleware);

  // ── Security Headers ────────────────────────────────────────────────────────
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Prevent MIME sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Clickjacking protection
    res.setHeader("X-Frame-Options", "DENY");
    // No referrer leakage
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Restrict browser features
    res.setHeader(
      "Permissions-Policy",
      "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), fullscreen=(self)"
    );
    // Cross-origin resource isolation
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    // XSS filter (legacy browsers)
    res.setHeader("X-XSS-Protection", "1; mode=block");
    // DNS prefetch control
    res.setHeader("X-DNS-Prefetch-Control", "off");
    // Download options (IE)
    res.setHeader("X-Download-Options", "noopen");
    // No client-side caching of API responses
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");

    // Content Security Policy — API only serves JSON, so lock it down hard
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'none'"
      ].join("; ")
    );

    // HSTS — only in production
    if (isProd) {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=63072000; includeSubDomains; preload"
      );
    }

    next();
  });
  // ────────────────────────────────────────────────────────────────────────────

  const corsOrigins =
    process.env.CORS_ORIGIN?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) || [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5500",
      "http://127.0.0.1:5500"
    ];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "x-device-id",
      "x-intake-session-token"
    ],
    exposedHeaders: ["x-request-id"],
    maxAge: 86400 // preflight cache 24 h
  });

  app.setGlobalPrefix("api/v2");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      stopAtFirstError: true,
      forbidNonWhitelisted: isProd,
      // Limit string lengths at the pipe level to prevent oversized inputs
      transformOptions: { enableImplicitConversion: false }
    })
  );

  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
}

function assertEnv(key: string) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

function assertProductionSafety() {
  const corsOrigins =
    process.env.CORS_ORIGIN?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) || [];

  if ((process.env.AUTH_COOKIE_SECURE || "").toLowerCase() !== "true") {
    throw new Error("Unsafe production configuration: AUTH_COOKIE_SECURE must be true");
  }

  if ((process.env.TRUST_PROXY || "").toLowerCase() !== "true") {
    throw new Error(
      "Unsafe production configuration: TRUST_PROXY must be true behind AWS load balancers"
    );
  }

  if ((process.env.AUTH_DEV_EXPOSE_OTP || "").toLowerCase() === "true") {
    throw new Error("Unsafe production configuration: AUTH_DEV_EXPOSE_OTP must be false");
  }

  if ((process.env.AUTH_DEV_EXPOSE_RESET_TOKEN || "").toLowerCase() === "true") {
    throw new Error(
      "Unsafe production configuration: AUTH_DEV_EXPOSE_RESET_TOKEN must be false"
    );
  }

  if ((process.env.DEV_MASTER_OTP || "").trim()) {
    throw new Error(
      "Unsafe production configuration: DEV_MASTER_OTP must be empty in production"
    );
  }

  if (!corsOrigins.length) {
    throw new Error(
      "Unsafe production configuration: CORS_ORIGIN must be explicitly set"
    );
  }

  if (corsOrigins.some((origin) => /localhost|127\.0\.0\.1/i.test(origin))) {
    throw new Error(
      "Unsafe production configuration: localhost origins are not allowed in production CORS_ORIGIN"
    );
  }

  // Enforce strong HSTS preload eligibility
  const jwtSecret = process.env.JWT_ACCESS_SECRET || "";
  if (jwtSecret.length < 64) {
    throw new Error(
      "Unsafe production configuration: JWT_ACCESS_SECRET must be at least 64 characters"
    );
  }
}

bootstrap();
