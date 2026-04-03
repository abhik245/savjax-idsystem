import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import { Request, Response } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { SendOtpDto } from "./dto/send-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    return this.authService.login(dto, req, res);
  }

  @Post("company/login")
  companyLogin(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    return this.authService.login(dto, req, res, "company");
  }

  @Post("school/login")
  schoolLogin(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    return this.authService.login(dto, req, res, "school");
  }

  @Post("parent/send-otp")
  sendParentOtp(@Body() dto: SendOtpDto, @Req() req: Request) {
    return this.authService.sendParentOtp(dto, req);
  }

  @Post("parent/verify-otp")
  verifyParentOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    return this.authService.verifyParentOtp(dto, req, res);
  }

  @Post("refresh")
  refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    return this.authService.refreshToken(dto, req, res);
  }

  @Post("logout")
  logout(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.logout(dto, req, res);
  }

  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(dto, req);
  }

  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.resetPassword(dto, req, res);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() req: { user: AuthenticatedUser }) {
    return this.authService.me(req.user);
  }
}
