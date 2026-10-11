
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCharacter } from '../src/character.js';
const scene = new THREE.Scene();scene.background = new THREE.Color('#354653');
const renderer = new THREE.WebGPURenderer({antialias:true,forceWebGL:new URLSearchParams(location.search).has('webgl')});await renderer.init();renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;document.body.append(renderer.domElement);
const hemi = new THREE.HemisphereLight('#e1edf6','#545a64',1.7);scene.add(hemi);
const moonLight = new THREE.DirectionalLight('#fff1df',1.8);moonLight.position.set(-3,5,5);moonLight.castShadow=true;scene.add(moonLight);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshStandardMaterial({color:'#526472',roughness:.95}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const girl=await createCharacter({hemi,moonLight});scene.add(girl.root);
const chair=new THREE.Group();for(const x of [-.25,.25])for(const z of [-.24,.24]){const m=new THREE.Mesh(new THREE.BoxGeometry(.05,.65,.05),new THREE.MeshStandardMaterial({color:'#263843'}));m.position.set(x,.325,z);chair.add(m)}
const cushion=new THREE.Mesh(new THREE.BoxGeometry(.65,.08,.58),new THREE.MeshStandardMaterial({color:'#81917e'}));cushion.position.y=.620;chair.add(cushion);scene.add(chair);chair.visible=false;
const camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.01,80);camera.position.set(0,1.3,4.8);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.08,0);controls.update();
let action='idle',clock=0,last=performance.now();
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{action=b.dataset.action;chair.visible=action==='sit';document.querySelectorAll('[data-action]').forEach(c=>c.classList.toggle('active',c===b));});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{const view=b.dataset.view;const p={front:[0,1.3,4.8],side:[4.8,1.3,.15],back:[0,1.3,-4.8],face:[0,1.9,1.2]}[view];camera.position.fromArray(p);controls.target.set(0,view==='face'?1.88:1.08,0);controls.update();});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
renderer.setAnimationLoop(()=>{const now=performance.now(),dt=Math.min((now-last)/1000,.033);last=now;clock+=dt;girl.update(dt,action==='walk'||action==='jog',action==='jog'?1:0,action==='sit',clock,action==='walk'?1.3:action==='jog'?2.65:0);controls.update();renderer.render(scene,camera);document.getElementById('status').textContent=`${renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2'} · ${girl.animation}`;document.body.dataset.animation=girl.animation;document.body.dataset.footClearance=girl.footClearance.toFixed(4);Object.assign(document.body.dataset,{headTilt:girl.root.userData.headTilt,fingerCurl:girl.root.userData.fingerCurl,pose:girl.root.userData.pose});});
