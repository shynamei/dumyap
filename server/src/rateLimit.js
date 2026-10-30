// Minimal in-memory fixed-window rate limiter keyed by client IP. Sufficient
// for a single-process local dev backend; not meant for production scale.

import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "./config.js";

const hits = new Map(); // ip -> { count, resetAt }

export function rateLimit(req, res, next) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now >= entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      error: "Too many transcription requests. Please wait and try again.",
    });
  }

  entry.count += 1;
  next();
}
