import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { OverviewController } from "./overview.controller";
import { OverviewService } from "./overview.service";
import { FaceIntelligenceService } from "../../common/services/face-intelligence.service";
import { TemplateRenderService } from "../../common/services/template-render.service";

@Module({
  imports: [PrismaModule],
  controllers: [AdminController, OverviewController],
  providers: [AdminService, OverviewService, FaceIntelligenceService, TemplateRenderService]
})
export class AdminModule {}
