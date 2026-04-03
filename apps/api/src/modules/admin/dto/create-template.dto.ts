import { CardOrientation, InstitutionType, TemplateCardType, TemplateLifecycleStatus } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength
} from "class-validator";

export class CreateTemplateDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  templateCode?: string;

  @IsOptional()
  @IsEnum(InstitutionType)
  institutionType?: InstitutionType;

  @IsOptional()
  @IsEnum(TemplateCardType)
  cardType?: TemplateCardType;

  @IsOptional()
  @IsEnum(CardOrientation)
  orientation?: CardOrientation;

  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(500)
  cardWidthMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(500)
  cardHeightMm?: number;

  @IsOptional()
  @IsString()
  frontDesignUrl?: string;

  @IsOptional()
  @IsString()
  backDesignUrl?: string;

  @IsObject()
  mappingJson!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  frontLayoutJson?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  backLayoutJson?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(TemplateLifecycleStatus)
  status?: TemplateLifecycleStatus;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
