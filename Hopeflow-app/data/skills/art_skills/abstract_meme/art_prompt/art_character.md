---
name: art_character
description: 拟人物品角色生成 · 约束手册
metaData: art_skills
---

# 拟人物品角色生成 · 约束手册

---

## 一、基础形象原则

1. **物品本体** — 角色本质是真实物品（数据线/咖啡杯/香蕉/手机等），保留物品可识别本体，禁止变形成完整人形
2. **拟人融合** — 物品表面融合拟人面部（眼/嘴/眉），面部与物品材质自然过渡，非硬贴图
3. **真实材质** — 物品本体使用 photorealistic 真实材质，塑料/陶瓷/金属/织物纹理清晰可辨
4. **四视图一致** — 物品本体/拟人面部/颜色/标识跨视图高度统一
5. **黑色幽默基调** — 面部表情具有叙事张力（惊恐/愤怒/委屈/戏谑），服务于抽象视频的荒诞反差

---

## 二、面部融合约束

| 项目 | 约束 | 提示词 |
|---|---|---|
| 面部位置 | 位于物品最自然的"面部区域"（正面中央偏上） | anthropomorphic face on the front surface |
| 面部比例 | 占物品正面 15-25%，不遮挡物品核心特征 | face occupying 15-25% of the object surface |
| 材质融合 | 肤色与物品材质自然过渡，边缘有材质渐变 | natural skin-to-material transition, seamless blend |
| 表情体系 | 支持完整表情（惊恐/愤怒/委屈/戏谑/流泪/傻笑） | expressive eyes, moving mouth, animated eyebrows |
| 微动效 | 物品本体呼吸/颤抖，模拟"活着" | subtle breathing motion, micro trembling |

---

## 三、摄影写实质感约束

| 项目 | 约束 | 提示词 |
|---|---|---|
| 渲染 | 摄影写实（非卡通/非2D） | photorealistic render, realistic lighting |
| 光影 | 电影级布光，强对比 | cinematic lighting, strong contrast |
| 细节 | 材质纹理超清晰 | hyperreal object material, fine texture detail |
| 色彩 | 物品原色为主，符合梦境氛围 | keep object natural color, surreal accent tones |
| 一致性 | 四视图光照方向一致 | consistent lighting across views |

---

## 四、多视图设定图规范

### 视图定义

| 位置 | 视图 | 角度 | 要求 | 提示词 |
|---|---|---|---|---|
| 左一 | 面部特写 | 正面平视 | 拟人面部完整展示，表情清晰 | face closeup, front view |
| 左二 | 正视图 | 正面 0° | 物品完整正面形态，面部居中 | front view, full object |
| 右二 | 侧视图 | 右侧 90° | 物品侧面轮廓清晰 | side view, profile |
| 右一 | 背面图 | 后方 180° | 物品背部结构清晰 | back view, rear view |

### 画面规范

| 项目 | 约束 |
|---|---|
| 布局 | 同一画面从左至右并排四视图 |
| 背景 | 浅灰纯色 #EAEAEA（中性底） |
| 站姿 | 物品自然静置，无需支撑物 |
| 表情 | 中性微表情，符合角色叙事定位 |
| 光线 | 均匀柔光 + 侧前方主光，无硬阴影 |
| 一致性 | 四视图物品本体/面部/颜色完全一致 |
| 画面比例 | 建议 4:1 或 3:1 |

---

## 五、提示词模板

拟人物品四视图设定图，摄影写实，
photorealistic object with anthropomorphic face, surreal narrative, dark humor, nightmare aesthetic,
{物品类型（如：white charging cable / coffee mug / banana）}，{物品真实材质描述}，{物品颜色}，
拟人面部融合于物品正面，natural face fusion, skin-to-material seamless transition,
面部比例占物品正面 15-25%，face occupying 15-25% of the object surface,
{表情状态描述}，{情绪基调}，
hyperreal object material, cinematic lighting, strong color contrast, realistic texture detail,
同一画面左至右并排：面部特写+正视图+侧视图+背面图，
浅灰纯色背景，均匀柔光，无硬阴影，
四视图一致性，物品本体与面部完全一致，
photorealistic, no cartoon, no anime, no 2D illustration, no full humanoid, no realistic human face,
图中不要有任何文字

---

## 六、约束规则

### 必守

| 编号 | 规则 |
|---|---|
| R1 | 必须为「摄影写实」风格（photorealistic），禁卡通/2D/动漫渲染 |
| R2 | 必须保留物品本体可识别特征，禁止完整人形 |
| R3 | 必须描述「拟人面部融合」且指定融合过渡 |
| R4 | 必须指定「浅灰纯色背景」 |
| R5 | 必须指定「四视图一致性」 |
| R6 | 必须包含风格锚定词（photorealistic object, anthropomorphic face, dark humor, nightmare aesthetic） |

### 严禁

| 编号 | 严禁 |
|---|---|
| X1 | 完整人形/人形身体/真实人脸/人类肢体 |
| X2 | 卡通/动漫/2D/扁平插画风格 |
| X3 | 面部与物品生硬拼接、无材质过渡 |
| X4 | 复杂场景背景（必须纯色） |
| X5 | 物品失去本体特征（不可辨识） |
| X6 | 面部遮挡物品核心特征（接口/按钮/商标） |
