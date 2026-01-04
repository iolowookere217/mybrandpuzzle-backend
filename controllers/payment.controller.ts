import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middlewares/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import TransactionModel from "../models/transaction.model";
import PuzzleCampaignModel from "../models/puzzleCampaign.model";
import PackageModel from "../models/package.model";
import crypto from "crypto";
import axios from "axios";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
const PAYSTACK_BASE_URL = "https://api.paystack.co";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Log Paystack configuration on startup (only show first 8 characters for security)
if (!PAYSTACK_SECRET_KEY) {
  console.error("⚠️  PAYSTACK_SECRET_KEY is not configured in .env file!");
} else {
  console.log("✅ Paystack configured:", PAYSTACK_SECRET_KEY.substring(0, 8) + "...");
}

// Log Frontend URL configuration
console.log("✅ Frontend URL configured:", FRONTEND_URL);

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
export const initializePayment = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId, packageType, email } = req.body;
      const user = req.user as any;

      if (!campaignId || !packageType || !email) {
        return next(
          new ErrorHandler(
            "Missing required fields: campaignId, packageType, email",
            400
          )
        );
      }

      if (packageType !== "basic" && packageType !== "premium") {
        return next(
          new ErrorHandler("Package type must be either 'basic' or 'premium'", 400)
        );
      }

      // Check if campaign exists
      const campaign = await PuzzleCampaignModel.findById(campaignId);
      if (!campaign) {
        return next(new ErrorHandler("Campaign not found", 404));
      }

      // Verify brand owns this campaign
      if (campaign.brandId !== String(user._id)) {
        return next(
          new ErrorHandler("You are not authorized to pay for this campaign", 403)
        );
      }

      const amount = PACKAGE_PRICES[packageType as "basic" | "premium"];
      const reference = `campaign_${campaignId}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}`;

      // Create transaction record
      const transaction = await TransactionModel.create({
        campaignId,
        brandId: user._id,
        packageType,
        amount,
        currency: "NGN",
        reference,
        status: "pending",
      });

      // Initialize Paystack payment
      const paystackResponse = await axios.post(
        `${PAYSTACK_BASE_URL}/transaction/initialize`,
        {
          email,
          amount: amount * 100, // Convert to kobo
          reference,
          currency: "NGN",
          callback_url: `${FRONTEND_URL}/payment/verify?reference=${reference}`,
          metadata: {
            campaignId,
            brandId: user._id,
            packageType,
            transactionId: transaction._id,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const responseData = paystackResponse.data as any;

      res.status(200).json({
        success: true,
        data: {
          authorization_url: responseData.data.authorization_url,
          access_code: responseData.data.access_code,
          reference,
        },
      });
    } catch (error: any) {
      return next(
        new ErrorHandler(`Failed to initialize payment: ${error.message}`, 500)
      );
    }
  }
);

// Verify payment
export const verifyPayment = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reference } = req.params;
      const user = req.user as any;

      if (!reference) {
        return next(new ErrorHandler("Payment reference is required", 400));
      }

      // Find transaction
      const transaction = await TransactionModel.findOne({ reference });
      if (!transaction) {
        return next(new ErrorHandler("Transaction not found", 404));
      }

      // Validate that the transaction belongs to the requesting brand
      if (String(transaction.brandId) !== String(user._id)) {
        return next(
          new ErrorHandler(
            "You are not authorized to verify this payment reference",
            403
          )
        );
      }

      // Validate that the transaction belongs to the campaign
      const campaign = await PuzzleCampaignModel.findById(transaction.campaignId);
      if (!campaign) {
        return next(new ErrorHandler("Campaign not found", 404));
      }

      if (String(campaign.brandId) !== String(user._id)) {
        return next(
          new ErrorHandler(
            "This payment reference does not belong to your campaign",
            403
          )
        );
      }

      // Verify with Paystack
      const paystackResponse = await axios.get(
        `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      const responseData = paystackResponse.data as any;
      const paymentData = responseData.data;

      if (paymentData.status === "success") {
        // Update transaction
        transaction.status = "success";
        transaction.paystackResponse = paymentData;
        await transaction.save();

        // Update campaign with payment details and activate it
        if (campaign) {
          const packageType = transaction.packageType as "basic" | "premium";
          const now = new Date();
          const timeLimitInHours = campaign.timeLimit;
          const endDate = new Date(now.getTime() + timeLimitInHours * 60 * 60 * 1000);

          campaign.packageType = packageType;
          campaign.totalBudget = transaction.amount;
          campaign.dailyAllocation = DAILY_RATES[packageType];
          campaign.budgetRemaining = transaction.amount;
          campaign.budgetUsed = 0;
          campaign.paymentStatus = "paid";
          campaign.transactionId = String(transaction._id);
          campaign.status = "active";
          campaign.startDate = now;
          campaign.endDate = endDate;
          await campaign.save();
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
      } else {
        transaction.status = "failed";
        transaction.paystackResponse = paymentData;
        await transaction.save();

        res.status(400).json({
          success: false,
          message: "Payment verification failed",
          status: paymentData.status,
        });
      }
    } catch (error: any) {
      return next(
        new ErrorHandler(`Failed to verify payment: ${error.message}`, 500)
      );
    }
  }
);

// Paystack webhook for payment notifications
export const paystackWebhook = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hash = crypto
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
        const transaction = await TransactionModel.findOne({ reference });
        if (transaction && transaction.status === "pending") {
          transaction.status = "success";
          transaction.paystackResponse = event.data;
          await transaction.save();

          // Update campaign and activate it
          const campaign = await PuzzleCampaignModel.findById(metadata.campaignId);
          if (campaign) {
            const packageType = transaction.packageType as "basic" | "premium";
            const now = new Date();
            const timeLimitInHours = campaign.timeLimit;
            const endDate = new Date(now.getTime() + timeLimitInHours * 60 * 60 * 1000);

            campaign.packageType = packageType;
            campaign.totalBudget = transaction.amount;
            campaign.dailyAllocation = DAILY_RATES[packageType];
            campaign.budgetRemaining = transaction.amount;
            campaign.budgetUsed = 0;
            campaign.paymentStatus = "paid";
            campaign.transactionId = String(transaction._id);
            campaign.status = "active";
            campaign.startDate = now;
            campaign.endDate = endDate;
            await campaign.save();
          }
        }
      }

      res.status(200).send("Webhook received");
    } catch (error: any) {
      return next(
        new ErrorHandler(`Webhook processing failed: ${error.message}`, 500)
      );
    }
  }
);

// Get campaign budget status
export const getCampaignBudget = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;

      const campaign = await PuzzleCampaignModel.findById(campaignId);
      if (!campaign) {
        return next(new ErrorHandler("Campaign not found", 404));
      }

      const daysRemaining = Math.ceil(
        (new Date(campaign.endDate).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );

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
    } catch (error: any) {
      return next(
        new ErrorHandler(`Failed to fetch campaign budget: ${error.message}`, 500)
      );
    }
  }
);

// Get transaction history for a brand
export const getTransactionHistory = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;

      const transactions = await TransactionModel.find({ brandId: user._id })
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({
        success: true,
        transactions,
      });
    } catch (error: any) {
      return next(
        new ErrorHandler(`Failed to fetch transaction history: ${error.message}`, 500)
      );
    }
  }
);
