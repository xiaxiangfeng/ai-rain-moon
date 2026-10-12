import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlassDroplets } from '../src/glass-droplets.js';

const make = options => createGlassDroplets({ width: 1, height: 1, spawnRate: 0, evaporation: 0, ...options });
const advance = (sim, seconds, rain = 1, fps = 60) => { for (let i = 0; i < seconds * fps; i++) sim.update(1 / fps, rain); };

test('rain outside cannot wet the unactivated story window', () => {
  const sim = make({ spawnRate: 30 });
  for (let i = 0; i < 300; i++) sim.update(1 / 30, 1, false);
  assert.equal(sim.getStats().count, 0); assert.equal(sim.getStats().trails, 0);
  sim.update(1 / 30, 1, true); assert.equal(sim.getStats().count, 1);
  sim.update(1 / 30, 1, false); assert.equal(sim.getStats().count, 0);
});
test('touching droplets combine their volume, position and momentum', () => {
  const sim = make();
  sim.addDrop({ x: .5, y: .5, radius: .006, hold: 2 });
  sim.addDrop({ x: .505, y: .5, radius: .004, hold: 2 });
  const before = sim.getStats().volume;
  sim.update(1 / 60, 1);
  assert.equal(sim.getStats().count, 1); assert.equal(sim.getStats().merges, 1);
  assert(Math.abs(sim.getStats().volume - before) < 1e-18);
  const d = sim.drops.find(d => d.alive);
  assert(d.x > .5 && d.x < .505); assert(d.radius > .006);
});
test('small pinned beads stay put; large ones descend and leave fading trails', () => {
  const sim = make();
  const small = sim.addDrop({ x: .2, y: .2, radius: .003, hold: 0 });
  const large = sim.addDrop({ x: .7, y: .2, radius: .013, hold: 0 });
  advance(sim, 1);
  assert.equal(sim.drops[small].y, .2); assert(sim.drops[large].y > .24);
  assert(sim.getStats().trails > 0);
  advance(sim, 20);
  assert.equal(sim.drops[large].alive, false); assert.equal(sim.getStats().trails, 0);
  assert(sim.getStats().filmVolume > 0, 'the traveling core leaves water on the glass before disappearing');
});
test('fixed steps give the same seeded rain at 30, 60 and 120 fps', () => {
  const runs = [30, 60, 120].map(fps => {
    const sim = make({ spawnRate: 25, seed: 42 }); advance(sim, 6, .7, fps);
    return sim.drops.filter(d => d.alive).map(d => [d.x, d.y, d.radius, d.vy]);
  });
  assert.deepEqual(runs[0], runs[1]); assert.deepEqual(runs[1], runs[2]);
});
test('bounded pools remain finite in heavy rain and drain when rain stops', () => {
  const sim = make({ capacity: 80, trailCapacity: 120, spawnRate: 120, evaporation: 1 });
  advance(sim, 30);
  const wet = sim.getStats(); assert(wet.count <= 80); assert(wet.trails <= 120); assert(wet.merges > 0);
  for (const d of sim.drops.filter(d => d.alive)) {
    for (const key of ['x', 'y', 'radius', 'vx', 'vy']) assert(Number.isFinite(d[key]));
    assert(d.radius <= .014);
  }
  advance(sim, 90, 0);
  assert.equal(sim.getStats().count, 0); assert.equal(sim.getStats().trails, 0);
});
test('reset clears water history and reproduces the same seeded sequence', () => {
  const sim = make({ spawnRate: 30 }); advance(sim, 3);
  const before = sim.drops.filter(d => d.alive).map(d => [d.x, d.y, d.radius]);
  sim.reset(); assert.equal(sim.getStats().merges, 0); advance(sim, 3);
  assert.deepEqual(sim.drops.filter(d => d.alive).map(d => [d.x, d.y, d.radius]), before);
});
test('heavy rain produces substantially denser glass than light rain', () => {
  const run = amount => { const sim = createGlassDroplets({ width: 2, height: 2 }); advance(sim, 40, amount); return sim.getStats(); };
  const light = run(.08), medium = run(.35), heavy = run(.8);
  assert(heavy.count > light.count * 4, 'density must change, not only sliding speed');
  assert(heavy.count > medium.count * 1.7); assert(heavy.populationLimit > medium.populationLimit);
});
test('sliding follows a curved path with varying film width instead of a straight wire', () => {
  const sim = make({ height: 2, capacity: 1 }); const i = sim.addDrop({ x: .5, y: .1, radius: .013, hold: 0, pin: .005, slideLife: 6 });
  let min = .5, max = .5;
  for (let n = 0; n < 180; n++) { sim.update(1 / 60, 1); min = Math.min(min, sim.drops[i].x); max = Math.max(max, sim.drops[i].x); }
  assert(max - min > .025, 'channel and inertia create visible gentle bends');
  const widths = sim.trails.filter(t => t.alive).map(t => t.radius), angles = sim.trails.filter(t => t.alive).map(t => Math.atan2(t.dx, t.dy));
  assert(Math.max(...widths) / Math.min(...widths) > 1.15);
  assert(Math.max(...angles) - Math.min(...angles) > .15, 'the short trace must still bend');
  assert(sim.trails.filter(t => t.alive).every(t => t.clarity <= .16 && t.thickness < .000015 && t.lifetime <= .8), 'short thin films must not form persistent dark tails');
});
test('a core shrinks and disappears mid-pane even in heavy rain without evaporation', () => {
  const sim = make({ height: 2, capacity: 1 }); const i = sim.addDrop({ x: .5, y: .2, radius: .012, hold: 0, slideLife: 3 });
  advance(sim, 1); const first = { ...sim.drops[i] };
  advance(sim, 1.5); const late = { ...sim.drops[i] };
  assert(first.radius < .011 && late.radius < first.radius * .6);
  assert(late.visibility < .6 && late.visibility > 0, 'the core fades continuously before retirement');
  advance(sim, 1); assert.equal(sim.drops[i].alive, false);
  assert(sim.drops[i].y < 1, 'disappearance happens on the glass, not only below its bottom edge');
  assert.equal(sim.getStats().trails, 0, 'a dark tail must not remain attached after the head disappears');
});
test('merging fresh water does not restart the age of an already sliding core', () => {
  const sim = make({ height: 2 }); const i = sim.addDrop({ x: .5, y: .2, radius: .012, hold: 0, slideLife: 3 });
  advance(sim, 2.5); const before = sim.drops[i].slideAge;
  sim.addDrop({ x: sim.drops[i].x, y: sim.drops[i].y, radius: .004, hold: 2 }); sim.update(1 / 60, 1);
  assert(sim.getStats().merges > 0); assert(sim.drops[i].slideAge >= before);
  advance(sim, 1); assert.equal(sim.drops[i].alive, false);
});
