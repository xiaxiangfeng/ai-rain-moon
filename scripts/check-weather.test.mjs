import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeatherCycle, updateGlassWater } from '../src/weather.js';
const options = { auto: true, gameTime: 60, maximum: .8 };
test('glass stays clear until the first completed sit, then wets continuously', () => {
  const water = { time: 0, drops: 0, fog: 0, flow: .45 };
  for (let i=0;i<60*60;i++) updateGlassWater(water,1/60,.8,.65,false);
  assert.equal(water.drops,0); assert.equal(water.fog,0); assert.equal(water.coverage,0);
  updateGlassWater(water,1/60,.8,.65,true);
  assert(water.drops>0 && water.drops<.01); assert(water.fog>0 && water.fog<.001);
  assert(water.coverage>0 && water.coverage<.0001, 'no opaque pane on the first seated frame');
});
test('clear-to-wet blend takes six seconds, stays continuous and follows drying', () => {
  for (const fps of [30, 60, 120]) {
    const water = { time: 0, drops: 0, fog: 0, flow: .45 };
    let last = 0;
    for (let i=0;i<6*fps;i++) {
      updateGlassWater(water,1/fps,.8,.65,true);
      assert(water.coverage >= last && water.coverage-last < .01);
      if (i < fps) assert(water.coverage < .075, 'first second retains mostly clear glass');
      last = water.coverage;
    }
    assert(Math.abs(water.coverage-1)<1e-9);
    for (let i=0;i<90*fps;i++) {
      updateGlassWater(water,1/fps,0,.65,true);
      assert(water.coverage <= last+1e-9, 'drying fades the effect rather than cutting it off');
      last = water.coverage;
    }
    assert(water.coverage < .0001);
  }
});
test('rain grows gradually, then stand-up reduces it without auto restarting', () => {
  const cycle = createWeatherCycle(); cycle.sit();
  let last = 0;
  for (let i = 0; i < 55 * 60; i++) { const rain = cycle.update(1/60, options); assert(rain >= last); assert(rain - last < .001); last = rain; }
  assert(Math.abs(last - .8) < 1e-6);
  cycle.stand(); assert.equal(cycle.level, last, 'event preserves continuity');
  for (let i = 0; i < 80 * 60; i++) { const rain = cycle.update(1/60, options); assert(rain <= last + 1e-9); last = rain; }
  assert.equal(cycle.phase, 'easing'); assert(Math.abs(last - .128) < 1e-6);
  cycle.sit(); assert(cycle.update(2, options) > last, 'sitting again can restart growth');
});
test('manual dry persists despite sitting and automatic timer', () => {
  const cycle = createWeatherCycle(); cycle.start(); cycle.update(55, options); cycle.stop(); cycle.sit();
  assert.equal(cycle.update(60, options), 0); assert.equal(cycle.phase, 'dry');
});
test('glass tracks both stronger and weaker rain, retaining residual water and fog', () => {
  const water = { time: 0, drops: 0, fog: 0, flow: .45 };
  for (let i=0;i<60*60;i++) updateGlassWater(water,1/60,.8,.65);
  const heavy = {...water}; assert(heavy.drops > .79); assert(heavy.fog > .50);
  updateGlassWater(water,1/60,.128,.65);
  assert(water.drops < heavy.drops && water.drops > .78, 'water drains continuously');
  assert(water.fog > .50, 'condensation does not vanish at once');
  for (let i=0;i<60*60;i++) updateGlassWater(water,1/60,.128,.65);
  assert(water.drops < .13); assert(water.fog < .12); assert(water.flow < heavy.flow); assert(water.time > heavy.time);
});
