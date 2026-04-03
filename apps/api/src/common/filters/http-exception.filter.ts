import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = req.headers["x-request-id"];
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : { message: "Internal server error" };

    const payload =
      typeof exceptionResponse === "string"
        ? { message: exceptionResponse }
        : (exceptionResponse as Record<string, unknown>);

    this.logger.error(
      JSON.stringify({
        requestId,
        status,
        method: req.method,
        path: req.originalUrl,
        error: payload
      })
    );

    res.status(status).json({
      ...(payload || {}),
      statusCode: status,
      requestId
    });
  }
}
