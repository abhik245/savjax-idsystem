import { OrderStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdatePrintJobStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  notes?: string;
}
