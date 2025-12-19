import express from "express";
import { getAllPackages, getPackageById } from "../controllers/package.controller";
import { isAuthenticated } from "../utils/auth";

const router = express.Router();

// Get all active packages
router.get("/packages", isAuthenticated, getAllPackages);

// Get package by ID
router.get("/packages/:packageId", isAuthenticated, getPackageById);

export default router;
