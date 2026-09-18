import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addVertexColor } from './core.js';
import { isWater, getBiome, collected, getProp } from './world.js';
import { scene, lightPool, lightAssignState } from './render.js';

/* ============ 全局 Map：只存逻辑数据 ============ */
export const furnaces = new Map();
export const smokers = new Map();
export const chests = new Map();
export const campfires = new Map();
export const fenceGates = new Map();
export const crystalState = { key: null, mesh: null };

/* ============ 静态建筑实例化批次 ============ */
const staticMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const basicMaterials = {
  torchFlame: new THREE.MeshBasicMaterial({ color: 0xffbb44 }),
  lanternGlow: new THREE.MeshBasicMaterial({ color: 0xffdd77 }),
  furnaceFire: null, // per-furnace (animated)
};

class StaticBatch {
  constructor(scene, geometry, material, maxCount, castShadow=false) {
    this.mesh = new THREE.InstancedMesh(geometry, material, maxCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.castShadow = castShadow;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    this.map = new Map();
    this.recycle = [];
    this._dummy = new THREE.Object3D();
    this.maxCount = maxCount;
  }
  add(key, x, y, z, rotY=0, scale=1) {
    let idx;
    if (this.recycle.length > 0) idx = this.recycle.pop();
    else {
      idx = this.map.size + this.recycle.length;
      if (idx >= this.maxCount) return -1;
    }
    this._dummy.position.set(x, y, z);
    this._dummy.rotation.set(0, rotY, 0);
    this._dummy.scale.setScalar(scale);
    this._dummy.updateMatrix();
    this.mesh.setMatrixAt(idx, this._dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.map.set(key, idx);
    if (idx + 1 > this.mesh.count) this.mesh.count = idx + 1;
    return idx;
  }
  remove(key) {
    const idx = this.map.get(key);
    if (idx === undefined) return false;
    this.map.delete(key);
    this._dummy.position.set(0, -9999, 0);
    this._dummy.rotation.set(0, 0, 0);
    this._dummy.scale.setScalar(0.0001);
    this._dummy.updateMatrix();
    this.mesh.setMatrixAt(idx, this._dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.recycle.push(idx);
    return true;
  }
  has(key) { return this.map.has(key); }
  clear() {
    this.map.clear();
    this.recycle.length = 0;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ============ 构建原型几何（用顶点颜色模拟多材质） ============ */
function boxGeo(w,h,d, x,y,z, color) {
  const g = new THREE.BoxGeometry(w,h,d);
  g.translate(x,y,z);
  addVertexColor(g, color);
  return g;
}

function buildBridgeProto() {
  const g = [];
  g.push(boxGeo(1, 0.10, 1, 0,-0.05,0, 0xa97445));
  const bm = 0x7a4a20;
  for (const rot of [Math.PI/4, -Math.PI/4]) {
    const bg = new THREE.BoxGeometry(1.32, 0.04, 0.10);
    bg.rotateY(rot); bg.translate(0, 0.005, 0);
    addVertexColor(bg, bm); g.push(bg);
  }
  g.push(boxGeo(0.26, 0.06, 0.26, 0,0.02,0, bm));
  for (const [ox,oz] of [[-0.42,-0.42],[0.42,-0.42],[-0.42,0.42],[0.42,0.42]]) {
    g.push(boxGeo(0.16, 0.08, 0.16, ox,0.02,oz, bm));
  }
  const m = mergeGeometries(g, false); g.forEach(x => x.dispose()); return m;
}

function buildFenceProto() {
  const g = [];
  const postColor = 0x5a3a1e, railColor = 0x6b4423;
  const positions = [
    [-0.4,-0.4],[0,-0.4],[0.4,-0.4],[-0.4,0],[0,0],[0.4,0],[-0.4,0.4],[0,0.4],[0.4,0.4],
  ];
  for (const [ox,oz] of positions) {
    g.push(boxGeo(0.16, 0.95, 0.16, ox, 0.475, oz, postColor));
    const tip = new THREE.BoxGeometry(0.14, 0.12, 0.14);
    tip.rotateY(Math.PI/4); tip.translate(ox, 0.99, oz);
    addVertexColor(tip, railColor); g.push(tip);
  }
  for (const y of [0.25, 0.60]) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const [px, pz] = positions[i*3+j];
      if (j < 2) g.push(boxGeo(0.4, 0.07, 0.06, px+0.2, y, pz, railColor));
      if (i < 2) g.push(boxGeo(0.06, 0.07, 0.4, px, y, pz+0.2, railColor));
    }
  }
  const m = mergeGeometries(g, false); g.forEach(x => x.dispose()); return m;
}

function buildStoneWallProto() {
  const g = [];
  g.push(boxGeo(1, 0.10, 1, 0,0.05,0, 0x6a6a76));
  g.push(boxGeo(1, 0.95, 1, 0,0.55,0, 0x8d8d99));
  g.push(boxGeo(1.02, 0.06, 1.02, 0,0.40,0, 0x6a6a76));
  g.push(boxGeo(1.02, 0.06, 1.02, 0,0.75,0, 0x6a6a76));
  g.push(boxGeo(1.05, 0.08, 1.05, 0,1.06,0, 0x6a6a76));
  const m = mergeGeometries(g, false); g.forEach(x => x.dispose()); return m;
}

function buildChestProto() {
  const g = [];
  g.push(boxGeo(0.80, 0.42, 0.58, 0, 0.21, 0, 0xa97445));
  g.push(boxGeo(0.84, 0.16, 0.62, 0, 0.50, 0, 0x8a5a2b));
  g.push(boxGeo(0.16, 0.16, 0.06, 0, 0.38, 0.31, 0xffd166));
  g.push(boxGeo(0.06, 0.56, 0.60, -0.30, 0.28, 0, 0x6b6b76));
  g.push(boxGeo(0.06, 0.56, 0.60,  0.30, 0.28, 0, 0x6b6b76));
  const m = mergeGeometries(g, false); g.forEach(x => x.dispose()); return m;
}

function buildTorchStickProto() {
  return boxGeo(0.10, 0.45, 0.10, 0, 0.225, 0, 0x6b4423);
}
function buildTorchFlameProto() {
  return boxGeo(0.18, 0.18, 0.18, 0, 0.55, 0, 0xffffff);
}

function buildLanternGroundProto() {
  const g = [];
  g.push(boxGeo(0.32, 0.06, 0.32, 0, 0.05, 0, 0x3a3a42));
  g.push(boxGeo(0.32, 0.06, 0.32, 0, 0.38, 0, 0x4a4a52));
  for (const [ox,oz] of [[-0.13,-0.13],[0.13,-0.13],[-0.13,0.13],[0.13,0.13]]) {
    g.push(boxGeo(0.05, 0.28, 0.05, ox, 0.21, oz, 0x3a3a42));
  }
  g.push(boxGeo(0.32, 0.06, 0.32, 0, 0.06, 0, 0x4a4a52));
  const m = mergeGeometries(g, false); g.forEach(x => x.dispose()); return m;
}
function buildLanternGroundGlowProto() {
  return boxGeo(0.22, 0.24, 0.22, 0, 0.21, 0, 0xffffff);
}
function buildLanternWallProto() {
  const g = [];
  g.push(boxGeo(0.04, 0.12, 0.04, 0, 1.52, 0, 0x4a4a52));
  g.push(boxGeo(0.32, 0.06, 0.32, 0, 1.44, 0, 0x4a4a52));
  for (const [ox,oz] of [[-0.13,-0.13],[0.13,-0.13],[-0.13,0.13],[0.13,0.13]]) {
    g.push(boxGeo(0.05, 0.28, 0.05, ox, 1.28, oz, 0x3a3a42));
  }
  g.push(boxGeo(0.32, 0.06, 0.32, 0, 1.12, 0, 0x4a4a52));
  const m = mergeGeometries(g, false); g.forEach(x => x.dispose()); return m;
}
function buildLanternWallGlowProto() {
  return boxGeo(0.22, 0.24, 0.22, 0, 1.28, 0, 0xffffff);
}

/* ============ 初始化批次 ============ */
export const batches = {
  bridge: null, fence: null, stone_wall: null, chest: null,
  torchStick: null, torchFlame: null,
  lanternGround: null, lanternGroundGlow: null,
  lanternWall: null, lanternWallGlow: null,
};

export function initBuildingBatches() {
  const MAX = 400;
  batches.bridge = new StaticBatch(scene, buildBridgeProto(), staticMaterial, MAX, false);
  batches.fence = new StaticBatch(scene, buildFenceProto(), staticMaterial, MAX, false);
  batches.stone_wall = new StaticBatch(scene, buildStoneWallProto(), staticMaterial, MAX, false);
  batches.chest = new StaticBatch(scene, buildChestProto(), staticMaterial, MAX, false);
  batches.torchStick = new StaticBatch(scene, buildTorchStickProto(), staticMaterial, MAX, false);
  batches.torchFlame = new StaticBatch(scene, buildTorchFlameProto(), basicMaterials.torchFlame, MAX, false);
  batches.lanternGround = new StaticBatch(scene, buildLanternGroundProto(), staticMaterial, MAX, false);
  batches.lanternGroundGlow = new StaticBatch(scene, buildLanternGroundGlowProto(), basicMaterials.lanternGlow, MAX, false);
  batches.lanternWall = new StaticBatch(scene, buildLanternWallProto(), staticMaterial, MAX, false);
  batches.lanternWallGlow = new StaticBatch(scene, buildLanternWallGlowProto(), basicMaterials.lanternGlow, MAX, false);
}

/* ============ 动态建筑（Group）：熔炉、烟熏炉、篝火、栅栏门 ============ */
// 材质复用
const MAT = {
  furnaceBase: new THREE.MeshLambertMaterial({ color: 0x4a4a52 }),
  furnaceBody: new THREE.MeshLambertMaterial({ color: 0x5a5a64 }),
  furnaceFrame: new THREE.MeshLambertMaterial({ color: 0x2a2a30 }),
  furnaceTop: new THREE.MeshLambertMaterial({ color: 0x3e3e46 }),
  smokerBody: new THREE.MeshLambertMaterial({ color: 0x8a5a2b }),
  smokerDark: new THREE.MeshLambertMaterial({ color: 0x5a3a1e }),
  smokerPipe: new THREE.MeshLambertMaterial({ color: 0x4a4a52 }),
  smokerTop: new THREE.MeshLambertMaterial({ color: 0x6a4a20 }),
  stoneDark: new THREE.MeshLambertMaterial({ color: 0x6a6a76 }),
  stone: new THREE.MeshLambertMaterial({ color: 0x8d8d99 }),
  campStone: new THREE.MeshLambertMaterial({ color: 0x5a5a66 }),
  campLog1: new THREE.MeshLambertMaterial({ color: 0x6b4423 }),
  campLog2: new THREE.MeshLambertMaterial({ color: 0x8a5a2b }),
  campCharcoal: new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
  fencePost: new THREE.MeshLambertMaterial({ color: 0x5a3a1e }),
  fenceRail: new THREE.MeshLambertMaterial({ color: 0x6b4423 }),
  crystalBase: new THREE.MeshLambertMaterial({ color: 0x3a4a6a }),
  crystalBody: new THREE.MeshLambertMaterial({ color: 0x7dd8f0, emissive: 0x2a6878, emissiveIntensity: 0.8 }),
  crystalMid: new THREE.MeshLambertMaterial({ color: 0xa8e8f8, emissive: 0x3a88a0, emissiveIntensity: 0.7 }),
  smoke: new THREE.MeshBasicMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.45, depthWrite: false }),
};

export function createFurnaceMesh(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.10, 0.92), MAT.furnaceBase);
  base.position.y = 0.05; base.receiveShadow = true; g.add(base);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.85), MAT.furnaceBody);
  body.position.y = 0.55; body.receiveShadow = true; g.add(body);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.50, 0.06), MAT.furnaceFrame);
  frame.position.set(0, 0.5, 0.44); g.add(frame);
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8a3d });
  const fire = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.40, 0.05), fireMat);
  fire.position.set(0, 0.5, 0.47); g.add(fire);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.08, 0.60), MAT.furnaceTop);
  top.position.y = 1.06; g.add(top);
  scene.add(g);
  return { group: g, fireMat, data: { inputType: null, input: 0, fuel: 0, outputType: null, output: 0, progress: 0 } };
}

