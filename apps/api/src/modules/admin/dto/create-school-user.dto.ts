import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { Role } from "../../../common/enums/role.enum";

export class CreateSchoolUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
