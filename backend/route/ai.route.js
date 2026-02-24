import express from "express";
import { getAIMetrics, recommendBooks, trackRecommendationClick } from "../controller/ai.controller.js";

const router = express.Router();

router.post("/recommend", recommendBooks);
router.post("/select", trackRecommendationClick);
router.get("/metrics", getAIMetrics);

export default router;
