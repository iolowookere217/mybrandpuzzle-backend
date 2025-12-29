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
exports.getAllBrands = exports.getCampaignAnalytics = exports.createCampaign = void 0;
const catchAsyncError_1 = require("../middlewares/catchAsyncError");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const puzzleCampaign_model_1 = __importDefault(require("../models/puzzleCampaign.model"));
const brand_model_1 = __importDefault(require("../models/brand.model"));
const firebaseConfig_1 = require("../firebaseConfig");
const puzzleAttempt_model_1 = __importDefault(require("../models/puzzleAttempt.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const package_model_1 = __importDefault(require("../models/package.model"));
// Create a puzzle campaign (brands only). Expects multipart upload with one file: "image" (used for both scrambled and original)
exports.createCampaign = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const brandUser = req.user;
        if (brandUser.role !== "brand")
            return next(new ErrorHandler_1.default("Only brands can create campaigns", 403));
        const { questions, title, description, gameType, words, packageId, brandUrl, campaignUrl, timeLimit } = req.body;
        // Validate packageId
        if (!packageId || typeof packageId !== "string") {
            return next(new ErrorHandler_1.default("packageId is required and must be a valid string", 400));
        }
        // Verify package exists
        const packageData = yield package_model_1.default.findById(packageId);
        if (!packageData) {
            return next(new ErrorHandler_1.default("Invalid package. Package not found.", 404));
        }
        if (!packageData.isActive) {
            return next(new ErrorHandler_1.default("Selected package is not available", 400));
        }
        // validate required fields
        if (!title || typeof title !== "string" || title.trim() === "") {
            return next(new ErrorHandler_1.default("title is required and must be a non-empty string", 400));
        }
        if (!description ||
            typeof description !== "string" ||
            description.trim() === "") {
            return next(new ErrorHandler_1.default("description is required and must be a non-empty string", 400));
        }
        // Validate gameType field
        const validGameTypes = ["sliding_puzzle", "card_matching", "whack_a_mole", "word_hunt"];
        const campaignGameType = gameType || "sliding_puzzle";
        if (!validGameTypes.includes(campaignGameType)) {
            return next(new ErrorHandler_1.default('gameType must be one of: sliding_puzzle, card_matching, whack_a_mole, word_hunt', 400));
        }
        // Parse words array if it's a string (from form-data)
        let parsedWords = [];
        if (words) {
            if (typeof words === "string") {
                try {
                    parsedWords = JSON.parse(words);
                }
                catch (_d) {
                    // If parsing fails, try splitting by comma
                    parsedWords = words.split(",").map((w) => w.trim()).filter((w) => w.length > 0);
                }
            }
            else if (Array.isArray(words)) {
                parsedWords = words;
            }
        }
        // For word_hunt games, validate words array
        if (campaignGameType === "word_hunt") {
            if (!parsedWords || parsedWords.length === 0) {
                return next(new ErrorHandler_1.default("words array is required for word_hunt games and must contain at least one word", 400));
            }
        }
        // Get brand profile (no restriction on number of campaigns)
        const brand = yield brand_model_1.default.findOne({ userId: brandUser._id });
        if (!brand) {
            return next(new ErrorHandler_1.default("Brand profile not found", 404));
        }
        // multer stores single-file upload in req.file
        const uploadedFile = req.file;
        if (!uploadedFile) {
            return next(new ErrorHandler_1.default('Missing image file. Please upload using field name "image"', 400));
        }
        // use a single timestamp so both stored names are related
        const now = Date.now();
        const puzzleName = `puzzles/${now}-puzzle-${uploadedFile.originalname}`;
        const originalName = `puzzles/${now}-original-${uploadedFile.originalname}`;
        const uploadBuffer = (file, name) => __awaiter(void 0, void 0, void 0, function* () {
            const fileRef = firebaseConfig_1.bucket.file(name);
            yield fileRef.save(file.buffer, {
                resumable: false,
                contentType: file.mimetype,
            });
            yield fileRef.makePublic();
            return `https://storage.googleapis.com/${firebaseConfig_1.bucket.name}/${name}`;
        });
        const puzzleUrl = yield uploadBuffer(uploadedFile, puzzleName);
        const originalUrl = yield uploadBuffer(uploadedFile, originalName);
        // parse questions (expected as JSON string or array)
        let parsedQuestions = [];
        const rawQuestions = (_b = questions !== null && questions !== void 0 ? questions : (_a = req.body) === null || _a === void 0 ? void 0 : _a.questions) !== null && _b !== void 0 ? _b : (_c = req.body) === null || _c === void 0 ? void 0 : _c.question;
        const tryParse = (val) => {
            try {
                return JSON.parse(val);
            }
            catch (_a) {
                // try a simple fix: replace single quotes with double quotes
                try {
                    const fixed = val.replace(/'/g, '"');
                    return JSON.parse(fixed);
                }
                catch (_b) {
                    return null;
                }
            }
        };
        if (typeof rawQuestions === "string" && rawQuestions.trim() !== "") {
            const parsed = tryParse(rawQuestions);
            if (parsed === null) {
                return next(new ErrorHandler_1.default(`Invalid JSON for questions field. Received: ${rawQuestions}`, 400));
            }
            parsedQuestions = parsed;
        }
        else if (Array.isArray(rawQuestions)) {
            parsedQuestions = rawQuestions;
        }
        else if (rawQuestions && typeof rawQuestions === "object") {
            // handle cases where form-data produced an object with numeric keys
            const vals = Object.values(rawQuestions);
            if (vals.length && vals.every((v) => typeof v === "object"))
                parsedQuestions = vals;
            else
                parsedQuestions = [];
        }
        else {
            parsedQuestions = [];
        }
        // validate parsedQuestions
        if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
            return next(new ErrorHandler_1.default("Missing or invalid questions array", 400));
        }
        for (const q of parsedQuestions) {
            if (!q ||
                typeof q.question !== "string" ||
                !Array.isArray(q.choices) ||
                typeof q.correctIndex !== "number") {
                return next(new ErrorHandler_1.default("Each question must have 'question', 'choices' array and numeric 'correctIndex'", 400));
            }
        }
        // helper to robustly parse numeric fields from multipart/form-data
        const getNumericFromBody = (fieldName) => {
            var _a;
            let v = (_a = req.body) === null || _a === void 0 ? void 0 : _a[fieldName];
            if (Array.isArray(v))
                v = v[0];
            if (v && typeof v === "object") {
                const vals = Object.values(v);
                if (vals.length)
                    v = vals[0];
            }
            if (typeof v === "string") {
                const cleaned = v.replace(/[^0-9.-]/g, "").trim();
                if (cleaned === "")
                    return null;
                const n = Number(cleaned);
                return Number.isFinite(n) ? n : null;
            }
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        };
        // Validate timeLimit
        const parsedTimeLimit = Number(timeLimit);
        if (!timeLimit || isNaN(parsedTimeLimit) || parsedTimeLimit <= 0) {
            return next(new ErrorHandler_1.default("timeLimit is required and must be a positive number (in hours)", 400));
        }
        // Calculate campaign start and end dates based on timeLimit (in hours)
        const startDate = new Date();
        const endDate = new Date();
        endDate.setHours(endDate.getHours() + parsedTimeLimit); // Add timeLimit hours to current time
        // Prepare campaign data
        const campaignData = {
            brandId: brandUser._id,
            packageId: packageId,
            gameType: campaignGameType,
            title: title.trim(),
            description: description.trim(),
            brandUrl: (brandUrl === null || brandUrl === void 0 ? void 0 : brandUrl.trim()) || null,
            campaignUrl: (campaignUrl === null || campaignUrl === void 0 ? void 0 : campaignUrl.trim()) || null,
            puzzleImageUrl: puzzleUrl,
            originalImageUrl: originalUrl,
            questions: parsedQuestions,
            timeLimit: parsedTimeLimit,
            status: "active",
            startDate,
            endDate,
        };
        // For word_hunt games, add words array
        if (campaignGameType === "word_hunt" && parsedWords.length > 0) {
            campaignData.words = parsedWords;
        }
        const campaign = yield puzzleCampaign_model_1.default.create(campaignData);
        // Update brand campaigns list (no restrictions on number of campaigns)
        yield brand_model_1.default.findOneAndUpdate({ userId: brandUser._id }, { $push: { campaigns: campaign._id } });
        // Convert to plain object to ensure all fields are included
        const campaignResponse = campaign.toObject();
        // Add package name to response
        const responseWithPackageName = Object.assign(Object.assign({}, campaignResponse), { packageName: packageData.name });
        console.log('Campaign created. Has campaignUrl?', 'campaignUrl' in responseWithPackageName);
        console.log('campaignUrl value in response:', responseWithPackageName.campaignUrl);
        console.log('brandUrl value in response:', responseWithPackageName.brandUrl);
        res.status(201).json({ success: true, campaign: responseWithPackageName });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(`Failed to create campaign: ${error.message}`, 500));
    }
}));
exports.getCampaignAnalytics = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const brandUser = req.user;
        if (brandUser.role !== "brand")
            return next(new ErrorHandler_1.default("Only brands can access analytics", 403));
        const brand = yield brand_model_1.default.findOne({ userId: brandUser._id });
        if (!brand)
            return next(new ErrorHandler_1.default("Brand not found", 404));
        // Fetch campaigns for brand
        const campaigns = yield puzzleCampaign_model_1.default.find({
            brandId: brandUser._id,
        }).lean();
        const campaignsAnalytics = [];
        for (const c of campaigns) {
            const attempts = yield puzzleAttempt_model_1.default.find({
                campaignId: c._id.toString(),
            }).lean();
            const plays = attempts.length;
            const completions = attempts.filter((a) => a.solved).length;
            const avgCompletionTime = attempts.filter((a) => a.solved).length
                ? Math.round(attempts
                    .filter((a) => a.solved)
                    .reduce((s, a) => s + (a.timeTaken || 0), 0) /
                    attempts.filter((a) => a.solved).length)
                : 0;
            // question correctness rates
            const qCorrectCounts = c.questions.map(() => 0);
            for (const a of attempts) {
                if (Array.isArray(a.answers)) {
                    for (let i = 0; i < a.answers.length && i < c.questions.length; i++) {
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
    }
    catch (error) {
        return next(new ErrorHandler_1.default(`Failed to fetch campaign analytics: ${error.message}`, 500));
    }
}));
// Get all brands
exports.getAllBrands = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Find all users with role 'brand'
        const brandUsers = yield user_model_1.default.find({ role: "brand" })
            .select("_id name email companyName avatar isVerified createdAt")
            .lean();
        // Get brand details for each brand user
        const brands = yield Promise.all(brandUsers.map((brandUser) => __awaiter(void 0, void 0, void 0, function* () {
            const brandProfile = yield brand_model_1.default.findOne({ userId: brandUser._id }).lean();
            const campaignCount = yield puzzleCampaign_model_1.default.countDocuments({
                brandId: brandUser._id,
            });
            return {
                _id: brandUser._id,
                name: brandUser.name,
                email: brandUser.email,
                companyName: brandUser.companyName,
                avatar: brandUser.avatar,
                isVerified: brandUser.isVerified,
                createdAt: brandUser.createdAt,
                brandDetails: brandProfile
                    ? {
                        companyEmail: brandProfile.companyEmail,
                        verified: brandProfile.verified,
                        totalCampaigns: campaignCount,
                    }
                    : null,
            };
        })));
        res.status(200).json({ success: true, brands });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(`Failed to fetch brands: ${error.message}`, 500));
    }
}));
