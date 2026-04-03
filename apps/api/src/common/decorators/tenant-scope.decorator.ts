import { SetMetadata } from "@nestjs/common";

export type TenantScopeSourceType = "param" | "query" | "body";

export type TenantScopeSource = {
  type: TenantScopeSourceType;
  key: string;
};

export type TenantScopeOptions = {
  sources: TenantScopeSource[];
  optional?: boolean;
};

export const TENANT_SCOPE_KEY = "tenant_scope_options";

export const TenantScope = (options: TenantScopeOptions) => SetMetadata(TENANT_SCOPE_KEY, options);
