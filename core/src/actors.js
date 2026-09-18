import * as THREE from 'three';
import { t, toast, hooks, normAngle, hash2,
  MOVE_TIME_LAND, MOVE_TIME_WATER, JUMP_H, SINK_DEPTH } from './core.js';
import { scene, spawnRipple } from './render.js';
import { isWater, getBiome, BIOMES, collected, getProp } from './world.js';
import { blockAt, isZombieAttackable, buildingOccupiedAt,
  hasBuilding, stoneWallsHas, bridgesHas, crystalState } from './buildings.js';

/* ============ 全局状态 ============ */
export const healthState = { health: 100, hunger: 100, gameOver: false };

/* ============ 玩家 ============ */
export const playerMesh = new THREE.Group();
const playerBody = new THREE.Group();
playerMesh.add(playerBody);
const PLAYER_MAT = new THREE.MeshLambertMaterial({ color: 0x2ec4b6 });
const PLAYER_NOSE_MAT = new THREE.MeshLambertMaterial({ color: 0x1b8c80 });
const PLAYER_CUBE_GEO = new THREE.BoxGeometry(0.66, 0.66, 0.66);
const PLAYER_NOSE_GEO = new THREE.BoxGeometry(0.22, 0.22, 0.04);
const playerCube = new THREE.Mesh(PLAYER_CUBE_GEO, PLAYER_MAT);
playerCube.position.y = 0.33; playerCube.castShadow = true; playerCube.receiveShadow = true;
playerBody.add(playerCube);
const playerNose = new THREE.Mesh(PLAYER_NOSE_GEO, PLAYER_NOSE_MAT);
playerNose.position.set(0, 0.33, -0.34);
playerBody.add(playerNose);
scene.add(playerMesh);

export const player = {
  gridX: 0, gridZ: 0, fromX: 0, fromZ: 0,
  moving: false, t: 0, targetRot: Math.PI,
  moveTime: MOVE_TIME_LAND, swimming: false, swimBlend: 0, swamBefore: false,
};
playerMesh.rotation.y = Math.PI;

const mineAnim = { active: false, t: 0, duration: 0.32 };
export function startMineAnim() { mineAnim.active = true; mineAnim.t = 0; }
let mineLean = 0;

export function updatePlayer(dt, bridgesHasFn) {
  player.swimming = isWater(player.gridX, player.gridZ) && !bridgesHasFn(player.gridX + ',' + player.gridZ);
  const goal = player.swimming ? 1 : 0;
  player.swimBlend += (goal - player.swimBlend) * Math.min(1, dt * 7);
  if (player.swimming && !player.swamBefore) { player.swamBefore = true; toast(t('waterIn')); }
  const swimEl = document.getElementById('swimIndicator');
  if (swimEl) swimEl.classList.toggle('on', player.swimming);

  if (player.moving) {
    player.t += dt / player.moveTime;
    if (player.t >= 1) player.t = 1;
    const tt = player.t;
    const x = player.fromX + (player.gridX - player.fromX) * tt;
    const z = player.fromZ + (player.gridZ - player.fromZ) * tt;
    const sb = player.swimBlend;
    const arcY = Math.sin(tt * Math.PI) * (JUMP_H * (1 - sb) + 0.06 * sb);
    const waterOffset = isWater(player.gridX, player.gridZ) ? 0.12 : 0;
    playerMesh.position.set(x, -SINK_DEPTH * sb - waterOffset * sb + arcY, z);
    if (player.swimming) {
      _rippleTimer -= dt;
      if (_rippleTimer <= 0) { _rippleTimer = 0.14; spawnRipple(x, z); }
    }
    if (tt >= 1) {
      player.moving = false;
      hooks.onPlayerArrive && hooks.onPlayerArrive();
    }
  } else {
    const bob = Math.sin(performance.now() * 0.0035) * 0.035 * player.swimBlend;
    const waterOffset = isWater(player.gridX, player.gridZ) ? 0.12 : 0;
    playerMesh.position.y = -SINK_DEPTH * player.swimBlend - waterOffset * player.swimBlend + bob;
  }
  if (mineAnim.active) {
    mineAnim.t += dt;
    if (mineAnim.t >= mineAnim.duration) { mineAnim.active = false; mineLean = 0; }
    else {
      const p = mineAnim.t / mineAnim.duration;
      mineLean = p < 0.4 ? (p / 0.4) * 0.55 : (1 - (p - 0.4) / 0.6) * 0.55;
    }
  } else mineLean = 0;
  playerBody.rotation.x = player.swimBlend * 0.38 + mineLean;
  const diff = normAngle(player.targetRot - playerMesh.rotation.y);
  playerMesh.rotation.y += diff * Math.min(1, dt * 22);
}
let _rippleTimer = 0;

