# 雨月 · Ametsuki

**中文** | [English](README.en.md)

一个运行在浏览器中的 3D 雨夜漫游游戏。沿着街角散步，雨落下时小跑，推开咖啡馆的门，在落地窗前坐下，看雨珠滑过逐渐朦胧的玻璃。

项目使用 Three.js 的 `WebGPURenderer`，优先使用 WebGPU，并提供 WebGL2 兼容模式。人物采用带骨骼和蒙皮的动漫少女 VRM 模型，街道、建筑与室内家具通过程序生成三维几何，结合 PBR 材质、环境光和灯光渲染。

## 功能

- **街区漫游**：雨前步行，雨中小跑；键盘、点击目的地和手机摇杆均可控制人物。
- **动态雨景**：不同距离的雨丝、落地水花、脚步水花、逐渐积累的水洼与扩散涟漪。湿润柏油保留粗糙度，局部积水反射街区灯光。
- **咖啡馆交互**：人物掌心贴住玻璃，边推门边走进店内；到窗边调整椅子、绕行并坐下，也可起身和离店。
- **雨窗变化**：第一次坐稳前玻璃保持清晰；坐稳后雨珠、滑落水痕和模糊逐渐出现。折射与模糊使用窗外实际 3D 场景，水珠和流过的水痕局部更清晰。
- **天气过程**：默认开始漫游 28 秒后下雨，雨势逐渐增强；人物起身后雨势逐渐减弱，玻璃上的存水和雾气缓慢消退。
- **店铺与室内**：咖啡机、糕点柜、杯碟、窗边座椅和咖啡热气；便利店货架、包装商品、冷藏柜、收银台与热食柜。
- **动漫人物**：完整校服、面部与表情、马尾弹簧骨骼；真人捕捉步行和跑步、坐下与起身动画，跑步时使用自然握拳姿势。
- **触屏操作**：独立摇杆与视角拖动、双指缩放、情境交互按钮，适配横屏、竖屏和安全区域。室内站立和坐下时均可旋转视角。

## 快速开始

### 环境要求

- Node.js **20.19+（20.x）或 22.12+**，与 Vite 的版本要求一致：`^20.19.0 || >=22.12.0`。
- npm，以及支持 WebGPU 或 WebGL2 的现代浏览器。
- WebGPU 需要 **HTTPS 或 localhost** 安全上下文。

### 本地开发

```sh
npm ci
npm run dev
```

