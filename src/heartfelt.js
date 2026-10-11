// Heartfelt — Martijn Steinrucken / BigWings, 2017.
// https://www.shadertoy.com/view/ltffzl
// CC BY-NC-SA 3.0. TSL translation of the user's rain-heart/rain-heart.html.
// The three layers retain the original motion and hashes. The size parameter
// narrows beads and trails without multiplying their population. Reversed
// smoothsteps use ascending edges for well-defined WGSL behavior.
import { Fn, vec2, vec3, float, fract, floor, dot, sin, length, smoothstep, max } from 'three/tsl';

const N13 = Fn(([p]) => {
  const a = fract(vec3(p).mul(vec3(.1031, .11369, .13787))).toVar();
  a.addAssign(dot(a, a.yzx.add(19.19)));
  return fract(vec3(a.x.add(a.y).mul(a.z), a.x.add(a.z).mul(a.y), a.y.add(a.z).mul(a.x)));
});
const N = Fn(([p]) => fract(sin(p.mul(12345.564)).mul(7658.76)));
const saw = Fn(([b, t]) => smoothstep(0, b, t).mul(float(1).sub(smoothstep(b, 1, t))));
const dropLayer = Fn(([coord, t, size]) => {
  const grid = vec2(12, 2);
  const moved = coord.add(vec2(0, t.mul(.75)));
  const column = floor(moved.mul(grid));
  const shifted = moved.add(vec2(0, N(column.x)));
  const id = floor(shifted.mul(grid));
  const n = N13(id.x.mul(35.2).add(id.y.mul(2376.1)));
  const st = fract(shifted.mul(grid)).sub(vec2(.5, 0));
  const initialX = n.x.sub(.5);
  const phaseY = coord.y.mul(20);
  const wiggle = sin(phaseY.add(sin(phaseY)));
  const x = initialX.add(wiggle.mul(float(.5).sub(initialX.abs())).mul(n.z.sub(.5))).mul(.7);
  const cycle = fract(t.add(n.z));
  const y = saw(float(.85), cycle).sub(.5).mul(.9).add(.5);
  const distance = length(st.sub(vec2(x, y)).mul(vec2(1, 6)));
  const mainDrop = float(1).sub(smoothstep(0, size.mul(.4), distance));
  const r = float(1).sub(smoothstep(y, 1, st.y)).max(0).sqrt();
  const cd = st.x.sub(x).abs();
  const trailFront = smoothstep(-.02, .02, st.y.sub(y));
  const trail = float(1).sub(smoothstep(r.mul(r).mul(.15).mul(size), r.mul(.23).mul(size).add(.00001), cd)).mul(trailFront).mul(r).mul(r);
  const beadY = fract(coord.y.mul(10)).add(st.y.sub(.5));
  const beadDistance = length(st.sub(vec2(x, beadY)));
  const beads = float(1).sub(smoothstep(0, size.mul(.3), beadDistance));
  return vec2(mainDrop.add(beads.mul(r).mul(trailFront)), trail);
});
const staticDrops = Fn(([coord, t, size]) => {
  const p = coord.mul(40), id = floor(p), st = fract(p).sub(.5);
  const n = N13(id.x.mul(107.45).add(id.y.mul(3543.654)));
  const center = n.xy.sub(.5).mul(.7);
  const fade = saw(float(.025), fract(t.add(n.z)));
  return float(1).sub(smoothstep(0, size.mul(.3), length(st.sub(center)))).mul(fract(n.z.mul(10))).mul(fade);
});
export const heartfeltDrops = Fn(([coord, t, amount, size = float(1)]) => {
  // Extra wetting envelope gives dry glass before the rain starts.
  const envelope = smoothstep(0, .12, amount);
  const l0 = smoothstep(-.5, 1, amount).mul(2).mul(envelope);
  const l1 = smoothstep(.25, .75, amount), l2 = smoothstep(0, .5, amount);
  const s = staticDrops(coord, t, size).mul(l0);
  const m1 = dropLayer(coord, t, size).mul(l1);
  const m2 = dropLayer(coord.mul(1.85), t, size).mul(l2);
  return vec2(smoothstep(.3, 1, s.add(m1.x).add(m2.x)), max(m1.y.mul(l0), m2.y.mul(l1)));
});