/* ============ 远程玩家 ============ */
export const remotePlayers = new Map();
const REMOTE_BODY_GEO = new THREE.BoxGeometry(0.66, 0.66, 0.66);
const REMOTE_NOSE_GEO = new THREE.BoxGeometry(0.22, 0.22, 0.04);
const remoteMatCache = new Map();
function getRemoteBodyMat(color) {
  if (!remoteMatCache.has(color)) remoteMatCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return remoteMatCache.get(color);
}
export function createRemotePlayerMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(REMOTE_BODY_GEO, getRemoteBodyMat(color));
  body.position.y = 0.33; body.castShadow = true; g.add(body);
  const nose = new THREE.Mesh(REMOTE_NOSE_GEO,
    new THREE.MeshLambertMaterial({ color: 0xffffff, opacity: 0.7, transparent: true }));
  nose.position.set(0, 0.33, -0.34); g.add(nose);
  return g;
}
export function addRemotePlayer(peerId, name, color) {
  if (remotePlayers.has(peerId)) return;
  const mesh = createRemotePlayerMesh(color);
  mesh.position.set(0, 0, 0);
  scene.add(mesh);
  remotePlayers.set(peerId, { mesh, name, color, targetX: 0, targetZ: 0, targetRot: 0,
    currX: 0, currZ: 0, currRot: 0 });
}
export function removeRemotePlayer(peerId) {
  const rp = remotePlayers.get(peerId);
  if (!rp) return;
  scene.remove(rp.mesh);
  remotePlayers.delete(peerId);
}
export function updateRemotePlayers(dt) {
  const k = 1 - Math.exp(-dt * 12);
  for (const [, rp] of remotePlayers) {
    rp.currX += (rp.targetX - rp.currX) * k;
    rp.currZ += (rp.targetZ - rp.currZ) * k;
    rp.mesh.position.set(rp.currX, 0, rp.currZ);
    const diff = normAngle(rp.targetRot - rp.currRot);
    rp.currRot += diff * Math.min(1, dt * 12);
    rp.mesh.rotation.y = rp.currRot;
  }
}

/* ============ 僵尸 ============ */
export const zombies = [];
export const ZOMBIE_MOVE_ANIM = 0.5;
export const ZOMBIE_MOVE_INTERVAL = 3.0;
export const ZOMBIE_ATTACK_COOLDOWN = 1.5;
export const ZOMBIE_HEALTH = 15;
export const ZOMBIE_DAMAGE = 4;
export const ZOMBIE_SPAWN_INTERVAL = 6;
export const ZOMBIE_MAX_COUNT = 6;
export const BUILDING_ZOMBIE_HP = 3;
let zombieSpawnTimer = 3;
let zombieBroadcastTimer = 0;
export const buildingDamage = new Map();

const ZOMBIE_BODY_GEO = new THREE.BoxGeometry(0.62, 0.62, 0.62);
const ZOMBIE_EYE_GEO = new THREE.BoxGeometry(0.1, 0.1, 0.04);
const ZOMBIE_BODY_BASE_COLOR = 0x4a7a3a;
const ZOMBIE_EYE_MAT = new THREE.MeshBasicMaterial({ color: 0xff3333 });
const ZOMBIE_BODY_MAT_CACHE = new Map();

