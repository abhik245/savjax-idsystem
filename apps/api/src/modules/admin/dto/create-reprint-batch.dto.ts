import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateReprintBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  studentIds!: string[];

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  sourcePrintJobId?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  batchCode?: string;
}
