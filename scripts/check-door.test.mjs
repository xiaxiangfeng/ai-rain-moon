import test from 'node:test';
import assert from 'node:assert/strict';
import { doorPose, DOOR_DURATION } from '../src/door.js';

for (const entering of [true, false]) test(`${entering ? 'enter' : 'exit'}: full route clears the finite panel and closing sweep`, () => {
  let last = doorPose(0, entering), phases = new Set([last.phase]);
  for (let t = 1 / 120; t <= DOOR_DURATION + .05; t += 1 / 120) {
    const pose = doorPose(t, entering); phases.add(pose.phase);
    assert(Math.hypot(...pose.position.map((v, i) => v - last.position[i])) < .020, 'no teleport');
    if (pose.inside !== last.inside) {
      assert.equal(pose.phase, 'push'); assert.equal(pose.contact, 1, 'walk across threshold with attached palm');
    }
    const dx = pose.position[0] + 5.72, dz = pose.position[2] + 1.28;
    const along = dx * Math.cos(pose.angle) - dz * Math.sin(pose.angle);
    const normal = dx * Math.sin(pose.angle) + dz * Math.cos(pose.angle);
    const nearestAlong = Math.max(0, Math.min(2.2, along));
    const panelDistance = Math.hypot(normal, along - nearestAlong);
    assert(panelDistance > .49, `body envelope avoids glass in ${pose.phase} at ${t.toFixed(2)}: ${panelDistance}`);
    if (pose.phase === 'close') assert(Math.hypot(dx, dz) > 2.70, 'person clears the swept door arc before closing');
    if (t > 1 && t < 4.5) assert(Math.hypot(...pose.position.map((v,i)=>v-last.position[i]))*120>.15,'no intermediate stop while opening and entering');
    last = pose;
  }
  assert.deepEqual([...phases], ['reach', 'push', 'clear', 'walk', 'close', 'done']);
  assert.equal(last.inside, entering); assert.equal(last.angle, 0);
});
