import express from "express";
import {
  registerUser,
  activateUser,
  loginUser,
  logoutUser,
  updateAccessToken,
  getUserInfo,
  getGamerProfile,
  getBrandProfile,
  updateGamerProfile,
  updateBrandProfile,
  getAllGamers,
  clearAllGamerData
} from "../controllers/user.controller";
import { isAuthenticated, authorizeRoles } from "../utils/auth";

const userRouter = express.Router();

// Get all gamers
userRouter.get("/gamers", getAllGamers);

userRouter.post("/registration", registerUser);

userRouter.post("/activate-user", activateUser);

userRouter.post("/login", loginUser);

userRouter.post("/logout", isAuthenticated, logoutUser);

userRouter.post("/refresh", updateAccessToken);

userRouter.get("/me", isAuthenticated, getUserInfo);

// Get gamer profile with full analytics
userRouter.get("/profile/gamer", isAuthenticated, getGamerProfile);

// Get brand profile with brand details and campaigns
userRouter.get("/profile/brand", isAuthenticated, getBrandProfile);

// Update gamer profile
userRouter.put("/profile/gamer", isAuthenticated, updateGamerProfile);

// Update brand profile
userRouter.put("/profile/brand", isAuthenticated, updateBrandProfile);

// Clear all gamer data (Admin only)
userRouter.post("/admin/clear-all-data", isAuthenticated, authorizeRoles("admin"), clearAllGamerData);

export default userRouter;