import * as THREE from 'three/webgpu';
// Inspect the actual skinned triangles, not just the avatar's root position.
// A touching palm may overlap the glass thickness; the rest of the mesh may not.
export function createDoorMeshCheck(girl) {
  const meshes = [], point = new THREE.Vector3(), transform = new THREE.Matrix4(), inverse = new THREE.Matrix4();
  const hands = Object.fromEntries(['left','right'].map(side => {
    const bones = new Set(); girl.vrm.humanoid.getRawBoneNode(side + 'Hand').traverse(o => bones.add(o)); return [side, bones];
  }));
  girl.vrm.scene.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    const count = mesh.geometry.attributes.position.count;
    const allowed = Object.fromEntries(['left','right'].map(side => {
      const flags = new Uint8Array(count), indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
      for (let i=0;i<count;i++) for (let j=0;j<4;j++) if (weights.getComponent(i,j) > .20 && hands[side].has(mesh.skeleton.bones[indices.getComponent(i,j)])) flags[i] = 1;
      return [side,flags];
    }));
    meshes.push({ mesh, positions: new Float32Array(count*3), allowed });
  });
  return function inspect(pivot, contactSide) {
    inverse.copy(pivot.matrixWorld).invert(); let crossings = 0, vertices = 0, closest = Infinity; const hits = [];
    for (const {mesh,positions,allowed} of meshes) {
      mesh.skeleton.update(); transform.multiplyMatrices(inverse, mesh.matrixWorld);
      for (let i=0;i<positions.length/3;i++) {
        mesh.getVertexPosition(i,point).applyMatrix4(transform); point.toArray(positions,i*3); vertices++;
        if (contactSide && allowed[contactSide][i]) continue;
        if (point.x > .04 && point.x < 2.16 && point.y > .03 && point.y < 3.17) closest = Math.min(closest,Math.abs(point.z));
      }
      const index = mesh.geometry.index, count = index?.count || positions.length/3;
      for (let i=0;i<count;i+=3) {
        const ids = [0,1,2].map(j => index ? index.getX(i+j) : i+j);
        if (contactSide && ids.some(id => allowed[contactSide][id])) continue;
        for (let edge=0;edge<3;edge++) {
          const a=ids[edge]*3,b=ids[(edge+1)%3]*3, az=positions[a+2],bz=positions[b+2];
          if ((az < 0) === (bz < 0)) continue;
          const t=az/(az-bz), x=positions[a]+(positions[b]-positions[a])*t, y=positions[a+1]+(positions[b+1]-positions[a+1])*t;
          if (x>.04 && x<2.16 && y>.03 && y<3.17) {
            crossings++;
            if(hits.length<8) hits.push({mesh:mesh.name,x:+x.toFixed(3),y:+y.toFixed(3),depth:ids.map(id=>+positions[id*3+2].toFixed(4))});
            break;
          }
        }
      }
    }
    return { crossings, vertices, hits, closest: Number.isFinite(closest) ? closest : null };
  };
}
