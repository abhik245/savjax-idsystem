import { IsString, Matches, MinLength } from "class-validator";

export class VerifyIntakeOtpDto {
  @IsString()
  @MinLength(8)
  authSessionId!: string;

  @Matches(/^\d{6}$/)
  otp!: string;
}
