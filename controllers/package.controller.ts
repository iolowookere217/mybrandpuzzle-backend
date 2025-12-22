import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middlewares/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import PackageModel from "../models/package.model";

// Initialize default packages (run once on server startup)
export const initializePackages = async () => {
  try {
    const count = await PackageModel.countDocuments();
    if (count === 0) {
      await PackageModel.insertMany([
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
  } catch (error) {
    console.error("Error initializing packages:", error);
  }
};

// Get all active packages
export const getAllPackages = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const packages = await PackageModel.find({ isActive: true })
        .select("_id name amount duration description")
        .sort({ duration: 1 })
        .lean();

      res.status(200).json({
        success: true,
        packages,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Get package by ID
export const getPackageById = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { packageId } = req.params;

      const packageData = await PackageModel.findById(packageId).lean();

      if (!packageData) {
        return next(new ErrorHandler("Package not found", 404));
      }

      res.status(200).json({
        success: true,
        package: packageData,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Create a new package (Admin only)
export const createPackage = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, amount, duration, description } = req.body;

      // Validate required fields
      if (!name || typeof name !== "string" || name.trim() === "") {
        return next(
          new ErrorHandler("name is required and must be a non-empty string", 400)
        );
      }

      if (!amount || typeof amount !== "number" || amount <= 0) {
        return next(
          new ErrorHandler("amount is required and must be a positive number", 400)
        );
      }

      if (!duration || typeof duration !== "number" || duration <= 0) {
        return next(
          new ErrorHandler(
            "duration is required and must be a positive number (in weeks)",
            400
          )
        );
      }

      // Check if package with same name already exists
      const existingPackage = await PackageModel.findOne({
        name: name.trim().toLowerCase(),
      });

      if (existingPackage) {
        return next(
          new ErrorHandler(
            `Package with name "${name}" already exists`,
            400
          )
        );
      }

      // Create new package
      const newPackage = await PackageModel.create({
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
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
