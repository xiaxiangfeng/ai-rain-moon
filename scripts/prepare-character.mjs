// Bake the licensed hairstyle and retarget CMU / Quaternius animation clips.
// No renderer or Blender installation is required to reproduce the assets.
import fs from 'node:fs';
import * as THREE from 'three';
import { bakeCMU } from './cmu-motion.mjs';

function readGLB(path) {
  const bytes = fs.readFileSync(path), length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length));
  const bin = Buffer.from(bytes.subarray(28 + length));
  function accessor(index) {
    const a = json.accessors[index], view = json.bufferViews[a.bufferView];
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
    const width = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
    const values = [];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) {
      const offset = (view.byteOffset || 0) + (a.byteOffset || 0) + i * (view.byteStride || size * width) + k * width;
      values.push(a.componentType === 5126 ? bin.readFloatLE(offset) : a.componentType === 5123 ? bin.readUInt16LE(offset) : a.componentType === 5121 ? bin.readUInt8(offset) : bin.readUInt32LE(offset));
    }
    return values;
  }
  function writeFloatAccessor(index, values) {
    const a = json.accessors[index], view = json.bufferViews[a.bufferView];
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) {
      bin.writeFloatLE(values[i * size + k], (view.byteOffset || 0) + (a.byteOffset || 0) + i * (view.byteStride || size * 4) + k * 4);
    }
    if (size === 3) {
      a.min = [Infinity, Infinity, Infinity]; a.max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < values.length; i++) { const k = i % 3; a.min[k] = Math.min(a.min[k], values[i]); a.max[k] = Math.max(a.max[k], values[i]); }
    }
  }
  function writeJointAccessor(index, values) {
    const a = json.accessors[index], view = json.bufferViews[a.bufferView];
    for (let i = 0; i < values.length; i++) bin.writeUInt16LE(values[i], (view.byteOffset || 0) + (a.byteOffset || 0) + Math.floor(i / 4) * (view.byteStride || 8) + i % 4 * 2);
  }
  return { json, bin, accessor, writeFloatAccessor, writeJointAccessor };
}
function makeRig(json) {
  const nodes = json.nodes.map(n => {
    const o = new THREE.Object3D(); o.name = n.name;
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  json.nodes.forEach((n, i) => n.children?.forEach(child => nodes[i].add(nodes[child])));
  const root = new THREE.Group(); nodes.filter(o => !o.parent).forEach(o => root.add(o)); root.updateMatrixWorld(true);
  return { root, nodes };
}
function writeGLB(path, { json, bin }) {
  const raw = Buffer.from(JSON.stringify(json)), j = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32); raw.copy(j);
  const b = Buffer.alloc(Math.ceil(bin.length / 4) * 4); bin.copy(b);
  const out = Buffer.alloc(28 + j.length + b.length); out.write('glTF'); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(j.length, 12); out.writeUInt32LE(0x4e4f534a, 16); j.copy(out, 20);
  out.writeUInt32LE(b.length, 20 + j.length); out.writeUInt32LE(0x004e4942, 24 + j.length); b.copy(out, 28 + j.length); fs.writeFileSync(path, out);
}

const model = readGLB('art-source/alice-uniform.vrm');
const { json } = model, rig = makeRig(json), originalWorld = rig.nodes.map(n => n.getWorldPosition(new THREE.Vector3()));
const hair = json.meshes[2].primitives[0], p = model.accessor(hair.attributes.POSITION);
const weights = model.accessor(hair.attributes.WEIGHTS_0), joints = model.accessor(hair.attributes.JOINTS_0);
const skin = json.skins[json.nodes.find(n => n.mesh === 2).skin];
// Gather the original textured, skinned long strands. Keep the modeled bangs,
// scalp and face intact; do not attach rigid tubes to the head.
function strandNumber(node) { const match = json.nodes[node].name.match(/J_Sec_Hair\d+_(\d+)/); return match ? +match[1] : 0; }
const isLong = n => n >= 9 && n <= 16 || n >= 18;
// Identify complete strand surfaces, including the vertices originally bound
// only to the scalp. Moving just the weighted tips would leave stretched roots.
const vertexCount = p.length / 3, parent = Array.from({ length: vertexCount }, (_, i) => i);
function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
function union(a, b) { parent[find(a)] = find(b); }
const indices = model.accessor(hair.indices);
for (let i = 0; i < indices.length; i += 3) { union(indices[i], indices[i + 1]); union(indices[i], indices[i + 2]); }
const componentNumber = new Map();
for (let i = 0; i < vertexCount; i++) for (let k = 0; k < 4; k++) {
  const n = strandNumber(skin.joints[joints[i * 4 + k]]);
  if (isLong(n) && weights[i * 4 + k] > .05) componentNumber.set(find(i), n);
}
const vertexNumber = Array.from({ length: vertexCount }, (_, i) => componentNumber.get(find(i)) || 0);
// Propagate through duplicated seam vertices to include their little end caps.
const seamNumber = new Map(), key = i => p.slice(i * 3, i * 3 + 3).map(v => v.toFixed(5)).join(',');
vertexNumber.forEach((n, i) => { if (n) seamNumber.set(key(i), n); });
vertexNumber.forEach((n, i) => { if (!n) vertexNumber[i] = seamNumber.get(key(i)) || 0; });
const bounds = {};
vertexNumber.forEach((n, i) => { if (!n) return; const b = bounds[n] ||= { min: 9, max: -9 }; b.min = Math.min(b.min, p[i * 3 + 1]); b.max = Math.max(b.max, p[i * 3 + 1]); });
function tailCenter(t) { return new THREE.Vector3(0, 1.525 - t * .49, .135 + Math.sin(t * Math.PI) * .058 + t * .018); }
const tailBones = [37, 38, 39, 40, 41, 42, 43];
for (let i = 0; i < vertexCount; i++) {
  const n = vertexNumber[i]; if (!n) continue;
  const t = THREE.MathUtils.clamp((bounds[n].max - p[i * 3 + 1]) / (bounds[n].max - bounds[n].min), 0, 1);
  const v = tailCenter(t), taper = Math.sin(Math.PI * (.08 + t * .87));
  v.x += p[i * 3] * .40 * taper;
  v.z += (p[i * 3 + 2] - .045) * .30 * taper;
  v.y += Math.sin(n * 2.8) * .013 * t;
  v.toArray(p, i * 3);
  const segment = Math.min(5, Math.floor(t * 6)), blend = Math.min(1, t * 6 - segment);
  joints.splice(i * 4, 4, skin.joints.indexOf(tailBones[segment]), skin.joints.indexOf(tailBones[segment + 1]), 0, 0);
  weights.splice(i * 4, 4, 1 - blend, blend, 0, 0);
}
model.writeFloatAccessor(hair.attributes.POSITION, p);
model.writeFloatAccessor(hair.attributes.WEIGHTS_0, weights);
model.writeJointAccessor(hair.attributes.JOINTS_0, joints);
const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(model.accessor(hair.indices)); g.computeVertexNormals();
model.writeFloatAccessor(hair.attributes.NORMAL, Array.from(g.attributes.normal.array));
// Rebuild rest positions and inverse bind matrices along the gathered chains.
tailBones.forEach((node, i) => {
  const n = rig.nodes[node], parentPosition = i ? tailCenter((i - 1) / 6) : originalWorld[10];
  n.position.copy(tailCenter(i / 6).sub(parentPosition)); json.nodes[node].translation = n.position.toArray();
});
rig.root.updateMatrixWorld(true);
for (const s of json.skins) model.writeFloatAccessor(s.inverseBindMatrices, s.joints.flatMap(i => rig.nodes[i].matrixWorld.clone().invert().toArray()));
json.extensions.VRM.meta.title = 'Ametsuki — Alice Chan ponytail adaptation';
json.extensions.VRM.meta.reference += '; https://yuna0x0.itch.io/alice-chan';
json.extensions.VRM.meta.version += '-ametsuki-1';
// The original long-hair settings are too loose when the roots are gathered.
json.extensions.VRM.secondaryAnimation.boneGroups = json.extensions.VRM.secondaryAnimation.boneGroups.filter(group => !group.comment?.includes('Hair') || !isLong(strandNumber(group.bones[0])) || group.bones[0] === 37);
for (const group of json.extensions.VRM.secondaryAnimation.boneGroups) {
  if (group.bones[0] === 37) { group.stiffiness = 1.8; group.dragForce = .60; group.gravityPower = .025; group.colliderGroups = []; }
}
writeGLB('public/assets/character/ametsuki.vrm', model);

const source = readGLB('art-source/UAL1_Standard.glb'), sourceRig = makeRig(source.json);
const byName = Object.fromEntries(sourceRig.nodes.map(n => [n.name, n]));
const mapping = { hips: 'pelvis', spine: 'spine_01', chest: 'spine_02', upperChest: 'spine_03', neck: 'neck_01', head: 'Head' };
for (const [side, suffix] of [['left', 'l'], ['right', 'r']]) {
  for (const [human, bone] of Object.entries({ Shoulder: 'clavicle', UpperArm: 'upperarm', LowerArm: 'lowerarm', Hand: 'hand', UpperLeg: 'thigh', LowerLeg: 'calf', Foot: 'foot', Toes: 'ball' })) mapping[side + human] = bone + '_' + suffix;
  for (const [finger, stem] of [['Index', 'index'], ['Middle', 'middle'], ['Ring', 'ring'], ['Little', 'pinky'], ['Thumb', 'thumb']]) {
    for (const [segment, number] of [['Proximal', '01'], ['Intermediate', '02'], ['Distal', '03']]) mapping[side + finger + segment] = `${stem}_${number}_${suffix}`;
  }
}
function sourceClip(a) {
  const tracks = a.channels.map(c => {
    const s = a.samplers[c.sampler], node = sourceRig.nodes[c.target.node];
    const property = { translation: 'position', rotation: 'quaternion', scale: 'scale' }[c.target.path];
    const Type = property === 'quaternion' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
    return new Type(`${node.uuid}.${property}`, source.accessor(s.input), source.accessor(s.output));
  });
  return new THREE.AnimationClip(a.name, -1, tracks);
}
const mixer = new THREE.AnimationMixer(sourceRig.root);
const tpose = mixer.clipAction(sourceClip(source.json.animations.find(a => a.name === 'A_TPose'))).play(); mixer.update(0); sourceRig.root.updateMatrixWorld(true);
const restQ = Object.fromEntries(Object.entries(mapping).map(([h, n]) => [h, byName[n].getWorldQuaternion(new THREE.Quaternion())]));
const restHip = byName.pelvis.getWorldPosition(new THREE.Vector3());
const footBones = ['foot_l', 'foot_r', 'ball_l', 'ball_r'];
const restFootY = Math.min(...footBones.map(n => byName[n].getWorldPosition(new THREE.Vector3()).y)); tpose.stop();
const humanNodes = Object.fromEntries(json.extensions.VRM.humanoid.humanBones.map(b => [b.bone, b.node]));
const humanByNode = Object.fromEntries(Object.entries(humanNodes).map(([h, i]) => [i, h]));
const parents = {};
for (const h of Object.keys(mapping)) {
  if (humanNodes[h] === undefined) continue;
  let parent = rig.nodes[humanNodes[h]].parent;
  while (parent && !humanByNode[rig.nodes.indexOf(parent)]) parent = parent.parent;
  parents[h] = parent ? humanByNode[rig.nodes.indexOf(parent)] : null;
}
const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), flipInv = flip.clone().invert();
const targetHip = originalWorld[humanNodes.hips], scale = targetHip.y / restHip.y;
const output = [];
for (const [name, sourceName] of Object.entries({ idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', sitDown: 'Sitting_Enter', sit: 'Sitting_Idle_Loop', standUp: 'Sitting_Exit' })) {
  const clip = sourceClip(source.json.animations.find(a => a.name === sourceName));
  const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  const frames = Math.ceil(clip.duration * 30), times = [], tracks = Object.fromEntries(Object.keys(parents).map(h => [h, []])), positions = [], clearance = [];
  for (let f = 0; f <= frames; f++) {
    const time = f / frames * clip.duration; action.time = time; mixer.update(0); sourceRig.root.updateMatrixWorld(true); times.push(+time.toFixed(5));
    const deltas = Object.fromEntries(Object.entries(parents).map(([h]) => [h, byName[mapping[h]].getWorldQuaternion(new THREE.Quaternion()).multiply(restQ[h].clone().invert())]));
    for (const h of Object.keys(parents)) {
      const local = parents[h] ? deltas[parents[h]].clone().invert().multiply(deltas[h]) : deltas[h].clone();
      const q = flipInv.clone().multiply(local).multiply(flip).normalize();
      q.toArray().forEach(v => tracks[h].push(+v.toFixed(6)));
    }
    const hip = byName.pelvis.getWorldPosition(new THREE.Vector3()).sub(restHip).multiplyScalar(scale).applyQuaternion(flipInv).add(targetHip);
    hip.toArray().forEach(v => positions.push(+v.toFixed(6)));
    const lowestFoot = Math.min(...footBones.map(n => byName[n].getWorldPosition(new THREE.Vector3()).y));
    clearance.push(+Math.max(0, (lowestFoot - restFootY) * scale).toFixed(5));
  }
  output.push({ name, source: 'Quaternius UAL1 Standard, CC0', duration: clip.duration, times, rotations: tracks, hips: positions, clearance }); action.stop();
}
// Preserve the authored hand poses before mocap replaces locomotion. BVH
// supplies the arm swing but has no finger joints.
const handPoses = Object.fromEntries(['idle', 'jog'].map(name => [name === 'idle' ? 'relaxed' : 'fist', Object.fromEntries(
  Object.entries(output.find(c => c.name === name).rotations)
    .filter(([bone]) => /(Index|Middle|Ring|Little|Thumb)/.test(bone))
    .map(([bone, values]) => [bone, new THREE.Quaternion().slerp(new THREE.Quaternion().fromArray(values), name === 'idle' ? .28 : .86).toArray()])
)]));
for (const [name, file] of [['walk', '07_04'], ['jog', '16_35']]) {
  output[output.findIndex(c => c.name === name)] = bakeCMU(name, `art-source/cmu-${file}.bvh`, targetHip, parents, flip);
}
// A quieter neutral stance, with fingers relaxed rather than clenched fists.
for (const motion of output) for (const [bone, values] of Object.entries(motion.rotations)) {
  if (motion.name === 'idle' && /UpperLeg/.test(bone)) {
    for (let i = 0; i < values.length; i += 4) new THREE.Quaternion().slerp(new THREE.Quaternion().fromArray(values, i), .48).toArray(values, i);
  }
  if (/(Index|Middle|Ring|Little|Thumb)/.test(bone)) {
    for (let i = 0; i < values.length; i += 4) new THREE.Quaternion().slerp(new THREE.Quaternion().fromArray(values, i), .35).toArray(values, i);
  }
}
fs.writeFileSync('public/assets/character/motions.json', JSON.stringify({ source: 'CMU motion capture / Bruce Hahne BVH conversion; Quaternius UAL1 Standard (CC0)', handPoses, clips: output }));
console.log('Prepared skinned ponytail model and', output.map(c => c.name).join(', '));
