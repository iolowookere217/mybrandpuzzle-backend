import request from "supertest";
import { app } from "../app";
import { connectTestDB, clearTestDB, closeTestDB } from "./setup";

describe("Auth flows", () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  it("should register a brand and return access token", async () => {
    const res = await request(app).post("/api/v1/auth/brand/register").send({
      name: "BrandUser",
      email: "brand@test.local",
      password: "password123",
      companyName: "BrandCo",
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.user.role).toBe("brand");
  });

  it("should login brand after registration", async () => {
    await request(app).post("/api/v1/auth/brand/register").send({
      name: "BrandUser",
      email: "brand2@test.local",
      password: "password123",
      companyName: "BrandCo",
    });

    const res = await request(app).post("/api/v1/auth/brand/login").send({
      email: "brand2@test.local",
      password: "password123",
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.user.role).toBe("brand");
  });

  it("should create or login a gamer via google auth", async () => {
    const res = await request(app).post("/api/v1/auth/google").send({
      email: "gamer@test.local",
      name: "Gamer",
      avatar: "http://example.com/avatar.png",
      googleId: "google-123",
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.user.role).toBe("gamer");
  });
});