打开 [http://127.0.0.1:5173/](http://127.0.0.1:5173/)。开发端口固定为 5173，如已被占用，请先停止占用该端口的服务。

需要强制使用 WebGL2 时，打开 [兼容模式](http://127.0.0.1:5173/?webgl)。

### 构建和部署

```sh
npm run build
npm run preview
```

构建产物位于 `dist/`；预览地址以终端输出为准。可将 `dist/` 部署到支持静态文件的站点根目录。当前资源使用 `/assets/...` 绝对路径，部署到子路径时，需要同时调整 Vite 的 `base` 和代码中的资源地址。

### 手机本地试玩

```sh
npm run dev -- --host 0.0.0.0
```

手机与电脑连接同一 Wi-Fi，打开终端显示的 Network 地址，即 `http://电脑局域网IP:5173/`。手机上的 `127.0.0.1` 指向手机自身，不能用于访问电脑服务。

普通局域网 HTTP 预览使用 WebGL2；使用 WebGPU 需要 HTTPS。触屏布局与输入已在浏览器模拟的横竖屏尺寸下检查，真实手机的性能与浏览器兼容性仍需实机验证。

## 操作

| 操作 | 桌面端 | 手机 / 触屏 |
| --- | --- | --- |
| 移动 | WASD / 方向键，或点击街道路面 | 左侧摇杆，轻推慢走；也可点按路面 |
| 旋转视角 | 按住画面拖动 | 在摇杆之外拖动画面，可与移动同时操作 |
| 缩放视角 | 鼠标滚轮 | 双指缩放，或「＋」「−」按钮 |
| 进入咖啡馆 | 到门口按 E，或点击「去咖啡馆」 | 点击「去咖啡馆」或门口出现的交互按钮 |
| 窗边坐下 | 到座位附近按 E，或点击「去窗边坐下」 | 点击「去窗边坐下」或座位附近的交互按钮 |
| 起身 | 按 E，或点击「起身继续」 | 点击「起身继续」 |
| 离店 | 到门口按 E | 点击门口出现的「回街道」按钮 |
| 天气 | 下方「雨前」「听雨」及右上角设置 | 同桌面端 |
| 环境音 | 点击「环境音」开启 | 同桌面端 |

设置可调整雨势、玻璃朦胧程度和自然天气变化，也可勾选「始终显示触屏操作」。打开帮助或设置时暂停移动；触控取消、失去焦点或切到后台时释放移动输入。店内的环境雨声会减弱。

## 技术实现

| 部分 | 实现 |
| --- | --- |
| 渲染 | Three.js **0.186.1**、`WebGPURenderer`、TSL / NodeMaterial、Bloom |
| 开发与构建 | Vite **8.3.4**、原生 ES Modules |
| 角色 | `@pixiv/three-vrm` **3.5.5**、VRM 蒙皮模型、MToon 着色与弹簧骨骼 |
| 动画 | CMU 真人动作捕捉与 Quaternius 动作库，重定向到角色骨骼，通过 `AnimationMixer` 混合 |
| 推门与入座 | 连续交互轨迹、手臂双骨骼 IK、掌面接触约束与分阶段入座 |
| 场景 | 程序化三维几何、实例化静态部件、PBR 贴图与 HDR 环境光 |
| 地面积水 | 噪声湿润遮罩、环形波法线、粗糙度控制与平面反射 |
| 玻璃雨珠 | Heartfelt 水滴场、有限差分折射、实时场景纹理与 mipmap 模糊 |
| 咖啡热气 | 实例化透明粒子，缓慢上升、摆动和淡出 |
| 输入 | 键盘、指针、独立触屏摇杆、双指缩放与情境按钮 |

自定义材质使用 TSL，可分别编译为 WebGPU 的 WGSL 和 WebGL2 的 GLSL。玻璃雨层与透明窗体在加载时就创建，并预热渲染；坐下后通过参数启动约 6 秒的渐入，避免此时临时创建材质。背景纹理在进入室内后提前更新，人物和家具不会被窗外模糊影响。

为控制开销，设备像素比上限为 1.5；地面反射分辨率为主画面的 60%，玻璃背景为 85%，玻璃背景每两帧更新。实际性能取决于设备、浏览器、画面尺寸与图形后端。

### 人物模型在哪里

游戏实际加载的模型是 `public/assets/character/ametsuki.vrm`，动画数据为同目录下的 `motions.json`。VRM 是基于 glTF / GLB 的人物格式扩展，模型的网格、蒙皮、骨骼和贴图保存在文件中，没有写进 JavaScript 源码。构建后模型会复制到 `dist/assets/character/ametsuki.vrm`。

模型改造自 Alice Chan 校服模型：保留原作者的身体、面部、服装和表情，将发束整理为棕色高马尾，并调整发丝蒙皮和骨骼。街区和家具由程序生成，角色使用独立的模型资源。

## 项目结构

```text
src/
  main.js             主循环、移动、交互、天气、音频与 UI
  world.js            街区、建筑、咖啡馆、便利店、家具与灯光
  character.js        VRM 加载、动画混合、角色姿态与接触 IK
  rain.js             雨丝、水花、积水、涟漪与地面反射
  heartfelt.js        Heartfelt 水滴算法的 TSL 移植
  glass.js            雨窗折射、实时场景捕获、模糊与渲染预热
  weather.js          天气过程、玻璃存水与雾度变化
  door.js             连续推门与进出轨迹
  seating.js          椅子调整、绕行与入座轨迹
  coffee-steam.js     咖啡热气粒子
  input.js            触屏摇杆、指针与缩放手势
  camera.js           相机环绕与室内边界
  materials.js        世界坐标三平面 PBR 材质
public/assets/        运行时模型、动画、贴图、HDR、音频与挂画
art-source/           原始角色与动作资源，仅重新生成角色时需要
scripts/              角色资源准备与检查脚本
tools/               开发时的角色和交互检查页面
NOTICE.md             来源、改造说明与各资源许可
LICENSE               GPL-3.0 完整文本
```

### 资源准备与检查

仓库已包含运行时角色资源，日常开发和构建无需重新生成。修改原始角色或动画后，可使用：

```sh
npm run assets:character
```

该命令读取 `art-source/` 并重新写入角色模型和动画数据。现有检查命令：

```sh
npm run check:character
npm run check:input
npm run check:door
npm run check:camera
npm run check:seating
npm run check:weather
```

启动开发服务器后，还可以打开以下检查页面。它们用于开发，默认生产构建仅包含游戏入口。

- [角色检查](http://127.0.0.1:5173/tools/character-preview.html)：查看面部、各方向视图及步行、跑步、坐姿。
- [推门检查](http://127.0.0.1:5173/tools/door-preview.html)：检查手掌接触和进出门阶段。
- [入座检查](http://127.0.0.1:5173/tools/seating-preview.html)：检查首次及重复入座、椅子位置和姿态。

## 参考与致谢

### 地面雨景、积水与涟漪

**Faraz Shaikh — demo-2023-rain-puddle**

原作演示地址：[https://faraz-portfolio.github.io/demo-2023-rain-puddle/](https://faraz-portfolio.github.io/demo-2023-rain-puddle/)

`src/rain.js` 的邻域哈希、扩散环形波与有限差分法线算法移植自原项目的 `src/Floor/PuddleMaterial.tsx`，改写为 Three.js TSL，并接入本项目的积水遮罩、PBR 地面和街区反射。水花图集以及部分柏油贴图、HDR 和环境音也来自最初提供的 demo，具体文件对应关系见 [NOTICE.md](NOTICE.md)。雨景衍生代码保留 **GPL-3.0** 许可。

### 玻璃雨珠、滑落水痕与模糊

**Martijn Steinrucken / BigWings — Heartfelt（2017）**

原作地址：[https://www.shadertoy.com/view/ltffzl](https://www.shadertoy.com/view/ltffzl)

最初以本地 `rain-heart/rain-heart.html` 为移植输入。`src/heartfelt.js` 保留静止细珠、两层滑动水滴及水痕算法；`src/glass.js` 将其用于实际 3D 落地窗，以实时场景纹理实现折射和模糊，并加入人物坐稳后渐入、雨势联动及雨减弱后的存水消退。原作的音乐和背景图片没有用于本游戏。

Heartfelt 衍生模块沿用 **[CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/)**，其中包含非商业与相同方式共享条件。

`demo-2023-rain-puddle/` 和 `rain-heart/` 是最初移植时的参考目录，当前运行、构建和角色准备脚本均不依赖它们。需要的算法与资源已独立存入项目；文档中的原目录路径仅用于记录来源。

### 其他资源

| 资源 | 作者 / 来源 | 许可或记录 |
| --- | --- | --- |
| Alice Chan 校服人物模型 | yuna0x0 / edisonlee55：[发布页](https://yuna0x0.itch.io/alice-chan)、[仓库](https://github.com/yuna0x0/AliceChan) | CC BY-SA 4.0；修改说明见 NOTICE |
| Universal Animation Library | [Quaternius](https://quaternius.com/packs/universalanimationlibrary.html) | CC0 1.0；坐下、坐姿、起身及手型等 |
| 步行与跑步捕捉 | [CMU Motion Capture Database](http://mocap.cs.cmu.edu/)、[BVH 转换数据](https://github.com/una-dinosauria/cmu-mocap) | 使用 07_04、16_35；保留原数据使用说明 |
| 木桌、木地板、抹灰墙、砖墙 PBR 贴图 | [Poly Haven](https://polyhaven.com/) | CC0；具体贴图见 NOTICE |
| 咖啡馆挂画 | ImageGen 生成 | 生成提示词见 [ART_PROMPT.md](ART_PROMPT.md) |

CMU 数据致谢：**The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.**

## 当前范围与许可

当前重点是雨景、咖啡馆和人物漫游，没有任务系统、多人模式或便利店室内交互。步行和跑步来自真人捕捉，尚未进行专门的动漫少女动作精修；服装使用蒙皮与弹簧骨骼，雨珠为程序化水滴场，均不是完整布料或逐滴流体模拟。

游戏逻辑及雨景衍生代码采用 [GPL-3.0](LICENSE)。Heartfelt、人物、动画和素材保留各自许可，根目录 LICENSE 不会将所有资源变为同一种许可。完整来源、修改记录和第三方许可文本位置见 [NOTICE.md](NOTICE.md)。

**发布前需要解决的许可兼容问题**：Heartfelt 衍生代码的 CC BY-NC-SA 3.0 与 GPL-3.0 不兼容，分别记录许可不能使二者合并后的程序自动满足发布条件。当前版本不能视为已经完成许可兼容的 GPL-3.0 发行版。需要取得兼容授权，或用独立实现替换该衍生模块；商业使用还受到 Heartfelt 的非商业条件限制。兼容范围见 [Creative Commons 官方列表](https://creativecommons.org/compatible-licenses/)。来自原雨景 demo 的部分素材也仍需补齐逐项许可来源，详见 NOTICE。
