import { Matches } from "class-validator";

export class SendOtpDto {
  @Matches(/^\d{10}$/)
  mobile!: string;
}

