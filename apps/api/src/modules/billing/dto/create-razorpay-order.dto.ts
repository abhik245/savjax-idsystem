import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateRazorpayOrderDto {
  @IsString()
  invoiceId!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  receipt?: string;
}
