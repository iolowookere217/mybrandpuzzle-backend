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
exports.getTransactionHistory = exports.getCampaignBudget = exports.paystackWebhook = exports.verifyPayment = exports.initializePayment = void 0;
const catchAsyncError_1 = require("../middlewares/catchAsyncError");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const transaction_model_1 = __importDefault(require("../models/transaction.model"));
const puzzleCampaign_model_1 = __importDefault(require("../models/puzzleCampaign.model"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
const PAYSTACK_BASE_URL = "https://api.paystack.co";
// Package pricing
const PACKAGE_PRICES = {
    basic: 7000, // ₦7,000
    premium: 10000, // ₦10,000
};
// Fixed daily rates
const DAILY_RATES = {
    basic: 1000, // ₦7,000 / 7 days
    premium: 1428.57, // ₦10,000 / 7 days
};
// Initialize payment for campaign
exports.initializePayment = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaignId, packageType, email } = req.body;
        const user = req.user;
        if (!campaignId || !packageType || !email) {
            return next(new ErrorHandler_1.default("Missing required fields: campaignId, packageType, email", 400));
        }
        if (packageType !== "basic" && packageType !== "premium") {
            return next(new ErrorHandler_1.default("Package type must be either 'basic' or 'premium'", 400));
        }
        // Check if campaign exists
        const campaign = yield puzzleCampaign_model_1.default.findById(campaignId);
        if (!campaign) {
            return next(new ErrorHandler_1.default("Campaign not found", 404));
        }
        // Verify brand owns this campaign
        if (campaign.brandId !== String(user._id)) {
            return next(new ErrorHandler_1.default("You are not authorized to pay for this campaign", 403));
        }
        const amount = PACKAGE_PRICES[packageType];
        const reference = `campaign_${campaignId}_${Date.now()}_${Math.random()
            .toString(36)
            .substring(7)}`;
        // Create transaction record
        const transaction = yield transaction_model_1.default.create({
            campaignId,
            brandId: user._id,
            packageType,
            amount,
            currency: "NGN",
            reference,
            status: "pending",
        });
        // Initialize Paystack payment
        const paystackResponse = yield axios_1.default.post(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
            email,
            amount: amount * 100, // Convert to kobo
            reference,
            currency: "NGN",
            metadata: {
                campaignId,
                brandId: user._id,
                packageType,
                transactionId: transaction._id,
            },
        }, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                "Content-Type": "application/json",
            },
        });
        const responseData = paystackResponse.data;
        res.status(200).json({
            success: true,
            data: {
                authorization_url: responseData.data.authorization_url,
                access_code: responseData.data.access_code,
                reference,
            },
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(`Failed to initialize payment: ${error.message}`, 500));
    }
}));
// Verify payment
exports.verifyPayment = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { reference } = req.params;
        if (!reference) {
            return next(new ErrorHandler_1.default("Payment reference is required", 400));
        }
        // Find transaction
        const transaction = yield transaction_model_1.default.findOne({ reference });
        if (!transaction) {
            return next(new ErrorHandler_1.default("Transaction not found", 404));
        }
        // Verify with Paystack
        const paystackResponse = yield axios_1.default.get(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
        });
        const responseData = paystackResponse.data;
        const paymentData = responseData.data;
        if (paymentData.status === "success") {
            // Update transaction
            transaction.status = "success";
            transaction.paystackResponse = paymentData;
            yield transaction.save();
            // Update campaign with payment details
            const campaign = yield puzzleCampaign_model_1.default.findById(transaction.campaignId);
            if (campaign) {
                const packageType = transaction.packageType;
                campaign.packageType = packageType;
                campaign.totalBudget = transaction.amount;
                campaign.dailyAllocation = DAILY_RATES[packageType];
                campaign.budgetRemaining = transaction.amount;
                campaign.budgetUsed = 0;
                campaign.paymentStatus = "paid";
                campaign.transactionId = String(transaction._id);
                yield campaign.save();
            }
            res.status(200).json({
                success: true,
                message: "Payment verified successfully",
                transaction: {
                    reference: transaction.reference,
                    amount: transaction.amount,
                    status: transaction.status,
                    packageType: transaction.packageType,
                },
            });
        }
        else {
            transaction.status = "failed";
            transaction.paystackResponse = paymentData;
            yield transaction.save();
            res.status(400).json({
                success: false,
                message: "Payment verification failed",
                status: paymentData.status,
            });
        }
    }
    catch (error) {
        return next(new ErrorHandler_1.default(`Failed to verify payment: ${error.message}`, 500));
    }
}));
// Paystack webhook for payment notifications
exports.paystackWebhook = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const hash = crypto_1.default
            .createHmac("sha512", PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest("hex");
        if (hash !== req.headers["x-paystack-signature"]) {
            return res.status(400).send("Invalid signature");
        }
        const event = req.body;
        if (event.event === "charge.success") {
            const { reference, metadata } = event.data;
            // Find and update transaction
            const transaction = yield transaction_model_1.default.findOne({ reference });
            if (transaction && transaction.status === "pending") {
                transaction.status = "success";
                transaction.paystackResponse = event.data;
                yield transaction.save();
                // Update campaign
                const campaign = yield puzzleCampaign_model_1.default.findById(metadata.campaignId);
                if (campaign) {
                    const packageType = transaction.packageType;
                    campaign.packageType = packageType;
                    campaign.totalBudget = transaction.amount;
                    campaign.dailyAllocation = DAILY_RATES[packageType];
                    campaign.budgetRemaining = transaction.amount;
                    campaign.budgetUsed = 0;
                    campaign.paymentStatus = "paid";
                    campaign.transactionId = String(transaction._id);
                    yield campaign.save();
                }
            }
        }
        res.status(200).send("Webhook received");
    }
    catch (error) {
        return next(new ErrorHandler_1.default(`Webhook processing failed: ${error.message}`, 500));
    }
}));
// Get campaign budget status
exports.getCampaignBudget = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaignId } = req.params;
        const campaign = yield puzzleCampaign_model_1.default.findById(campaignId);
        if (!campaign) {
            return next(new ErrorHandler_1.default("Campaign not found", 404));
        }
        const daysRemaining = Math.ceil((new Date(campaign.endDate).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24));
        res.status(200).json({
            success: true,
            budget: {
                packageType: campaign.packageType,
                totalBudget: campaign.totalBudget,
                dailyAllocation: campaign.dailyAllocation,
                budgetUsed: campaign.budgetUsed,
                budgetRemaining: campaign.budgetRemaining,
                paymentStatus: campaign.paymentStatus,
                daysRemaining,
                startDate: campaign.startDate,
                endDate: campaign.endDate,
            },
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(`Failed to fetch campaign budget: ${error.message}`, 500));
    }
}));
// Get transaction history for a brand
exports.getTransactionHistory = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const transactions = yield transaction_model_1.default.find({ brandId: user._id })
            .sort({ createdAt: -1 })
            .lean();
        res.status(200).json({
            success: true,
            transactions,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(`Failed to fetch transaction history: ${error.message}`, 500));
    }
}));
