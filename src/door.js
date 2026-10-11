export const DOOR_OUTSIDE = [-4.05, .14, -.78];
export const DOOR_INSIDE = [-4.05, .18, -1.78];
export const DOOR_DURATION = 5.7;
export const DOOR_PALM_HEIGHT = 1.62;
const clamp = v => Math.max(0, Math.min(1, v));
const ease = v => { const t = clamp(v); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const turn = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * ease(t);

export function doorPose(time, entering, start = entering ? DOOR_OUTSIDE : DOOR_INSIDE) {
  const sign = entering ? 1 : -1, openAngle = sign * 1.25;
  const panelPoint = (angle, along = 1.67) => {
    const z = -1.28 - along * Math.sin(angle) + sign * .50 * Math.cos(angle);
    return [-5.72 + along * Math.cos(angle) + sign * .50 * Math.sin(angle), .14 + .04 * ease((-.78 - z) / 1.0) - .14 * ease((z - .12) / .36), z];
  };
  const released = panelPoint(openAngle), cleared = panelPoint(openAngle, 2.75);
  // Pass the finite door's free edge before crossing its plane. The previous
  // straight release-to-room route intersected glass despite root clearance.
  const end = [-5.45, entering ? .18 : 0, entering ? -4.35 : 1.79];
  const pushFacing = (entering ? Math.PI : 0) + openAngle;
  const edgeFacing = Math.atan2(cleared[0] - released[0], cleared[2] - released[2]);
  const finalFacing = Math.atan2(end[0] - cleared[0], end[2] - cleared[2]);
  let phase, position, angle, facing, contact = 0;
  if (time < .45) {
    phase = 'reach'; position = start; angle = 0; contact = ease(time / .45);
    facing = entering ? Math.PI : 0;
  } else if (time < 3.6) {
    // Start walking toward the free edge before the door finishes opening.
    // Overlapping the movements avoids the old stop at each phase boundary.
    const opening = ease((time - .45) / 2.55), sliding = clamp((time - 2) / 1.6);
    phase = time < 2.3 ? 'push' : 'clear';
    angle = openAngle * opening;
    position = panelPoint(angle, 1.67 + 1.08 * sliding * sliding);
    position = position.map((v, i) => v + (start[i] - panelPoint(0)[i]) * (1 - opening));
    contact = 1 - ease((time - 2.3) / .35);
    facing = turn((entering ? Math.PI : 0) + angle, edgeFacing, (time - 2.65) / .95);
  } else if (time < 5) {
    phase = 'walk'; const t = (time - 3.6) / 1.4, u = 1 - t;
    // The first Bezier tangent matches the edge approach's 1.35 m/s speed.
    // Every control point stays past the finite glass panel's free edge.
    const tangent = [Math.cos(openAngle), 0, -Math.sin(openAngle)];
    const control = cleared.map((v, i) => v + tangent[i] * 1.35 * 1.4 / 3);
    position = cleared.map((v, i) => u ** 3 * v + 3 * u * u * t * control[i] + (3 * u * t * t + t ** 3) * end[i]);
    angle = openAngle; facing = turn(edgeFacing, finalFacing, t / .65);
  } else {
    phase = time < DOOR_DURATION ? 'close' : 'done'; position = end; facing = finalFacing;
    angle = openAngle * (1 - ease((time - 5) / .7));
  }
  return { phase, position, angle: angle || 0, facing, contact, entering, inside: position[2] < -1.28, done: time >= DOOR_DURATION,
    shortSteps: phase === 'reach' || phase === 'push' || phase === 'clear' };
}
