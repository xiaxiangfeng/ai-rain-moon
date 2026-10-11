import * as THREE from 'three/webgpu';
import { createWorld } from '../src/world.js';
import { createCharacter } from '../src/character.js';
import { doorPose, DOOR_DURATION, DOOR_PALM_HEIGHT } from '../src/door.js';
import { createDoorMeshCheck } from './door-mesh-check.js';
import { createCoffeeSteam } from '../src/coffee-steam.js';

const scene = new THREE.Scene(), world = createWorld(scene), girl = await createCharacter(world); scene.add(girl.root);
const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: new URLSearchParams(location.search).has('webgl') });
await renderer.init(); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .86;
renderer.shadowMap.enabled = true; renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); document.body.append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(42, 1, .1, 140), handle = new THREE.Vector3(), normal = new THREE.Vector3();
let entering = true, time = 1.4, play = false, closeUp = false, facade = false, storeView = false, acView = false, elapsed = 0, last = performance.now();
const inspect = createDoorMeshCheck(girl);
const coffeeSteam = createCoffeeSteam(scene, world.coffeeSources);
let coffeeView = false;
document.getElementById('coffee-view').onclick = () => { coffeeView = !coffeeView; storeView = acView = closeUp = facade = false; };
let scan = null, scanResult = null;
document.getElementById('scan').onclick = () => { scan = { time: 0, entering: true, crossings: 0, samples: 0, worst: null, closest: 100 }; scanResult = null; };
document.getElementById('store-view').onclick = () => { storeView = !storeView; acView = closeUp = facade = false; };
document.getElementById('ac-view').onclick = () => { acView = !acView; storeView = closeUp = facade = false; };
document.getElementById('palm-view').onclick = () => { closeUp = !closeUp; storeView = acView = facade = false; };
document.getElementById('facade-view').onclick = () => { facade = !facade; storeView = acView = closeUp = false; };
document.querySelectorAll('[data-direction]').forEach(b => b.onclick = () => {
  entering = b.dataset.direction === 'enter';
  document.querySelectorAll('[data-direction]').forEach(c => c.classList.toggle('active', c === b));
});
document.querySelectorAll('[data-time]').forEach(b => b.onclick = () => { play = b.dataset.time === 'play'; time = play ? 0 : +b.dataset.time; });
function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }
addEventListener('resize', resize); resize();
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min((now - last) / 1000, .033); last = now; elapsed += dt; if (play) time = (time + dt) % (DOOR_DURATION + 1);
  if (scan) { time = scan.time; entering = scan.entering; }
  const pose = doorPose(time, entering), a = doorPose(time - .01, entering), b = doorPose(time + .01, entering);
  girl.root.position.fromArray(pose.position); girl.root.rotation.y = pose.facing;
  world.doorPivot.rotation.y = pose.angle; world.doorPivot.updateMatrixWorld(true);
  handle.set(1.73, DOOR_PALM_HEIGHT, entering ? .006 : -.006).applyMatrix4(world.doorPivot.matrixWorld);
  normal.set(0, 0, entering ? 1 : -1).transformDirection(world.doorPivot.matrixWorld);
  girl.setDoorContact(handle, pose.contact, entering ? 'left' : 'right', normal);
  const speed = Math.hypot(...a.position.map((v, i) => v - b.position[i])) / .02;
  girl.setShortSteps(pose.shortSteps); girl.setInterior(pose.inside); girl.update(scan ? .05 : dt, speed > .025, 0, false, elapsed, speed);
  camera.position.set(entering ? -6.35 : -3.95, 2.55, entering ? 1.6 : -4.0);
  if (coffeeView) { camera.position.set(-9.6, 1.85, -3.5); camera.lookAt(-10.2, 1.60, -2.20); }
  else if (storeView) { camera.position.set(6.25, 2.6, 4.0); camera.lookAt(4.9, 1.8, -4.9); }
  else if (acView) { camera.position.set(9.4, 6.1, 3.0); camera.lookAt(7.75, 5.8, -1.6); }
  else if (facade) { camera.position.set(15, 3.5, 3.5); camera.lookAt(15, 2.9, -2.1); }
  else if (closeUp) { camera.position.copy(handle).addScaledVector(normal, -1.35).add(new THREE.Vector3(entering ? -.45 : .45, .25, 0)); camera.lookAt(handle); }
  else camera.lookAt(-4.4, 1.45, -1.4);
  if (scan) {
    const result = inspect(world.doorPivot, pose.contact > 0 ? (entering ? 'left' : 'right') : null);
    scan.samples++; scan.crossings += result.crossings;
    if (result.closest !== null) scan.closest = Math.min(scan.closest,result.closest);
    if (result.crossings > (scan.worst?.crossings || 0)) scan.worst = { entering, time: +time.toFixed(2), phase: pose.phase, ...result };
    scan.time += .05;
    if (scan.time > DOOR_DURATION) {
      if (scan.entering) { scan.entering = false; scan.time = 0; }
      else { scanResult = scan; scan = null; }
    }
  }
  coffeeSteam.update(dt, camera); renderer.render(scene, camera);
  const status = document.getElementById('status');
  status.textContent = `${renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2'} · ${pose.phase} · 手掌误差 ${girl.handContactError.toFixed(3)}m · 掌面夹角 ${girl.root.userData.palmAngle}° · 伸臂 ${girl.root.userData.reachSpan || ''}`;
  if (scan || scanResult) status.textContent += ` · 检查 ${scan?.samples || scanResult.samples} 帧 · 穿模 ${scan?.crossings ?? scanResult.crossings}`;
  Object.assign(document.body.dataset, { scan: scan ? 'running' : scanResult ? 'done' : 'idle', scanResult: JSON.stringify(scanResult), scanSamples: String(scan?.samples || 0) });
  Object.assign(document.body.dataset, { phase: pose.phase, handContact: girl.handContactError.toFixed(3), palmAngle: girl.root.userData.palmAngle, playerZ: girl.root.position.z.toFixed(3), reachSpan: girl.root.userData.reachSpan || '' });
});
