import express from "express";
import {
  getWeeklyLeaderboard,
  getLeaderboardByWeek,
} from "../controllers/leaderboard.controller";

const router = express.Router();

// Public endpoints - no authentication required
router.get("/leaderboards/weekly", getWeeklyLeaderboard);
router.get("/leaderboards/weekly/:weekKey", getLeaderboardByWeek);

export default router;
