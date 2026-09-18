import * as THREE from 'three';
import { t, toast, hooks, langState, STRINGS, svgIcon, hash2,
  HOTBAR_SIZE, CHUNK, MAX_STACK, PROP_HITS as CORE_PROPHITS } from './core.js';
import { scene, renderer, camera, weather, timeState, updateCamera,
  updateWeather, updateDayNight, updateRipples, updateTeleportEffects,
  spawnTeleportBurst, onResize } from './render.js';
import { BIOMES, getBiome, isWater, getProp, collected, propDamage,
  crackOverlays, buildChunk, rebuildChunkProps, updateChunksIfNeeded,
  resetChunks, resetWorldMaps, initCracks, drawCrack, clearCrack,
  PROP_HITS } from './world.js';
import { player, playerMesh, healthState, updatePlayer, updateSurvival,
  updateZombies, updatePigs, updateRemotePlayers, damageZombie, damagePig,
  startMineAnim, remotePlayers, zombies, pigs, ZOMBIE_DAMAGE, buildingDamage } from './actors.js';
import { furnaces, smokers, chests, campfires, fenceGates, crystalState,
  batches, initBuildingBatches, createFurnaceMesh, createSmokerMesh, createCampfireMesh,
  createFenceGateMesh, createCrystalMesh, addBridge, addFence, addStoneWall,
  addChest, addTorch, addLantern, removeBridge, removeFence, removeStoneWall,
  removeChest, removeTorch, removeLantern, hasBridge, hasFence, hasStoneWall,
  hasLantern, hasTorch, updateLightAssignment, updateLightsIfMoved, updateFurnaces,
  updateSmokerSmoke, updateGates, updateCampfireFlicker, updateLanternGlow,
  blockAt, buildingOccupiedAt, hasPropAt, hasBuilding, isZombieAttackable,
  clearAllBuildings } from './buildings.js';
import { hotbar, inventory, droppedItems, addItem, removeItem, countItem,
  getSelectedItem, getAxeTier, getPickaxeTier, getSwordDamage, propToItem,
  itemAmountFor, PLACEABLE, PLACEABLE_KEY, BUILDING_KEY, FOOD,
  updateDroppedItems, createDropLocal, createDropMesh,
  dropSelectedItem, checkPickupAtPlayer, renderCraft, currentCraftTab,
  setCurrentCraftTab, bindGlobalPointerDrag, dragState, returnDragItem,
  getArr, selectedSlot } from './items.js';
import { cacheElements, updateAllUI, updateStatsUI, updateHotbarUI, updateInvUI,
  selectSlot, openFurnace, closeFurnace, openChest, closeChest, renderChestUI,
  updateFurnaceUI, updatePlaceHint, applyLang } from './ui.js';
import { netState, startHost, joinRoom, getNetCtx, netSyncSelfPos,
  broadcast, sendToHost, handleClientMessage, handleHostMessage,
  tryPlaceRemote, applyBuildingPlaced, applyBuildingRemoved, mineBuildingAtRemote,
  updateSaveLoadButtons, updatePlayerListDisplay, bindSaveLoad, canSaveNow, saveGame, loadGame } from './systems.js';

/* ============ 全局暴露给 systems.js 用 ============ */
window.__BATCHES = batches;
window.__WORLD_SEED = null;
window.__propToItem = propToItem;
window.__itemAmountFor = itemAmountFor;
window.__updateCamera = () => updateCamera(playerMesh);
window.__crystalKey = null;

/* ============ 初始化 ============ */
initBuildingBatches();
cacheElements();
initCracks(scene);
bindGlobalPointerDrag();
bindSaveLoad();

/* ============ 注册 hooks ============ */
hooks.updateAllUI = updateAllUI;
hooks.updateStatsUI = updateStatsUI;
hooks.updateHotbarUI = updateHotbarUI;
hooks.updateInvUI = updateInvUI;
hooks.renderChestUI = renderChestUI;
hooks.updateFurnaceUI = updateFurnaceUI;
hooks.updatePlaceHint = updatePlaceHint;
hooks.renderCraft = renderCraft;
hooks.applyLang = applyLang;
hooks.toast = toast;
hooks.updateSaveLoadButtons = updateSaveLoadButtons;
hooks.openFurnace = openFurnace;
hooks.closeFurnace = closeFurnace;
hooks.openChest = openChest;
hooks.closeChest = closeChest;
hooks.cancelDrag = () => { if (dragState.active) returnDragItem(); };
hooks.onPlayerArrive = () => {
  checkPickupAtPlayer(getNetCtx());
  netSyncSelfPos();
};

