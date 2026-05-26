import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: "../.env" });
dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  REFRESH_SECRET: z.string().optional(),
  PUBLIC_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  PUBLIC_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
  DEVELOPER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  DEVELOPER_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  TRACK_MATCH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  TRACK_MATCH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
  CRICKET_PROVIDER: z.enum(["cricbuzz", "mock"]).default("cricbuzz"),
  CRICBUZZ_LIVE_URL: z.string().url().default("https://www.cricbuzz.com/cricket-match/live-scores"),
  CRICBUZZ_BASE_URL: z.string().url().default("https://www.cricbuzz.com"),
  CRICBUZZ_REQUEST_TIMEOUT_MS: z.coerce.number().default(15000),
  CRICBUZZ_REQUEST_RETRIES: z.coerce.number().default(2),
  REDIS_URL: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  MATCH_SCHEDULER_INTERVAL_MS: z.coerce.number().default(60000),
  SCORE_UPDATER_INTERVAL_MS: z.coerce.number().default(5000),
  SERIES_SCRAPER_INTERVAL_MS: z.coerce.number().default(600000),
  KEEP_ALIVE_URL: z.string().url().optional(),
  KEEP_ALIVE_INTERVAL_MS: z.coerce.number().int().min(60000).default(600000),
  KEEP_ALIVE_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
  COMMENTARY_LIMIT: z.coerce.number().default(30),
  API_REQUIRE_KEY: z
    .string()
    .transform((value) => value === "true")
    .default("false"),
  API_KEY_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  API_KEY_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(600),
  API_FREE_MONTHLY_QUOTA: z.coerce.number().default(10000),
  API_MAX_ACTIVE_KEYS_PER_EMAIL: z.coerce.number().int().min(1).default(1),
  API_KEY_DAILY_CREATE_LIMIT: z.coerce.number().int().min(1).default(3),
  API_KEY_CREATE_COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(60),
  API_KEY_REVOKE_COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(300),
  API_KEY_OTP_TTL_MINUTES: z.coerce.number().int().min(1).default(10),
  API_KEY_OTP_RESEND_SECONDS: z.coerce.number().int().min(10).default(60),
  API_KEY_OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_WEB_API_KEY: z.string().default("AIzaSyDqmvvnLzaRTdlRRXlqxbWkCa1cludK4_s"),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional()
});

export const env = schema.parse(process.env);
