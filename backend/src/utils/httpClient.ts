import axios from "axios";
import { env } from "../config/env.js";

const CRICBUZZ_HEADERS = {
  "User-Agent": "Mozilla/5.0 cricket-live-system/1.0",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};

export async function fetchCricbuzzHtml(url: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= env.CRICBUZZ_REQUEST_RETRIES; attempt += 1) {
    try {
      const { data } = await axios.get<string>(url, {
        headers: CRICBUZZ_HEADERS,
        timeout: env.CRICBUZZ_REQUEST_TIMEOUT_MS
      });
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < env.CRICBUZZ_REQUEST_RETRIES) {
        await wait(500 * 2 ** attempt);
      }
    }
  }

  throw lastError;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
