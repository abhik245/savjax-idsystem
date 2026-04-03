import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class DispatchPrintDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  studentIds!: string[];

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  batchCode?: string;

  @IsOptional()
  @IsIn(["CARD_54x86", "A4", "A3"])
  sheetType?: "CARD_54x86" | "A4" | "A3";

  @IsOptional()
  @IsIn(["GRID", "SHEET"])
  layoutMode?: "GRID" | "SHEET";

  @IsOptional()
  @IsString()
  @MaxLength(600)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  forceRequeue?: boolean;
}