export function createSmokerMesh(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.10, 0.92), MAT.smokerDark);
  base.position.y = 0.05; base.receiveShadow = true; g.add(base);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.85), MAT.smokerBody);
  body.position.y = 0.55; body.receiveShadow = true; g.add(body);
  const vent = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.30, 0.05), MAT.smokerDark);
  vent.position.set(0, 0.55, 0.44); g.add(vent);
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff9a3d });
  const fire = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.30, 0.06), fireMat);
  fire.position.set(0, 0.55, 0.47); g.add(fire);
  const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.35, 0.30), MAT.smokerPipe);
  pipe.position.set(0, 1.22, 0); g.add(pipe);
  const pipeTop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), MAT.smokerTop);
  pipeTop.position.y = 1.42; g.add(pipeTop);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.08, 0.60), MAT.smokerTop);
  top.position.y = 1.06; g.add(top);
  const smoke = [];
  const sizes = [0.42, 0.55, 0.30];
  for (let i = 0; i < 3; i++) {
    const sMat = MAT.smoke.clone();
    const m = new THREE.Mesh(new THREE.BoxGeometry(sizes[i], sizes[i], sizes[i]), sMat);
    m.position.set(0, 1.5 + i * 0.55, 0);
    m.renderOrder = 20;
    g.add(m);
    smoke.push({ mesh: m, baseY: 1.5 + i * 0.55, phase: i * 0.25, speed: 0.35 + Math.random() * 0.15, spinSpeed: (Math.random() - 0.5) * 0.8 });
  }
  scene.add(g);
  return { group: g, fireMat, data: { inputType: null, input: 0, fuel: 0, outputType: null, output: 0, progress: 0 }, smoke };
}