/* ============ 相机旋转 ============ */
let cameraRotation = 0;
window.__getCameraRotation = () => cameraRotation;
window.__setCameraRotation = (v) => {
  cameraRotation = v;
  window.__cameraRotation = v;
  updateCamera(playerMesh);
};
Object.defineProperty(window, '__cameraRotation', { value: 0, writable: true });

function rotateCamera(delta) {
  cameraRotation = ((cameraRotation + delta) % 8 + 8) % 8;
  window.__cameraRotation = cameraRotation;
  updateCamera(playerMesh);
}

/* ============ 屏幕坐标 -> 网格坐标 ============ */
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function screenToGrid(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, hit)) return { x: Math.round(hit.x), z: Math.round(hit.z) };
  return null;
}

/* ============ 放置 ============ */
function tryPlaceBlock(x, z) {
  const sel = getSelectedItem();
  if (!sel || !PLACEABLE.has(sel.type)) return;
  const type = sel.type;
  const key = x + ',' + z;
  const water = isWater(x, z);
  const onBridge = hasBridge(key);
  if (x === player.gridX && z === player.gridZ) { toast(t('selfBlock')); return; }

  if (type === 'lantern') {
    if (hasLantern(key)) { toast(t('occupied')); return; }
    const onWall = hasStoneWall(key);
    if (!onWall) {
      if (buildingOccupiedAt(key) || hasPropAt(x, z)) { toast(t('occupied')); return; }
      if (water && !onBridge) { toast(t('cannotWater')); return; }
    }
    if (netState.mode === 'client') {
      sendToHost({ type: 'intent', action: 'place', x, z, buildingType: 'lantern', extra: { onWall } });
      removeItem('lantern', 1); updateAllUI();
      return;
    }
    addLantern(key, x, z, onWall);
    removeItem('lantern', 1); toast(t('placedLantern'));
    updateLightAssignment(player.gridX, player.gridZ);
    if (netState.mode === 'host') broadcast({ type: 'buildingPlaced', buildingType: 'lantern', x, z, onWall });
    updateAllUI();
    return;
  }

  if (buildingOccupiedAt(key) || hasPropAt(x, z)) { toast(t('occupied')); return; }
  if (water && !onBridge && type !== 'bridge') { toast(t('cannotWater')); return; }

  if (netState.mode === 'client') {
    let extra = null;
    if (type === 'fence_gate') {
      const dx = player.gridX - x, dz = player.gridZ - z;
      let facing = 0;
      if (Math.abs(dx) > Math.abs(dz)) facing = dx > 0 ? 0 : Math.PI;
      else facing = dz > 0 ? Math.PI / 2 : -Math.PI / 2;
      extra = { facing };
    }
    sendToHost({ type: 'intent', action: 'place', x, z, buildingType: type, extra });
    removeItem(type, 1); updateAllUI();
    return;
  }

  if (type === 'bridge') {
    if (!water) { toast(t('bridgeWaterOnly')); return; }
    if (onBridge) { toast(t('occupied')); return; }
    addBridge(key, x, z);
    removeItem('bridge', 1); toast(t('placedBridge'));
    if (netState.mode === 'host') broadcast({ type: 'buildingPlaced', buildingType: 'bridge', x, z });
  } else if (type === 'furnace') {
    const f = createFurnaceMesh(x, z); furnaces.set(key, f);
    removeItem('furnace', 1); toast(t('placedFurnace'));
    if (netState.mode === 'host') broadcast({ type: 'buildingPlaced', buildingType: 'furnace', x, z });
  } else if (type === 'smoker') {
    const f = createSmokerMesh(x, z); smokers.set(key, f);
    removeItem('smoker', 1); toast(t('placedSmoker'));
    if (netState.mode === 'host') broadcast({ type: 'buildingPlaced', buildingType: 'smoker', x, z });
  } else if (type === 'torch') {
    addTorch(key, x, z);
    removeItem('torch', 1); toast(t('placedTorch'));
    updateLightAssignment(player.gridX, player.gridZ);
    if (netState.mode === 'host') broadcast({ type: 'buildingPlaced', buildingType: 'torch', x, z });
  } else if (type === 'fence') {
    addFence(key, x, z);
    removeItem('fence', 1); toast(t('placedFence'));
    if (netState.mode === 'host') broadcast({ type: 'buildingPlaced', buildingType: 'fence', x, z });
  } else if (type === 'stone_wall') {
    addStoneWall(key, x, z);
    removeItem('stone_wall', 1); toast(t('placedStoneWall'));
    if (netState.mode === 'host') broadcast({ type: 'buildingPlaced', buildingType: 'stone_wall', x, z });
  } else if (type === 'fence_gate') {
    const dx = player.gridX - x, dz = player.gridZ - z;
    let facing = 0;
    if (Math.abs(dx) > Math.abs(dz)) facing = dx > 0 ? 0 : Math.PI;
    else facing = dz > 0 ? Math.PI / 2 : -Math.PI / 2;
    fenceGates.set(key, createFenceGateMesh(x, z, facing));
    removeItem('fence_gate', 1); toast(t('placedGate'));
    if (netState.mode === 'host') broadcast({ type: 'buildingPlaced', buildingType: 'fence_gate', x, z, facing });
  } else if (type === 'chest') {
    addChest(key, x, z);
    chests.set(key, { mesh: null, slots: new Array(18).fill(null) });
    removeItem('chest', 1); toast(t('placedChest'));
    if (netState.mode === 'host') broadcast({ type: 'buildingPlaced', buildingType: 'chest', x, z });
  } else if (type === 'campfire') {
    campfires.set(key, createCampfireMesh(x, z));
    removeItem('campfire', 1); toast(t('placedCampfire'));
    updateLightAssignment(player.gridX, player.gridZ);
    if (netState.mode === 'host') broadcast({ type: 'buildingPlaced', buildingType: 'campfire', x, z });
  } else if (type === 'crystal') {
    if (crystalState.key) { toast(t('crystalOccupied')); return; }
    crystalState.mesh = createCrystalMesh(x, z);
    crystalState.key = key;
    window.__crystalKey = key;
    removeItem('crystal', 1); toast(t('placedCrystal'));
    document.getElementById('win').classList.add('show');
    updateLightAssignment(player.gridX, player.gridZ);
    if (netState.mode === 'host') broadcast({ type: 'buildingPlaced', buildingType: 'crystal', x, z });
  }
  updateAllUI();
}

