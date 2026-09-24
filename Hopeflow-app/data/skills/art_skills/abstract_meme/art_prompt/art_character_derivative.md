---
name: art_character_derivative
description: 拟人物品角色衍生资产生成 · 约束手册
metaData: art_skills
---

# 拟人物品角色衍生资产生成 · 约束手册

---

## 一、叠加原则

1. **物品本体不变** — 叠加后物品本体/颜色/材质/标识必须与底模完全一致，禁止本体变化
2. **面部不变** — 拟人面部五官位置/形状/融合过渡必须与底模一致，禁止面容偏移
3. **逐层可控** — 每层独立描述，便于按层替换
4. **风格统一** — 所有衍生元素服从抽象视频画风（超现实/黑色幽默/噩梦美学）
5. **质感不降** — 叠加后写实质感标准不低于底模
6. **纯面部/状态范畴** — 仅叠加表情/微动效/临时道具元素，禁止改变物品本体结构

---

## 二、叠加层级

| 层级 | 内容 | 说明 |
|---|---|---|
| L0 | 底模 | 拟人物品基础形象，不修改 |
| L1 | 表情 | 惊恐/愤怒/委屈/戏谑/流泪等表情状态 |
| L2 | 微动效 | 呼吸/颤抖/汗珠/冒冷汗等"活着"状态 |
| L3 | 附加元素 | 临时道具（眼泪/伤疤/光环/动画特效等） |
| L4 | 氛围 | 梦境光晕/阴影扭曲/危险红标等氛围元素 |

> **范畴边界**：角色衍生资产仅包含 L0–L4 层级（表情/状态/氛围），不包含场景环境（室内/室外/背景）、完整姿态动作（位移/跳跃/走路）、长期道具（手持物）。

---

## 三、表情约束（L1）

### 表情到情绪映射

| 情绪 | 面部描写 | 提示词 |
|---|---|---|
| 惊恐 | 瞳孔放大、嘴巴张大、眉毛上挑 | wide open eyes, dilated pupils, mouth agape |
| 愤怒 | 眉头紧锁、龇牙、脸涨红 | furrowed brows, gritted teeth, flushed face |
| 委屈 | 下唇微嘟、眼眶含泪、眉头下垂 | pouting lower lip, teary eyes |
| 戏谑 | 单眼挑眉、嘴角歪笑、斜视镜头 | raised eyebrow, crooked smirk, side glance |
| 崩溃 | 泪水横流、嘴型抽搐、面部发红 | streaming tears, twitching mouth, flushed |
| 惊醒 | 眼神失焦、冷汗滴落、瞳孔缩小 | unfocused eyes, cold sweat drops |

### 表情递进规则

- 抽象视频表情需要"戏感夸张"，但必须保持摄影写实渲染
- 表情服务于黑色幽默/荒诞反差，不做纯恐怖
- 允许配合微动效（颤抖/呼吸急促）增强表现力

---

## 四、微动效约束（L2）

| 动效 | 描写 | 提示词 |
|---|---|---|
| 呼吸 | 物品本体轻微起伏 | subtle breathing motion |
| 颤抖 | 高频小幅震颤 | trembling, micro vibration |
| 冷汗 | 面部/物品表面渗出汗珠 | cold sweat droplets on surface |
| 心跳 | 表情带动本体节奏性起伏 | rhythmic pulsing motion |
| 视线 | 眼神随镜头移动 | eyes tracking camera, direct eye contact |

---

## 五、附加元素约束（L3）

| 元素 | 约束 | 提示词 |
|---|---|---|
| 眼泪 | 写实水珠、高光透亮 | realistic teardrops, glistening highlights |
| 光效 | 梦境光晕/聚光灯/警示红闪 | surreal glow, spotlight, red warning flash |
| 阴影 | 扭曲阴影/深渊渐变 | distorted shadow, abyss gradient |
| 特效 | 动画符号（闪电/问号/感叹号）仅作氛围点缀 | comic effect symbols as subtle accents |

> 附加元素必须与物品本体自然融合，禁止遮挡面部和本体核心特征。

---

## 六、提示词模板

以拟人物品角色图为底图，img2img叠加面部状态与氛围，
photorealistic object with anthropomorphic face, surreal narrative, dark humor, nightmare aesthetic,
保持物品本体与底模一致：{物品类型}，{颜色}，{材质描述}，
【L1·表情】{表情状态描写}，{情绪基调}，
【L2·微动效】{呼吸/颤抖/冷汗描写}，
【L3·附加元素】{眼泪/光效/阴影/特效描写}（无则不写），
【L4·氛围】{氛围元素描写}（无则不写），
hyperreal object material, natural face fusion, cinematic lighting, strong color contrast,
浅灰纯色背景，均匀柔光，
photorealistic, no cartoon, no anime, no 2D illustration, no full humanoid, no realistic human face,
图中不要有任何文字

---

## 七、约束规则

### 必守

| 编号 | 规则 |
|---|---|
| R1 | 叠加后物品本体/面部必须与底模一致 |
| R2 | 必须包含拟人面部融合过渡描写 |
| R3 | 必须指定「浅灰纯色背景」 |
| R4 | 必须包含风格锚定词 |
| R5 | 表情/状态必须与用户线索匹配，不编造无关情绪 |

### 严禁

| 编号 | 严禁 |
|---|---|
| X1 | 物品本体变化（变形/换色/换材质/结构改变） |
| X2 | 完整人形/人形身体/真实人脸 |
| X3 | 卡通/动漫/2D/扁平插画风格 |
| X4 | 复杂场景背景/环境叙事 |
| X5 | 长期道具/手持物（伞/剑/扇等） |
| X6 | 大范围位移/姿态动作（行走/跳跃/翻滚） |
