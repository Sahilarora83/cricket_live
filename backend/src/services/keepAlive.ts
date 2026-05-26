import { env } from "../config/env.js";

export function startKeepAlive() {
  if (!env.KEEP_ALIVE_URL) {
    return undefined;
  }

  const ping = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.KEEP_ALIVE_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(env.KEEP_ALIVE_URL!, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        console.warn(`Keep-alive ping returned ${response.status} ${response.statusText}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Keep-alive ping failed: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  };

  console.log(`Keep-alive enabled: ${env.KEEP_ALIVE_URL}`);
  void ping();

  const timer = setInterval(() => {
    void ping();
  }, env.KEEP_ALIVE_INTERVAL_MS);

  timer.unref?.();
  return timer;
}