/* ============ 挖掘建筑 ============ */
function mineBuildingAt(x, z) {
  const key = x + ',' + z;
  let type = null;
  if (furnaces.has(key)) type = 'furnace';
  else if (smokers.has(key)) type = 'smoker';
  else if (hasTorch(key)) type = 'torch';
  else if (hasBridge(key)) type = 'bridge';
  else if (hasFence(key)) type = 'fence';
  else if (hasLantern(key)) type = 'lantern';
  else if (hasStoneWall(key)) type = 'stone_wall';
  else if (fenceGates.has(key)) type = 'fence_gate';
  else if (chests.has(key)) type = 'chest';
  else if (campfires.has(key)) type = 'campfire';
  else if (key === crystalState.key) type = 'crystal';
  if (!type) return;
  if (netState.mode === 'client') {
    sendToHost({ type: 'intent', action: 'remove', x, z, buildingType: type });
    return;
  }
  if (type === 'chest') {
    const c = chests.get(key);
    if (c.slots) for (let i = 0; i < c.slots.length; i++) {
      if (c.slots[i]) { addItem(c.slots[i].type, c.slots[i].count); c.slots[i] = null; }
    }
    if (window.__openChestKey === key) closeChest();
    removeChest(key); chests.delete(key);
  } else if (type === 'furnace') {
    const f = furnaces.get(key);
    if (f.data) {
      if (f.data.input > 0 && f.data.inputType) addItem(f.data.inputType, f.data.input);
      if (f.data.fuel > 0) addItem('coal', f.data.fuel);
      if (f.data.output > 0 && f.data.outputType) addItem(f.data.outputType, f.data.output);
    }
    scene.remove(f.group); furnaces.delete(key);
  } else if (type === 'smoker') {
    const f = smokers.get(key);
    if (f.data) {
      if (f.data.input > 0 && f.data.inputType) addItem(f.data.inputType, f.data.input);
      if (f.data.fuel > 0) addItem('coal', f.data.fuel);
      if (f.data.output > 0 && f.data.outputType) addItem(f.data.outputType, f.data.output);
    }
    scene.remove(f.group); smokers.delete(key);
  } else if (type === 'torch') { removeTorch(key); updateLightAssignment(player.gridX, player.gridZ); }
  else if (type === 'bridge') removeBridge(key);
  else if (type === 'fence') removeFence(key);
  else if (type === 'stone_wall') {
    removeStoneWall(key);
    if (hasLantern(key)) { removeLantern(key); addItem('lantern', 1); updateLightAssignment(player.gridX, player.gridZ); }
  } else if (type === 'lantern') { removeLantern(key); updateLightAssignment(player.gridX, player.gridZ); }
  else if (type === 'fence_gate') { const g = fenceGates.get(key); if (g) { scene.remove(g.outer); fenceGates.delete(key); } }
  else if (type === 'campfire') { const c = campfires.get(key); if (c) { scene.remove(c); campfires.delete(key); updateLightAssignment(player.gridX, player.gridZ); } }
  else if (type === 'crystal') {
    if (crystalState.mesh) scene.remove(crystalState.mesh);
    crystalState.mesh = null; crystalState.key = null;
    window.__crystalKey = null;
    document.getElementById('win').classList.remove('show');
    updateLightAssignment(player.gridX, player.gridZ);
  }
  addItem(type, 1);
  toast(t('recovered', { s: t(BUILDING_KEY[type]) }));
  if (netState.mode === 'host') broadcast({ type: 'buildingRemoved', x, z, buildingType: type });
  updateAllUI();
}

