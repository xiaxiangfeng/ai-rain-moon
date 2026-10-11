import * as THREE from 'three/webgpu';
import { createWorld } from '../src/world.js';
import { createCharacter } from '../src/character.js';
import { prepareSeat, SEAT_POSITION, CHAIR_OPEN_Z, CHAIR_READY_Z } from '../src/seating.js';

const scene = new THREE.Scene(), world = createWorld(scene), girl = await createCharacter(world); scene.add(girl.root);
const renderer = new THREE.WebGPURenderer({ antialias: true }); await renderer.init();
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .86;
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); document.body.append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(42,1,.1,140), target = new THREE.Vector3(), normal = new THREE.Vector3(0,0,-1), q = new THREE.Quaternion();
let chairFrom = CHAIR_OPEN_Z, time = 1.55, playing = false, holding = false, heldTime = 0, last = performance.now(), elapsed = 0, maxTilt = 0;
document.getElementById('first').onclick = () => { holding = false; chairFrom = CHAIR_OPEN_Z; time = playing ? 0 : 1.55; maxTilt = 0; };
document.getElementById('repeat').onclick = () => { holding = false; chairFrom = CHAIR_READY_Z; time = playing ? 0 : 1.55; maxTilt = 0; };
document.getElementById('hold').onclick = () => { holding = true; heldTime = 0; playing = false; chairFrom = CHAIR_OPEN_Z; time = 1.55; maxTilt = 0; };
document.getElementById('inspect').onclick = () => { playing = false; time = 1.55; maxTilt = 0; };
document.getElementById('play').onclick = () => { holding = false; playing = true; time = 0; maxTilt = 0; };
function resize() { camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); }
addEventListener('resize',resize); resize();
renderer.setAnimationLoop(() => {
  const now=performance.now(),dt=Math.min(.033,(now-last)/1000);last=now;elapsed+=dt;
  if(playing)time+=dt;
  const pose=prepareSeat(time,undefined,chairFrom),previous=prepareSeat(time-.005,undefined,chairFrom),next=prepareSeat(time+.005,undefined,chairFrom);
  if(pose.done)playing=false;
  girl.root.position.fromArray(pose.position); world.windowChair.position.z=pose.chairZ;
  girl.root.rotation.y=pose.phase==='around'&&!pose.done?Math.atan2(next.position[0]-previous.position[0],next.position[2]-previous.position[2]):0;
  target.set(SEAT_POSITION[0]+.15,1.34,pose.chairZ-.323);
  girl.setDoorContact(pose.contact>0?target:null,pose.contact,'left',normal);
  girl.setShortSteps(pose.phase!=='around'); girl.setInterior(true);
  const speed=holding?0:Math.hypot(...next.position.map((v,i)=>v-previous.position[i]))/.01;
  girl.update(dt,speed>.025,0,false,elapsed,speed);
  girl.vrm.humanoid.getNormalizedBoneNode('upperChest').getWorldQuaternion(q);
  const torsoTilt=THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(new THREE.Vector3(0,1,0).applyQuaternion(q).y,-1,1)));
  maxTilt=Math.max(maxTilt,torsoTilt);
  if(holding)heldTime+=dt;
  camera.position.set(-7.9,2.5,-5.2);camera.lookAt(-10.25,1.25,pose.chairZ-.20);
  renderer.render(scene,camera);
  document.getElementById('status').textContent=`${chairFrom===CHAIR_OPEN_Z?'首次':'再次'} · ${pose.phase} · 躯干 ${torsoTilt.toFixed(2)}° · 最大 ${maxTilt.toFixed(2)}° · 手掌误差 ${girl.handContactError.toFixed(3)}m`;
  Object.assign(document.body.dataset,{visit:chairFrom===CHAIR_OPEN_Z?'first':'repeat',phase:pose.phase,torsoTilt:torsoTilt.toFixed(2),maxTilt:maxTilt.toFixed(2),contact:pose.contact.toFixed(3),handError:girl.handContactError.toFixed(3),chairZ:pose.chairZ.toFixed(3),heldTime:heldTime.toFixed(2)});
});
