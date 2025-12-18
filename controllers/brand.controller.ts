import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middlewares/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import PuzzleCampaignModel from "../models/puzzleCampaign.model";
import BrandModel from "../models/brand.model";
import { bucket } from "../firebaseConfig";
import PuzzleAttemptModel from "../models/puzzleAttempt.model";
import UserModel from "../models/user.model";

// Create a puzzle campaign (brands only). Expects multipart upload with one file: "image" (used for both scrambled and original)
export const createCampaign = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const brandUser = req.user!;
      if (brandUser.role !== "brand")
        return next(new ErrorHandler("Only brands can create campaigns", 403));

      const { questions, title, description, gameType, words } = req.body;

      // validate required fields
      if (!title || typeof title !== "string" || title.trim() === "") {
        return next(
          new ErrorHandler(
            "title is required and must be a non-empty string",
            400
          )
        );
      }
      if (
        !description ||
        typeof description !== "string" ||
        description.trim() === ""
      ) {
        return next(
          new ErrorHandler(
            "description is required and must be a non-empty string",
            400
          )
        );
      }

      // Validate gameType field
      const validGameTypes = ["sliding_puzzle", "card_matching", "whack_a_mole", "word_hunt"];
      const campaignGameType = gameType || "sliding_puzzle";
      if (!validGameTypes.includes(campaignGameType)) {
        return next(
          new ErrorHandler(
            'gameType must be one of: sliding_puzzle, card_matching, whack_a_mole, word_hunt',
            400
          )
        );
      }

      // Parse words array if it's a string (from form-data)
      let parsedWords: string[] = [];
      if (words) {
        if (typeof words === "string") {
          try {
            parsedWords = JSON.parse(words);
          } catch {
            // If parsing fails, try splitting by comma
            parsedWords = words.split(",").map((w) => w.trim()).filter((w) => w.length > 0);
          }
        } else if (Array.isArray(words)) {
          parsedWords = words;
        }
      }

      // For word_hunt games, validate words array
      if (campaignGameType === "word_hunt") {
        if (!parsedWords || parsedWords.length === 0) {
          return next(
            new ErrorHandler(
              "words array is required for word_hunt games and must contain at least one word",
              400
            )
          );
        }
      }

      // Get brand profile (no restriction on number of campaigns)
      const brand = await BrandModel.findOne({ userId: brandUser._id });
      if (!brand) {
        return next(new ErrorHandler("Brand profile not found", 404));
      }

      // multer stores single-file upload in req.file
      const uploadedFile: any = (req as any).file;

      if (!uploadedFile) {
        return next(
          new ErrorHandler(
            'Missing image file. Please upload using field name "image"',
            400
          )
        );
      }

      // use a single timestamp so both stored names are related
      const now = Date.now();
      const puzzleName = `puzzles/${now}-puzzle-${uploadedFile.originalname}`;
      const originalName = `puzzles/${now}-original-${uploadedFile.originalname}`;

      const uploadBuffer = async (file: any, name: string) => {
        const fileRef = bucket.file(name);
        await fileRef.save(file.buffer, {
          resumable: false,
          contentType: file.mimetype,
        });
        await fileRef.makePublic();
        return `https://storage.googleapis.com/${bucket.name}/${name}`;
      };

      const puzzleUrl = await uploadBuffer(uploadedFile, puzzleName);
      const originalUrl = await uploadBuffer(uploadedFile, originalName);

      // parse questions (expected as JSON string or array)
      let parsedQuestions: any[] = [];
      const rawQuestions =
        questions ?? req.body?.questions ?? req.body?.question;

      const tryParse = (val: string) => {
        try {
          return JSON.parse(val);
        } catch {
          // try a simple fix: replace single quotes with double quotes
          try {
            const fixed = val.replace(/'/g, '"');
            return JSON.parse(fixed);
          } catch {
            return null;
          }
        }
      };

      if (typeof rawQuestions === "string" && rawQuestions.trim() !== "") {
        const parsed = tryParse(rawQuestions);
        if (parsed === null) {
          return next(
            new ErrorHandler(
              `Invalid JSON for questions field. Received: ${rawQuestions}`,
              400
            )
          );
        }
        parsedQuestions = parsed;
      } else if (Array.isArray(rawQuestions)) {
        parsedQuestions = rawQuestions;
      } else if (rawQuestions && typeof rawQuestions === "object") {
        // handle cases where form-data produced an object with numeric keys
        const vals = Object.values(rawQuestions);
        if (vals.length && vals.every((v) => typeof v === "object"))
          parsedQuestions = vals as any[];
        else parsedQuestions = [];
      } else {
        parsedQuestions = [];
      }

      // validate parsedQuestions
      if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
        return next(
          new ErrorHandler("Missing or invalid questions array", 400)
        );
      }
      for (const q of parsedQuestions) {
        if (
          !q ||
          typeof q.question !== "string" ||
          !Array.isArray(q.choices) ||
          typeof q.correctIndex !== "number"
        ) {
          return next(
            new ErrorHandler(
              "Each question must have 'question', 'choices' array and numeric 'correctIndex'",
              400
            )
          );
        }
      }

      // helper to robustly parse numeric fields from multipart/form-data
      const getNumericFromBody = (fieldName: string) => {
        let v: any = req.body?.[fieldName];
        if (Array.isArray(v)) v = v[0];
        if (v && typeof v === "object") {
          const vals = Object.values(v);
          if (vals.length) v = vals[0];
        }
        if (typeof v === "string") {
          const cleaned = v.replace(/[^0-9.-]/g, "").trim();
          if (cleaned === "") return null;
          const n = Number(cleaned);
          return Number.isFinite(n) ? n : null;
        }
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const timeLimitVal = getNumericFromBody("timeLimit");
      if (timeLimitVal === null || timeLimitVal === undefined) {
        return next(
          new ErrorHandler(
            "timeLimit (hours) is required and must be a number",
            400
          )
        );
      }

      // Prepare campaign data
      const campaignData: any = {
        brandId: brandUser._id,
        gameType: campaignGameType,
        title: title.trim(),
        description: description.trim(),
        puzzleImageUrl: puzzleUrl,
        originalImageUrl: originalUrl,
        questions: parsedQuestions,
        timeLimit: timeLimitVal,
      };

      // For word_hunt games, add words array
      if (campaignGameType === "word_hunt" && parsedWords.length > 0) {
        campaignData.words = parsedWords;
      }

      const campaign = await PuzzleCampaignModel.create(campaignData);

      // Update brand campaigns list (no restrictions on number of campaigns)
      await BrandModel.findOneAndUpdate(
        { userId: brandUser._id },
        { $push: { campaigns: campaign._id } }
      );

      res.status(201).json({ success: true, campaign });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const getCampaignAnalytics = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const brandUser = req.user!;
      if (brandUser.role !== "brand")
        return next(new ErrorHandler("Only brands can access analytics", 403));
      const brand = await BrandModel.findOne({ userId: brandUser._id });
      if (!brand) return next(new ErrorHandler("Brand not found", 404));

      // Fetch campaigns for brand
      const campaigns = await PuzzleCampaignModel.find({
        brandId: brandUser._id,
      }).lean();

      const campaignsAnalytics = [] as any[];

      for (const c of campaigns) {
        const attempts = await PuzzleAttemptModel.find({
          campaignId: c._id.toString(),
        }).lean();
        const plays = attempts.length;
        const completions = attempts.filter((a) => a.solved).length;
        const avgCompletionTime = attempts.filter((a) => a.solved).length
          ? Math.round(
              attempts
                .filter((a) => a.solved)
                .reduce((s, a) => s + (a.timeTaken || 0), 0) /
                attempts.filter((a) => a.solved).length
            )
          : 0;

        // question correctness rates
        const qCorrectCounts: number[] = c.questions.map(() => 0);
        for (const a of attempts) {
          if (Array.isArray(a.answers)) {
            for (
              let i = 0;
              i < a.answers.length && i < c.questions.length;
              i++
            ) {
              if (a.answers[i] === c.questions[i].correctIndex)
                qCorrectCounts[i]++;
            }
          }
        }
        const qRates = qCorrectCounts.map((cnt) => (plays ? cnt / plays : 0));

        campaignsAnalytics.push({
          campaignId: c._id,
          title: c.title,
          plays,
          completions,
          avgCompletionTime,
          questionCorrectnessRates: qRates,
        });
      }

      res.status(200).json({ success: true, campaigns: campaignsAnalytics });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Get all brands
export const getAllBrands = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Find all users with role 'brand'
      const brandUsers = await UserModel.find({ role: "brand" })
        .select("_id name email companyName avatar isVerified createdAt")
        .lean();

      // Get brand details for each brand user
      const brands = await Promise.all(
        brandUsers.map(async (brandUser) => {
          const brandProfile = await BrandModel.findOne({ userId: brandUser._id }).lean();
          const campaignCount = await PuzzleCampaignModel.countDocuments({
            brandId: brandUser._id,
          });

          return {
            _id: brandUser._id,
            name: brandUser.name,
            email: brandUser.email,
            companyName: brandUser.companyName,
            avatar: brandUser.avatar,
            isVerified: brandUser.isVerified,
            createdAt: (brandUser as any).createdAt,
            brandDetails: brandProfile
              ? {
                  companyEmail: brandProfile.companyEmail,
                  verified: brandProfile.verified,
                  totalCampaigns: campaignCount,
                }
              : null,
          };
        })
      );

      res.status(200).json({ success: true, brands });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
