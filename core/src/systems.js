import { t, toast, hooks, SAVE_KEY, SAVE_VERSION, SAVE_VERSION_MIN, setWorldSeed } from './core.js';
import { HOTBAR_SIZE, INV_SIZE, CHEST_SIZE } from './core.js';
import { scene } from './render.js';
import { player, playerMesh, remotePlayers, addRemotePlayer, removeRemotePlayer,
  zombies, pigs, healthState, createZombieMesh, createPigMesh,
  applyZombieUpdate, applyPigUpdate, ZOMBIE_HEALTH, PIG_HEALTH,
  damageZombie, damagePig, damagePlayer, clearAllActors, ZOMBIE_DAMAGE } from './actors.js';
import { furnaces, smokers, chests, campfires, fenceGates, crystalState,
  createFurnaceMesh, createSmokerMesh, createCampfireMesh, createFenceGateMesh, createCrystalMesh,
  addBridge, addFence, addStoneWall, addChest, addTorch, addLantern,
  removeBridge, removeFence, removeStoneWall, removeChest, removeTorch, removeLantern,
  hasBridge, hasFence, hasStoneWall, hasLantern, updateLightAssignment,
  clearAllBuildings, blockAt, buildingOccupiedAt, hasPropAt } from './buildings.js';
import { hotbar, inventory, droppedItems, createDropLocal, createDropMesh,
  addItem, removeItem, renderCraft, getSelectedItem, setOpenChestKey, setOpenFurnaceKey,
  PLACEABLE } from './items.js';
import { collected, resetWorldMaps, resetChunks, updateChunksIfNeeded,
  rebuildChunkProps, clearCrack, propDamage, getBiome, isWater } from './world.js';
import { CHUNK } from './core.js';
import { timeState, weather } from './render.js';

export const netState = {
  mode: 'single', peer: null, hostConn: null,
  clientConns: new Map(), roomCode: null,
  myId: 'p' + Math.random().toString(36).slice(2, 8),
  posSyncTimer: 0,
};

const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const playerListDisplay = document.getElementById('playerListDisplay');
const multiplayerBar = document.getElementById('multiplayerBar');
const loadingTag = document.getElementById('loadingTag');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');

function showLoading(text) { if (loadingTag) { loadingTag.textContent = text; loadingTag.classList.add('on'); } }
function hideLoading() { if (loadingTag) loadingTag.classList.remove('on'); }

export function updateSaveLoadButtons() {
  if (!saveBtn || !loadBtn) return;
  const alone = netState.mode === 'single' || (netState.mode === 'host' && netState.clientConns.size === 0);
  saveBtn.disabled = !alone;
  loadBtn.disabled = !alone;
}
export function updatePlayerListDisplay() {
  if (!playerListDisplay) return;
  const n = netState.mode === 'host' ? (1 + netState.clientConns.size) : (1 + remotePlayers.size);
  const zh = document.documentElement.lang === 'zh-CN';
  playerListDisplay.textContent = (zh ? '玩家: ' : 'Players: ') + n;
}
export function broadcast(msg, excludePeerId) {
  const str = JSON.stringify(msg);
  for (const [pid, { conn }] of netState.clientConns) {
    if (pid === excludePeerId) continue;
    if (conn.open) { try { conn.send(str); } catch (e) {} }
  }
}
export function sendToHost(msg) {
  if (netState.hostConn && netState.hostConn.open) {
    try { netState.hostConn.send(JSON.stringify(msg)); } catch (e) {}
  }
}
export function netSyncSelfPos() {
  if (netState.mode === 'single') return;
  const msg = { type: 'playerMoved',
    playerId: netState.mode === 'host' ? 'host' : netState.myId,
    x: player.gridX, z: player.gridZ, rot: player.targetRot };
  if (netState.mode === 'host') broadcast(msg);
  else sendToHost({ type: 'intent', action: 'move', x: msg.x, z: msg.z, rot: msg.rot });
}
export function getNetCtx() {
  return {
    netMode: netState.mode,
    clientConns: netState.clientConns,
    broadcast,
    sendToHost,
  };
}