export function createCampfireMesh(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.32), MAT.campStone);
    s.position.set(Math.cos(a) * 0.5, 0.07, Math.sin(a) * 0.5);
    s.rotation.y = a; s.receiveShadow = true; g.add(s);
  }
  for (const rot of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
    const log = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.14), rot % 1 === 0 ? MAT.campLog1 : MAT.campLog2);
    log.position.y = 0.18; log.rotation.y = rot; g.add(log);
  }
  const charcoal = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.4), MAT.campCharcoal);
  charcoal.position.y = 0.24; g.add(charcoal);
  const flameMat1 = new THREE.MeshBasicMaterial({ color: 0xff6b1a });
  const flame1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.28), flameMat1);
  flame1.position.y = 0.5; g.add(flame1);
  const flameMat2 = new THREE.MeshBasicMaterial({ color: 0xffcc33 });
  const flame2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.18), flameMat2);
  flame2.position.y = 0.55; g.add(flame2);
  const flameMat3 = new THREE.MeshBasicMaterial({ color: 0xffffcc });
  const flame3 = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.24, 0.10), flameMat3);
  flame3.position.y = 0.6; g.add(flame3);
  g.userData.flameMat1 = flameMat1;
  g.userData.flameMat2 = flameMat2;
  g.userData.flameMat3 = flameMat3;
  scene.add(g);
  return g;
}

