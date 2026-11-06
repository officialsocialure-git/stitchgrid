import { Router } from "express";
const router = Router();
router.get("/", (_req, res) => res.json({ success: true, service: "STITCHGRID API", status: "healthy" }));
export default router;