import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middlewares/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import InstantEventModel from "../models/instantEvent.model";
import LeaderboardModel from "../models/leaderboard.model";

// create instant event
export const createInstantEvent = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, campaignId, entryAmount, startAt, endAt } = req.body;
      const event = await InstantEventModel.create({
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
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// join event
export const joinInstantEvent = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const user = req.user as any;
      const userId = user && user._id ? String(user._id) : undefined;
      if (!userId) return next(new ErrorHandler("Invalid user session", 401));
      const event = await InstantEventModel.findById(eventId);
      if (!event) return next(new ErrorHandler("Event not found", 404));
      if (event.status !== "pending")
        return next(new ErrorHandler("Event not open for joining", 400));

      // add participant and add to prize pool
      event.participants.push({
        userId: userId,
        joinedAt: new Date(),
        submitted: false,
      });
      event.prizePool = (event.prizePool || 0) + (event.entryAmount || 0);
      await event.save();

      res.status(200).json({ success: true, event });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// submit instant result (user submits time & moves)
export const submitInstantResult = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const { timeTaken, movesTaken } = req.body;
      const user = req.user as any;
      const userId = user && user._id ? String(user._id) : undefined;
      if (!userId) return next(new ErrorHandler("Invalid user session", 401));
      const event = await InstantEventModel.findById(eventId);
      if (!event) return next(new ErrorHandler("Event not found", 404));

      // find participant
      const p = event.participants.find((pp) => String(pp.userId) === userId);
      if (!p) return next(new ErrorHandler("User not a participant", 400));
      p.timeTaken = timeTaken;
      p.movesTaken = movesTaken;
      p.submitted = true;
      await event.save();

      // if event ended or all participants submitted, finalize
      const now = new Date();
      const shouldFinalize =
        now >= event.endAt ||
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
        await event.save();

        // save instant leaderboard
        const entries = ranked.map((r) => ({
          userId: r.userId,
          puzzlesSolved: 1,
          points: r.prizeEarned || 0,
        }));
        await LeaderboardModel.create({
          type: "instant",
          date: new Date().toISOString(),
          entries,
          instantEventId: String(event._id),
        });
      }

      res.status(200).json({ success: true, event });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
