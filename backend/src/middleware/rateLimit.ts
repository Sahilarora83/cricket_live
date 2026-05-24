import type { NextFunction, Request, Response } from "express";

type Bucket = {
  count: number;
  resetAt: number;
};

export function createRateLimit(options: { windowMs: number; max: number; name: string }) {
  const buckets = new Map<string, Bucket>();

  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${options.name}:${clientIp(request)}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      response.setHeader("x-rate-limit-limit", String(options.max));
      response.setHeader("x-rate-limit-remaining", String(Math.max(options.max - 1, 0)));
      next();
      return;
    }

    if (bucket.count >= options.max) {
      const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);
      response.setHeader("retry-after", String(retryAfterSeconds));
      response.status(429).json({ error: "Too many requests. Please try again later." });
      return;
    }

    bucket.count += 1;
    response.setHeader("x-rate-limit-limit", String(options.max));
    response.setHeader("x-rate-limit-remaining", String(Math.max(options.max - bucket.count, 0)));
    next();
  };
}

function clientIp(request: Request) {
  const forwarded = request.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.ip || request.socket.remoteAddress || "unknown";
}
