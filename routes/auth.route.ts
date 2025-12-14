import express from "express";
import {
  googleAuth,
  registerBrand,
  logout,
  activateBrand,
  registerGamer,
  activateGamer,
  login,
  resendGamerActivation,
  resendBrandActivation,
} from "../controllers/auth.controller";
import { isAuthenticated } from "../utils/auth";

const router = express.Router();

// Google OAuth
router.post("/auth/google", googleAuth);

// Unified login for both user types
router.post("/auth/login", login);

// Gamer routes (email/password)
router.post("/auth/gamer/register", registerGamer);
router.post("/auth/gamer/activate", activateGamer);
router.post("/auth/gamer/resend-activation", resendGamerActivation);

// Brand routes
router.post("/auth/brand/register", registerBrand);
router.post("/auth/brand/activate", activateBrand);
router.post("/auth/brand/resend-activation", resendBrandActivation);

// Logout (requires authentication)
router.post("/auth/logout", isAuthenticated, logout);

export default router;
