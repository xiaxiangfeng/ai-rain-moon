import * as THREE from 'three/webgpu';
import { Fn, If, uniform, vec2, vec3, float, texture, screenUV, positionWorld, mix, smoothstep } from 'three/tsl';
import { heartfeltDrops } from './heartfelt.js';
import { updateGlassWater } from './weather.js';

export function createRainGlass(glassMeshes, renderer) {
  const target = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  target.texture.generateMipmaps = true;
  const fog = uniform(0), damp = uniform(0), time = uniform(0), coverage = uniform(0);
  // Preserve the physical clear pane. A permanent, inset rain layer blends over
  // it without replacing materials or compiling a combined PBR/rain shader.
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, depthWrite: false, transparent: true });
  material.name = 'Heartfelt — real scene refraction, clear trails, mipmapped condensation';
  material.colorNode = Fn(() => {
    const result = vec3(0).toVar();
    If(coverage.greaterThan(0), () => {
      // Keep spacing independent of bead diameter. Scaling the whole field down
      // multiplies the population and turns fine droplets into glittering noise.
      const coord = vec2(positionWorld.x.add(9.8), positionWorld.y.sub(2.13)).div(3.0);
      const t = time.mul(.2);
      const size = float(.20);
      const drops = heartfeltDrops(coord, t, damp, size);
      const cx = heartfeltDrops(coord.add(vec2(.001, 0)), t, damp, size).x;
      const cy = heartfeltDrops(coord.add(vec2(0, .001)), t, damp, size).x;
      // screenUV uses a downward Y axis; the glass field's Y points upwards.
      const gradient = vec2(cx.sub(drops.x), drops.x.sub(cy));
      const refracted = screenUV.add(gradient.mul(.10)).clamp(.001, .999);
      const clear = smoothstep(.1, .2, drops.x).max(drops.y.clamp(0, 1));
      const maxBlur = fog.mul(5.5).add(damp.mul(.35));
      const focus = mix(maxBlur, damp.mul(.12), clear).max(0);
      // Original textureLod blur: water beads and runnels reveal a sharp refracted
      // view through the mist. No painted white rim or opaque droplet overlay.
      const wetColor = texture(target.texture, refracted).level(focus).rgb;
      result.assign(wetColor);
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
      time.value = water.time; damp.value = water.drops; fog.value = water.fog;
      coverage.value = inside ? water.coverage : 0;
    },
    capture(scene, camera) {
      const previousTarget = renderer.getRenderTarget();
      const visibility = glassMeshes.map(o => o.visible);
      glassMeshes.forEach(o => { o.visible = false; });
      try { renderer.setRenderTarget(target); renderer.render(scene, camera); }
      finally { renderer.setRenderTarget(previousTarget); glassMeshes.forEach((o, i) => { o.visible = visibility[i]; }); }
    },
    async prepare(scene, camera, scenePass, pipeline) {
      const position = camera.position.clone(), rotation = camera.quaternion.clone();
      const previousTarget = renderer.getRenderTarget();
      const visibility = glassMeshes.map(mesh => mesh.visible);
      const culling = [];
      if (renderer.backend.isWebGPUBackend) scene.traverse(object => { if (object.isMesh) culling.push([object, object.frustumCulled]); });
      const toneMapping = renderer.toneMapping, colorSpace = renderer.outputColorSpace;
      try {
        // Set up the actual postprocessing pass before compiling its variants.
        pipeline.render();
        renderer.initRenderTarget(target);
        camera.position.set(-10.4, 2.4, -5.4); camera.lookAt(-9.4, 1.8, -.5); camera.updateMatrixWorld();
        // The capture has its own attachment format and pipeline cache. Compile
        // every material there, including objects outside the loading camera.
        culling.forEach(([object]) => { object.frustumCulled = false; });
        glassMeshes.forEach(mesh => { mesh.visible = false; });
        renderer.setRenderTarget(target);
        await renderer.compileAsync(scene, camera);
        renderer.setRenderTarget(previousTarget);
        glassMeshes.forEach((mesh, i) => { mesh.visible = visibility[i]; });
        culling.forEach(([object, value]) => { object.frustumCulled = value; });
        this.capture(scene, camera); // Allocate depth attachments and generate mipmaps now.
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
    getFlowRate() { return water.flow; }
  };
}
