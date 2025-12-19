"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const package_controller_1 = require("../controllers/package.controller");
const auth_1 = require("../utils/auth");
const router = express_1.default.Router();
// Get all active packages
router.get("/packages", auth_1.isAuthenticated, package_controller_1.getAllPackages);
// Get package by ID
router.get("/packages/:packageId", auth_1.isAuthenticated, package_controller_1.getPackageById);
exports.default = router;
