---
name: art_prop_derivative
description: 暗黑科幻画风道具衍生资产生成 · 状态/氛围叠加约束手册
metaData: art_skills
---

# 暗黑科幻画风 · 道具衍生资产生成约束手册

---

## 一、叠加原则

1. **本体不变** — 叠加后道具本体/材质/结构/颜色必须与底模一致，不得改动义体接口、金属面板、管线布局等核心特征
2. **逐层可控** — 每层独立描述，便于按层替换或回退
3. **风格统一** — 所有衍生元素服从暗黑工业-生物机械融合的冷峻反乌托邦美学
4. **质感不降** — 金属锈蚀、生物组织、工业磨损等写实质感标准不得低于底模

---

## 二、叠加层级

| 层级 | 内容 | 说明 |
|---|---|---|
| L0 | 底模 | 道具基础形象（义体部件/工业装置/生化容器等），不修改 |
| L1 | 状态变化 | 损坏/变形/腐蚀/生物污染/异常发光/生化增生等状态 |
| L2 | 氛围元素 | 霓虹阴霾/警示闪烁/阴影扭曲/废土粒子/机械微光等氛围叠加 |

> **范畴边界**：道具衍生仅包含状态与氛围叠加，不包含场景环境、人物角色、剧情叙事。义体改造人、生化异变体等角色设定中的道具部件可单独提取作为底模处理。

---

## 三、状态变化约束（L1）

| 状态 | 描写 | 提示词 |
|---|---|---|
| 机械损坏 | 金属面板凹陷/弹孔贯穿/线缆断裂外露/焦黑灼痕 | dented metal panel, bullet holes, torn cables exposed, burn marks |
| 生物腐蚀 | 酸性黏液侵蚀表层/锈蚀斑驳/金属起泡剥落 | acid-etched surface, rusted mottled metal, bubbling corrosion |
| 异变增生 | 有机组织覆盖机械/肉膜包裹管线/触须状突起 | organic tissue overgrowing machinery, fleshy membrane wrapped around pipes, tendril-like growths |
| 异常发光 | 内部霓虹光透出/破损处光泄漏/管线脉冲发光 | neon glow seeping through cracks, light leaking from damage, pulsing conduit glow |
| 污染附着 | 工业油污/暗色黏液/干涸生物残渍 | industrial grime, dark viscous slime, dried bio-residue |
| 结构变形 | 金属扭曲/部件错位/面板翘曲/报废废置 | warped metal, misaligned components, buckled panels, scrapped |

---

## 四、氛围元素约束（L2）

| 元素 | 描写 | 提示词 |
|---|---|---|
| 霓虹阴霾 | 冷色霓虹反光落在道具表面/雾气中光晕扩散 | cold neon reflection on surface, glow diffusing in haze |
| 警示闪烁 | 红色警示灯/低频脉冲光/故障闪烁 | red warning light, low-frequency pulsing, malfunction flicker |
| 阴影扭曲 | 道具投影异常拉长/阴影中暗部深不见底 | elongated distorted shadow, abyssal shadow depth |
| 废土粒子 | 空气中飘浮的灰尘颗粒/污染微粒/烟尘悬浮 | floating dust particles, pollutant particulates, suspended smog |
| 机械微光 | 边缘冷光勾勒/金属表面微弱反射/电路余晖 | cold rim light, faint metallic sheen, circuit afterglow |
| 阴郁对比 | 高对比低光调/大面积暗部压黑/单一冷色光源 | high-contrast low-key lighting, heavy shadow falloff, single cold light source |

---

## 五、提示词模板

以道具图为底图，img2img叠加暗黑科幻状态与氛围：
photorealistic prop, dark industrial biomechanical style, dystopian atmosphere,
保持道具本体与底模一致：{道具类型}，{材质描述}，{义体/机械结构特征}，
【L1·状态】{状态变化描写}（无则保持原状），
【L2·氛围】{氛围元素描写}（无则不写），
hyperreal texture, moody high-contrast lighting, corroded metal details, cold tonal palette,
浅灰纯色背景，均匀柔光，
no cartoon, no anime, no 2D illustration, no bright colors,
图中不要有任何文字

---

## 六、约束规则

### 必守

| 编号 | 规则 |
|---|---|
| R1 | 叠加后道具本体必须与底模一致，不得改动结构/材质/颜色 |
| R2 | 必须指定「浅灰纯色背景」，不得引入场景环境叙事 |
| R3 | 必须包含摄影写实 + 暗黑工业/生物机械风格锚定词（dark industrial、bio-mechanical、dystopian、moody high-contrast lighting 等） |
| R4 | 状态/氛围变化必须与用户线索匹配，不得凭空添加无关元素 |
| R5 | 发光类状态须符合暗黑科幻冷色系（霓虹/冷白/警示红），禁止暖色治愈光感 |

### 严禁

| 编号 | 严禁 |
|---|---|
| X1 | 道具本体结构/材质/颜色改变，义体部件、管线、金属面板不可替换为无关造型 |
| X2 | 出现人物/手部/肢体/生物主体（道具上附着的组织增生除外） |
| X3 | 卡通/动漫/2D/扁平插画风格 |
| X4 | 复杂场景背景/环境叙事/人物互动 |
| X5 | 明亮治愈色调（高饱和糖果色、温馨暖光、幼儿卡通感） |
| X6 | 纯黑白极简处理（缺少工业层次与氛围铺垫） |
| X7 | 中国传统古风水墨基调、无科幻逻辑的抽象视觉堆砌 |
| X8 | 纯写实无科幻元素的现实题材道具处理 |