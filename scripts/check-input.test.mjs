import test from 'node:test';
import assert from 'node:assert/strict';
import { bindJoystick, bindSurfaceGestures, joystickVector } from '../src/input.js';

class Surface extends EventTarget {
  captures = new Set();
  disabled = false;
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); this.send('lostpointercapture', id, 0, 0); }
  send(type, id, x, y) { const e = new Event(type, { cancelable: true }); Object.assign(e, { pointerId: id, clientX: x, clientY: y, button: 0 }); this.dispatchEvent(e); }
}

test('joystick has a dead zone, analog speed and a bounded diagonal', () => {
  assert.equal(joystickVector(2, 0, 32).x, 0);
  assert.ok(joystickVector(16, 0, 32).x > .3 && joystickVector(16, 0, 32).x < .5);
  const diagonal = joystickVector(100, -100, 32);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-10);
  assert.ok(Math.abs(Math.hypot(diagonal.thumbX, diagonal.thumbY) - 32) < 1e-10);
});

test('a second finger cannot steal the joystick; cancellation stops movement', () => {
  const surface = new Surface(); let value;
  const stick = bindJoystick(surface, { onStart() {}, onChange(v) { value = v; } });
  surface.send('pointerdown', 1, 82, 50); assert.equal(value.x, 1);
  surface.send('pointerdown', 2, 50, 18); surface.send('pointermove', 2, 50, 82); assert.equal(value.x, 1);
  surface.send('pointerup', 2, 50, 82); assert.equal(value.x, 1);
  surface.send('pointercancel', 1, 82, 50); assert.equal(value.x, 0); assert.equal(value.y, 0);
  surface.send('pointerdown', 3, 18, 50); stick.reset(); assert.equal(value.x, 0); assert.equal(surface.captures.size, 0);
});

test('tap, orbit and pinch are distinct; no ground tap after lifting two fingers', () => {
  const surface = new Surface(), taps = [], orbits = [], zooms = [];
  bindSurfaceGestures(surface, { onTap(...v) { taps.push(v); }, onOrbit(...v) { orbits.push(v); }, onZoom(v) { zooms.push(v); } });
  surface.send('pointerdown', 1, 10, 10); surface.send('pointerup', 1, 12, 11); assert.equal(taps.length, 1);
  surface.send('pointerdown', 2, 10, 10); surface.send('pointermove', 2, 40, 20); surface.send('pointerup', 2, 40, 20);
  assert.equal(orbits.length, 1); assert.equal(taps.length, 1);
  surface.send('pointerdown', 3, 10, 10); surface.send('pointerdown', 4, 110, 10); surface.send('pointermove', 4, 210, 10);
  assert.equal(zooms[0], .5);
  surface.send('pointerup', 4, 210, 10); surface.send('pointerup', 3, 10, 10); assert.equal(taps.length, 1);
});

test('lost capture and app suspension do not leave the camera dragging', () => {
  const surface = new Surface(); let orbits = 0, taps = 0;
  const gestures = bindSurfaceGestures(surface, { onOrbit() { orbits++; }, onZoom() {}, onTap() { taps++; } });
  surface.send('pointerdown', 1, 20, 20); surface.send('pointercancel', 1, 20, 20); surface.send('pointermove', 1, 80, 20);
  surface.send('pointerdown', 2, 20, 20); gestures.reset(); surface.send('pointermove', 2, 80, 20); surface.send('pointerup', 2, 80, 20);
  assert.equal(orbits, 0); assert.equal(taps, 0); assert.equal(surface.captures.size, 0);
});

test('moving with the left finger and looking with the right remain independent', () => {
  const stickSurface = new Surface(), cameraSurface = new Surface(); let movement, orbit = 0;
  bindJoystick(stickSurface, { onStart() {}, onChange(v) { movement = v; } });
  bindSurfaceGestures(cameraSurface, { onOrbit() { orbit++; }, onZoom() {}, onTap() {} });
  stickSurface.send('pointerdown', 1, 50, 18);
  cameraSurface.send('pointerdown', 2, 100, 100); cameraSurface.send('pointermove', 2, 150, 100);
  assert.equal(movement.y, -1); assert.equal(orbit, 1);
  cameraSurface.send('pointerup', 2, 150, 100); assert.equal(movement.y, -1);
  stickSurface.send('pointerup', 1, 50, 18); assert.equal(movement.y, 0);
});