/* ============ 房主 ============ */
export function startHost() {
  netState.mode = 'host';
  showLoading(t('connecting'));
  netState.roomCode = String(Math.floor(100000 + Math.random() * 900000));
  try {
    netState.peer = new window.Peer('isocore-' + netState.roomCode, { debug: 0 });
  } catch (e) {
    hideLoading(); toast(t('mpNotAvail')); netState.mode = 'single'; return;
  }
  netState.peer.on('open', () => {
    hideLoading();
    if (roomCodeDisplay) roomCodeDisplay.textContent = netState.roomCode;
    multiplayerBar.classList.add('on');
    updatePlayerListDisplay();
    updateSaveLoadButtons();
    toast(t('hostReady'));
  });
  netState.peer.on('connection', (conn) => {
    conn.on('open', () => {
      netState.clientConns.set(conn.peer, {
        conn, name: 'Player',
        color: '#' + ['e8465a','ffbb44','b388ff','ff8a5b','7dd8f0'][netState.clientConns.size % 5],
      });
      sendFullState(conn);
      broadcast({ type: 'playerJoined', playerId: conn.peer,
        color: netState.clientConns.get(conn.peer).color });
      updatePlayerListDisplay();
      updateSaveLoadButtons();
      toast(t('playerJoined'));
    });
    conn.on('data', (raw) => {
      let msg;
      try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
      handleClientMessage(conn, msg);
    });
    conn.on('close', () => {
      netState.clientConns.delete(conn.peer);
      broadcast({ type: 'playerLeft', playerId: conn.peer });
      removeRemotePlayer(conn.peer);
      updatePlayerListDisplay();
      updateSaveLoadButtons();
      toast(t('playerLeft'));
    });
  });
  netState.peer.on('error', (err) => { console.error(err); hideLoading(); toast(t('connFail')); });
}

export function joinRoom(code) {
  netState.mode = 'client';
  showLoading(t('connecting'));
  netState.peer = new window.Peer(undefined, { debug: 0 });
  netState.peer.on('open', () => {
    netState.hostConn = netState.peer.connect('isocore-' + code, { reliable: true });
    netState.hostConn.on('open', () => {
      hideLoading();
      multiplayerBar.classList.add('on');
      if (roomCodeDisplay) roomCodeDisplay.textContent = code;
      updatePlayerListDisplay();
      updateSaveLoadButtons();
      toast(t('connected'));
    });
    netState.hostConn.on('data', (raw) => {
      let msg;
      try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
      handleHostMessage(msg);
    });
    netState.hostConn.on('close', () => {
      toast(t('hostLeft'));
      netState.mode = 'single';
      multiplayerBar.classList.remove('on');
      for (const [pid] of remotePlayers) removeRemotePlayer(pid);
      clearAllActors();
      updateSaveLoadButtons();
    });
    netState.hostConn.on('error', () => {
      hideLoading(); toast(t('connFail')); netState.mode = 'single'; updateSaveLoadButtons();
    });
  });
  netState.peer.on('error', (err) => {
    console.error(err); hideLoading(); toast(t('connFail')); netState.mode = 'single'; updateSaveLoadButtons();
  });
}

export function sendFullState(conn) {
  const state = {
    worldSeed: window.__WORLD_SEED,
    collected: Array.from(collected),
    furnaces: Array.from(furnaces.entries()).map(([k, f]) => ({
      key: k, inputType: f.data.inputType, input: f.data.input,
      fuel: f.data.fuel, outputType: f.data.outputType, output: f.data.output, progress: f.data.progress,
    })),
    smokers: Array.from(smokers.entries()).map(([k, f]) => ({
      key: k, inputType: f.data.inputType, input: f.data.input,
      fuel: f.data.fuel, outputType: f.data.outputType, output: f.data.output, progress: f.data.progress,
    })),
    bridges: Array.from(batchKeys('bridge')),
    fences: Array.from(batchKeys('fence')),
    stoneWalls: Array.from(batchKeys('stone_wall')),
    lanterns: Array.from(lanternEntries()),
    campfires: Array.from(campfires.keys()),
    fenceGates: Array.from(fenceGates.entries()).map(([k, g]) => ({ key: k, open: g.open, facing: g.outer.rotation.y })),
    chests: Array.from(chests.entries()).map(([k, c]) => ({
      key: k, slots: c.slots.map(s => s ? { type: s.type, count: s.count } : null),
    })),
    crystalKey: crystalState.key, timeOfDay: timeState.timeOfDay,
    players: [{ playerId: 'host', x: player.gridX, z: player.gridZ, rot: player.targetRot },
      ...Array.from(netState.clientConns.entries()).map(([pid]) => ({
        playerId: pid,
        x: remotePlayers.get(pid)?.targetX || 0,
        z: remotePlayers.get(pid)?.targetZ || 0,
        rot: remotePlayers.get(pid)?.targetRot || 0,
      }))],
    pigs: pigs.map(p => ({ gx: p.gridX, gz: p.gridZ, fx: p.fromX, fz: p.fromZ, t: p.t, mv: p.moving, rot: p.targetRot })),
  };
  try { conn.send(JSON.stringify({ type: 'fullState', state })); } catch (e) {}
}
function batchKeys(name) {
  // 从 batches 里导出所有 key
  const batchesMod = window.__BATCHES;
  if (!batchesMod) return [];
  const b = batchesMod[name];
  return b ? b.map.keys() : [];
}
function lanternEntries() {
  const out = [];
  const batchesMod = window.__BATCHES;
  if (!batchesMod) return out;
  for (const k of batchesMod.lanternGround.map.keys()) out.push({ key: k, onWall: false });
  for (const k of batchesMod.lanternWall.map.keys()) out.push({ key: k, onWall: true });
  return out;
}

