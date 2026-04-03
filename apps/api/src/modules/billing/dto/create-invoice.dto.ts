import { IsDateString, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateInvoiceDto {
  @IsString()
  schoolId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxPercent?: number;

  @IsDateString()
  dueAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

