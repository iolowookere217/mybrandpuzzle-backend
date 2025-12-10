import express from "express";
import {
  createInstantEvent,
  joinInstantEvent,
  submitInstantResult,
} from "../controllers/instant.controller";
import { isAuthenticated } from "../utils/auth";

const router = express.Router();

router.post("/instant", isAuthenticated, createInstantEvent);
router.post("/instant/:eventId/join", isAuthenticated, joinInstantEvent);
router.post("/instant/:eventId/submit", isAuthenticated, submitInstantResult);

export default router;