export function handleClientMessage(conn, msg) {
  const pid = conn.peer;
  if (msg.type !== 'intent') return;
  if (msg.action === 'move') {
    let rp = remotePlayers.get(pid);
    if (!rp) {
      addRemotePlayer(pid, 'Player', netState.clientConns.get(pid)?.color || '#ffffff');
      rp = remotePlayers.get(pid);
    }
    if (rp) { rp.targetX = msg.x; rp.targetZ = msg.z; rp.targetRot = msg.rot; }
    broadcast({ type: 'playerMoved', playerId: pid, x: msg.x, z: msg.z, rot: msg.rot }, pid);
  } else if (msg.action === 'mine') {
    const key = msg.x + ',' + msg.z;
    if (collected.has(key)) return;
    const prop = (await import('./world.js')).getProp(msg.x, msg.z, getBiome(msg.x, msg.z));
    if (!prop) return;
    collected.add(key);
    clearCrack(key); propDamage.delete(key);
    rebuildChunkProps(scene, Math.floor(msg.x / CHUNK), Math.floor(msg.z / CHUNK));
    const itemType = window.__propToItem(prop);
    const amt = window.__itemAmountFor(prop, msg.toolTier || 0);
    broadcast({ type: 'blockCollected', x: msg.x, z: msg.z, itemType, amt, forPlayer: pid });
  } else if (msg.action === 'place') {
    tryPlaceRemote(msg.x, msg.z, msg.buildingType, msg.extra);
  } else if (msg.action === 'remove') {
    mineBuildingAtRemote(msg.x + ',' + msg.z, msg.buildingType);
  } else if (msg.action === 'gate') {
    const g = fenceGates.get(msg.x + ',' + msg.z);
    if (g) {
      g.open = !g.open;
      g.targetAngle = g.open ? Math.PI / 2 : 0;
      broadcast({ type: 'gateToggled', x: msg.x, z: msg.z, open: g.open });
    }
  } else if (msg.action === 'drop') {
    broadcast({ type: 'itemDropped', x: msg.x, z: msg.z, itemType: msg.itemType, count: msg.count });
    createDropLocal(msg.x, msg.z, msg.itemType, msg.count);
  } else if (msg.action === 'pickup') {
    const key = msg.x + ',' + msg.z;
    const drop = droppedItems.get(key);
    if (drop) { broadcast({ type: 'itemPickedUp', x: msg.x, z: msg.z }); scene.remove(drop.mesh); droppedItems.delete(key); }
  } else if (msg.action === 'attackPlayer') {
    const tc = netState.clientConns.get(msg.targetId);
    if (tc && tc.conn.open) { try { tc.conn.send(JSON.stringify({ type: 'takeDamage', amount: msg.dmg })); } catch (e) {} }
  } else if (msg.action === 'attackZombie') {
    const k = msg.x + ',' + msg.z;
    const z = zombies.find(zz => zz.gridX + ',' + zz.gridZ === k);
    if (z) { damageZombie(z, msg.dmg); broadcastZombies(); }
  } else if (msg.action === 'attackPig') {
    const k = msg.x + ',' + msg.z;
    const p = pigs.find(pp => pp.gridX + ',' + pp.gridZ === k);
    if (p) { damagePig(p, msg.dmg, addItem, hooks.updateAllUI); broadcastPigs(); }
  }
}
function broadcastZombies() {
  broadcast({ type: 'zombieUpdate', zombies: zombies.map(zz => ({
    gx: zz.gridX, gz: zz.gridZ, fx: zz.fromX, fz: zz.fromZ,
    t: zz.t, mv: zz.moving, rot: zz.targetRot,
  })) });
}
function broadcastPigs() {
  broadcast({ type: 'pigUpdate', pigs: pigs.map(pp => ({
    gx: pp.gridX, gz: pp.gridZ, fx: pp.fromX, fz: pp.fromZ,
    t: pp.t, mv: pp.moving, rot: pp.targetRot,
  })) });
}

