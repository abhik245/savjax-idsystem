import { Global, Module } from "@nestjs/common";
import { AccessControlService } from "./access-control.service";
import { DataProtectionService } from "../services/data-protection.service";
import { RateLimiterService } from "../services/rate-limiter.service";

@Global()
@Module({
  providers: [AccessControlService, DataProtectionService, RateLimiterService],
  exports: [AccessControlService, DataProtectionService, RateLimiterService]
})
export class AccessControlModule {}
