import express from "express";
import {
  googleAuth,
  registerBrand,
  loginBrand,
  logout,
  activateBrand,
  registerGamer,
  activateGamer,
  loginGamer,
} from "../controllers/auth.controller";
import { isAuthenticated } from "../utils/auth";

const router = express.Router();

// Google OAuth
router.post("/auth/google", googleAuth);

// Gamer routes (email/password)
router.post("/auth/gamer/register", registerGamer);
router.post("/auth/gamer/activate", activateGamer);
router.post("/auth/gamer/login", loginGamer);

// Brand routes
router.post("/auth/brand/register", registerBrand);
router.post("/auth/brand/activate", activateBrand);
router.post("/auth/brand/login", loginBrand);

// Logout (requires authentication)
router.post("/auth/logout", isAuthenticated, logout);

export default router;