/* ============ 长按挖掘 ============ */
let pointerDown = false, pointerHoldTime = 0, pointerHoldGrid = null;
let lastPointerX = 0, lastPointerY = 0;
const LONG_PRESS_THRESHOLD = 0.85;

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const g = screenToGrid(e.clientX, e.clientY); if (!g) return;
  pointerDown = true; pointerHoldTime = 0; pointerHoldGrid = g;
  lastPointerX = e.clientX; lastPointerY = e.clientY;
});
renderer.domElement.addEventListener('pointermove', (e) => { lastPointerX = e.clientX; lastPointerY = e.clientY; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const wasShort = pointerDown && pointerHoldTime < LONG_PRESS_THRESHOLD;
  const g = pointerHoldGrid;
  pointerDown = false; pointerHoldTime = 0; pointerHoldGrid = null;
  const mp = document.getElementById('mineProgress');
  if (mp) mp.classList.remove('on');
  if (!g || !wasShort) return;
  const key = g.x + ',' + g.z;
  const sel = getSelectedItem();
  if (sel && PLACEABLE.has(sel.type)) tryPlaceBlock(g.x, g.z);
  else if (fenceGates.has(key)) {
    const gate = fenceGates.get(key);
    gate.open = !gate.open;
    gate.targetAngle = gate.open ? Math.PI / 2 : 0;
    toast(gate.open ? t('gateOpen') : t('gateClose'));
    if (netState.mode === 'host') broadcast({ type: 'gateToggled', x: g.x, z: g.z, open: gate.open });
    else if (netState.mode === 'client') sendToHost({ type: 'intent', action: 'gate', x: g.x, z: g.z });
  }
});
renderer.domElement.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const g = screenToGrid(e.clientX, e.clientY); if (!g) return;
  const key = g.x + ',' + g.z;
  if (furnaces.has(key)) openFurnace(key, 'furnace');
  else if (smokers.has(key)) openFurnace(key, 'smoker');
  else if (chests.has(key)) openChest(key);
  else if (campfires.has(key)) useCampfire(key);
});
function updateLongPress(dt) {
  if (!pointerDown || !pointerHoldGrid) return;
  const g = screenToGrid(lastPointerX, lastPointerY);
  const mp = document.getElementById('mineProgress');
  const mpf = document.getElementById('mineProgressFill');
  if (!g || g.x !== pointerHoldGrid.x || g.z !== pointerHoldGrid.z) {
    pointerHoldTime = 0; if (mp) mp.classList.remove('on'); return;
  }
  const key = pointerHoldGrid.x + ',' + pointerHoldGrid.z;
  if (!hasBuilding(key)) { pointerHoldTime = 0; if (mp) mp.classList.remove('on'); return; }
  pointerHoldTime += dt;
  const ratio = Math.min(1, pointerHoldTime / LONG_PRESS_THRESHOLD);
  if (mp) mp.classList.add('on');
  if (mpf) mpf.style.width = (ratio * 100) + '%';
  if (pointerHoldTime >= LONG_PRESS_THRESHOLD) {
    mineBuildingAt(pointerHoldGrid.x, pointerHoldGrid.z);
    pointerHoldTime = 0;
    if (mp) mp.classList.remove('on');
    if (mpf) mpf.style.width = '0%';
  }
}

/* ============ 篝火 ============ */
function useCampfire(key) {
  const sunAngle = (timeState.timeOfDay - 0.25) * Math.PI * 2;
  const sunHeight = Math.sin(sunAngle);
  if (sunHeight >= 0) { toast(t('onlyDayCanSleep')); return; }
  if (timeState.campfireTransition) return;
  const target = 0.27;
  const dist = target >= timeState.timeOfDay ? target - timeState.timeOfDay : 1 - timeState.timeOfDay + target;
  timeState.campfireTransition = { elapsed: 0, duration: 2.5, distance: dist };
  toast(t('skippedNightFast'));
  spawnTeleportBurst(playerMesh.position.x, 0.5, playerMesh.position.z);
}