export function createZombieMesh(x, z) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: ZOMBIE_BODY_BASE_COLOR });
  const body = new THREE.Mesh(ZOMBIE_BODY_GEO, bodyMat);
  body.position.y = 0.31; body.castShadow = true; g.add(body);
  const e1 = new THREE.Mesh(ZOMBIE_EYE_GEO, ZOMBIE_EYE_MAT);
  e1.position.set(-0.12, 0.4, -0.32); g.add(e1);
  const e2 = new THREE.Mesh(ZOMBIE_EYE_GEO, ZOMBIE_EYE_MAT);
  e2.position.set(0.12, 0.4, -0.32); g.add(e2);
  g.position.set(x, 0, z);
  g.userData.bodyMat = bodyMat;
  return g;
}
function flashZombie(z) {
  if (!z.mesh.userData.bodyMat) return;
  z.mesh.userData.bodyMat.color.setHex(0xff4444);
  if (z._flashTimer) clearTimeout(z._flashTimer);
  z._flashTimer = setTimeout(() => {
    if (z.mesh.userData.bodyMat) z.mesh.userData.bodyMat.color.setHex(ZOMBIE_BODY_BASE_COLOR);
  }, 150);
}
export function isDarkPlace(x, z, getTorchKeys, getLanternKeys, getCampfireKeys) {
  const check = (keys, r) => {
    for (const k of keys) {
      const [tx, tz] = k.split(',').map(Number);
      if ((tx - x) ** 2 + (tz - z) ** 2 < r * r) return true;
    }
    return false;
  };
  if (check(getTorchKeys(), 6)) return false;
  if (check(getCampfireKeys(), 7)) return false;
  if (check(getLanternKeys(), 7)) return false;
  if (crystalState.key) {
    const [cx, cz] = crystalState.key.split(',').map(Number);
    if ((cx - x) ** 2 + (cz - z) ** 2 < 49) return false;
  }
  return true;
}
export function spawnZombieNearPlayer(ctx) {
  const px = player.gridX, pz = player.gridZ;
  for (let attempt = 0; attempt < 30; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 6 + Math.random() * 8;
    const cx = Math.round(px + Math.cos(angle) * dist);
    const cz = Math.round(pz + Math.sin(angle) * dist);
    if (!BIOMES[getBiome(cx, cz)].walkable) continue;
    if (blockAt(cx, cz)) continue;
    if (!isDarkPlace(cx, cz, ctx.getTorches, ctx.getLanterns, ctx.getCampfires)) continue;
    const mesh = createZombieMesh(cx, cz);
    scene.add(mesh);
    zombies.push({ gridX: cx, gridZ: cz, fromX: cx, fromZ: cz, mesh,
      health: ZOMBIE_HEALTH, moveTimer: Math.random() * ZOMBIE_MOVE_INTERVAL,
      moving: false, t: 0, attackTimer: 0, targetRot: 0, _flashTimer: null });
    return true;
  }
  return false;
}
function findNearestPlayerTarget(zx, zz) {
  let best = { x: player.gridX, z: player.gridZ, isLocal: true,
    dist: (player.gridX - zx) ** 2 + (player.gridZ - zz) ** 2 };
  for (const [pid, rp] of remotePlayers) {
    const rx = Math.round(rp.targetX), rz = Math.round(rp.targetZ);
    const d = (rx - zx) ** 2 + (rz - zz) ** 2;
    if (d < best.dist) best = { x: rx, z: rz, isLocal: false, pid, dist: d };
  }
  return best;
}
export function isZombieWalkable(x, z) {
  if (!BIOMES[getBiome(x, z)].walkable) return false;
  const key = x + ',' + z;
  if (hasBuilding(key) && !isZombieAttackable(key)) return false;
  if (!collected.has(key)) {
    const prop = getProp(x, z, getBiome(x, z));
    if (prop) return false;
  }
  return true;
}
export function attackBuilding(z, key, ctx) {
  let hp = buildingDamage.get(key) || BUILDING_ZOMBIE_HP;
  hp--;
  if (hp <= 0) {
    buildingDamage.delete(key);
    const [x, zz] = key.split(',').map(Number);
    const destroyedType = ctx.destroyBuilding(key);
    if (destroyedType) {
      toast(t('zombieBrokeBuilding', { s: t(destroyedType) }));
      ctx.onBuildingDestroyed(x, zz, destroyedType);
    }
  } else {
    buildingDamage.set(key, hp);
  }
}
export function updateZombies(dt, ctx) {
  const { isNight, netMode, clientConns, broadcast } = ctx;
  if (isNight && netMode !== 'client') {
    zombieSpawnTimer -= dt;
    if (zombieSpawnTimer <= 0 && zombies.length < ZOMBIE_MAX_COUNT) {
      zombieSpawnTimer = ZOMBIE_SPAWN_INTERVAL;
      spawnZombieNearPlayer(ctx);
    }
  }
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    if (z.attackTimer > 0) z.attackTimer -= dt;
    if (z.moving) {
      z.t += dt / ZOMBIE_MOVE_ANIM;
      if (z.t >= 1) { z.t = 1; z.moving = false; }
      const x = z.fromX + (z.gridX - z.fromX) * z.t;
      const zz = z.fromZ + (z.gridZ - z.fromZ) * z.t;
      z.mesh.position.set(x, Math.sin(z.t * Math.PI) * 0.35, zz);
    } else {
      z.moveTimer += dt;
      z.mesh.position.y = 0;
      if (z.moveTimer >= ZOMBIE_MOVE_INTERVAL) {
        z.moveTimer = 0;
        const target = findNearestPlayerTarget(z.gridX, z.gridZ);
        const dx = target.x - z.gridX, dz = target.z - z.gridZ;
        const dist = Math.abs(dx) + Math.abs(dz);
        if (dx !== 0 || dz !== 0) z.targetRot = Math.atan2(-Math.sign(dx), -Math.sign(dz));
        if (dist <= 1) {
          if (target.isLocal && z.attackTimer <= 0) {
            damagePlayer(ZOMBIE_DAMAGE);
            z.attackTimer = ZOMBIE_ATTACK_COOLDOWN;
          } else if (!target.isLocal && netMode === 'host' && z.attackTimer <= 0) {
            const tc = clientConns.get(target.pid);
            if (tc && tc.conn.open) {
              try { tc.conn.send(JSON.stringify({ type: 'takeDamage', amount: ZOMBIE_DAMAGE })); } catch (e) {}
            }
            z.attackTimer = ZOMBIE_ATTACK_COOLDOWN;
          }
        } else {
          let mdx = 0, mdz = 0;
          if (Math.abs(dx) >= Math.abs(dz)) mdx = Math.sign(dx);
          else mdz = Math.sign(dz);
          let nx = z.gridX + mdx, nz = z.gridZ + mdz;
          let nk = nx + ',' + nz;
          if (isZombieAttackable(nk)) {
            if (z.attackTimer <= 0) { attackBuilding(z, nk, ctx); z.attackTimer = ZOMBIE_ATTACK_COOLDOWN; }
          } else if (isZombieWalkable(nx, nz)) {
            z.fromX = z.gridX; z.fromZ = z.gridZ;
            z.gridX = nx; z.gridZ = nz;
            z.moving = true; z.t = 0;
          } else {
            if (mdx !== 0) { mdx = 0; mdz = Math.sign(dz) || 1; }
            else { mdz = 0; mdx = Math.sign(dx) || 1; }
            nx = z.gridX + mdx; nz = z.gridZ + mdz;
            nk = nx + ',' + nz;
            if (isZombieAttackable(nk)) {
              if (z.attackTimer <= 0) { attackBuilding(z, nk, ctx); z.attackTimer = ZOMBIE_ATTACK_COOLDOWN; }
            } else if (isZombieWalkable(nx, nz)) {
              z.fromX = z.gridX; z.fromZ = z.gridZ;
              z.gridX = nx; z.gridZ = nz;
              z.moving = true; z.t = 0;
            }
          }
        }
      }
      const diff = normAngle(z.targetRot - z.mesh.rotation.y);
      z.mesh.rotation.y += diff * Math.min(1, dt * 8);
    }
  }
  if (netMode === 'host') {
    zombieBroadcastTimer -= dt;
    if (zombieBroadcastTimer <= 0) {
      zombieBroadcastTimer = 0.25;
      broadcast({ type: 'zombieUpdate', zombies: zombies.map(z => ({
        gx: z.gridX, gz: z.gridZ, fx: z.fromX, fz: z.fromZ,
        t: z.t, mv: z.moving, rot: z.targetRot,
      })) });
    }
  }
}
export function applyZombieUpdate(list) {
  const seen = new Set();
  for (const z of list) seen.add(z.gx + ',' + z.gz);
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    if (!seen.has(z.gridX + ',' + z.gridZ)) {
      scene.remove(z.mesh);
      if (z._flashTimer) clearTimeout(z._flashTimer);
      zombies.splice(i, 1);
    }
  }
  for (const z of list) {
    const k = z.gx + ',' + z.gz;
    let ez = zombies.find(zz => zz.gridX + ',' + zz.gridZ === k);
    if (!ez) {
      const mesh = createZombieMesh(z.gx, z.gz);
      scene.add(mesh);
      ez = { gridX: z.gx, gridZ: z.gz, fromX: z.fx, fromZ: z.fz, mesh,
        health: ZOMBIE_HEALTH, moveTimer: 0, moving: z.mv, t: z.t,
        attackTimer: 0, targetRot: z.rot, _flashTimer: null };
      zombies.push(ez);
    } else {
      ez.gridX = z.gx; ez.gridZ = z.gz; ez.fromX = z.fx; ez.fromZ = z.fz;
      ez.t = z.t; ez.moving = z.mv; ez.targetRot = z.rot;
    }
  }
}
export function damageZombie(z, amount) {
  z.health -= amount;
  flashZombie(z);
  if (z.health <= 0) {
    const idx = zombies.indexOf(z);
    if (idx >= 0) {
      scene.remove(z.mesh);
      if (z._flashTimer) clearTimeout(z._flashTimer);
      zombies.splice(idx, 1);
      toast(t('killedZombie'));
    }
  }
}

