---
name: art_prop_derivative
description: 道具衍生资产生成 · 约束手册
metaData: art_skills
---

# 道具衍生资产生成 · 约束手册

---

## 一、叠加原则

1. **本体不变** — 叠加后道具本体/材质/结构/颜色必须与底模一致
2. **逐层可控** — 每层独立描述，便于按层替换
3. **风格统一** — 所有衍生元素服从抽象视频画风
4. **质感不降** — 写实质感标准不低于底模

---

## 二、叠加层级

| 层级 | 内容 | 说明 |
|---|---|---|
| L0 | 底模 | 道具基础形象，不修改 |
| L1 | 状态变化 | 损坏/变形/发光/污染/脏污等状态 |
| L2 | 氛围元素 | 阴影扭曲/光晕/警示红闪/超现实装饰 |

> **范畴边界**：道具衍生仅包含状态/氛围叠加，不包含场景环境、人物、剧情叙事。

---

## 三、状态变化约束（L1）

| 状态 | 描写 | 提示词 |
|---|---|---|
| 损坏 | 裂纹/缺口/碎块/焦痕 | cracks, chips, scorch marks |
| 变形 | 扭曲/拉伸/融化 | distorted, warped, melting |
| 发光 | 内部光透出/边缘辉光 | glowing from within, rim glow |
| 污染 | 污渍/粘液/血渍 | stains, slime, grime |
| 腐蚀 | 锈蚀/侵蚀/斑驳 | corroded, eroded, mottled |

---

## 四、氛围元素约束（L2）

| 元素 | 描写 | 提示词 |
|---|---|---|
| 阴影扭曲 | 道具投影异变/深渊渐变 | distorted shadow, abyss gradient |
| 光晕 | 梦境光晕/冷色氛围光 | surreal glow, cold ambient light |
| 警示 | 红色警示光/脉冲闪烁 | red warning glow, pulsing light |
| 超现实点缀 | 悬浮粒子/微小眼睛/飘浮符号 | floating particles, tiny eyes, levitating symbols |

---

## 五、提示词模板

以道具图为底图，img2img叠加状态与氛围，
photorealistic prop, surreal narrative, dark humor, nightmare aesthetic,
保持道具本体与底模一致：{道具类型}，{材质描述}，
【L1·状态】{状态变化描写}（无则保持原状），
【L2·氛围】{氛围元素描写}（无则不写），
hyperreal texture, cinematic lighting, strong color contrast,
浅灰纯色背景，均匀柔光，
no cartoon, no anime, no 2D illustration,
图中不要有任何文字

---

## 六、约束规则

### 必守

| 编号 | 规则 |
|---|---|
| R1 | 叠加后道具本体必须与底模一致 |
| R2 | 必须指定「浅灰纯色背景」 |
| R3 | 必须包含摄影写实 + 风格锚定词 |
| R4 | 状态/氛围变化必须与用户线索匹配 |

### 严禁

| 编号 | 严禁 |
|---|---|
| X1 | 道具本体结构/材质/颜色改变 |
| X2 | 出现人物/手部/肢体 |
| X3 | 卡通/动漫/2D/扁平插画风格 |
| X4 | 复杂场景背景/环境叙事 |
