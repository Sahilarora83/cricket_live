import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
  {
    providerId: { type: String, required: true, unique: true, index: true },
    team1: { type: String, required: true },
    team2: { type: String, required: true },
    status: { type: String, required: true },
    matchType: String,
    series: String,
    startTime: Date,
    venue: String,
    detailUrl: String,
    rawText: String,
    embeddedScore: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

export const MatchModel = mongoose.model("Match", matchSchema);
