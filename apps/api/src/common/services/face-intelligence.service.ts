import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { createHash, createHmac, randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

type ProcessPhotoInput = {
  photoDataUrl?: string;
  photoKey?: string;
  schoolId?: string;
  intakeToken?: string;
  photoBgPreference?: string;
};

export type PhotoIntelligenceResult = {
  photoKey: string;
  photoQualityStatus: "PASSED" | "WARN" | "FAILED" | "NOT_CHECKED";
  photoQualityScore: number | null;
  photoAnalysisJson: Record<string, unknown>;
};

type AwsFaceQuality = {
  faceDetected: boolean;
  confidence: number | null;
  brightness: number | null;
  sharpness: number | null;
};

type CachedAnalysis = {
  id: string;
  parentId: string;
  schoolId: string;
  intakeToken: string;
  result: PhotoIntelligenceResult;
  expiresAt: number;
};

@Injectable()
export class FaceIntelligenceService {
  private readonly logger = new Logger(FaceIntelligenceService.name);
  private readonly cachedAnalyses = new Map<string, CachedAnalysis>();
  private readonly analysisTtlMs = 15 * 60 * 1000;

  async processPhoto(input: ProcessPhotoInput): Promise<PhotoIntelligenceResult> {
    if (input.photoKey && !input.photoDataUrl) {
      return {
        photoKey: input.photoKey,
        photoQualityStatus: "NOT_CHECKED",
        photoQualityScore: null,
        photoAnalysisJson: {
          mode: "existing_photo_key",
          photoBgPreference: input.photoBgPreference || "NONE"
        }
      };
    }

    if (!input.photoDataUrl) {
      throw new BadRequestException("Photo is required");
    }

    const parsed = this.parseDataUrl(input.photoDataUrl);
    const maxMb = Number(process.env.PHOTO_MAX_MB || 40);
    const maxBytes = Math.max(1, maxMb) * 1024 * 1024;
    if (parsed.buffer.length > maxBytes) {
      throw new BadRequestException(`Photo is too large. Max allowed is ${maxMb}MB.`);
    }

    const dimensions = this.getImageDimensions(parsed.buffer, parsed.mime);
    if (dimensions.width < 420 || dimensions.height < 420) {
      throw new BadRequestException("Photo resolution too low. Use a clearer image.");
    }

    const warnings: string[] = [];
    let status: "PASSED" | "WARN" | "FAILED" = "PASSED";
    let score = 92;

    if (parsed.buffer.length > 18 * 1024 * 1024) {
      warnings.push("Large image uploaded; processing may be slower.");
      status = "WARN";
      score = Math.min(score, 86);
    }

    const aspect = dimensions.width / Math.max(1, dimensions.height);
    if (aspect < 0.45 || aspect > 1.45) {
      warnings.push("Image aspect ratio is unusual for ID print profile.");
      status = "WARN";
      score = Math.min(score, 82);
    }

    const aws = await this.detectFaceWithAws(parsed.buffer);
    if (aws) {
      if (!aws.faceDetected) {
        status = "FAILED";
        score = 0;
      } else {
        if ((aws.confidence || 0) < 85) {
          status = "WARN";
          score = Math.min(score, 76);
          warnings.push("Face confidence is low. Retake recommended.");
        }
        if ((aws.brightness || 100) < 35) {
          status = "WARN";
          score = Math.min(score, 74);
          warnings.push("Lighting appears low.");
        }
        if ((aws.sharpness || 100) < 35) {
          status = "WARN";
          score = Math.min(score, 72);
          warnings.push("Image sharpness is low.");
        }
      }
    }

    if (status === "FAILED") {
      throw new BadRequestException("Face not detected clearly. Retake photo with full face visible.");
    }

    const photoKey = await this.persistPhoto(parsed.buffer, parsed.extension);

    return {
      photoKey,
      photoQualityStatus: status,
      photoQualityScore: score,
      photoAnalysisJson: {
        mode: "phase2_photo_intelligence",
        provider: aws ? "aws_rekognition" : "local_heuristics",
        warnings,
        bytes: parsed.buffer.length,
        mime: parsed.mime,
        width: dimensions.width,
        height: dimensions.height,
        intakeToken: input.intakeToken,
        schoolId: input.schoolId,
        photoBgPreference: input.photoBgPreference || "NONE",
        aws
      }
    };
  }

  createAnalysisTicket(args: {
    parentId: string;
    schoolId: string;
    intakeToken: string;
    result: PhotoIntelligenceResult;
  }) {
    this.cleanupExpiredTickets();
    const id = randomUUID();
    this.cachedAnalyses.set(id, {
      id,
      parentId: args.parentId,
      schoolId: args.schoolId,
      intakeToken: args.intakeToken,
      result: args.result,
      expiresAt: Date.now() + this.analysisTtlMs
    });
    return id;
  }

  consumeAnalysisTicket(args: {
    ticketId: string;
    parentId: string;
    schoolId: string;
    intakeToken: string;
  }) {
    this.cleanupExpiredTickets();
    const ticket = this.cachedAnalyses.get(args.ticketId);
    if (!ticket) return null;
    const valid =
      ticket.parentId === args.parentId &&
      ticket.schoolId === args.schoolId &&
      ticket.intakeToken === args.intakeToken;
    if (!valid) return null;
    this.cachedAnalyses.delete(args.ticketId);
    return ticket.result;
  }

  getWarnings(result: PhotoIntelligenceResult) {
    const warningsRaw = (result.photoAnalysisJson as { warnings?: unknown }).warnings;
    if (!Array.isArray(warningsRaw)) return [];
    return warningsRaw.filter((item): item is string => typeof item === "string");
  }

  private parseDataUrl(dataUrl: string) {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      throw new BadRequestException("Invalid image format. Use JPG or PNG.");
    }
    const mime = match[1].toLowerCase();
    if (!["image/jpeg", "image/jpg", "image/png"].includes(mime)) {
      throw new BadRequestException("Only JPG and PNG images are supported.");
    }
    const base64 = match[2];
    const buffer = Buffer.from(base64, "base64");
    const extension = mime.includes("png") ? "png" : "jpg";
    return { mime, buffer, extension };
  }

  private getImageDimensions(buffer: Buffer, mime: string) {
    if (mime.includes("png")) {
      if (buffer.length < 24) throw new BadRequestException("Invalid PNG image");
      const signature = buffer.subarray(0, 8).toString("hex");
      if (signature !== "89504e470d0a1a0a") throw new BadRequestException("Corrupt PNG");
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    // JPEG parser: scan SOF markers for dimensions.
    let offset = 2;
    if (buffer.readUInt16BE(0) !== 0xffd8) throw new BadRequestException("Corrupt JPEG");
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const isSof =
        marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3 ||
        marker === 0xc5 ||
        marker === 0xc6 ||
        marker === 0xc7 ||
        marker === 0xc9 ||
        marker === 0xca ||
        marker === 0xcb ||
        marker === 0xcd ||
        marker === 0xce ||
        marker === 0xcf;
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (isSof) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      offset += 2 + segmentLength;
    }
    throw new BadRequestException("Unable to parse JPEG dimensions");
  }

  private async persistPhoto(buffer: Buffer, extension: string) {
    const rootDir = process.env.LOCAL_UPLOAD_DIR || join(process.cwd(), "uploads");
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const relativeDir = join("intake", String(year), month);
    const absoluteDir = join(rootDir, relativeDir);
    await mkdir(absoluteDir, { recursive: true });
    const fileName = `${randomUUID()}.${extension}`;
    const relativePath = join(relativeDir, fileName).replace(/\\/g, "/");
    await writeFile(join(rootDir, relativePath), buffer);
    return `local://${relativePath}`;
  }

  private async detectFaceWithAws(buffer: Buffer): Promise<AwsFaceQuality | null> {
    const enabled = (process.env.AWS_REKOGNITION_ENABLED || "false").toLowerCase() === "true";
    if (!enabled) return null;
    if (buffer.length > 5 * 1024 * 1024) {
      this.logger.warn("AWS Rekognition skipped: image bytes exceed 5MB bytes-mode limit");
      return null;
    }

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || "ap-south-1";
    const sessionToken = process.env.AWS_SESSION_TOKEN;
    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn("AWS Rekognition enabled but credentials are missing");
      return null;
    }

    const payload = JSON.stringify({
      Image: { Bytes: buffer.toString("base64") },
      Attributes: ["ALL"]
    });
    const service = "rekognition";
    const host = `rekognition.${region}.amazonaws.com`;
    const endpoint = `https://${host}/`;
    const amzTarget = "RekognitionService.DetectFaces";
    const contentType = "application/x-amz-json-1.1";

    const now = new Date();
    const amzDate = this.formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const canonicalUri = "/";
    const canonicalQuery = "";

    const canonicalHeadersBase = [
      `content-type:${contentType}`,
      `host:${host}`,
      `x-amz-date:${amzDate}`,
      `x-amz-target:${amzTarget}`
    ];
    if (sessionToken) canonicalHeadersBase.push(`x-amz-security-token:${sessionToken}`);
    const canonicalHeaders = `${canonicalHeadersBase.sort().join("\n")}\n`;
    const signedHeaders = canonicalHeadersBase
      .map((h) => h.split(":")[0])
      .sort()
      .join(";");
    const payloadHash = this.sha256Hex(payload);
    const canonicalRequest = [
      "POST",
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join("\n");

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      this.sha256Hex(canonicalRequest)
    ].join("\n");

    const signingKey = this.getAwsSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "X-Amz-Date": amzDate,
      "X-Amz-Target": amzTarget,
      Authorization: authorization
    };
    if (sessionToken) headers["X-Amz-Security-Token"] = sessionToken;

    try {
      const res = await fetch(endpoint, { method: "POST", headers, body: payload });
      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(`AWS Rekognition error ${res.status}: ${text}`);
        return null;
      }
      const body = (await res.json()) as {
        FaceDetails?: Array<{
          Confidence?: number;
          Quality?: { Brightness?: number; Sharpness?: number };
        }>;
      };
      const top = body.FaceDetails?.[0];
      if (!top) {
        return {
          faceDetected: false,
          confidence: null,
          brightness: null,
          sharpness: null
        };
      }
      return {
        faceDetected: true,
        confidence: top.Confidence ?? null,
        brightness: top.Quality?.Brightness ?? null,
        sharpness: top.Quality?.Sharpness ?? null
      };
    } catch (error) {
      this.logger.warn(
        `AWS Rekognition request failed: ${error instanceof Error ? error.message : "unknown"}`
      );
      return null;
    }
  }

  private formatAmzDate(date: Date) {
    return date
      .toISOString()
      .replace(/[:-]|\.\d{3}/g, "")
      .replace("Z", "Z");
  }

  private sha256Hex(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private getAwsSignatureKey(key: string, dateStamp: string, region: string, service: string) {
    const kDate = createHmac("sha256", `AWS4${key}`).update(dateStamp).digest();
    const kRegion = createHmac("sha256", kDate).update(region).digest();
    const kService = createHmac("sha256", kRegion).update(service).digest();
    return createHmac("sha256", kService).update("aws4_request").digest();
  }

  private cleanupExpiredTickets() {
    const now = Date.now();
    for (const [key, value] of this.cachedAnalyses.entries()) {
      if (value.expiresAt < now) {
        this.cachedAnalyses.delete(key);
      }
    }
  }
}
