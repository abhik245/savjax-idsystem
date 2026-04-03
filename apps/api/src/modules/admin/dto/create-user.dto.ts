import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { Role } from "../../../common/enums/role.enum";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  schoolId?: string;
}