/* ============ 挖掘资源 ============ */
function canMine(prop) {
  if (prop === 'rock' || prop === 'coal') return getPickaxeTier() >= 1;
  if (prop === 'iron') return getPickaxeTier() >= 2;
  return true;
}
function tryMineResource(x, z) {
  const key = x + ',' + z;
  if (collected.has(key)) return;
  const prop = getProp(x, z, getBiome(x, z));
  if (!prop) return;
  if (!canMine(prop)) { toast(t(prop === 'iron' ? 'needStonePick' : 'needWoodPick')); return; }
  startMineAnim();
  if (netState.mode === 'client') {
    sendToHost({ type: 'intent', action: 'mine', x, z, toolTier: getPickaxeTier() });
    return;
  }
  const need = PROP_HITS[prop] || 1;
  const cur = (propDamage.get(key) || 0) + 1;
  if (cur >= need) {
    collected.add(key); propDamage.delete(key); clearCrack(key);
    harvest(prop, x, z);
    rebuildChunkProps(scene, Math.floor(x / CHUNK), Math.floor(z / CHUNK));
    if (netState.mode === 'host') {
      const itemType = propToItem(prop);
      const amt = itemAmountFor(prop, getPickaxeTier());
      broadcast({ type: 'blockCollected', x, z, itemType, amt, forPlayer: 'host' });
    }
  } else {
    propDamage.set(key, cur);
    drawCrack(x, z, cur, need, prop);
    toast(t('needHits', { n: need - cur }));
  }
}
function harvest(prop, x, z) {
  if (prop === 'tree' || prop === 'pine') {
    const amt = [1, 2, 4, 6][getAxeTier()];
    addItem('wood', amt); toast(t('gotWood', { n: amt }));
  } else if (prop === 'rock') {
    const amt = [0, 2, 3, 5][getPickaxeTier()]; addItem('stone', amt); toast(t('gotStone', { n: amt }));
  } else if (prop === 'iron') {
    const amt = [0, 0, 1, 3][getPickaxeTier()]; addItem('iron', amt); toast(t('gotIron', { n: amt }));
  } else if (prop === 'coal') {
    const amt = [0, 2, 3, 5][getPickaxeTier()]; addItem('coal', amt); toast(t('gotCoal', { n: amt }));
  } else if (prop === 'bush') {
    const amt = 1 + Math.floor(hash2(x * 7.7, z * 9.9) * 3); addItem('berries', amt); toast(t('gotBerries', { n: amt }));
  } else if (prop === 'cactus') { addItem('sticks', 1); toast(t('gotStick')); }
  updateAllUI();
}

/* ============ 战斗 ============ */
function tryAttack(nx, nz, targetRot) {
  const swordDamage = getSwordDamage();
  const { netMode } = getNetCtx();
  for (const z of zombies) {
    if (z.gridX === nx && z.gridZ === nz) {
      if (Math.abs((targetRot - player.targetRot + Math.PI) % (2*Math.PI) - Math.PI) < 0.3) {
        startMineAnim();
        if (netMode === 'host' || netMode === 'single') damageZombie(z, swordDamage);
        else { sendToHost({ type: 'intent', action: 'attackZombie', x: nx, z: nz, dmg: swordDamage }); }
        return true;
      } else { player.targetRot = targetRot; return true; }
    }
  }
  for (const p of pigs) {
    if (p.gridX === nx && p.gridZ === nz) {
      if (Math.abs((targetRot - player.targetRot + Math.PI) % (2*Math.PI) - Math.PI) < 0.3) {
        startMineAnim();
        if (netMode === 'host' || netMode === 'single') damagePig(p, swordDamage, addItem, updateAllUI);
        else sendToHost({ type: 'intent', action: 'attackPig', x: nx, z: nz, dmg: swordDamage });
        return true;
      } else { player.targetRot = targetRot; return true; }
    }
  }
  for (const [pid, rp] of remotePlayers) {
    const rx = Math.round(rp.targetX), rz = Math.round(rp.targetZ);
    if (rx === nx && rz === nz) {
      if (Math.abs((targetRot - player.targetRot + Math.PI) % (2*Math.PI) - Math.PI) < 0.3) {
        startMineAnim();
        if (netMode === 'host') {
          const tc = netState.clientConns.get(pid);
          if (tc && tc.conn.open) { try { tc.conn.send(JSON.stringify({ type: 'takeDamage', amount: swordDamage })); } catch (e) {} }
        } else if (netMode === 'client') sendToHost({ type: 'intent', action: 'attackPlayer', targetId: pid, dmg: swordDamage });
        return true;
      } else { player.targetRot = targetRot; return true; }
    }
  }
  return false;
}

