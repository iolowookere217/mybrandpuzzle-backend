import mongoose, { Document, Model, Schema } from "mongoose";

export interface IQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
}

export interface IPuzzleCampaign extends Document {
  brandId: string;
  title: string;
  description: string;
  puzzleImageUrl: string;
  originalImageUrl: string;
  questions: IQuestion[];
  timeLimit: number; // hours until campaign expires
  analytics: any;
}

const puzzleCampaignSchema: Schema<IPuzzleCampaign> = new mongoose.Schema(
  {
    brandId: { type: String, required: true },
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
    timeLimit: { type: Number, required: true },
    analytics: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// index for quick analytics by brand
puzzleCampaignSchema.index({ brandId: 1 });

const PuzzleCampaignModel: Model<IPuzzleCampaign> = mongoose.model(
  "PuzzleCampaign",
  puzzleCampaignSchema
);
export default PuzzleCampaignModel;
