import { IsBoolean, IsOptional } from "class-validator";

export class ActivateApprovalChainDto {
  @IsOptional()
  @IsBoolean()
  deactivateOthers?: boolean;
}