export function createFenceGateMesh(x, z, facingAngle) {
  const outer = new THREE.Group(); outer.position.set(x, 0, z); outer.rotation.y = facingAngle;
  const hinge = new THREE.Group(); hinge.position.set(-0.44, 0, 0); outer.add(hinge);
  const pivot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.95, 0.15), MAT.fencePost);
  pivot.position.set(0, 0.475, 0); hinge.add(pivot);
  const endPost = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.95, 0.15), MAT.fencePost);
  endPost.position.set(0.88, 0.475, 0); hinge.add(endPost);
  for (const y of [0.25, 0.60]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.09, 0.07), MAT.fenceRail);
    r.position.set(0.44, y, 0); hinge.add(r);
  }
  const diag = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 0.05), MAT.fenceRail);
  diag.position.set(0.44, 0.42, 0); diag.rotation.z = Math.PI / 7; hinge.add(diag);
  scene.add(outer);
  return { outer, hinge, open: false, targetAngle: 0, currentAngle: 0 };
}

export function createCrystalMesh(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.9), MAT.crystalBase), { position: new THREE.Vector3(0, 0.1, 0) }));
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), MAT.crystalBody);
  body.position.y = 0.8; g.add(body);
  const mid = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.36), MAT.crystalMid);
  mid.position.y = 1.6; g.add(mid);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), new THREE.MeshBasicMaterial({ color: 0xd0f4ff }));
  tip.position.y = 1.95; g.add(tip);
  scene.add(g);
  return g;
}

