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
const user_model_1 = __importDefault(require("../models/user.model"));
describe("Puzzle submission flow", () => {
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, setup_1.connectTestDB)();
    }));
    afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, setup_1.clearTestDB)();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, setup_1.closeTestDB)();
    }));
    it("should allow gamer to submit a puzzle and record attempt and analytics", () => __awaiter(void 0, void 0, void 0, function* () {
        // create a puzzle campaign directly
        const campaign = yield puzzleCampaign_model_1.default.create({
            brandId: "brand-1",
            title: "Test Puzzle Campaign",
            description: "A test puzzle campaign for unit tests",
            puzzleImageUrl: "http://example.com/puzzle.png",
            originalImageUrl: "http://example.com/orig.png",
            timeLimit: 24,
            questions: [
                { question: "q1", choices: ["a", "b", "c"], correctIndex: 1 },
                { question: "q2", choices: ["a", "b", "c"], correctIndex: 0 },
                { question: "q3", choices: ["a", "b", "c"], correctIndex: 2 },
            ],
        });
        // create gamer via google auth to receive accessToken
        const authRes = yield (0, supertest_1.default)(app_1.app).post("/api/v1/auth/google").send({
            email: "player@test.local",
            name: "Player",
            googleId: "gid-1",
        });
        const token = authRes.body.accessToken;
        const submitRes = yield (0, supertest_1.default)(app_1.app)
            .post(`/api/v1/puzzles/${campaign._id}/submit`)
            .set("Authorization", `Bearer ${token}`)
            .send({
            timeTaken: 5000,
            movesTaken: 12,
            solved: true,
            answers: [1, 0, 2],
        });
        expect(submitRes.status).toBe(201);
        expect(submitRes.body.attempt).toBeDefined();
        // check user analytics updated
        const user = yield user_model_1.default.findOne({ email: "player@test.local" }).lean();
        expect(user).toBeDefined();
        expect(user.analytics.lifetime.attempts).toBeGreaterThanOrEqual(1);
    }));
});
