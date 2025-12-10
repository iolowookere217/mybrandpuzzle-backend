import mongoose, { Document, Model, Schema } from "mongoose";

export interface IPuzzleAttempt extends Document {
  userId: string;
  puzzleId: string;
  campaignId: string;
  timeTaken: number; // ms
  movesTaken: number;
  timestamp: Date;
  solved: boolean;
  firstTimeSolved: boolean;
  quizScore: number; // 0-3
  pointsEarned: number;
  answers?: number[]; // indexes selected by user for questions
}

const puzzleAttemptSchema: Schema<IPuzzleAttempt> = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    puzzleId: { type: String, required: true, index: true },
    campaignId: { type: String, required: true, index: true },
    timeTaken: { type: Number, default: 0 },
    movesTaken: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
    solved: { type: Boolean, default: false },
    firstTimeSolved: { type: Boolean, default: false },
    quizScore: { type: Number, default: 0 },
    pointsEarned: { type: Number, default: 0 },
    answers: { type: [Number], default: [] },
  },
  { timestamps: true }
);

// index for leaderboard queries
puzzleAttemptSchema.index({ campaignId: 1, timestamp: -1 });

const PuzzleAttemptModel: Model<IPuzzleAttempt> = mongoose.model(
  "PuzzleAttempt",
  puzzleAttemptSchema
);

export default PuzzleAttemptModel;
