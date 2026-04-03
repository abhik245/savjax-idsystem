import { IsBoolean, IsOptional } from "class-validator";

export class MarkPrintJobIssuedDto {
  @IsOptional()
  @IsBoolean()
  reissued?: boolean;
}