/* ============ 猪 ============ */
export const pigs = [];
export const PIG_HEALTH = 5;
const PIG_MOVE_ANIM = 0.55;
const PIG_WANDER_INTERVAL = 2.5;
const PIG_MAX_COUNT = 4;
const PIG_SPAWN_INTERVAL = 15;
let pigSpawnTimer = 8;
let pigBroadcastTimer = 0;

const PIG_BODY_GEO = new THREE.BoxGeometry(0.62, 0.42, 0.82);
const PIG_SNOUT_GEO = new THREE.BoxGeometry(0.2, 0.16, 0.14);
const PIG_EYE_GEO = new THREE.BoxGeometry(0.08, 0.08, 0.04);
const PIG_LEG_GEO = new THREE.BoxGeometry(0.12, 0.18, 0.12);
const PIG_EAR_GEO = new THREE.BoxGeometry(0.14, 0.12, 0.05);
const PIG_BODY_BASE_COLOR = 0xf5b5c0;
const PIG_SNOUT_COLOR = 0xe88a9a;
const PIG_EYE_MAT = new THREE.MeshBasicMaterial({ color: 0x2a1a1a });

export function createPigMesh(x, z) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: PIG_BODY_BASE_COLOR });
  const snoutMat = new THREE.MeshLambertMaterial({ color: PIG_SNOUT_COLOR });
  const body = new THREE.Mesh(PIG_BODY_GEO, bodyMat);
  body.position.y = 0.32; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const snout = new THREE.Mesh(PIG_SNOUT_GEO, snoutMat);
  snout.position.set(0, 0.28, -0.44); g.add(snout);
  const e1 = new THREE.Mesh(PIG_EYE_GEO, PIG_EYE_MAT);
  e1.position.set(-0.16, 0.42, -0.38); g.add(e1);
  const e2 = new THREE.Mesh(PIG_EYE_GEO, PIG_EYE_MAT);
  e2.position.set(0.16, 0.42, -0.38); g.add(e2);
  for (const [ox, oz] of [[-0.2, -0.28], [0.2, -0.28], [-0.2, 0.28], [0.2, 0.28]]) {
    const leg = new THREE.Mesh(PIG_LEG_GEO, bodyMat);
    leg.position.set(ox, 0.09, oz); g.add(leg);
  }
  const ear1 = new THREE.Mesh(PIG_EAR_GEO, snoutMat);
  ear1.position.set(-0.18, 0.5, -0.1); ear1.rotation.z = -0.3; g.add(ear1);
  const ear2 = new THREE.Mesh(PIG_EAR_GEO, snoutMat);
  ear2.position.set(0.18, 0.5, -0.1); ear2.rotation.z = 0.3; g.add(ear2);
  g.position.set(x, 0, z);
  g.userData.bodyMat = bodyMat;
  return g;
}
function flashPig(p) {
  if (!p.mesh.userData.bodyMat) return;
  p.mesh.userData.bodyMat.color.setHex(0xff5555);
  if (p._flashTimer) clearTimeout(p._flashTimer);
  p._flashTimer = setTimeout(() => {
    if (p.mesh.userData.bodyMat) p.mesh.userData.bodyMat.color.setHex(PIG_BODY_BASE_COLOR);
  }, 150);
}
export function spawnPigNearPlayer() {
  const px = player.gridX, pz = player.gridZ;
  for (let attempt = 0; attempt < 30; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 8 + Math.random() * 8;
    const cx = Math.round(px + Math.cos(angle) * dist);
    const cz = Math.round(pz + Math.sin(angle) * dist);
    if (!BIOMES[getBiome(cx, cz)].walkable) continue;
    if (blockAt(cx, cz)) continue;
    if (zombies.some(z => z.gridX === cx && z.gridZ === cz)) continue;
    const mesh = createPigMesh(cx, cz);
    scene.add(mesh);
    pigs.push({ gridX: cx, gridZ: cz, fromX: cx, fromZ: cz, mesh,
      health: PIG_HEALTH, moveTimer: Math.random() * PIG_WANDER_INTERVAL,
      moving: false, t: 0, targetRot: Math.random() * Math.PI * 2, _flashTimer: null });
    return true;
  }
  return false;
}
function isPigWalkable(x, z) {
  if (!BIOMES[getBiome(x, z)].walkable) return false;
  const key = x + ',' + z;
  if (hasBuilding(key)) return false;
  if (!collected.has(key)) {
    const prop = getProp(x, z, getBiome(x, z));
    if (prop) return false;
  }
  return true;
}
export function updatePigs(dt, netMode, broadcast) {
  if (netMode !== 'client') {
    pigSpawnTimer -= dt;
    if (pigSpawnTimer <= 0 && pigs.length < PIG_MAX_COUNT) {
      pigSpawnTimer = PIG_SPAWN_INTERVAL;
      spawnPigNearPlayer();
    }
  }
  const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
  for (let i = pigs.length - 1; i >= 0; i--) {
    const p = pigs[i];
    if (p.moving) {
      p.t += dt / PIG_MOVE_ANIM;
      if (p.t >= 1) { p.t = 1; p.moving = false; }
      const x = p.fromX + (p.gridX - p.fromX) * p.t;
      const z = p.fromZ + (p.gridZ - p.fromZ) * p.t;
      p.mesh.position.set(x, Math.sin(p.t * Math.PI) * 0.1, z);
    } else {
      p.moveTimer += dt;
      p.mesh.position.y = 0;
      if (p.moveTimer >= PIG_WANDER_INTERVAL) {
        p.moveTimer = 0;
        const shuffled = dirs.slice();
        for (let j = shuffled.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
        }
        for (const d of shuffled) {
          const nx = p.gridX + d[0], nz = p.gridZ + d[1];
          if (isPigWalkable(nx, nz)) {
            p.fromX = p.gridX; p.fromZ = p.gridZ;
            p.gridX = nx; p.gridZ = nz;
            p.moving = true; p.t = 0;
            p.targetRot = Math.atan2(-d[0], -d[1]);
            break;
          }
        }
      }
    }
    const diff = normAngle(p.targetRot - p.mesh.rotation.y);
    p.mesh.rotation.y += diff * Math.min(1, dt * 5);
  }
  if (netMode === 'host') {
    pigBroadcastTimer -= dt;
    if (pigBroadcastTimer <= 0) {
      pigBroadcastTimer = 0.3;
      broadcast({ type: 'pigUpdate', pigs: pigs.map(p => ({
        gx: p.gridX, gz: p.gridZ, fx: p.fromX, fz: p.fromZ,
        t: p.t, mv: p.moving, rot: p.targetRot,
      })) });
    }
  }
}
export function applyPigUpdate(list) {
  const seen = new Set();
  for (const p of list) seen.add(p.gx + ',' + p.gz);
  for (let i = pigs.length - 1; i >= 0; i--) {
    const p = pigs[i];
    if (!seen.has(p.gridX + ',' + p.gridZ)) {
      scene.remove(p.mesh);
      if (p._flashTimer) clearTimeout(p._flashTimer);
      pigs.splice(i, 1);
    }
  }
  for (const p of list) {
    const k = p.gx + ',' + p.gz;
    let ep = pigs.find(pp => pp.gridX + ',' + pp.gridZ === k);
    if (!ep) {
      const mesh = createPigMesh(p.gx, p.gz);
      scene.add(mesh);
      ep = { gridX: p.gx, gridZ: p.gz, fromX: p.fx, fromZ: p.fz, mesh,
        health: PIG_HEALTH, moveTimer: 0, moving: p.mv, t: p.t,
        targetRot: p.rot, _flashTimer: null };
      pigs.push(ep);
    } else {
      ep.gridX = p.gx; ep.gridZ = p.gz; ep.fromX = p.fx; ep.fromZ = p.fz;
      ep.t = p.t; ep.moving = p.mv; ep.targetRot = p.rot;
    }
  }
}
export function damagePig(p, amount, addItemFn, updateAllUIFn) {
  p.health -= amount;
  flashPig(p);
  if (p.health <= 0) {
    const idx = pigs.indexOf(p);
    if (idx >= 0) {
      scene.remove(p.mesh);
      if (p._flashTimer) clearTimeout(p._flashTimer);
      pigs.splice(idx, 1);
      const amt = 1 + Math.floor(Math.random() * 2);
      addItemFn('raw_pork', amt);
      updateAllUIFn();
      toast(t('gotPork', { n: amt }));
      toast(t('killedPig'));
    }
  }
}

