# 视频提示词 · 视觉风格约束（真人复古胶片）

生成视频提示词时，必须注入以下视觉风格标签：

| 模式 | 风格标签 |
|------|----------|
| **通用多参模式（英文）** | `live-action retro film photography, 1980s-90s analog film look, real human actors, film grain texture, warm brown faded color palette, low saturation nostalgic tones, subtle color shift, vignette, soft highlight roll-off, cinematic lighting with natural light and warm practical lamps, 35mm film aesthetic, handheld camera breathing, film frame rate, non-CGI non-rendered non-cartoon` |
| **通用首尾帧模式（英文）** | `live-action retro film photography, 1980s-90s analog film frame, real human actors, film grain, warm faded nostalgic tones, subtle color cast, vignette corners, soft cinematic highlights, natural window light and warm tungsten lamps, shallow depth of field, 35mm film look, non-CGI non-rendered non-cartoon` |
| **Seedance 2.0（中文）** | `真人复古胶片电影摄影，真人实拍质感，80-90年代胶片风格，胶片颗粒质感，暖棕褪色复古色调，低饱和怀旧氛围，轻微色偏，暗角，电影感自然光与暖调灯光，35mm胶片美学，视频动态优化，非CG非渲染非卡通` |

---

> **使用说明**：
> 1. 上述风格标签为全局注入段，置于视频提示词开头或结尾
> 2. 视频生成必须持续锁定「真人实拍 + 胶片质感」身份——禁止滑向3D渲染、卡通或现代数码感
> 3. 色彩必须保持低饱和暖棕褪色与轻微色偏，禁止高饱和荧光色与现代数码锐利色
> 4. 人物皮肤必须保留真实纹理，禁止磨皮假面
> 5. 场景必须符合80-90年代时代背景，禁止现代数码设备入镜
