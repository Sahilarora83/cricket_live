import { env } from "../config/env.js";

export class FirebaseAuthError extends Error {
  constructor(message = "Google sign-in verification failed") {
    super(message);
  }
}

type FirebaseLookupResponse = {
  users?: Array<{
    email?: string;
    emailVerified?: boolean;
  }>;
  error?: {
    message?: string;
  };
};

export async function verifyFirebaseIdToken(idToken: string) {
  const token = idToken.trim();
  if (!token) {
    throw new FirebaseAuthError("Google sign-in token is required");
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_WEB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token })
  });
  const payload = (await response.json()) as FirebaseLookupResponse;
  if (!response.ok) {
    throw new FirebaseAuthError(payload.error?.message || "Google sign-in verification failed");
  }

  const user = payload.users?.[0];
  const email = user?.email?.trim().toLowerCase();
  if (!email) {
    throw new FirebaseAuthError("Google account email is missing");
  }
  if (user?.emailVerified === false) {
    throw new FirebaseAuthError("Google account email is not verified");
  }

  return { email };
}
