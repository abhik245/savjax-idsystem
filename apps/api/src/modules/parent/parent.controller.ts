import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ParentService } from "./parent.service";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { AnalyzePhotoDto } from "./dto/analyze-photo.dto";
import { SubmitStudentDto } from "./dto/submit-student.dto";

@Controller("parent")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PARENT)
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  @Post("submissions")
  submit(@Body() dto: SubmitStudentDto, @Req() req: { user: AuthenticatedUser }) {
    return this.parentService.submitStudent(dto, req.user);
  }

  @Post("photo/analyze")
  analyzePhoto(@Body() dto: AnalyzePhotoDto, @Req() req: { user: AuthenticatedUser }) {
    return this.parentService.analyzePhoto(dto, req.user);
  }

  @Get("submissions")
  listMine(@Req() req: { user: AuthenticatedUser }) {
    return this.parentService.listMySubmissions(req.user);
  }
}
