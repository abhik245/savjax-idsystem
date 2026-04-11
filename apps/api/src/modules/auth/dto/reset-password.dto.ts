import { IsString, MinLength, Matches, MaxLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  @MinLength(32)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?`~]).{8,}$/,
    {
      message:
        "Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, a number, and a special character"
    }
  )
  password!: string;
}
