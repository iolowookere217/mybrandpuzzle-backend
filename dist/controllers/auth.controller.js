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
exports.resendBrandActivation = exports.resendGamerActivation = exports.activateBrand = exports.logout = exports.registerBrand = exports.login = exports.activateGamer = exports.registerGamer = exports.googleAuth = void 0;
const catchAsyncError_1 = require("../middlewares/catchAsyncError");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const user_model_1 = __importDefault(require("../models/user.model"));
const brand_model_1 = __importDefault(require("../models/brand.model"));
const jwt_1 = require("../utils/jwt");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
// ensure firebase admin is initialized (firebaseConfig reads env and calls initializeApp)
require("../firebaseConfig");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const path_1 = __importDefault(require("path"));
const ejs_1 = __importDefault(require("ejs"));
const sendEmail_1 = __importDefault(require("../utils/sendEmail"));
const user_controller_1 = require("./user.controller");
// Google OAuth sign-in (client provides profile info or idToken)
exports.googleAuth = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Accept either a firebase idToken or a minimal profile payload
        const { idToken, email, name, avatar, googleId } = req.body;
        let profile = null;
        if (idToken) {
            // verify with firebase-admin
            const decoded = yield firebase_admin_1.default.auth().verifyIdToken(idToken);
            profile = {
                email: decoded.email || "",
                name: decoded.name,
                picture: decoded.picture,
                uid: decoded.uid,
            };
        }
        else if (email && googleId) {
            profile = { email, name, picture: avatar, uid: googleId };
        }
        else {
            return next(new ErrorHandler_1.default("Invalid Google payload", 400));
        }
        let user = yield user_model_1.default.findOne({ email: profile.email });
        if (!user) {
            user = yield user_model_1.default.create({
                name: profile.name || profile.email.split("@")[0],
                email: profile.email,
                avatar: profile.picture,
                googleId: profile.uid,
                role: "gamer",
                isVerified: true,
            });
        }
        else {
            // ensure googleId is stored
            if (!user.googleId && profile.uid) {
                user.googleId = profile.uid;
                yield user.save();
            }
        }
        (0, jwt_1.sendToken)(user, 200, res);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Gamer email signup (email + password registration)
exports.registerGamer = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, password } = req.body;
        if (!email || !password || !name) {
            return next(new ErrorHandler_1.default("Missing required fields: name, email, password", 400));
        }
        const existing = yield user_model_1.default.findOne({ email });
        if (existing)
            return next(new ErrorHandler_1.default("Email already exists", 400));
        const user = yield user_model_1.default.create({
            name,
            email,
            password,
            role: "gamer",
            isVerified: false,
        });
        // create activation token and email the gamer
        try {
            const activationToken = (0, user_controller_1.createActivationToken)({
                name,
                email,
                password,
            });
            const activationCode = activationToken.activationCode;
            const data = { user: { name }, activationCode };
            yield ejs_1.default.renderFile(path_1.default.join(__dirname, "../mails/activation-mail.ejs"), data);
            yield (0, sendEmail_1.default)({
                email,
                subject: "Verify your gamer account",
                template: "activation-mail.ejs",
                data,
            });
            res.status(201).json({
                success: true,
                user,
                activationToken: activationToken.token,
                message: "Activation email sent. Please verify your email.",
            });
        }
        catch (mailErr) {
            // If email fails, still return created user/token
            (0, jwt_1.sendToken)(user, 201, res);
        }
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Gamer email activation
exports.activateGamer = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { activation_token, activation_code } = req.body;
        if (!activation_token || !activation_code)
            return next(new ErrorHandler_1.default("Missing activation data", 400));
        const decoded = jsonwebtoken_1.default.verify(activation_token, process.env.ACTIVATION_SECRET);
        if (!decoded)
            return next(new ErrorHandler_1.default("Invalid activation token", 400));
        if (decoded.activationCode !== activation_code)
            return next(new ErrorHandler_1.default("Invalid activation code", 400));
        const { name, email, password } = decoded.user;
        // check if user exists
        const exist = yield user_model_1.default.findOne({ email });
        if (exist) {
            if (exist.role !== "gamer") {
                return next(new ErrorHandler_1.default("Email is registered as a different account type", 400));
            }
            // mark as verified
            if (!exist.isVerified) {
                exist.isVerified = true;
                yield exist.save();
            }
            (0, jwt_1.sendToken)(exist, 200, res);
            return;
        }
        // create new gamer account
        const user = yield user_model_1.default.create({
            name,
            email,
            password,
            role: "gamer",
            isVerified: true,
        });
        (0, jwt_1.sendToken)(user, 201, res);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Unified login for both gamers and brands
exports.login = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return next(new ErrorHandler_1.default("Missing email or password", 400));
        const user = yield user_model_1.default.findOne({ email }).select("+password");
        if (!user)
            return next(new ErrorHandler_1.default("Invalid credentials", 403));
        const match = yield user.comparePassword(password);
        if (!match)
            return next(new ErrorHandler_1.default("Invalid credentials", 403));
        (0, jwt_1.sendToken)(user, 200, res);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Brand registration (email/password)
