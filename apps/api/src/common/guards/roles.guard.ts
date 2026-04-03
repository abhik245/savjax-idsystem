import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Role } from "../enums/role.enum";
import { normalizeRole } from "../auth/role.utils";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    const userRole = normalizeRole(req.user?.role);
    if (!userRole) return false;
    return requiredRoles.some((requiredRole) => normalizeRole(requiredRole) === userRole);
  }
}
