"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const instant_controller_1 = require("../controllers/instant.controller");
const auth_1 = require("../utils/auth");
const router = express_1.default.Router();
router.post("/instant", auth_1.isAuthenticated, instant_controller_1.createInstantEvent);
router.post("/instant/:eventId/join", auth_1.isAuthenticated, instant_controller_1.joinInstantEvent);
router.post("/instant/:eventId/submit", auth_1.isAuthenticated, instant_controller_1.submitInstantResult);
exports.default = router;
