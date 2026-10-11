// Shorten the orbit ray at a wall instead of clamping its individual axes.
// Every yaw remains available, including at the window seat.
export const CAFE_CAMERA_BOUNDS = { min: [-13.0, .65, -7.72], max: [-3.78, 4.14, -1.56] };
export function orbitPosition(target, yaw, pitch, distance, bounds = null) {
  const ray = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  let radius = distance;
  if (bounds) for (let i = 0; i < 3; i++) {
    if (Math.abs(ray[i]) < 1e-8) continue;
    const wall = ray[i] > 0 ? bounds.max[i] : bounds.min[i];
    radius = Math.min(radius, Math.max(.18, (wall - target[i]) / ray[i]));
  }
  return target.map((v, i) => v + ray[i] * radius);
}
