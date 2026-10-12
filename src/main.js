import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createWorld, DOOR, SEAT } from './world.js';
import { createCharacter } from './character.js';
import { createPuddles, createRain } from './rain.js';
import { createRainGlass } from './glass.js';
import { createCoffeeSteam } from './coffee-steam.js';
import { bindJoystick, bindSurfaceGestures } from './input.js';
import { doorPose, DOOR_OUTSIDE, DOOR_INSIDE, DOOR_PALM_HEIGHT } from './door.js';
import { orbitPosition, CAFE_CAMERA_BOUNDS } from './camera.js';
import { createWeatherCycle } from './weather.js';
import { prepareSeat, chairNeedsAdjustment, SEAT_APPROACH, CHAIR_READY_Z } from './seating.js';
import { assetUrl } from './assets.js';

const $ = id => document.getElementById(id);
const state = { started: false, inside: false, seated: false, rising: false, rain: 0, rainTarget: 0, wetness: 0, intensity: .68, fog: .65, autoWeather: true, gameTime: 0, elapsed: 0, moving: false, destination: null, destinationAction: null, sound: false, yaw: .35, pitch: .25, distance: 8.0, interact: null };
state.doorTravel = null;
state.seatTravel = null;
state.doorClosing = null;
state.glassActivated = false;
const weather = createWeatherCycle(), seatApproach = new THREE.Vector3().fromArray(SEAT_APPROACH);
const doorOutside = new THREE.Vector3().fromArray(DOOR_OUTSIDE), doorInside = new THREE.Vector3().fromArray(DOOR_INSIDE), handleTarget = new THREE.Vector3(), doorNormal = new THREE.Vector3();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, .1, 140);
const cameraOrbit = { yaw: .35, pitch: .25, distance: 8 };
let renderer, world, girl, puddles, rainfall, glass, coffeeSteam, pipeline;
let toastTimer, running = true, booted = false, captureFrame = 0;
const keys = new Set(), movement = new THREE.Vector3(), focus = new THREE.Vector3(), desiredCamera = new THREE.Vector3(), temp = new THREE.Vector3();
const lastDirection = new THREE.Vector3();
let currentSpeed = 0, actualSpeed = 0, turnRate = 0;
const touchMovement = { x: 0, y: 0 };
let joystick, surfaceGestures;
const touchUI = () => document.body.classList.contains('touch-mode') || window.innerWidth <= 600;
const panelOpen = () => ! $('help').classList.contains('hidden') || ! $('settings').classList.contains('hidden');
function resetInput(stop = false) {
  keys.clear(); joystick?.reset(); surfaceGestures?.reset();
  if (stop) currentSpeed = actualSpeed = 0;
}
function zoomTo(distance) {
  state.distance = THREE.MathUtils.clamp(distance, state.inside ? 2.6 : 3.2, state.inside ? 6 : 18);
}
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const rainAudio = new Audio(assetUrl('rain.mp3')), nightAudio = new Audio(assetUrl('night.mp3'));
rainAudio.loop = nightAudio.loop = true; rainAudio.volume = nightAudio.volume = 0;

