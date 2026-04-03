import { Role } from "../enums/role.enum";

export type AuthenticatedUser = {
  sub: string;
  role: Role;
  normalizedRole: Role;
  schoolId?: string;
  parentId?: string;
  assignedSchoolIds: string[];
  permissions: string[];
  email?: string;
  name?: string | null;
  sessionId?: string;
};
