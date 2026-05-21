import { env } from "../config/env.js";
import { CricbuzzProvider } from "./cricbuzzProvider.js";
import { MockProvider } from "./mockProvider.js";
import type { CricketProvider } from "./provider.js";

export function createProvider(): CricketProvider {
  if (env.CRICKET_PROVIDER === "mock") return new MockProvider();
  return new CricbuzzProvider();
}
