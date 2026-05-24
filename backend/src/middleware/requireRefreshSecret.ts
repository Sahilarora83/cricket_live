import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export function requireRefreshSecret(request: Request, response: Response, next: NextFunction) {
  if (!env.REFRESH_SECRET) {
    response.status(503).json({ error: "Refresh endpoint is disabled until REFRESH_SECRET is configured." });
    return;
  }

  const token = request.header("x-refresh-secret") || request.header("x-admin-secret") || String(request.query.secret || "");
  if (token !== env.REFRESH_SECRET) {
    response.status(401).json({ error: "Invalid refresh secret." });
    return;
  }

  next();
}
