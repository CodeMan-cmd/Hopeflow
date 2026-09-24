import express from "express";
import { success } from "@/lib/responseFormat";
import { collectStats } from "@/utils/statsCore";
const router = express.Router();

export default router.get("/", async (req, res) => {
  const stats = await collectStats();
  res.status(200).send(success(stats));
});