export function handleHostMessage(msg) {
  switch (msg.type) {
    case 'fullState': applyFullState(msg.state); break;
    case 'playerJoined':
      addRemotePlayer(msg.playerId, 'Player', msg.color);
      updatePlayerListDisplay(); toast(t('playerJoined')); break;
    case 'playerLeft':
      removeRemotePlayer(msg.playerId);
      updatePlayerListDisplay(); toast(t('playerLeft')); break;
    case 'playerMoved': {
      if (msg.playerId === netState.myId) return;
      let rp = remotePlayers.get(msg.playerId);
      if (!rp) { addRemotePlayer(msg.playerId, 'Player', '#ffffff'); rp = remotePlayers.get(msg.playerId); }
      if (rp) { rp.targetX = msg.x; rp.targetZ = msg.z; rp.targetRot = msg.rot; }
      break;
    }
    case 'blockCollected': {
      const key = msg.x + ',' + msg.z;
      if (collected.has(key)) return;
      collected.add(key); clearCrack(key); propDamage.delete(key);
      rebuildChunkProps(scene, Math.floor(msg.x / CHUNK), Math.floor(msg.z / CHUNK));
      if (msg.forPlayer === netState.myId && msg.itemType) { addItem(msg.itemType, msg.amt || 1); hooks.updateAllUI && hooks.updateAllUI(); }
      break;
    }
    case 'buildingPlaced': applyBuildingPlaced(msg); break;
    case 'buildingRemoved': applyBuildingRemoved(msg.x, msg.z, msg.buildingType); break;
    case 'gateToggled': {
      const g = fenceGates.get(msg.x + ',' + msg.z);
      if (g) { g.open = msg.open; g.targetAngle = g.open ? Math.PI / 2 : 0; }
      break;
    }
    case 'itemDropped': createDropLocal(msg.x, msg.z, msg.itemType, msg.count); break;
    case 'itemPickedUp': {
      const key = msg.x + ',' + msg.z;
      const drop = droppedItems.get(key);
      if (drop) { scene.remove(drop.mesh); droppedItems.delete(key); }
      break;
    }
    case 'zombieUpdate': applyZombieUpdate(msg.zombies); break;
    case 'pigUpdate': applyPigUpdate(msg.pigs); break;
    case 'takeDamage': damagePlayer(msg.amount); break;
  }
}

function applyFullState(state) {
  clearAllBuildings(); clearAllActors();
  resetChunks(scene); resetWorldMaps();
  setWorldSeed(state.worldSeed);
  window.__WORLD_SEED = state.worldSeed;
  if (Array.isArray(state.collected)) state.collected.forEach(k => collected.add(k));
  updateChunksIfNeeded(scene, player);
  if (Array.isArray(state.furnaces)) for (const f of state.furnaces) {
    const [x, z] = f.key.split(',').map(Number);
    const mesh = createFurnaceMesh(x, z);
    mesh.data.inputType = f.inputType; mesh.data.input = f.input;
    mesh.data.fuel = f.fuel; mesh.data.outputType = f.outputType;
    mesh.data.output = f.output; mesh.data.progress = f.progress;
    furnaces.set(f.key, mesh);
  }
  if (Array.isArray(state.smokers)) for (const f of state.smokers) {
    const [x, z] = f.key.split(',').map(Number);
    const mesh = createSmokerMesh(x, z);
    mesh.data.inputType = f.inputType; mesh.data.input = f.input;
    mesh.data.fuel = f.fuel; mesh.data.outputType = f.outputType;
    mesh.data.output = f.output; mesh.data.progress = f.progress;
    smokers.set(f.key, mesh);
  }
  if (Array.isArray(state.bridges)) for (const key of state.bridges) {
    const [x, z] = key.split(',').map(Number); addBridge(key, x, z);
  }
  if (Array.isArray(state.fences)) for (const key of state.fences) {
    const [x, z] = key.split(',').map(Number); addFence(key, x, z);
  }
  if (Array.isArray(state.stoneWalls)) for (const key of state.stoneWalls) {
    const [x, z] = key.split(',').map(Number); addStoneWall(key, x, z);
  }
  if (Array.isArray(state.lanterns)) for (const l of state.lanterns) {
    const [x, z] = l.key.split(',').map(Number);
    addLantern(l.key, x, z, !!l.onWall);
  }
  if (Array.isArray(state.campfires)) for (const key of state.campfires) {
    const [x, z] = key.split(',').map(Number);
    const mesh = createCampfireMesh(x, z); campfires.set(key, mesh);
  }
  if (Array.isArray(state.fenceGates)) for (const g of state.fenceGates) {
    const [x, z] = g.key.split(',').map(Number);
    const mesh = createFenceGateMesh(x, z, g.facing || 0);
    mesh.open = !!g.open;
    mesh.currentAngle = mesh.open ? Math.PI / 2 : 0;
    mesh.targetAngle = mesh.currentAngle;
    mesh.hinge.rotation.y = mesh.currentAngle;
    fenceGates.set(g.key, mesh);
  }
  if (Array.isArray(state.chests)) for (const c of state.chests) {
    const [x, z] = c.key.split(',').map(Number);
    addChest(c.key, x, z);
    const slots = new Array(CHEST_SIZE).fill(null);
    if (Array.isArray(c.slots)) c.slots.forEach((s, i) => { if (s) slots[i] = { type: s.type, count: s.count }; });
    chests.set(c.key, { mesh: null, slots });
  }
  if (state.crystalKey) {
    const [x, z] = state.crystalKey.split(',').map(Number);
    const mesh = createCrystalMesh(x, z);
    crystalState.key = state.crystalKey; crystalState.mesh = mesh;
  }
  if (Array.isArray(state.players)) for (const p of state.players) {
    if (p.playerId === netState.myId) continue;
    addRemotePlayer(p.playerId, 'Player', p.color);
    const rp = remotePlayers.get(p.playerId);
    if (rp) { rp.targetX = p.x; rp.targetZ = p.z; rp.targetRot = p.rot;
      rp.currX = p.x; rp.currZ = p.z; rp.currRot = p.rot; }
  }
  if (Array.isArray(state.pigs)) applyPigUpdate(state.pigs);
  if (typeof state.timeOfDay === 'number') timeState.timeOfDay = state.timeOfDay;
  hooks.updateAllUI && hooks.updateAllUI();
  updateLightAssignment(player.gridX, player.gridZ);
}