/* ============ 建筑 API（统一入口） ============ */
export function addBridge(key, x, z) { batches.bridge.add(key, x, 0, z); }
export function addFence(key, x, z) { batches.fence.add(key, x, 0, z); }
export function addStoneWall(key, x, z) { batches.stone_wall.add(key, x, 0, z); }
export function addChest(key, x, z) { batches.chest.add(key, x, 0, z); }
export function addTorch(key, x, z) {
  batches.torchStick.add(key, x, 0, z);
  batches.torchFlame.add(key, x, 0, z);
}
export function addLantern(key, x, z, onWall) {
  if (onWall) {
    batches.lanternWall.add(key, x, 0, z);
    batches.lanternWallGlow.add(key, x, 0, z);
  } else {
    batches.lanternGround.add(key, x, 0, z);
    batches.lanternGroundGlow.add(key, x, 0, z);
  }
}
export function removeBridge(key) { return batches.bridge.remove(key); }
export function removeFence(key) { return batches.fence.remove(key); }
export function removeStoneWall(key) { return batches.stone_wall.remove(key); }
export function removeChest(key) { return batches.chest.remove(key); }
export function removeTorch(key) { batches.torchStick.remove(key); batches.torchFlame.remove(key); }
export function removeLantern(key) {
  batches.lanternGround.remove(key); batches.lanternGroundGlow.remove(key);
  batches.lanternWall.remove(key); batches.lanternWallGlow.remove(key);
}

export function hasTorch(key) { return batches.torchStick.has(key); }
export function hasBridge(key) { return batches.bridge.has(key); }
export function hasFence(key) { return batches.fence.has(key); }
export function hasStoneWall(key) { return batches.stone_wall.has(key); }
export function hasLantern(key) { return batches.lanternGround.has(key) || batches.lanternWall.has(key); }

/* ============ 光源分配 ============ */
export function updateLightAssignment(px, pz) {
  const arr = [];
  for (const key of batches.torchStick.map.keys()) {
    const [tx, tz] = key.split(',').map(Number);
    arr.push({ key: 't:' + key, x: tx, z: tz, y: 0.7, d: (tx - px) ** 2 + (tz - pz) ** 2, intensity: 1.0 });
  }
  for (const key of campfires.keys()) {
    const [tx, tz] = key.split(',').map(Number);
    arr.push({ key: 'f:' + key, x: tx, z: tz, y: 0.7, d: (tx - px) ** 2 + (tz - pz) ** 2, intensity: 1.5 });
  }
  for (const key of batches.lanternGround.map.keys()) {
    const [lx, lz] = key.split(',').map(Number);
    arr.push({ key: 'l:' + key, x: lx, z: lz, y: 0.5, d: (lx - px) ** 2 + (lz - pz) ** 2, intensity: 1.3 });
  }
  for (const key of batches.lanternWall.map.keys()) {
    const [lx, lz] = key.split(',').map(Number);
    arr.push({ key: 'lw:' + key, x: lx, z: lz, y: 1.25, d: (lx - px) ** 2 + (lz - pz) ** 2, intensity: 1.3 });
  }
  if (crystalState.key) {
    const [tx, tz] = crystalState.key.split(',').map(Number);
    arr.push({ key: 'c:' + crystalState.key, x: tx, z: tz, y: 0.7, d: (tx - px) ** 2 + (tz - pz) ** 2, intensity: 1.4 });
  }
  arr.sort((a, b) => a.d - b.d);
  for (let i = 0; i < lightPool.length; i++) {
    const slot = lightPool[i];
    if (i < arr.length) {
      const item = arr[i];
      slot.light.position.set(item.x, item.y, item.z);
      slot.key = item.key;
      slot.baseIntensity = item.intensity;
    } else {
      slot.key = null;
      slot.light.intensity = 0;
    }
  }
}
export function updateLightsIfMoved(player) {
  if (player.gridX === lightAssignState.x && player.gridZ === lightAssignState.z) return;
  lightAssignState.x = player.gridX;
  lightAssignState.z = player.gridZ;
  updateLightAssignment(player.gridX, player.gridZ);
}

