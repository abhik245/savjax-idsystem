import { IsString } from "class-validator";

export class BindTemplateCampaignDto {
  @IsString()
  intakeLinkId!: string;
}
