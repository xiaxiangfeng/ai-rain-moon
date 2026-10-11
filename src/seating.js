export const SEAT_POSITION = [-10.4, .18, -2.88];
export const SEAT_APPROACH = [-9.6, .18, -3.88];
export const CHAIR_OPEN_Z = -3.18;
export const CHAIR_READY_Z = SEAT_POSITION[2];
export const SEAT_PREPARATION_DURATION = 5.1;
export const chairNeedsAdjustment = chairZ => Math.abs(chairZ - CHAIR_READY_Z) > .015;
const ease = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export function prepareSeat(time, start = SEAT_APPROACH, chairFrom = CHAIR_OPEN_Z) {
  const behind = [SEAT_POSITION[0], .18, chairFrom - .51];
  const needsAdjustment = chairNeedsAdjustment(chairFrom), adjustEnd = needsAdjustment ? 2.1 : 1;
  let position, phase, contact = 0, chairZ = chairFrom;
  if (time < 1) {
    phase = 'approach'; position = lerp(start, behind, ease(time));
  } else if (needsAdjustment && time < adjustEnd) {
    phase = 'adjust'; const t = (time - 1) / 1.1;
    chairZ = chairFrom + (CHAIR_READY_Z - chairFrom) * ease(t);
    position = [SEAT_POSITION[0], .18, chairZ - .51];
    contact = ease(t / .2) * (1 - ease((t - .8) / .2));
  } else {
    phase = 'around'; chairZ = CHAIR_READY_Z;
    const t = time - adjustEnd;
    if (t < .25) position = [SEAT_POSITION[0], .18, chairZ - .51 - .19 * ease(t / .25)];
    else if (t < 2.65) {
      const angle = -Math.PI / 2 + Math.PI * ease((t - .25) / 2.4);
      position = [SEAT_POSITION[0] + .70 * Math.cos(angle), .18, chairZ + .70 * Math.sin(angle)];
    } else { phase = 'align'; position = [SEAT_POSITION[0], .18, chairZ + .70 - .37 * ease((t - 2.65) / .35)]; }
  }
  return { phase, position, chairZ, contact, needsAdjustment, done: time >= adjustEnd + 3 };
}
