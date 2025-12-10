import Redis from "ioredis";
import "dotenv/config";

// Function to configure Redis client
const createRedisClient = () => {
  if (process.env.NODE_ENV === "test") {
    // ioredis-mock exports a constructor compatible with ioredis
    // require here to avoid loading in production
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RedisMock = require("ioredis-mock");
    return new RedisMock();
  }

  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL);
  }

  // Fallback: create a local client if REDIS_URL provided as undefined (will error)
  return new Redis();
};

export const redis = createRedisClient();

// Function to close Redis connection
export const closeRedisConnection = async () => {
  try {
    if (redis && typeof redis.quit === "function") {
      await redis.quit();
    }
  } catch (error) {
    // ignore errors on shutdown
  }
};
