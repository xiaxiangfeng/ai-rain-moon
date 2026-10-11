// Keep each pointer independent: a second finger must never turn a camera
// gesture into a ground tap, or take over a joystick held by the first finger.
export function joystickVector(dx, dy, radius, deadZone = .14) {
  const distance = Math.hypot(dx, dy), clamped = Math.min(distance, radius);
  const strength = Math.max(0, (clamped / radius - deadZone) / (1 - deadZone));
  return { x: distance ? dx / distance * strength : 0, y: distance ? dy / distance * strength : 0,
    thumbX: distance ? dx / distance * clamped : 0, thumbY: distance ? dy / distance * clamped : 0 };
}

export function bindJoystick(element, { onStart, onChange }) {
  let active = null, origin = null, radius = 1;
  function reset() {
    const previous = active; active = null;
    onChange({ x: 0, y: 0, thumbX: 0, thumbY: 0 });
    if (previous !== null && element.hasPointerCapture(previous)) element.releasePointerCapture(previous);
  }
  const down = e => {
    if (active !== null || element.disabled || e.button > 0) return;
    e.preventDefault(); onStart(); active = e.pointerId;
    const rect = element.getBoundingClientRect();
    origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    radius = rect.width * .32; element.setPointerCapture(active); move(e);
  };
  const move = e => {
    if (e.pointerId !== active) return;
    e.preventDefault(); onChange(joystickVector(e.clientX - origin.x, e.clientY - origin.y, radius));
  };
  const end = e => { if (e.pointerId === active) reset(); };
  element.addEventListener('pointerdown', down); element.addEventListener('pointermove', move);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(event, end);
  return { reset };
}

export function bindSurfaceGestures(surface, { onOrbit, onZoom, onTap }) {
  const pointers = new Map();
  let dragged = false, multi = false;
  function reset() {
    const ids = [...pointers.keys()]; pointers.clear(); dragged = multi = false;
    for (const id of ids) if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
  }
  function pair() {
    const [a, b] = [...pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  surface.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    e.preventDefault();
    if (!pointers.size) dragged = multi = false;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });
    if (pointers.size > 1) multi = dragged = true;
    surface.setPointerCapture(e.pointerId);
  });
  surface.addEventListener('pointermove', e => {
    const previous = pointers.get(e.pointerId); if (!previous) return;
    e.preventDefault();
    const before = pointers.size === 2 ? pair() : null;
    pointers.set(e.pointerId, { ...previous, x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const after = pair();
      onOrbit(after.x - before.x, after.y - before.y);
      if (before.distance > 8 && after.distance > 8) onZoom(before.distance / after.distance);
    } else if (pointers.size === 1) {
      if (Math.hypot(e.clientX - previous.startX, e.clientY - previous.startY) > 8) dragged = true;
      if (dragged) onOrbit(e.clientX - previous.x, e.clientY - previous.y);
    }
  });
  function end(e) {
    if (!pointers.has(e.pointerId)) return;
    const tap = e.type === 'pointerup' && pointers.size === 1 && !dragged && !multi;
    pointers.delete(e.pointerId);
    if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId);
    if (tap) onTap(e.clientX, e.clientY);
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) surface.addEventListener(event, end);
  return { reset };
}
