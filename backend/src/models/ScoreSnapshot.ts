import mongoose from "mongoose";

const scoreSnapshotSchema = new mongoose.Schema(
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
    scrapedAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

scoreSnapshotSchema.index({ matchId: 1, scrapedAt: -1 });

export const ScoreSnapshotModel = mongoose.model("ScoreSnapshot", scoreSnapshotSchema);
