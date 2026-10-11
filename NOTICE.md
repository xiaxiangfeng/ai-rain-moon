# 来源与许可

本地项目的原创游戏逻辑和 Faraz demo 的衍生雨景代码采用 GNU GPL v3，完整文本见 `LICENSE`。第三方模型、Heartfelt 衍生模块和素材分别保留自己的许可，不因根目录 LICENSE 而改变。

**兼容性状态**：Heartfelt 衍生代码采用 CC BY-NC-SA 3.0，该许可与 GPL v3 不兼容；单独标注各文件许可不能解决其作为同一程序组合发布的问题。当前版本的组合发布许可尚未解决，需要取得兼容授权或以独立实现替换 Heartfelt 衍生模块。其非商业条件也仍然有效。参考 [Creative Commons 官方兼容列表](https://creativecommons.org/compatible-licenses/)。以下来源记录不代表所有第三方素材均已完成许可核查。

## 地面与雨

原作：**Faraz Shaikh — demo-2023-rain-puddle**，演示地址：[https://faraz-portfolio.github.io/demo-2023-rain-puddle/](https://faraz-portfolio.github.io/demo-2023-rain-puddle/)。

`src/rain.js` 的邻域哈希、环形波及有限差分法线算法直接移植自 `demo-2023-rain-puddle/src/Floor/PuddleMaterial.tsx`，作者 Faraz Shaikh，GPL v3。移植为 Three.js TSL，并接入物理材质、HDR 环境光与街区平面反射。原项目未被修改。

| 当前素材 | 用户提供的原始文件 |
| --- | --- |
| `asphalt.jpg` | `demo-2023-rain-puddle/public/road/aerial_asphalt_01_diff_2k.jpg` |
| `asphalt-normal.jpg` | 同目录 `aerial_asphalt_01_nor_gl_2k.jpg` |
| `asphalt-roughness.jpg` | 同目录 `aerial_asphalt_01_rough_2k.jpg` |
| `city.hdr` | `demo-2023-rain-puddle/public/shanghai_bund_2k.hdr` |
| `splash.png` | `demo-2023-rain-puddle/public/Splash.png` |
| `rain.mp3` | `demo-2023-rain-puddle/public/sounds/light-rain-109591.mp3` |
| `night.mp3` | 同目录 `night-ambience-17064.mp3` |

这些素材独立复制到 `public/assets/`，不依赖原 demo 目录。原 demo 没有附带逐项素材许可说明，本文件记录来源，不为第三方素材主张额外权利。

## 玻璃

`src/heartfelt.js` 是用户提供的 `rain-heart/rain-heart.html` 中 Heartfelt 水滴算法的 TSL 移植，保留静止水珠、两层滑动水滴、水痕、有限差分折射及 textureLod 模糊。`src/glass.js` 把该水滴场接到实际 3D 落地窗和实时场景纹理，增加雨前清晰、湿度渐变和雨停后消退。

原作：**Heartfelt — Martijn Steinrucken / BigWings，2017**，来源 [Shadertoy](https://www.shadertoy.com/view/ltffzl)。原许可为 [Creative Commons Attribution–NonCommercial–ShareAlike 3.0 Unported](https://creativecommons.org/licenses/by-nc-sa/3.0/)。`src/heartfelt.js` 衍生代码沿用该许可，与 GPL 模块分别注明。原作音乐和背景图片没有用于本游戏。

`demo-2023-rain-puddle/` 与 `rain-heart/` 是最初移植时的参考目录，不是当前运行、构建或角色资源准备脚本的依赖。此处保留原路径作为来源记录。

## 人物

当前加载的 `public/assets/character/ametsuki.vrm` 改造自 **Alice Chan (Uniform ver) v1.0.2**，作者 **yuna0x0 / edisonlee55**。作者 [发布页](https://yuna0x0.itch.io/alice-chan) 和 [仓库](https://github.com/yuna0x0/AliceChan) 明确按 [Creative Commons Attribution–ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/) 发布。2026-10-11 下载作者的 `Alice Chan (Uniform ver) v1.0.4.zip`，其中的 VRM 文件版本为 v1.0.2；保留原始 VRM 元数据，完整许可见 `public/assets/character/LICENSE-Alice.md`。

模型改造包括：把原有长发网格收拢为马尾，保留 UV 和贴图，调整发丝法线、蒙皮权重、骨骼与逆绑定矩阵，共用一条弹簧骨骼链；运行时将金发染为棕色、添加发圈、调整 MToon 光照。完整校服、身体、面部和表情来自原作者，未用硬几何覆盖原有服装。改造模型继续按 **CC BY-SA 4.0** 分发，不属于本项目的 GPL 代码，不声称为原创或 CC0。原始模型保存于 `art-source/alice-uniform.vrm`，可通过 `scripts/prepare-character.mjs` 重现修改。

`art-source/UAL1_Standard.glb` 来自 **Quaternius — Universal Animation Library [Standard]** 的 [官方发布](https://quaternius.com/packs/universalanimationlibrary.html)。2026-10-11 下载作者免费包，包内 License.txt 明确为 **CC0 1.0 Universal**；保留文本于 `public/assets/character/LICENSE-Animations.txt`。`motions.json` 中待机、坐下、坐姿和起身四个片段来自该包，并经过骨骼重定向及手指放松调整；这些片段的动作数据仍为 CC0。

步行和小跑替换为 **Carnegie Mellon University Graphics Lab Motion Capture Database** 的真人捕捉 **07_04（慢走）**、**16_35（跑步）**。2026-10-11 从 [una-dinosauria/cmu-mocap](https://github.com/una-dinosauria/cmu-mocap) 获取 Bruce Hahne 的 BVH 转换数据，原件保留为 `art-source/cmu-07_04.bvh` 和 `art-source/cmu-16_35.bvh`。转换者的 [READMEFIRST](https://github.com/una-dinosauria/cmu-mocap/blob/master/READMEFIRST.txt) 说明 CMU 数据可用于研究及商业用途，转换不附加使用限制；完整原文保留于 `public/assets/character/LICENSE-CMU.txt`，不将这些数据重新标记为 CC0。`scripts/cmu-motion.mjs` 从捕捉片段提取循环、保留骨骼和骨盆动作，去除水平根运动及固定朝向，适配角色骨骼，修正循环边界和脚步接触。

按数据库要求致谢：**The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.**

`motions.json` 的 `handPoses` 放松手型与自然握拳取自同一 Quaternius 包的 Idle_Loop / Jog_Fwd_Loop，并混合到 CMU 行走和跑步骨骼动画，保持 CC0 许可。

推门的阶段轨迹、手臂双骨骼 IK 和掌面位置、朝向约束由本项目实现，未使用第三方推门动作片段。

旧原型模型 `art-source/previous-prototype.vrm` 仍保留但不再由游戏加载，来自 pixiv 官方 [three-vrm 示例](https://github.com/pixiv/three-vrm/blob/dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm)，模型名 `VRM1_Constraint_Twist_Sample` v1.0.1，© 2022 pixiv Inc.，按嵌入的 [VRM Public License 1.0](https://vrm.dev/licenses/1.0/) 使用。VRM 接入库 `@pixiv/three-vrm` 为 MIT 许可。

## 建筑与室内材质

`public/assets/materials/` 的颜色、OpenGL 法线及粗糙度贴图来自 Poly Haven，按其 [CC0 许可](https://polyhaven.com/license) 使用：

- [Wood Table 001](https://polyhaven.com/a/wood_table_001)
- [Wood Floor](https://polyhaven.com/a/wood_floor)
- [Plastered Wall 04](https://polyhaven.com/a/plastered_wall_04)
- [Brick Wall 003](https://polyhaven.com/a/brick_wall_003)

建筑、家具、店内设备和道路陈设由本项目创建的三维几何构成。`street-painting.png` 为 ImageGen 生成的咖啡馆挂画，提示词见 `ART_PROMPT.md`，不作为三维场景背景。

Three.js、Vite 为 MIT 许可，依赖包内保留其 LICENSE。
