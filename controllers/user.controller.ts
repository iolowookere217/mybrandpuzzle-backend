import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middlewares/catchAsyncError";
import jwt, { Secret, JwtPayload } from "jsonwebtoken";
import PuzzleAttemptModel from "../models/puzzleAttempt.model";

import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendEmail";
import { redis } from "../utils/redis";

import "dotenv/config";
import {
  accessTokenOptions,
  refreshTokenOptions,
  sendToken,
} from "../utils/jwt";

//using interface for req.user
declare module "express" {
  interface Request {
    user?: IUser;
  }
}

//Register user interface
interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

//Register user
export const registerUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;

      //Check if email already exists
      const isEmailExist = await userModel.findOne({ email });
      if (isEmailExist) {
        return next(new ErrorHandler("Email already exists", 400));
      }

      const user: IRegistrationBody = {
        name,
        email,
        password,
      };

      const activationToken = createActivationToken(user);
      const activationCode = activationToken.activationCode;

      const data = { user: { name: user.name }, activationCode };
      await ejs.renderFile(
        path.join(__dirname, "../mails/activation-mail.ejs"),
        data
      );

      //send email to user
      try {
        await sendMail({
          email: user.email,
          subject: "Activate your account",
          template: "activation-mail.ejs",
          data,
        });

        res.status(201).json({
          success: true,
          message: `Please check your email: ${user.email} to activate your account!`,
          activationToken: activationToken.token,
        });
      } catch (error: any) {
        console.log(error);
        return next(new ErrorHandler(error.message, 400));
      }
    } catch (error: any) {
      console.log(error);
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//Generate user activation token
interface IActivationToken {
  token: string;
  activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

  const token = jwt.sign(
    {
      user,
      activationCode,
    },
    process.env.ACTIVATION_SECRET as Secret,
    {
      expiresIn: "5m",
    }
  );
  return { token, activationCode };
};

//Activate user
interface IActivationRequest {
  activation_token: string;
  activation_code: string;
}

export const activateUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activation_token, activation_code } =
        req.body as IActivationRequest;

      const newUser: { user: IUser; activationCode: string } = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as string
      ) as { user: IUser; activationCode: string };

      if (newUser.activationCode !== activation_code) {
        return next(new ErrorHandler("Invalid activation code", 400));
      }

      const { name, email, password } = newUser.user;

      const existUser = await userModel.findOne({ email });

      if (existUser) {
        return next(new ErrorHandler("Email already exist", 400));
      }

      //store user data in database
      await userModel.create({
        name,
        email,
        password,
      });

      res.status(201).json({
        success: true,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//login user
interface ILoginRequest {
  email: string;
  password: string;
}

export const loginUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILoginRequest;
      if (!email || !password) {
        res.status(400).json({
          message: "Invalid credentials",
        });
      }

      const user = await userModel.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("Invalid email or password. Please check your credentials and try again.", 401));
      }

      //check password
      const isPasswordMatch = await user.comparePassword?.(password);
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid email or password. Please check your credentials and try again.", 401));
      }
      sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(`Login failed: ${error.message}`, 500));
    }
  }
);

