# 视频提示词 · 视觉风格约束（欧美3D动画电影）

生成视频提示词时，必须注入以下视觉风格标签：

| 模式 | 风格标签 |
|------|----------|
| **通用多参模式（英文）** | `western 3D animation film style, Pixar-like CGI animated movie, 3D animated feature film render, rounded cute character design, exaggerated expressive animation performance, bright saturated colors, soft global illumination, subsurface scattering skin, rich material detail fur fabric skin, three-point lighting, warm cinematic color grading, smooth animation motion, non-live-action non-photorealistic` |
| **通用首尾帧模式（英文）** | `western 3D animation film style, 3D animated feature film frame, rounded character design, exaggerated animation expressions, bright saturated color palette, soft global illumination, subsurface scattering, detailed fur and fabric materials, gentle bokeh depth of field, warm cinematic look, non-live-action non-photorealistic` |
| **Seedance 2.0（中文）** | `欧美3D动画电影风格，三维动画电影成片质感，圆润饱满角色造型，夸张生动的动画表演，明亮饱和的色彩，柔和全局光照，次表面散射皮肤质感，毛发布料等丰富材质细节，三点布光，动画电影级画面，视频动态优化，非真人实拍非写实` |

---

> **使用说明**：
> 1. 上述风格标签为全局注入段，置于视频提示词开头或结尾
> 2. 视频生成必须持续锁定「动画电影」身份——禁止画面滑向真人实拍或照片写实
> 3. 表演描述应使用动画语言（夸张表情、弹性运动、戏剧化手势），而非真人微表情
> 4. 材质描述应声明 SSS/毛发/布料等动画材质细节，增强成片质感
> 5. 色彩保持明亮饱和、柔和全局光照，禁止灰暗压抑与荧光溢色