/* ============ 阻挡 / 占用判断 ============ */
export function blockAt(x, z) {
  const key = x + ',' + z;
  if (furnaces.has(key)) return { type: 'furnace', key };
  if (smokers.has(key)) return { type: 'smoker', key };
  if (hasFence(key)) return { type: 'fence', key };
  if (hasLantern(key)) return { type: 'lantern', key };
  if (hasStoneWall(key)) return { type: 'stone_wall', key };
  if (chests.has(key)) return { type: 'chest', key };
  if (campfires.has(key)) return { type: 'campfire', key };
  if (fenceGates.has(key)) {
    const g = fenceGates.get(key);
    if (!g.open) return { type: 'fence_gate', key };
    return null;
  }
  if (key === crystalState.key) return { type: 'crystal', key };
  if (!collected.has(key)) {
    const prop = getProp(x, z, getBiome(x, z));
    if (prop) return { type: prop, key };
  }
  return null;
}
export function buildingOccupiedAt(key) {
  return furnaces.has(key) || smokers.has(key) || hasTorch(key) || hasFence(key) ||
         fenceGates.has(key) || chests.has(key) || campfires.has(key) ||
         hasStoneWall(key) || hasLantern(key) || key === crystalState.key;
}
export function hasPropAt(x, z) {
  if (collected.has(x + ',' + z)) return false;
  return getProp(x, z, getBiome(x, z)) !== null;
}
export function hasBuilding(key) {
  return furnaces.has(key) || smokers.has(key) || hasTorch(key) || hasBridge(key) ||
         hasFence(key) || fenceGates.has(key) || chests.has(key) || campfires.has(key) ||
         hasStoneWall(key) || hasLantern(key) || key === crystalState.key;
}
export function isZombieAttackable(key) {
  return hasTorch(key) || furnaces.has(key) || chests.has(key) || smokers.has(key) ||
         campfires.has(key) || hasFence(key) || fenceGates.has(key) || hasLantern(key);
}

/* ============ 循环更新 ============ */
let furnaceFlickerTimer = 0;
export function updateFurnaces(dt, openFurnaceKey, currentFurnaceStation, updateFurnaceUI) {
  furnaceFlickerTimer -= dt;
  const doFlicker = furnaceFlickerTimer <= 0;
  if (doFlicker) furnaceFlickerTimer = 0.1;
  const now = performance.now();
  const SMELT = {
    'iron': { output: 'iron_ingot', time: 3, station: 'furnace' },
    'fish': { output: 'cooked_fish', time: 2.5, station: 'smoker' },
    'raw_pork': { output: 'cooked_pork', time: 3, station: 'smoker' },
  };
  for (const [key, f] of furnaces) {
    const d = f.data; if (!d) continue;
    const r = d.inputType ? SMELT[d.inputType] : null;
    const ok = r && r.station === 'furnace' && d.input > 0 && d.fuel > 0;
    if (ok) {
      d.progress += dt / r.time;
      if (d.progress >= 1) {
        d.progress = 0; d.input--; d.fuel--; d.output++;
        d.outputType = r.output;
        if (d.input === 0) d.inputType = null;
        if (openFurnaceKey === key && currentFurnaceStation === 'furnace' && updateFurnaceUI) updateFurnaceUI();
      }
    } else d.progress = 0;
    if (doFlicker && f.fireMat) {
      const fl = 0.85 + Math.sin(now * 0.008 + key.length) * 0.15;
      f.fireMat.color.setRGB(Math.min(1, fl), Math.min(1, 0.55 * fl), Math.min(1, 0.25 * fl));
    }
  }
  for (const [key, f] of smokers) {
    const d = f.data; if (!d) continue;
    const r = d.inputType ? SMELT[d.inputType] : null;
    const ok = r && r.station === 'smoker' && d.input > 0 && d.fuel > 0;
    if (ok) {
      d.progress += dt / r.time;
      if (d.progress >= 1) {
        d.progress = 0; d.input--; d.fuel--; d.output++;
        d.outputType = r.output;
        if (d.input === 0) d.inputType = null;
        if (openFurnaceKey === key && currentFurnaceStation === 'smoker' && updateFurnaceUI) updateFurnaceUI();
      }
    } else d.progress = 0;
    if (doFlicker && f.fireMat) {
      const fl = 0.85 + Math.sin(now * 0.008 + key.length * 1.7) * 0.15;
      f.fireMat.color.setRGB(Math.min(1, fl), Math.min(1, 0.6 * fl), Math.min(1, 0.25 * fl));
    }
  }
}

