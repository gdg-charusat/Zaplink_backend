import express from "express";
//import individual routes here ---
import zapRoute from "./zap.routes";
import analyticsRoute from "./analytics.routes";

const router = express.Router();

router.use("/zaps", zapRoute);
router.use("/analytics", analyticsRoute);
export default router;
