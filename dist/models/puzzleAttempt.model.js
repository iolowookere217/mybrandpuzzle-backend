"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const puzzleAttemptSchema = new mongoose_1.default.Schema({
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
}, { timestamps: true });
// index for leaderboard queries
puzzleAttemptSchema.index({ campaignId: 1, timestamp: -1 });
const PuzzleAttemptModel = mongoose_1.default.model("PuzzleAttempt", puzzleAttemptSchema);
exports.default = PuzzleAttemptModel;
