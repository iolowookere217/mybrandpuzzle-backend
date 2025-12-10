import express from "express";
import {
  getDailyLeaderboard,
  getInstantLeaderboard,
} from "../controllers/leaderboard.controller";
import { isAuthenticated } from "../utils/auth";

const router = express.Router();

router.get("/leaderboards/daily", isAuthenticated, getDailyLeaderboard);
router.get(
  "/leaderboards/instant/:eventId",
  isAuthenticated,
  getInstantLeaderboard
);

export default router;
