import mongoose from "mongoose";

const commentarySchema = new mongoose.Schema(
  {
    matchId: { type: String, required: true, index: true },
    over: String,
    ball: String,
    event: String,
    description: { type: String, required: true }
  },
  { timestamps: true }
);

export const CommentaryModel = mongoose.model("Commentary", commentarySchema);
