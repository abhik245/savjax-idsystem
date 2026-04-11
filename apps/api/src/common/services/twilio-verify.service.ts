import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type TwilioVerifySendResponse = {
  sid?: string;
  status?: string;
  to?: string;
  channel?: string;
  message?: string;
};

type TwilioVerifyCheckResponse = {
  sid?: string;
  status?: string;
  valid?: boolean;
  message?: string;
};

type TwilioVerifyApiResult<T extends Record<string, unknown>> = {
  body: T;
  notFound: boolean;
};

export type TwilioVerifyCheckResult = {
  approved: boolean;
  expiredOrMissing: boolean;
  sid?: string;
  status?: string;
  valid?: boolean;
};

@Injectable()
export class TwilioVerifyService {
  private readonly logger = new Logger(TwilioVerifyService.name);

  constructor(private readonly configService: ConfigService) {}

  shouldUseVerify() {
    const accountSid = this.accountSid();
    const authToken = this.authToken();
    const serviceSid = this.serviceSid();
    const configured = Boolean(accountSid && authToken && serviceSid);
    if (configured) return true;

    const partiallyConfigured = Boolean(accountSid || authToken || serviceSid);
    if (partiallyConfigured || this.isProduction()) {
      throw new ServiceUnavailableException("Twilio Verify is not configured for OTP delivery");
    }

    return false;
  }

  async sendVerification(mobile: string) {
    const to = this.toE164(mobile);
    const result = await this.postForm<TwilioVerifySendResponse>(
      "Verifications",
      new URLSearchParams({
        To: to,
        Channel: this.channel()
      })
    );

    return {
      sid: result.body.sid,
      status: result.body.status,
      to: result.body.to || to,
      channel: result.body.channel || this.channel()
    };
  }

  async checkVerification(mobile: string, code: string): Promise<TwilioVerifyCheckResult> {
    const result = await this.postForm<TwilioVerifyCheckResponse>(
      "VerificationCheck",
      new URLSearchParams({
        To: this.toE164(mobile),
        Code: code.trim()
      }),
      { allowNotFound: true }
    );

    if (result.notFound) {
      return {
        approved: false,
        expiredOrMissing: true,
        status: "not_found",
        valid: false
      };
    }

    return {
      approved: result.body.status === "approved" || result.body.valid === true,
      expiredOrMissing: false,
      sid: result.body.sid,
      status: result.body.status,
      valid: result.body.valid
    };
  }

  private async postForm<T extends Record<string, unknown>>(
    path: string,
    body: URLSearchParams,
    options?: { allowNotFound?: boolean }
  ): Promise<TwilioVerifyApiResult<T>> {
    const url = `https://verify.twilio.com/v2/Services/${this.serviceSid()}/${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.basicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000)
    });

    const rawText = await response.text();
    const parsed = this.parseJson<T>(rawText);

    if (options?.allowNotFound && response.status === 404) {
      this.logger.warn(`Twilio Verify resource not found for ${path}`);
      return { body: parsed, notFound: true };
    }

    if (!response.ok) {
      const rawMessage = this.errorMessage(parsed) || `Twilio Verify request failed with status ${response.status}`;
      this.logger.error(`Twilio Verify ${path} failed: ${response.status} ${rawMessage}`);
      const friendlyMessage = this.normalizeErrorMessage(rawMessage);
      if (friendlyMessage !== rawMessage) {
        throw new BadRequestException(friendlyMessage);
      }
      throw new BadGatewayException(rawMessage);
    }

    return { body: parsed, notFound: false };
  }

  private parseJson<T extends Record<string, unknown>>(rawText: string) {
    if (!rawText.trim()) return {} as T;
    try {
      return JSON.parse(rawText) as T;
    } catch {
      return {} as T;
    }
  }

  private errorMessage(payload: Record<string, unknown>) {
    return typeof payload.message === "string" ? payload.message : undefined;
  }

  private normalizeErrorMessage(message: string) {
    const normalized = message.toLowerCase();
    if (
      normalized.includes("trial accounts cannot send messages to unverified numbers") ||
      normalized.includes("the phone number is unverified")
    ) {
      return "OTP blocked by Twilio trial account. Verify this phone number in Twilio first, or upgrade the Twilio account.";
    }

    return message;
  }

  private basicAuthHeader() {
    const token = Buffer.from(`${this.accountSid()}:${this.authToken()}`).toString("base64");
    return `Basic ${token}`;
  }

  private toE164(mobile: string) {
    const normalized = mobile.trim();
    if (normalized.startsWith("+")) {
      const digits = normalized.slice(1).replace(/\D/g, "");
      if (digits.length < 8) {
        throw new BadRequestException("Enter a valid mobile number");
      }
      return `+${digits}`;
    }

    const digits = normalized.replace(/\D/g, "");
    if (digits.length === 10) {
      return `${this.defaultCountryCode()}${digits}`;
    }
    if (digits.length > 10) {
      return `+${digits}`;
    }

    throw new BadRequestException("Enter a valid mobile number");
  }

  private defaultCountryCode() {
    const raw = (this.configService.get<string>("TWILIO_VERIFY_DEFAULT_COUNTRY_CODE", "+91") || "+91").trim();
    const digits = raw.replace(/\D/g, "");
    return digits ? `+${digits}` : "+91";
  }

  private channel() {
    return (this.configService.get<string>("TWILIO_VERIFY_CHANNEL", "sms") || "sms").trim().toLowerCase();
  }

  private isProduction() {
    return this.configService.get("NODE_ENV", "development") === "production";
  }

  private accountSid() {
    return (this.configService.get<string>("TWILIO_ACCOUNT_SID") || "").trim();
  }

  private authToken() {
    return (this.configService.get<string>("TWILIO_AUTH_TOKEN") || "").trim();
  }

  private serviceSid() {
    return (this.configService.get<string>("TWILIO_VERIFY_SERVICE_SID") || "").trim();
  }
}
