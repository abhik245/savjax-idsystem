import { Matches } from "class-validator";

export class VerifyOtpDto {
  @Matches(/^\d{10}$/)
  mobile!: string;

  @Matches(/^\d{6}$/)
  otp!: string;
}

