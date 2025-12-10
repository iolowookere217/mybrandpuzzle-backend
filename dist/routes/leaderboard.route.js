"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const leaderboard_controller_1 = require("../controllers/leaderboard.controller");
const auth_1 = require("../utils/auth");
const router = express_1.default.Router();
router.get("/leaderboards/daily", auth_1.isAuthenticated, leaderboard_controller_1.getDailyLeaderboard);
router.get("/leaderboards/instant/:eventId", auth_1.isAuthenticated, leaderboard_controller_1.getInstantLeaderboard);
exports.default = router;
