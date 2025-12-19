import express from "express";
import {
  getActiveCampaigns,
  getAllCampaigns,
  getCampaignsByBrand,
  getCampaignById,
  submitCampaign,
} from "../controllers/campaign.controller";
import { isAuthenticated } from "../utils/auth";

const router = express.Router();

// Get all campaigns
router.get("/campaigns", isAuthenticated, getAllCampaigns);

// Get active campaigns only
router.get("/campaigns/active", isAuthenticated, getActiveCampaigns);

// Get campaigns by brand ID
router.get("/campaigns/brand/:brandId", isAuthenticated, getCampaignsByBrand);

// Get single campaign by campaign ID
router.get("/campaigns/:campaignId", isAuthenticated, getCampaignById);

// Submit campaign result
router.post("/campaigns/:campaignId/submit", isAuthenticated, submitCampaign);

export default router;
