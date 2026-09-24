---
name: art_character_derivative
description: 暗黑科幻画风角色衍生资产生成 · 约束手册
metaData: art_skills
---

# 暗黑科幻画风角色衍生资产生成 · 约束手册

---

## 一、叠加原则

1. **角色本体不变** — 叠加后角色的轮廓、义体接口、皮肤/金属材质、配色与标识必须与底模完全一致，禁止本体变化
2. **面部融合不变** — 生物组织与机械部件的边界、位置、过渡方式必须与底模一致，禁止面容偏移或融合点漂移
3. **逐层可控** — 每层独立描述，便于按层替换与组合
4. **风格统一** — 所有衍生元素服从暗黑科幻画风（冷峻工业质感 / 生物机械融合 / 反乌托邦氛围）
5. **质感不降** — 叠加后照片级的金属锈蚀、生体湿润感与机械细节标准不低于底模
6. **状态叠加范畴** — 仅叠加表情、微动效、临时元素与氛围光影，禁止改变角色本体结构

---

## 二、叠加层级

| 层级 | 内容 | 说明 |
|---|---|---|
| L0 | 底模 | 暗黑科幻角色基础形象，不修改 |
| L1 | 表情 | 惊恐/愤怒/崩溃/惊醒/戏谑等表情状态 |
| L2 | 微动效 | 机械呼吸/颤抖/冷凝液/液压脉动等"活着"状态 |
| L3 | 附加元素 | 临时状态元素（锈蚀泪痕/冷凝霜/电弧/警示光等） |
| L4 | 氛围 | 工业冷光/霓虹阴霾/高反差阴影/废土薄雾等氛围元素 |

> **范畴边界**：角色衍生资产仅包含 L0–L4 层级（表情/状态/氛围），不包含场景环境（都市/废墟/室内/室外背景）、完整姿态动作（位移/跳跃/行走）、长期道具（武器/工具/手持物）。

---

## 三、表情约束（L1）

### 表情到情绪映射

| 情绪 | 面部描写（暗黑科幻版） | 提示词 |
|---|---|---|
| 惊恐 | 生物眼球急缩、义眼瞳孔扩散、嘴部护板错位微张 | wide animalistic pupils, optics jarred open, jaw plate unseated |
| 愤怒 | 眉弓金属板压低、暴露咬合齿、太阳穴液压管爆起 | furrowed brow plate, gritted metal teeth, tense hydraulic temple line |
| 委屈 | 下唇组织轻微下垂、义眼透出暗淡水光、眉弓机械件内收 | drooping lower lip, dim bionic eye sheen, retracted brow joint |
| 戏谑 | 单边机械眉挑起、嘴角拉出非对称裂纹式笑、义眼光轴斜移 | one-sided servo brow raise, asymmetrical scar-smile, ocular axis tilt |
| 崩溃 | 金属泪槽渗锈液、半张面部组织失控抽搐、义眼信号噪点 | rust tears streaking cheek plate, uncontrolled muscle tic, ocular signal glitch |
| 惊醒 | 光学镜头骤缩、瞳孔失焦、冷汗在义体接缝凝珠 | suddenly narrowed optics, unfocused eyes, cold sweat beading on implant seams |

### 表情递进规则

- 暗黑科幻角色表情需体现"机械与肉体共同作用"，不能只做纯人类表情
- 表情服务于反乌托邦叙事的压抑、危险与荒诞感，不做纯恐怖或甜蜜可爱
- 允许配合微动效（机械颤抖、冷却液渗出、液压脉动）增强表现力
- 所有表情必须保持摄影写实渲染，禁止卡通化夸张
- 表情状态必须匹配用户给出的情绪线索，不得编造无关情绪

---

## 四、微动效约束（L2）

| 动效 | 描写 | 提示词 |
|---|---|---|
| 机械呼吸 | 半机械胸腔/换气口/面甲导气管轻微起伏 | rhythmic vent rise, slow mechanical breath |
| 颤抖 | 脸部组织或义体关节高频小幅震颤 | high-frequency micro tremor, servo jitter |
| 冷凝汗液 | 义体接口与皮肤交界处渗冷凝液珠 | coolant sweat, condensation on metal seams |
| 液压脉动 | 导管/血管/线缆随节奏脉冲 | rhythmic hydraulic pulse through cables |
| 视线锁定 | 义眼/光学镜头随镜头移动或锁定 | bionic eye tracking camera, optic lock |
| 信号噪点 | 义眼或面部显示屏短暂电子雪花/干扰 | transient analog static on ocular display |

