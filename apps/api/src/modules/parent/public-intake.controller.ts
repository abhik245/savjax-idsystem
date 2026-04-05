import { Body, Controller, Get, Headers, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { AnalyzePhotoDto } from "./dto/analyze-photo.dto";
import { SaveIntakeDraftDto } from "./dto/save-intake-draft.dto";
import { StartIntakeOtpDto } from "./dto/start-intake-otp.dto";
import { SubmitStudentDto } from "./dto/submit-student.dto";
import { PublicIntakeService } from "./public-intake.service";
import { VerifyIntakeOtpDto } from "./dto/verify-intake-otp.dto";

@Controller("intake-links")
export class PublicIntakeController {
  constructor(private readonly publicIntakeService: PublicIntakeService) {}

  @Post("auth/start-otp")
  startOtp(@Body() dto: StartIntakeOtpDto, @Req() req: Request) {
    return this.publicIntakeService.startOtp(dto, {
      ip: req.ip,
      userAgent: Array.isArray(req.headers["user-agent"]) ? req.headers["user-agent"][0] : req.headers["user-agent"]
    });
  }

  @Post("auth/verify-otp")
  verifyOtp(@Body() dto: VerifyIntakeOtpDto, @Req() req: Request) {
    return this.publicIntakeService.verifyOtp(dto, {
      ip: req.ip,
      userAgent: Array.isArray(req.headers["user-agent"]) ? req.headers["user-agent"][0] : req.headers["user-agent"]
    });
  }

  @Get("session")
  getSession(@Headers("x-intake-session-token") sessionToken: string, @Req() req: Request) {
    return this.publicIntakeService.getSessionContext(sessionToken, {
      ip: req.ip,
      userAgent: Array.isArray(req.headers["user-agent"]) ? req.headers["user-agent"][0] : req.headers["user-agent"]
    });
  }

  @Post("session/draft")
  saveDraft(
    @Headers("x-intake-session-token") sessionToken: string,
    @Body() dto: SaveIntakeDraftDto,
    @Req() req: Request
  ) {
    return this.publicIntakeService.saveDraft(sessionToken, dto, {
      ip: req.ip,
      userAgent: Array.isArray(req.headers["user-agent"]) ? req.headers["user-agent"][0] : req.headers["user-agent"]
    });
  }

  @Post("photo-analyze")
  analyzePhoto(
    @Headers("x-intake-session-token") sessionToken: string,
    @Body() dto: AnalyzePhotoDto,
    @Req() req: Request
  ) {
    return this.publicIntakeService.analyzePhoto(sessionToken, dto, {
      ip: req.ip,
      userAgent: Array.isArray(req.headers["user-agent"]) ? req.headers["user-agent"][0] : req.headers["user-agent"]
    });
  }

  @Post("submissions")
  submit(
    @Headers("x-intake-session-token") sessionToken: string,
    @Body() dto: SubmitStudentDto,
    @Req() req: Request
  ) {
    return this.publicIntakeService.submit(sessionToken, dto, {
      ip: req.ip,
      userAgent: Array.isArray(req.headers["user-agent"]) ? req.headers["user-agent"][0] : req.headers["user-agent"]
    });
  }
}
