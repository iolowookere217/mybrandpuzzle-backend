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
describe("Auth flows", () => {
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, setup_1.connectTestDB)();
    }));
    afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, setup_1.clearTestDB)();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, setup_1.closeTestDB)();
    }));
    it("should register a brand and return access token", () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app_1.app).post("/api/v1/auth/brand/register").send({
            name: "BrandUser",
            email: "brand@test.local",
            password: "password123",
            companyName: "BrandCo",
        });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("accessToken");
        expect(res.body.user.role).toBe("brand");
    }));
    it("should login brand after registration", () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, supertest_1.default)(app_1.app).post("/api/v1/auth/brand/register").send({
            name: "BrandUser",
            email: "brand2@test.local",
            password: "password123",
            companyName: "BrandCo",
        });
        const res = yield (0, supertest_1.default)(app_1.app).post("/api/v1/auth/brand/login").send({
            email: "brand2@test.local",
            password: "password123",
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("accessToken");
        expect(res.body.user.role).toBe("brand");
    }));
    it("should create or login a gamer via google auth", () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app_1.app).post("/api/v1/auth/google").send({
            email: "gamer@test.local",
            name: "Gamer",
            avatar: "http://example.com/avatar.png",
            googleId: "google-123",
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("accessToken");
        expect(res.body.user.role).toBe("gamer");
    }));
});
