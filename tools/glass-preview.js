// SPDX-License-Identifier: GPL-3.0-only
import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { createWorld } from '../src/world.js';
import { createRainGlass } from '../src/glass.js';
import { assetUrl } from '../src/assets.js';

const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search), lifecycle = query.has('lifecycle');
const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: query.has('webgl') });
await renderer.init(); document.body.append(renderer.domElement);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .86;
renderer.shadowMap.enabled = true; renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.backend.device?.addEventListener('uncapturederror', event => { document.body.dataset.gpuError = event.error.message; console.error(event.error.message); });
const scene = new THREE.Scene(), world = createWorld(scene), camera = new THREE.PerspectiveCamera(48, 1, .05, 140);
const hdr = await new HDRLoader().loadAsync(assetUrl('city.hdr'));
hdr.mapping = THREE.EquirectangularReflectionMapping;
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromEquirectangular(hdr).texture; scene.environmentIntensity = .30;
hdr.dispose(); pmrem.dispose();
const glass = createRainGlass(world.glass, renderer, scene.environment, lifecycle ? { spawnRate: 0 } : {}), pipeline = new THREE.RenderPipeline(renderer);
const scenePass = pass(scene, camera), sceneColor = scenePass.getTextureNode('output');
pipeline.outputNode = sceneColor.add(bloom(sceneColor, .32, .35, 1.25));
let activated = false, paused = false, near = false, advance = 0, frames = 0, maxGap = 0, previous = performance.now();
let probes = [], probeTime = 0, probeReady = !lifecycle;
function probeAt(seconds) {
  glass.clearDrops();
  probes = [.25, .31, .37].map((x, i) => glass.emitNormalizedDrop(x, .36 + i * .01, { radius: .012 - i * .001,
    hold: 0, pin: .0065, slideLife: 3 + i * .8, beadLife: 30 }));
  for (let i = 0; i < Math.round(seconds * 60); i++) glass.update(1 / 60, +$('rain').value, +$('fog').value, false, true);
  glass.update(0, +$('rain').value, +$('fog').value, true, true);
  probeTime = seconds; paused = true; $('pause').textContent = '继续'; setView(true);
}
function setView(close) {
  near = close;
  camera.position.set(close ? -10.8 : -10.3, close ? 2.15 : 2.05, close ? -2.45 : -5.5);
  camera.lookAt(close ? -10.55 : -9.7, close ? 2.12 : 1.9, 4); camera.updateMatrixWorld();
}
function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  glass.resize(renderer.domElement.width, renderer.domElement.height);
}
setView(false); resize(); addEventListener('resize', resize);
await glass.prepare(scene, camera, scenePass, pipeline, message => { $('status').textContent = message; });
$('clear').onclick = () => { activated = false; advance = 0; glass.reset(); };
$('start').onclick = () => { activated = true; advance = 0; glass.reset(); };
$('mature').onclick = () => { activated = true; glass.reset(); advance = 60; };
$('ease').onclick = () => { $('rain').value = '.08'; activated = true; };
$('close').onclick = () => setView(true); $('wide').onclick = () => setView(false);
$('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? '继续' : '暂停'; };
$('inspect').onclick = async () => { document.body.dataset.field = JSON.stringify(await glass.inspectField()); };
$('lifecycle').textContent = lifecycle ? '返回大雨场景' : '单滴缩小与消退';
$('lifecycle').onclick = () => { if (lifecycle) query.delete('lifecycle'); else query.set('lifecycle', ''); location.search = query.toString(); };
$('life-controls').hidden = !lifecycle;
document.querySelectorAll('[data-life]').forEach(button => button.onclick = () => { if (probeReady) probeAt(+button.dataset.life); });
if (lifecycle) { activated = true; advance = 60; }
document.body.dataset.ready = 'true'; previous = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now(), gap = now - previous, dt = Math.min(.05, gap / 1000); previous = now;
  if (document.hidden) return;
  if (advance > 0) {
    // Advance in small batches across frames to keep this diagnostic responsive.
    for (let i = 0; i < 60 && advance > 0; i++, advance -= 1 / 60) glass.update(1 / 60, +$('rain').value, +$('fog').value, false, activated);
    if (lifecycle && advance <= 0 && !probeReady) { probeReady = true; probeAt(.3); }
  } else if (!paused) { glass.update(dt, +$('rain').value, +$('fog').value, true, activated); if (lifecycle) probeTime += dt; }
  glass.renderWater(camera);
  if (frames++ % 2 === 0) glass.capture(scene, camera);
  pipeline.render();
  if (frames > 10) maxGap = Math.max(maxGap, gap);
  if (frames % 15 === 0) {
    const stats = glass.getStats();
    $('status').textContent = `${renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2'} · ${near ? '水珠近景' : '窗边全景'}\n水滴 ${stats.count} · 滑落 ${stats.sliding}\n汇合 ${stats.merges} · 水痕 ${stats.trails}\n雾度 ${glass.getFog().toFixed(3)} · 渐入 ${glass.getCoverage().toFixed(3)}${advance > 0 ? '\n正在积雨…' : ''}`;
    const probeStates = probes.map(handle => glass.getDropState(handle));
    if (lifecycle && probeReady) $('status').textContent += `\n时间 ${probeTime.toFixed(1)} 秒\n滴头直径 ${probeStates.map(d => d ? (d.radius * 2000).toFixed(1) + 'mm' : '已消失').join(' / ')}`;
    Object.assign(document.body.dataset, { stats: JSON.stringify(stats), backend: renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2',
      fog: glass.getFog().toFixed(4), coverage: glass.getCoverage().toFixed(4), advance: Math.max(0, advance).toFixed(2), maxGap: maxGap.toFixed(1), probeTime: String(probeTime), probeStates: JSON.stringify(probeStates) });
  }
});
