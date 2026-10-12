# Ametsuki · 雨月

[中文](README.md) | **English**

**Live demo:** [Play Rain Moon in your browser](https://home.annibao.top/ai-rain-moon/)

A browser-based 3D rainy-night walking game. Stroll along the street, jog as the rain starts, push open the café door, and sit beside a floor-to-ceiling window as raindrops slide across the gradually blurred glass.

The project uses Three.js `WebGPURenderer`, preferring WebGPU with a WebGL2 compatibility mode. The character is a rigged and skinned anime schoolgirl VRM model. Streets, buildings, and interior furniture use procedurally generated 3D geometry with PBR materials, environment lighting, and local lights.

## Features

- **Street exploration:** walk before the rain and jog in wet weather, using a keyboard, ground-click destinations, or a touch joystick.
- **Dynamic rain:** rain streaks at varying distances, ground splashes, footstep splashes, growing puddles, and expanding ripples. Rough asphalt remains visible between puddles that reflect street lighting.
- **Café interactions:** the character places her palm against the glass and walks forward while opening the door. She adjusts the window-side chair before walking around it and sitting down, and can stand up and leave.
- **Changing rain glass:** the window stays clear until the first completed sit. Fine beads accumulate and merge on contact; larger drops slide down and leave fading wet trails. Fog grows gradually, with clearer lenses and trails refracting the actual 3D scene.
- **Weather progression:** rain starts 28 seconds after exploration begins by default, then grows heavier. Standing up starts a gradual reduction in rainfall; retained water and fog on the glass clear more slowly.
- **Shops and interiors:** café equipment, pastry displays, cups, window-side seating, and coffee steam; convenience-store shelves, packaged products, refrigerated cabinets, a checkout, and a hot-food display.
- **Anime character:** a complete uniform, face and expressions, and spring-bone ponytail; motion-captured walking and running, sitting and standing animations, and relaxed fists while jogging.
- **Touch controls:** an independent joystick and camera drag, pinch zoom, contextual interaction buttons, and portrait/landscape layouts with safe-area support. Camera rotation also works while standing or sitting inside.

## Quick start

### Requirements

- Node.js **20.19+ in the 20.x line, or 22.12+**, matching Vite's requirement: `^20.19.0 || >=22.12.0`.
- npm and a modern browser supporting WebGPU or WebGL2.
- WebGPU requires a secure context: **HTTPS or localhost**.

### Local development

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/). The development port is fixed at 5173; stop any other service using it before starting this one.