exports.registerBrand = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, password, companyName } = req.body;
        if (!email || !password || !companyName) {
            return next(new ErrorHandler_1.default("Missing required fields", 400));
        }
        const existing = yield user_model_1.default.findOne({ email });
        if (existing)
            return next(new ErrorHandler_1.default("Email already exists", 400));
        const user = yield user_model_1.default.create({
            name,
            email,
            password,
            role: "brand",
            companyName,
            isVerified: false,
        });
        // create Brand profile
        yield brand_model_1.default.create({
            userId: user._id,
            companyEmail: email,
            companyName,
            campaigns: [],
        });
        // create activation token and email the brand
        try {
            const activationToken = (0, user_controller_1.createActivationToken)({
                name,
                email,
                password,
                companyName,
            });
            const activationCode = activationToken.activationCode;
            const data = { user: { name }, activationCode };
            yield ejs_1.default.renderFile(path_1.default.join(__dirname, "../mails/activation-mail.ejs"), data);
            yield (0, sendEmail_1.default)({
                email,
                subject: "Activate your brand account",
                template: "activation-mail.ejs",
                data,
            });
            // return activation token to client along with login token
            res.status(201).json({
                success: true,
                user,
                activationToken: activationToken.token,
            });
        }
        catch (mailErr) {
            // If email fails, still return created user/token to keep current behavior
            (0, jwt_1.sendToken)(user, 201, res);
        }
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
exports.logout = (0, catchAsyncError_1.CatchAsyncError)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.cookie("access_token", "", { maxAge: 1 });
    res.cookie("refresh_token", "", { maxAge: 1 });
    res.status(200).json({ success: true });
}));
exports.activateBrand = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { activation_token, activation_code } = req.body;
        if (!activation_token || !activation_code)
            return next(new ErrorHandler_1.default("Missing activation data", 400));
        const decoded = jsonwebtoken_1.default.verify(activation_token, process.env.ACTIVATION_SECRET);
        if (!decoded)
            return next(new ErrorHandler_1.default("Invalid activation token", 400));
        if (decoded.activationCode !== activation_code)
            return next(new ErrorHandler_1.default("Invalid activation code", 400));
        const { name, email, password, companyName } = decoded.user;
        // check if user exists
        const exist = yield user_model_1.default.findOne({ email });
        if (exist) {
            // if user exists, mark as verified and ensure brand profile exists
            if (!exist.isVerified) {
                exist.isVerified = true;
                yield exist.save();
            }
            const brandProfile = yield brand_model_1.default.findOne({ userId: exist._id });
            if (!brandProfile) {
                yield brand_model_1.default.create({
                    userId: exist._id,
                    companyEmail: email,
                    companyName,
                    campaigns: [],
                });
            }
            (0, jwt_1.sendToken)(exist, 200, res);
            return;
        }
        // user doesn't exist yet: create account
        const user = yield user_model_1.default.create({
            name,
            email,
            password,
            role: "brand",
            companyName,
            isVerified: true,
        });
        // ensure brand profile
        yield brand_model_1.default.create({
            userId: user._id,
            companyEmail: email,
            companyName,
            campaigns: [],
        });
        (0, jwt_1.sendToken)(user, 201, res);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Resend activation email for gamer
exports.resendGamerActivation = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        if (!email) {
            return next(new ErrorHandler_1.default("Email is required", 400));
        }
        // Find user
        const user = yield user_model_1.default.findOne({ email });
        if (!user) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        if (user.role !== "gamer") {
            return next(new ErrorHandler_1.default("This email is not registered as a gamer", 400));
        }
        if (user.isVerified) {
            return next(new ErrorHandler_1.default("Account is already verified", 400));
        }
        // Create new activation token
        const activationToken = (0, user_controller_1.createActivationToken)({
            name: user.name,
            email: user.email,
            password: user.password, // hashed password from DB
        });
        const activationCode = activationToken.activationCode;
        const data = { user: { name: user.name }, activationCode };
        // Send activation email
        yield (0, sendEmail_1.default)({
            email: user.email,
            subject: "Verify your gamer account",
            template: "activation-mail.ejs",
            data,
        });
        res.status(200).json({
            success: true,
            message: `Activation email resent to ${email}`,
            activationToken: activationToken.token,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Resend activation email for brand
exports.resendBrandActivation = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        if (!email) {
            return next(new ErrorHandler_1.default("Email is required", 400));
        }
        // Find user
        const user = yield user_model_1.default.findOne({ email });
        if (!user) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        if (user.role !== "brand") {
            return next(new ErrorHandler_1.default("This email is not registered as a brand", 400));
        }
        if (user.isVerified) {
            return next(new ErrorHandler_1.default("Account is already verified", 400));
        }
        // Create new activation token
        const activationToken = (0, user_controller_1.createActivationToken)({
            name: user.name,
            email: user.email,
            password: user.password, // hashed password from DB
            companyName: user.companyName,
        });
        const activationCode = activationToken.activationCode;
        const data = { user: { name: user.name }, activationCode };
        // Send activation email
        yield (0, sendEmail_1.default)({
            email: user.email,
            subject: "Verify your brand account",
            template: "activation-mail.ejs",
            data,
        });
        res.status(200).json({
            success: true,
            message: `Activation email resent to ${email}`,
            activationToken: activationToken.token,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