> 微动效必须依附于底模既有结构，禁止额外生成新的管道、线缆或机械部件。

---

## 五、附加元素约束（L3）

| 元素 | 约束 | 提示词 |
|---|---|---|
| 锈蚀泪痕 | 写实金属锈液/机油泪痕，沿义体纹路滑落 | realistic rust tears, glossy black oil streaks |
| 冷凝霜层 | 低温凝结的薄霜与冰冷呼吸雾气 | thin frost layer, cold breath mist |
| 电弧 | 破损接口附近跳动的细小蓝色电弧，不扩散 | small blue electric arcs across exposed seams |
| 警示光 | 义眼/胸口/颈部进度灯红色或琥珀色闪烁 | red/amber warning light blink |
| 阴影/霓虹反光 | 霓虹光带扫过面部，或深黑阴影包裹单侧 | neon rim light trails, deep shadow occluding one side |

> 附加元素必须与角色底模自然融合，禁止遮挡面部核心特征，禁止改变义体原有数量与结构。

---

## 六、氛围约束（L4）

| 氛围 | 描写 | 提示词 |
|---|---|---|
| 工业冷光 | 低照度冷色定向光，营造压抑金属空间感 | low-key cold industrial lighting |
| 霓虹阴霾 | 纯色背景上微弱霓虹色雾，城市远光渗入 | subtle neon haze in background |
| 高反差阴影 | 硬光与深黑阴影叠压，塑造层次与危险感 | high-contrast dark shadow, chiaroscuro |
| 废土薄雾 | 角色周围低密度尘埃霾，强化废土气息 | sparse dust haze around character |
| 警示红晕 | 环境深处若隐若现的红色环境光 | faint red ambient warning glow |

> 氛围元素只能在背景/光影层面起作用，禁止引入可辨识的场景物体或环境叙事。

---

## 七、提示词模板

以暗黑科幻角色图为底图，img2img叠加表情、微动效与氛围，
photorealistic dark sci-fi character portrait, dystopian industrial biomechanical aesthetic, corroded metal, bio-mechanical fusion, neon haze, moody high-contrast lighting,
保持角色本体与底模一致：{角色类型}，{主色调}，{材质/义体结构}，
【L1·表情】{表情状态描写}，{情绪基调}，
【L2·微动效】{呼吸/颤抖/冷凝液/视线描写}（无则不写），
【L3·附加元素】{锈蚀泪痕/电弧/警示光/冷凝霜描写}（无则不写），
【L4·氛围】{工业冷光/霓虹阴霾/高反差阴影描写}（无则不写），
neutral dark grey solid background, single cold soft key light, moody high contrast,
photorealistic, no cartoon, no anime, no 2D illustration, no full humanoid, no realistic human face,
图中不要有任何文字

---

## 八、约束规则

### 必守

| 编号 | 规则 |
|---|---|
| R1 | 叠加后角色本体/面部/义体结构必须与底模一致 |
| R2 | 必须包含生物与机械融合过渡描写 |
| R3 | 必须指定「纯色背景 + 冷调定向光/低照度」 |
| R4 | 必须包含暗黑科幻风格锚定词（金属锈蚀/生物机械融合/霓虹阴霾/高反差光影等） |
| R5 | 表情/状态必须与用户线索匹配，不编造无关情绪 |
| R6 | 所有衍生元素必须服从反乌托邦叙事与废土气息 |

### 严禁

| 编号 | 严禁 |
|---|---|
| X1 | 角色本体变化（变形/换色/换材质/结构改变） |
| X2 | 完整人形/真人脸/纯现实无科幻元素 |
| X3 | 卡通/动漫/2D/扁平插画风格 |
| X4 | 复杂场景背景/环境叙事 |
| X5 | 长期道具/手持物（武器、工具、伞、剑等） |
| X6 | 大范围位移/姿态动作（行走/跳跃/翻滚/奔跑） |
| X7 | 高饱和糖果色、明亮治愈、幼儿卡通感 |
| X8 | 无叙事逻辑的抽象视觉堆砌 |
| X9 | 中国传统古风水墨基调或纯黑白极简风格（缺少层次与氛围铺垫） |