import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middlewares/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import PuzzleCampaignModel from "../models/puzzleCampaign.model";
import PuzzleAttemptModel from "../models/puzzleAttempt.model";
import UserModel from "../models/user.model";
import PackageModel from "../models/package.model";

// Get active campaigns only (with brand name included)
export const getActiveCampaigns = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gameType } = req.query;

      // Build filter for active campaigns only
      const filter: any = { status: "active" };
      const validGameTypes = ["sliding_puzzle", "card_matching", "whack_a_mole", "word_hunt"];
      if (gameType && validGameTypes.includes(gameType as string)) {
        filter.gameType = gameType;
      }

      const campaigns = await PuzzleCampaignModel.find(filter)
        .select("_id brandId packageId gameType title description brandUrl campaignUrl puzzleImageUrl timeLimit questions words status startDate endDate createdAt")
        .lean();

      // Fetch brand names and package names for all campaigns
      const campaignsWithBrand = await Promise.all(
        campaigns.map(async (campaign) => {
          const brand = await UserModel.findById(campaign.brandId).select("name companyName").lean();
          const packageData = await PackageModel.findById(campaign.packageId).select("name").lean();
          return {
            _id: campaign._id,
            brandId: campaign.brandId,
            packageId: campaign.packageId,
            packageName: packageData?.name || null,
            brandName: brand?.companyName || brand?.name || "Unknown Brand",
            gameType: campaign.gameType,
            title: campaign.title,
            description: campaign.description,
            brandUrl: campaign.brandUrl,
            campaignUrl: campaign.campaignUrl,
            puzzleImageUrl: campaign.puzzleImageUrl,
            timeLimit: campaign.timeLimit,
            questions: campaign.questions,
            words: campaign.words,
            status: campaign.status,
            paymentStatus: (campaign as any).paymentStatus || "unpaid",
            startDate: campaign.startDate,
            endDate: campaign.endDate,
            createdAt: (campaign as any).createdAt,
          };
        })
      );

      res.status(200).json({ success: true, campaigns: campaignsWithBrand });
    } catch (error: any) {
      return next(new ErrorHandler(`Failed to fetch active campaigns: ${error.message}`, 500));
    }
  }
);

// Get all campaigns (with brand name included)
export const getAllCampaigns = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gameType, status, paymentStatus } = req.query;

      // Build filter
      const filter: any = {};
      const validGameTypes = ["sliding_puzzle", "card_matching", "whack_a_mole", "word_hunt"];
      if (gameType && validGameTypes.includes(gameType as string)) {
        filter.gameType = gameType;
      }

      // Filter by status if provided
      const validStatuses = ["active", "ended", "draft"];
      if (status && validStatuses.includes(status as string)) {
        filter.status = status;
      }

      // Filter by paymentStatus if provided
      const validPaymentStatuses = ["unpaid", "paid", "partial"];
      if (paymentStatus && validPaymentStatuses.includes(paymentStatus as string)) {
        filter.paymentStatus = paymentStatus;
      }

      const campaigns = await PuzzleCampaignModel.find(filter)
        .select("_id brandId packageId gameType title description brandUrl campaignUrl puzzleImageUrl timeLimit questions words status paymentStatus startDate endDate createdAt")
        .lean();

      // Fetch brand names and package names for all campaigns
      const campaignsWithBrand = await Promise.all(
        campaigns.map(async (campaign) => {
          const brand = await UserModel.findById(campaign.brandId).select("name companyName").lean();
          const packageData = await PackageModel.findById(campaign.packageId).select("name").lean();
          return {
            _id: campaign._id,
            brandId: campaign.brandId,
            packageId: campaign.packageId,
            packageName: packageData?.name || null,
            brandName: brand?.companyName || brand?.name || "Unknown Brand",
            gameType: campaign.gameType,
            title: campaign.title,
            description: campaign.description,
            brandUrl: campaign.brandUrl,
            campaignUrl: campaign.campaignUrl,
            puzzleImageUrl: campaign.puzzleImageUrl,
            timeLimit: campaign.timeLimit,
            questions: campaign.questions,
            words: campaign.words,
            status: campaign.status,
            paymentStatus: (campaign as any).paymentStatus || "unpaid",
            startDate: campaign.startDate,
            endDate: campaign.endDate,
            createdAt: (campaign as any).createdAt,
          };
        })
      );

      res.status(200).json({ success: true, campaigns: campaignsWithBrand });
    } catch (error: any) {
      return next(new ErrorHandler(`Failed to fetch campaigns: ${error.message}`, 500));
    }
  }
);

