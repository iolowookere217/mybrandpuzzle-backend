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
const app_1 = require("./app");
require("dotenv/config");
const db_1 = __importDefault(require("./utils/db"));
const leaderboard_model_1 = __importDefault(require("./models/leaderboard.model"));
const scheduler_1 = require("./utils/scheduler");
//create server
const PORT = process.env.PORT || 4000;
app_1.app.listen(PORT, () => {
    console.log(`Server is connected http://localhost:${process.env.PORT}`);
    (0, db_1.default)();
    // schedule daily leaderboard reset at local midnight
    const scheduleDailyReset = () => __awaiter(void 0, void 0, void 0, function* () {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const delay = next.getTime() - now.getTime();
        setTimeout(function resetAndSchedule() {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const todayKey = new Date().toISOString().slice(0, 10);
                    // keep today's leaderboard; remove older daily leaderboards
                    yield leaderboard_model_1.default.deleteMany({
                        type: "daily",
                        date: { $ne: todayKey },
                    });
                    console.log("Daily leaderboard reset completed");
                }
                catch (err) {
                    console.error("Error resetting daily leaderboard:", err);
                }
                // schedule next run in 24h
                setTimeout(resetAndSchedule, 24 * 60 * 60 * 1000);
            });
        }, delay);
    });
    scheduleDailyReset();
    // start instant event scheduler
    (0, scheduler_1.startScheduler)();
});
