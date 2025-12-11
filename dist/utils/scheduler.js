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
exports.startScheduler = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const instantEvent_model_1 = __importDefault(require("../models/instantEvent.model"));
const leaderboard_model_1 = __importDefault(require("../models/leaderboard.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
// Polling scheduler to manage instant events: start events, finalize ended events.
const startScheduler = () => {
    // run every 30 seconds
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            // Skip if database is not connected
            if (mongoose_1.default.connection.readyState !== 1) {
                return;
            }
            const now = new Date();
            // start pending events whose startAt <= now
            const toStart = yield instantEvent_model_1.default.find({
                status: "pending",
                startAt: { $lte: now },
            });
            for (const ev of toStart) {
                ev.status = "running";
                yield ev.save();
            }
            // finalize running events whose endAt <= now
            const toFinalize = yield instantEvent_model_1.default.find({
                status: "running",
                endAt: { $lte: now },
            });
            for (const ev of toFinalize) {
                // rank participants by timeTaken asc, then movesTaken asc
                const ranked = ev.participants
                    .filter((p) => typeof p.timeTaken === "number")
                    .sort((a, b) => {
                    if ((a.timeTaken || 0) !== (b.timeTaken || 0))
                        return (a.timeTaken || 0) - (b.timeTaken || 0);
                    return (a.movesTaken || 0) - (b.movesTaken || 0);
                });
                const winners = ranked.slice(0, 3);
                const share = winners.length
                    ? Math.floor((ev.prizePool || 0) / winners.length)
                    : 0;
                // persist prizeEarned on participants and update user analytics
                for (const p of ev.participants) {
                    const found = winners.find((w) => w.userId === p.userId);
                    if (found)
                        p.prizeEarned = share;
                    // update user analytics: add attempt and if winner add points
                    try {
                        const user = yield user_model_1.default.findById(p.userId);
                        if (user) {
                            user.analytics.lifetime.attempts =
                                (user.analytics.lifetime.attempts || 0) + 1;
                            if (found) {
                                user.analytics.lifetime.totalPoints =
                                    (user.analytics.lifetime.totalPoints || 0) + 1;
                            }
                            yield user.save();
                        }
                    }
                    catch (err) {
                        // ignore
                    }
                }
                ev.status = "finished";
                yield ev.save();
                // save instant leaderboard doc
                const entries = ranked.map((r) => ({
                    userId: r.userId,
                    puzzlesSolved: 1,
                    points: r.prizeEarned || 0,
                }));
                yield leaderboard_model_1.default.create({
                    type: "instant",
                    date: now.toISOString(),
                    entries,
                    instantEventId: String(ev._id),
                });
            }
        }
        catch (err) {
            // swallow scheduler errors but log
            // eslint-disable-next-line no-console
            console.error("Scheduler error:", err);
        }
    }), 30 * 1000);
};
exports.startScheduler = startScheduler;
