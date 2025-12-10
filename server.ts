import { app } from "./app";
import "dotenv/config";
import connectDB from "./utils/db";
import LeaderboardModel from "./models/leaderboard.model";
import { startScheduler } from "./utils/scheduler";

//create server
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server is connected http://localhost:${process.env.PORT}`);
  connectDB();
  // schedule daily leaderboard reset at local midnight
  const scheduleDailyReset = async () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const delay = next.getTime() - now.getTime();

    setTimeout(async function resetAndSchedule() {
      try {
        const todayKey = new Date().toISOString().slice(0, 10);
        // keep today's leaderboard; remove older daily leaderboards
        await LeaderboardModel.deleteMany({
          type: "daily",
          date: { $ne: todayKey },
        });
        console.log("Daily leaderboard reset completed");
      } catch (err) {
        console.error("Error resetting daily leaderboard:", err);
      }
      // schedule next run in 24h
      setTimeout(resetAndSchedule, 24 * 60 * 60 * 1000);
    }, delay);
  };

  scheduleDailyReset();
  // start instant event scheduler
  startScheduler();
});
