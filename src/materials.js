import * as THREE from 'three/webgpu';
import { texture, triplanarTexture, positionWorld, normalWorldGeometry, float, normalMap, vec2, color } from 'three/tsl';

const loader = new THREE.TextureLoader(), textures = new Map();
function map(name, channel) {
  const key = name + ':' + channel;
  if (!textures.has(key)) {
    const t = loader.load(`/assets/materials/${name}-${channel}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (channel === 'color') t.colorSpace = THREE.SRGBColorSpace;
    textures.set(key, t);
  }
  return textures.get(key);
}
export function pbr(name, tint = '#ffffff', scale = .7, roughness = .7) {
  const m = new THREE.MeshPhysicalNodeMaterial({ roughness, metalness: 0 });
  const sample = channel => triplanarTexture(texture(map(name, channel)), null, null, float(scale), positionWorld, normalWorldGeometry);
  // World coordinates preserve grain/brick scale across instanced, scaled walls.
  m.colorNode = sample('color').rgb.mul(color(tint));
  m.roughnessNode = sample('roughness').g.mul(roughness).clamp(.16, 1);
  m.normalNode = normalMap(sample('normal').rgb, vec2(.38));
  if (name.startsWith('wood')) { m.clearcoat = .22; m.clearcoatRoughness = .35; }
  return m;
}
