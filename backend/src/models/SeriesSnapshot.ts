import mongoose from "mongoose";

const seriesSnapshotSchema = new mongoose.Schema(
  {
    seriesId: { type: Number, required: true, unique: true, index: true },
    seriesName: { type: String, required: true },
    matches: Array,
    pointsTable: Array,
    squads: Array,
    assets: Array,
    scrapedAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

export const SeriesSnapshotModel = mongoose.model("SeriesSnapshot", seriesSnapshotSchema);
