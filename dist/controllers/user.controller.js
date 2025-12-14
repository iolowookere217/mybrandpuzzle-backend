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
exports.updateBrandProfile = exports.updateGamerProfile = exports.getBrandProfile = exports.getGamerProfile = exports.getUserInfo = exports.updateAccessToken = exports.logoutUser = exports.loginUser = exports.activateUser = exports.createActivationToken = exports.registerUser = void 0;
const user_model_1 = __importDefault(require("../models/user.model"));
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const catchAsyncError_1 = require("../middlewares/catchAsyncError");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
const sendEmail_1 = __importDefault(require("../utils/sendEmail"));
const redis_1 = require("../utils/redis");
require("dotenv/config");
const jwt_1 = require("../utils/jwt");
//Register user
exports.registerUser = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, password } = req.body;
        //Check if email already exists
        const isEmailExist = yield user_model_1.default.findOne({ email });
        if (isEmailExist) {
            return next(new ErrorHandler_1.default("Email already exists", 400));
        }
        const user = {
            name,
            email,
            password,
        };
        const activationToken = (0, exports.createActivationToken)(user);
        const activationCode = activationToken.activationCode;
        const data = { user: { name: user.name }, activationCode };
        yield ejs_1.default.renderFile(path_1.default.join(__dirname, "../mails/activation-mail.ejs"), data);
        //send email to user
        try {
            yield (0, sendEmail_1.default)({
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
        }
        catch (error) {
            console.log(error);
            return next(new ErrorHandler_1.default(error.message, 400));
        }
    }
    catch (error) {
        console.log(error);
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
const createActivationToken = (user) => {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const token = jsonwebtoken_1.default.sign({
        user,
        activationCode,
    }, process.env.ACTIVATION_SECRET, {
        expiresIn: "5m",
    });
    return { token, activationCode };
};
exports.createActivationToken = createActivationToken;
exports.activateUser = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { activation_token, activation_code } = req.body;
        const newUser = jsonwebtoken_1.default.verify(activation_token, process.env.ACTIVATION_SECRET);
        if (newUser.activationCode !== activation_code) {
            return next(new ErrorHandler_1.default("Invalid activation code", 400));
        }
        const { name, email, password } = newUser.user;
        const existUser = yield user_model_1.default.findOne({ email });
        if (existUser) {
            return next(new ErrorHandler_1.default("Email already exist", 400));
        }
        //store user data in database
        yield user_model_1.default.create({
            name,
            email,
            password,
        });
        res.status(201).json({
            success: true,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
exports.loginUser = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({
                message: "Invalid credentials",
            });
        }
        const user = yield user_model_1.default.findOne({ email }).select("+password");
        if (!user) {
            return next(new ErrorHandler_1.default("Invalid email or password", 403));
        }
        //check password
        const isPasswordMatch = yield ((_a = user.comparePassword) === null || _a === void 0 ? void 0 : _a.call(user, password));
        if (!isPasswordMatch) {
            return next(new ErrorHandler_1.default("Invalid email or password", 403));
        }
        (0, jwt_1.sendToken)(user, 200, res);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 403));
    }
}));
//logout user
exports.logoutUser = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        res.cookie("access_token", "", { maxAge: 1 });
        res.cookie("refresh_token", "", { maxAge: 1 });
        // delete cache from redis
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        redis_1.redis.del(userId);
        res.status(200).json({
            success: true,
            message: "logged out successfully",
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// update access token
exports.updateAccessToken = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const refresh_token = req.cookies.refresh_token;
        //Verify refresh token
        const decoded = jsonwebtoken_1.default.verify(refresh_token, process.env.REFRESH_TOKEN);
        if (!decoded) {
            return next(new ErrorHandler_1.default("Could not refresh access token", 400));
        }
        //Get user id
        const session = yield redis_1.redis.get(decoded.id);
        if (!session) {
            return next(new ErrorHandler_1.default("Could not refresh access token", 400));
        }
        const user = JSON.parse(session);
        //create access and refresh token
        const accessToken = jsonwebtoken_1.default.sign({ id: user._id }, process.env.ACCESS_TOKEN, {
            expiresIn: "5m",
        });
        const refreshToken = jsonwebtoken_1.default.sign({ id: user._id }, process.env.REFRESH_TOKEN, {
            expiresIn: "3d",
        });
        req.user = user;
        res.cookie("access_token", accessToken, jwt_1.accessTokenOptions);
        res.cookie("refresh_token", refreshToken, jwt_1.refreshTokenOptions);
        res.status(200).json({
            success: true,
            accessToken,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// get user
exports.getUserInfo = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const userJson = yield redis_1.redis.get(userId);
        if (userJson) {
            const user = JSON.parse(userJson);
            res.status(200).json({
                success: true,
                user,
            });
        }
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Get gamer profile with full analytics
exports.getGamerProfile = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        if (!req.user || req.user.role !== "gamer") {
            return next(new ErrorHandler_1.default("Access denied. Gamer profile only.", 403));
        }
        const user = yield user_model_1.default.findById(userId).select("-password").lean();
        if (!user) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        res.status(200).json({
            success: true,
            profile: {
                _id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                isVerified: user.isVerified,
                analytics: user.analytics,
                puzzlesSolved: user.puzzlesSolved,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Get brand profile with brand details and campaigns
exports.getBrandProfile = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        if (!req.user || req.user.role !== "brand") {
            return next(new ErrorHandler_1.default("Access denied. Brand profile only.", 403));
        }
        const user = yield user_model_1.default.findById(userId).select("-password").lean();
        if (!user) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        // Get brand details
        const BrandModel = require("../models/brand.model").default;
        const brandProfile = yield BrandModel.findOne({ userId }).lean();
        // Get campaigns
        const PuzzleCampaignModel = require("../models/puzzleCampaign.model").default;
        const campaigns = yield PuzzleCampaignModel.find({
            brandId: userId,
        })
            .select("_id title description gameType puzzleImageUrl timeLimit createdAt")
            .lean();
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
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                brandDetails: brandProfile
                    ? {
                        companyEmail: brandProfile.companyEmail,
                        companyName: brandProfile.companyName,
                        verified: brandProfile.verified,
                        totalCampaigns: campaigns.length,
                    }
                    : null,
                campaigns,
            },
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Update gamer profile
exports.updateGamerProfile = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        if (!req.user || req.user.role !== "gamer") {
            return next(new ErrorHandler_1.default("Access denied. Gamer profile only.", 403));
        }
        const { name, avatar } = req.body;
        // Build update object with only provided fields
        const updateData = {};
        if (name && typeof name === "string" && name.trim() !== "") {
            updateData.name = name.trim();
        }
        if (avatar && typeof avatar === "string") {
            updateData.avatar = avatar;
        }
        // Check if there's anything to update
        if (Object.keys(updateData).length === 0) {
            return next(new ErrorHandler_1.default("No valid fields provided for update", 400));
        }
        const updatedUser = yield user_model_1.default
            .findByIdAndUpdate(userId, updateData, { new: true })
            .select("-password");
        if (!updatedUser) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        // Update redis cache if exists
        try {
            yield redis_1.redis.set(userId, JSON.stringify(updatedUser));
        }
        catch (redisErr) {
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
                isVerified: updatedUser.isVerified,
                analytics: updatedUser.analytics,
                puzzlesSolved: updatedUser.puzzlesSolved,
            },
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Update brand profile
exports.updateBrandProfile = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        if (!req.user || req.user.role !== "brand") {
            return next(new ErrorHandler_1.default("Access denied. Brand profile only.", 403));
        }
        const { name, avatar, companyName } = req.body;
        // Build update object for user model with only provided fields
        const userUpdateData = {};
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
            return next(new ErrorHandler_1.default("No valid fields provided for update", 400));
        }
        // Update user model
        const updatedUser = yield user_model_1.default
            .findByIdAndUpdate(userId, userUpdateData, { new: true })
            .select("-password");
        if (!updatedUser) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        // If companyName is updated, also update brand profile
        if (companyName) {
            const BrandModel = require("../models/brand.model").default;
            yield BrandModel.findOneAndUpdate({ userId }, { companyName: companyName.trim() });
        }
        // Update redis cache if exists
        try {
            yield redis_1.redis.set(userId, JSON.stringify(updatedUser));
        }
        catch (redisErr) {
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
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