export function tryPlaceRemote(x, z, type, extra) {
  const key = x + ',' + z;
  const water = isWater(x, z);
  const onBridge = hasBridge(key);
  if (type === 'lantern') {
    if (hasLantern(key)) return false;
    const onWall = hasStoneWall(key);
    if (onWall) {
      addLantern(key, x, z, true);
      broadcast({ type: 'buildingPlaced', buildingType: 'lantern', x, z, onWall: true });
      updateLightAssignment(player.gridX, player.gridZ);
      return true;
    }
    if (buildingOccupiedAt(key) || hasPropAt(x, z) || (water && !onBridge)) return false;
    addLantern(key, x, z, false);
    broadcast({ type: 'buildingPlaced', buildingType: 'lantern', x, z, onWall: false });
    updateLightAssignment(player.gridX, player.gridZ);
    return true;
  }
  if (buildingOccupiedAt(key) || hasPropAt(x, z)) return false;
  if (type === 'bridge') {
    if (!water || onBridge) return false;
    addBridge(key, x, z);
    broadcast({ type: 'buildingPlaced', buildingType: 'bridge', x, z });
  } else if (type === 'furnace') {
    if (water && !onBridge) return false;
    const f = createFurnaceMesh(x, z); furnaces.set(key, f);
    broadcast({ type: 'buildingPlaced', buildingType: 'furnace', x, z });
  } else if (type === 'smoker') {
    if (water && !onBridge) return false;
    const f = createSmokerMesh(x, z); smokers.set(key, f);
    broadcast({ type: 'buildingPlaced', buildingType: 'smoker', x, z });
  } else if (type === 'torch') {
    if (water && !onBridge) return false;
    addTorch(key, x, z);
    broadcast({ type: 'buildingPlaced', buildingType: 'torch', x, z });
    updateLightAssignment(player.gridX, player.gridZ);
  } else if (type === 'fence') {
    if (water && !onBridge) return false;
    addFence(key, x, z);
    broadcast({ type: 'buildingPlaced', buildingType: 'fence', x, z });
  } else if (type === 'stone_wall') {
    if (water && !onBridge) return false;
    addStoneWall(key, x, z);
    broadcast({ type: 'buildingPlaced', buildingType: 'stone_wall', x, z });
  } else if (type === 'fence_gate') {
    if (water && !onBridge) return false;
    const g = createFenceGateMesh(x, z, extra?.facing || 0);
    fenceGates.set(key, g);
    broadcast({ type: 'buildingPlaced', buildingType: 'fence_gate', x, z, facing: extra?.facing || 0 });
  } else if (type === 'chest') {
    if (water && !onBridge) return false;
    addChest(key, x, z);
    chests.set(key, { mesh: null, slots: new Array(CHEST_SIZE).fill(null) });
    broadcast({ type: 'buildingPlaced', buildingType: 'chest', x, z });
  } else if (type === 'campfire') {
    if (water && !onBridge) return false;
    const c = createCampfireMesh(x, z); campfires.set(key, c);
    broadcast({ type: 'buildingPlaced', buildingType: 'campfire', x, z });
    updateLightAssignment(player.gridX, player.gridZ);
  } else if (type === 'crystal') {
    if (crystalState.key || (water && !onBridge)) return false;
    const c = createCrystalMesh(x, z);
    crystalState.key = key; crystalState.mesh = c;
    broadcast({ type: 'buildingPlaced', buildingType: 'crystal', x, z });
    document.getElementById('win').classList.add('show');
    updateLightAssignment(player.gridX, player.gridZ);
  }
  return true;
}
export function applyBuildingPlaced(msg) {
  const key = msg.x + ',' + msg.z;
  if (msg.buildingType === 'bridge') { if (hasBridge(key)) return; addBridge(key, msg.x, msg.z); }
  else if (msg.buildingType === 'furnace') { if (furnaces.has(key)) return; furnaces.set(key, createFurnaceMesh(msg.x, msg.z)); }
  else if (msg.buildingType === 'smoker') { if (smokers.has(key)) return; smokers.set(key, createSmokerMesh(msg.x, msg.z)); }
  else if (msg.buildingType === 'torch') { if (hasLantern(key)) return; addTorch(key, msg.x, msg.z); updateLightAssignment(player.gridX, player.gridZ); }
  else if (msg.buildingType === 'fence') { if (hasFence(key)) return; addFence(key, msg.x, msg.z); }
  else if (msg.buildingType === 'stone_wall') { if (hasStoneWall(key)) return; addStoneWall(key, msg.x, msg.z); }
  else if (msg.buildingType === 'lantern') { if (hasLantern(key)) return; addLantern(key, msg.x, msg.z, !!msg.onWall); updateLightAssignment(player.gridX, player.gridZ); }
  else if (msg.buildingType === 'fence_gate') { if (fenceGates.has(key)) return; fenceGates.set(key, createFenceGateMesh(msg.x, msg.z, msg.facing || 0)); }
  else if (msg.buildingType === 'chest') { if (chests.has(key)) return; addChest(key, msg.x, msg.z); chests.set(key, { mesh: null, slots: new Array(CHEST_SIZE).fill(null) }); }
  else if (msg.buildingType === 'campfire') { if (campfires.has(key)) return; campfires.set(key, createCampfireMesh(msg.x, msg.z)); updateLightAssignment(player.gridX, player.gridZ); }
  else if (msg.buildingType === 'crystal') { if (crystalState.key) return; crystalState.mesh = createCrystalMesh(msg.x, msg.z); crystalState.key = key; updateLightAssignment(player.gridX, player.gridZ); }
  hooks.updateAllUI && hooks.updateAllUI();
}
export function mineBuildingAtRemote(key, type) {
  const [x, z] = key.split(',').map(Number);
  if (type === 'furnace') { const f = furnaces.get(key); if (!f) return false; scene.remove(f.group); furnaces.delete(key); }
  else if (type === 'smoker') { const f = smokers.get(key); if (!f) return false; scene.remove(f.group); smokers.delete(key); }
  else if (type === 'torch') { removeTorch(key); updateLightAssignment(player.gridX, player.gridZ); }
  else if (type === 'bridge') { removeBridge(key); }
  else if (type === 'fence') { removeFence(key); }
  else if (type === 'stone_wall') { removeStoneWall(key); if (hasLantern(key)) { removeLantern(key); } }
  else if (type === 'lantern') { removeLantern(key); updateLightAssignment(player.gridX, player.gridZ); }
  else if (type === 'fence_gate') { const g = fenceGates.get(key); if (g) { scene.remove(g.outer); fenceGates.delete(key); } }
  else if (type === 'chest') { const c = chests.get(key); if (!c) return false; removeChest(key); chests.delete(key); }
  else if (type === 'campfire') { const c = campfires.get(key); if (!c) return false; scene.remove(c); campfires.delete(key); updateLightAssignment(player.gridX, player.gridZ); }
  else if (type === 'crystal') {
    if (key !== crystalState.key) return false;
    if (crystalState.mesh) scene.remove(crystalState.mesh);
    crystalState.mesh = null; crystalState.key = null;
    document.getElementById('win').classList.remove('show');
    updateLightAssignment(player.gridX, player.gridZ);
  }
  broadcast({ type: 'buildingRemoved', x, z, buildingType: type });
  return true;
}
export function applyBuildingRemoved(x, z, type) {
  const key = x + ',' + z;
  if (type === 'furnace') { const f = furnaces.get(key); if (f) { scene.remove(f.group); furnaces.delete(key); } }
  else if (type === 'smoker') { const f = smokers.get(key); if (f) { scene.remove(f.group); smokers.delete(key); } }
  else if (type === 'torch') { removeTorch(key); updateLightAssignment(player.gridX, player.gridZ); }
  else if (type === 'bridge') removeBridge(key);
  else if (type === 'fence') removeFence(key);
  else if (type === 'stone_wall') { removeStoneWall(key); if (hasLantern(key)) removeLantern(key); }
  else if (type === 'lantern') { removeLantern(key); updateLightAssignment(player.gridX, player.gridZ); }
  else if (type === 'fence_gate') { const g = fenceGates.get(key); if (g) { scene.remove(g.outer); fenceGates.delete(key); } }
  else if (type === 'chest') { const c = chests.get(key); if (c) { removeChest(key); chests.delete(key); } }
  else if (type === 'campfire') { const c = campfires.get(key); if (c) { scene.remove(c); campfires.delete(key); updateLightAssignment(player.gridX, player.gridZ); } }
  else if (type === 'crystal') {
    if (key === crystalState.key) {
      if (crystalState.mesh) scene.remove(crystalState.mesh);
      crystalState.mesh = null; crystalState.key = null;
      document.getElementById('win').classList.remove('show');
      updateLightAssignment(player.gridX, player.gridZ);
    }
  }
  hooks.updateAllUI && hooks.updateAllUI();
}

