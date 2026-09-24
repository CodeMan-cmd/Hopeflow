---
name: art_scene_derivative
description: 场景衍生资产生成 · 约束手册（暗黑科幻画风）
metaData: dark_sci_fi_art_skills
---

# 场景衍生资产生成 · 约束手册（暗黑科幻画风）

---

## 一、叠加原则

1. **本体不变** — 叠加后场景主体结构/布局/材质必须与底模一致
2. **逐层可控** — 每层独立描述，便于按层替换
3. **风格统一** — 所有衍生元素服从暗黑科幻画风（冷峻工业质感与生物异化融合）
4. **质感不降** — 摄影写实质感标准不低于底模

---

## 二、叠加层级

| 层级 | 内容 | 说明 |
|---|---|---|
| L0 | 底模 | 场景基础形象，不修改 |
| L1 | 时段/天气变化 | 夜/暮/酸雨/雾霾/光色变化 |
| L2 | 状态变化 | 日常→异变转场/腐蚀/故障/崩坏 |
| L3 | 氛围元素 | 光晕/阴影/粒子/生物机械点缀 |

> **范畴边界**：场景衍生仅包含时段/状态/氛围叠加，不包含人物、拟人物品、剧情主体。

---

## 三、时段与天气变化约束（L1）

| 变化 | 描写 | 提示词 |
|---|---|---|
| 夜间 | 冷色霓虹阴霾、工业阴影加深、金属反光减弱 | night, cold neon haze, deep industrial shadows, dim metallic reflections |
| 工业暮色 | 雾霾过滤后的灰橙余晖、锈蚀建筑剪影 | dusk, smog-filtered gray-orange glow, corroded building silhouettes |
| 酸雨 | 潮湿焦油反光、霓虹倒影扭曲、锈迹斑驳 | acid rain, wet oily reflections, distorted neon reflections, rust stains |
| 废土阴霾 | 灰白漫射光、低对比、空气浑浊压抑 | overcast, diffuse gray light, hazy oppressive atmosphere, wasteland gloom |

---

## 四、状态变化约束（L2）

| 变化 | 描写 | 提示词 |
|---|---|---|
| 生化异变 | 钢筋组织化/管线蠕动/肉质增生与机械纠缠 | biomechanical mutation, organic steel growth, creeping conduits, flesh-mech entanglement |
| 腐蚀锈化 | 金属重度锈蚀/锈迹扩散/墙面剥落碎裂 | heavy corrosion, rust spread, flaking walls, crumbling surfaces |
| 数据故障 | 霓虹信号紊乱/画面色彩断层/机械错位 | neon glitch, signal distortion, color banding, mechanical misalignment |
| 噩梦化 | 空间扭曲/暗化加深/诡异冷光渗透 | distorted space, deep darkening, eerie cold light infiltration |

---

## 五、氛围元素约束（L3）

| 元素 | 描写 | 提示词 |
|---|---|---|
| 霓虹光晕 | 霓虹阴霾辉光/冷色工业氛围光 | neon haze glow, cold ambient industrial light |
| 阴影扭曲 | 拉长工业投影/深渊渐变/切割光影 | elongated industrial shadows, abyss gradient, sliced light |
| 粒子 | 漂浮金属尘/数据光点/飞灰 | floating metal dust, data light particles, drifting ash |
| 生物机械点缀 | 金属血肉藤蔓/裸露管线与零件生态 | biomechanical vines, exposed cables, mechanical assembly clusters |

---

## 六、提示词模板

以场景图为底图，img2img叠加时段/状态与氛围，
dystopian sci-fi scene, dark industrial biomechanical aesthetic, cyberpunk noir atmosphere,
保持场景主体与底模一致：{场景类型}，{结构/布局描述}，
【L1·时段/天气】{变化描写}（无则保持），
【L2·状态】{状态变化描写}（无则保持），
【L3·氛围】{氛围元素描写}（无则不写），
moody high-contrast lighting, corroded metal texture, neon haze, photorealistic texture,
画面中无任何人物和拟人物品，
no cartoon, no anime, no 2D illustration,
no bright candy color, no pure black-white minimalist style,
图中不要有任何文字

---

## 七、约束规则

### 必守

| 编号 | 规则 |
|---|---|
| R1 | 叠加后场景主体必须与底模一致 |
| R2 | 必须指定「日常/异变」状态语义 |
| R3 | 必须包含摄影写实 + 暗黑科幻锚定词 |
| R4 | 状态/氛围变化必须与用户线索匹配 |

### 严禁

| 编号 | 严禁 |
|---|---|
| X1 | 场景主体结构/布局/材质改变 |
| X2 | 出现人物/拟人物品 |
| X3 | 卡通/动漫/2D/扁平插画风格 |
| X4 | 明亮治愈的温馨色调（高饱和糖果色、幼儿卡通感） |
| X5 | 纯写实无科幻元素的现实题材 |
| X6 | 纯黑白极简风格（缺少层次与氛围铺垫） |
| X7 | 直接套用中国传统古风水墨基调 |
| X8 | 无叙事逻辑的抽象视觉堆砌 |
| X9 | 多视图/网格/分屏布局 |