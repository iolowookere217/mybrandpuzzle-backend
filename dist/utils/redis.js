"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeRedisConnection = exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
require("dotenv/config");
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
        return new ioredis_1.default(process.env.REDIS_URL);
    }
    // Fallback: create a local client if REDIS_URL provided as undefined (will error)
    return new ioredis_1.default();
};
exports.redis = createRedisClient();
// Function to close Redis connection
const closeRedisConnection = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (exports.redis && typeof exports.redis.quit === "function") {
            yield exports.redis.quit();
        }
    }
    catch (error) {
        // ignore errors on shutdown
    }
});
exports.closeRedisConnection = closeRedisConnection;
