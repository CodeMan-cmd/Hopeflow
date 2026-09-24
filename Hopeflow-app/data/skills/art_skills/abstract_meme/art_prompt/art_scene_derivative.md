---
name: art_scene_derivative
description: 场景衍生资产生成 · 约束手册
metaData: art_skills
---

# 场景衍生资产生成 · 约束手册

---

## 一、叠加原则

1. **本体不变** — 叠加后场景主体结构/布局/材质必须与底模一致
2. **逐层可控** — 每层独立描述，便于按层替换
3. **风格统一** — 所有衍生元素服从抽象视频画风
4. **质感不降** — 写实质感标准不低于底模

---

## 二、叠加层级

| 层级 | 内容 | 说明 |
|---|---|---|
| L0 | 底模 | 场景基础形象，不修改 |
| L1 | 时段/天气变化 | 晨/昏/夜/雨/雾/光色变化 |
| L2 | 状态变化 | 日常→噩梦转场/破坏/异变 |
| L3 | 氛围元素 | 光晕/阴影/粒子/超现实元素 |

> **范畴边界**：场景衍生仅包含时段/状态/氛围叠加，不包含人物、拟人物品、剧情主体。

---

## 三、时段与天气变化约束（L1）

| 变化 | 描写 | 提示词 |
|---|---|---|
| 夜间 | 暗光、冷色、阴影加深 | night, dim light, deep shadows |
| 黄昏 | 暖橙余晖、金边 | golden hour, warm orange glow |
| 雨雾 | 湿润反光、雾气弥漫 | rain, wet reflections, fog |
| 阴天 | 灰白漫射光、低对比 | overcast, diffuse gray light |

---

## 四、状态变化约束（L2）

| 变化 | 描写 | 提示词 |
|---|---|---|
| 噩梦化 | 空间扭曲/色彩偏移/暗化 | distorted space, color shift, darkening |
| 惊醒化 | 白光过曝/色彩恢复 | white flash, color restoration |
| 破坏 | 家具翻倒/碎片/裂缝 | overturned furniture, debris, cracks |
| 异变 | 环境元素生长/变形 | mutated environment, warping elements |

---

## 五、氛围元素约束（L3）

| 元素 | 描写 | 提示词 |
|---|---|---|
| 光晕 | 梦境光晕/冷色氛围光 | surreal glow, cold ambient light |
| 阴影扭曲 | 影子异变/深渊渐变 | distorted shadows, abyss gradient |
| 粒子 | 漂浮尘埃/光点/雪花 | floating dust, light particles |
| 超现实点缀 | 悬浮眼睛/几何碎片 | floating eyes, geometric shards |

---

## 六、提示词模板

以场景图为底图，img2img叠加时段/状态与氛围，
photorealistic scene, surreal narrative, dark humor, nightmare aesthetic,
保持场景主体与底模一致：{场景类型}，{结构/布局描述}，
【L1·时段/天气】{变化描写}（无则保持），
【L2·状态】{状态变化描写}（无则保持），
【L3·氛围】{氛围元素描写}（无则不写），
hyperreal texture, cinematic lighting, strong color contrast,
画面中无任何人物和拟人物品，
no cartoon, no anime, no 2D illustration,
图中不要有任何文字

---

## 七、约束规则

### 必守

| 编号 | 规则 |
|---|---|
| R1 | 叠加后场景主体必须与底模一致 |
| R2 | 必须指定「日常/噩梦」状态语义 |
| R3 | 必须包含摄影写实 + 风格锚定词 |
| R4 | 状态/氛围变化必须与用户线索匹配 |

### 严禁

| 编号 | 严禁 |
|---|---|
| X1 | 场景主体结构/布局/材质改变 |
| X2 | 出现人物/拟人物品 |
| X3 | 卡通/动漫/2D/扁平插画风格 |
| X4 | 多视图/网格/分屏布局 |
