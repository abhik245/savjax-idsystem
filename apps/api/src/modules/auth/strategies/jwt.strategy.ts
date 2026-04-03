import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AccessControlService } from "../../../common/access/access-control.service";
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
    private readonly accessControlService: AccessControlService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractJwtFromCookies
      ]),
      secretOrKey: configService.getOrThrow<string>("JWT_ACCESS_SECRET")
    });
  }

  async validate(payload: JwtPayload) {
    const scope = await this.accessControlService.getUserScope(payload.sub);
    return {
      ...scope,
      sessionId: payload.sid
    };
  }
}
