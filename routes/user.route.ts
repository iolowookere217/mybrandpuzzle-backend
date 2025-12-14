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
  updateBrandProfile
} from "../controllers/user.controller";
import { isAuthenticated } from "../utils/auth";

const userRouter = express.Router();


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


export default userRouter;