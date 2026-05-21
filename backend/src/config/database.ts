import mongoose from "mongoose";
import { env } from "./env.js";

let retryTimer: NodeJS.Timeout | undefined;
let connecting = false;

export async function connectDatabase() {
  if (!env.MONGODB_URI) {
    console.log("MongoDB disabled: MONGODB_URI is not set.");
    return;
  }

  await connectWithRetry();

  if (!retryTimer) {
    retryTimer = setInterval(() => {
      if (mongoose.connection.readyState === 0) {
        void connectWithRetry();
      }
    }, 15000);
    retryTimer.unref();
  }
}

export function getDatabaseStatus() {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return {
    configured: Boolean(env.MONGODB_URI),
    state: states[mongoose.connection.readyState] ?? "unknown",
    name: mongoose.connection.name || null,
    host: mongoose.connection.host || null
  };
}

async function connectWithRetry() {
  if (!env.MONGODB_URI || connecting || mongoose.connection.readyState === 1) return;

  connecting = true;
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000
    });
    console.log("MongoDB connected.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown MongoDB connection error";
    console.warn(`MongoDB unavailable, retrying in background: ${message}`);
  } finally {
    connecting = false;
  }
}
