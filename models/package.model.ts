import mongoose, { Document, Model, Schema } from "mongoose";

export interface IPackage extends Document {
  name: string;
  amount: number;
  duration: number; // in weeks
  description?: string;
  isActive: boolean;
}

const packageSchema: Schema<IPackage> = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    duration: { type: Number, required: true }, // in weeks
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const PackageModel: Model<IPackage> = mongoose.model("Package", packageSchema);
export default PackageModel;
