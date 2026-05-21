import mongoose from "mongoose";

const liveScoreSchema = new mongoose.Schema(
  {
    matchId: { type: String, required: true, index: true },
    innings: String,
    battingTeam: String,
    score: String,
    runs: Number,
    wickets: Number,
    overs: String,
    runRate: String,
    target: String,
    statusText: String,
    batters: Array,
    bowler: Object,
    partnership: String,
    source: String,
    scrapedAt: { type: Date, index: true }
  },
  { timestamps: true }
);

export const LiveScoreModel = mongoose.model("LiveScore", liveScoreSchema);
