# 视频提示词 · 视觉风格约束

生成视频提示词时，必须注入以下视觉风格标签：

| 模式 | 风格标签 |
|------|----------|
| **通用多参模式（英文）** | `photorealistic object with anthropomorphic face, surreal nightmare transition, dark humor, nightmare aesthetic, distorted reality, hyperreal object material` |
| **通用首尾帧模式（英文）** | `photorealistic object with anthropomorphic face, surreal nightmare transition, dark humor, nightmare aesthetic, distorted reality, hyperreal object material, dramatic lighting shift` |
| **Seedance 2.0（中文）** | `写实物品拟人化面部，超现实噩梦转场，黑色幽默，噩梦美学，现实扭曲，物品真实材质` |

## 抽象视频专用提示词规则

### 1. 物品拟人动效

- **微动效** - 物品本体轻微呼吸/颤抖，模拟"活着"的感觉
- **面部动效** - 眼睛眨动、嘴巴张合、眉毛微动，表情自然
- **禁止全身运动** - 物品不移动位置，只有面部和微动效

### 2. 噩梦转场描述

- **坠入** - `画面开始扭曲，周围环境逐渐变形，色彩从暖色转向冷暗，物品陷入噩梦空间`
- **噩梦内容** - 具体描述物品恐惧的场景（如`物品从高处坠落，周围出现巨大的嘴/牙齿/深渊`）
- **惊醒** - `突然切回现实画面，物品剧烈颤抖，面部表情从恐惧变为惊魂未定`

### 3. 独白说话描述

- **嘴型** - `物品面部嘴巴自然张合，与独白节奏同步`
- **表情递进** - `表情从平静逐渐变为激动/愤怒/崩溃`
- **眼神** - `眼神直视镜头，与观众建立对话感`

### 4. 拟人剧描述

- **角色互动** - 多个拟人物品之间的互动（对话/冲突/反转）
- **剧情节奏** - 快节奏剪辑，每 3-5 秒一个反转/冲突点
- **情绪夸张** - 表情和动作夸张化，增强喜剧效果
