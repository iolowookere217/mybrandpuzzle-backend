"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstantLeaderboard = exports.getDailyLeaderboard = void 0;
const catchAsyncError_1 = require("../middlewares/catchAsyncError");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const puzzleAttempt_model_1 = __importDefault(require("../models/puzzleAttempt.model"));
const leaderboard_model_1 = __importDefault(require("../models/leaderboard.model"));
// compute daily leaderboard (for today)
exports.getDailyLeaderboard = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        // count firstTimeSolved attempts that occurred today grouped by user
        const agg = yield puzzleAttempt_model_1.default.aggregate([
            {
                $match: {
                    firstTimeSolved: true,
                    timestamp: { $gte: start, $lt: end },
                },
            },
            {
                $group: {
                    _id: "$userId",
                    puzzlesSolved: { $sum: 1 },
                    points: { $sum: "$pointsEarned" },
                },
            },
            { $sort: { puzzlesSolved: -1, points: -1 } },
            { $limit: 100 },
        ]);
        const entries = agg.map((a) => ({
            userId: a._id,
            puzzlesSolved: a.puzzlesSolved,
            points: a.points,
        }));
        // upsert leaderboard document for today
        const dateKey = start.toISOString().slice(0, 10);
        yield leaderboard_model_1.default.findOneAndUpdate({ type: "daily", date: dateKey }, { type: "daily", date: dateKey, entries }, { upsert: true });
        res.status(200).json({ success: true, entries });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
exports.getInstantLeaderboard = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { eventId } = req.params;
        const board = yield leaderboard_model_1.default.findOne({
            type: "instant",
            instantEventId: eventId,
        });
        if (!board)
            return res.status(200).json({ success: true, entries: [] });
        res.status(200).json({ success: true, entries: board.entries });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
