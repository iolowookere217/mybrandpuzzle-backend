import express from "express";
import {
  getWeeklyLeaderboard,
  getLeaderboardByWeek,
} from "../controllers/leaderboard.controller";
import { isAuthenticated } from "../utils/auth";

const router = express.Router();

router.get("/leaderboards/weekly", isAuthenticated, getWeeklyLeaderboard);
router.get(
  "/leaderboards/weekly/:weekKey",
  isAuthenticated,
  getLeaderboardByWeek
);

export default router;
