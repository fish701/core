import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CHUNK, hash2, fbm, addVertexColor } from './core.js';

export const BIOMES = {
  water:  { color: 0x2f7fc4, walkable: true, y: -0.62 },
  sand:   { color: 0xf2e6b8, walkable: true, y: -0.5 },
  grass:  { color: 0x76c94e, walkable: true, y: -0.5 },
  forest: { color: 0x3f9440, walkable: true, y: -0.5 },
  desert: { color: 0xe0c070, walkable: true, y: -0.5 },
  snow:   { color: 0xeaf2fb, walkable: true, y: -0.5 },
  rock:   { color: 0x8d8d99, walkable: true, y: -0.5 },
};
export function getBiome(x, z) {
  if (x * x + z * z < 9) return 'grass';
  const e = fbm(x * 0.045, z * 0.045);
  const m = fbm(x * 0.030 + 137, z * 0.030 + 137);
  if (e > 0.72) return 'rock';
  if (e < 0.29) return 'water';
  if (e < 0.35) return 'sand';
  if (e > 0.60 && m < 0.42) return 'snow';
  if (m > 0.60) return 'forest';
  if (m < 0.40) return 'desert';
  return 'grass';
}
export function isWater(x, z) { return getBiome(x, z) === 'water'; }

export function getProp(x, z, biome) {
  if (x * x + z * z < 9) return null;
  const r = hash2(x * 7.31 + 3.3, z * 11.17 + 5.1);
  switch (biome) {
    case 'forest':
      if (r < 0.38) return 'tree';
      if (r < 0.50) return 'bush';
      if (r < 0.57) return 'coal';
      break;
    case 'grass':
      if (r < 0.09) return 'tree';
      if (r < 0.17) return 'bush';
      if (r < 0.23) return 'flower';
      break;
    case 'desert':
      if (r < 0.12) return 'cactus';
      if (r < 0.20) return 'rock';
      break;
    case 'snow':
      if (r < 0.20) return 'pine';
      if (r < 0.27) return 'rock';
      if (r < 0.34) return 'iron';
      break;
    case 'rock':
      if (r < 0.20) return 'rock';
      if (r < 0.34) return 'iron';
      if (r < 0.46) return 'coal';
      break;
    case 'sand':
      if (r < 0.04) return 'rock';
      break;
  }
  return null;
}
export const PROP_HITS = { tree: 2, pine: 2, rock: 2, iron: 3, coal: 2, bush: 1, cactus: 1, flower: 1 };

/* ============ 道具几何（顶点颜色合并到区块） ============ */
const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const propMat   = new THREE.MeshLambertMaterial({ vertexColors: true });

