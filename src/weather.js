const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { const t = clamp(x); return t * t * (3 - 2 * t); };

// Story events change the direction of the weather; they never jump its level.
export function createWeatherCycle() {
  let phase = 'waiting', level = 0, from = 0, age = 0;
  function change(next) { from = level; age = 0; phase = next; }
  return {
    get phase() { return phase; },
    get level() { return level; },
    start() { if (phase !== 'growing') change('growing'); },
    sit() { if (phase !== 'dry') change('growing'); },
    stand() { if (level > 0 || phase === 'growing') change('easing'); },
    stop() { change('dry'); },
    reset() { change('waiting'); },
    update(dt, { auto = true, gameTime = 0, maximum = .68 } = {}) {
      if (phase === 'waiting' && auto && gameTime >= 28) change('growing');
      age += dt;
      if (phase === 'growing') level = from + (maximum - from) * ease(age / 55);
      else if (phase === 'easing') level = from + (Math.min(from, maximum * .16) - from) * ease(age / 32);
      else if (phase === 'dry') level = from * (1 - ease(age / 12));
      else level = from;
      return level;
    }
  };
}

export function updateGlassWater(water, dt, rain, fogPreference, activated = true) {
  // Street rain cannot accumulate on the story window before the first sit.
  rain = activated ? rain : 0;
  const damp = (a, b, rate) => a + (b - a) * (1 - Math.exp(-rate * dt));
  water.drops = damp(water.drops, rain, rain > water.drops ? .40 : .16);
  water.fog = damp(water.fog, rain * fogPreference, rain * fogPreference > water.fog ? .065 : .045);
  // Blend the existing clear pane into the rain shader instead of replacing it
  // with an opaque refracted image on the first seated frame.
  water.revealAge = activated ? (water.revealAge || 0) + dt : 0;
  water.coverage = ease(water.revealAge / 6) * ease(water.drops / .08);
  // More water feeds faster runnels. Residual beads drain slowly in light rain.
  water.flow = .45 + water.drops * 1.55;
  water.time += dt * water.flow;
  return water;
}
