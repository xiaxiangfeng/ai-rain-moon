// SPDX-License-Identifier: GPL-3.0-only
import * as THREE from 'three/webgpu';
import { Fn, If, uniform, vec2, vec3, vec4, texture, screenUV, positionWorld, cameraViewMatrix, cameraPosition, mix, smoothstep, pmremTexture, reflect, float } from 'three/tsl';
import { createGlassDroplets } from './glass-droplets.js';
import { createGlassField } from './glass-field.js';
import { updateGlassWater } from './weather.js';

export function createRainGlass(glassMeshes, renderer, environment = null, dropletOptions = {}) {
  const target = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  target.texture.generateMipmaps = true;
  const bounds = new THREE.Box3();
  glassMeshes.forEach(mesh => { mesh.updateWorldMatrix(true, false); bounds.expandByObject(mesh); });
  const size = bounds.getSize(new THREE.Vector3());
  const mobile = Math.min(globalThis.innerWidth || 1280, globalThis.innerHeight || 720) < 600;
  const simulation = createGlassDroplets({ width: size.x, height: size.y, capacity: mobile ? 4000 : 6500, trailCapacity: mobile ? 6000 : 10000, ...dropletOptions });
  const field = createGlassField(simulation, renderer);
  const fog = uniform(0), damp = uniform(0), coverage = uniform(0);
  const atlasOrigin = uniform(new THREE.Vector2(bounds.min.x, bounds.min.y)), atlasSize = uniform(new THREE.Vector2(size.x, size.y));
  // Preserve the physical clear pane. A permanent, inset rain layer blends over
  // it without replacing materials or compiling a combined PBR/rain shader.
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, depthWrite: false, transparent: true });
  material.name = 'Stateful surface water — cap refraction and gradual condensation';
  material.colorNode = Fn(() => {
    const result = vec3(0).toVar();
    If(coverage.greaterThan(0), () => {
      // Render-target sampling uses a top-left origin on both backends (TSL
      // normalizes WebGL's orientation). World-space glass Y points upwards.
      const coord = positionWorld.xy.sub(atlasOrigin).div(atlasSize).flipY();
      const surface = texture(field.target.texture, coord);
      // Project the world-space cap slope into the current camera. Refraction
      // stays aligned with the glass when orbiting indoors, including oblique views.
      const slope = cameraViewMatrix.mul(vec4(surface.rg.clamp(-2, 2), 0, 0)).xy;
      const offset = vec2(slope.x, slope.y.negate()).mul(.018);
      const refracted = screenUV.add(offset).clamp(.002, .998);
      const clear = surface.a.clamp(0, 1);
      const focus = mix(fog.mul(8).add(damp.mul(.25)), .75, clear).max(0);
      // Small spectral separation reads as a water lens, without painted rims.
      const red = texture(target.texture, refracted.add(offset.mul(.009)).clamp(.002, .998)).level(focus).r;
      const green = texture(target.texture, refracted).level(focus).g;
      const blue = texture(target.texture, refracted.sub(offset.mul(.009)).clamp(.002, .998)).level(focus).b;
      const transmitted = vec3(red, green, blue);
      if (environment) {
        const normal = vec3(surface.r.negate(), surface.g.negate(), -1).normalize();
        const view = cameraPosition.sub(positionWorld).normalize();
        const cosine = normal.dot(view).abs().clamp(0, 1);
        const fresnel = float(1).sub(cosine).pow(5).mul(.98).add(.02).min(.26);
        const reflected = pmremTexture(environment, reflect(view.negate(), normal), float(.14)).rgb;
        const waterMask = smoothstep(.00004, .0004, surface.b);
        result.assign(mix(transmitted, reflected.mul(.3), fresnel.mul(waterMask)));
      } else result.assign(transmitted);
    });
    return result;
  })();
  material.opacityNode = coverage; material.fog = false;
  glassMeshes.forEach(mesh => {
    const layer = new THREE.Mesh(mesh.geometry, material);
    // Both surfaces disable depth writes; the 2 mm inset also keeps transparent
    // sorting stable from indoors without coplanar depth flicker.
    layer.position.z = -.002; layer.name = 'Rain layer — smooth reveal'; mesh.add(layer);
  });
  const water = { time: 0, drops: 0, fog: 0, flow: .45 };
  let prepared = false;
  return {
    target,
    resize(w, h) { target.setSize(Math.max(1, Math.round(w * .85)), Math.max(1, Math.round(h * .85))); },
    update(dt, rain, fogPreference, inside, activated = false) {
      updateGlassWater(water, dt, rain, fogPreference, activated);
      simulation.update(dt, water.drops, activated);
      damp.value = water.drops; fog.value = water.fog;
      coverage.value = inside ? water.coverage : 0;
    },
    renderWater(camera) {
      if (coverage.value <= 0) return;
      field.setView(camera, bounds.min.z, bounds.min.x, bounds.min.y);
      atlasOrigin.value.set(bounds.min.x + field.view.minX, bounds.min.y + field.view.minY);
      atlasSize.value.set(field.view.width, field.view.height);
      field.update();
    },
    capture(scene, camera) {
      const previousTarget = renderer.getRenderTarget();
      const toneMapping = renderer.toneMapping, colorSpace = renderer.outputColorSpace;
      const visibility = glassMeshes.map(o => o.visible);
      glassMeshes.forEach(o => { o.visible = false; });
      try {
        renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.ColorManagement.workingColorSpace;
        renderer.setRenderTarget(target); renderer.render(scene, camera);
      } finally {
        renderer.setRenderTarget(previousTarget); renderer.toneMapping = toneMapping; renderer.outputColorSpace = colorSpace;
        glassMeshes.forEach((o, i) => { o.visible = visibility[i]; });
      }
    },
    async prepare(scene, camera, scenePass, pipeline, onProgress = () => {}) {
      const position = camera.position.clone(), rotation = camera.quaternion.clone();
      const previousTarget = renderer.getRenderTarget();
      const visibility = glassMeshes.map(mesh => mesh.visible);
      const culling = [];
      if (renderer.backend.isWebGPUBackend) scene.traverse(object => { if (object.isMesh) culling.push([object, object.frustumCulled]); });
      const toneMapping = renderer.toneMapping, colorSpace = renderer.outputColorSpace;
      try {
        onProgress('准备水滴纹理…');
        await field.prepare();
        onProgress('准备背景场景…');
        // Set up the actual postprocessing pass before compiling its variants.
        pipeline.render();
        renderer.initRenderTarget(target);
        camera.position.set(-10.4, 2.4, -5.4); camera.lookAt(-9.4, 1.8, -.5); camera.updateMatrixWorld();
        // The capture has its own attachment format and pipeline cache. Compile
        // every material there, including objects outside the loading camera.
        culling.forEach(([object]) => { object.frustumCulled = false; });
        glassMeshes.forEach(mesh => { mesh.visible = false; });
        renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.ColorManagement.workingColorSpace;
        renderer.setRenderTarget(target);
        await renderer.compileAsync(scene, camera);
        renderer.setRenderTarget(previousTarget);
        glassMeshes.forEach((mesh, i) => { mesh.visible = visibility[i]; });
        culling.forEach(([object, value]) => { object.frustumCulled = value; });
        this.capture(scene, camera); // Allocate depth attachments and generate mipmaps now.
        onProgress('预热雨窗光学材质…');
        // ScenePass renders with linear color and no tone mapping, unlike a
        // standalone compileAsync(scene, camera) against the default target.
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.outputColorSpace = THREE.ColorManagement.workingColorSpace;
        culling.forEach(([object]) => { object.frustumCulled = false; });
        await scenePass.compileAsync(renderer);
        renderer.toneMapping = toneMapping; renderer.outputColorSpace = colorSpace;
        culling.forEach(([object, value]) => { object.frustumCulled = value; });
        coverage.value = 1; pipeline.render();
        prepared = true;
        onProgress('雨窗已准备完成');
      } finally {
        renderer.setRenderTarget(previousTarget);
        renderer.toneMapping = toneMapping; renderer.outputColorSpace = colorSpace;
        glassMeshes.forEach((mesh, i) => { mesh.visible = visibility[i]; });
        culling.forEach(([object, value]) => { object.frustumCulled = value; });
        coverage.value = 0;
        camera.position.copy(position); camera.quaternion.copy(rotation); camera.updateMatrixWorld();
      }
    },
    getPrepared() { return prepared; },
    getCoverage() { return coverage.value; },
    getFog() { return fog.value; },
    getDropAmount() { return damp.value; },
    getFlowRate() { return water.flow; },
    // Developer probes use the actual model and optics, with rainfall spawning
    // disabled through dropletOptions. Generation guards distinguish reused slots.
    clearDrops() { simulation.reset(); field.update(); },
    emitNormalizedDrop(x, y, options) {
      const index = simulation.addDrop({ x: x * size.x, y: y * size.y, ...options });
      return index < 0 ? null : { index, generation: simulation.drops[index].generation };
    },
    getDropState(handle) {
      const d = handle && simulation.drops[handle.index];
      return d?.alive && d.generation === handle.generation ? { radius: d.radius, visibility: d.visibility, y: d.y, slideAge: d.slideAge, slideLife: d.slideLife } : null;
    },
    getStats() { return { ...simulation.getStats(), fieldWidth: field.target.width, fieldHeight: field.target.height,
      sampledWidth: field.view.width, sampledHeight: field.view.height }; },
    async inspectField() {
      const pixels = await renderer.readRenderTargetPixelsAsync(field.target, 0, 0, field.target.width, field.target.height);
      let negative = 0, positive = 0, covered = 0, maxHeight = 0, maxClear = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const slope = THREE.DataUtils.fromHalfFloat(pixels[i]), height = THREE.DataUtils.fromHalfFloat(pixels[i + 2]), clear = THREE.DataUtils.fromHalfFloat(pixels[i + 3]);
        if (slope < -.001) negative++; if (slope > .001) positive++;
        if (clear > .1) covered++; maxHeight = Math.max(maxHeight, height); maxClear = Math.max(maxClear, clear);
      }
      return { negative, positive, covered, maxHeight, maxClear };
    },
    reset() {
      Object.assign(water, { time: 0, drops: 0, fog: 0, flow: .45, coverage: 0, revealAge: 0 });
      simulation.reset(); field.update(); fog.value = 0; damp.value = 0; coverage.value = 0;
    }
  };
}
