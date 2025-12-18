"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const campaign_controller_1 = require("../controllers/campaign.controller");
const auth_1 = require("../utils/auth");
const router = express_1.default.Router();
// Get all campaigns
router.get("/campaigns", auth_1.isAuthenticated, campaign_controller_1.getAllCampaigns);
// Get campaigns by brand ID
router.get("/campaigns/brand/:brandId", auth_1.isAuthenticated, campaign_controller_1.getCampaignsByBrand);
// Get single campaign by campaign ID
router.get("/campaigns/:campaignId", auth_1.isAuthenticated, campaign_controller_1.getCampaignById);
// Submit campaign result
router.post("/campaigns/:campaignId/submit", auth_1.isAuthenticated, campaign_controller_1.submitCampaign);
exports.default = router;