/* ============ 移动 ============ */
function tryMove(dx, dz) {
  if (player.moving || healthState.gameOver) return;
  const sel = getSelectedItem();
  const nx = player.gridX + dx, nz = player.gridZ + dz;
  if (sel && sel.type === 'fishing_rod' && isWater(nx, nz) && !player.swimming) { tryFish(); return; }
  const targetRot = Math.atan2(-dx, -dz);
  if (tryAttack(nx, nz, targetRot)) return;
  const block = blockAt(nx, nz);
  if (block) {
    const facing = Math.abs((targetRot - player.targetRot + Math.PI) % (2*Math.PI) - Math.PI) < 0.3;
    if (facing) {
      if (!hasBuilding(block.key)) tryMineResource(nx, nz);
      else { player.targetRot = targetRot; startMineAnim(); }
    } else player.targetRot = targetRot;
    return;
  }
  const biome = getBiome(nx, nz);
  if (!BIOMES[biome].walkable) return;
  player.fromX = player.gridX; player.fromZ = player.gridZ;
  player.gridX = nx; player.gridZ = nz;
  player.t = 0; player.moving = true; player.targetRot = targetRot;
  player.moveTime = (biome === 'water' && !hasBridge(nx + ',' + nz)) ? 0.30 : 0.17;
  updateChunksIfNeeded(scene, player);
  updateLightsIfMoved(player);
  hideHint();
}

/* ============ 钓鱼 ============ */
let fishingCooldown = 0;
function tryFish() {
  if (fishingCooldown > 0) { toast(t('waitFish')); return false; }
  const dx = -Math.round(Math.sin(player.targetRot));
  const dz = -Math.round(Math.cos(player.targetRot));
  const tx = player.gridX + dx, tz = player.gridZ + dz;
  if (!isWater(tx, tz)) { toast(t('needWater')); return false; }
  fishingCooldown = 1.5;
  const r = Math.random();
  if (r < 0.15) { toast(t('fishFail')); return true; }
  let count = 1; if (r > 0.88) count = 2;
  addItem('fish', count); toast(t('gotFish', { n: count }));
  updateAllUI(); return true;
}

/* ============ 传送 ============ */
function teleportToCrystal() {
  if (!crystalState.key) { toast(t('noCrystal')); return; }
  const [cx, cz] = crystalState.key.split(',').map(Number);
  const neighbors = [
    [cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1],
    [cx + 1, cz + 1], [cx - 1, cz - 1], [cx + 1, cz - 1], [cx - 1, cz + 1],
  ];
  for (const [nx, nz] of neighbors) {
    if (!BIOMES[getBiome(nx, nz)].walkable) continue;
    if (blockAt(nx, nz)) continue;
    spawnTeleportBurst(playerMesh.position.x, 0.5, playerMesh.position.z);
    player.gridX = nx; player.gridZ = nz;
    player.fromX = nx; player.fromZ = nz;
    player.t = 0; player.moving = false;
    playerMesh.position.set(nx, 0, nz);
    updateChunksIfNeeded(scene, player);
    updateLightsIfMoved(player);
    spawnTeleportBurst(nx, 0.5, nz);
    netSyncSelfPos();
    toast(t('teleported'));
    return;
  }
  toast(t('noSpace'));
}

/* ============ 键盘输入 ============ */
window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
  if (e.key >= '1' && e.key <= '9') { e.preventDefault(); selectSlot(parseInt(e.key, 10) - 1); return; }
  if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); dropSelectedItem(getNetCtx()); return; }
  if (e.key === 'h' || e.key === 'H') { e.preventDefault(); teleportToCrystal(); return; }
  if (e.key === 'e' || e.key === 'E') {
    e.preventDefault();
    if (document.getElementById('furnacePanel').classList.contains('show')) { closeFurnace(); return; }
    if (document.getElementById('chestPanel').classList.contains('show')) { closeChest(); return; }
    const inv = document.getElementById('invPanel');
    inv.classList.toggle('show');
    if (inv.classList.contains('show')) updateInvUI();
    return;
  }
  if (e.key === 'Escape') {
    document.getElementById('invPanel').classList.remove('show');
    closeFurnace(); closeChest();
    if (dragState.active) returnDragItem();
    return;
  }
  if (e.key === 'ArrowLeft') { e.preventDefault(); rotateCamera(1); return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); rotateCamera(7); return; }
  let screenDir = null;
  if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') screenDir = 'forward';
  else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') screenDir = 'back';
  else if (e.key === 'a' || e.key === 'A') screenDir = 'left';
  else if (e.key === 'd' || e.key === 'D') screenDir = 'right';
  if (screenDir) {
    e.preventDefault();
    const dir = getMoveDirImpl(screenDir);
    tryMove(dir[0], dir[1]);
  }
});
import { getMoveDir as getMoveDirImpl } from './core.js';

