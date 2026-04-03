import { IsBoolean, IsOptional, IsString } from "class-validator";

export class RebindTemplateProofsDto {
  @IsOptional()
  @IsBoolean()
  onlyUnapproved?: boolean;

  @IsOptional()
  @IsString()
  intakeLinkId?: string;
}
