import mongoose from "mongoose";

const apiKeyOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    purpose: { type: String, required: true, enum: ["create", "revoke"] },
    attempts: { type: Number, required: true, default: 0 },
    consumedAt: Date,
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
);

apiKeyOtpSchema.index({ email: 1, purpose: 1, createdAt: -1 });

export const ApiKeyOtpModel = mongoose.model("ApiKeyOtp", apiKeyOtpSchema);
