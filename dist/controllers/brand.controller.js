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
exports.getCampaignAnalytics = exports.createCampaign = void 0;
const catchAsyncError_1 = require("../middlewares/catchAsyncError");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const puzzleCampaign_model_1 = __importDefault(require("../models/puzzleCampaign.model"));
const brand_model_1 = __importDefault(require("../models/brand.model"));
const firebaseConfig_1 = require("../firebaseConfig");
const puzzleAttempt_model_1 = __importDefault(require("../models/puzzleAttempt.model"));
// Create a puzzle campaign (brands only). Expects multipart upload with one file: "image" (used for both scrambled and original)
exports.createCampaign = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
        const brandUser = req.user;
        if (brandUser.role !== "brand")
            return next(new ErrorHandler_1.default("Only brands can create campaigns", 403));
        const { questions, title, description } = req.body;
        // validate required fields
        if (!title || typeof title !== "string" || title.trim() === "") {
            return next(new ErrorHandler_1.default("title is required and must be a non-empty string", 400));
        }
        if (!description ||
            typeof description !== "string" ||
            description.trim() === "") {
            return next(new ErrorHandler_1.default("description is required and must be a non-empty string", 400));
        }
        // multer stores single-file uploads in req.file, or older setups may place files in req.files
        const filesAny = req.files;
        const uploadedFile = req.file ||
            ((_a = filesAny === null || filesAny === void 0 ? void 0 : filesAny.image) === null || _a === void 0 ? void 0 : _a[0]) ||
            ((_b = filesAny === null || filesAny === void 0 ? void 0 : filesAny.puzzleImage) === null || _b === void 0 ? void 0 : _b[0]) ||
            ((_c = filesAny === null || filesAny === void 0 ? void 0 : filesAny.originalImage) === null || _c === void 0 ? void 0 : _c[0]);
        if (!uploadedFile)
            return next(new ErrorHandler_1.default("Missing image", 400));
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
        const rawQuestions = (_e = questions !== null && questions !== void 0 ? questions : (_d = req.body) === null || _d === void 0 ? void 0 : _d.questions) !== null && _e !== void 0 ? _e : (_f = req.body) === null || _f === void 0 ? void 0 : _f.question;
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
        const timeLimitVal = getNumericFromBody("timeLimit");
        if (timeLimitVal === null || timeLimitVal === undefined) {
            return next(new ErrorHandler_1.default("timeLimit (hours) is required and must be a number", 400));
        }
        const campaign = yield puzzleCampaign_model_1.default.create({
            brandId: brandUser._id,
            title: title.trim(),
            description: description.trim(),
            puzzleImageUrl: puzzleUrl,
            originalImageUrl: originalUrl,
            questions: parsedQuestions,
            timeLimit: timeLimitVal,
        });
        // update brand campaigns list
        yield brand_model_1.default.findOneAndUpdate({ userId: brandUser._id }, { $push: { campaigns: campaign._id } });
        res.status(201).json({ success: true, campaign });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
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
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
