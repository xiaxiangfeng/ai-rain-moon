// SPDX-License-Identifier: GPL-3.0-only
import * as THREE from 'three/webgpu';
import { Fn, uv, attribute, vec2, vec4, float, smoothstep, fwidth, mix } from 'three/tsl';

// Render cap slopes directly, rather than differentiating a periodic noise
// field. Signed RG slopes, B water height in meters, A local fog clearance.
export function createGlassField(simulation, renderer) {
  const { width, height } = simulation;
  const mobile = Math.min(globalThis.innerWidth || 1280, globalThis.innerHeight || 720) < 600;
  const resolution = mobile ? 1536 : 3072;
  const target = new THREE.RenderTarget(resolution, Math.round(resolution * height / width), {
    type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false
  });
  target.texture.name = 'Surface water: signed slopes, height, clearance';
  target.texture.colorSpace = THREE.NoColorSpace;
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendEquation: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation, toneMapped: false });
  material.fog = false;
  material.outputNode = Fn(() => {
    const p = uv().mul(2).sub(1);
    const shape = attribute('waterShape', 'vec4'), rotation = attribute('waterRotation', 'vec2');
    const profile = attribute('waterProfile', 'vec2');
    // Thin films use a capsule with a cylindrical middle. An elliptical lens
    // per segment made the old trail alternate dark/light like a dashed wire.
    const capY = p.y.abs().sub(float(1).sub(profile.y)).max(0).div(profile.y.max(.01)).mul(p.y.sign());
    const sample = vec2(p.x, mix(p.y, capY, profile.x)), q = sample.dot(sample);
    const edge = float(1).sub(smoothstep(float(1).sub(fwidth(q).max(.035)), 1, q));
    const root = float(1).sub(q.mul(.82)).max(.18).sqrt();
    const denominator = float(1 - Math.sqrt(.18));
    const slopeScale = vec2(shape.x, mix(shape.y, shape.x, profile.x));
    const localSlope = sample.mul(-.82).div(root.mul(denominator)).mul(slopeScale).mul(edge);
    const slope = vec2(localSlope.x.mul(rotation.x).sub(localSlope.y.mul(rotation.y)),
      localSlope.x.mul(rotation.y).add(localSlope.y.mul(rotation.x)));
    const cap = root.sub(Math.sqrt(.18)).div(denominator).max(0).mul(shape.z).mul(edge);
    // outputNode bypasses the normal color material's nonnegative clamp. This
    // texture is geometric data and must never be tone mapped or color encoded.
    return vec4(slope, cap, edge.mul(shape.w));
  })();
  const geometry = new THREE.PlaneGeometry(2, 2);
  const max = simulation.capacity + simulation.trailCapacity;
  const shapes = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const rotations = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
  const profiles = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('waterShape', shapes); geometry.setAttribute('waterRotation', rotations); geometry.setAttribute('waterProfile', profiles);
  const mesh = new THREE.InstancedMesh(geometry, material, max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0;
  const scene = new THREE.Scene(); scene.add(mesh);
  const camera = new THREE.OrthographicCamera(0, width, height, 0, .01, 10);
  camera.position.z = 1;
  const dummy = new THREE.Object3D(), clearColor = new THREE.Color();
  const point = new THREE.Vector3(), direction = new THREE.Vector3();
  const view = { minX: 0, minY: 0, width, height };

  function render() {
    const previous = renderer.getRenderTarget(), alpha = renderer.getClearAlpha();
    renderer.getClearColor(clearColor);
    const tone = renderer.toneMapping, colorSpace = renderer.outputColorSpace;
    try {
      renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.ColorManagement.workingColorSpace;
      renderer.setRenderTarget(target); renderer.setClearColor(0, 0); renderer.render(scene, camera);
    } finally {
      renderer.setRenderTarget(previous); renderer.setClearColor(clearColor, alpha);
      renderer.toneMapping = tone; renderer.outputColorSpace = colorSpace;
    }
  }
  return {
    target, view,
    setView(viewCamera, planeZ, originX, originY) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, valid = true;
      viewCamera.updateMatrixWorld();
      for (const x of [-1, 1]) for (const y of [-1, 1]) {
        point.set(x, y, .5).unproject(viewCamera); direction.copy(point).sub(viewCamera.position).normalize();
        const distance = (planeZ - viewCamera.position.z) / direction.z;
        if (!(distance > 0 && Number.isFinite(distance))) { valid = false; break; }
        point.copy(viewCamera.position).addScaledVector(direction, distance);
        minX = Math.min(minX, point.x - originX); maxX = Math.max(maxX, point.x - originX);
        minY = Math.min(minY, point.y - originY); maxY = Math.max(maxY, point.y - originY);
      }
      // A margin avoids clamping samples at the edge during camera movement.
      minX = Math.max(0, minX - .12); maxX = Math.min(width, maxX + .12);
      minY = Math.max(0, minY - .12); maxY = Math.min(height, maxY + .12);
      if (!valid || maxX - minX < .1 || maxY - minY < .1) { minX = 0; minY = 0; maxX = width; maxY = height; }
      Object.assign(view, { minX, minY, width: maxX - minX, height: maxY - minY });
      camera.left = minX; camera.right = maxX; camera.bottom = minY; camera.top = maxY; camera.updateProjectionMatrix();
    },
    update() {
      let i = 0;
      function splat(x, y, rx, ry, rotation, capHeight, strength, ribbon = false) {
        dummy.position.set(x, height - y, 0); dummy.scale.set(rx, ry, 1); dummy.rotation.z = rotation; dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        shapes.setXYZW(i, capHeight / rx, capHeight / ry, capHeight, strength);
        rotations.setXY(i, Math.cos(rotation), Math.sin(rotation)); profiles.setXY(i, ribbon ? 1 : 0, Math.min(1, rx / ry)); i++;
      }
      // Trails first, then bead caps; addition preserves thin residual water and
      // stronger lenses where moving droplets overlap their own paths.
      for (const t of simulation.trails) if (t.alive) {
        const fade = (1 - t.age / t.lifetime) ** 2.5, radius = t.radius * (.35 + .65 * Math.sqrt(fade));
        splat(t.x, t.y, radius, t.length / 2 + radius, Math.atan2(-t.dx, -t.dy), t.thickness * fade, t.clarity * fade, true);
      }
      for (const d of simulation.drops) if (d.alive) {
        const strength = d.visibility, stretch = Math.min(.10, d.vy * .35), visualRadius = d.radius * Math.sqrt(Math.max(.01, strength));
        const rx = visualRadius * (1 - stretch * .12) * (1 + d.wobble), ry = visualRadius * (1 + stretch);
        splat(d.x, d.y, rx, ry, d.vy > .006 ? Math.atan2(d.vx, d.vy) * .5 : 0, visualRadius * .34 * strength, strength);
      }
      mesh.count = i; mesh.instanceMatrix.needsUpdate = true; shapes.needsUpdate = true; rotations.needsUpdate = true; profiles.needsUpdate = true;
      render();
    },
    async prepare() {
      renderer.initRenderTarget(target);
      // Compile the actual float-attachment pipeline, not a default-screen
      // variant. Empty values keep the prewarm image dry.
      dummy.scale.set(.01, .01, 1); dummy.updateMatrix(); mesh.setMatrixAt(0, dummy.matrix); mesh.count = 1;
      rotations.setXY(0, 1, 0); rotations.needsUpdate = true;
      const previous = renderer.getRenderTarget();
      try { renderer.setRenderTarget(target); await renderer.compileAsync(scene, camera); }
      finally { renderer.setRenderTarget(previous); }
      render(); mesh.count = 0; render();
    },
    dispose() { target.dispose(); mesh.dispose(); geometry.dispose(); material.dispose(); }
  };
}
