import { IsString, Matches, MinLength } from "class-validator";

export class StartIntakeOtpDto {
  @IsString()
  @MinLength(4)
  intakeToken!: string;

  @Matches(/^\d{10}$/)
  mobile!: string;
}
