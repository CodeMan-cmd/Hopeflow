---
name: art_texture_material
description: 材质与质感 · 抽象视频画风约束手册 — 真实物品材质、拟人面部融合
metaData: art_skills
---

# 材质与质感 · 抽象视频画风约束手册

> **本画风质感锚定于"hyperreal object material + natural face fusion"**：物品本体极致写实，拟人面部与材质自然融合，禁卡通/2D/塑料假面感。

---

## 一、渲染质感描述

| 项目 | 约束 | 说明 |
|---|---|---|
| 基底质感 | 摄影写实（photorealistic） | 真实光影、物理材质 |
| 物品材质 | hyperreal object material | 塑料/陶瓷/金属/织物纹理超清晰 |
| 面部融合 | natural face fusion | 肤色与物品材质自然过渡，非硬贴图 |
| 材质精度 | 纹理/划痕/反光可辨 | 细节真实、无塑料假面感 |
| 表面处理 | 真实质感 | 非卡通、非2D、非磨皮 |

---

## 二、材质锚词清单

> 可直接注入提示词使用（中英文均可）。

| 锚词（中） | 锚词（英） | 用途 |
|---|---|---|
| 摄影写实 | photorealistic | 总风格锚定 |
| 超写实物品材质 | hyperreal object material | 物品材质（继承 R1） |
| 拟人面部自然融合 | natural face fusion, seamless blend | 面部过渡 |
| 电影级光影 | cinematic lighting | 整体质感 |
| 强色彩对比 | strong color contrast | 氛围锚词 |
| 真实物品纹理 | realistic object texture | 材质细节 |
| 微表情细节 | expressive facial detail | 面部细节 |

---

## 三、常见物品材质约束

| 材质 | 渲染要求 | 提示词 |
|---|---|---|
| 塑料/橡胶 | 写实光泽、划痕、污渍 | realistic plastic, subtle wear |
| 陶瓷 | 釉面光泽、高光 | glossy ceramic glaze |
| 金属 | 冷光泽、反射 | metallic sheen, reflections |
| 织物 | 纤维质感、褶皱 | fabric weave, natural folds |
| 玻璃 | 透光、折射 | light refraction, transparency |
| 纸张 | 纸纹、边缘 | paper grain, natural edges |

---

## 四、面部融合质感约束

| 项目 | 约束 | 提示词 |
|---|---|---|
| 过渡 | 肤色与材质自然渐变 | seamless skin-to-material gradient |
| 比例 | 面部占物品正面 15-25% | face occupying 15-25% |
| 细节 | 皮肤毛孔/纹理真实 | realistic skin texture |
| 色彩 | 肤色与物品原色协调 | skin tone blending with object color |

---

## 五、提示词模板

```
抽象视频写实质感，
photorealistic object with anthropomorphic face, hyperreal object material,
{物品类型}，{材质描述}，{纹理细节}，
拟人面部自然融合，natural face fusion, seamless blend,
面部占物品正面 15-25%，face occupying 15-25% of the object surface,
cinematic lighting, strong color contrast, realistic texture detail,
no cartoon, no anime, no 2D illustration, no flat design
```

---

## 六、必守规则

| 编号 | 规则 |
|---|---|
| R1 | 必须声明「photorealistic」风格锚定词 |
| R2 | 必须声明「hyperreal object material」 |
| R3 | 必须声明「natural face fusion」面部融合 |
| R4 | 物品材质纹理必须清晰可辨 |

### 严禁项

| 编号 | 严禁 |
|---|---|
| X1 | 卡通/动漫/2D/扁平插画质感 |
| X2 | 塑料假面感/面部生硬拼接 |
| X3 | 磨皮过度的虚假质感 |
| X4 | 材质模糊/无细节 |
