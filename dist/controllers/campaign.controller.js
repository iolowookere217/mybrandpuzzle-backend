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
exports.submitCampaign = exports.getCampaignById = exports.getCampaignsByBrand = exports.getAllCampaigns = exports.getActiveCampaigns = void 0;
const catchAsyncError_1 = require("../middlewares/catchAsyncError");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const puzzleCampaign_model_1 = __importDefault(require("../models/puzzleCampaign.model"));
const puzzleAttempt_model_1 = __importDefault(require("../models/puzzleAttempt.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
// Get active campaigns only (with brand name included)
exports.getActiveCampaigns = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gameType } = req.query;
        // Build filter for active campaigns only
        const filter = { status: "active" };
        const validGameTypes = ["sliding_puzzle", "card_matching", "whack_a_mole", "word_hunt"];
        if (gameType && validGameTypes.includes(gameType)) {
            filter.gameType = gameType;
        }
        const campaigns = yield puzzleCampaign_model_1.default.find(filter)
            .select("_id brandId packageId gameType title description brandUrl puzzleImageUrl timeLimit questions words status startDate endDate createdAt")
            .lean();
        // Fetch brand names for all campaigns
        const campaignsWithBrand = yield Promise.all(campaigns.map((campaign) => __awaiter(void 0, void 0, void 0, function* () {
            const brand = yield user_model_1.default.findById(campaign.brandId).select("name companyName").lean();
            return {
                _id: campaign._id,
                brandId: campaign.brandId,
                packageId: campaign.packageId,
                brandName: (brand === null || brand === void 0 ? void 0 : brand.companyName) || (brand === null || brand === void 0 ? void 0 : brand.name) || "Unknown Brand",
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
                createdAt: campaign.createdAt,
            };
        })));
        res.status(200).json({ success: true, campaigns: campaignsWithBrand });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Get all campaigns (with brand name included)
exports.getAllCampaigns = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gameType, status } = req.query;
        // Build filter
        const filter = {};
        const validGameTypes = ["sliding_puzzle", "card_matching", "whack_a_mole", "word_hunt"];
        if (gameType && validGameTypes.includes(gameType)) {
            filter.gameType = gameType;
        }
        // Filter by status if provided
        const validStatuses = ["active", "ended", "draft"];
        if (status && validStatuses.includes(status)) {
            filter.status = status;
        }
        const campaigns = yield puzzleCampaign_model_1.default.find(filter)
            .select("_id brandId packageId gameType title description brandUrl puzzleImageUrl timeLimit questions words status startDate endDate createdAt")
            .lean();
        // Fetch brand names for all campaigns
        const campaignsWithBrand = yield Promise.all(campaigns.map((campaign) => __awaiter(void 0, void 0, void 0, function* () {
            const brand = yield user_model_1.default.findById(campaign.brandId).select("name companyName").lean();
            return {
                _id: campaign._id,
                brandId: campaign.brandId,
                packageId: campaign.packageId,
                brandName: (brand === null || brand === void 0 ? void 0 : brand.companyName) || (brand === null || brand === void 0 ? void 0 : brand.name) || "Unknown Brand",
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
                createdAt: campaign.createdAt,
            };
        })));
        res.status(200).json({ success: true, campaigns: campaignsWithBrand });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Get campaigns by brandId
exports.getCampaignsByBrand = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { brandId } = req.params;
        const campaigns = yield puzzleCampaign_model_1.default.find({ brandId })
            .select("_id brandId packageId gameType title description brandUrl puzzleImageUrl timeLimit questions words status startDate endDate createdAt")
            .lean();
        if (!campaigns || campaigns.length === 0) {
            return res.status(200).json({ success: true, campaigns: [] });
        }
        // Fetch brand name
        const brand = yield user_model_1.default.findById(brandId).select("name companyName").lean();
        const brandName = (brand === null || brand === void 0 ? void 0 : brand.companyName) || (brand === null || brand === void 0 ? void 0 : brand.name) || "Unknown Brand";
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
            createdAt: campaign.createdAt,
        }));
        res.status(200).json({ success: true, campaigns: campaignsWithBrand });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Get single campaign by campaignId (with brand name)
exports.getCampaignById = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaignId } = req.params;
        const campaign = yield puzzleCampaign_model_1.default.findById(campaignId).lean();
        if (!campaign) {
            return next(new ErrorHandler_1.default("Campaign not found", 404));
        }
        // Fetch brand name
        const brand = yield user_model_1.default.findById(campaign.brandId).select("name companyName").lean();
        const brandName = (brand === null || brand === void 0 ? void 0 : brand.companyName) || (brand === null || brand === void 0 ? void 0 : brand.name) || "Unknown Brand";
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
                questions: campaign.questions.map((q) => ({
                    question: q.question,
                    choices: q.choices,
                })),
                words: campaign.words,
                timeLimit: campaign.timeLimit,
                status: campaign.status,
                startDate: campaign.startDate,
                endDate: campaign.endDate,
                createdAt: campaign.createdAt,
            },
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
exports.submitCampaign = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaignId } = req.params;
        const user = req.user;
        const userId = user && user._id ? String(user._id) : undefined;
        const body = req.body;
        const campaign = yield puzzleCampaign_model_1.default.findById(campaignId);
        if (!campaign) {
            return next(new ErrorHandler_1.default("Campaign not found", 404));
        }
        // compute quiz score
        let quizScore = 0;
        if (Array.isArray(body.answers)) {
            for (let i = 0; i < Math.min(body.answers.length, campaign.questions.length); i++) {
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
            const prev = yield puzzleAttempt_model_1.default.findOne({
                userId: userId,
                campaignId: campaignId,
                solved: true,
            });
            if (!prev)
                firstTime = true;
        }
        // Award points only if solved AND all questions answered correctly
        const pointsEarned = (firstTime && allQuestionsCorrect) ? 1 : 0;
        const attempt = yield puzzleAttempt_model_1.default.create({
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
        const userDoc = userId ? yield user_model_1.default.findById(userId) : null;
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
            yield userDoc.save();
        }
        res.status(201).json({
            success: true,
            attempt,
            gameType: campaign.gameType,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
