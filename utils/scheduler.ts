import InstantEventModel from "../models/instantEvent.model";
import LeaderboardModel from "../models/leaderboard.model";
import PuzzleAttemptModel from "../models/puzzleAttempt.model";
import UserModel from "../models/user.model";

// Polling scheduler to manage instant events: start events, finalize ended events.
export const startScheduler = () => {
  // run every 30 seconds
  setInterval(async () => {
    try {
      const now = new Date();

      // start pending events whose startAt <= now
      const toStart = await InstantEventModel.find({
        status: "pending",
        startAt: { $lte: now },
      });
      for (const ev of toStart) {
        ev.status = "running";
        await ev.save();
      }

      // finalize running events whose endAt <= now
      const toFinalize = await InstantEventModel.find({
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
          if (found) p.prizeEarned = share;

          // update user analytics: add attempt and if winner add points
          try {
            const user = await UserModel.findById(p.userId);
            if (user) {
              user.analytics.lifetime.attempts =
                (user.analytics.lifetime.attempts || 0) + 1;
              if (found) {
                user.analytics.lifetime.totalPoints =
                  (user.analytics.lifetime.totalPoints || 0) + 1;
              }
              await user.save();
            }
          } catch (err) {
            // ignore
          }
        }

        ev.status = "finished";
        await ev.save();

        // save instant leaderboard doc
        const entries = ranked.map((r) => ({
          userId: r.userId,
          puzzlesSolved: 1,
          points: r.prizeEarned || 0,
        }));
        await LeaderboardModel.create({
          type: "instant",
          date: now.toISOString(),
          entries,
          instantEventId: String(ev._id),
        });
      }
    } catch (err) {
      // swallow scheduler errors but log
      // eslint-disable-next-line no-console
      console.error("Scheduler error:", err);
    }
  }, 30 * 1000);
};
