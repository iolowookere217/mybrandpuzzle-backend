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
exports.createPackage = exports.getPackageById = exports.getAllPackages = exports.initializePackages = void 0;
const catchAsyncError_1 = require("../middlewares/catchAsyncError");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const package_model_1 = __importDefault(require("../models/package.model"));
// Initialize default packages (run once on server startup)
const initializePackages = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const count = yield package_model_1.default.countDocuments();
        if (count === 0) {
            yield package_model_1.default.insertMany([
                {
                    name: "platinum",
                    amount: 100000,
                    duration: 1,
                    description: "1 week campaign package",
                    isActive: true,
                },
                {
                    name: "bronze",
                    amount: 150000,
                    duration: 2,
                    description: "2 weeks campaign package",
                    isActive: true,
                },
                {
                    name: "silver",
                    amount: 300000,
                    duration: 3,
                    description: "3 weeks campaign package",
                    isActive: true,
                },
                {
                    name: "gold",
                    amount: 500000,
                    duration: 4,
                    description: "4 weeks campaign package",
                    isActive: true,
                },
            ]);
            console.log("✅ Default packages initialized successfully");
        }
    }
    catch (error) {
        console.error("Error initializing packages:", error);
    }
});
exports.initializePackages = initializePackages;
// Get all active packages
exports.getAllPackages = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const packages = yield package_model_1.default.find({ isActive: true })
            .select("_id name amount duration description")
            .sort({ duration: 1 })
            .lean();
        res.status(200).json({
            success: true,
            packages,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Get package by ID
exports.getPackageById = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { packageId } = req.params;
        const packageData = yield package_model_1.default.findById(packageId).lean();
        if (!packageData) {
            return next(new ErrorHandler_1.default("Package not found", 404));
        }
        res.status(200).json({
            success: true,
            package: packageData,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
// Create a new package (Admin only)
exports.createPackage = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, amount, duration, description } = req.body;
        // Validate required fields
        if (!name || typeof name !== "string" || name.trim() === "") {
            return next(new ErrorHandler_1.default("name is required and must be a non-empty string", 400));
        }
        if (!amount || typeof amount !== "number" || amount <= 0) {
            return next(new ErrorHandler_1.default("amount is required and must be a positive number", 400));
        }
        if (!duration || typeof duration !== "number" || duration <= 0) {
            return next(new ErrorHandler_1.default("duration is required and must be a positive number (in weeks)", 400));
        }
        // Check if package with same name already exists
        const existingPackage = yield package_model_1.default.findOne({
            name: name.trim().toLowerCase(),
        });
        if (existingPackage) {
            return next(new ErrorHandler_1.default(`Package with name "${name}" already exists`, 400));
        }
        // Create new package
        const newPackage = yield package_model_1.default.create({
            name: name.trim().toLowerCase(),
            amount,
            duration,
            description: description || `${duration} week${duration > 1 ? "s" : ""} campaign package`,
            isActive: true,
        });
        res.status(201).json({
            success: true,
            message: "Package created successfully",
            package: newPackage,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
