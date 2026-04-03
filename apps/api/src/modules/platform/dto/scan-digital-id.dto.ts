import { IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class ScanDigitalIdDto {
  @IsString()
  token!: string;

  @IsString()
  scannerRole!: string;

  @IsOptional()
  @IsString()
  scannerUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