/* ============ 存档 ============ */
export function canSaveNow() {
  return netState.mode === 'single' || (netState.mode === 'host' && netState.clientConns.size === 0);
}
function serializeInventory(arr) { return arr.map(s => s ? { type: s.type, count: s.count } : null); }
function deserializeInventory(arr, size) {
  const out = new Array(size).fill(null);
  if (!arr) return out;
  for (let i = 0; i < size; i++) { const s = arr[i]; if (s && s.type && s.count > 0) out[i] = { type: s.type, count: s.count }; }
  return out;
}
export function saveGame() {
  if (!canSaveNow()) { toast(t('cantSaveInMP')); return; }
  try {
    const batchesMod = window.__BATCHES;
    const save = {
      version: SAVE_VERSION, worldSeed: window.__WORLD_SEED,
      player: { gridX: player.gridX, gridZ: player.gridZ, targetRot: player.targetRot },
      health: healthState.health, hunger: healthState.hunger,
      hotbar: serializeInventory(hotbar), inventory: serializeInventory(inventory),
      collected: Array.from(collected), propDamage: Array.from(propDamage.entries()),
      furnaces: Array.from(furnaces.entries()).map(([k, f]) => ({ key: k,
        inputType: f.data.inputType, input: f.data.input, fuel: f.data.fuel,
        outputType: f.data.outputType, output: f.data.output, progress: f.data.progress })),
      smokers: Array.from(smokers.entries()).map(([k, f]) => ({ key: k,
        inputType: f.data.inputType, input: f.data.input, fuel: f.data.fuel,
        outputType: f.data.outputType, output: f.data.output, progress: f.data.progress })),
      bridges: batchesMod ? Array.from(batchesMod.bridge.map.keys()) : [],
      fences: batchesMod ? Array.from(batchesMod.fence.map.keys()) : [],
      stoneWalls: batchesMod ? Array.from(batchesMod.stone_wall.map.keys()) : [],
      lanterns: batchesMod ? [
        ...Array.from(batchesMod.lanternGround.map.keys()).map(k => ({ key: k, onWall: false })),
        ...Array.from(batchesMod.lanternWall.map.keys()).map(k => ({ key: k, onWall: true })),
      ] : [],
      campfires: Array.from(campfires.keys()),
      fenceGates: Array.from(fenceGates.entries()).map(([k, g]) => ({ key: k, open: g.open, facing: g.outer.rotation.y })),
      chests: Array.from(chests.entries()).map(([k, c]) => ({ key: k, slots: serializeInventory(c.slots) })),
      crystalKey: crystalState.key,
      droppedItems: Array.from(droppedItems.entries()).map(([k, d]) => ({ key: k, type: d.type, count: d.count, age: performance.now() - d.bornAt })),
      timeOfDay: timeState.timeOfDay,
      weather: { type: weather.type, intensity: weather.intensity, timer: weather.timer, nextChange: weather.nextChange },
      cameraRotation: window.__getCameraRotation ? window.__getCameraRotation() : 0,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    toast(t('saved'));
  } catch (err) { console.error(err); toast(t('saveError')); }
}
export function loadGame() {
  if (!canSaveNow()) { toast(t('cantLoadInMP')); return; }
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) { toast(t('noSave')); return; }
  let save;
  try { save = JSON.parse(raw); } catch (err) { toast(t('loadError')); return; }
  if (!save || typeof save.version !== 'number' || save.version < SAVE_VERSION_MIN || save.version > SAVE_VERSION) {
    toast(t('incompatible')); return;
  }
  try {
    hooks.closeFurnace && hooks.closeFurnace();
    hooks.closeChest && hooks.closeChest();
    hooks.cancelDrag && hooks.cancelDrag();
    clearAllBuildings(); clearAllActors();
    resetChunks(scene); resetWorldMaps();
    setWorldSeed(save.worldSeed || window.__WORLD_SEED);
    window.__WORLD_SEED = save.worldSeed || window.__WORLD_SEED;
    healthState.health = typeof save.health === 'number' ? save.health : 100;
    healthState.hunger = typeof save.hunger === 'number' ? save.hunger : 100;
    healthState.gameOver = false;
    document.getElementById('gameover').classList.remove('show');
    hooks.updateStatsUI && hooks.updateStatsUI();

    const rh = deserializeInventory(save.hotbar, HOTBAR_SIZE);
    for (let i = 0; i < HOTBAR_SIZE; i++) hotbar[i] = rh[i];
    const ri = deserializeInventory(save.inventory, INV_SIZE);
    for (let i = 0; i < INV_SIZE; i++) inventory[i] = ri[i];

    if (Array.isArray(save.collected)) save.collected.forEach(k => collected.add(k));
    if (Array.isArray(save.propDamage)) save.propDamage.forEach(([k, v]) => propDamage.set(k, v));
    if (save.player) {
      player.gridX = save.player.gridX | 0; player.gridZ = save.player.gridZ | 0;
      player.fromX = player.gridX; player.fromZ = player.gridZ;
      player.targetRot = save.player.targetRot || Math.PI;
      player.moving = false; player.t = 0;
      playerMesh.position.set(player.gridX, 0, player.gridZ);
      playerMesh.rotation.y = player.targetRot;
    }
    updateChunksIfNeeded(scene, player);
    // 建筑
    if (Array.isArray(save.furnaces)) save.furnaces.forEach(f => {
      const [x, z] = f.key.split(',').map(Number);
      const mesh = createFurnaceMesh(x, z);
      mesh.data.inputType = f.inputType || null; mesh.data.input = f.input || 0;
      mesh.data.fuel = f.fuel || 0; mesh.data.outputType = f.outputType || null;
      mesh.data.output = f.output || 0; mesh.data.progress = f.progress || 0;
      furnaces.set(f.key, mesh);
    });
    if (Array.isArray(save.smokers)) save.smokers.forEach(f => {
      const [x, z] = f.key.split(',').map(Number);
      const mesh = createSmokerMesh(x, z);
      mesh.data.inputType = f.inputType || null; mesh.data.input = f.input || 0;
      mesh.data.fuel = f.fuel || 0; mesh.data.outputType = f.outputType || null;
      mesh.data.output = f.output || 0; mesh.data.progress = f.progress || 0;
      smokers.set(f.key, mesh);
    });
    if (Array.isArray(save.bridges)) save.bridges.forEach(key => { const [x, z] = key.split(',').map(Number); addBridge(key, x, z); });
    if (Array.isArray(save.fences)) save.fences.forEach(key => { const [x, z] = key.split(',').map(Number); addFence(key, x, z); });
    if (Array.isArray(save.stoneWalls)) save.stoneWalls.forEach(key => { const [x, z] = key.split(',').map(Number); addStoneWall(key, x, z); });
    if (Array.isArray(save.lanterns)) save.lanterns.forEach(l => { const [x, z] = l.key.split(',').map(Number); addLantern(l.key, x, z, !!l.onWall); });
    if (Array.isArray(save.campfires)) save.campfires.forEach(key => { const [x, z] = key.split(',').map(Number); campfires.set(key, createCampfireMesh(x, z)); });
    if (Array.isArray(save.fenceGates)) save.fenceGates.forEach(g => {
      const [x, z] = g.key.split(',').map(Number);
      const mesh = createFenceGateMesh(x, z, g.facing || 0);
      mesh.open = !!g.open;
      mesh.currentAngle = mesh.open ? Math.PI / 2 : 0;
      mesh.targetAngle = mesh.currentAngle;
      mesh.hinge.rotation.y = mesh.currentAngle;
      fenceGates.set(g.key, mesh);
    });
    if (Array.isArray(save.chests)) save.chests.forEach(c => {
      const [x, z] = c.key.split(',').map(Number);
      addChest(c.key, x, z);
      const slots = deserializeInventory(c.slots, CHEST_SIZE);
      chests.set(c.key, { mesh: null, slots });
    });
    if (save.crystalKey) {
      const [x, z] = save.crystalKey.split(',').map(Number);
      crystalState.mesh = createCrystalMesh(x, z);
      crystalState.key = save.crystalKey;
      window.__crystalKey = crystalState.key;
    } else { crystalState.key = null; crystalState.mesh = null; window.__crystalKey = null; document.getElementById('win').classList.remove('show'); }
    if (Array.isArray(save.droppedItems)) save.droppedItems.forEach(d => {
      const [x, z] = d.key.split(',').map(Number);
      const mesh = createDropMesh(d.type, x, z);
      if (d.count > 1) { const s = 1 + Math.min(1.2, (d.count - 1) * 0.02); mesh.scale.setScalar(s); }
      scene.add(mesh);
      droppedItems.set(d.key, { type: d.type, count: d.count, mesh, bornAt: performance.now() - (d.age || 0) });
    });
    timeState.timeOfDay = typeof save.timeOfDay === 'number' ? save.timeOfDay : 0.30;
    if (save.weather) {
      weather.type = save.weather.type || 'clear';
      weather.intensity = save.weather.intensity || 0;
      weather.timer = save.weather.timer || 0;
      weather.nextChange = save.weather.nextChange || 30;
    } else { weather.type = 'clear'; weather.intensity = 0; weather.timer = 0; weather.nextChange = 30; }
    if (window.__setCameraRotation) window.__setCameraRotation(save.cameraRotation || 0);
    if (window.__updateCamera) window.__updateCamera();
    hooks.updateAllUI && hooks.updateAllUI();
    updateLightAssignment(player.gridX, player.gridZ);
    toast(t('loaded'));
  } catch (err) { console.error(err); toast(t('loadError')); }
}
export function bindSaveLoad() {
  if (saveBtn) saveBtn.addEventListener('click', saveGame);
  if (loadBtn) loadBtn.addEventListener('click', loadGame);
}