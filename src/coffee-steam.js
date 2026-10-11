import * as THREE from 'three/webgpu';
import { attribute, texture, uv } from 'three/tsl';

// A shared soft wisp texture and one instanced draw call for all hot cups.
// Normal alpha blending keeps the steam translucent without glowing like rain.
export function createCoffeeSteam(scene, sources) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
  const context = canvas.getContext('2d'), pixels = context.createImageData(96, 96);
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const px = (x / 95 - .5) * 2, py = (y / 95 - .5) * 2;
    const bend = .14 * Math.sin(py * 5) + .09 * Math.sin(py * 11);
    const edge = Math.max(0, 1 - (px - bend) ** 2 - py ** 2);
    const wisps = .62 + .23 * Math.sin(px * 12 + py * 8) + .15 * Math.sin(px * 21 - py * 13);
    const i = (y * 96 + x) * 4;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
    pixels.data[i + 3] = Math.round(255 * edge ** 2.5 * wisps);
  }
  context.putImageData(pixels, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  const perCup = 16, count = sources.length * perCup;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  geometry.setAttribute('steamAlpha', alpha);
  const material = new THREE.MeshBasicNodeMaterial({ color: '#e7e1d8', transparent: true, depthWrite: false, side: THREE.DoubleSide });
  material.opacityNode = texture(map, uv()).a.mul(attribute('steamAlpha', 'float'));
  material.toneMapped = false;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = 'Coffee steam — soft rising wisps'; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); alpha.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const particle = new THREE.Object3D(), roll = new THREE.Quaternion(), axis = new THREE.Vector3(0, 0, 1), offset = new THREE.Vector3();
  let time = 0;
  return {
    count,
    update(dt, camera) {
      time += dt;
      for (let i = 0; i < count; i++) {
        const source = sources[Math.floor(i / perCup)], seed = i * 2.39996;
        const duration = 4.2 + .8 * Math.sin(seed), age = (time / duration + (i % perCup) / perCup) % 1;
        const rise = age * (.40 + .05 * Math.sin(seed));
        const spread = .006 + age * age * .065;
        particle.position.copy(source).add(offset.set(
          Math.sin(seed + age * 5) * spread + Math.sin(time * .7 + seed) * age * .017,
          .018 + rise,
          Math.cos(seed + age * 4) * spread
        ));
        particle.quaternion.copy(camera.quaternion).multiply(roll.setFromAxisAngle(axis, Math.sin(seed + age * 3) * .45));
        particle.scale.set(.036 + age * .11, .065 + age * .16, 1);
        particle.updateMatrix(); mesh.setMatrixAt(i, particle.matrix);
        alpha.setX(i, .19 * Math.sin(Math.PI * age) ** 1.6);
      }
      mesh.instanceMatrix.needsUpdate = true; alpha.needsUpdate = true;
    },
    dispose() { scene.remove(mesh); geometry.dispose(); material.dispose(); map.dispose(); }
  };
}
