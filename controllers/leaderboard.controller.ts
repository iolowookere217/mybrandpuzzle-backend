import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middlewares/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import PuzzleAttemptModel from "../models/puzzleAttempt.model";
import LeaderboardModel from "../models/leaderboard.model";

// compute daily leaderboard (for today)
export const getDailyLeaderboard = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const today = new Date();
      const start = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

      // count firstTimeSolved attempts that occurred today grouped by user
      const agg = await PuzzleAttemptModel.aggregate([
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

      const entries = agg.map((a: any) => ({
        userId: a._id,
        puzzlesSolved: a.puzzlesSolved,
        points: a.points,
      }));

      // upsert leaderboard document for today
      const dateKey = start.toISOString().slice(0, 10);
      await LeaderboardModel.findOneAndUpdate(
        { type: "daily", date: dateKey },
        { type: "daily", date: dateKey, entries },
        { upsert: true }
      );

      res.status(200).json({ success: true, entries });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const getInstantLeaderboard = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const board = await LeaderboardModel.findOne({
        type: "instant",
        instantEventId: eventId,
      });
      if (!board) return res.status(200).json({ success: true, entries: [] });
      res.status(200).json({ success: true, entries: board.entries });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
