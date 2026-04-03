import { Global, Module } from "@nestjs/common";
import { AccessControlService } from "./access-control.service";
import { DataProtectionService } from "../services/data-protection.service";

@Global()
@Module({
  providers: [AccessControlService, DataProtectionService],
  exports: [AccessControlService, DataProtectionService]
})
export class AccessControlModule {}
