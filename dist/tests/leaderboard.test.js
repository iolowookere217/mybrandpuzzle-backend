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
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../app");
const setup_1 = require("./setup");
const puzzleCampaign_model_1 = __importDefault(require("../models/puzzleCampaign.model"));
describe("Leaderboard flows", () => {
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, setup_1.connectTestDB)();
    }));
    afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, setup_1.clearTestDB)();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, setup_1.closeTestDB)();
    }));
    it("should show user on daily leaderboard after first-time solve", () => __awaiter(void 0, void 0, void 0, function* () {
        const campaign = yield puzzleCampaign_model_1.default.create({
            brandId: "brand-1",
            title: "Test Puzzle Campaign",
            description: "A test puzzle campaign for leaderboard tests",
            puzzleImageUrl: "http://example.com/puzzle.png",
            originalImageUrl: "http://example.com/orig.png",
            timeLimit: 24,
            questions: [
                { question: "q1", choices: ["a", "b", "c"], correctIndex: 1 },
                { question: "q2", choices: ["a", "b", "c"], correctIndex: 0 },
                { question: "q3", choices: ["a", "b", "c"], correctIndex: 2 },
            ],
        });
        // create gamer and submit solve
        const authRes = yield (0, supertest_1.default)(app_1.app).post("/api/v1/auth/google").send({
            email: "leader@test.local",
            name: "Leader",
            googleId: "gid-2",
        });
        const token = authRes.body.accessToken;
        yield (0, supertest_1.default)(app_1.app)
            .post(`/api/v1/puzzles/${campaign._id}/submit`)
            .set("Authorization", `Bearer ${token}`)
            .send({
            timeTaken: 1000,
            movesTaken: 5,
            solved: true,
            answers: [1, 0, 2],
        });
        const lbRes = yield (0, supertest_1.default)(app_1.app)
            .get("/api/v1/leaderboards/daily")
            .set("Authorization", `Bearer ${token}`);
        expect(lbRes.status).toBe(200);
        expect(lbRes.body.entries).toBeDefined();
        expect(lbRes.body.entries.length).toBeGreaterThanOrEqual(1);
        expect(lbRes.body.entries[0]).toHaveProperty("userId");
    }));
});
