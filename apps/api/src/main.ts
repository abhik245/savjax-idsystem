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
  const app = await NestFactory.create(AppModule);
  if ((process.env.TRUST_PROXY || "").toLowerCase() === "true") {
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  }
  app.use(json({ limit: "80mb" }));
  app.use(urlencoded({ extended: true, limit: "80mb" }));
  app.use(requestIdMiddleware);
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    if (isProd) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  const corsOrigins =
    process.env.CORS_ORIGIN?.split(",").map((item) => item.trim()).filter(Boolean) || [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5500",
      "http://127.0.0.1:5500"
    ];

  app.enableCors({
    origin: corsOrigins,
    credentials: true
  });
  app.setGlobalPrefix("api/v2");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      stopAtFirstError: true,
      forbidNonWhitelisted: isProd
    })
  );
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000);
}

function assertEnv(key: string) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

function assertProductionSafety() {
  const corsOrigins =
    process.env.CORS_ORIGIN?.split(",").map((item) => item.trim()).filter(Boolean) || [];

  if ((process.env.AUTH_COOKIE_SECURE || "").toLowerCase() !== "true") {
    throw new Error("Unsafe production configuration: AUTH_COOKIE_SECURE must be true");
  }

  if ((process.env.TRUST_PROXY || "").toLowerCase() !== "true") {
    throw new Error("Unsafe production configuration: TRUST_PROXY must be true behind AWS load balancers");
  }

  if ((process.env.AUTH_DEV_EXPOSE_OTP || "").toLowerCase() === "true") {
    throw new Error("Unsafe production configuration: AUTH_DEV_EXPOSE_OTP must be false");
  }

  if ((process.env.AUTH_DEV_EXPOSE_RESET_TOKEN || "").toLowerCase() === "true") {
    throw new Error("Unsafe production configuration: AUTH_DEV_EXPOSE_RESET_TOKEN must be false");
  }

  if ((process.env.DEV_MASTER_OTP || "").trim()) {
    throw new Error("Unsafe production configuration: DEV_MASTER_OTP must be empty in production");
  }

  if (!corsOrigins.length) {
    throw new Error("Unsafe production configuration: CORS_ORIGIN must be explicitly set");
  }

  if (corsOrigins.some((origin) => /localhost|127\.0\.0\.1/i.test(origin))) {
    throw new Error("Unsafe production configuration: localhost origins are not allowed in production CORS_ORIGIN");
  }
}

bootstrap();
