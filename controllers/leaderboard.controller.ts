import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middlewares/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import PuzzleAttemptModel from "../models/puzzleAttempt.model";
import LeaderboardModel from "../models/leaderboard.model";

// Get current week's leaderboard
export const getWeeklyLeaderboard = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();

      // Calculate current week's start (Monday) and end (Sunday)
      const dayOfWeek = now.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday is 0, Monday is 1

      const weekStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - daysFromMonday
      );
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // Sunday

      // count firstTimeSolved attempts that occurred this week grouped by user
      const agg = await PuzzleAttemptModel.aggregate([
        {
          $match: {
            firstTimeSolved: true,
            timestamp: { $gte: weekStart, $lte: weekEnd },
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

      const entries = agg.map((a: any) => ({
        userId: a._id,
        puzzlesSolved: a.puzzlesSolved,
        points: a.points,
      }));

      // Create week key
      const weekKey = `${weekStart.toISOString().slice(0, 10)}_to_${weekEnd.toISOString().slice(0, 10)}`;

      // upsert leaderboard document for this week
      await LeaderboardModel.findOneAndUpdate(
        { type: "weekly", date: weekKey },
        { type: "weekly", date: weekKey, entries },
        { upsert: true }
      );

      res.status(200).json({
        success: true,
        leaderboard: {
          type: "weekly",
          weekStart: weekStart.toISOString().slice(0, 10),
          weekEnd: weekEnd.toISOString().slice(0, 10),
          totalPlayers: entries.length,
          entries,
        },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Get leaderboard for a specific week
export const getLeaderboardByWeek = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { weekKey } = req.params; // Format: "2025-01-06_to_2025-01-12"

      const board = await LeaderboardModel.findOne({
        type: "weekly",
        date: weekKey,
      });

      if (!board) {
        return res.status(200).json({
          success: true,
          leaderboard: {
            type: "weekly",
            weekKey,
            totalPlayers: 0,
            entries: [],
          },
        });
      }

      res.status(200).json({
        success: true,
        leaderboard: {
          type: "weekly",
          weekKey,
          totalPlayers: board.entries.length,
          entries: board.entries,
        },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