function makePropGeo(type, x, z) {
  const geos = [];
  const seed = hash2(x * 13.13, z * 7.77);
  function addBox(w, h, d, ox, oy, oz, color) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(ox, oy, oz);
    addVertexColor(g, color);
    geos.push(g);
  }
  switch (type) {
    case 'tree': {
      const h = 0.65 + seed * 0.45;
      addBox(0.20, h, 0.20, 0, h / 2, 0, 0x8a5a2b);
      addBox(0.85, 0.55, 0.85, 0, h + 0.25, 0, 0x3f9e4a);
      addBox(0.58, 0.50, 0.58, 0, h + 0.72, 0, 0x4cbb59);
      break;
    }
    case 'pine': {
      const h = 0.58 + seed * 0.35;
      addBox(0.18, h, 0.18, 0, h / 2, 0, 0x6b4423);
      addBox(0.82, 0.45, 0.82, 0, h + 0.18, 0, 0x2f7a4a);
      addBox(0.60, 0.42, 0.60, 0, h + 0.55, 0, 0x349054);
      addBox(0.38, 0.42, 0.38, 0, h + 0.90, 0, 0x3da35f);
      addBox(0.36, 0.10, 0.36, 0, h + 1.13, 0, 0xffffff);
      break;
    }
    case 'bush': {
      addBox(0.54, 0.36, 0.54, 0, 0.18, 0, 0x40913f);
      addBox(0.16, 0.16, 0.16, 0.16, 0.42, 0.10, 0xc62a4a);
      addBox(0.14, 0.14, 0.14, -0.15, 0.36, -0.13, 0xe84060);
      break;
    }
    case 'cactus': {
      addBox(0.34, 0.85, 0.34, 0, 0.42, 0, 0x3f9e5a);
      addBox(0.15, 0.40, 0.15, 0.25, 0.50, 0, 0x3f9e5a);
      addBox(0.15, 0.32, 0.15, -0.25, 0.42, 0, 0x3f9e5a);
      break;
    }
    case 'rock': {
      const s = 0.50 + seed * 0.24;
      addBox(s, s * 0.80, s, 0, s * 0.40, 0, 0x8d8d99);
      addBox(s * 0.58, s * 0.50, s * 0.58, s * 0.26, s * 0.25, s * 0.20, 0x9d9daa);
      break;
    }
    case 'flower': {
      addBox(0.06, 0.30, 0.06, 0, 0.15, 0, 0x4caf50);
      const pal = [0xff6b8a, 0xffd166, 0xb388ff, 0xff8a5b];
      addBox(0.20, 0.14, 0.20, 0, 0.35, 0, pal[Math.floor(seed * 4) % 4]);
      break;
    }
    case 'iron': {
      const s = 0.58;
      addBox(s, s * 0.80, s, 0, s * 0.40, 0, 0x8d8d99);
      addBox(0.15, 0.15, 0.15, 0.15, 0.42, 0.15, 0xe0925a);
      addBox(0.12, 0.12, 0.12, -0.15, 0.30, -0.12, 0xe0925a);
      addBox(0.11, 0.11, 0.11, 0.10, 0.60, -0.14, 0xe0925a);
      break;
    }
    case 'coal': {
      const s = 0.58;
      addBox(s, s * 0.80, s, 0, s * 0.40, 0, 0x70707a);
      addBox(0.15, 0.15, 0.15, 0.15, 0.42, 0.15, 0x2a2a2e);
      addBox(0.12, 0.12, 0.12, -0.14, 0.30, -0.12, 0x2a2a2e);
      addBox(0.11, 0.11, 0.11, 0.10, 0.58, -0.14, 0x2a2a2e);
      break;
    }
  }
  if (geos.length === 0) return null;
  const merged = mergeGeometries(geos, false);
  geos.forEach(g => g.dispose());
  merged.translate(x, 0, z);
  return merged;
}

/* ============ 区块系统 ============ */
export const chunks = new Map();
export const collected = new Set();

export function buildChunk(scene, cx, cz) {
  const key = cx + ',' + cz;
  if (chunks.has(key)) return;
  const group = new THREE.Group();
  const groundGeos = [];
  const propGeos = [];
  for (let i = 0; i < CHUNK; i++) {
    for (let j = 0; j < CHUNK; j++) {
      const x = cx * CHUNK + i, z = cz * CHUNK + j;
      const biome = getBiome(x, z);
      const g = new THREE.BoxGeometry(1, 1, 1);
      addVertexColor(g, BIOMES[biome].color);
      g.translate(x, BIOMES[biome].y, z);
      groundGeos.push(g);
      const pk = x + ',' + z;
      if (!collected.has(pk)) {
        const prop = getProp(x, z, biome);
        if (prop) {
          const pg = makePropGeo(prop, x, z);
          if (pg) propGeos.push(pg);
        }
      }
    }
  }
  const groundGeo = mergeGeometries(groundGeos, false);
  groundGeos.forEach(g => g.dispose());
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.receiveShadow = true;
  group.add(groundMesh);
  let propMesh = null;
  if (propGeos.length > 0) {
    const pg = mergeGeometries(propGeos, false);
    propGeos.forEach(g => g.dispose());
    propMesh = new THREE.Mesh(pg, propMat);
    propMesh.castShadow = true;
    propMesh.receiveShadow = true;
    group.add(propMesh);
  }
  scene.add(group);
  chunks.set(key, { group, cx, cz, groundMesh, propMesh });
}

export function rebuildChunkProps(scene, cx, cz) {
  const c = chunks.get(cx + ',' + cz);
  if (!c) return;
  if (c.propMesh) { c.group.remove(c.propMesh); c.propMesh.geometry.dispose(); c.propMesh = null; }
  const propGeos = [];
  for (let i = 0; i < CHUNK; i++) {
    for (let j = 0; j < CHUNK; j++) {
      const x = cx * CHUNK + i, z = cz * CHUNK + j;
      if (collected.has(x + ',' + z)) continue;
      const prop = getProp(x, z, getBiome(x, z));
      if (prop) {
        const pg = makePropGeo(prop, x, z);
        if (pg) propGeos.push(pg);
      }
    }
  }
  if (propGeos.length > 0) {
    const pg = mergeGeometries(propGeos, false);
    propGeos.forEach(g => g.dispose());
    c.propMesh = new THREE.Mesh(pg, propMat);
    c.propMesh.castShadow = true;
    c.propMesh.receiveShadow = true;
    c.group.add(c.propMesh);
  }
}
function disposeChunk(scene, key) {
  const c = chunks.get(key);
  if (!c) return;
  scene.remove(c.group);
  c.groundMesh.geometry.dispose();
  if (c.propMesh) c.propMesh.geometry.dispose();
  chunks.delete(key);
}

