import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: "../.env" });
dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
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
  COMMENTARY_LIMIT: z.coerce.number().default(30),
  API_FREE_MONTHLY_QUOTA: z.coerce.number().default(10000),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional()
});

export const env = schema.parse(process.env);
