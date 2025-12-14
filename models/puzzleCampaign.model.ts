import mongoose, { Document, Model, Schema } from "mongoose";

export interface IQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
}

export interface IPuzzleCampaign extends Document {
  brandId: string;
  gameType: "puzzle" | "wordHunt"; // game type: puzzle or word hunt
  title: string;
  description: string;
  puzzleImageUrl: string;
  originalImageUrl: string;
  questions: IQuestion[];
  words?: string[]; // for wordHunt games only
  timeLimit: number; // hours until campaign expires
  analytics: any;
}

const puzzleCampaignSchema: Schema<IPuzzleCampaign> = new mongoose.Schema(
  {
    brandId: { type: String, required: true },
    gameType: {
      type: String,
      enum: ["puzzle", "wordHunt"],
      required: true,
      default: "puzzle",
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    puzzleImageUrl: { type: String, required: true },
    originalImageUrl: { type: String, required: true },
    questions: [
      {
        question: { type: String, required: true },
        choices: [{ type: String }],
        correctIndex: { type: Number, required: true },
      },
    ],
    words: [{ type: String }], // for wordHunt games
    timeLimit: { type: Number, required: true },
    analytics: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// index for quick analytics by brand
puzzleCampaignSchema.index({ brandId: 1 });
// index for querying by game type
puzzleCampaignSchema.index({ gameType: 1 });

const PuzzleCampaignModel: Model<IPuzzleCampaign> = mongoose.model(
  "PuzzleCampaign",
  puzzleCampaignSchema
);
export default PuzzleCampaignModel;