export const chunkState = { lastKey: null };
export function updateChunksIfNeeded(scene, player) {
  const pcx = Math.floor(player.gridX / CHUNK);
  const pcz = Math.floor(player.gridZ / CHUNK);
  const k = pcx + ',' + pcz;
  if (k === chunkState.lastKey) return;
  chunkState.lastKey = k;
  const R = 2;
  for (let cx = pcx - R; cx <= pcx + R; cx++)
    for (let cz = pcz - R; cz <= pcz + R; cz++)
      buildChunk(scene, cx, cz);
  const toRemove = [];
  for (const [key, c] of chunks) {
    if (Math.abs(c.cx - pcx) > R + 1 || Math.abs(c.cz - pcz) > R + 1) toRemove.push(key);
  }
  toRemove.forEach(k2 => disposeChunk(scene, k2));
}

export function resetChunks(scene) {
  for (const [key, c] of chunks) {
    scene.remove(c.group);
    c.groundMesh.geometry.dispose();
    if (c.propMesh) c.propMesh.geometry.dispose();
  }
  chunks.clear();
  chunkState.lastKey = null;
}

/* ============ 裂纹 ============ */
export const crackOverlays = new Map();
export const propDamage = new Map();
let crackGroup = null;
let crackMat = null;

export function initCracks(scene) {
  crackGroup = new THREE.Group();
  scene.add(crackGroup);
  crackMat = new THREE.MeshBasicMaterial({
    color: 0x151515, transparent: true, opacity: 0.78,
    depthWrite: false, side: THREE.DoubleSide,
  });
}

const CRACK_PARAMS = {
  rock: { y: 0.47, s: 0.72 }, iron: { y: 0.47, s: 0.72 }, coal: { y: 0.47, s: 0.72 },
  default: { y: 0.02, s: 1.0 },
};
function makeCrackSeg(x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz) || 0.01;
  const g = new THREE.BoxGeometry(len, 0.018, 0.03);
  g.rotateY(Math.atan2(-dz, dx));
  g.translate((x1 + x2) / 2, 0, (z1 + z2) / 2);
  return g;
}
export function drawCrack(x, z, stage, total, propType) {
  const key = x + ',' + z;
  clearCrack(key);
  const progress = stage / total;
  let s = Math.floor(hash2(x * 3.7, z * 5.3) * 100000);
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; };
  const geos = [];
  const nMain = 3 + Math.floor(progress * 6);
  for (let i = 0; i < nMain; i++) {
    const a = (i / nMain) * Math.PI * 2 + rng() * 1.2;
    const r1 = 0.05 + rng() * 0.08;
    const r2 = r1 + 0.10 + progress * 0.28 * rng();
    geos.push(makeCrackSeg(Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a) * r2, Math.sin(a) * r2));
    if (progress > 0.3 && rng() > 0.4) {
      const t2 = 0.3 + rng() * 0.5;
      const bx = Math.cos(a) * r1 + (Math.cos(a) * r2 - Math.cos(a) * r1) * t2;
      const bz = Math.sin(a) * r1 + (Math.sin(a) * r2 - Math.sin(a) * r1) * t2;
      const ba = a + (rng() - 0.5) * 1.6;
      const bl = 0.05 + rng() * 0.10;
      geos.push(makeCrackSeg(bx, bz, bx + Math.cos(ba) * bl, bz + Math.sin(ba) * bl));
    }
  }
  const geo = mergeGeometries(geos, false);
  geos.forEach(g => g.dispose());
  const mesh = new THREE.Mesh(geo, crackMat);
  const p = CRACK_PARAMS[propType] || CRACK_PARAMS.default;
  mesh.position.set(x, p.y, z);
  mesh.scale.set(p.s, 1, p.s);
  crackGroup.add(mesh);
  crackOverlays.set(key, mesh);
}
export function clearCrack(key) {
  const m = crackOverlays.get(key);
  if (m) { crackGroup.remove(m); m.geometry.dispose(); crackOverlays.delete(key); }
}
export function clearAllCracks() {
  for (const [, m] of crackOverlays) { crackGroup.remove(m); m.geometry.dispose(); }
  crackOverlays.clear(); propDamage.clear();
}
export function resetWorldMaps() {
  collected.clear();
  propDamage.clear();
}