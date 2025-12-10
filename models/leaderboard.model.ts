import mongoose, { Document, Model, Schema } from "mongoose";

export interface ILeaderboard extends Document {
  type: "daily" | "instant";
  date: string; // ISO date for daily
  entries: {
    userId: string;
    puzzlesSolved: number;
    points: number;
  }[];
  instantEventId?: string;
}

const leaderboardSchema: Schema<ILeaderboard> = new mongoose.Schema(
  {
    type: { type: String, enum: ["daily", "instant"], required: true },
    date: { type: String, required: true },
    entries: [
      {
        userId: { type: String, required: true },
        puzzlesSolved: { type: Number, default: 0 },
        points: { type: Number, default: 0 },
      },
    ],
    instantEventId: { type: String },
  },
  { timestamps: true }
);

leaderboardSchema.index({ type: 1, date: 1 });

const LeaderboardModel: Model<ILeaderboard> = mongoose.model(
  "Leaderboard",
  leaderboardSchema
);

export default LeaderboardModel;
