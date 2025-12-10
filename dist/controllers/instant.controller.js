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
exports.submitInstantResult = exports.joinInstantEvent = exports.createInstantEvent = void 0;
const catchAsyncError_1 = require("../middlewares/catchAsyncError");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const instantEvent_model_1 = __importDefault(require("../models/instantEvent.model"));
const leaderboard_model_1 = __importDefault(require("../models/leaderboard.model"));
// create instant event
exports.createInstantEvent = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, campaignId, entryAmount, startAt, endAt } = req.body;
        const event = yield instantEvent_model_1.default.create({
            title,
            campaignId,
            entryAmount: Number(entryAmount),
            startAt: new Date(startAt),
            endAt: new Date(endAt),
            participants: [],
            prizePool: 0,
            status: "pending",
        });
        res.status(201).json({ success: true, event });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// join event
exports.joinInstantEvent = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { eventId } = req.params;
        const user = req.user;
        const userId = user && user._id ? String(user._id) : undefined;
        if (!userId)
            return next(new ErrorHandler_1.default("Invalid user session", 401));
        const event = yield instantEvent_model_1.default.findById(eventId);
        if (!event)
            return next(new ErrorHandler_1.default("Event not found", 404));
        if (event.status !== "pending")
            return next(new ErrorHandler_1.default("Event not open for joining", 400));
        // add participant and add to prize pool
        event.participants.push({
            userId: userId,
            joinedAt: new Date(),
            submitted: false,
        });
        event.prizePool = (event.prizePool || 0) + (event.entryAmount || 0);
        yield event.save();
        res.status(200).json({ success: true, event });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// submit instant result (user submits time & moves)
exports.submitInstantResult = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { eventId } = req.params;
        const { timeTaken, movesTaken } = req.body;
        const user = req.user;
        const userId = user && user._id ? String(user._id) : undefined;
        if (!userId)
            return next(new ErrorHandler_1.default("Invalid user session", 401));
        const event = yield instantEvent_model_1.default.findById(eventId);
        if (!event)
            return next(new ErrorHandler_1.default("Event not found", 404));
        // find participant
        const p = event.participants.find((pp) => String(pp.userId) === userId);
        if (!p)
            return next(new ErrorHandler_1.default("User not a participant", 400));
        p.timeTaken = timeTaken;
        p.movesTaken = movesTaken;
        p.submitted = true;
        yield event.save();
        // if event ended or all participants submitted, finalize
        const now = new Date();
        const shouldFinalize = now >= event.endAt ||
            event.participants.every((pp) => pp.submitted === true);
        if (shouldFinalize && event.status !== "finished") {
            // rank participants by timeTaken asc then movesTaken asc
            const ranked = event.participants
                .filter((pp) => typeof pp.timeTaken === "number")
                .sort((a, b) => {
                if ((a.timeTaken || 0) !== (b.timeTaken || 0))
                    return (a.timeTaken || 0) - (b.timeTaken || 0);
                return (a.movesTaken || 0) - (b.movesTaken || 0);
            });
            const winners = ranked.slice(0, 3);
            const share = winners.length
                ? Math.floor((event.prizePool || 0) / winners.length)
                : 0;
            for (const w of winners) {
                w.prizeEarned = share;
            }
            event.status = "finished";
            yield event.save();
            // save instant leaderboard
            const entries = ranked.map((r) => ({
                userId: r.userId,
                puzzlesSolved: 1,
                points: r.prizeEarned || 0,
            }));
            yield leaderboard_model_1.default.create({
                type: "instant",
                date: new Date().toISOString(),
                entries,
                instantEventId: String(event._id),
            });
        }
        res.status(200).json({ success: true, event });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
