import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { pbr } from './materials.js';
import { SEAT_POSITION, CHAIR_OPEN_Z } from './seating.js';

export const DOOR = new THREE.Vector3(-4.6, 0, -.1);
export const SEAT = new THREE.Vector3().fromArray(SEAT_POSITION);

export function createWorld(scene) {
  const loader = new THREE.TextureLoader(), mats = new Map();
  const coffeeSources = [];
  const standard = (color, roughness = .85, glow = 0) => {
    const key = `${color}:${roughness}:${glow}`;
    if (!mats.has(key)) {
      const m = glow === 0 && roughness >= .7 ? pbr('plastered_wall_04', color, .65, roughness) : new THREE.MeshStandardMaterial({ color, roughness, emissive: color, emissiveIntensity: glow });
      mats.set(key, m);
    }
    return mats.get(key);
  };
  const wood = pbr('wood_table_001', '#e4c1a0', 1.0, .7), cream = pbr('plastered_wall_04', '#ddd1bb', .65, .8), darkWood = pbr('wood_table_001', '#6d4a36', 1, .85);
  const floorWood = pbr('wood_floor', '#b18b6f', .32, .75), brick = pbr('brick_wall_003', '#a19a95', .52, .9);
  const charcoal = standard('#303c47'), metal = standard('#48555e', .4);
  const warmLight = standard('#ffe2a0', .6, 4.0), mintLight = standard('#a8eed5', .6, 3.1);
  const cube = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
  const leafCanvas = document.createElement('canvas'); leafCanvas.width = 128; leafCanvas.height = 256;
  const lc = leafCanvas.getContext('2d'), lg = lc.createLinearGradient(0,0,128,0); lg.addColorStop(0,'#183e2b'); lg.addColorStop(.5,'#668c49'); lg.addColorStop(1,'#224a31'); lc.fillStyle = lg; lc.fillRect(0,0,128,256);
  lc.strokeStyle = '#87a76a'; lc.lineWidth = 1.8; lc.beginPath(); lc.moveTo(64,0); lc.lineTo(64,256); lc.stroke();
  lc.strokeStyle = 'rgba(139,166,109,.36)'; lc.lineWidth = 1;
  for (let y=20;y<250;y+=24) for(const side of [-1,1]) { lc.beginPath();lc.moveTo(64,y);lc.quadraticCurveTo(64+side*25,y-9,64+side*57,y-23);lc.stroke(); }
  const leafMap = new THREE.CanvasTexture(leafCanvas); leafMap.colorSpace = THREE.SRGBColorSpace;
  const leafMaterial = new THREE.MeshPhysicalMaterial({ map: leafMap, side: THREE.DoubleSide, roughness: .43, clearcoat: .25 });
  const leafGeometry = new THREE.PlaneGeometry(.20,.42,8,16), lp = leafGeometry.attributes.position;
  for(let i=0;i<lp.count;i++) {const t=lp.getY(i)/.42+.5, u=lp.getX(i)/.10;lp.setX(i,lp.getX(i)*Math.sin(t*Math.PI)**.6);lp.setZ(i,.035*(1-u*u)-t*t*.08);}
  leafGeometry.computeVertexNormals();
  const packages = ['牛奶','绿茶','咖啡','巧克力','天然水','橙汁'].map((name,i) => {
    const c=document.createElement('canvas');c.width=256;c.height=512;const ctx=c.getContext('2d');
    ctx.fillStyle=['#e5e1d5','#47775a','#675247','#9b574f','#8cbdcb','#d2a14f'][i];ctx.fillRect(0,0,256,512);
    ctx.fillStyle='#f0eadb';ctx.fillRect(14,95,228,245);ctx.fillStyle='#294251';ctx.textAlign='center';ctx.font=`600 ${i===3?25:38}px sans-serif`;ctx.fillText(name,128,171);
    ctx.font='20px serif';ctx.fillText('雨月日常',128,304);ctx.fillStyle=['#91abb6','#547b47','#734934','#88452b','#97c6dc','#e0af43'][i];ctx.beginPath();ctx.ellipse(128,232,46,43,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#e8e3d7';ctx.fillRect(0,390,256,12);ctx.fillStyle='#23313d';
    for(let x=65;x<195;x+=6){ctx.fillRect(x,439,(x%3)+1,34);}const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({map,roughness:.55});
  });
  function box(parent, x, y, z, w, h, d, mat, cast = true) {
    const o = new THREE.Mesh(cube, mat); o.position.set(x, y, z); o.scale.set(w, h, d); o.castShadow = cast; o.receiveShadow = true; parent.add(o); return o;
  }
  function cylinder(parent, x, y, z, r, h, mat) {
    const o = new THREE.Mesh(cyl, mat); o.position.set(x, y, z); o.scale.set(r, h, r); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  function rounded(parent, x, y, z, w, h, d, radius, mat) {
    const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), mat); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o;
  }
  function label(parent, text, x, y, z, w, h, bg, color, font = 'serif', emissive = .4) {
    const canvas = document.createElement('canvas'); canvas.width = Math.min(4096, Math.round(256 * w / h)); canvas.height = Math.round(canvas.width * h / w);
    const c = canvas.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
    const lines = text.split('\n');
    let fontSize = Math.round(canvas.height * .47 / Math.max(1, lines.length));
    c.font = `500 ${fontSize}px ${font}`;
    const longest = Math.max(...lines.map(line => c.measureText(line).width));
    if (longest > canvas.width * .9) fontSize *= canvas.width * .9 / longest;
    c.font = `500 ${Math.floor(fontSize)}px ${font}`;
    lines.forEach((line, i) => c.fillText(line, canvas.width / 2, canvas.height * (.5 + (i - (lines.length - 1) / 2) * .78 / lines.length)));
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#fff', emissiveIntensity: emissive, roughness: .6 });
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); o.position.set(x, y, z); parent.add(o); return o;
  }
  function plant(parent, x, y, z, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale); parent.add(g);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.23, .16, .4, 14), standard('#9c7966')); pot.position.y = .2; pot.castShadow = true; g.add(pot);
    cylinder(g, 0, .8, 0, .028, 1.1, darkWood);
    for (let i = 0; i < 8; i++) {
      const angle = i * 2.4;
      const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
      leaf.position.set(Math.sin(angle) * .19, .47 + i * .1, Math.cos(angle) * .19); leaf.rotation.set(.85, angle, .25); leaf.castShadow = true; g.add(leaf);
    }
    return g;
  }
  function chair(parent, x, z, facing = 0) {
    const g = new THREE.Group(); g.position.set(x, .18, z); g.rotation.y = facing; g.scale.y = .86; parent.add(g);
    rounded(g, 0, .68, 0, .65, .09, .62, .035, wood);
    rounded(g, 0, .74, 0, .57, .055, .54, .025, standard('#43594f', .65));
    for (const a of [-.25, .25]) for (const b of [-.24, .24]) box(g, a, .33, b, .055, .67, .055, darkWood);
    box(g, 0, .35, .24, .51, .035, .045, darkWood);
    for (const a of [-.27, .27]) box(g, a, 1.05, -.27, .055, .67, .055, darkWood);
    rounded(g, 0, 1.22, -.28, .59, .30, .075, .03, wood); return g;
  }
  function mug(parent, x, y, z, hot = false) {
    const profile = [new THREE.Vector2(.068,0),new THREE.Vector2(.076,.01),new THREE.Vector2(.079,.025),new THREE.Vector2(.089,.148),new THREE.Vector2(.086,.16),new THREE.Vector2(.077,.16),new THREE.Vector2(.074,.14),new THREE.Vector2(.065,.025)];
    const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), standard('#ddd6c5', .18)); cup.position.set(x, y + .014, z); cup.castShadow = true; parent.add(cup);
    cylinder(parent, x, y + .15, z, .074, .003, standard('#38251d', .18));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.083, .004, 8, 32), standard('#eee7d6', .2)); rim.rotation.x = Math.PI / 2; rim.position.set(x, y + .173, z); parent.add(rim);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.059, .016, 8, 16), standard('#dfd8c4', .24)); handle.position.set(x + .105, y + .09, z); parent.add(handle);
    cylinder(parent, x, y + .008, z, .14, .013, standard('#cec9b9', .3));
    if (hot) { parent.updateWorldMatrix(true, false); coffeeSources.push(parent.localToWorld(new THREE.Vector3(x, y + .164, z))); }
  }
  // Twilight lighting and atmospheric depth.
  scene.background = new THREE.Color('#304764'); scene.fog = new THREE.FogExp2('#304764', .018);
  const hemi = new THREE.HemisphereLight('#a5c6ed', '#3b3638', 1.25); scene.add(hemi);
  const moonLight = new THREE.DirectionalLight('#a8c8fc', 1.35); moonLight.position.set(-13, 22, 12); moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048); Object.assign(moonLight.shadow.camera, { left: -30, right: 30, top: 24, bottom: -24, near: .5, far: 70 }); moonLight.shadow.normalBias = .04; moonLight.shadow.bias = -.0003; scene.add(moonLight);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(2.5, 24, 16), new THREE.MeshBasicMaterial({ color: '#e9e5cc', fog: false })); moon.position.set(-38, 35, -70); scene.add(moon);
  const asphalt = loader.load('/assets/asphalt.jpg'); asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping; asphalt.repeat.set(12, 5); asphalt.colorSpace = THREE.SRGBColorSpace;
  const groundMat = new THREE.MeshStandardMaterial({ color: '#717782', map: asphalt, roughness: .93 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 55), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.018, 5); ground.receiveShadow = true; scene.add(ground);
  // Elevated sidewalk and curb. Fine tiles introduce a readable sense of scale.
  box(scene, 0, .065, -1.2, 65, .13, 3, standard('#848991'));
  for (let x = -32; x < 32; x += 1.3) {
    box(scene, x, .133, -.5, .022, .003, 1.56, standard('#65717b'), false);
    box(scene, x, .06, .325, 1.28, .15, .19, standard('#a0a5a9'), false);
  }
  for (let z = -.55; z > -2.5; z -= .72) box(scene, 0, .133, z, 64, .003, .015, standard('#6c7580'), false);
  for (let x = -27; x <= 27; x += 6) box(scene, x, .002, 10, 2.8, .004, .085, standard('#b0b0aa'), false);
  const paint = standard('#e1e4db', .28);
  for (let z = 1.4; z < 16; z += 1.45) box(scene, 7.5, .004, z, 3.9, .006, .62, paint, false);
  box(scene, 7.5, .005, 15.6, 5.4, .006, .16, paint, false);
  box(scene, -1.8, .137, -.04, 61, .005, .30, standard('#bda247', .5), false);
  const tactile = new THREE.InstancedMesh(new THREE.SphereGeometry(.025, 6, 4), standard('#d4b44e', .45), 570);
  const tactileDummy = new THREE.Object3D(); let tactileIndex = 0;
  for (let x = -30; x < 30; x += .21) for (const z of [-.12, .04]) {
    if (tactileIndex >= 570) break;
    tactileDummy.position.set(x, .144, z); tactileDummy.scale.set(1, .3, 1); tactileDummy.updateMatrix(); tactile.setMatrixAt(tactileIndex++, tactileDummy.matrix);
  }
  tactile.count = tactileIndex; scene.add(tactile);
  // Original three-dimensional cafe: walls, timber frames, window, entrance and furniture.
  const cafe = new THREE.Group(); cafe.name = '雨月咖啡馆'; scene.add(cafe);
  box(cafe, -8.4, .105, -4.7, 10.2, .21, 6.9, floorWood);
  box(cafe, -8.4, 2.25, -8.05, 10.2, 4.5, .25, cream);
  box(cafe, -13.4, 2.25, -4.7, .25, 4.5, 6.9, cream);
  box(cafe, -3.4, 2.25, -4.7, .25, 4.5, 6.9, cream);
  box(cafe, -13.255, 1.35, -4.72, .012, 2.18, 6.54, brick);
  for (let x = -13.0; x < -3.45; x += .21) box(cafe, x, .73, -7.89, .16, 1.08, .045, darkWood);
  box(cafe, -8.4, 1.32, -7.84, 9.8, .055, .08, wood);
  box(cafe, -8.4, .32, -7.78, 9.8, .14, .08, darkWood);
  box(cafe, -9.58, .32, -1.48, 7.42, .14, .08, darkWood);
  const ceiling = box(cafe, -8.4, 4.50, -4.7, 10.5, .20, 7.2, darkWood);
  // Leave an actual floor-level opening for the hinged door.
  box(cafe, -9.62, .38, -1.30, 7.71, .45, .17, darkWood);
  for (const x of [-13.28, -10.2, -7.1, -5.8, -3.5]) box(cafe, x, 2.38, -1.30, .13, 4.15, .19, darkWood);
  box(cafe, -8.4, 4.17, -1.30, 10.2, .18, .24, darkWood);
  box(cafe, -8.4, 3.70, -1.30, 10.2, .08, .13, darkWood);
  // Main window meshes receive the dynamic TSL rain-glass material later.
  const windowMaterial = new THREE.MeshPhysicalMaterial({ color: '#c4d3d4', transparent: true, opacity: .12, roughness: .03, metalness: .1, side: THREE.DoubleSide, depthWrite: false });
  const glass = [];
  for (const [x, width] of [[-11.73, 2.98], [-8.65, 2.98], [-6.46, 1.17]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(width, 3.06), windowMaterial); p.position.set(x, 2.13, -1.29); p.name = 'rain window'; cafe.add(p); glass.push(p);
  }
  const doorPivot = new THREE.Group(); doorPivot.position.set(-5.72, .18, -1.28); cafe.add(doorPivot);
  for (const x of [0, 2.2]) box(doorPivot, x, 1.6, 0, .09, 3.2, .1, darkWood);
  for (const y of [0, 2.5, 3.2]) box(doorPivot, 1.1, y, 0, 2.22, .09, .1, darkWood);
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 3.1), windowMaterial); doorGlass.position.set(1.1, 1.6, 0); doorPivot.add(doorGlass);
  const doorHandle = cylinder(doorPivot, 1.83, 1.4, .11, .023, .42, standard('#b79b62', .3));
  cylinder(doorPivot, 1.83, 1.4, -.11, .023, .42, standard('#b79b62', .3));
  label(cafe, '雨 月 咖 啡', -8.5, 5.0, -.93, 5.3, .82, '#efe1c2', '#4b463b', 'serif', .75);
  label(cafe, '一杯咖啡 · 慢享时光', -8.5, 4.61, -.94, 4.5, .2, '#efe1c2', '#665b4c', 'sans-serif', .6);
  // Green awning projects out into the street, casting a real shadow.
  const awning = box(cafe, -8.4, 4.20, -.35, 10.6, .12, 2.45, standard('#385b54')); awning.rotation.x = .10;
  box(cafe, -8.4, 3.98, .83, 10.6, .34, .08, standard('#385b54'));
  for (let x = -13.2; x < -3.3; x += .53) box(cafe, x, 3.92, .884, .04, .21, .007, standard('#6b8776'), false);
  // Upper floor, balcony, window trims and roof tile strips.
  box(cafe, -8.4, 6.45, -4.7, 10.3, 3.8, 7.0, standard('#b9b0a2'));
  for (const x of [-11.5, -8.4, -5.3]) {
    box(cafe, x, 6.5, -1.14, 1.8, 2.1, .09, darkWood);
    box(cafe, x, 6.5, -1.075, 1.58, 1.89, .02, standard('#a99377', .5, .2), false);
    box(cafe, x, 6.5, -1.045, .055, 2.05, .05, darkWood);
    box(cafe, x, 6.5, -1.045, 1.8, .055, .05, darkWood);
  }
  box(cafe, -8.4, 5.52, -.65, 9.3, .15, .9, metal);
  for (let x = -12.8; x < -3.6; x += .43) box(cafe, x, 5.99, -.23, .036, .83, .04, metal);
  box(cafe, -8.4, 6.42, -.23, 9.3, .045, .045, metal);
  const roof = box(cafe, -8.4, 8.46, -4.6, 11.0, .25, 8.0, charcoal); roof.rotation.x = .06;
  for (let x = -13.8; x < -3; x += .32) box(cafe, x, 8.60, -4.5, .04, .075, 7.8, standard('#536374'), false).rotation.x = .06;
  // Window counter, seated girl position, mugs, cafe bar and pendant lights.
  rounded(cafe, -10.6, 1.15, -1.93, 4.8, .13, .85, .035, wood);
  for (const x of [-12.6, -8.6]) box(cafe, x, .66, -1.9, .08, 1.05, .55, darkWood);
  const windowChair = chair(cafe, SEAT.x, CHAIR_OPEN_Z); chair(cafe, -12, -3.10);
  mug(cafe, -10.2, 1.22, -2.20, true); mug(cafe, -11.9, 1.22, -2.06, true);
  box(cafe, -5.0, 1.05, -6.55, 2.9, 1.7, 1.35, darkWood);
  rounded(cafe, -5.0, 1.94, -6.55, 3.08, .12, 1.5, .035, wood);
  const steel = new THREE.MeshStandardMaterial({ color: '#89989e', metalness: .82, roughness: .25 });
  rounded(cafe, -4.45, 2.26, -6.63, 1.08, .49, .50, .035, steel);
  rounded(cafe, -4.45, 2.43, -6.65, 1.12, .18, .53, .026, charcoal);
  box(cafe, -4.45, 2.07, -6.29, 1.13, .035, .37, steel);
  for (const x of [-4.72, -4.20]) {
    cylinder(cafe, x, 2.25, -6.38, .055, .075, steel);
    box(cafe, x, 2.20, -6.21, .022, .025, .28, charcoal);
    mug(cafe, x, 2.09, -6.15);
  }
  cylinder(cafe, -5.62, 2.12, -6.55, .14, .28, charcoal);
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(.15, .12, .27, 24), new THREE.MeshPhysicalMaterial({ color: '#bdcad2', transparent: true, opacity: .3, roughness: .07 })); hopper.position.set(-5.62,2.4,-6.55); cafe.add(hopper);
  cylinder(cafe, -5.62, 2.32, -6.55, .108, .06, standard('#38251d', .8));
  for (const x of [-5.95, -5.14]) cylinder(cafe, x, 2.12, -6.6, .11, .28, standard('#e9d3a8', .3));
  for (const y of [2.45, 3.1]) {
    box(cafe, -7.0, y, -7.73, 3.7, .09, .48, darkWood);
    for (let i = 0; i < 8; i++) cylinder(cafe, -8.4 + i * .37, y + .14, -7.63, .075, .19, standard(i % 2 ? '#d2c3a9' : '#747b70'));
  }
  // Small lounge tables, leather bench, books and pastry display at the back.
  rounded(cafe,-11.95,.78,-6.95,1.30,.18,1.1,.07,standard('#456353',.6));
  rounded(cafe,-11.95,1.13,-7.40,1.38,.70,.14,.06,standard('#385347',.6));
  for(const x of [-12.44,-11.45]) cylinder(cafe,x,.48,-6.93,.035,.65,metal);
  cylinder(cafe,-10.36,.63,-6.35,.047,.93,metal);
  cylinder(cafe,-10.36,.24,-6.35,.34,.04,metal);
  const roundTable=new THREE.Mesh(new THREE.CylinderGeometry(.62,.62,.085,48),wood); roundTable.position.set(-10.36,1.1,-6.35);roundTable.castShadow=true;cafe.add(roundTable);
  chair(cafe,-9.35,-6.42,-Math.PI/2);mug(cafe,-10.40,1.144,-6.19,true);
  for(let b=0;b<3;b++) {rounded(cafe,-10.11,1.16+b*.045,-6.5,.26,.036,.32,.005,standard(['#596f76','#b38967','#4b685c'][b],.65)).rotation.y=.15;}
  const pastryGlass = new THREE.MeshPhysicalMaterial({color:'#d2e1e0',transparent:true,opacity:.15,roughness:.03,side:THREE.DoubleSide,depthWrite:false});
  const display = new THREE.Mesh(new THREE.BoxGeometry(.76,.45,.57),pastryGlass);display.position.set(-6.00,2.21,-6.16);cafe.add(display);
  box(cafe,-6,1.99,-6.16,.80,.035,.59,steel);
  for(const x of [-6.19,-5.91]) for(const z of [-6.30,-6.05]) {
    const bun=new THREE.Mesh(new THREE.TorusGeometry(.077,.038,10,20),standard('#c58f51',.65));bun.position.set(x,2.06,z);bun.rotation.x=Math.PI/2;cafe.add(bun);
  }
  label(cafe, '今日菜单\n手冲咖啡\n奶香拿铁\n热可可', -11.0, 2.8, -7.89, 1.1, 1.5, '#293a38', '#e5d8bf', 'serif', .08);
  // Generated street artwork is a framed print inside the 3D room.
  const paintingTexture = loader.load('/assets/street-painting.png'); paintingTexture.colorSpace = THREE.SRGBColorSpace;
  box(cafe, -9.05, 2.82, -7.87, 1.94, 1.19, .07, darkWood);
  const painting = new THREE.Mesh(new THREE.PlaneGeometry(1.82, 1.07), new THREE.MeshStandardMaterial({ map: paintingTexture, roughness: .9 })); painting.position.set(-9.05, 2.82, -7.823); cafe.add(painting);
  for (const x of [-11.8, -8.5, -5.0]) {
    cylinder(cafe, x, 3.80, -3.7, .013, 1.1, charcoal);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.37, .3, 24, 1, true), standard('#726049', .5)); shade.position.set(x, 3.22, -3.7); cafe.add(shade);
    cylinder(cafe, x, 3.06, -3.7, .26, .05, warmLight);
    const light = new THREE.PointLight('#ffc589', 7, 9, 2); light.position.set(x, 3.03, -3.7); cafe.add(light);
  }
  plant(cafe, -12.9, .18, -2.1, 1.25); plant(cafe, -6.4, .18, -2.3, 1.1);
  const cafeSpill = new THREE.PointLight('#ffbc6b', 55, 13, 2); cafeSpill.position.set(-9, 2.8, -.25); scene.add(cafeSpill);
  plant(scene, -13.8, .14, -.10, 1.4); plant(scene, -2.9, .14, -.04, 1.0);
  // A-frame menu board by the actual entrance.
  const menu = label(scene, '营业中', -2.3, 1.0, .29, .7, 1.1, '#2c3935', '#dfd2b4', 'serif', .07); menu.rotation.x = -.12;
  for (const x of [-2.67, -1.92]) box(scene, x, .73, .17, .05, 1.4, .06, wood);
  // Convenience store: transparent opening with actual shelves and stock inside.
  const store = new THREE.Group(); scene.add(store);
  box(store, 5.0, .11, -5.25, 10.0, .22, 7.0, standard('#8c9495'));
  box(store, 5.0, 2.35, -8.75, 10, 4.7, .2, standard('#9aadaf'));
  box(store, .0, 2.35, -5.25, .2, 4.7, 7, standard('#a4adaf'));
  box(store, 10.0, 2.35, -5.25, .2, 4.7, 7, standard('#a4adaf'));
  box(store, 5, 4.7, -5.25, 10.4, .18, 7.4, charcoal);
  box(store, 5, 4.0, -1.62, 10.3, .83, .18, standard('#e3ead7', .7, .45));
  box(store, 5, 4.31, -1.50, 10.4, .13, .07, mintLight);
  box(store, 5, 3.64, -1.50, 10.4, .13, .07, standard('#6ab4a4', .6, .7));
  label(store, '雨月便利店', 4.3, 4.00, -1.49, 5.0, .55, '#e3ead7', '#315e54', 'sans-serif', .7);
  label(store, '24小时', 8.9, 4.00, -1.48, 1.15, .55, '#e3ead7', '#52776b', 'sans-serif', .7);
  for (let x = .2; x <= 9.8; x += 2.4) box(store, x, 1.93, -1.70, .10, 3.47, .12, metal);
  for (const y of [.27, 1.1, 3.50]) box(store, 5, y, -1.70, 10, .07, .11, metal);
  const storeglass = new THREE.MeshPhysicalMaterial({ color: '#badce3', transparent: true, opacity: .08, roughness: .06, side: THREE.DoubleSide, depthWrite: false });
  for (let x = 1.4; x < 10; x += 2.4) { const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.27, 3.2), storeglass); pane.position.set(x, 1.91, -1.69); store.add(pane); }
  // A lowered retail ceiling, tiled floor and lit refrigerators establish a
  // human scale. Gondolas leave aisles, rather than filling the window with bars.
  const shelfMetal = standard('#c9cec7', .48), shelfEdge = standard('#80978c', .52);
  const staticStockGeometries = new Set([cube, cyl]);
  const bottleGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(.062, 0), new THREE.Vector2(.070, .016), new THREE.Vector2(.070, .23),
    new THREE.Vector2(.060, .265), new THREE.Vector2(.027, .30), new THREE.Vector2(.027, .335)
  ], 12);
  const bagGeometry = new RoundedBoxGeometry(.19, .28, .065, 2, .014);
  staticStockGeometries.add(bottleGeometry); staticStockGeometries.add(bagGeometry);
  function stock(x, y, z, type, variant, facing = 0) {
    const material = packages[variant % packages.length];
    if (type === 0) {
      const bottle = new THREE.Mesh(bottleGeometry, material); bottle.position.set(x, y, z); bottle.rotation.y = facing;
      bottle.castShadow = true; store.add(bottle);
      cylinder(store, x, y + .343, z, .031, .020, standard(['#e3e0cc','#355c43','#564439'][variant % 3], .5));
    } else if (type === 1) {
      cylinder(store, x, y + .11, z, .069, .22, material);
      cylinder(store, x, y + .224, z, .066, .008, standard('#c0c4bc', .28));
    } else if (type === 2) {
      box(store, x, y + .14, z, .145, .28, .14, material).rotation.y = facing;
      box(store, x, y + .298, z, .145, .036, .083, material).rotation.y = facing;
      box(store, x, y + .32, z, .145, .009, .026, shelfMetal).rotation.y = facing;
    } else {
      const bag = new THREE.Mesh(bagGeometry, material); bag.position.set(x, y + .14, z); bag.rotation.y = facing;
      bag.castShadow = true; store.add(bag);
      box(store, x, y + .269, z, .18, .011, .068, standard('#dbc8a3', .52)).rotation.y = facing;
    }
  }
  box(store, 5, .225, -5.23, 9.8, .009, 6.76, standard('#c3c2b6', .62));
  for (let x = .5; x < 10; x += .62) box(store, x, .231, -5.23, .012, .002, 6.76, standard('#929a95', .65), false);
  for (let z = -8.5; z < -1.9; z += .62) box(store, 5, .231, z, 9.8, .002, .012, standard('#929a95', .65), false);
  box(store, 5, 3.56, -5.25, 9.78, .10, 6.8, standard('#d0d2c8', .65));
  for (const x of [1.7, 5, 8.3]) for (const z of [-3.5, -6.6]) {
    box(store, x, 3.49, z, 2.25, .075, .28, shelfMetal);
    box(store, x, 3.445, z, 2.12, .015, .20, standard('#f0f1dd', .5, 1.4));
  }
  for (let bay = 0; bay < 5; bay++) {
    const x = 1.22 + bay * 1.84;
    box(store, x, 1.62, -8.49, 1.75, 2.78, .09, shelfMetal);
    for (const side of [-1,1]) box(store, x + side * .84, 1.62, -8.12, .07, 2.78, .78, shelfMetal);
    for (const y of [.27,2.97]) box(store, x, y, -8.12, 1.75, .08, .78, shelfMetal);
    box(store, x, 1.63, -8.423, 1.59, 2.49, .052, standard('#3f514f', .58));
    box(store, x, 1.63, -8.38, 1.43, 2.33, .030, standard('#8b9991', .6));
    // Keep the stock in front of the interior backing, behind the real door.
    for (let tier = 0; tier < 4; tier++) {
      const y = .51 + tier * .58;
      box(store, x, y, -7.96, 1.52, .035, .51, shelfMetal);
      for (let col = 0; col < 8; col++) stock(x - .63 + col * .18, y + .025, -7.88, (bay + tier) % 3, (bay + tier) % 6);
      label(store, tier % 2 ? '鲜奶 ¥8.0  ·  茶饮 ¥5.5' : '果汁 ¥6.0  ·  水 ¥3.0', x, y - .023, -7.688, 1.50, .067, '#e7e6cf', '#40524c', 'sans-serif', .1);
    }
    for (const a of [-.77, .77]) box(store, x + a, 1.64, -7.64, .035, 2.47, .06, shelfEdge);
    box(store, x - .70, 1.62, -7.60, .025, .57, .043, metal);
    box(store, x + .69, 1.60, -7.685, .025, 2.29, .021, standard('#e0e8d4', .5, .8));
    const fridgePane = new THREE.Mesh(new THREE.PlaneGeometry(1.50, 2.41), storeglass);
    fridgePane.position.set(x, 1.64, -7.63); store.add(fridgePane);
  }
  label(store, '冷藏饮品  ·  新鲜每日到店', 5, 3.14, -7.68, 8.95, .25, '#507368', '#e4eadb', 'sans-serif', .25);
  for (let aisle = 0; aisle < 2; aisle++) {
    const x = 2.43 + aisle * 3.14, z = -4.71;
    box(store, x, .345, z, 1.20, .23, 3.40, shelfEdge);
    box(store, x, 1.41, z, .075, 2.13, 3.34, shelfMetal);
    for (const zz of [z - 1.62, z + 1.62]) for (const side of [-1, 1]) box(store, x + side * .53, 1.39, zz, .038, 2.12, .038, shelfEdge);
    for (let tier = 0; tier < 4; tier++) {
      const y = .48 + tier * .51;
      box(store, x, y, z, 1.18, .043, 3.36, shelfMetal);
      for (const side of [-1, 1]) {
        box(store, x + side * .594, y + .025, z, .025, .075, 3.36, shelfEdge);
        for (let col = 0; col < 14; col++) {
          const zz = z - 1.48 + col * .226;
          stock(x + side * .35, y + .035, zz, aisle ? 3 : tier % 3, (aisle * 3 + tier + Math.floor(col / 4)) % 6, side * Math.PI / 2);
        }
      }
    }
    // End caps face the shop window; price rails and uprights frame the stock.
    for (let tier = 0; tier < 3; tier++) {
      const y = .55 + tier * .52;
      box(store, x, y, -2.91, 1.09, .04, .34, shelfMetal);
      for (let col = 0; col < 4; col++) stock(x - .35 + col * .23, y + .03, -2.86, aisle ? 3 : tier % 3, aisle ? 3 : tier);
      label(store, aisle ? '人气零食  ¥9.9' : '当季茶饮  ¥5.5', x, y - .02, -2.729, 1.07, .082, '#e5e4cc', '#405a4e', 'sans-serif', .1);
    }
    label(store, aisle ? '零食 · 日常用品' : '饮料 · 牛奶', x, 2.57, -2.98, 1.25, .21, '#507466', '#e9ecd9', 'sans-serif', .2);
  }
  const storeLight = new THREE.PointLight('#f1f1df', 32, 15, 2); storeLight.position.set(5, 3.1, -3.4); store.add(storeLight);
  const coldLight = new THREE.PointLight('#d6eee8', 22, 11, 2); coldLight.position.set(5, 2.8, -7.2); store.add(coldLight);
  // Checkout at counter height, with customer display, card terminal and warmer.
  box(store, 8.60, .78, -2.86, 1.93, 1.10, .93, standard('#729386', .55));
  box(store, 8.60, 1.35, -2.86, 2.02, .08, 1.01, standard('#dfd7bf', .43));
  box(store, 8.60, .34, -2.86, 1.80, .22, .88, charcoal);
  label(store, '欢迎光临', 8.60, .95, -2.385, 1.63, .27, '#668777', '#e3ead4', 'sans-serif', .15);
  cylinder(store, 8.93, 1.43, -2.98, .043, .12, metal);
  rounded(store, 8.93, 1.64, -2.98, .42, .30, .08, .02, charcoal);
  label(store, '合计 18.00 元', 8.93, 1.65, -2.932, .36, .22, '#203c37', '#b9ddba', 'sans-serif', .35);
  rounded(store, 8.65, 1.414, -2.49, .20, .075, .27, .016, charcoal).rotation.x = -.15;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) box(store, 8.60 + col * .047, 1.454, -2.45 - row * .05, .032, .007, .03, shelfMetal, false);
  box(store, 7.96, 1.64, -3.10, .65, .50, .04, shelfMetal);
  for (const side of [-1,1]) box(store, 7.96 + side * .30, 1.64, -2.86, .04, .50, .53, shelfMetal);
  for (const y of [1.41,1.87]) box(store, 7.96, y, -2.86, .65, .04, .53, shelfMetal);
  const warmerPane = new THREE.Mesh(new THREE.PlaneGeometry(.52, .34), storeglass); warmerPane.position.set(7.96, 1.64, -2.558); store.add(warmerPane);
  for (let i = 0; i < 3; i++) rounded(store, 7.79 + i * .17, 1.54, -2.80, .14, .10, .11, .04, standard('#c49a5e', .65));
  label(store, '热食', 7.96, 1.865, -2.573, .50, .075, '#66816f', '#ece2bf', 'sans-serif', .1);
  for (let tier = 0; tier < 3; tier++) {
    const y = .32 + tier * .075;
    box(store, .72, y, -2.49, .62, .035, .46, shelfEdge);
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) box(store, .72 + side * .30, y + .09, -2.69 + i * .077, .025, .15, .025, shelfEdge);
    for (const side of [-1, 1]) box(store, .72, y + .16, -2.49 + side * .23, .65, .025, .025, shelfEdge);
  }
  label(store,'入口',5.0,2.6,-1.64,.43,.28,'#344c57','#dde8e5','sans-serif',.35);
  label(store,'全天营业',7.75,.72,-1.63,1.65,.2,'#294d4b','#d4e7d9','sans-serif',.4);
  box(store, 5, 7.3, -5.4, 10.1, 5.1, 7.1, standard('#7e8d9d'));
  for (const x of [1.5, 4.0, 6.5, 9]) for (const y of [6.0, 8.3]) {
    box(store, x, y, -1.79, 1.4, 1.30, .09, charcoal);
    box(store, x, y, -1.73, 1.23, 1.15, .015, standard(x > 5 ? '#879392' : '#b9a387', .6, .22), false);
    box(store, x, y, -1.70, .05, 1.2, .05, metal);
  }
  // Narrow residential buildings, decorative side shop and distant skyline.
  function house(x, width, height, color) {
    box(scene, x, height / 2, -6.8, width, height, 8.9, standard(color));
    box(scene, x, .68, -2.29, width + .06, 1.35, .07, standard('#555b62'));
    for (let y = 2.5; y < height - .5; y += 2.5) for (let a = x - width / 2 + 1.2; a < x + width / 2 - .6; a += 2.3) {
      box(scene, a, y, -2.29, 1.18, 1.45, .1, charcoal);
      box(scene, a, y, -2.23, 1.01, 1.28, .018, standard(y > 5 ? '#879599' : '#c4af8b', .5, y > 5 ? .08 : .35), false);
      box(scene, a, y, -2.20, .043, 1.34, .045, metal);
    }
    box(scene, x, height + .12, -6.8, width + .55, .25, 9.5, charcoal);
  }
  house(-19, 10.1, 10.4, '#888d98'); house(15.1, 9.2, 12.1, '#839197'); house(24.4, 9.0, 8.8, '#9b968e'); house(-28.5, 8.5, 13.6, '#768594');
  label(scene, '花与生活', -19, 3.9, -2.21, 4.3, .65, '#748875', '#e0ddc7', 'serif', .2);
  const verticalSign=label(scene,'月\n灯',15.0,5.0,-1.95,1.2,2.8,'#334d64','#f3ddaa','serif',1.5);
  label(scene,'月灯拉面',15.0,2.97,-2.00,5.0,.65,'#71434c','#ffe3ba','serif',1.2);
  // The board sits in front of the facade; its lettering never shares a
  // depth plane with the brick wall or timber slats.
  box(scene,15.0,2.97,-2.06,5.12,.73,.10,darkWood);
  box(scene,15.0,2.01,-2.24,6.7,1.7,.1,brick);
  for(let x=12.2;x<18.0;x+=.22)box(scene,x,1.93,-2.12,.028,1.25,.12,darkWood);
  for(const [x,y,wallZ,ledge] of [[-12.9,6.45,-1.2,4.5],[-3.8,6.45,-1.2,4.5],[7.75,5.95,-1.85,4.5],[1.2,8.8,-1.85,7.2],[21.8,7.1,-2.35,5.5]]) {
    const z = wallZ + .26;
    // Steel brackets connect the condenser to its own facade. Refrigerant
    // lines return to that wall, rather than hanging all the way to the street.
    for (const side of [-.31,.31]) {
      box(scene,x+side,y-.28,wallZ+.18,.06,.055,.36,metal);
      box(scene,x+side,y-.12,wallZ+.034,.06,.36,.055,metal);
    }
    rounded(scene,x,y,z,.90,.47,.43,.04,standard('#bdc6c5',.45));
    const fan=new THREE.Mesh(new THREE.TorusGeometry(.16,.015,8,24),metal);fan.position.set(x+.15,y,z+.236);scene.add(fan);
    cylinder(scene,x+.15,y,z+.236,.14,.025,charcoal).rotation.x=Math.PI/2;
    for(let line=-2;line<=2;line++)box(scene,x+.15,y+line*.05,z+.255,.31,.012,.008,metal,false);
    box(scene,x-.27,y,z+.247,.14,.25,.025,metal,false);
    const pipe=new THREE.CatmullRomCurve3([new THREE.Vector3(x-.37,y-.15,z),new THREE.Vector3(x-.54,y-.3,wallZ+.055),new THREE.Vector3(x-.55,ledge+.16,wallZ+.055),new THREE.Vector3(x-.20,ledge+.08,wallZ-.05)]);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(pipe,14,.017,6,false),standard('#818789',.6)));
  }
  for (let i = 0; i < 6; i++) plant(scene, -22 + i * .95, .13, -.75, .75 + (i % 3) * .25);
  for (let i = 0; i < 22; i++) {
    const h = 12 + ((i * 13) % 21); const x = (i - 11) * 5.9;
    box(scene, x, h / 2, -28 - (i % 3) * 5, 5.0, h, 6, standard(i % 2 ? '#728298' : '#7a8a9d'), false);
  }
  // The opposite side is a real street frontage, visible through the cafe glass
  // and in the puddles. Window refraction therefore has depth and colored detail.
  box(scene, 0, .07, 19, 70, .14, 3.2, standard('#626f80'));
  const shopNames = ['旧书与咖啡', '夜色烘焙', '雨月药房', '月灯拉面', '雨月唱片'];
  const shopColors = ['#90c6f9', '#ffd399', '#9ceac8', '#e59998', '#aab6f3'];
  for (let i = 0; i < 5; i++) {
    const x = -25 + i * 12.2, width = 11.4, height = [13.4, 9.6, 16.2, 11.8, 14.2][i], z = 23;
    const facade = standard(['#687687', '#988778', '#738d94', '#8d7c7d', '#75869a'][i]);
    box(scene, x, (height + 3.8) / 2, z, width, height - 3.8, 7.4, facade);
    box(scene, x, 1.9, 26.6, width, 3.8, .18, standard('#595348'));
    for (const side of [-1, 1]) box(scene, x + side * width / 2, 1.9, z, .20, 3.8, 7.4, facade);
    box(scene, x, .14, z, width, .28, 7.4, standard('#625c54'));
    box(scene, x, 3.75, 19.15, width + .25, .65, .30, standard(shopColors[i], .4, 2));
    const sign = label(scene, shopNames[i], x, 3.78, 18.97, width * .68, .55, shopColors[i], '#283b4f', 'serif', 1.2); sign.rotation.y = Math.PI;
    for (let col = 0; col < 4; col++) {
      const wx = x - 4.1 + col * 2.73;
      box(scene, wx, 1.87, 19.18, .075, 3.24, .10, metal);
      box(scene, wx, 1.1, 24.4, 1.9, 1.35, .9, standard('#7c6550'));
      for (let row = 0; row < 3; row++) {
        box(scene, wx, 1.25 + row * .6, 24, 2.3, .06, .65, cream);
        for (let book = 0; book < 7; book++) box(scene, wx - .9 + book * .3, 1.48 + row * .6, 23.85, .18, .39, .27, standard(['#b8c3ce', '#bfb68e', '#9e7382', '#638c83'][book % 4]));
      }
    }
    for (let y = 5.5; y < height - .6; y += 2.7) for (let wx = x - 4.2; wx < x + 4.7; wx += 2.8) {
      box(scene, wx, y, 19.22, 1.60, 1.78, .12, charcoal);
      box(scene, wx, y, 19.14, 1.42, 1.58, .035, standard((Math.floor(wx + y) % 3) ? '#344c6c' : '#d4af7a', .25, (Math.floor(wx + y) % 3) ? .2 : 1.2), false);
      box(scene, wx, y, 19.10, .045, 1.70, .06, metal);
      box(scene, wx, y, 19.10, 1.55, .045, .06, metal);
      if (y < 6) { box(scene, wx, y - 1.0, 18.93, 2, .1, .8, metal); box(scene, wx, y - .55, 18.58, 2, .8, .04, metal); }
    }
    for (let y = 4.3; y < height; y += 2.7) box(scene, x, y, 19.1, width, .055, .15, standard('#485c75'), false);
    box(scene, x, height + .12, z, width + .5, .24, 7.8, charcoal);
    cylinder(scene, x + 5.1, height / 2, 18.98, .035, height, metal);
    const glow = new THREE.PointLight(shopColors[i], 85, 19, 2); glow.position.set(x, 2.4, 18.0); scene.add(glow);
    label(scene, i % 2 ? '营业中' : '营业中', x - 3.8, 2.1, 19.05, .8, .28, '#24374a', shopColors[i], 'sans-serif', 3).rotation.y = Math.PI;
  }
  // Guard rails, drainage grates and electrical fittings break up the road edge.
  for (let x = -31; x < 32; x += 2.4) {
    cylinder(scene, x, .57, 17.35, .038, 1.14, metal);
    for (const y of [.36, .97]) box(scene, x + 1.2, y, 17.35, 2.4, .046, .055, metal);
    box(scene, x, .001, .55, .58, .012, .40, charcoal, false);
    for (let g = 0; g < 5; g++) box(scene, x - .23 + g * .11, .012, .55, .025, .008, .36, metal, false);
  }
  // Red vending machine with miniature illuminated drinks.
  box(scene, 11.3, 1.4, -.84, 1.45, 2.6, .93, standard('#995258'));
  box(scene, 11.2, 1.77, -.34, 1.06, 1.57, .02, standard('#aabbd0', .5, .55), false);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) cylinder(scene, 10.82 + col * .255, 1.22 + row * .42, -.26, .07, .22, standard(['#ddc699', '#9aa9bf', '#cda1a0', '#a7c7b8'][col]));
  box(scene, 11.18, .55, -.34, .78, .18, .045, charcoal); box(scene, 11.91, 1.0, -.34, .08, .28, .025, metal);
  // Street lamps, poles and drooping overhead cables.
  for (const x of [-23, -1.5, 20]) {
    cylinder(scene, x, 3.5, 1.1, .075, 7.0, metal);
    box(scene, x + .7, 6.96, 1.1, 1.45, .055, .065, metal);
    box(scene, x + 1.2, 6.88, 1.1, .57, .10, .39, warmLight);
    const light = new THREE.PointLight('#ffd9a4', 19, 15, 2); light.position.set(x + 1.2, 6.70, 1.1); scene.add(light);
    const pole = cylinder(scene, x - .6, 6.15, -2.2, .105, 12.3, standard('#716b63'));
    box(scene, x - .6, 10.9, -2.2, 2.5, .10, .10, metal);
  }
  for (const z of [-2.3, -2.65, -3.0]) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-32, 11.8, z), new THREE.Vector3(-23.6, 11.3, z), new THREE.Vector3(-12.6, 10.25, z), new THREE.Vector3(-2.1, 11.3, z), new THREE.Vector3(9, 10.1, z), new THREE.Vector3(19.4, 11.3, z), new THREE.Vector3(31, 10.7, z)]);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 100, .023, 5, false), standard('#364455')));
  }
  // Bicycle silhouette is fully modeled, including wheel spokes and frame tubes.
  const bike = new THREE.Group(); bike.position.set(-15.0, .15, -.42); bike.rotation.y = .12; scene.add(bike);
  const line = (a, b, r, mat) => { const aa = new THREE.Vector3(...a), bb = new THREE.Vector3(...b); const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, aa.distanceTo(bb), 8), mat); o.position.copy(aa).add(bb).multiplyScalar(.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bb.sub(aa).normalize()); bike.add(o); };
  for (const x of [-.66, .66]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(.43, .034, 8, 32), charcoal); wheel.position.set(x, .43, 0); bike.add(wheel);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI; line([x - Math.cos(a) * .40, .43 - Math.sin(a) * .40, 0], [x + Math.cos(a) * .40, .43 + Math.sin(a) * .40, 0], .006, metal); }
  }
  for (const [a, b] of [[[-.66,.43,0],[-.25,1.07,0]],[[-.25,1.07,0],[.2,.43,0]],[[.2,.43,0],[-.66,.43,0]],[[-.25,1.07,0],[.47,1.07,0]],[[.47,1.07,0],[.2,.43,0]],[[.47,1.07,0],[.66,.43,0]],[[.47,1.07,0],[.5,1.3,0]]]) line(a, b, .025, standard('#a09786', .4));
  box(bike, -.25, 1.12, 0, .29, .06, .14, charcoal); line([.50,1.3,-.21],[.50,1.3,.21],.022,metal);
  // A soft destination marker is geometric, so it belongs to the 3D scene.
  const marker = new THREE.Mesh(new THREE.RingGeometry(.33, .36, 40), new THREE.MeshBasicMaterial({ color: '#e6d1ac', transparent: true, opacity: .65, side: THREE.DoubleSide })); marker.rotation.x = -Math.PI / 2; marker.position.y = .16; marker.visible = false; scene.add(marker);
  // Hundreds of repeated walls, shelf products, railings and fittings share
  // geometry. Bake their fixed transforms into material-based instance batches.
  // The moving door and the individually shaded window panes remain separate.
  scene.updateMatrixWorld(true);
  const batches = new Map();
  scene.traverse(o => {
    if (!o.isMesh || !staticStockGeometries.has(o.geometry)) return;
    let ancestor = o; while (ancestor) { if (ancestor === doorPivot || ancestor === windowChair) return; ancestor = ancestor.parent; }
    const key = `${o.geometry.uuid}:${o.material.uuid}:${o.castShadow}`;
    if (!batches.has(key)) batches.set(key, []); batches.get(key).push(o);
  });
  for (const objects of batches.values()) {
    const first = objects[0], batch = new THREE.InstancedMesh(first.geometry, first.material, objects.length);
    batch.castShadow = first.castShadow; batch.receiveShadow = true;
    objects.forEach((o, i) => { batch.setMatrixAt(i, o.matrixWorld); o.removeFromParent(); });
    batch.computeBoundingSphere(); batch.name = 'Static street geometry'; scene.add(batch);
  }
  return { ground, groundMat, glass, doorPivot, doorHandle, ceiling, marker, hemi, moonLight, cafe, store, windowChair, coffeeSources, chair, mug };
}
