import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSeat, SEAT_APPROACH, SEAT_POSITION, CHAIR_OPEN_Z, CHAIR_READY_Z, SEAT_PREPARATION_DURATION } from '../src/seating.js';
for (const chairFrom of [CHAIR_OPEN_Z, CHAIR_READY_Z]) test(`seat approach is continuous from chair ${chairFrom}`, () => {
  let last = prepareSeat(0,SEAT_APPROACH,chairFrom);
  assert.equal(last.chairZ,chairFrom,'repeat visits do not teleport the chair');
  for(let t=1/120;t<SEAT_PREPARATION_DURATION;t+=1/120) {
    const pose=prepareSeat(t,SEAT_APPROACH,chairFrom);
    assert(Math.hypot(...pose.position.map((v,i)=>v-last.position[i]))<.02,'person walks without snapping');
    assert(Math.abs(pose.chairZ-last.chairZ)<.004,'chair moves continuously');
    if(pose.phase==='around') {
      const x=Math.max(0,Math.abs(pose.position[0]-SEAT_POSITION[0])-.325);
      const z=Math.max(0,Math.abs(pose.position[2]-pose.chairZ)-.31);
      assert(Math.hypot(x,z)>.19,'walk around the seat, not through it');
    }
    if(chairFrom===CHAIR_READY_Z) {
      assert.notEqual(pose.phase,'adjust','repeat visits skip an already positioned chair');
      assert.equal(pose.contact,0,'no phantom chair push on repeat visits');
      assert.equal(pose.chairZ,CHAIR_READY_Z,'an already positioned chair stays fixed');
    }
    last=pose;
  }
  assert.equal(last.chairZ,CHAIR_READY_Z);
  const finalGap=-2.355-(SEAT_POSITION[2]+.31);
  assert(finalGap>.05 && finalGap<.25,'chair leaves knee space at the counter without intersecting it');
  assert.equal(CHAIR_READY_Z,SEAT_POSITION[2],'chair is already at its final position before sitting');
});
