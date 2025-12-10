import express from "express";
import {
  listPuzzles,
  getPuzzle,
  submitPuzzle,
} from "../controllers/puzzle.controller";
import { isAuthenticated } from "../utils/auth";

const router = express.Router();

router.get("/puzzles", isAuthenticated, listPuzzles);
router.get("/puzzles/:id", isAuthenticated, getPuzzle);
router.post("/puzzles/:id/submit", isAuthenticated, submitPuzzle);

export default router;
