# Sources and licenses

[中文](NOTICE.md) | **English**

Original game logic, the independent rain-glass implementation and rain code derived from the Faraz demo continue to use GNU GPL v3. The package identifies the project code as `GPL-3.0-only`; the complete text is in [LICENSE](LICENSE). Third-party models, motion data, assets and dependencies retain their own licenses. The root LICENSE does not relicense them. These provenance records do not imply that every third-party asset has received a complete rights review.

## Ground and rain

Original work: **Faraz Shaikh — demo-2023-rain-puddle**, [demo](https://faraz-portfolio.github.io/demo-2023-rain-puddle/).

The neighbor hashing, ring-wave and finite-difference normal algorithms in `src/rain.js` were directly adapted from `demo-2023-rain-puddle/src/Floor/PuddleMaterial.tsx`, by Faraz Shaikh, under GPL v3. They were ported to Three.js TSL and integrated with physical materials, HDR lighting and street planar reflections. The original project was not modified.

| Current asset | Original file supplied by the user |
| --- | --- |
| `asphalt.jpg` | `demo-2023-rain-puddle/public/road/aerial_asphalt_01_diff_2k.jpg` |
| `asphalt-normal.jpg` | `aerial_asphalt_01_nor_gl_2k.jpg` in the same directory |
| `asphalt-roughness.jpg` | `aerial_asphalt_01_rough_2k.jpg` in the same directory |
| `city.hdr` | `demo-2023-rain-puddle/public/shanghai_bund_2k.hdr` |
| `splash.png` | `demo-2023-rain-puddle/public/Splash.png` |
| `rain.mp3` | `demo-2023-rain-puddle/public/sounds/light-rain-109591.mp3` |
| `night.mp3` | `night-ambience-17064.mp3` in the same sounds directory |

These assets were copied to `public/assets/` and do not depend on the original demo directory. The supplied demo did not include individual license records for every asset. This document records their origin without claiming additional rights over them.

## Glass

On 2026-10-12, the rain-glass implementation was independently rewritten, removing the former `src/heartfelt.js` and its calls:

- `src/glass-droplets.js`: fixed-step surface particles, spatial-grid contact detection, volume-preserving coalescence, surface pinning, gravity-driven sliding, wet-path guidance, drainage and evaporation.
- `src/glass-field.js`: instanced cap fields rendering analytic slopes, water thickness and local fog clearance into a half-float texture focused on the visible window region.
- `src/glass.js`: camera-oriented live-scene refraction, Fresnel environment reflection, subtle dispersion, clearer wet trails, mipmap fog, gradual activation after sitting and renderer warm-up.

These new implementations use **GPL-3.0-only**. They do not retain the original periodic droplet fields, static-drop functions, sliding layers or hash expressions. This is a physically inspired bounded surface-particle model, not a complete fluid solver.

Historical and visual reference: **Heartfelt — Martijn Steinrucken / BigWings, 2017**, [Shadertoy](https://www.shadertoy.com/view/ltffzl). Earlier versions ported the user-supplied `rain-heart/rain-heart.html`, whose original license is [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/), incompatible with GPL v3 (see the [official Creative Commons compatibility list](https://creativecommons.org/compatible-licenses/)). Current source and freshly generated build output no longer contain that derived module. Historical versions' licenses are unchanged. The author and link remain as visual-reference and historical credits. The original music and background imagery are not used in this game.

`demo-2023-rain-puddle/` and `rain-heart/` were initial reference directories. Runtime, build and character-preparation scripts do not depend on them. Original paths are retained as provenance records.

## Character and animation

The active model, `public/assets/character/ametsuki.vrm`, is adapted from **Alice Chan (Uniform ver) v1.0.2**, by **yuna0x0 / edisonlee55**. The author's [release page](https://yuna0x0.itch.io/alice-chan) and [repository](https://github.com/yuna0x0/AliceChan) publish it under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The author's `Alice Chan (Uniform ver) v1.0.4.zip` was downloaded on 2026-10-11; its VRM reports v1.0.2. Original VRM metadata is retained. Full license details are in `public/assets/character/LICENSE-Alice.md`.

Modifications gather the original long-hair mesh into a ponytail while retaining UVs and textures, adjust strand normals, skinning weights, bones and inverse bind matrices, and share one spring-bone chain. At runtime, blonde hair is tinted brown, a hair tie is added and MToon lighting is adjusted. The original author supplied the complete uniform, body, face and expressions; hard geometry does not replace the clothing. The modified model remains **CC BY-SA 4.0**, separate from GPL code, and is not claimed as original or CC0. The source is `art-source/alice-uniform.vrm`; `scripts/prepare-character.mjs` reproduces the modifications.

`art-source/UAL1_Standard.glb` comes from **Quaternius — Universal Animation Library [Standard]**, [official release](https://quaternius.com/packs/universalanimationlibrary.html). The free package downloaded on 2026-10-11 explicitly licenses its content under **CC0 1.0 Universal**. The license is retained in `public/assets/character/LICENSE-Animations.txt`. Idle, sitting-down, seated and standing-up clips in `motions.json` were retargeted and their fingers relaxed; this motion data remains CC0. Relaxed and jogging-fist `handPoses` come from the same package's Idle_Loop / Jog_Fwd_Loop and remain CC0 when blended into walking and running.

Walking and jogging use human motion capture **07_04 (walking)** and **16_35 (running)** from the **Carnegie Mellon University Graphics Lab Motion Capture Database**. Bruce Hahne's BVH conversions were obtained on 2026-10-11 from [una-dinosauria/cmu-mocap](https://github.com/una-dinosauria/cmu-mocap), retained as `art-source/cmu-07_04.bvh` and `art-source/cmu-16_35.bvh`. The converter's [READMEFIRST](https://github.com/una-dinosauria/cmu-mocap/blob/master/READMEFIRST.txt) states that CMU data can be used for research and commercial purposes and that conversion adds no restrictions. Full terms are retained in `public/assets/character/LICENSE-CMU.txt`; this data is not relabeled CC0. `scripts/cmu-motion.mjs` extracts loops, retains skeletal and pelvis movement, removes horizontal root motion and fixed orientation, adapts the skeleton and corrects loop boundaries and foot contacts.

Required acknowledgement: **The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.**

Door-phase trajectories, two-bone arm IK and palm position/orientation constraints are implemented by this project, without a third-party door-opening animation clip.

The inactive prototype `art-source/previous-prototype.vrm` remains retained but is not loaded by the game. It comes from the official pixiv [three-vrm example](https://github.com/pixiv/three-vrm/blob/dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm), named `VRM1_Constraint_Twist_Sample` v1.0.1, © 2022 pixiv Inc., under the embedded [VRM Public License 1.0](https://vrm.dev/licenses/1.0/). The `@pixiv/three-vrm` integration library is MIT licensed.

## Building and interior materials

Color, OpenGL normal and roughness maps in `public/assets/materials/` come from Poly Haven under its [CC0 license](https://polyhaven.com/license):

- [Wood Table 001](https://polyhaven.com/a/wood_table_001)
- [Wood Floor](https://polyhaven.com/a/wood_floor)
- [Plastered Wall 04](https://polyhaven.com/a/plastered_wall_04)
- [Brick Wall 003](https://polyhaven.com/a/brick_wall_003)

Buildings, furniture, equipment and street props use 3D geometry created by this project. `street-painting.png` is an ImageGen-generated café wall painting; its prompt is in [ART_PROMPT.md](ART_PROMPT.md). It is not used as the 3D scene background.

Three.js and Vite are MIT licensed, with their LICENSE files retained in the dependency packages.
