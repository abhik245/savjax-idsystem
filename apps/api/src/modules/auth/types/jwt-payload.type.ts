import { Role } from "../../../common/enums/role.enum";

export type JwtPayload = {
  sub: string;
  role: Role;
  normalizedRole?: Role;
  schoolId?: string;
  sid?: string;
};
