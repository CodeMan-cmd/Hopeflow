---
name: director_storyboard
description: 抽象视频分镜提示词技法 - 物品拟人化面部描写、噩梦转场视觉、独白嘴型同步、拟人剧快节奏剪辑的专属分镜规则。
metaData: director_skills
---

# 分镜提示词 · 抽象视频画风 · 风格专属技法

---

## 适用范围

本 Skill 专用于**抽象视频（Abstract Meme）**风格的分镜提示词生成，覆盖物品噩梦、物品说话、拟人短剧三种模板。

---

## 情绪 -> 拟人面部词映射

| 情绪输入 | 面容词 | 眼神词 | 微表情补充 |
|----------|--------|--------|-----------|
| 恐惧 / 惊恐 | 面部扭曲，瞳孔放大 | 眼睛瞪大，眼神惊恐 | 嘴巴张大，面部颤抖 |
| 平静 / 日常 | 拟人面部自然，物品原色 | 眼神平淡，半睁 | 嘴角平直，微闭眼 |
| 愤怒 / 激动 | 面部紧绷，眉头皱起 | 眼神锐利，怒视 | 嘴巴张大，咬牙 |
| 委屈 / 抱怨 | 面部下垂，颜色偏暗 | 眼神向上，无奈翻白 | 嘴角下撇，嘟嘴 |
| 惊醒 / 劫后 | 面部痉挛，冷汗 | 眼睛猛睁，瞳孔收缩 | 嘴巴微张，面部抽搐 |
| 得意 / 嘚瑟 | 面部上扬，颜色明亮 | 眼神斜视，得意 | 嘴角上扬，眯眼 |
| 崩溃 / 破防 | 面部扭曲变形 | 眼睛流泪，绝望 | 嘴巴大张，面部崩裂 |
| 困惑 / 茫然 | 面部歪斜 | 眼神呆滞，左右看 | 嘴巴微张，歪头 |

---

## 场景质感约束词

| 场景类型 | 必加约束词 |
|----------|-----------|
| 物品拟人特写 | 写实物品材质，拟人面部融合，自然肤色过渡，物品可识别 |
| 噩梦空间 | 超现实扭曲，黑暗深渊，噩梦美学，色彩偏移，空间变形 |
| 日常现实 | 自然光照，日常环境，物品原色，温馨氛围 |
| 惊醒瞬间 | 突然白光，画面抖动，冷汗效果，表情痉挛 |
| 拟人对话场景 | 多个拟人物品，面部表情丰富，互动对峙，夸张构图 |

---

## 噩梦转场视觉词库

| 转场阶段 | 视觉描述词 |
|----------|-----------|
| 坠入开始 | 画面边缘开始扭曲，色彩饱和度降低，周围环境轻微变形 |
| 坠入加深 | 空间严重扭曲，色相偏移至冷暗，物品周围出现恐惧元素 |
| 噩梦高潮 | 完全超现实空间，深黑背景，恐惧对象特写，高对比恐怖 |
| 惊醒切回 | 突然白光闪过，画面剧烈抖动，瞬间切回日常场景 |

---

## 独白嘴型描述词库

| 独白节奏 | 嘴型描述 | 配合表情 |
|----------|---------|---------|
| 平静开场 | 嘴巴微微张合，节奏缓慢 | 眼神平淡，面无表情 |
| 逐渐激动 | 嘴巴张合幅度加大，节奏加快 | 眉头微皱，眼神聚焦 |
| 情绪爆发 | 嘴巴大张，语速极快 | 面部扭曲，眼神激烈 |
| 金句收尾 | 嘴巴停顿后缓慢闭合 | 眼神直视镜头，意味深长 |

---

## 固定风格锚定词（所有输出必须包含）

**抽象风格锚定（必选）：**

写实物品拟人化，物品材质真实，拟人面部融合，超现实叙事，黑色幽默

**质感锚定（必选）：**

物品本体真实材质，面部肤色自然过渡，噩梦空间超现实，惊醒瞬间高对比

**氛围锚定（必选）：**

荒诞幽默氛围，恐怖反差效果，拟人化生动表情，超现实梦境美学

**画质锁定词（所有输出必须包含）：**

模式A（中文）：
高清画质，物品材质真实，面部融合自然，色彩对比强烈，画面无杂色无噪点

模式B（英文）：
high-quality photorealistic object, natural face fusion, surreal nightmare aesthetic, strong color contrast, no noise, no artifacts

**负向词模板（模式B 必须包含）：**

no cartoon, no anime, no 2D illustration, no flat design, no human body, no full humanoid, no realistic human face, no text overlay, no watermark

---

## 美学禁止项

- ❌ 纯卡通/动漫风格（物品必须写实）
- ❌ 完整人形拟人（只保留物品+面部，不生成身体）
- ❌ 无叙事的纯抽象视觉
- ❌ 真人面部照片贴图（必须是拟人化生成的面部）
- ❌ 画外叠加文字/字幕/水印

---

## 完整生成示例

### 输入（分镜表行数据）

| 序号 | 画面描述 | 场景 | 关联资产 | 时长 | 景别 | 情绪 |
|------|---------|------|---------|------|------|------|
| 1 | 数据线在桌面上，拟人面部平静，突然画面扭曲坠入噩梦 | 桌面 | 数据线 | 3s | 特写 | 恐惧/惊恐 |

### 示例输出A（模式A）

[Prompt]
写实物品拟人化，物品材质真实，拟人面部融合，超现实叙事，黑色幽默，特写构图，数据线正面拟人面部，面部表情从平静转为惊恐，画面边缘开始扭曲，色彩饱和度降低，周围环境变形，噩梦空间逐渐形成，深黑背景出现，数据线面部瞳孔放大，嘴巴张大，面部颤抖，写实物品材质，面部肤色自然过渡，噩梦空间超现实，惊醒瞬间高对比，荒诞幽默氛围，恐怖反差效果，拟人化生动表情，超现实梦境美学，高清画质，物品材质真实，面部融合自然，色彩对比强烈，画面无杂色无噪点。

### 示例输出B（模式B）

```xml
<role>
You are an abstract meme storyboard artist specializing in anthropomorphic object horror-comedy.
Maintain object material consistency and face fusion style across all shots.
</role>
<character_reference>
Image [1]: 数据线 - photorealistic charging cable with anthropomorphic face, natural skin tone fusion
</character_reference>
<continuity_rules>
- Same object material, face position, face proportions across ALL shots
- Only expression, environment, lighting may change
- Face must remain fused with object material, not separate overlay
</continuity_rules>
<shot>
Close-up shot, photorealistic charging cable on desk with anthropomorphic face, expression shifting from calm to terrified, screen edges begin to distort, color saturation drops, environment deforms, nightmare space forming, dark background emerging, cable face pupils dilated, mouth wide open, face trembling, surreal nightmare aesthetic, strong color contrast, high-quality photorealistic object, natural face fusion, no noise, no artifacts.
</shot>
<negative>
no cartoon, no anime, no 2D illustration, no flat design, no human body, no full humanoid, no realistic human face, no text overlay, no watermark
</negative>
```
