import fs from 'node:fs';
import * as THREE from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';

// CMU's captured motion, converted to BVH by Bruce Hahne. Frame zero is
// the converter's T pose, not part of the gait. Keep X/Z travel in the game
// controller and retain the captured pelvis sway, leg and arm motion here.
export function bakeCMU(name, file, targetHip, parents, flip) {
  const { skeleton, clip } = new BVHLoader().parse(fs.readFileSync(file, 'utf8'));
  const root = skeleton.bones[0], mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).play();
  action.clampWhenFinished = true;
  const mapping = { hips: 'Hips', spine: 'LowerBack', chest: 'Spine', upperChest: 'Spine1', neck: 'Neck1', head: 'Head' };
  for (const [side, prefix] of [['left', 'Left'], ['right', 'Right']]) {
    for (const [human, bone] of Object.entries({ Shoulder: 'Shoulder', UpperArm: 'Arm', LowerArm: 'ForeArm', Hand: 'Hand', UpperLeg: 'UpLeg', LowerLeg: 'Leg', Foot: 'Foot', Toes: 'ToeBase' })) mapping[side + human] = prefix + bone;
  }
  const bone = Object.fromEntries(Object.entries(mapping).map(([h, n]) => [h, skeleton.getBoneByName(n)]));
  function sample(t) { action.time = t; mixer.update(0); root.updateMatrixWorld(true); }
  sample(0);
  const rest = Object.fromEntries(Object.entries(bone).map(([h, b]) => [h, b.getWorldQuaternion(new THREE.Quaternion())]));
  const restHip = root.position.clone(), ratio = targetHip.y / restHip.y;
  const footY = () => Math.min(...['leftFoot', 'rightFoot', 'leftToes', 'rightToes'].map(h => bone[h].getWorldPosition(new THREE.Vector3()).y));
  // Match two frames with the same planted-foot phase. The best pair avoids
  // duplicating the artificial T pose or snapping at a manually cut boundary.
  const samples = [];
  for (let t = .15; t < clip.duration - .02; t += 1 / 120) {
    sample(t);
    samples.push({ t, p: root.position.clone(), q: Object.fromEntries(Object.entries(bone).map(([h, b]) => [h, b.getWorldQuaternion(new THREE.Quaternion())])) });
  }
  let best = null;
  const min = name === 'walk' ? 1.15 : .60, max = name === 'walk' ? 1.65 : .85;
  for (let i = 0; i < samples.length; i += 2) for (let j = i + 1; j < samples.length; j++) {
    const a = samples[i], b = samples[j], duration = b.t - a.t;
    if (duration < min || duration > max) continue;
    let cost = 0;
    for (const h of Object.keys(bone)) {
      const weight = /Leg|Foot/.test(h) ? 3 : /Arm/.test(h) ? 1 : .4;
      cost += a.q[h].angleTo(b.q[h]) ** 2 * weight;
    }
    cost += ((a.p.y - b.p.y) * ratio) ** 2 * 50;
    if (!best || cost < best.cost) best = { a, b, cost };
  }
  const { a, b } = best, duration = b.t - a.t;
  const heading = Math.atan2(b.p.x - a.p.x, b.p.z - a.p.z);
  const straighten = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -heading);
  const invFlip = flip.clone().invert(), frames = Math.ceil(duration * 60);
  const times = [], rotations = Object.fromEntries(Object.keys(parents).map(h => [h, []])), hips = [], clearance = [];
  const groundedY = Math.min(...samples.filter(s => s.t >= a.t && s.t <= b.t).map(s => { sample(s.t); return footY(); }));
  for (let f = 0; f <= frames; f++) {
    const u = f / frames, t = a.t + u * duration;
    sample(t); times.push(+(u * duration).toFixed(5));
    const delta = {};
    for (const h of Object.keys(parents)) {
      delta[h] = bone[h] ? straighten.clone().multiply(bone[h].getWorldQuaternion(new THREE.Quaternion())).multiply(rest[h].clone().invert()) : (delta[parents[h]]?.clone() || new THREE.Quaternion());
      // Heading belongs to the root alone, rather than changing the rest frame
      // separately for each joint.
    }
    for (const h of Object.keys(parents)) {
      const local = parents[h] ? delta[parents[h]].clone().invert().multiply(delta[h]) : delta[h].clone();
      const q = invFlip.clone().multiply(local).multiply(flip).normalize();
      q.toArray().forEach(v => rotations[h].push(+v.toFixed(6)));
    }
    const travel = a.p.clone().lerp(b.p, u);
    const sway = root.position.clone().sub(travel); sway.y = root.position.y - restHip.y;
    sway.multiplyScalar(ratio).applyQuaternion(straighten).applyQuaternion(invFlip).add(targetHip);
    sway.toArray().forEach(v => hips.push(+v.toFixed(6)));
    // The capture's floor has a slight height drift. Walking always has a
    // supporting sole; only the jog is allowed a short airborne phase.
    clearance.push(name === 'walk' ? 0 : +Math.min(.10, Math.max(0, (footY() - groundedY) * ratio)).toFixed(5));
  }
  // Ease out the very small seam residual, without changing the captured
  // support-foot timings or suppressing all of the pelvis movement.
  for (let f = 0; f <= frames; f++) {
    const u = f / frames, blend = THREE.MathUtils.smoothstep(u, .82, 1);
    for (const values of Object.values(rotations)) {
      const first = new THREE.Quaternion().fromArray(values), last = new THREE.Quaternion().fromArray(values, frames * 4);
      const correction = last.clone().invert().multiply(first);
      const current = new THREE.Quaternion().fromArray(values, f * 4);
      current.multiply(new THREE.Quaternion().slerp(correction, blend)).normalize().toArray(values, f * 4);
    }
    for (let k = 0; k < 3; k++) hips[f * 3 + k] += (hips[k] - hips[frames * 3 + k]) * blend;
    clearance[f] += (clearance[0] - clearance[frames]) * blend;
  }
  const nominalSpeed = a.p.distanceTo(b.p) * ratio * 1.28 / duration;
  console.log(`CMU ${name}: ${a.t.toFixed(3)}–${b.t.toFixed(3)}s, ${duration.toFixed(3)}s loop, ${nominalSpeed.toFixed(2)}m/s`);
  return { name, source: `CMU ${file.match(/cmu-(.*)\.bvh/)[1]}, BVH conversion Bruce Hahne`, duration, nominalSpeed, times, rotations, hips, clearance };
}
