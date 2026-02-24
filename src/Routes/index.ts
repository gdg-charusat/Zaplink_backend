import { Router } from "express";
import zapRoute from "./zap.routes";

/**
 * Central Route Registry
 * All feature routes should be mounted here.
 */

const router = Router();

// Zap routes
router.use("/zaps", zapRoute);

export default router;