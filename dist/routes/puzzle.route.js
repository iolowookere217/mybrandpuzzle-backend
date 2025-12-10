"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const puzzle_controller_1 = require("../controllers/puzzle.controller");
const auth_1 = require("../utils/auth");
const router = express_1.default.Router();
router.get("/puzzles", auth_1.isAuthenticated, puzzle_controller_1.listPuzzles);
router.get("/puzzles/:id", auth_1.isAuthenticated, puzzle_controller_1.getPuzzle);
router.post("/puzzles/:id/submit", auth_1.isAuthenticated, puzzle_controller_1.submitPuzzle);
exports.default = router;
