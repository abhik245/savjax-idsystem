import { Module } from "@nestjs/common";
import { FaceIntelligenceService } from "../../common/services/face-intelligence.service";
import { TemplateRenderService } from "../../common/services/template-render.service";
import { TwilioVerifyService } from "../../common/services/twilio-verify.service";
import { ParentController } from "./parent.controller";
import { PublicIntakeController } from "./public-intake.controller";
import { ParentService } from "./parent.service";
import { PublicIntakeService } from "./public-intake.service";

@Module({
  controllers: [ParentController, PublicIntakeController],
  providers: [ParentService, PublicIntakeService, FaceIntelligenceService, TemplateRenderService, TwilioVerifyService],
  exports: [ParentService]
})
export class ParentModule {}
