import mongoose, { Document, Model, Schema } from "mongoose";

export interface IInstantParticipant {
  userId: string;
  joinedAt: Date;
  timeTaken?: number;
  movesTaken?: number;
  submitted?: boolean;
  prizeEarned?: number;
}

export interface IInstantEvent extends Document {
  title?: string;
  campaignId?: string;
  entryAmount: number;
  startAt: Date;
  endAt: Date;
  participants: IInstantParticipant[];
  prizePool: number;
  status: "pending" | "running" | "finished";
}

const instantEventSchema: Schema<IInstantEvent> = new mongoose.Schema(
  {
    title: { type: String },
    campaignId: { type: String },
    entryAmount: { type: Number, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    participants: [
      {
        userId: { type: String, required: true },
        joinedAt: { type: Date, required: true },
        timeTaken: { type: Number },
        movesTaken: { type: Number },
        submitted: { type: Boolean, default: false },
        prizeEarned: { type: Number, default: 0 },
      },
    ],
    prizePool: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "running", "finished"],
      default: "pending",
    },
  },
  { timestamps: true }
);

instantEventSchema.index({ startAt: 1, endAt: 1 });

const InstantEventModel: Model<IInstantEvent> = mongoose.model(
  "InstantEvent",
  instantEventSchema
);

export default InstantEventModel;