// Get campaigns by brandId
export const getCampaignsByBrand = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { brandId } = req.params;

      const campaigns = await PuzzleCampaignModel.find({ brandId })
        .select("_id brandId packageId gameType title description brandUrl campaignUrl puzzleImageUrl timeLimit questions words status startDate endDate createdAt")
        .lean();

      if (!campaigns || campaigns.length === 0) {
        return res.status(200).json({ success: true, campaigns: [] });
      }

      // Fetch brand name
      const brand = await UserModel.findById(brandId).select("name companyName").lean();
      const brandName = brand?.companyName || brand?.name || "Unknown Brand";

      // Fetch package names for all campaigns
      const campaignsWithBrand = await Promise.all(
        campaigns.map(async (campaign) => {
          const packageData = await PackageModel.findById(campaign.packageId).select("name").lean();
          return {
            _id: campaign._id,
            brandId: campaign.brandId,
            packageId: campaign.packageId,
            packageName: packageData?.name || null,
            brandName,
            gameType: campaign.gameType,
            title: campaign.title,
            description: campaign.description,
            brandUrl: campaign.brandUrl,
            campaignUrl: campaign.campaignUrl,
            puzzleImageUrl: campaign.puzzleImageUrl,
            timeLimit: campaign.timeLimit,
            questions: campaign.questions,
            words: campaign.words,
            status: campaign.status,
            paymentStatus: (campaign as any).paymentStatus || "unpaid",
            startDate: campaign.startDate,
            endDate: campaign.endDate,
            createdAt: (campaign as any).createdAt,
          };
        })
      );

      res.status(200).json({ success: true, campaigns: campaignsWithBrand });
    } catch (error: any) {
      return next(new ErrorHandler(`Failed to fetch campaigns for brand: ${error.message}`, 500));
    }
  }
);

// Get single campaign by campaignId (with brand name)
export const getCampaignById = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const campaign = await PuzzleCampaignModel.findById(campaignId).lean();

      if (!campaign) {
        return next(new ErrorHandler("Campaign not found", 404));
      }

      // Fetch brand name and package name
      const brand = await UserModel.findById(campaign.brandId).select("name companyName").lean();
      const brandName = brand?.companyName || brand?.name || "Unknown Brand";
      const packageData = await PackageModel.findById(campaign.packageId).select("name").lean();

      res.status(200).json({
        success: true,
        campaign: {
          _id: campaign._id,
          brandId: campaign.brandId,
          packageId: campaign.packageId,
          packageName: packageData?.name || null,
          brandName,
          gameType: campaign.gameType,
          title: campaign.title,
          description: campaign.description,
          brandUrl: campaign.brandUrl,
          campaignUrl: campaign.campaignUrl,
          puzzleImageUrl: campaign.puzzleImageUrl,
          originalImageUrl: campaign.originalImageUrl,
          questions: campaign.questions.map((q: any) => ({
            question: q.question,
            choices: q.choices,
            correctIndex: q.correctIndex,
          })),
          words: campaign.words,
          timeLimit: campaign.timeLimit,
          status: campaign.status,
          paymentStatus: (campaign as any).paymentStatus || "unpaid",
          packageType: (campaign as any).packageType || null,
          totalBudget: (campaign as any).totalBudget || 0,
          dailyAllocation: (campaign as any).dailyAllocation || 0,
          budgetRemaining: (campaign as any).budgetRemaining || 0,
          budgetUsed: (campaign as any).budgetUsed || 0,
          transactionId: (campaign as any).transactionId || null,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          createdAt: (campaign as any).createdAt,
        },
      });
    } catch (error: any) {
      return next(new ErrorHandler(`Failed to fetch campaign details: ${error.message}`, 500));
    }
  }
);

// Check if current user has completed a campaign
export const checkCampaignCompletion = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const user = req.user as any;
      const userId = user && user._id ? String(user._id) : undefined;

      if (!userId) {
        return next(new ErrorHandler("User not authenticated", 401));
      }

      // Check if user has already solved this campaign
      const previousAttempt = await PuzzleAttemptModel.findOne({
        userId: userId,
        campaignId: campaignId,
        solved: true,
      }).lean();

      const hasCompletedByCurrentUser = !!previousAttempt;

      res.status(200).json({
        success: true,
        hasCompletedByCurrentUser,
      });
    } catch (error: any) {
      return next(new ErrorHandler(`Failed to check campaign completion status: ${error.message}`, 500));
    }
  }
);

// Submit campaign result along with quiz answers
interface ISubmitBody {
  timeTaken: number; // ms
  movesTaken: number;
  solved: boolean;
  answers: number[]; // indexes selected for questions
}

