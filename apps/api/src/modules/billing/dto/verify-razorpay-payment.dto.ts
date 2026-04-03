import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class VerifyRazorpayPaymentDto {
  @IsString()
  razorpayOrderId!: string;

  @IsString()
  razorpayPaymentId!: string;

  @IsString()
  razorpaySignature!: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amountPaid?: number;
}