/* ============ 虚拟方向键 ============ */
const dpad = document.getElementById('dpad');
const isMobile = window.matchMedia('(pointer: coarse)').matches;
if (isMobile && dpad) dpad.style.display = 'grid';
const DPAD_MAP = { up: 'forward', down: 'back', left: 'left', right: 'right' };
if (dpad) dpad.querySelectorAll('.dbtn').forEach(btn => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const dir = getMoveDirImpl(DPAD_MAP[btn.dataset.dir]);
    tryMove(dir[0], dir[1]);
  });
});

/* ============ 提示条 ============ */
let hintHidden = false;
function hideHint() {
  if (hintHidden) return;
  hintHidden = true;
  const h = document.getElementById('hint');
  if (h) { h.classList.add('hide'); setTimeout(() => h.remove(), 700); }
}
setTimeout(hideHint, 15000);

/* ============ 主循环 ============ */
let lastTime = performance.now();
let fpsFrames = 0, fpsAccum = 0;
const fpsTagEl = document.getElementById('fpsTag');
const POS_SYNC_INTERVAL = 0.1;
let posSyncTimer = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  updatePlayer(dt, hasBridge);
  updateRipples(dt);
  updateGates(dt);
  updateDayNight(dt, playerMesh);
  updateWeather(dt, playerMesh, getBiome, toast, t);
  updateFurnaces(dt, window.__openFurnaceKey, window.__furnaceStation, updateFurnaceUI);
  updateCampfireFlicker(dt);
  updateLanternGlow(dt);
  updateSmokerSmoke(dt);
  updateDroppedItems(dt);
  updateTeleportEffects(dt);
  updateRemotePlayers(dt);

  const sunAngle = (timeState.timeOfDay - 0.25) * Math.PI * 2;
  const isNight = Math.sin(sunAngle) < 0;
  const batchMod = batches;
  updateZombies(dt, {
    isNight,
    netMode: netState.mode,
    clientConns: netState.clientConns,
    broadcast,
    getTorches: () => batches.torchStick.map.keys(),
    getLanterns: () => [...batches.lanternGround.map.keys(), ...batches.lanternWall.map.keys()],
    getCampfires: () => campfires.keys(),
    destroyBuilding: (key) => {
      if (furnaces.has(key)) { scene.remove(furnaces.get(key).group); furnaces.delete(key); return 'furnace'; }
      if (smokers.has(key)) { scene.remove(smokers.get(key).group); smokers.delete(key); return 'smoker'; }
      if (hasTorch(key)) { removeTorch(key); return 'torch'; }
      if (chests.has(key)) { removeChest(key); chests.delete(key); return 'chestItem'; }
      if (campfires.has(key)) { scene.remove(campfires.get(key)); campfires.delete(key); return 'campfire'; }
      if (hasFence(key)) { removeFence(key); return 'fence'; }
      if (fenceGates.has(key)) { scene.remove(fenceGates.get(key).outer); fenceGates.delete(key); return 'fence_gate'; }
      if (hasLantern(key)) { removeLantern(key); return 'lantern'; }
      return null;
    },
    onBuildingDestroyed: (x, z, type) => {
      updateLightAssignment(player.gridX, player.gridZ);
      if (netState.mode === 'host') broadcast({ type: 'buildingRemoved', x, z, buildingType: type });
    },
  });

  updatePigs(dt, netState.mode, broadcast);
  updateSurvival(dt);
  updateLongPress(dt);
  if (fishingCooldown > 0) fishingCooldown -= dt;
  updateCamera(playerMesh);
  if (netState.mode !== 'single' && !player.moving) {
    posSyncTimer += dt;
    if (posSyncTimer >= POS_SYNC_INTERVAL) { posSyncTimer = 0; netSyncSelfPos(); }
  }
  renderer.render(scene, camera);
  fpsFrames++; fpsAccum += dt;
  if (fpsAccum >= 0.5) {
    if (fpsTagEl) {
      fpsTagEl.textContent = 'FPS ' + Math.round(fpsFrames / fpsAccum);
      fpsTagEl.classList.add('on');
    }
    fpsFrames = 0; fpsAccum = 0;
  }
}

