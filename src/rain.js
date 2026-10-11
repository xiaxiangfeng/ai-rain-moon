import * as THREE from 'three/webgpu';
import { Fn, uniform, attribute, vec2, vec3, float, floor, fract, dot, sin, length, normalize, smoothstep, mix, max, dFdx, dFdy, positionWorld, cameraPosition, normalWorld, normalMap, texture, uv, reflector, screenUV, mx_noise_float } from 'three/tsl';

// Faraz Shaikh / demo-2023-rain-puddle, GPL-3.0.
// The original finite-difference ring-wave derivative, translated to TSL.
// It changes the physical surface normal rather than drawing circles on top.
export function createPuddles(scene, world) {
  const time = uniform(0), wetness = uniform(0), rain = uniform(0);
  const hash12 = Fn(([p]) => {
    const a = fract(vec3(p.x, p.y, p.x).mul(.1031)).toVar();
    a.addAssign(dot(a, a.yzx.add(19.19))); return fract(a.x.add(a.y).mul(a.z));
  });
  const hash22 = Fn(([p]) => {
    const a = fract(vec3(p.x, p.y, p.x).mul(vec3(.1031, .1030, .0973))).toVar();
    a.addAssign(dot(a, a.yzx.add(19.19))); return fract(a.xx.add(a.yz).mul(a.zy));
  });
  const wave = Fn(([d]) => sin(d.mul(31)).mul(smoothstep(-.6, -.3, d)).mul(float(1).sub(smoothstep(-.3, 0, d))));
  const ripples = Fn(([p]) => {
    const cell = floor(p), circles = vec2(0).toVar();
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const id = cell.add(vec2(i, j));
      const age = fract(time.mul(.9).add(hash12(id)));
      const delta = id.add(hash22(id)).sub(p);
      const d = length(delta).sub(age.mul(2));
      const derivative = wave(d.add(.001)).sub(wave(d.sub(.001))).div(.002);
      circles.addAssign(normalize(delta.add(.00001)).mul(derivative).mul(.5).mul(float(1).sub(age).pow(2)));
    }
    return circles.div(9).mul(rain);
  });
  const rippleUV = positionWorld.xz.mul(3.4);
  // Filter waves smaller than a pixel before they reach the specular lobe.
  // Otherwise a sharp procedural normal makes distant asphalt sparkle.
  const footprint = max(length(dFdx(rippleUV)), length(dFdy(rippleUV)));
  const waveVisibility = float(1).sub(smoothstep(.12, .42, footprint));
  const ripple = ripples(rippleUV).clamp(-3, 3).mul(waveVisibility);
  // Like the source demo, use several noise octaves for irregular basins.
  // Raising water fills the low spots, rather than making the entire road wet
  // enough to act as one unbroken reflecting plane.
  const p = positionWorld.xz;
  const noise = mx_noise_float(p.mul(.42)).mul(.55)
    .add(mx_noise_float(p.mul(.91)).mul(.28)).add(mx_noise_float(p.mul(1.83)).mul(.17)).mul(.5).add(.5);
  const threshold = float(.67).sub(wetness.mul(.10));
  const mask = smoothstep(threshold, threshold.add(.11), noise).mul(smoothstep(.08, .75, wetness));
  const loader = new THREE.TextureLoader();
  const load = (path, srgb = false) => {
    const t = loader.load(path); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const albedo = load('/assets/asphalt.jpg', true), normal = load('/assets/asphalt-normal.jpg'), rough = load('/assets/asphalt-roughness.jpg');
  const asphaltUV = positionWorld.xz.mul(.16);
  const staticNormal = texture(normal, asphaltUV).xyz.mul(2).sub(1);
  const slopes = staticNormal.xy.mul(mix(.50, .035, mask)).add(ripple.mul(.25).mul(mix(.30, 1, mask)).mul(wetness));
  const packedNormal = normalize(vec3(slopes.x, slopes.y.negate(), 1)).mul(.5).add(.5);
  const reflection = reflector({ resolutionScale: .6, bounces: false, generateMipmaps: true });
  reflection.uvNode = screenUV.flipX().add(vec2(slopes.x, slopes.y).mul(.018));
  reflection.levelNode = mix(3.1, 1.6, mask).add(smoothstep(8, 35, length(cameraPosition.sub(positionWorld))).mul(1.5));
  const material = new THREE.MeshPhysicalNodeMaterial({ roughness: .65, metalness: 0, clearcoat: .16, clearcoatRoughness: .30, ior: 1.333, specularIntensity: .22, envMapIntensity: .20 });
  material.normalNode = normalMap(packedNormal); material.clearcoatNormalNode = material.normalNode;
  const fresnel = float(1).sub(dot(normalWorld, normalize(cameraPosition.sub(positionWorld))).clamp(0, 1)).pow(5).mul(.30).add(.018);
  material.colorNode = texture(albedo, asphaltUV).rgb.mul(mix(.76, .46, wetness));
  // Keep the near-water lobe sharp enough to reveal the source demo's rings.
  // Broaden it with pixel footprint at distance instead of letting subpixel
  // rings produce bright, unstable specks across the street.
  const waterRoughness = mix(.18, .38, smoothstep(.035, .15, footprint));
  material.roughnessNode = mix(texture(rough, asphaltUV).g.mul(.35).add(.55), waterRoughness, mask.mul(wetness)).clamp(.18, 1);
  material.clearcoatNode = mask.mul(wetness).mul(.16);
  // Bound HDR highlights before adding the local street reflection. This keeps
  // lamps legible in puddles without washing out the asphalt underneath.
  material.emissiveNode = reflection.rgb.div(reflection.rgb.add(1)).mul(1.6).mul(fresnel).mul(mask).mul(wetness);
  world.ground.material = material; world.groundMat = material; world.ground.add(reflection.target);
  world.ground.name = 'Wet asphalt — original ripple derivative / PBR / HDR / planar reflection';
  return { material, update(t, amount, water) { time.value = t; rain.value = amount; wetness.value = water; } };
}

