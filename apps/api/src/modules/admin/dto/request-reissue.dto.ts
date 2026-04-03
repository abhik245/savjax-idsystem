import { IsString, MaxLength } from "class-validator";

export class RequestReissueDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
