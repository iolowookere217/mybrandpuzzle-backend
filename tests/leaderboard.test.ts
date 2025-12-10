import request from "supertest";
import { app } from "../app";
import { connectTestDB, clearTestDB, closeTestDB } from "./setup";
import PuzzleCampaignModel from "../models/puzzleCampaign.model";

describe("Leaderboard flows", () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  it("should show user on daily leaderboard after first-time solve", async () => {
    const campaign = await PuzzleCampaignModel.create({
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
    const authRes = await request(app).post("/api/v1/auth/google").send({
      email: "leader@test.local",
      name: "Leader",
      googleId: "gid-2",
    });
    const token = authRes.body.accessToken as string;

    await request(app)
      .post(`/api/v1/puzzles/${campaign._id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeTaken: 1000,
        movesTaken: 5,
        solved: true,
        answers: [1, 0, 2],
      });

    const lbRes = await request(app)
      .get("/api/v1/leaderboards/daily")
      .set("Authorization", `Bearer ${token}`);
    expect(lbRes.status).toBe(200);
    expect(lbRes.body.entries).toBeDefined();
    expect(lbRes.body.entries.length).toBeGreaterThanOrEqual(1);
    expect(lbRes.body.entries[0]).toHaveProperty("userId");
  });
});
