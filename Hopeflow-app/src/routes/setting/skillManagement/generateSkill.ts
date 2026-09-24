import express from "express";
import u from "@/utils";
import pLimit from "p-limit";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import * as fs from "fs";
import path from "path";
const router = express.Router();

// 画风包文件清单（与 getVisualManual.ts 的 DATA_MAP 保持一致）
const ART_FILES: { path: string; name: string; desc: string }[] = [
  { path: "README.md", name: "README", desc: "技能包说明（首行必须是 # 标题）" },
  { path: "prefix.md", name: "prefix", desc: "全局美学基础（风格基因/色彩盘/核心视觉规则）" },
  { path: "art_prompt/art_character.md", name: "art_character", desc: "角色（拟人/写实角色）基础设定图生成约束" },
  { path: "art_prompt/art_character_derivative.md", name: "art_character_derivative", desc: "角色衍生（表情/微动效/状态）叠加约束" },
  { path: "art_prompt/art_prop.md", name: "art_prop", desc: "道具设定图生成约束" },
  { path: "art_prompt/art_prop_derivative.md", name: "art_prop_derivative", desc: "道具衍生（状态/氛围）叠加约束" },
  { path: "art_prompt/art_scene.md", name: "art_scene", desc: "场景设定图生成约束" },
  { path: "art_prompt/art_scene_derivative.md", name: "art_scene_derivative", desc: "场景衍生（时段/状态/氛围）叠加约束" },
  { path: "art_prompt/art_storyboard_video.md", name: "art_storyboard_video", desc: "分镜视频提示词生成技法" },
  { path: "art_prompt/art_lighting_atmosphere.md", name: "art_lighting_atmosphere", desc: "光影与氛围约束" },
  { path: "art_prompt/art_composition_camera.md", name: "art_composition_camera", desc: "构图与镜头约束" },
  { path: "art_prompt/art_texture_material.md", name: "art_texture_material", desc: "材质与质感约束" },
  { path: "driector_skills/director_planning_style.md", name: "director_planning_style", desc: "导演规划技法" },
  { path: "driector_skills/director_storyboard.md", name: "director_storyboard", desc: "分镜生成技法" },
  { path: "driector_skills/director_storyboard_table_style.md", name: "director_storyboard_table_style", desc: "分镜表设计技法" },
];

// 题材包文件清单
const STORY_FILES: { path: string; name: string; desc: string }[] = [
  { path: "README.md", name: "README", desc: "技能包说明（首行必须是 # 标题）" },
  { path: "driector_skills/director_planning_narrative.md", name: "director_planning_narrative", desc: "叙事规划手法（题材的叙事结构/节奏/情绪/声音/构图/运镜）" },
  { path: "driector_skills/director_storyboard_table_narrative.md", name: "director_storyboard_table_narrative", desc: "分镜表叙事手法（景别/运镜/时长/张力/转场）" },
];

// 读取参考样例文件内容（供 AI 模仿结构）
function readSample(relPath: string): string {
  try {
    return fs.readFileSync(path.join(u.getPath(["skills"]), relPath), "utf-8");
  } catch {
    return "";
  }
}

const ART_REF = "art_skills/abstract_meme";
const STORY_REF = "story_skills/Horror_supernatural";