//logout user
export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.cookie("access_token", "", { maxAge: 1 });
      res.cookie("refresh_token", "", { maxAge: 1 });

      // delete cache from redis
      const userId = req.user?._id as string;

      redis.del(userId);

      res.status(200).json({
        success: true,
        message: "logged out successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// update access token
export const updateAccessToken = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refresh_token = req.cookies.refresh_token as string;

      //Verify refresh token
      const decoded = jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN as string
      ) as JwtPayload;
      if (!decoded) {
        return next(new ErrorHandler("Could not refresh access token", 400));
      }

      //Get user id
      const session = await redis.get(decoded.id);
      if (!session) {
        return next(new ErrorHandler("Could not refresh access token", 400));
      }

      const user = JSON.parse(session);

      //create access and refresh token
      const accessToken = jwt.sign(
        { id: user._id },
        process.env.ACCESS_TOKEN as string,
        {
          expiresIn: "5m",
        }
      );

      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.REFRESH_TOKEN as string,
        {
          expiresIn: "3d",
        }
      );

      req.user = user;

      res.cookie("access_token", accessToken, accessTokenOptions);
      res.cookie("refresh_token", refreshToken, refreshTokenOptions);

      res.status(200).json({
        success: true,
        accessToken,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// get user
export const getUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id as string;

      const userJson = await redis.get(userId);

      if (userJson) {
        const user = JSON.parse(userJson);

        res.status(200).json({
          success: true,
          user,
        });
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Get gamer profile with full analytics
export const getGamerProfile = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id as string;

      if (!req.user || req.user.role !== "gamer") {
        return next(new ErrorHandler("Access denied. Gamer profile only.", 403));
      }

      const user = await userModel.findById(userId).select("-password").lean();

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Calculate current week's leaderboard position
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      const weekStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - daysFromMonday
      );
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // Get current week's leaderboard
      const agg = await PuzzleAttemptModel.aggregate([
        {
          $match: {
            firstTimeSolved: true,
            timestamp: { $gte: weekStart, $lte: weekEnd },
          },
        },
        {
          $group: {
            _id: "$userId",
            puzzlesSolved: { $sum: 1 },
            points: { $sum: "$pointsEarned" },
          },
        },
        { $sort: { puzzlesSolved: -1, points: -1 } },
      ]);

      // Find user's position
      let leaderboardPosition = null;
      const userIndex = agg.findIndex((entry: any) => entry._id.toString() === userId.toString());
      if (userIndex !== -1) {
        leaderboardPosition = userIndex + 1;
      }

      res.status(200).json({
        success: true,
        profile: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          isVerified: user.isVerified,
          analytics: user.analytics,
          puzzlesSolved: user.puzzlesSolved,
          leaderboardPosition, // Position on current week's leaderboard
          createdAt: (user as any).createdAt,
          updatedAt: (user as any).updatedAt,
        },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Get brand profile with brand details and campaigns
export const getBrandProfile = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id as string;

      if (!req.user || req.user.role !== "brand") {
        return next(new ErrorHandler("Access denied. Brand profile only.", 403));
      }

      const user = await userModel.findById(userId).select("-password").lean();

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Get brand details
      const BrandModel = require("../models/brand.model").default;
      const brandProfile = await BrandModel.findOne({ userId }).lean();

      // Get campaign count only (not the full list for better performance)
      const PuzzleCampaignModel = require("../models/puzzleCampaign.model").default;
      const totalCampaigns = await PuzzleCampaignModel.countDocuments({
        brandId: userId,
      });

      res.status(200).json({
        success: true,
        profile: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          companyName: user.companyName,
          isVerified: user.isVerified,
          createdAt: (user as any).createdAt,
          updatedAt: (user as any).updatedAt,
          brandDetails: brandProfile
            ? {
                companyEmail: brandProfile.companyEmail,
                companyName: brandProfile.companyName,
                verified: brandProfile.verified,
                totalCampaigns,
              }
            : null,
        },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Update gamer profile
export const updateGamerProfile = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id as string;

      if (!req.user || req.user.role !== "gamer") {
        return next(new ErrorHandler("Access denied. Gamer profile only.", 403));
      }

      const { firstName, lastName, avatar } = req.body;

      // Build update object with only provided fields
      const updateData: any = {};
      if (firstName && typeof firstName === "string" && firstName.trim() !== "") {
        updateData.firstName = firstName.trim();
      }
      if (lastName !== undefined && typeof lastName === "string") {
        updateData.lastName = lastName.trim();
      }
      if (avatar && typeof avatar === "string") {
        updateData.avatar = avatar;
      }

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        return next(new ErrorHandler("No valid fields provided for update", 400));
      }

      const updatedUser = await userModel
        .findByIdAndUpdate(userId, updateData, { new: true })
        .select("-password");

      if (!updatedUser) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Update redis cache if exists
      try {
        await redis.set(userId, JSON.stringify(updatedUser));
      } catch (redisErr) {
        console.error("Redis update error:", redisErr);
      }

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        profile: {
          _id: updatedUser._id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          username: updatedUser.username,
          email: updatedUser.email,
          avatar: updatedUser.avatar,
          role: updatedUser.role,
          isVerified: updatedUser.isVerified,
          analytics: updatedUser.analytics,
          puzzlesSolved: updatedUser.puzzlesSolved,
        },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Update brand profile
export const updateBrandProfile = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id as string;

      if (!req.user || req.user.role !== "brand") {
        return next(new ErrorHandler("Access denied. Brand profile only.", 403));
      }

      const { name, avatar, companyName } = req.body;

      // Build update object for user model with only provided fields
      const userUpdateData: any = {};
      if (name && typeof name === "string" && name.trim() !== "") {
        userUpdateData.name = name.trim();
      }
      if (avatar && typeof avatar === "string") {
        userUpdateData.avatar = avatar;
      }
      if (companyName && typeof companyName === "string" && companyName.trim() !== "") {
        userUpdateData.companyName = companyName.trim();
      }

      // Check if there's anything to update
      if (Object.keys(userUpdateData).length === 0) {
        return next(new ErrorHandler("No valid fields provided for update", 400));
      }

      // Update user model
      const updatedUser = await userModel
        .findByIdAndUpdate(userId, userUpdateData, { new: true })
        .select("-password");

      if (!updatedUser) {
        return next(new ErrorHandler("User not found", 404));
      }

      // If companyName is updated, also update brand profile
      if (companyName) {
        const BrandModel = require("../models/brand.model").default;
        await BrandModel.findOneAndUpdate(
          { userId },
          { companyName: companyName.trim() }
        );
      }

      // Update redis cache if exists
      try {
        await redis.set(userId, JSON.stringify(updatedUser));
      } catch (redisErr) {
        console.error("Redis update error:", redisErr);
      }

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        profile: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          avatar: updatedUser.avatar,
          role: updatedUser.role,
          companyName: updatedUser.companyName,
          isVerified: updatedUser.isVerified,
        },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Get all gamers
export const getAllGamers = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Find all users who are NOT brands or admins (includes users with role 'gamer' or no role set)
      const gamerUsers = await userModel.find({
        role: { $nin: ["brand", "admin"] }
      })
        .select("_id firstName lastName username email avatar isVerified analytics puzzlesSolved createdAt")
        .lean();

      const gamers = gamerUsers.map((gamer) => ({
        _id: gamer._id,
        firstName: gamer.firstName,
        lastName: gamer.lastName,
        username: gamer.username,
        email: gamer.email,
        avatar: gamer.avatar,
        isVerified: gamer.isVerified,
        analytics: gamer.analytics,
        totalPuzzlesSolved: gamer.puzzlesSolved?.length || 0,
        createdAt: (gamer as any).createdAt,
      }));

      res.status(200).json({ success: true, gamers });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
