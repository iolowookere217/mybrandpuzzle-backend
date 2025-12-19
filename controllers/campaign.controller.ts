import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middlewares/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import PuzzleCampaignModel from "../models/puzzleCampaign.model";
import PuzzleAttemptModel from "../models/puzzleAttempt.model";
import UserModel from "../models/user.model";

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
        .select("_id brandId packageId gameType title description brandUrl puzzleImageUrl timeLimit questions words status startDate endDate createdAt")
        .lean();

      // Fetch brand names for all campaigns
      const campaignsWithBrand = await Promise.all(
        campaigns.map(async (campaign) => {
          const brand = await UserModel.findById(campaign.brandId).select("name companyName").lean();
          return {
            _id: campaign._id,
            brandId: campaign.brandId,
            packageId: campaign.packageId,
            brandName: brand?.companyName || brand?.name || "Unknown Brand",
            gameType: campaign.gameType,
            title: campaign.title,
            description: campaign.description,
            brandUrl: campaign.brandUrl,
            puzzleImageUrl: campaign.puzzleImageUrl,
            timeLimit: campaign.timeLimit,
            questions: campaign.questions,
            words: campaign.words,
            status: campaign.status,
            startDate: campaign.startDate,
            endDate: campaign.endDate,
            createdAt: (campaign as any).createdAt,
          };
        })
      );

      res.status(200).json({ success: true, campaigns: campaignsWithBrand });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Get all campaigns (with brand name included)
export const getAllCampaigns = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gameType, status } = req.query;

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

      const campaigns = await PuzzleCampaignModel.find(filter)
        .select("_id brandId packageId gameType title description brandUrl puzzleImageUrl timeLimit questions words status startDate endDate createdAt")
        .lean();

      // Fetch brand names for all campaigns
      const campaignsWithBrand = await Promise.all(
        campaigns.map(async (campaign) => {
          const brand = await UserModel.findById(campaign.brandId).select("name companyName").lean();
          return {
            _id: campaign._id,
            brandId: campaign.brandId,
            packageId: campaign.packageId,
            brandName: brand?.companyName || brand?.name || "Unknown Brand",
            gameType: campaign.gameType,
            title: campaign.title,
            description: campaign.description,
            brandUrl: campaign.brandUrl,
            puzzleImageUrl: campaign.puzzleImageUrl,
            timeLimit: campaign.timeLimit,
            questions: campaign.questions,
            words: campaign.words,
            status: campaign.status,
            startDate: campaign.startDate,
            endDate: campaign.endDate,
            createdAt: (campaign as any).createdAt,
          };
        })
      );

      res.status(200).json({ success: true, campaigns: campaignsWithBrand });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Get campaigns by brandId
export const getCampaignsByBrand = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { brandId } = req.params;

      const campaigns = await PuzzleCampaignModel.find({ brandId })
        .select("_id brandId packageId gameType title description brandUrl puzzleImageUrl timeLimit questions words status startDate endDate createdAt")
        .lean();

      if (!campaigns || campaigns.length === 0) {
        return res.status(200).json({ success: true, campaigns: [] });
      }

      // Fetch brand name
      const brand = await UserModel.findById(brandId).select("name companyName").lean();
      const brandName = brand?.companyName || brand?.name || "Unknown Brand";

      const campaignsWithBrand = campaigns.map((campaign) => ({
        _id: campaign._id,
        brandId: campaign.brandId,
        packageId: campaign.packageId,
        brandName,
        gameType: campaign.gameType,
        title: campaign.title,
        description: campaign.description,
        brandUrl: campaign.brandUrl,
        puzzleImageUrl: campaign.puzzleImageUrl,
        timeLimit: campaign.timeLimit,
        questions: campaign.questions,
        words: campaign.words,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        createdAt: (campaign as any).createdAt,
      }));

      res.status(200).json({ success: true, campaigns: campaignsWithBrand });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
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

      // Fetch brand name
      const brand = await UserModel.findById(campaign.brandId).select("name companyName").lean();
      const brandName = brand?.companyName || brand?.name || "Unknown Brand";

      res.status(200).json({
        success: true,
        campaign: {
          _id: campaign._id,
          brandId: campaign.brandId,
          packageId: campaign.packageId,
          brandName,
          gameType: campaign.gameType,
          title: campaign.title,
          description: campaign.description,
          brandUrl: campaign.brandUrl,
          puzzleImageUrl: campaign.puzzleImageUrl,
          originalImageUrl: campaign.originalImageUrl,
          questions: campaign.questions.map((q: any) => ({
            question: q.question,
            choices: q.choices,
          })),
          words: campaign.words,
          timeLimit: campaign.timeLimit,
          status: campaign.status,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          createdAt: (campaign as any).createdAt,
        },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
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
        return next(new ErrorHandler("Campaign not found", 404));
      }

      // compute quiz score
      let quizScore = 0;
      if (Array.isArray(body.answers)) {
        for (
          let i = 0;
          i < Math.min(body.answers.length, campaign.questions.length);
          i++
        ) {
          if (body.answers[i] === campaign.questions[i].correctIndex) {
            quizScore++;
          }
        }
      }

      // Check if all questions were answered correctly
      const totalQuestions = campaign.questions.length;
      const allQuestionsCorrect = quizScore === totalQuestions;

      // determine if first-time solved
      let firstTime = false;
      if (body.solved && allQuestionsCorrect) {
        const prev = await PuzzleAttemptModel.findOne({
          userId: userId,
          campaignId: campaignId,
          solved: true,
        });
        if (!prev) firstTime = true;
      }

      // Award points only if solved AND all questions answered correctly
      const pointsEarned = (firstTime && allQuestionsCorrect) ? 1 : 0;

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

      res.status(201).json({
        success: true,
        attempt,
        gameType: campaign.gameType,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
