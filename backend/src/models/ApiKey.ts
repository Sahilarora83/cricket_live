import mongoose from "mongoose";

const apiKeySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    keyPrefix: { type: String, required: true, unique: true, index: true },
    keyHash: { type: String, required: true, unique: true, index: true },
    allowedOrigins: { type: [String], required: true, default: [] },
    plan: { type: String, required: true, default: "open-source" },
    monthlyQuota: { type: Number, required: true, default: 10000 },
    usageMonth: { type: String, required: true },
    usageCount: { type: Number, required: true, default: 0 },
    revoked: { type: Boolean, required: true, default: false },
    revokedAt: Date,
    lastUsedAt: Date
  },
  { timestamps: true }
);

apiKeySchema.index({ email: 1, revoked: 1 });
apiKeySchema.index({ email: 1, revoked: 1, usageMonth: 1 });

export const ApiKeyModel = mongoose.model("ApiKey", apiKeySchema);
