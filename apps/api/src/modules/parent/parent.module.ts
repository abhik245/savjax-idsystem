import { Module } from "@nestjs/common";
import { FaceIntelligenceService } from "../../common/services/face-intelligence.service";
import { TemplateRenderService } from "../../common/services/template-render.service";
import { ParentController } from "./parent.controller";
import { ParentService } from "./parent.service";

@Module({
  controllers: [ParentController],
  providers: [ParentService, FaceIntelligenceService, TemplateRenderService],
  exports: [ParentService]
})
export class ParentModule {}
