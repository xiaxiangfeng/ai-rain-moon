// SPDX-License-Identifier: GPL-3.0-only
// Stateful, metric-space surface-water model. This is a bounded particle model,
// not a fluid solver: contact pinning, volume-preserving coalescence and gravity.
const STEP = 1 / 60;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const ease = x => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };

export function createGlassDroplets({ width, height, seed = 7319, capacity = 6500,
  trailCapacity = 10000, spawnRate = 32, evaporation = 1 } = {}) {
  if (!(width > 0 && height > 0)) throw new RangeError('Glass dimensions must be positive');
  let randomState = seed || 1, accumulator = 0, spawnBudget = 0, age = 0;
  let merges = 0, drainedVolume = 0, filmVolume = 0, trailCursor = 0, replacementCursor = 0, liveCount = 0, populationLimit = 0;
  function random() {
    randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5;
    return (randomState >>> 0) / 4294967296;
  }
  const drops = Array.from({ length: capacity }, () => ({ alive: false }));
  const trails = Array.from({ length: trailCapacity }, () => ({ alive: false }));
  const free = Array.from({ length: capacity }, (_, i) => capacity - 1 - i);
  // Maximum diameter determines the collision grid; all candidate contacts are
  // in a cell or its eight neighbors. No all-pairs scan as the window fills.
  const maxRadius = .014, cell = maxRadius * 2;
  const cols = Math.ceil(width / cell), rows = Math.ceil(height / cell);
  const heads = new Int32Array(cols * rows), next = new Int32Array(capacity);
  const trackCell = .055, trackCols = Math.max(2, Math.ceil(width / trackCell)), trackRows = Math.max(2, Math.ceil(height / trackCell));
  const moisture = new Float32Array(trackCols * trackRows);
  const steering = new Float32Array(trackCols * trackRows);
  function prepareSurface() { for (let i = 0; i < steering.length; i++) steering[i] = (random() - .5) * .6; }
  prepareSurface();
  const trackIndex = (x, y) => clamp(Math.floor(y / trackCell), 0, trackRows - 1) * trackCols + clamp(Math.floor(x / trackCell), 0, trackCols - 1);
  function surfaceDirection(x, y) {
    const gx = clamp(x / trackCell, 0, trackCols - 1.001), gy = clamp(y / trackCell, 0, trackRows - 1.001);
    const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const a = steering[iy * trackCols + ix], b = steering[iy * trackCols + ix + 1];
    const c = steering[(iy + 1) * trackCols + ix], d = steering[(iy + 1) * trackCols + ix + 1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }

  function remove(i, drain = false) {
    const d = drops[i];
    if (!d.alive) return;
    if (drain) drainedVolume += d.radius ** 3;
    d.alive = false; free.push(i); liveCount--;
  }
  function addDrop({ x, y, radius, vx = 0, vy = 0, pin = .0085, hold = .4, slideLife, beadLife } = {}) {
    if (!free.length) return -1;
    const i = free.pop(), r = clamp(radius ?? .004, .0015, maxRadius);
    Object.assign(drops[i], { alive: true, generation: (drops[i].generation || 0) + 1, x: clamp(x ?? random() * width, r, width - r),
      y: clamp(y ?? random() * height, 0, height), radius: r, vx, vy, pin, hold,
      age: 0, drift: 0, driftAge: 0, wobble: 0, trailX: x ?? 0, trailY: y ?? 0, trailAge: 0,
      trackWidth: .19, trackWidthTarget: .19, pauseAge: .5 + random(), drag: 6.5 + random() * 2,
      sliding: false, slideAge: 0, slideLife: slideLife ?? 2.5 + random() * 2.8,
      beadLife: beadLife ?? 12 + random() * 16, visibility: 0 });
    drops[i].trailX = drops[i].x; drops[i].trailY = drops[i].y;
    liveCount++;
    return i;
  }
  function deposit(d) {
    const dx = d.x - d.trailX, dy = d.y - d.trailY, length = Math.hypot(dx, dy);
    if (length < .0008) return;
    const t = trails[trailCursor++ % trailCapacity];
    Object.assign(t, { alive: true, x: (d.x + d.trailX) / 2, y: (d.y + d.trailY) / 2,
      dx, dy, length, radius: d.radius * d.trackWidth, age: 0, lifetime: .38 + random() * .42,
      thickness: .000009 + .000006 * d.trackWidth / .3,
      clarity: (.07 + .09 * Math.min(1, d.vy / .18)) * d.visibility });
    // A persistent wet path reduces pinning for later droplets and attracts
    // neighboring streams. History is bounded independently of rain duration.
    moisture[trackIndex(t.x, t.y)] = 1;
    // Occasionally a thin film contracts into a small bead behind the head.
    if (liveCount < populationLimit && random() < .035 && d.radius > .003) {
      const radius = .0015 + random() * .0006;
      const bead = addDrop({ x: t.x - dx / length * d.radius * 2, y: t.y - dy / length * d.radius * 2, radius, hold: 2, beadLife: 3 + random() * 4 });
      if (bead !== -1) d.radius = Math.cbrt(Math.max(.0015 ** 3, d.radius ** 3 - radius ** 3));
    }
    d.trailX = d.x; d.trailY = d.y; d.trailAge = 0;
  }
  function step(amount) {
    age += STEP;
    const decay = Math.exp(-STEP / 7);
    for (let i = 0; i < moisture.length; i++) moisture[i] *= decay;
    for (const t of trails) if (t.alive) { t.age += STEP; if (t.age >= t.lifetime) t.alive = false; }
    // Density, not just speed, follows rainfall. Light rain cannot saturate the
    // same population as a downpour; existing water still dries continuously.
    populationLimit = Math.min(capacity, Math.ceil(width * height * (12 + 260 * amount ** 1.35)));
    spawnBudget += spawnRate * width * height * amount ** 1.05 * STEP;
    while (spawnBudget >= 1) {
      spawnBudget--;
      // Keep fresh impacts arriving even at the pool limit. Recycle a small
      // old bead rather than letting saturated glass stop receiving rainfall.
      if (liveCount > populationLimit) continue;
      if (liveCount === populationLimit || !free.length) {
        for (let n = 0; n < capacity; n++) {
          const i = replacementCursor++ % capacity, d = drops[i];
          if (d.alive && d.age > 4 && d.radius < .006) { remove(i); break; }
        }
        if (liveCount >= populationLimit) continue;
      }
      const large = random() < .035 + .055 * amount;
      addDrop({ radius: large ? .009 + random() * .004 : .0032 + random() ** .85 * .0048,
        pin: .0075 + random() * .003, hold: .25 + random() * 1.4 });
    }
    heads.fill(-1);
    for (let i = 0; i < capacity; i++) {
      const d = drops[i]; if (!d.alive) continue;
      d.age += STEP; d.hold -= STEP; d.trailAge += STEP;
      d.pauseAge -= STEP;
      if (d.pauseAge <= 0) {
        d.pauseAge = .55 + random() * 1.25;
        if (d.vy > .015 && random() < .2) d.hold = .08 + random() * .18;
      }
      d.radius *= Math.exp(-STEP * evaporation * (.004 + .095 * (1 - amount) ** 2));
      if (d.radius < .0014) { remove(i); continue; }
      if (d.sliding) {
        d.slideAge += STEP;
        const progress = d.slideAge / d.slideLife, previousVolume = d.radius ** 3;
        // Water is left as a film while the core travels. Coalescence may add
        // volume, but never restarts a core's age or makes it persist forever.
        d.radius *= Math.exp(-STEP * (.17 + .85 * progress * progress));
        filmVolume += previousVolume - d.radius ** 3;
      }
      const life = d.sliding ? d.slideAge / d.slideLife : d.age / d.beadLife;
      d.visibility = ease(d.age / .24) * (1 - ease((life - .62) / .38));
      if (life >= 1 || d.radius < .0014) { filmVolume += d.radius ** 3; remove(i); continue; }
      const track = moisture[trackIndex(d.x, d.y)];
      const excess = Math.max(0, d.radius / (d.pin * (1 - .22 * track)) - 1);
      const acceleration = d.hold <= 0 ? 2.8 * Math.max(excess, d.sliding ? .16 : 0) : 0;
      d.vy = clamp((d.vy + acceleration * STEP) * Math.exp(-d.drag * STEP), 0, .38);
      if (!d.sliding && d.vy > .012) { d.sliding = true; d.slideAge = 0; }
      d.driftAge -= STEP;
      if (d.driftAge <= 0) {
        d.driftAge = .35 + random() * .95; d.drift = (random() - .5) * .8;
        d.trackWidthTarget = .13 + random() * .14;
      }
      const attraction = moisture[trackIndex(d.x + trackCell, d.y)] - moisture[trackIndex(d.x - trackCell, d.y)];
      const lateral = d.vy * clamp(d.drift + surfaceDirection(d.x, d.y) + .3 * attraction, -.55, .55);
      d.vx += (lateral - d.vx) * (1 - Math.exp(-STEP * 4));
      d.trackWidth += (d.trackWidthTarget - d.trackWidth) * (1 - Math.exp(-STEP * 3));
      d.x = clamp(d.x + d.vx * STEP, d.radius, width - d.radius); d.y += d.vy * STEP;
      d.wobble *= Math.exp(-STEP * 9);
      if (d.vy > .006 && d.visibility > .25 && (Math.hypot(d.x - d.trailX, d.y - d.trailY) > d.radius * .65 || d.trailAge > .07)) deposit(d);
      if (d.y > height + d.radius) { remove(i, true); continue; }
      const c = clamp(Math.floor(d.x / cell), 0, cols - 1), r = clamp(Math.floor(d.y / cell), 0, rows - 1);
      const bin = r * cols + c; next[i] = heads[bin]; heads[bin] = i;
    }
    for (let i = 0; i < capacity; i++) {
      const a = drops[i]; if (!a.alive) continue;
      const c = clamp(Math.floor(a.x / cell), 0, cols - 1), r = clamp(Math.floor(a.y / cell), 0, rows - 1);
      for (let yy = Math.max(0, r - 1); yy <= Math.min(rows - 1, r + 1); yy++) {
        for (let xx = Math.max(0, c - 1); xx <= Math.min(cols - 1, c + 1); xx++) {
          for (let j = heads[yy * cols + xx]; j !== -1; j = next[j]) {
            const b = drops[j]; if (j <= i || !b.alive) continue;
            if (Math.hypot(a.x - b.x, a.y - b.y) > (a.radius + b.radius) * .92) continue;
            const va = a.radius ** 3, vb = b.radius ** 3, volume = va + vb;
            a.x = (a.x * va + b.x * vb) / volume; a.y = (a.y * va + b.y * vb) / volume;
            a.vx = (a.vx * va + b.vx * vb) / volume; a.vy = (a.vy * va + b.vy * vb) / volume;
            a.radius = Math.min(maxRadius, Math.cbrt(volume));
            drainedVolume += Math.max(0, volume - maxRadius ** 3);
            a.hold = Math.min(a.hold, b.hold, .15); a.wobble = .08;
            if (b.sliding) { a.sliding = true; a.slideAge = Math.max(a.slideAge, b.slideAge); a.slideLife = Math.min(a.slideLife, b.slideLife); }
            // A merge cannot draw a diagonal trail between unrelated birth sites.
            a.trailX = a.x; a.trailY = a.y; a.trailAge = 0;
            remove(j); merges++;
          }
        }
      }
    }
  }
  return {
    drops, trails, width, height, capacity, trailCapacity, addDrop,
    update(dt, amount, activated = true) {
      if (!activated) { if (age > 0 || free.length !== capacity) this.reset(); return; }
      accumulator += clamp(dt, 0, .125);
      while (accumulator + 1e-10 >= STEP) { step(clamp(amount, 0, 1)); accumulator -= STEP; }
    },
    reset() {
      accumulator = 0; spawnBudget = 0; age = 0; merges = 0; drainedVolume = 0; filmVolume = 0; trailCursor = 0; replacementCursor = 0; liveCount = 0; populationLimit = 0;
      free.length = 0; for (let i = capacity - 1; i >= 0; i--) { drops[i].alive = false; free.push(i); }
      for (const t of trails) t.alive = false;
      moisture.fill(0); randomState = seed || 1; prepareSurface();
    },
    getStats() {
      let count = 0, sliding = 0, dissolving = 0, trailCount = 0, volume = 0;
      for (const d of drops) if (d.alive) { count++; if (d.vy > .006) sliding++; if (d.visibility < .75 && d.age > .24) dissolving++; volume += d.radius ** 3; }
      for (const t of trails) if (t.alive) trailCount++;
      return { count, sliding, dissolving, trails: trailCount, merges, volume, drainedVolume, filmVolume, age, populationLimit };
    }
  };
}
