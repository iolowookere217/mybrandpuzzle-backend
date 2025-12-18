import mongoose, { Document, Model, Schema } from "mongoose";

export interface IQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
}

export interface IPuzzleCampaign extends Document {
  brandId: string;
  gameType: "sliding_puzzle" | "card_matching" | "whack_a_mole" | "word_hunt";
  title: string;
  description: string;
  puzzleImageUrl: string;
  originalImageUrl: string;
  questions: IQuestion[];
  words?: string[]; // for word_hunt games only
  timeLimit: number; // hours until campaign expires
  analytics: any;
}

const puzzleCampaignSchema: Schema<IPuzzleCampaign> = new mongoose.Schema(
  {
    brandId: { type: String, required: true },
    gameType: {
      type: String,
      enum: ["sliding_puzzle", "card_matching", "whack_a_mole", "word_hunt"],
      required: true,
      default: "sliding_puzzle",
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
    words: [{ type: String }], // for word_hunt games
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
