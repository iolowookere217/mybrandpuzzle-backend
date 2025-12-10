import request from "supertest";
import { app } from "../app";
import { connectTestDB, clearTestDB, closeTestDB } from "./setup";
import PuzzleCampaignModel from "../models/puzzleCampaign.model";
import UserModel from "../models/user.model";

describe("Puzzle submission flow", () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  it("should allow gamer to submit a puzzle and record attempt and analytics", async () => {
    // create a puzzle campaign directly
    const campaign = await PuzzleCampaignModel.create({
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
    const authRes = await request(app).post("/api/v1/auth/google").send({
      email: "player@test.local",
      name: "Player",
      googleId: "gid-1",
    });

    const token = authRes.body.accessToken as string;

    const submitRes = await request(app)
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
    const user = await UserModel.findOne({ email: "player@test.local" }).lean();
    expect(user).toBeDefined();
    expect(user!.analytics.lifetime.attempts).toBeGreaterThanOrEqual(1);
  });
});
