"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../utils/auth");
const router = express_1.default.Router();
// Google OAuth
router.post("/auth/google", auth_controller_1.googleAuth);
// Gamer routes (email/password)
router.post("/auth/gamer/register", auth_controller_1.registerGamer);
router.post("/auth/gamer/activate", auth_controller_1.activateGamer);
router.post("/auth/gamer/login", auth_controller_1.loginGamer);
// Brand routes
router.post("/auth/brand/register", auth_controller_1.registerBrand);
router.post("/auth/brand/activate", auth_controller_1.activateBrand);
router.post("/auth/brand/login", auth_controller_1.loginBrand);
// Logout (requires authentication)
router.post("/auth/logout", auth_1.isAuthenticated, auth_controller_1.logout);
exports.default = router;
