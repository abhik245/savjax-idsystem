import { IsBoolean, IsOptional } from "class-validator";

export class ActivateTemplateDto {
  @IsOptional()
  @IsBoolean()
  deactivateOthers?: boolean;
}
