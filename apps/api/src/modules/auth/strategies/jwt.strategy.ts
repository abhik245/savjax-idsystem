import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AccessControlService } from "../../../common/access/access-control.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { JwtPayload } from "../types/jwt-payload.type";

function extractJwtFromCookies(req: Request) {
  const cookie = req?.headers?.cookie;
  if (!cookie) return null;
  const parts = cookie.split(";").map((chunk) => chunk.trim());
  const match = parts.find((part) => part.startsWith("nexid_access_token="));
  return match ? decodeURIComponent(match.slice("nexid_access_token=".length)) : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly accessControlService: AccessControlService,
    private readonly prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractJwtFromCookies
      ]),
      secretOrKey: configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      // Reject expired tokens — never allow clock-skew bypass
      ignoreExpiration: false
    });
  }

  async validate(payload: JwtPayload) {
    // ── Session revocation check ────────────────────────────────────────────
    // Every access token carries a session ID (sid). We verify the session
    // still exists and has not been revoked before granting access.
    // This ensures logout, forced-eviction, and password-reset all take
    // effect immediately — not just after the token naturally expires.
    if (payload.sid) {
      const session = await this.prisma.authSession.findUnique({
        where: { id: payload.sid },
        select: { id: true, revokedAt: true, userId: true }
      });

      if (!session) {
        throw new UnauthorizedException("Session not found — please log in again");
      }
      if (session.revokedAt) {
        throw new UnauthorizedException("Session has been revoked — please log in again");
      }
      // Extra safety: session must belong to the token's subject
      if (session.userId !== payload.sub) {
        throw new UnauthorizedException("Token/session mismatch");
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    const scope = await this.accessControlService.getUserScope(payload.sub);
    return {
      ...scope,
      sessionId: payload.sid
    };
  }
}
