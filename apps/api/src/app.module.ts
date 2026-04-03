import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { SchoolsModule } from "./modules/schools/schools.module";
import { BillingModule } from "./modules/billing/billing.module";
import { ParentModule } from "./modules/parent/parent.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AccessControlModule } from "./common/access/access-control.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { validateEnvConfig } from "./config/env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, expandVariables: true, validate: validateEnvConfig }),
    PrismaModule,
    AccessControlModule,
    AuthModule,
    SchoolsModule,
    BillingModule,
    ParentModule,
    DashboardModule,
    AdminModule,
    PlatformModule
  ]
})
export class AppModule {}
