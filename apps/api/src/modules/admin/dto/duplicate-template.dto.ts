import { IsOptional, IsString, MinLength } from "class-validator";

export class DuplicateTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  templateCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
