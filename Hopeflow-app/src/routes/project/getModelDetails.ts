import express from "express";
import { success } from "@/lib/responseFormat";
import u from "@/utils";
import { z } from "zod";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    key: z.enum(["scriptAgent", "productionAgent", "projectAgent"]),
  }),
  async (req, res) => {
    const { key } = req.body;
    const data = await u.db("o_agentDeploy").select("o_agentDeploy.*").where("o_agentDeploy.key", key).first();
    // 未配置 Agent 模型时不报错，返回空由前端静默处理（该接口仅用于判断模型是否支持思考）
    if (!data?.modelName) return res.status(200).send(success(null));
    const [id, modelName] = data.modelName.split(/:(.+)/);
    const models = await u.vendor.getModelList(id);
    const model = models.find((m) => m.modelName === modelName);
    if (!model) return res.status(200).send(success(null));
    res.status(200).send(success(model));
  },
);