export const submitCampaign = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const user = req.user as any;
      const userId = user && user._id ? String(user._id) : undefined;
      const body = req.body as ISubmitBody;

      const campaign = await PuzzleCampaignModel.findById(campaignId);
      if (!campaign) {
        return next(new ErrorHandler("Campaign not found. Please check the campaign ID and try again.", 404));
      }

      // compute quiz score
      let quizScore = 0;
      if (Array.isArray(body.answers)) {
        for (
          let i = 0;
          i < Math.min(body.answers.length, campaign.questions.length);
          i++
        ) {
          console.log(`Question ${i}: User answered ${body.answers[i]}, Correct answer is ${campaign.questions[i].correctIndex}`);
          if (body.answers[i] === campaign.questions[i].correctIndex) {
            quizScore++;
          }
        }
      }

      // Check if all questions were answered correctly
      const totalQuestions = campaign.questions.length;
      const allQuestionsCorrect = quizScore === totalQuestions;

      console.log(`Quiz Score: ${quizScore}/${totalQuestions}, All Correct: ${allQuestionsCorrect}`);
      console.log(`Solved: ${body.solved}`);

      // determine if first-time solved
      let firstTime = false;
      if (body.solved && allQuestionsCorrect) {
        const prev = await PuzzleAttemptModel.findOne({
          userId: userId,
          campaignId: campaignId,
          solved: true,
        });
        console.log(`Previous attempt found: ${!!prev}`);
        if (!prev) firstTime = true;
      }

      // Calculate points using weighted scoring formula
      let pointsEarned = 0;

      if (firstTime && allQuestionsCorrect) {
        // Configuration parameters
        const basePoints = 10;
        const optimalTime = 60; // seconds
        const optimalMoves = 50;
        const speedWeight = 0.4;
        const efficiencyWeight = 0.4;
        const completionWeight = 0.2;
        const maxSpeedMultiplier = 2.0;
        const maxEfficiencyMultiplier = 2.0;

        // Difficulty multipliers based on game type
        const difficultyMultipliers: { [key: string]: number } = {
          card_matching: 1,
          whack_a_mole: 1.5,
          sliding_puzzle: 2,
          word_hunt: 1,
        };

        // Convert timeTaken from milliseconds to seconds
        const actualTimeSeconds = body.timeTaken / 1000;
        const actualMoves = body.movesTaken;

        // Calculate speed score (faster = higher score, capped at maxSpeedMultiplier)
        const speedScore = Math.min(
          optimalTime / actualTimeSeconds,
          maxSpeedMultiplier
        );

        // Calculate move efficiency score (fewer moves = higher score, capped at maxEfficiencyMultiplier)
        const moveScore = Math.min(
          optimalMoves / actualMoves,
          maxEfficiencyMultiplier
        );

        // Completion bonus (always 1 if completed)
        const completionBonus = 1;

        // Calculate weighted multiplier
        const weightedMultiplier =
          speedScore * speedWeight +
          moveScore * efficiencyWeight +
          completionBonus * completionWeight;

        // Get difficulty multiplier for game type
        const difficultyMultiplier =
          difficultyMultipliers[campaign.gameType] || 1;

        // Calculate final points
        pointsEarned = Math.round(
          basePoints * weightedMultiplier * difficultyMultiplier
        );

        console.log(`Points Calculation:`, {
          gameType: campaign.gameType,
          actualTimeSeconds,
          actualMoves,
          speedScore,
          moveScore,
          weightedMultiplier,
          difficultyMultiplier,
          pointsEarned,
        });
      }

      console.log(`First Time: ${firstTime}, Points Earned: ${pointsEarned}`);

      const attempt = await PuzzleAttemptModel.create({
        userId: userId,
        puzzleId: campaignId,
        campaignId: campaignId,
        timeTaken: body.timeTaken,
        movesTaken: body.movesTaken,
        solved: body.solved,
        firstTimeSolved: firstTime,
        quizScore,
        answers: Array.isArray(body.answers) ? body.answers : [],
        pointsEarned,
      });

      // update user analytics
      const userDoc = userId ? await UserModel.findById(userId) : null;
      if (userDoc) {
        userDoc.analytics.lifetime.attempts =
          (userDoc.analytics.lifetime.attempts || 0) + 1;
        userDoc.analytics.lifetime.totalMoves =
          (userDoc.analytics.lifetime.totalMoves || 0) + body.movesTaken;
        userDoc.analytics.lifetime.totalTime =
          (userDoc.analytics.lifetime.totalTime || 0) + body.timeTaken;
        if (body.solved && allQuestionsCorrect) {
          userDoc.analytics.lifetime.puzzlesSolved =
            (userDoc.analytics.lifetime.puzzlesSolved || 0) +
            (firstTime ? 1 : 0);
          userDoc.analytics.lifetime.totalPoints =
            (userDoc.analytics.lifetime.totalPoints || 0) + pointsEarned;
        }
        // successRate = puzzlesSolved / attempts
        if (userDoc.analytics.lifetime.attempts > 0) {
          userDoc.analytics.lifetime.successRate =
            (userDoc.analytics.lifetime.puzzlesSolved || 0) /
            userDoc.analytics.lifetime.attempts;
        }
        if (firstTime) {
          userDoc.puzzlesSolved = userDoc.puzzlesSolved || [];
          userDoc.puzzlesSolved.push(campaignId);
        }
        await userDoc.save();
      }

      // Remove user from "currently playing" after submitting
      if (userId) {
        const redis = require("../utils/redis").redis;
        await redis.srem("users:currently_playing", userId);
        await redis.del(`user:${userId}:playing`);
      }

      res.status(201).json({
        success: true,
        attempt,
        gameType: campaign.gameType,
      });
    } catch (error: any) {
      return next(new ErrorHandler(`Failed to submit campaign result: ${error.message}`, 500));
    }
  }
);
