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
const userHelpers_1 = require("../utils/userHelpers");
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
            // Validate avatar if provided - reject base64 images
            if (avatar) {
                if (avatar.startsWith("data:image/") || avatar.startsWith("data:application/")) {
                    return next(new ErrorHandler_1.default("Base64 encoded images are not supported. Please provide a valid image URL instead.", 400));
                }
                if (!avatar.startsWith("http://") && !avatar.startsWith("https://")) {
                    return next(new ErrorHandler_1.default("Avatar must be a valid URL (starting with http:// or https://)", 400));
                }
            }
            profile = { email, name, picture: avatar, uid: googleId };
        }
        else {
            return next(new ErrorHandler_1.default("Invalid Google payload", 400));
        }
        let user = yield user_model_1.default.findOne({ email: profile.email });
        if (!user) {
            const fullName = profile.name || profile.email.split("@")[0];
            const nameParts = fullName.split(" ");
            const firstName = nameParts[0] || fullName;
            const lastName = nameParts.slice(1).join(" ") || "";
            const username = yield (0, userHelpers_1.generateUsername)(profile.email);
            const avatar = profile.picture || (0, userHelpers_1.generateAvatar)(`${firstName} ${lastName}`.trim() || profile.email);
            user = yield user_model_1.default.create({
                firstName,
                lastName,
                username,
                email: profile.email,
                avatar,
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
        return next(new ErrorHandler_1.default(`Google authentication failed: ${error.message}`, 500));
    }
}));
// Gamer email signup (email + password registration)
exports.registerGamer = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { firstName, lastName, email, password } = req.body;
        if (!email || !password || !firstName) {
            return next(new ErrorHandler_1.default("Missing required fields: firstName, email, password", 400));
        }
        const existing = yield user_model_1.default.findOne({ email });
        if (existing)
            return next(new ErrorHandler_1.default("This email is already registered. Please use a different email or try logging in.", 409));
        const username = yield (0, userHelpers_1.generateUsername)(email);
        const avatar = (0, userHelpers_1.generateAvatar)(`${firstName} ${lastName || ''}`.trim() || email);
        // Create activation token BEFORE creating user
        const activationToken = (0, user_controller_1.createActivationToken)({
            firstName,
            lastName,
            email,
            password,
        });
        const activationCode = activationToken.activationCode;
        const data = { user: { name: firstName }, activationCode };
        // Try to send email first
        try {
            yield ejs_1.default.renderFile(path_1.default.join(__dirname, "../mails/activation-mail.ejs"), data);
            yield (0, sendEmail_1.default)({
                email,
                subject: "Verify your gamer account",
                template: "activation-mail.ejs",
                data,
            });
            // Only create user AFTER email is successfully sent
            const user = yield user_model_1.default.create({
                firstName,
                lastName: lastName || "",
                username,
                email,
                password,
                avatar,
                role: "gamer",
                isVerified: false,
            });
            res.status(201).json({
                success: true,
                message: "Registration successful! Please check your email to verify your account.",
                activationToken: activationToken.token,
            });
        }
        catch (mailErr) {
            // If email fails, return error with details
            console.error("Email sending failed:", mailErr);
            return next(new ErrorHandler_1.default(`Registration failed: Unable to send verification email. Please check your email configuration. Error: ${mailErr.message}`, 500));
        }
    }
    catch (error) {
        return next(new ErrorHandler_1.default(`Gamer registration failed: ${error.message}`, 500));
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
        const { firstName, lastName, email, password } = decoded.user;
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
        const username = yield (0, userHelpers_1.generateUsername)(email);
        const avatar = (0, userHelpers_1.generateAvatar)(`${firstName} ${lastName || ''}`.trim() || email);
        const user = yield user_model_1.default.create({
            firstName,
            lastName: lastName || "",
            username,
            email,
            password,
            avatar,
            role: "gamer",
            isVerified: true,
        });
        (0, jwt_1.sendToken)(user, 201, res);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(`Account activation failed: ${error.message}`, 500));
    }
}));
// Unified login for both gamers and brands
exports.login = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return next(new ErrorHandler_1.default("Please provide both email and password", 400));
        const user = yield user_model_1.default.findOne({ email }).select("+password");
        if (!user)
            return next(new ErrorHandler_1.default("Invalid email or password. Please check your credentials and try again.", 401));
        const match = yield user.comparePassword(password);
        if (!match)
            return next(new ErrorHandler_1.default("Invalid email or password. Please check your credentials and try again.", 401));
        (0, jwt_1.sendToken)(user, 200, res);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(`Login failed: ${error.message}`, 500));
    }
}));
// Brand registration (email/password)
exports.registerBrand = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, password, companyName } = req.body;
        if (!email || !password || !companyName) {
            return next(new ErrorHandler_1.default("Missing required fields: email, password, and companyName are required", 400));
        }
        const existing = yield user_model_1.default.findOne({ email });
        if (existing)
            return next(new ErrorHandler_1.default("This email is already registered. Please use a different email or try logging in.", 409));
        // Create activation token BEFORE creating user
        const activationToken = (0, user_controller_1.createActivationToken)({
            name,
            email,
            password,
            companyName,
        });
        const activationCode = activationToken.activationCode;
        const data = { user: { name }, activationCode };
        // Try to send email first
        try {
            yield ejs_1.default.renderFile(path_1.default.join(__dirname, "../mails/activation-mail.ejs"), data);
            yield (0, sendEmail_1.default)({
                email,
                subject: "Activate your brand account",
                template: "activation-mail.ejs",
                data,
            });
            // Only create user and brand profile AFTER email is successfully sent
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
            res.status(201).json({
                success: true,
                message: "Registration successful! Please check your email to verify your account.",
                activationToken: activationToken.token,
            });
        }
        catch (mailErr) {
            // If email fails, return error with details
            console.error("Email sending failed:", mailErr);
            return next(new ErrorHandler_1.default(`Registration failed: Unable to send verification email. Please check your email configuration. Error: ${mailErr.message}`, 500));
        }
    }
    catch (error) {
        return next(new ErrorHandler_1.default(`Brand registration failed: ${error.message}`, 500));
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
        return next(new ErrorHandler_1.default(`Brand activation failed: ${error.message}`, 500));
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
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            password: user.password, // hashed password from DB
        });
        const activationCode = activationToken.activationCode;
        const data = { user: { name: user.firstName }, activationCode };
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
        return next(new ErrorHandler_1.default(`Failed to resend activation email: ${error.message}`, 500));
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
        return next(new ErrorHandler_1.default(`Failed to resend activation email: ${error.message}`, 500));
    }
}));