/* ============ 玩家受伤 ============ */
export function damagePlayer(amount) {
  if (healthState.gameOver) return;
  healthState.health = Math.max(0, healthState.health - amount);
  hooks.updateStatsUI && hooks.updateStatsUI();
  const flash = document.getElementById('damageFlash');
  if (flash) {
    flash.classList.add('on');
    setTimeout(() => flash.classList.remove('on'), 200);
  }
  if (healthState.health <= 0) {
    healthState.gameOver = true;
    const go = document.getElementById('gameover');
    if (go) go.classList.add('show');
  }
}

/* ============ 生存数值 ============ */
let starveTimer = 0, healthRegenTimer = 0, hungerTimer = 0;
const REGEN_INTERVAL = 0.5;
const HUNGER_FULL_THRESHOLD = 99.5;

export function updateSurvival(dt) {
  if (healthState.gameOver) return;
  if (healthState.hunger >= HUNGER_FULL_THRESHOLD && healthState.health < 100) {
    healthRegenTimer += dt;
    while (healthRegenTimer >= REGEN_INTERVAL && healthState.health < 100) {
      healthRegenTimer -= REGEN_INTERVAL;
      healthState.health = Math.min(100, healthState.health + 1);
      hooks.updateStatsUI && hooks.updateStatsUI();
    }
  } else healthRegenTimer = 0;

  const drain = player.moving ? 0.12 : 0.08;
  healthState.hunger = Math.max(0, healthState.hunger - dt * drain);

  if (healthState.hunger <= 0) {
    starveTimer += dt;
    if (starveTimer >= 0.5) {
      starveTimer = 0;
      healthState.health = Math.max(0, healthState.health - 1);
      hooks.updateStatsUI && hooks.updateStatsUI();
      if (healthState.health <= 0) {
        healthState.gameOver = true;
        const go = document.getElementById('gameover');
        if (go) go.classList.add('show');
      }
    }
  } else starveTimer = 0;

  hungerTimer += dt;
  if (hungerTimer > 0.25) { hungerTimer = 0; hooks.updateStatsUI && hooks.updateStatsUI(); }
}

/* ============ 清理 ============ */
export function clearAllActors() {
  for (let i = zombies.length - 1; i >= 0; i--) {
    if (zombies[i]._flashTimer) clearTimeout(zombies[i]._flashTimer);
    scene.remove(zombies[i].mesh);
  }
  zombies.length = 0;
  for (let i = pigs.length - 1; i >= 0; i--) {
    if (pigs[i]._flashTimer) clearTimeout(pigs[i]._flashTimer);
    scene.remove(pigs[i].mesh);
  }
  pigs.length = 0;
  for (const [pid] of remotePlayers) removeRemotePlayer(pid);
  buildingDamage.clear();
}