To force WebGL2, open [compatibility mode](http://127.0.0.1:5173/?webgl).

### Build and deployment

```sh
npm run build
npm run preview
```

Build output is written to `dist/`; use the preview URL printed by the terminal. Deploy the complete contents of `dist/`, with its `index.html` as the entry point. Build files and runtime models, textures, and audio use relative deployment paths, supporting either a site root or a subdirectory without editing the bundled JavaScript.

For VS Code Live Server, open **`dist/index.html`** so the browser URL contains `/dist/`, or set the server root to `dist/`. The project-root `index.html` is the Vite source entry and requires `npm run dev`. Serving it directly with Live Server causes `Failed to resolve module specifier "three/webgpu"`, because a plain static server does not bundle npm dependencies. Serve the game over HTTP rather than opening it through `file://`.

### Try it on a phone

```sh
npm run dev -- --host 0.0.0.0
```

Connect the phone and computer to the same Wi-Fi network, then open the Network URL printed by Vite: `http://COMPUTER_LAN_IP:5173/`. On a phone, `127.0.0.1` refers to the phone itself and cannot access the computer's server.

A regular LAN HTTP preview uses WebGL2; WebGPU requires HTTPS. Touch layouts and input have been checked at simulated portrait and landscape browser sizes. Performance and browser compatibility still require testing on physical phones.

## Controls

The game interface currently uses Chinese labels. Relevant button labels are included below.

| Action | Desktop | Phone / touch |
| --- | --- | --- |
| Move | WASD / arrow keys, or click street ground | Left joystick; push lightly to walk slowly, or tap the ground |
| Rotate camera | Drag the scene | Drag outside the joystick; works alongside movement |
| Zoom | Mouse wheel | Pinch, or use the 「＋」「−」 buttons |
| Enter café | Press E near the door, or click 「去咖啡馆」 | Tap 「去咖啡馆」 or the contextual door button |
| Sit by the window | Press E near the seat, or click 「去窗边坐下」 | Tap 「去窗边坐下」 or the contextual seat button |
| Stand up | Press E, or click 「起身继续」 | Tap 「起身继续」 |
| Leave café | Press E near the door | Tap the contextual 「回街道」 button |
| Weather | Bottom 「雨前」「听雨」 buttons and top-right settings | Same as desktop |
| Ambient audio | Click 「环境音」 to enable | Same as desktop |

Settings control rainfall, window fog, and automatic weather progression. 「始终显示触屏操作」 forces touch controls to appear. Help and settings pause movement; pointer cancellation, loss of focus, or backgrounding releases movement input. Rain audio becomes quieter indoors.

## Technical implementation

| Component | Implementation |
| --- | --- |
| Rendering | Three.js **0.186.1**, `WebGPURenderer`, TSL / NodeMaterial, Bloom |
| Development and build | Vite **8.3.4**, native ES modules |
| Character | `@pixiv/three-vrm` **3.5.5**, skinned VRM model, MToon shading, spring bones |
| Animation | CMU motion capture and Quaternius clips, retargeted to the character and blended through `AnimationMixer` |
| Doors and seating | Continuous interaction paths, two-bone arm IK, palm contact constraints, and staged seating |
| Environment | Procedural 3D geometry, instanced static parts, PBR textures, and HDR environment lighting |
| Ground puddles | Noise-based wetness masks, ring-wave normals, roughness control, and planar reflections |
| Rain glass | Independent stateful droplets, volume-preserving merges, gravity-driven sliding, GPU cap-slope atlas, live scene refraction and mipmap blur |
| Coffee steam | Instanced transparent particles that rise, drift, and fade |
| Input | Keyboard, pointer, independent touch joystick, pinch zoom, and contextual buttons |

Custom materials use TSL, which compiles to WGSL for WebGPU and GLSL for WebGL2. The rain layer and clear glass are created and warmed up during loading. Sitting starts a roughly six-second reveal through parameters, avoiding material creation at that moment. Background capture starts upon entering the café; the character and indoor furniture are unaffected by the outdoor blur. Loading also renders exterior, doorway and interior views along both entry and exit routes, warming background capture and its nested reflection before the first doorway crossing.

The droplet atlas follows the currently visible window region, preserving close-up detail without enlarging the drops. World positions and motion state remain consistent as the camera moves. Cap normals also drive subtle Fresnel environment reflection and dispersion. Window backgrounds are captured in linear color space to avoid brightness changes from double tone mapping.

To limit rendering cost, device pixel ratio is capped at 1.5. Ground reflections use 60% of the main render resolution; the glass background uses 85% and updates every other frame. Actual performance depends on the device, browser, image size, and graphics backend.

The new window simulates up to 6500 drops and 10000 trail segments on desktop (4000 / 6000 on narrow screens) on the CPU at a fixed 60 Hz. A spatial grid finds contacts and combines water volume. Surface pinning holds small beads in place; gravity moves larger drops along gently curved paths guided by surface channels, inertia and existing wet tracks. Sliding cores release water into a surface film, shrink during movement and fade out before their finite lifetime ends. Merging never resets a sliding core's age. Compact heads leave short films that quickly contract and fade, with residual fine beads clearing afterward. Both population limits and arrival rates increase with rainfall, so light rain cannot reach downpour density. One instanced GPU draw generates a half-float slope, thickness and local-clearance atlas, used to refract the scene in the current camera direction. Atlas width is 3072 pixels on desktop and 1536 on narrow screens; height follows the physical window aspect ratio. As rainfall decreases, water continues draining and evaporating while fog clears more slowly. This is a physically inspired surface-particle model, not a GPU fluid solver. WebGPU provides rendering capacity; realism still depends on simulation, sampling and device performance.

### Where is the character model?

The game loads `public/assets/character/ametsuki.vrm`, with separate animation data in `motions.json` alongside it. VRM extends glTF / GLB for humanoid characters. Meshes, skinning, bones, and textures are stored in the model file, rather than in JavaScript source. Builds copy it to `dist/assets/character/ametsuki.vrm`.

The character is adapted from the Alice Chan uniform model. It retains the original body, face, clothing, and expressions, with hair reshaped into a brown high ponytail and adjusted hair skinning and bones. The environment and furniture are procedural; the character uses a separate model asset.

## Project structure

```text
src/
  assets.js           Resolve runtime assets from the deployment directory
  main.js             Main loop, movement, interactions, weather, audio, UI
  world.js            Streets, buildings, café, store, furniture, lighting
  character.js        VRM loading, animation blending, poses, contact IK
  rain.js             Rain streaks, splashes, puddles, ripples, reflections
  glass-droplets.js   Independent droplets, coalescence, pinning and wet tracks
  glass-field.js      GPU instanced cap slopes and local-clearance atlas
  glass.js            Rain-glass refraction, scene capture, blur, warm-up
  weather.js          Weather progression, retained water, window fog
  door.js             Continuous door-opening and crossing paths
  seating.js          Chair adjustment, approach, and seating paths
  coffee-steam.js     Coffee steam particles
  input.js            Touch joystick, pointer, and zoom gestures
  camera.js           Camera orbit and indoor boundaries
  materials.js        World-space triplanar PBR materials
public/assets/        Runtime models, animations, textures, HDR, audio, art
art-source/           Original character and motion assets for regeneration
scripts/              Character preparation and validation scripts
tools/                Development-only character and interaction previews
NOTICE.md             Sources, modifications, and individual asset licenses
LICENSE               Full GPL-3.0 license text
```

### Asset preparation and checks

Runtime character assets are included. Normal development and builds do not require regeneration. After editing the original character or animation sources, run:

```sh
npm run assets:character
```

This reads `art-source/` and rewrites the generated character model and motion data. Available validation commands:

```sh
npm run check:character
npm run check:input
npm run check:door
npm run check:camera
npm run check:seating
npm run check:weather
npm run check:glass
```

With the development server running, the following previews are also available. They are development tools; the default production build includes only the game entry point.

- [Character preview](http://127.0.0.1:5173/tools/character-preview.html): inspect the face, view angles, walking, running, and seated poses.
- [Door preview](http://127.0.0.1:5173/tools/door-preview.html): inspect palm contact and entry/exit stages.
- [Seating preview](http://127.0.0.1:5173/tools/seating-preview.html): inspect first and repeated seating, chair placement, and poses.
- [Rain-glass preview](http://127.0.0.1:5173/tools/glass-preview.html): inspect clear glass, gradual activation, accumulated rain, close-up droplets and easing rain; append `?webgl` to test compatibility mode or `?lifecycle` to inspect the same drops shrinking and disappearing at 0.3 / 1.8 / 2.8 / 4.8 seconds.

## References and acknowledgements

### Ground rain, puddles, and ripples

**Faraz Shaikh — demo-2023-rain-puddle**

Original demo: [https://faraz-portfolio.github.io/demo-2023-rain-puddle/](https://faraz-portfolio.github.io/demo-2023-rain-puddle/)

The neighbor hashing, expanding ring waves, and finite-difference normal algorithm in `src/rain.js` are adapted from the original project's `src/Floor/PuddleMaterial.tsx`. They were rewritten in Three.js TSL and connected to this game's puddle masks, PBR ground, and street reflections. The splash atlas and some asphalt textures, HDR, and ambient audio also come from the initially supplied demo; file-by-file provenance is recorded in [NOTICE.md](NOTICE.md). Derived rain code retains **GPL-3.0**.

### Glass droplets, sliding trails, and blur

**Martijn Steinrucken / BigWings — Heartfelt (2017)**

Original shader: [https://www.shadertoy.com/view/ltffzl](https://www.shadertoy.com/view/ltffzl)

This work was the initial **visual reference** for the rain window. On 2026-10-12, the former `src/heartfelt.js` port and its calls were removed and replaced with independently written stateful particles and cap-slope rendering. The new code does not reuse the original static-drop functions, periodic sliding layers or hash expressions and is licensed **GPL-3.0-only**. Gradual activation after sitting, live scene refraction, locally clear trails and weather coupling remain. The original music and background imagery are not used in this game.

The original Heartfelt code remains **[CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/)**. This rewrite does not change the original work's license or that of historical versions.

`demo-2023-rain-puddle/` and `rain-heart/` were reference directories used during the initial port. The current runtime, build, and character preparation scripts do not depend on them. Required algorithms and assets are stored independently in this project; references to those original paths are provenance records.

### Other resources

| Resource | Author / source | License or record |
| --- | --- | --- |
| Alice Chan uniform character | yuna0x0 / edisonlee55: [release page](https://yuna0x0.itch.io/alice-chan), [repository](https://github.com/yuna0x0/AliceChan) | CC BY-SA 4.0; modifications documented in NOTICE |
| Universal Animation Library | [Quaternius](https://quaternius.com/packs/universalanimationlibrary.html) | CC0 1.0; sitting, standing, hand poses, and other clips |
| Walking and running capture | [CMU Motion Capture Database](http://mocap.cs.cmu.edu/), [BVH conversion](https://github.com/una-dinosauria/cmu-mocap) | Clips 07_04 and 16_35; original usage terms retained |
| Wood table, wood floor, plaster, and brick PBR textures | [Poly Haven](https://polyhaven.com/) | CC0; specific assets listed in NOTICE |
| Café wall painting | Generated with ImageGen | Generation prompt in [ART_PROMPT.md](ART_PROMPT.md) |

CMU acknowledgement: **The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.**

## Current scope and licensing

The project focuses on rain, café interactions, and character exploration. It has no quest system, multiplayer, or interactive convenience-store interior. Walking and running use human motion capture and have not received dedicated anime-girl animation polishing. Clothing uses skinning and spring bones, and rain glass uses stateful surface particles; neither is a full cloth or fluid simulation.

Game logic, the independent rain-window implementation and derived rain code continue to use [GPL-3.0](LICENSE), with the package identified as `GPL-3.0-only`. The character, animations and assets retain their individual licenses. The root LICENSE does not place every resource under a single license. See [NOTICE.en.md](NOTICE.en.md) / [中文说明](NOTICE.md) for provenance, modifications and third-party license texts.

Current source and build output no longer contain the Heartfelt-derived module. Historical versions remain subject to that module's terms; use the complete rewritten source and a fresh build when distributing this version. Individual license provenance for some assets from the original rain demo remains to be established, as recorded in NOTICE. This code rewrite does not complete the rights review for those assets.