export function createRain(scene) {
  const COUNT = 4600, seeds = Array.from({ length: COUNT }, () => ({ x: Math.random() * 76 - 38, y: Math.random() * 19, z: Math.random() * 18 + .5, speed: 12 + Math.random() * 9, size: .15 + Math.random() * .33, width: .008 + Math.random() * .010 }));
  const amountNode = uniform(0);
  const mat = new THREE.MeshBasicNodeMaterial({ color: '#abc1e0', transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const edge = float(1).sub(smoothstep(.05, .5, uv().x.sub(.5).abs()));
  const ends = smoothstep(0, .2, uv().y).mul(float(1).sub(smoothstep(.65, 1, uv().y)));
  mat.opacityNode = edge.mul(ends).mul(amountNode).mul(.20);
  const drops = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, COUNT); drops.frustumCulled = false; scene.add(drops);
  drops.name = 'Rain — soft camera-facing 3D streaks';

  const MAX = 190, ages = new Float32Array(MAX), geometry = new THREE.PlaneGeometry(1, 1);
  geometry.setAttribute('aAge', new THREE.InstancedBufferAttribute(ages, 1));
  const atlas = new THREE.TextureLoader().load('/assets/splash.png'); atlas.colorSpace = THREE.SRGBColorSpace;
  const age = attribute('aAge'); const tile = floor(age.mul(18)).add(1).clamp(1, 19);
  const atlasUV = vec2(uv().x.add(tile.mod(4)).div(4), uv().y.add(float(4).sub(floor(tile.div(4)))).div(5));
  const splashMat = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, color: '#c3d6e8' });
  splashMat.opacityNode = texture(atlas, atlasUV).a.mul(float(1).sub(smoothstep(.72, 1, age))).mul(amountNode).mul(.23);
  const crowns = new THREE.InstancedMesh(geometry, splashMat, MAX); crowns.frustumCulled = false; scene.add(crowns); crowns.name = 'Original demo splash flipbook';
  const impacts = Array.from({ length: MAX }, () => ({ age: 10, x: 0, z: 0, life: .32, scale: 1 }));
  let cursor = 0; const dummy = new THREE.Object3D();
  function impact(x, z, scale = 1) { Object.assign(impacts[cursor++ % MAX], { x, z, age: 0, life: .30 + Math.random() * .16, scale: scale * (.65 + Math.random() * .5) }); }
  function update(dt, amount, player, camera) {
    const count = Math.floor(COUNT * amount); drops.count = count; drops.visible = amount > .01; amountNode.value = amount;
    const angle = Math.atan2(camera.position.x - player.x, camera.position.z - player.z);
    for (let i = 0; i < count; i++) {
      const p = seeds[i]; p.y -= p.speed * dt; p.x -= dt * 1.1;
      if (p.y < .08) {
        if (Math.random() < .045) impact(p.x, p.z);
        p.y = 15 + Math.random() * 4; p.x = player.x + Math.random() * 76 - 38; p.z = Math.random() * 18 + .5;
      }
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, angle, .07); dummy.scale.set(p.width, p.size, 1); dummy.updateMatrix(); drops.setMatrixAt(i, dummy.matrix);
    }
    drops.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < MAX; i++) {
      const p = impacts[i]; p.age += dt; const t = p.age / p.life; ages[i] = Math.min(1, t);
      dummy.position.set(p.x, .06 * p.scale, p.z); dummy.rotation.set(0, angle, 0);
      dummy.scale.set(t < 1 ? .22 * p.scale : 0, t < 1 ? .13 * p.scale : 0, 1); dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
    }
    crowns.instanceMatrix.needsUpdate = true; geometry.attributes.aAge.needsUpdate = true;
  }
  return { update, impact, drops, crowns };
}
