import mongoose from "mongoose";

const apiRequestLogSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    keyPrefix: { type: String, required: true, index: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    origin: String,
    status: { type: Number, required: true },
    message: String,
    createdAt: { type: Date, required: true, default: Date.now, expires: 60 * 60 * 24 * 30 }
  },
  { versionKey: false }
);

apiRequestLogSchema.index({ email: 1, createdAt: -1 });

export const ApiRequestLogModel = mongoose.model("ApiRequestLog", apiRequestLogSchema);
