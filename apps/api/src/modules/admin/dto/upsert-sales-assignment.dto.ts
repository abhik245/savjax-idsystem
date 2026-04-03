import { IsString, MinLength } from "class-validator";

export class UpsertSalesAssignmentDto {
  @IsString()
  @MinLength(5)
  salesPersonId!: string;

  @IsString()
  @MinLength(5)
  schoolId!: string;
}