// 解析 AI 输出的 JSON（容忍 ```json 代码块包裹）
function parseJsonOutput(text: string): Record<string, any> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) throw new Error("AI 输出未包含有效的 JSON 对象");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// 生成安全的英文目录名
function toStylePath(title: string): string {
  const cleaned = title
    .replace(/[#*`~]/g, "")
    .replace(/[（）()【】\[\]：:、,，。.、""''\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || `skill_${Date.now()}`;
}

export default router.post(
  "/",
  validateFields({
    description: z.string().min(1),
    type: z.enum(["auto", "art", "story"]),
    textModel: z.string().min(1),
    imageModel: z.string().optional(),
  }),
  async (req, res) => {
    const { description, type, textModel, imageModel = "" } = req.body as { description: string; type: "auto" | "art" | "story"; textModel: string; imageModel?: string };
    try {
      // ---------- 第一步：AI 规划（生成风格定义卡） ----------
      const planSystem = `你是 Hopeflow 短剧工厂的资深技能设计师。用户会描述一个新的画风或题材，你需要输出一份风格定义卡 JSON。

# 参考：画风技能包结构
${ART_FILES.map((f) => `- ${f.path}（${f.desc}）`).join("\n")}
参考画风包样例：
${readSample(`${ART_REF}/README.md`)}

# 参考：题材技能包结构
${STORY_FILES.map((f) => `- ${f.path}（${f.desc}）`).join("\n")}
参考题材包样例：
${readSample(`${STORY_REF}/README.md`)}

# 输出要求
只输出一个 JSON 对象，格式如下：
{
  "type": "art" | "story",
  "title": "中文标题（README 首行 # 后面的内容，例如 猎奇画风（Quirky Grotesque））",
  "styleCore": "风格定位，一句话（中文+英文锚词）",
  "desc": "技能包简介，2-3 句",
  "applicableTypes": ["适用类型/模板，2-4 项，每项含名称和说明"],
  "forbids": ["严禁内容，3-5 项"],
  "keyAnchors": ["核心提示词锚词，5-8 个（中英对照）"]
}
不允许输出 JSON 以外的任何内容。`;

      const planRes = await u.Ai.Text(textModel as `${string}:${string}`).invoke({
        system: planSystem,
        messages: [{ role: "user", content: `请为「${description}」设计技能包。` }],
      });
      let plan = parseJsonOutput(planRes.text);
      if (!plan || !plan.title) throw new Error("AI 规划失败，未得到有效的风格定义卡");

      let resolvedType: "art" | "story" = plan.type === "story" ? "story" : "art";
      if (type === "art" || type === "story") resolvedType = type;

      const fileList = resolvedType === "art" ? ART_FILES : STORY_FILES;
      const refDir = resolvedType === "art" ? ART_REF : STORY_REF;
      const stylePath = toStylePath(plan.title);

      // ---------- 第二步：逐个生成技能文件 ----------
      const genSystem = (fileName: string, fileDesc: string, sample: string) => `你是 Hopeflow 短剧工厂的技能文件编写者。根据风格定义卡，编写一个技能文件的完整内容（Markdown）。

# 当前文件
- 文件路径：${fileName}
- 用途：${fileDesc}
- 所属技能包：${plan.title}（${plan.styleCore}）

# 风格定义卡
${JSON.stringify(plan, null, 2)}

# 参考样例（模仿其结构与质量，不要复制其内容）
${sample || "（无参考样例）"}

# 输出要求
1. 只输出 Markdown 文件正文，不允许输出任何解释、注释或额外文本。
2. ${fileName === "README.md" ? "首行必须是 # 标题，与风格定义卡 title 一致。" : ""}
3. ${
        resolvedType === "story"
          ? "文件必须以 --- 包裹的 frontmatter 开头，包含 name / description / metaData: director_skills 三个字段，description 需包含题材说明与适用范围。"
          : "参考样例的 frontmatter 格式（如有），否则以 --- 包裹 name / description 字段开头。"
      }
4. 内容必须严格贴合风格定义卡的核心特征、锚词、严禁项。
5. 使用与样例一致的章节结构与表格风格。`;

      const limit = pLimit(3);
      const fileResults = await Promise.all(
        fileList.map((file) =>
          limit(async () => {
            const sample = readSample(`${refDir}/${file.path}`);
            const res = await u.Ai.Text(textModel as `${string}:${string}`).invoke({
              system: genSystem(file.name, file.desc, sample),
              messages: [{ role: "user", content: `编写 ${file.path} 文件。` }],
            });
            const content = res.text?.trim();
            if (!content) throw new Error(`AI 生成 ${file.path} 失败：内容为空`);
            return { path: file.path, content };
          }),
        ),
      );

      // ---------- 第三步：生成封面图 ----------
      let imageBase64 = "";
      if (imageModel) {
        try {
          const imgCls = await u.Ai.Image(imageModel as `${string}:${string}`).run({
            prompt: `${plan.title}，${plan.styleCore}，${(plan.keyAnchors || []).join("，")}，技能包封面，海报质感，居中构图，无文字`,
            size: "2K",
            aspectRatio: "1:1",
          });
          // 结果写临时文件后回读为 base64（AiImage.result 为私有属性，只能通过 save 落盘）
          const tmpPath = `temp/skillCover_${Date.now()}.png`;
          await imgCls.save(tmpPath);
          imageBase64 = await u.oss.getImageBase64(tmpPath);
          await u.oss.deleteFile(tmpPath).catch(() => {});
        } catch (e) {
          console.error("[generateSkill] 封面图生成失败:", u.error(e).message);
        }
      }

      res.status(200).send(
        success({
          type: resolvedType,
          stylePath,
          title: plan.title,
          files: fileResults,
          imageBase64,
        }),
      );
    } catch (e) {
      res.status(500).send({ message: u.error(e).message });
    }
  },
);
