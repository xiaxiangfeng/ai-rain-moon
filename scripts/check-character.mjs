import fs from 'node:fs';
import assert from 'node:assert/strict';
const bytes=fs.readFileSync('public/assets/character/ametsuki.vrm');
assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
const model=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),vrm=model.extensions.VRM;
assert.equal(vrm.meta.licenseName,'CC_BY_SA');
for(const name of ['head','hips','leftFoot','rightFoot','leftHand','rightHand']) assert(vrm.humanoid.humanBones.some(b=>b.bone===name),name);
assert(model.materials.some(m=>m.name.includes('Bottoms')),'authored uniform skirt');
assert(vrm.blendShapeMaster.blendShapeGroups.some(g=>g.presetName==='blink'),'facial blink morph');
const hairGroups=vrm.secondaryAnimation.boneGroups.filter(g=>g.comment==='Hair'&&g.bones[0]>=37&&g.bones[0]!==84);
assert.equal(hairGroups.length,1,'one coherent ponytail spring chain');
const data=JSON.parse(fs.readFileSync('public/assets/character/motions.json'));
for (const side of ['left','right']) for (const finger of ['Index','Middle','Ring','Little']) {
 const name=side+finger+'Intermediate', q=data.handPoses.fist[name];
 assert(Math.abs(Math.hypot(...q)-1)<.000003,'hand pose quaternion is normalized');
 assert(2*Math.acos(Math.abs(q[3]))>.4,`${name}: running finger actually curls`);
 assert(Math.abs(data.handPoses.relaxed[name][3])>Math.abs(q[3]),'resting hand is more relaxed than running hand');
}
assert.deepEqual(data.clips.map(c=>c.name),['idle','walk','jog','sitDown','sit','standUp']);
for(const c of data.clips){
 assert(c.duration>.5);assert(c.times.length>20);assert.equal(c.hips.length,c.times.length*3);assert.equal(c.clearance.length,c.times.length);
 for(let i=1;i<c.times.length;i++)assert(c.times[i]>c.times[i-1]);
 for(const [bone,rotations]of Object.entries(c.rotations)){
  assert.equal(rotations.length,c.times.length*4);
  for(let i=0;i<rotations.length;i+=4)assert(Math.abs(Math.hypot(...rotations.slice(i,i+4))-1)<.000003,`${c.name} ${bone}: normalized quaternion`);
 }
}
const sit=data.clips.find(c=>c.name==='sit'),idle=data.clips.find(c=>c.name==='idle');
assert(sit.hips[1]<idle.hips[1]-.2,'sitting pelvis lowers');
assert(Math.max(...data.clips.find(c=>c.name==='walk').clearance)<.03,'walk has a planted supporting foot');
for (const name of ['walk','jog']) {
 const c=data.clips.find(c=>c.name===name);
 assert(c.source.startsWith('CMU'),'locomotion uses captured motion');
 assert(c.nominalSpeed>1 && c.nominalSpeed<4,'measured source speed drives cadence');
 for (const [bone,values] of Object.entries(c.rotations)) {
  const dot=values.slice(0,4).reduce((s,v,i)=>s+v*values[values.length-4+i],0);
  assert(Math.abs(dot)> .99999,`${name} ${bone}: no pose snap at loop boundary`);
 }
 assert(Math.max(...c.hips.filter((_,i)=>i%3===2))-Math.min(...c.hips.filter((_,i)=>i%3===2))<.07,'root travel removed, sway preserved');
}
console.log('Character asset checks passed: clothing, morphs, spring chain, 6 clips, quaternion validity, foot contact, seated pelvis.');
