import { Router } from "express";
import ApiResponse from "../utils/ApiResponse.js";

const router = Router();

router.get("/health", (req, res) => {
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        service: "AutoBazaar API",
      },
      "Server is healthy"
    )
  );
});

export default router;