export function updateSmokerSmoke(dt) {
  const now = performance.now() * 0.001;
  for (const [, sm] of smokers) {
    if (!sm.smoke) continue;
    for (const s of sm.smoke) {
      const cycle = ((now * s.speed + s.phase) % 1 + 1) % 1;
      s.mesh.position.y = s.baseY + cycle * 1.6;
      const sc = 0.7 + cycle * 0.7;
      s.mesh.scale.set(sc, sc, sc);
      s.mesh.material.opacity = 0.55 * (1 - cycle * 0.9);
      s.mesh.rotation.y += dt * s.spinSpeed;
    }
  }
}

export function updateGates(dt) {
  for (const [, g] of fenceGates) {
    if (Math.abs(g.currentAngle - g.targetAngle) > 0.001) {
      g.currentAngle += (g.targetAngle - g.currentAngle) * Math.min(1, dt * 9);
      g.hinge.rotation.y = g.currentAngle;
    }
  }
}

let campfireFlickerTimer = 0;
export function updateCampfireFlicker(dt) {
  campfireFlickerTimer -= dt;
  if (campfireFlickerTimer > 0) return;
  campfireFlickerTimer = 0.1;
  const now = performance.now();
  for (const [, c] of campfires) {
    const f1 = 0.75 + Math.sin(now * 0.007) * 0.25;
    const f2 = 0.7 + Math.sin(now * 0.011 + 1.3) * 0.3;
    const f3 = 0.65 + Math.sin(now * 0.015 + 2.7) * 0.35;
    if (c.userData.flameMat1) c.userData.flameMat1.color.setRGB(1*f1, 0.42*f1, 0.10*f1);
    if (c.userData.flameMat2) c.userData.flameMat2.color.setRGB(1*f2, 0.80*f2, 0.20*f2);
    if (c.userData.flameMat3) c.userData.flameMat3.color.setRGB(1*f3, 1*f3, 0.80*f3);
  }
}

let lanternGlowTimer = 0;
export function updateLanternGlow(dt) {
  lanternGlowTimer -= dt;
  if (lanternGlowTimer > 0) return;
  lanternGlowTimer = 0.15;
  const now = performance.now();
  const f = 0.9 + Math.sin(now * 0.004) * 0.1;
  basicMaterials.lanternGlow.color.setRGB(1*f, 0.87*f, 0.47*f);
}

/* ============ 清理 ============ */
export function clearAllBuildings() {
  for (const [, f] of furnaces) scene.remove(f.group); furnaces.clear();
  for (const [, f] of smokers) scene.remove(f.group); smokers.clear();
  for (const [, c] of campfires) scene.remove(c); campfires.clear();
  for (const [, g] of fenceGates) scene.remove(g.outer); fenceGates.clear();
  chests.clear();
  if (crystalState.mesh) scene.remove(crystalState.mesh);
  crystalState.mesh = null; crystalState.key = null;
  for (const k in batches) batches[k].clear();
  lightAssignState.x = -9999; lightAssignState.z = -9999;
}