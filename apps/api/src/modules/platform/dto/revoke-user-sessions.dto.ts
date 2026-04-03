import { IsBoolean, IsOptional, IsString } from "class-validator";

export class RevokeUserSessionsDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsBoolean()
  revokeMfa?: boolean;
}
