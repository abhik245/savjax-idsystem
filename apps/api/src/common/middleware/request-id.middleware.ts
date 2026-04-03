import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers["x-request-id"];
  const requestId = Array.isArray(incoming) ? incoming[0] : incoming || randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
