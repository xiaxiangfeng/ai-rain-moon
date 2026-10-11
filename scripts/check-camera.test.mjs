import test from 'node:test';
import assert from 'node:assert/strict';
import { orbitPosition, CAFE_CAMERA_BOUNDS as bounds } from '../src/camera.js';
import { SEAT_POSITION } from '../src/seating.js';
for (const target of [[-5.45, 1.33, -4.35], [SEAT_POSITION[0], 1.22, SEAT_POSITION[2]]]) test(`full indoor orbit at ${target}`, () => {
  for (let yaw = -Math.PI; yaw <= Math.PI; yaw += .04) {
    const p = orbitPosition(target, yaw, .25, 4.2, bounds);
    p.forEach((v, i) => assert(v >= bounds.min[i] - 1e-8 && v <= bounds.max[i] + 1e-8, 'camera stays inside walls'));
    const actualYaw = Math.atan2(p[0] - target[0], p[2] - target[2]);
    assert(Math.abs(Math.atan2(Math.sin(actualYaw - yaw), Math.cos(actualYaw - yaw))) < 1e-8, 'wall avoidance preserves orbit direction');
  }
});