/* ============ 启动 ============ */
function startGame() {
  document.getElementById('menuOverlay').classList.add('hidden');
  updateChunksIfNeeded(scene, player);
  updateAllUI();
  updateStatsUI();
  applyLang();
  updateLightAssignment(player.gridX, player.gridZ);
  updateSaveLoadButtons();
  updateCamera(playerMesh);
  window.__WORLD_SEED = window.__WORLD_SEED || Math.random() * 100000;
  requestAnimationFrame(animate);
}
document.getElementById('btnSingle').addEventListener('click', () => {
  netState.mode = 'single';
  startGame();
});
document.getElementById('btnHost').addEventListener('click', () => {
  startGame();
  startHost();
});
document.getElementById('btnJoinToggle').addEventListener('click', () => {
  const row = document.getElementById('joinRow');
  row.classList.toggle('on');
  if (row.classList.contains('on')) setTimeout(() => document.getElementById('joinCode').focus(), 100);
});
document.getElementById('btnJoinGo').addEventListener('click', () => {
  const code = document.getElementById('joinCode').value.trim();
  if (!/^\d{6}$/.test(code)) { alert(t('enterCode')); return; }
  netState.mode = 'client';
  startGame();
  joinRoom(code);
});
document.getElementById('joinCode').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btnJoinGo').click();
});
document.getElementById('langBtn').addEventListener('click', () => {
  langState.current = langState.current === 'zh' ? 'en' : 'zh';
  applyLang();
  updatePlayerListDisplay();
});
document.getElementById('menuLangBtn').addEventListener('click', () => {
  langState.current = langState.current === 'zh' ? 'en' : 'zh';
  applyLang();
});
document.getElementById('winClose').addEventListener('click', () => {
  document.getElementById('win').classList.remove('show');
});
document.getElementById('fInput').addEventListener('pointerdown', (e) => {
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  import('./items.js').then(m => m.pickUpFromFurnaceSlot('fInput', e.clientX, e.clientY));
});
document.getElementById('fFuel').addEventListener('pointerdown', (e) => {
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  import('./items.js').then(m => m.pickUpFromFurnaceSlot('fFuel', e.clientX, e.clientY));
});
document.getElementById('fOutput').addEventListener('pointerdown', (e) => {
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  import('./items.js').then(m => m.pickUpFromFurnaceSlot('fOutput', e.clientX, e.clientY));
});
document.getElementById('tabTools').addEventListener('click', () => { setCurrentCraftTab('tools'); renderCraft();
  document.getElementById('tabTools').classList.add('active');
  document.getElementById('tabBuildings').classList.remove('active');
  document.getElementById('tabMaterials').classList.remove('active'); });
document.getElementById('tabBuildings').addEventListener('click', () => { setCurrentCraftTab('buildings'); renderCraft();
  document.getElementById('tabBuildings').classList.add('active');
  document.getElementById('tabTools').classList.remove('active');
  document.getElementById('tabMaterials').classList.remove('active'); });
document.getElementById('tabMaterials').addEventListener('click', () => { setCurrentCraftTab('materials'); renderCraft();
  document.getElementById('tabMaterials').classList.add('active');
  document.getElementById('tabTools').classList.remove('active');
  document.getElementById('tabBuildings').classList.remove('active'); });
document.getElementById('btnTutorial').addEventListener('click', () => {
  const T = {
    zh: `<h3>🎮 基本操作</h3><ul><li><span class="key">WASD</span> 移动</li><li><span class="key">← →</span> 旋转视角</li><li><span class="key">1-9</span> 快捷栏 · <span class="key">E</span> 背包</li><li><span class="key">Q</span> 丢物品 · <span class="key">H</span> 传送回水晶</li><li>右键点击熔炉/烟熏炉/箱子/篝火</li></ul><h3>⛏️ 采集与合成</h3><ul><li>右侧合成台分三个标签</li><li>木质工具挖石头，石质工具挖铁矿</li></ul><h3>⚔️ 战斗</h3><ul><li>木/石/铁剑 伤害 2/4/6</li><li>僵尸只在夜晚黑暗处生成</li></ul>`,
    en: `<h3>🎮 Controls</h3><ul><li><span class="key">WASD</span> move</li><li><span class="key">← →</span> rotate view</li><li><span class="key">1-9</span> hotbar · <span class="key">E</span> inventory</li><li><span class="key">Q</span> drop · <span class="key">H</span> teleport</li><li>Right-click furnace/smoker/chest/campfire</li></ul><h3>⛏️ Gathering</h3><ul><li>3 crafting tabs</li><li>Wood pickaxe mines stone, stone pickaxe mines iron</li></ul><h3>⚔️ Combat</h3><ul><li>Wood/Stone/Iron sword 2/4/6 damage</li><li>Zombies spawn at night in the dark</li></ul>`,
  };
  document.getElementById('tutTitle').textContent = langState.current === 'zh' ? '教程' : 'Tutorial';
  document.getElementById('tutContent').innerHTML = T[langState.current];
  document.getElementById('tutorialOverlay').classList.add('on');
});
document.getElementById('tutClose').addEventListener('click', () => {
  document.getElementById('tutorialOverlay').classList.remove('on');
});