function toast(text) {
  $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4200);
}
function begin() {
  if (!booted) return;
  state.started = true; $('opening').classList.add('gone'); $('touch-controls').classList.add('visible'); $('game').focus({ preventScroll: true });
}
async function soundToggle() {
  state.sound = !state.sound;
  if (state.sound) {
    try { await Promise.all([rainAudio.play(), nightAudio.play()]); }
    catch { state.sound = false; toast('环境音暂时无法播放，可以稍后再试。'); }
  } else { rainAudio.pause(); nightAudio.pause(); }
  $('sound-light').classList.toggle('on', state.sound); $('sound').setAttribute('aria-label', state.sound ? '关闭环境音' : '开启环境音');
}
function setWeather(wet, manual = true) {
  if (manual) { state.autoWeather = false; $('auto-weather').checked = false; begin(); }
  if (wet) weather.start(); else weather.stop();
  $('wet').classList.toggle('active', wet); $('dry').classList.toggle('active', !wet);
  $('weather-name').textContent = wet ? '雨正在落下' : '雨前的宁静'; $('weather-icon').textContent = wet ? '☂' : '☾'; $('temperature').textContent = wet ? '17°C' : '19°C';
  $('chapter').textContent = wet ? '02' : '01'; $('caption').textContent = wet ? '雨把灯光，揉进了街道。' : '听见城市，慢慢安静下来。';
  if (wet && state.rain < .12) toast('下雨了。找一家咖啡馆，坐一会儿吧。');
  else if (!wet) toast('雨渐渐停了，积水还留着灯光的倒影。');
}
function setDestination(point, action = null) {
  begin(); state.destination = point.clone(); state.destinationAction = action;
  world.marker.position.set(point.x, state.inside ? .19 : .155, point.z); world.marker.visible = true;
}
function goCafe() {
  if (state.rising || state.doorTravel || state.seatTravel) return;
  if (state.seated) { leaveSeat(); return; }
  if (state.inside) { setDestination(seatApproach, 'sit'); toast(chairNeedsAdjustment(world.windowChair.position.z) ? '走到窗边，调整椅子后坐下。' : '椅子已摆好，走到窗边坐下。'); }
  else { enterCafe(); toast('沿着暖色灯光，前往雨月咖啡馆。'); }
}
function enterCafe() {
  if (girl.root.position.distanceTo(doorOutside) > .08) { setDestination(doorOutside, 'enter'); return; }
  startDoorTravel(true);
}
function enteredCafe() {
  state.yaw = -1.6; state.pitch = .24; state.distance = 4.2;
  seedCameraOrbit();
  $('location-name').textContent = '雨月咖啡馆'; $('location-detail').textContent = '推门入店 · 一杯温热的咖啡'; $('chapter').textContent = '03'; $('caption').textContent = '隔着一扇窗，世界安静了一些。'; $('cafe-action-label').textContent = '去窗边坐下';
  toast(touchUI() ? '到了。点「去窗边坐下」，或用摇杆走到窗边。' : '到了。向左走到窗边，按 E 坐下。');
}
function exitCafe() {
  if (girl.root.position.distanceTo(doorInside) > .08) { setDestination(doorInside, 'exit'); return; }
  startDoorTravel(false);
}
function exitedCafe() {
  state.yaw = .35; state.pitch = .25; state.distance = 8;
  seedCameraOrbit();
  $('location-name').textContent = '雨月街区'; $('location-detail').textContent = '暮色将至 · 街角散步'; $('chapter').textContent = state.rain > .1 ? '02' : '01'; $('caption').textContent = '再走一段，看看街角的灯。'; $('cafe-action-label').textContent = '去咖啡馆';
  toast('推开门，继续今晚的漫游。');
}
function startDoorTravel(entering) {
  resetInput(true); state.destination = state.destinationAction = null; world.marker.visible = false;
  // Use the hand nearest the free side of the pane.
  state.doorTravel = { entering, time: 0, start: girl.root.position.toArray(), phase: 'reach', side: entering ? 'left' : 'right', cameraYaw: state.yaw, cameraPitch: state.pitch };
  state.doorPerformance = { entering, age: 0, frames: 0, maxGapMs: 0, maxUpdateMs: 0, maxCaptureMs: 0, maxRenderMs: 0, slowFrames: [] };
  toast(entering ? '推开门，走进暖和的店里。' : '推开门，回到街道。');
}
function updateDoorTravel(dt) {
  const travel = state.doorTravel; if (!travel) return false;
  travel.time += dt; const pose = doorPose(travel.time, travel.entering, travel.start); travel.phase = pose.phase;
  const previous = girl.root.position.clone(); girl.root.position.fromArray(pose.position);
  actualSpeed = girl.root.position.distanceTo(previous) / Math.max(dt, .001); state.moving = actualSpeed > .025;
  const targetFacing = pose.facing;
  const delta = Math.atan2(Math.sin(targetFacing - girl.root.rotation.y), Math.cos(targetFacing - girl.root.rotation.y));
  girl.root.rotation.y += delta * Math.min(1, dt * 10);
  world.doorPivot.rotation.y = pose.angle; world.doorPivot.updateMatrixWorld(true);
  handleTarget.set(1.73, DOOR_PALM_HEIGHT, travel.entering ? .006 : -.006).applyMatrix4(world.doorPivot.matrixWorld);
  doorNormal.set(0, 0, travel.entering ? 1 : -1).transformDirection(world.doorPivot.matrixWorld);
  girl.setDoorContact(handleTarget, pose.contact, travel.side, doorNormal);
  girl.setShortSteps(pose.shortSteps);
  state.inside = pose.inside;
  if (pose.phase === 'close' || pose.done) {
    // Return control once the character has cleared the door; its closer
    // finishes independently, so walking doesn't wait for the door to shut.
    state.doorClosing = { time: 0, angle: pose.angle };
    girl.setDoorContact(null); state.doorTravel = null; currentSpeed = actualSpeed = 0;
    if (travel.entering) enteredCafe(); else exitedCafe();
  }
  return true;
}
function sit() {
  if (girl.root.position.distanceTo(seatApproach) > .10) { setDestination(seatApproach, 'sit'); return; }
  resetInput(true);
  state.destination = state.destinationAction = null; world.marker.visible = false;
  state.chairContactError = 0;
  state.seatReport = { visit: (state.seatReport?.visit || 0) + 1, chairFrom: world.windowChair.position.z, phases: [], maxContact: 0, maxTorsoTilt: 0 };
  state.seatTravel = { phase: 'prepare', time: 0, start: girl.root.position.toArray(), chairFrom: world.windowChair.position.z };
}
function seatedCafe() {
  state.glassPerformance = { age: 0, frames: 0, capturesBeforeSit: Math.ceil(captureFrame / 2), maxGapMs: 0, maxCaptureMs: 0, maxRenderMs: 0, checkpoints: [] };
  state.glassActivated = true;
  $('location-detail').textContent = '窗边的座位 · 等雨经过'; $('caption').textContent = '看着雨滴滑落，暂时不用赶路。'; $('movement-state').textContent = '窗边听雨'; $('cafe-action-label').textContent = '起身继续';
  if (state.autoWeather || weather.phase !== 'waiting') weather.sit();
  toast(weather.phase === 'growing' ? '坐下了。雨声会渐渐变密，玻璃也会慢慢朦胧。' : '坐下了。在窗边停一会儿，也可以点击「听雨」。');
}
function leaveSeat() {
  resetInput(true);
  weather.stand();
  state.seated = false; state.rising = true;
  $('cafe-action-label').textContent = '去窗边坐下'; $('location-detail').textContent = '准备起身 · 雨声渐轻';
}
function updateSeatTravel(dt) {
  const travel = state.seatTravel; if (!travel) return false;
  travel.time += dt;
  const previous = girl.root.position.clone();
  girl.setDoorContact(null);
  if (travel.phase === 'prepare') {
    const pose = prepareSeat(travel.time, travel.start, travel.chairFrom);
    travel.preparationPhase = pose.phase; travel.contact = pose.contact;
    if (!state.seatReport.phases.includes(pose.phase)) state.seatReport.phases.push(pose.phase);
    state.seatReport.maxContact = Math.max(state.seatReport.maxContact, pose.contact);
    girl.root.position.fromArray(pose.position); world.windowChair.position.z = pose.chairZ;
    const facing = pose.phase === 'around' && !pose.done ? Math.atan2(pose.position[0] - previous.x, pose.position[2] - previous.z) : 0;
    const delta = Math.atan2(Math.sin(facing - girl.root.rotation.y), Math.cos(facing - girl.root.rotation.y));
    girl.root.rotation.y += delta * Math.min(1, dt * 12);
    if (pose.contact > 0) {
      handleTarget.set(SEAT.x + .15, 1.34, pose.chairZ - .323);
      girl.setDoorContact(handleTarget, pose.contact, 'left', doorNormal.set(0, 0, -1));
    }
    girl.setShortSteps(pose.phase !== 'around');
    actualSpeed = girl.root.position.distanceTo(previous) / Math.max(dt, .001); state.moving = actualSpeed > .025;
    if (pose.done) {
      travel.phase = 'lower'; travel.time = 0; state.seated = true; state.moving = false;
      girl.root.rotation.y = 0; girl.setDoorContact(null);
      state.yaw = 1.8; state.pitch = .25; state.distance = 4.2;
    }
  } else if (travel.phase === 'lower') {
    const t = THREE.MathUtils.smoothstep(girl.sittingProgress, .08, .9);
    girl.root.position.set(SEAT.x, SEAT.y, CHAIR_READY_Z + .33 * (1 - t));
    if (girl.sittingProgress >= 1) { girl.root.position.copy(SEAT); state.seatTravel = null; seatedCafe(); }
  }
  return true;
}
function interact() {
  if (state.rising || state.doorTravel || state.seatTravel) return;
  if (state.seated) leaveSeat();
  else if (state.interact === 'enter') enterCafe();
  else if (state.interact === 'sit') sit();
  else if (state.interact === 'exit') exitCafe();
}
function collision(p) {
  p.x = THREE.MathUtils.clamp(p.x, state.inside ? -12.85 : -29, state.inside ? -3.95 : 28);
  const doorway = p.x > -5.05 && p.x < -3.7;
  p.z = THREE.MathUtils.clamp(p.z, state.inside ? -7.45 : doorway ? -1.02 : -.23, state.inside ? doorway ? -1.55 : -2.45 : 10.2);
  if (state.inside) {
    // Counter and back bar occupy real space, leaving the aisle navigable.
    if (p.x > -6.8 && p.z < -5.48) p.z = -5.48;
    // Counter rear edge (-2.355) plus body clearance. This also admits the
    // new chair's standing position, so the first step does not snap backward.
    if (p.x < -8.0 && p.z > -2.58) p.z = -2.58;
  }
  p.y = state.inside ? .18 : p.z < .35 ? .14 : 0;
  return p;
}
function updateMovement(dt) {
  state.moving = false; actualSpeed = 0; turnRate = 0;
  girl.setShortSteps(false);
  if (updateSeatTravel(dt)) return;
  if (updateDoorTravel(dt)) return;
  if (!state.started || state.seated || state.rising || panelOpen()) return;
  movement.set(0, 0, 0);
  const forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - touchMovement.y;
  const side = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + touchMovement.x;
  let strength = 1;
  if (forward || side) {
    movement.set(side * Math.cos(state.yaw) - forward * Math.sin(state.yaw), 0, -side * Math.sin(state.yaw) - forward * Math.cos(state.yaw));
    strength = Math.min(1, Math.hypot(forward, side));
    state.destination = null; state.destinationAction = null; world.marker.visible = false;
  } else if (state.destination) {
    movement.subVectors(state.destination, girl.root.position); movement.y = 0;
    if (movement.length() < (state.destinationAction ? .06 : .24)) {
      const action = state.destinationAction; state.destination = null; state.destinationAction = null; world.marker.visible = false;
      if (action === 'enter') enterCafe(); else if (action === 'exit') exitCafe(); else if (action === 'sit') sit();
      return;
    }
  }
  const requested = movement.lengthSq() > .0001;
  const speed = state.inside ? 1.12 : state.rain > .16 ? 2.65 : 1.30;
  currentSpeed = THREE.MathUtils.damp(currentSpeed, requested ? speed * strength : 0, requested ? 7 : 14, dt);
  if (requested) lastDirection.copy(movement.normalize());
  if (currentSpeed > .025) {
    const step = Math.min(currentSpeed * dt, .16, state.destination ? state.destination.distanceTo(girl.root.position) : Infinity);
    temp.copy(girl.root.position).addScaledVector(lastDirection, step); collision(temp);
    actualSpeed = temp.distanceTo(girl.root.position) / Math.max(dt, .001);
    state.moving = actualSpeed > .025; girl.root.position.copy(temp);
    let delta = Math.atan2(lastDirection.x, lastDirection.z) - girl.root.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    turnRate = THREE.MathUtils.clamp(delta * 8, -2, 2); girl.root.rotation.y += delta * Math.min(1, dt * 8);
    if (state.moving && state.wetness > .2 && Math.floor(state.elapsed * 5) !== Math.floor((state.elapsed - dt) * 5) && !state.inside) rainfall.impact(temp.x, temp.z, .6);
  }
}
function updateInteraction() {
  let next = null, text = '';
  if (state.rising || state.doorTravel || state.seatTravel) { next = null; }
  else if (state.seated) { next = 'stand'; text = '起身，继续漫游'; }
  else if (!state.inside && girl.root.position.distanceTo(DOOR) < 2.4) { next = 'enter'; text = '推门进入 · 雨月咖啡馆'; }
  else if (state.inside && girl.root.position.distanceTo(SEAT) < 2.0) { next = 'sit'; text = '坐在落地窗前'; }
  else if (state.inside && girl.root.position.x > -6 && girl.root.position.z > -4.2) { next = 'exit'; text = '推门回到街道'; }
  state.interact = next; $('interaction').classList.toggle('hidden', !next || !state.started); $('interaction-text').textContent = text;
  $('interact-button').setAttribute('aria-label', text || '执行交互');
  $('touch-interact').classList.toggle('hidden', !next || !state.started);
  $('touch-action-label').textContent = next === 'enter' ? '进入咖啡馆' : next === 'exit' ? '回到街道' : next === 'sit' ? '窗边坐下' : '起身继续';
  $('touch-interact').setAttribute('aria-label', text || '与场景交互');
  $('joystick').disabled = state.seated || state.rising || Boolean(state.doorTravel || state.seatTravel) || panelOpen();
  $('touch-controls').classList.toggle('controls-hidden', panelOpen());
}
function seedCameraOrbit() {
  const offset = camera.position.clone().sub(girl.root.position).sub(new THREE.Vector3(0, state.inside ? 1.15 : 1.36, 0));
  cameraOrbit.yaw = Math.atan2(offset.x, offset.z);
  cameraOrbit.pitch = Math.atan2(offset.y, Math.hypot(offset.x, offset.z));
  cameraOrbit.distance = offset.length();
}
function updateCamera(dt) {
  const yawDelta = Math.atan2(Math.sin(state.yaw - cameraOrbit.yaw), Math.cos(state.yaw - cameraOrbit.yaw));
  cameraOrbit.yaw += yawDelta * (1 - Math.exp(-dt * 8));
  cameraOrbit.pitch = THREE.MathUtils.damp(cameraOrbit.pitch, state.pitch, 8, dt);
  cameraOrbit.distance = THREE.MathUtils.damp(cameraOrbit.distance, state.distance, 8, dt);
  if (!state.started) { desiredCamera.set(camera.aspect < 1 ? 4.2 : 5.0, 4.4, 12.0); focus.set(camera.aspect < 1 ? -1.2 : -3.8, 2.1, -.8); }
  else if (state.doorTravel) {
    const travel = state.doorTravel, indoor = THREE.MathUtils.smoothstep(travel.time, .45, 3.0);
    const t = travel.entering ? indoor : 1 - indoor;
    desiredCamera.set(-6.0, 2.65, 2.40).lerp(new THREE.Vector3(-6.9, 2.6, -4.5), t);
    focus.copy(girl.root.position).add(new THREE.Vector3(0, 1.25, 0));
    desiredCamera.sub(focus).applyAxisAngle(THREE.Object3D.DEFAULT_UP, state.yaw - travel.cameraYaw).add(focus);
    desiredCamera.y += (state.pitch - travel.cameraPitch) * 3;
  }
  else if (state.seated || state.rising) {
    focus.copy(girl.root.position).add(new THREE.Vector3(0, 1.04, 0));
    desiredCamera.fromArray(orbitPosition(focus.toArray(), cameraOrbit.yaw, cameraOrbit.pitch, cameraOrbit.distance, CAFE_CAMERA_BOUNDS));
  } else {
    focus.copy(girl.root.position).add(new THREE.Vector3(0, state.inside ? 1.15 : 1.36, state.inside ? 0 : -1.8 * THREE.MathUtils.smoothstep(state.distance, 3.2, 8)));
    desiredCamera.fromArray(orbitPosition(focus.toArray(), cameraOrbit.yaw, cameraOrbit.pitch, cameraOrbit.distance, state.inside ? CAFE_CAMERA_BOUNDS : null));
    if (!state.inside) desiredCamera.z = THREE.MathUtils.clamp(desiredCamera.z, .8, 16.8);
  }
  // Smooth spherical coordinates. A straight position lerp between opposite
  // views cuts through the character instead of travelling around her.
  if (state.started && !state.doorTravel) camera.position.copy(desiredCamera);
  else camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 4));
  const baseFov = camera.aspect < .8 ? 60 : 48;
  const nearWallFov = THREE.MathUtils.radToDeg(2 * Math.atan(1.25 / Math.max(.3, camera.position.distanceTo(focus)))) + 6;
  const targetFov = state.inside && !state.doorTravel ? Math.max(baseFov, Math.min(86, nearWallFov)) : baseFov;
  camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 8, dt); camera.updateProjectionMatrix();
  if (!camera.userData.focus) camera.userData.focus = focus.clone(); camera.userData.focus.lerp(focus, 1 - Math.exp(-dt * 5)); camera.lookAt(camera.userData.focus);
}
function resize() {
  const rect = $('viewport').getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(ratio); renderer.setSize(rect.width, rect.height); camera.aspect = rect.width / rect.height; camera.fov = camera.aspect < .8 ? 60 : 48; camera.updateProjectionMatrix(); glass.resize(rect.width * ratio, rect.height * ratio);
}
function bindControls() {
  $('start').onclick = begin; $('sound').onclick = soundToggle; $('wet').onclick = () => setWeather(true); $('dry').onclick = () => setWeather(false);
  $('go-cafe').onclick = goCafe; $('help-cafe').onclick = () => { $('help').classList.add('hidden'); goCafe(); }; $('interact-button').onclick = interact;
  $('touch-interact').onclick = interact;
  $('zoom-in').onclick = () => zoomTo(state.distance / 1.2); $('zoom-out').onclick = () => zoomTo(state.distance * 1.2);
  for (const panel of ['settings', 'help']) $(panel + '-button').onclick = () => { resetInput(true); $(panel).classList.toggle('hidden'); $(panel === 'settings' ? 'help' : 'settings').classList.add('hidden'); updateInteraction(); };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { $(b.dataset.close).classList.add('hidden'); updateInteraction(); });
  $('rain-intensity').oninput = e => { state.intensity = Number(e.target.value); $('rain-label').textContent = state.intensity < .4 ? '细雨' : state.intensity < .75 ? '绵雨' : '大雨'; };
  $('fog-intensity').oninput = e => { state.fog = Number(e.target.value); $('fog-label').textContent = state.fog < .25 ? '清透' : state.fog < .8 ? '自然' : '朦胧'; };
  $('auto-weather').onchange = e => { state.autoWeather = e.target.checked; if (state.autoWeather) { state.gameTime = 0; weather.reset(); } };
  window.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (panelOpen() && e.code !== 'Escape') return;
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','Space'].includes(e.code)) {
      e.preventDefault(); if (!state.started) begin();
      if (e.code === 'KeyE' && !e.repeat) interact(); else keys.add(e.code);
    }
    if (e.code === 'Escape') { $('help').classList.add('hidden'); $('settings').classList.add('hidden'); state.destination = null; world.marker.visible = false; }
  });
  window.addEventListener('keyup', e => keys.delete(e.code)); window.addEventListener('blur', () => resetInput(true));
  const coarsePointer = matchMedia('(any-pointer: coarse)');
  let touched = false;
  function updateTouchMode() { document.body.classList.toggle('touch-mode', coarsePointer.matches || touched || $('touch-layout').checked); }
  updateTouchMode();
  coarsePointer.addEventListener('change', () => { updateTouchMode(); resetInput(true); updateInteraction(); });
  $('touch-layout').onchange = () => { updateTouchMode(); resetInput(true); updateInteraction(); };
  window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { touched = true; updateTouchMode(); } }, { capture: true });
  const surface = renderer.domElement;
  surfaceGestures = bindSurfaceGestures(surface, { onOrbit(dx, dy) {
    if (panelOpen()) return;
    state.yaw -= dx * .006; state.pitch = THREE.MathUtils.clamp(state.pitch + dy * .004, .15, .85);
  }, onZoom(factor) { if (!panelOpen()) zoomTo(state.distance * factor); }, onTap(x, y) {
    if (state.seated || state.rising || state.doorTravel || state.seatTravel || panelOpen() || Math.hypot(touchMovement.x, touchMovement.y) > .01) return;
    const rect = surface.getBoundingClientRect(); pointer.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2);
    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3(); if (raycaster.ray.intersectPlane(plane, hit)) { collision(hit); setDestination(hit); }
  } });
  surface.addEventListener('wheel', e => { e.preventDefault(); if (!panelOpen()) zoomTo(state.distance + e.deltaY * .007); }, { passive: false });
  joystick = bindJoystick($('joystick'), { onStart: begin, onChange(value) {
    touchMovement.x = value.x; touchMovement.y = value.y;
    $('joystick-thumb').style.transform = `translate(${value.thumbX}px, ${value.thumbY}px)`;
    $('joystick').classList.toggle('active', Boolean(value.x || value.y));
  } });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (!running) { resetInput(true); rainAudio.pause(); nightAudio.pause(); } else if (state.sound) { rainAudio.play().catch(() => {}); nightAudio.play().catch(() => {}); } });
}
async function prepareDoorRendering() {
  const cameraPosition = camera.position.clone(), cameraRotation = camera.quaternion.clone();
  const girlPosition = girl.root.position.clone(), girlRotation = girl.root.quaternion.clone(), angle = world.doorPivot.rotation.y;
  try {
    for (const entering of [true, false]) for (const time of [.45, 1.2, 2.1, 3.6]) {
      const pose = doorPose(time, entering), indoor = THREE.MathUtils.smoothstep(time, .45, 3);
      const blend = entering ? indoor : 1 - indoor;
      girl.root.position.fromArray(pose.position); girl.root.rotation.y = pose.facing; girl.setInterior(pose.inside);
      world.doorPivot.rotation.y = pose.angle;
      camera.position.set(-6, 2.65, 2.4).lerp(new THREE.Vector3(-6.9, 2.6, -4.5), blend);
      camera.lookAt(girl.root.position.clone().add(new THREE.Vector3(0, 1.25, 0))); camera.updateMatrixWorld();
      // Reflector nodes update once per animation frame. compileAsync and a
      // same-frame indoor capture do not warm the nested reflection path that
      // runs when capture becomes the first render during an actual doorway crossing.
      await new Promise(resolve => requestAnimationFrame(resolve));
      pipeline.render(); // Outside: ScenePass owns the frame's first reflection update.
      await new Promise(resolve => requestAnimationFrame(resolve));
      glass.capture(scene, camera); pipeline.render();
    }
  } finally {
    girl.root.position.copy(girlPosition); girl.root.quaternion.copy(girlRotation); girl.setInterior(false);
    world.doorPivot.rotation.y = angle; world.doorPivot.updateMatrixWorld(true);
    camera.position.copy(cameraPosition); camera.quaternion.copy(cameraRotation); camera.updateMatrixWorld();
  }
}
async function boot() {
  try {
    const forceWebGL = new URLSearchParams(location.search).has('webgl');
    renderer = new THREE.WebGPURenderer({ antialias: true, alpha: false, forceWebGL, powerPreference: 'high-performance' });
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .86; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    $('viewport').appendChild(renderer.domElement); await renderer.init();
    renderer.backend.device?.addEventListener('uncapturederror', event => {
      if (!document.body.dataset.gpuError) { document.body.dataset.gpuError = event.error.message; console.error('GPU FIRST ERROR:', event.error.message); }
    });
    world = createWorld(scene); girl = await createCharacter(world); scene.add(girl.root); girl.root.position.set(.5, 0, 3.8); girl.root.rotation.y = .5;
    const hdr = await new HDRLoader().loadAsync(assetUrl('city.hdr'));
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    scene.environmentIntensity = .30;
    hdr.dispose(); pmrem.dispose();
    puddles = createPuddles(scene, world); rainfall = createRain(scene); glass = createRainGlass(world.glass, renderer, scene.environment);
    coffeeSteam = createCoffeeSteam(scene, world.coffeeSources);
    pipeline = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera), sceneColor = scenePass.getTextureNode('output');
    pipeline.outputNode = sceneColor.add(bloom(sceneColor, .32, .35, 1.25));
    camera.position.set(5, 4.4, 12); camera.lookAt(-3.8, 2.1, -.8); resize(); bindControls();
    $('loading-text').textContent = '准备窗边雨景与咖啡热气…';
    await glass.prepare(scene, camera, scenePass, pipeline);
    $('loading-text').textContent = '准备推门视角与室内倒影…';
    await prepareDoorRendering();
    $('viewport').dataset.doorPrepared = 'true';
    $('renderer-label').textContent = `Three.js r${THREE.REVISION} · ${renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2 兼容模式'} · 3D 实时渲染`;
    $('loading-text').textContent = '街灯亮了，出发吧。';
    let previous = performance.now(), hudTime = 0;
    renderer.setAnimationLoop(() => {
      const now = performance.now(), frameGap = now - previous, dt = Math.min(.05, frameGap / 1000); previous = now; if (!running) return;
      state.elapsed += dt; if (state.started) state.gameTime += dt;
      const previousWeather = weather.phase;
      state.rainTarget = weather.update(dt, { auto: state.autoWeather, gameTime: state.gameTime, maximum: state.intensity });
      if (previousWeather === 'waiting' && weather.phase === 'growing') setWeather(true, false);
      state.rain = THREE.MathUtils.damp(state.rain, state.rainTarget, .65, dt);
      state.wetness = THREE.MathUtils.damp(state.wetness, state.rain > .05 ? Math.min(1, state.rain * 1.35) : 0, state.rain > .05 ? .075 : .027, dt);
      if (state.doorClosing) {
        state.doorClosing.time += dt;
        world.doorPivot.rotation.y = state.doorClosing.angle * (1 - THREE.MathUtils.smoothstep(state.doorClosing.time, 0, .7));
        if (state.doorClosing.time >= .7) state.doorClosing = null;
      }
      updateMovement(dt); girl.setInterior(state.inside); girl.update(dt, state.moving, state.inside ? 0 : state.rain, state.seated, state.elapsed, actualSpeed, turnRate);
      if (state.seatTravel?.phase === 'prepare') state.seatReport.maxTorsoTilt = Math.max(state.seatReport.maxTorsoTilt, Number(girl.root.userData.torsoTilt));
      if (state.seatTravel?.phase === 'prepare' && state.seatTravel.time > 1.2 && state.seatTravel.time < 1.6) state.chairContactError = Math.max(state.chairContactError, girl.handContactError);
      if (state.rising) {
        const progress = girl.standingProgress;
        girl.root.position.set(SEAT.x, SEAT.y, CHAIR_READY_Z + .29 * THREE.MathUtils.smoothstep(progress, .55, 1));
        if (progress >= 1) { state.rising = false; $('location-detail').textContent = '温暖的店内 · 自由漫步'; }
      }
      updateCamera(dt);
      coffeeSteam.update(dt, camera);
      scene.fog.color.lerp(new THREE.Color(state.rain > .15 ? '#172e51' : '#304764'), dt * .15); scene.background.copy(scene.fog.color);
      world.hemi.intensity = 1.25 - state.rain * .48;
      puddles.update(state.elapsed, state.rain, state.wetness); rainfall.update(dt, state.rain, girl.root.position, camera); glass.update(dt, state.rain, state.fog, state.inside, state.glassActivated);
      if (state.sound) { rainAudio.volume = THREE.MathUtils.damp(rainAudio.volume, state.rain * (state.inside ? .28 : .65), 2, dt); nightAudio.volume = THREE.MathUtils.damp(nightAudio.volume, state.inside ? .05 : .22 * (1 - state.rain * .6), 2, dt); }
      // Keep the background ready while walking inside, even while the pane is
      // clear. Sitting only starts the wetting uniforms, not a new render path.
      const captureStart = performance.now();
      if (state.inside) glass.renderWater(camera);
      if (state.inside && captureFrame++ % 2 === 0) glass.capture(scene, camera);
      const renderStart = performance.now();
      pipeline.render();
      const report = state.glassPerformance;
      const doorReport = state.doorPerformance;
      if (doorReport && doorReport.age < 7) {
        doorReport.age += frameGap / 1000; doorReport.frames++;
        const captureMs = renderStart - captureStart, renderMs = performance.now() - renderStart, updateMs = captureStart - now;
        doorReport.maxGapMs = Math.max(doorReport.maxGapMs, frameGap); doorReport.maxUpdateMs = Math.max(doorReport.maxUpdateMs, updateMs);
        doorReport.maxCaptureMs = Math.max(doorReport.maxCaptureMs, captureMs); doorReport.maxRenderMs = Math.max(doorReport.maxRenderMs, renderMs);
        if (frameGap > 80 || captureMs > 80 || renderMs > 80) doorReport.slowFrames.push({ age: +doorReport.age.toFixed(2), phase: state.doorTravel?.phase || 'finished', gap: +frameGap.toFixed(1), update: +updateMs.toFixed(1), capture: +captureMs.toFixed(1), render: +renderMs.toFixed(1) });
      }
      if (report && report.age < 12) {
        report.age += frameGap / 1000; report.frames++;
        report.maxGapMs = Math.max(report.maxGapMs, frameGap);
        report.maxCaptureMs = Math.max(report.maxCaptureMs, renderStart - captureStart);
        report.maxRenderMs = Math.max(report.maxRenderMs, performance.now() - renderStart);
        if (report.checkpoints.length < Math.ceil(report.age * 2)) report.checkpoints.push({ age: +report.age.toFixed(2), gapMs: +frameGap.toFixed(1), captureMs: +(renderStart - captureStart).toFixed(1), drops: +glass.getDropAmount().toFixed(3), fog: +glass.getFog().toFixed(3), coverage: +glass.getCoverage().toFixed(3) });
      }
      if (!booted) { booted = true; $('loader').classList.add('done'); }
      hudTime += dt;
      if (hudTime > .16) {
        hudTime = 0; updateInteraction(); $('movement-state').textContent = state.doorTravel ? ({reach:'掌心贴住玻璃',push:'边推门边走',clear:'绕过门板',walk:state.doorTravel.entering?'走入店内':'走回街道',close:'门缓缓合上'}[state.doorTravel.phase]) : state.seatTravel ? ({prepare:state.seatTravel.preparationPhase==='adjust'?'调整椅子':'走向座位',lower:'正在坐下'}[state.seatTravel.phase]) : state.seated ? '窗边听雨' : state.rising ? '正在起身' : state.inside ? '店内漫步' : state.rain > .16 ? '雨中小跑' : '自在漫步';
        const raining = state.rain > .02;
        $('weather-name').textContent = weather.phase === 'easing' && raining ? '雨声渐轻' : raining ? state.rain < .2 ? '细雨初落' : state.rain < .55 ? '雨势渐密' : '绵密的雨夜' : weather.phase === 'dry' ? '雨渐渐停了' : '雨前的宁静';
        $('weather-icon').textContent = raining ? '☂' : '☾';
        $('wet').classList.toggle('active', weather.phase === 'growing' || weather.phase === 'easing'); $('dry').classList.toggle('active', weather.phase === 'waiting' || weather.phase === 'dry');
        const minute = 24 + Math.floor(state.gameTime / 18); $('clock').textContent = `${18 + Math.floor(minute / 60)}:${String(minute % 60).padStart(2,'0')}`;
        Object.assign($('viewport').dataset, { backend: renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2', rain: state.rain.toFixed(3), wetness: state.wetness.toFixed(3), fog: glass.getFog().toFixed(3), glassRain: glass.getDropAmount().toFixed(3), inside: String(state.inside), seated: String(state.seated), moving: String(state.moving), playerX: girl.root.position.x.toFixed(2), playerZ: girl.root.position.z.toFixed(2), animation: girl.animation, speed: actualSpeed.toFixed(2), footClearance: girl.footClearance.toFixed(4), cameraDistance: state.distance.toFixed(2), cameraYaw: state.yaw.toFixed(2), inputX: touchMovement.x.toFixed(2), inputY: touchMovement.y.toFixed(2) });
        Object.assign($('viewport').dataset, { doorPhase: state.doorTravel?.phase || 'idle', doorAngle: world.doorPivot.rotation.y.toFixed(3), handContact: girl.handContactError.toFixed(3), reachSpan: girl.root.userData.reachSpan || '' });
        Object.assign($('viewport').dataset, { palmAngle: girl.root.userData.palmAngle, fingerCurl: girl.root.userData.fingerCurl, headTilt: girl.root.userData.headTilt, torsoTilt: girl.root.userData.torsoTilt, seatPreparationPhase: state.seatTravel?.preparationPhase || 'none', chairContact: (state.seatTravel?.contact || 0).toFixed(3), seatReport: JSON.stringify(state.seatReport || null), pose: girl.root.userData.pose, cameraX: camera.position.x.toFixed(2), cameraZ: camera.position.z.toFixed(2) });
        Object.assign($('viewport').dataset, { weatherPhase: weather.phase, rainTarget: state.rainTarget.toFixed(3), glassFlow: glass.getFlowRate().toFixed(3), glassActivated: String(state.glassActivated), seatPhase: state.seatTravel?.phase || 'idle', chairZ: world.windowChair.position.z.toFixed(3), chairContactError: (state.chairContactError || 0).toFixed(3), steamParticles: String(coffeeSteam.count) });
        $('viewport').dataset.glassPerformance = JSON.stringify(state.glassPerformance || null);
        $('viewport').dataset.glassPrepared = String(glass.getPrepared());
        $('viewport').dataset.glassCoverage = glass.getCoverage().toFixed(3);
        $('viewport').dataset.glassStats = JSON.stringify(glass.getStats());
        $('viewport').dataset.doorPerformance = JSON.stringify(state.doorPerformance || null);
      }
    });
    // Read-only diagnostics for local verification and future development.
    window.__RAINMOON__ = { state, scene, camera, renderer, girl, world, glass, version: THREE.REVISION, get backend() { return renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2'; } };
  } catch (error) {
    console.error('RainMoon initialization failed:', error); $('loading-text').textContent = '场景加载失败，请刷新重试。';
    const retry = document.createElement('button'); retry.className = 'secondary'; retry.textContent = '使用兼容模式打开'; retry.onclick = () => { location.search = '?webgl'; }; $('loader').appendChild(retry);
  }
}
boot();
