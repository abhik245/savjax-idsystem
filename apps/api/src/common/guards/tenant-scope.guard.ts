import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AccessControlService } from "../access/access-control.service";
import { AuthenticatedUser } from "../auth/auth-user.type";
import { hasGlobalTenantAccess } from "../auth/role.utils";
import { TENANT_SCOPE_KEY, TenantScopeOptions } from "../decorators/tenant-scope.decorator";

@Injectable()
export class TenantScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessControlService: AccessControlService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<TenantScopeOptions>(TENANT_SCOPE_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!options) return true;

    const req = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      params?: Record<string, string | undefined>;
      query?: Record<string, string | undefined>;
      body?: Record<string, string | undefined>;
    }>();
    const user = req.user;
    if (!user) return false;
    if (hasGlobalTenantAccess(user.normalizedRole)) return true;

    const schoolIds = options.sources
      .map((source) => {
        if (source.type === "param") return req.params?.[source.key];
        if (source.type === "query") return req.query?.[source.key];
        return req.body?.[source.key];
      })
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());

    if (schoolIds.length === 0) return options.optional ?? true;
    schoolIds.forEach((schoolId) => this.accessControlService.assertSchoolAccess(user, schoolId));
    return true;
  }
}
