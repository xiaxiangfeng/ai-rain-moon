import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, MToonMaterialLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { MToonNodeMaterial } from '@pixiv/three-vrm/nodes';
import { lights } from 'three/tsl';
import { assetUrl } from './assets.js';

// A complete authored character, with skinned clothes, facial morphs and spring
// bones. Asset preparation and motion retargeting are reproducible via
// scripts/prepare-character.mjs. Provenance and modifications: NOTICE.md.
export async function createCharacter(world) {
  const loader = new GLTFLoader();
  loader.register(parser => new VRMLoaderPlugin(parser, {
    mtoonMaterialPlugin: new MToonMaterialLoaderPlugin(parser, { materialType: MToonNodeMaterial })
  }));
  const [gltf, motionData] = await Promise.all([
    loader.loadAsync(assetUrl('character/ametsuki.vrm')),
    fetch(assetUrl('character/motions.json')).then(r => { if (!r.ok) throw new Error('角色动作资源无法加载'); return r.json(); })
  ]);
  const vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene); VRMUtils.combineSkeletons(gltf.scene); VRMUtils.rotateVRM0(vrm);
  const root = new THREE.Group(), body = vrm.scene;
  root.name = '雨月 — Alice Chan adaptation'; root.add(body); body.scale.setScalar(1.28);
  const fill = new THREE.DirectionalLight('#ffebd7', .20); fill.position.set(-3, 4, 5); fill.updateMatrixWorld(); fill.target.updateMatrixWorld();
  const characterLights = lights([world.moonLight, world.hemi, fill]);
  const shoeSamples = [];
  body.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false; o.castShadow = true; o.receiveShadow = false;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m.isMToonNodeMaterial) continue;
      m.lightsNode = characterLights; m.outlineWidthFactor *= .40; m.envMapIntensity = .12;
      // Preserve the authored eyes, lashes, skin and clothing textures. Tint
      // the original blond hair into a warm brown without replacing its UVs.
      if (m.name.includes('HAIR')) { m.color.set('#94715b'); m.shadeColorFactor.set('#695546'); m.matcapFactor.multiplyScalar(.35); }
      if (m.name.includes('Shoes') && o.isSkinnedMesh) {
        const p = o.geometry.attributes.position, minimum = Math.min(...Array.from({length:p.count},(_,i)=>p.getY(i)));
        const indices = Array.from({length:p.count},(_,i)=>i).filter(i=>p.getY(i)<minimum+.014);
        shoeSamples.push({mesh:o, indices:indices.filter((_,i)=>i%Math.max(1,Math.floor(indices.length/48))===0)});
      }
    }
  });
  const bones = vrm.humanoid.normalizedHumanBones;
  // PropertyMixer skips setters when a frozen clip's value is unchanged.
  // Restore the last animation pose before mixing so procedural lean, IK,
  // short strides and gaze corrections cannot accumulate on the next frame.
  const animationPose = Object.values(bones).map(({ node }) => ({ node, rotation: node.quaternion.clone(), position: node.position.clone() }));
  const hairTie = new THREE.Mesh(new THREE.TorusGeometry(.027, .005, 10, 32), new THREE.MeshStandardMaterial({color:'#74384c', roughness:.95}));
  hairTie.position.set(0, .14, .137); hairTie.rotation.x = Math.PI / 2; bones.head.node.add(hairTie);
  const mixer = new THREE.AnimationMixer(body);
  const actions = {}, clips = {};
  for (const motion of motionData.clips) {
    const tracks = [];
    for (const [name, values] of Object.entries(motion.rotations)) {
      const bone = bones[name]?.node; if (bone) tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.uuid}.quaternion`, motion.times, values));
    }
    tracks.push(new THREE.VectorKeyframeTrack(`${bones.hips.node.uuid}.position`, motion.times, motion.hips));
    const clip = new THREE.AnimationClip(motion.name, motion.duration, tracks); clips[motion.name] = clip;
    const action = mixer.clipAction(clip); actions[motion.name] = action;
    action.setEffectiveWeight(0).play();
    if (motion.name === 'sitDown' || motion.name === 'standUp') { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.paused = true; }
  }
  actions.idle.setEffectiveWeight(1);
  actions.idle.timeScale = actions.sit.timeScale = 0;
  const fingerPoses = Object.fromEntries(Object.entries(motionData.handPoses || {}).map(([pose, values]) => [pose, Object.fromEntries(Object.entries(values).map(([name, value]) => [name, new THREE.Quaternion().fromArray(value)]))]));
  let mode = 'locomotion', wasSeated = false, walkWeight = 0, jogWeight = 0, gaitPhase = 0;
  let pendingSeat = false, previousPosition = root.position.clone();
  // Fixed, forward gaze; a low moving look-at target used to tilt the head.
  if (vrm.lookAt) vrm.lookAt.target = null;
  const q = new THREE.Quaternion(), euler = new THREE.Euler(), sole = new THREE.Vector3();
  const seatHeight = .660; // Match the cafe chair cushion in world.js.
  const motionByName = Object.fromEntries(motionData.clips.map(c=>[c.name,c]));
  function clearance(name) {
    const c=motionByName[name],frame=(actions[name].time%c.duration)/c.duration*(c.clearance.length-1),i=Math.floor(frame);
    return THREE.MathUtils.lerp(c.clearance[i],c.clearance[Math.min(i+1,c.clearance.length-1)],frame-i)*body.scale.y;
  }
  let groundOffset = 0;
  let doorContact = null, contactError = 0, palmAngle = 0, shortSteps = false;
  const armPoint = new THREE.Vector3(), elbowPoint = new THREE.Vector3(), handPoint = new THREE.Vector3();
  const direction = new THREE.Vector3(), bend = new THREE.Vector3(), elbowTarget = new THREE.Vector3();
  const parentQ = new THREE.Quaternion(), worldQ = new THREE.Quaternion(), rotation = new THREE.Quaternion();
  root.updateMatrixWorld(true); vrm.humanoid.update(); body.updateMatrixWorld(true);
  const palms = {};
  const poseNodes = new Set(Object.values(bones).map(b => b.node));
  body.traverse(o => { if (o.isBone) poseNodes.add(o); });
  for (const side of ['left', 'right']) {
    const hand = bones[side + 'Hand'].node;
    const local = name => hand.worldToLocal(bones[side + name].node.getWorldPosition(new THREE.Vector3()));
    const middle = local('MiddleProximal'), index = local('IndexProximal'), little = local('LittleProximal');
    const forward = middle.clone().normalize(), across = index.clone().sub(little).normalize();
    const normal = forward.clone().cross(across).normalize().multiplyScalar(side === 'left' ? 1 : -1);
    const tangent = forward.clone().cross(normal).normalize();
    const frame = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward, normal, tangent));
    // Include the palm's thickness: targeting the wrist-side skin at 8 mm
    // placed the sleeve cuff through the pane when the palm was flat.
    const center = index.clone().add(little).multiplyScalar(.27).addScaledVector(normal, .020);
    const raw = vrm.humanoid.getRawBoneNode(side + 'Hand');
    const rawCenter = raw.worldToLocal(hand.localToWorld(center.clone()));
    palms[side] = { center, rawCenter, normal, frame };
  }
  function reachHandle() {
    if (!doorContact || doorContact.weight <= 0) { contactError = palmAngle = 0; return; }
    const { target, normal, weight, side, grip } = doorContact, palm = palms[side];
    const upper = bones[side + 'UpperArm'].node, lower = bones[side + 'LowerArm'].node, hand = bones[side + 'Hand'].node;
    const baseUpper = upper.quaternion.clone(), baseLower = lower.quaternion.clone(), baseHand = hand.quaternion.clone();
    // Match both finger direction and palm normal. The contact target is the
    // surface of the palm, rather than the wrist joint several cm away.
    const fingersUp = grip ? normal.clone().cross(THREE.Object3D.DEFAULT_UP).normalize() : new THREE.Vector3(0, 1, 0), inward = normal.clone().negate();
    const desiredQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(fingersUp, inward, fingersUp.clone().cross(inward))).multiply(palm.frame.clone().invert());
    const wristTarget = target.clone().sub(palm.center.clone().multiplyScalar(body.scale.y).applyQuaternion(desiredQ));
    root.updateMatrixWorld(true);
    upper.getWorldPosition(armPoint); lower.getWorldPosition(elbowPoint); hand.getWorldPosition(handPoint);
    const a = armPoint.distanceTo(elbowPoint), b = elbowPoint.distanceTo(handPoint);
    direction.subVectors(wristTarget, armPoint); const requestedDistance = direction.length(), distance = Math.min(requestedDistance, a + b - .008); direction.normalize();
    // The elbow bends down and a little out from the body, rather than
    // choosing an arbitrary flipped solution of the two-bone chain.
    bend.set(side === 'left' ? .35 : -.35, -.8, .08).applyAxisAngle(THREE.Object3D.DEFAULT_UP, root.rotation.y);
    bend.addScaledVector(direction, -bend.dot(direction)).normalize();
    const along = (a * a + distance * distance - b * b) / (2 * distance);
    elbowTarget.copy(armPoint).addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
    function aim(node, from, to) {
      rotation.setFromUnitVectors(from.normalize(), to.normalize());
      node.getWorldQuaternion(worldQ); node.parent.getWorldQuaternion(parentQ);
      node.quaternion.copy(parentQ.invert().multiply(rotation).multiply(worldQ)); root.updateMatrixWorld(true);
    }
    aim(upper, elbowPoint.clone().sub(armPoint), elbowTarget.clone().sub(armPoint));
    lower.getWorldPosition(elbowPoint); hand.getWorldPosition(handPoint);
    aim(lower, handPoint.clone().sub(elbowPoint), wristTarget.clone().sub(elbowPoint));
    hand.parent.getWorldQuaternion(parentQ);
    hand.quaternion.copy(parentQ.invert().multiply(desiredQ));
    upper.quaternion.copy(baseUpper.slerp(upper.quaternion, weight));
    lower.quaternion.copy(baseLower.slerp(lower.quaternion, weight));
    hand.quaternion.copy(baseHand.slerp(hand.quaternion, weight));
    root.updateMatrixWorld(true);
    handPoint.copy(palm.center).applyMatrix4(hand.matrixWorld); contactError = handPoint.distanceTo(target);
    hand.getWorldQuaternion(worldQ);
    palmAngle = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(palm.normal.clone().applyQuaternion(worldQ).dot(inward), -1, 1)));
    root.userData.reachSpan = `${requestedDistance.toFixed(3)}/${(a + b).toFixed(3)}`;
  }
  function transition(next) {
    const old = mode; mode = next;
    for (const action of Object.values(actions)) action.fadeOut(.24);
    if (next === 'locomotion') {
      walkWeight = jogWeight = 0;
      actions.idle.reset().setEffectiveWeight(1).fadeIn(.24).play();
      actions.walk.reset().setEffectiveWeight(0).play(); actions.jog.reset().setEffectiveWeight(0).play();
    } else {
      actions[next].reset().setEffectiveWeight(1).fadeIn(.24).play();
      if (next === 'sitDown' || next === 'standUp') actions[next].paused = false;
    }
    if (old === 'sit' && next === 'standUp') actions.sit.setEffectiveWeight(1).fadeOut(.24);
  }
  mixer.addEventListener('finished', event => {
    if (event.action === actions.sitDown && mode === 'sitDown') transition('sit');
    else if (event.action === actions.standUp && mode === 'standUp') transition(pendingSeat ? 'sitDown' : 'locomotion');
  });
  function update(dt, moving, rain, seated, elapsed, speed = moving ? rain > .16 ? 3.25 : 1.7 : 0, turn = 0) {
    pendingSeat = seated;
    if (seated !== wasSeated) { transition(seated ? 'sitDown' : 'standUp'); wasSeated = seated; }
    if (mode === 'locomotion') {
      const gait = moving ? THREE.MathUtils.smoothstep(speed, .12, .75) : 0;
      const running = rain > .16 ? THREE.MathUtils.smoothstep(speed, 1.45, 2.5) : 0;
      walkWeight = THREE.MathUtils.damp(walkWeight, gait * (1 - running), 10, dt);
      jogWeight = THREE.MathUtils.damp(jogWeight, gait * running, 10, dt);
      if (!moving && walkWeight + jogWeight < .002) walkWeight = jogWeight = 0;
      actions.idle.setEffectiveWeight(Math.max(0, 1 - walkWeight - jogWeight));
      actions.walk.setEffectiveWeight(walkWeight); actions.jog.setEffectiveWeight(jogWeight);
      // Match cadence to actual travelled distance. A walk/run switch retains
      // the leg phase instead of abruptly restarting one foot in mid-air.
      const cadence = THREE.MathUtils.lerp(speed / (motionByName.walk.nominalSpeed * clips.walk.duration), speed / (motionByName.jog.nominalSpeed * clips.jog.duration), running);
      gaitPhase = (gaitPhase + dt * cadence / (shortSteps ? .55 : 1)) % 1;
      actions.walk.time = gaitPhase * clips.walk.duration; actions.jog.time = gaitPhase * clips.jog.duration;
      actions.walk.timeScale = actions.jog.timeScale = 0;
    }
    for (const pose of animationPose) { pose.node.quaternion.copy(pose.rotation); pose.node.position.copy(pose.position); }
    mixer.update(dt);
    for (const pose of animationPose) { pose.rotation.copy(pose.node.quaternion); pose.position.copy(pose.node.position); }
    if (shortSteps && mode === 'locomotion') {
      // Short steps at a moving obstacle keep the leading shoe and skirt on
      // the same side as the torso, rather than striding through the panel.
      for (const side of ['left','right']) for (const name of ['UpperLeg','LowerLeg','Foot','Toes']) {
        const node = bones[side + name]?.node;
        if (node) node.quaternion.slerp(q.identity(), .45);
      }
      bones.hips.node.position.x *= .55; bones.hips.node.position.z *= .55;
    }
    // Preserve the captured body motion without adding idle head swaying.
    const movingWeight = walkWeight + jogWeight;
    bones.chest.node.quaternion.multiply(q.setFromEuler(euler.set(0, -turn * .025, -turn * .032 * movingWeight)));
    if (doorContact?.weight > 0) bones.chest.node.quaternion.multiply(q.setFromEuler(euler.set(-.09 * doorContact.weight, 0, 0)));
    if (mode === 'locomotion') {
      root.updateMatrixWorld(true);
      bones.head.node.getWorldQuaternion(worldQ); euler.setFromQuaternion(worldQ, 'YXZ');
      euler.x = THREE.MathUtils.clamp(euler.x, -.025, .025); euler.z = 0;
      bones.head.node.parent.getWorldQuaternion(parentQ);
      bones.head.node.quaternion.copy(parentQ.invert().multiply(q.setFromEuler(euler)));
      for (const [name, relaxed] of Object.entries(fingerPoses.relaxed || {})) {
        const bone = bones[name]?.node; if (!bone) continue;
        bone.quaternion.copy(relaxed).slerp(fingerPoses.fist[name], THREE.MathUtils.smoothstep(jogWeight, .12, .85));
        if (doorContact?.side && name.startsWith(doorContact.side)) {
          const contactPose = doorContact.grip ? relaxed.clone().slerp(fingerPoses.fist[name], .64) : new THREE.Quaternion();
          bone.quaternion.slerp(contactPose, doorContact.weight);
        }
      }
    }
    const still = !moving && mode !== 'sitDown' && mode !== 'standUp' && (mode === 'sit' || movingWeight === 0) && !(doorContact?.weight > 0);
    const blinkPhase = elapsed % 5.7;
    const blink = Math.max(0, 1 - Math.abs(blinkPhase - .16) / .095);
    vrm.expressionManager.setValue('blink', still ? 0 : blink);
    vrm.expressionManager.setValue('happy', seated ? .16 : .035);
    vrm.expressionManager.setValue('relaxed', seated ? .10 : .025);
    root.updateMatrixWorld(true);
    vrm.humanoid.update(); body.updateMatrixWorld(true);
    // Remove retargeting height drift caused by the different leg/head ratios.
    // During sitting the clip's hip trajectory is matched to the actual chair.
    if (mode === 'locomotion') {
      let footY=Infinity;
      for (const {mesh,indices} of shoeSamples) {
        mesh.skeleton.update();
        for (const i of indices) footY=Math.min(footY,mesh.getVertexPosition(i,sole).applyMatrix4(mesh.matrixWorld).y-body.position.y);
      }
      const flight=clearance('idle')*(1-walkWeight-jogWeight)+clearance('walk')*walkWeight+clearance('jog')*jogWeight;
      const desiredOffset = root.position.y + flight - footY;
      groundOffset = still ? desiredOffset : THREE.MathUtils.damp(groundOffset, desiredOffset, 40, dt);
      groundOffset = Math.max(groundOffset,root.position.y-footY);
      body.position.y = groundOffset; body.position.z = 0;
    } else {
      const sittingRest = motionByName.sit.hips[1] * body.scale.y;
      const sittingOffset = seatHeight - sittingRest + .085;
      const t = mode === 'sit' ? 1 : mode === 'sitDown' ? THREE.MathUtils.smoothstep(actions.sitDown.time / clips.sitDown.duration, .15, .85) : 1 - THREE.MathUtils.smoothstep(actions.standUp.time / clips.standUp.duration, .15, .9);
      body.position.y = THREE.MathUtils.lerp(groundOffset, sittingOffset, t);
      // Sitting clips move the pelvis backward relative to their source root.
      // Compensate that offset so the pelvis stays on the actual chair cushion.
      body.position.z = (motionByName.sit.hips[2]-motionByName.idle.hips[2])*body.scale.y*t;
    }
    // Solve after floor correction so the wrist stays on the handle even as
    // the support foot changes the body's vertical offset.
    reachHandle();
    if (root.position.distanceToSquared(previousPosition) > 1) vrm.springBoneManager?.reset();
    previousPosition.copy(root.position);
    if (still) {
      // Hold the complete rest pose, including the ponytail, while stationary.
      vrm.humanoid.update(); vrm.expressionManager.update();
    } else vrm.update(Math.min(dt, 1 / 30));
    body.updateMatrixWorld(true);
    if (doorContact?.weight > 0) {
      handPoint.copy(palms[doorContact.side].rawCenter).applyMatrix4(vrm.humanoid.getRawBoneNode(doorContact.side + 'Hand').matrixWorld);
      contactError = handPoint.distanceTo(doorContact.target);
    }
    let contactY=Infinity;
    for (const {mesh,indices} of shoeSamples) { mesh.skeleton.update(); for(const i of indices) contactY=Math.min(contactY,mesh.getVertexPosition(i,sole).applyMatrix4(mesh.matrixWorld).y); }
    root.userData.footClearance = contactY-root.position.y;
    root.userData.animation = mode === 'locomotion' ? jogWeight > .5 ? 'jog' : walkWeight > .1 ? 'walk' : 'idle' : mode;
    root.userData.palmAngle = palmAngle.toFixed(2);
    root.userData.fingerCurl = THREE.MathUtils.smoothstep(jogWeight, .12, .85).toFixed(3);
    bones.head.node.getWorldQuaternion(worldQ);
    root.userData.headTilt = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(new THREE.Vector3(0, 1, 0).applyQuaternion(worldQ).y, -1, 1))).toFixed(2);
    bones.upperChest.node.getWorldQuaternion(worldQ);
    root.userData.torsoTilt = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(new THREE.Vector3(0, 1, 0).applyQuaternion(worldQ).y, -1, 1))).toFixed(2);
    // Exposed as DOM QA telemetry by the preview/main page, never as game UI.
    let hash = 2166136261;
    const hashValue = v => { hash = Math.imul(hash ^ Math.round(v * 100000), 16777619); };
    hashValue(body.position.y); hashValue(body.position.z);
    for (const node of poseNodes) { node.quaternion.toArray().forEach(hashValue); node.position.toArray().forEach(hashValue); }
    root.userData.pose = (hash >>> 0).toString(16);
  }
  update(0, false, 0, false, 0);
  return { root, vrm, update, height: 2.12, get animation() { return root.userData.animation; }, get sittingProgress() { return mode === 'sit' ? 1 : mode === 'sitDown' ? actions.sitDown.time/clips.sitDown.duration : 0; }, get standingProgress() { return mode === 'standUp' ? actions.standUp.time/clips.standUp.duration : wasSeated ? 0 : 1; }, get footClearance() { return root.userData.footClearance; }, get handContactError() { return contactError; }, setShortSteps(value) { shortSteps = value; }, setDoorContact(target, weight, side, normal = new THREE.Vector3(0, 0, 1), grip = false) { doorContact = target ? { target, weight, side, normal, grip } : null; }, setInterior(inside) { fill.intensity = inside ? .55 : .20; } };
}
