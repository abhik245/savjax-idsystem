import { IsString } from "class-validator";

export class ApplyWorkflowRuleDto {
  @IsString()
  studentId!: string;
}
