import * as THREE from 'three';
import { HOTBAR_SIZE, INV_SIZE, CHEST_SIZE, MAX_STACK, t, toast, hooks, svgIcon } from './core.js';
import { scene } from './render.js';
import { player, remotePlayers } from './actors.js';
import { chests, furnaces, smokers, batches, hasBuilding } from './buildings.js';

/* ============ 背包状态 ============ */
export const hotbar = new Array(HOTBAR_SIZE).fill(null);
export const inventory = new Array(INV_SIZE).fill(null);
export let selectedSlot = 0;
export function setSelectedSlot(v) { selectedSlot = v; }
export let openChestKey = null;
export function setOpenChestKey(k) { openChestKey = k; }
export let openFurnaceKey = null;
export function setOpenFurnaceKey(k) { openFurnaceKey = k; }
export let currentFurnaceStation = 'furnace';
export function setCurrentFurnaceStation(v) { currentFurnaceStation = v; }

/* ============ 物品分类 ============ */
export const STACKABLE = new Set([
  'wood','stone','planks','sticks','stonebrick','iron','coal','iron_ingot',
  'berries','fish','cooked_fish','raw_pork','cooked_pork',
  'furnace','smoker','torch','bridge','fence','fence_gate','chest','crystal','campfire','stone_wall','lantern',
  'wood_axe','wood_pickaxe','wood_sword',
  'axe','pickaxe','stone_sword',
  'iron_axe','iron_pickaxe','iron_sword','fishing_rod',
]);
export const PLACEABLE = new Set(['furnace','smoker','torch','bridge','fence','fence_gate','chest','crystal','campfire','stone_wall','lantern']);
export const FOOD = { berries: 20, fish: 15, cooked_fish: 35, raw_pork: 15, cooked_pork: 40 };
export const PLACEABLE_KEY = {
  furnace:'furnaceItem', smoker:'smokerItem', torch:'torch', bridge:'bridge',
  fence:'fence', fence_gate:'fence_gate', chest:'chestItem', crystal:'crystal',
  campfire:'campfire', stone_wall:'stone_wall', lantern:'lantern',
};
export const BUILDING_KEY = {
  furnace:'furnaceItem', smoker:'smokerItem', torch:'torch', bridge:'bridge',
  fence:'fence', fence_gate:'fence_gate', chest:'chestItem',
  campfire:'campfire', stone_wall:'stone_wall', lantern:'lantern', crystal:'crystal',
};

/* ============ 背包操作 ============ */
export function addItem(type, count) {
  if (!STACKABLE.has(type)) count = 1;
  for (let i = 0; i < HOTBAR_SIZE && count > 0; i++) {
    if (hotbar[i] && hotbar[i].type === type && hotbar[i].count < MAX_STACK) {
      const take = Math.min(MAX_STACK - hotbar[i].count, count);
      hotbar[i].count += take; count -= take;
    }
  }
  for (let i = 0; i < INV_SIZE && count > 0; i++) {
    if (inventory[i] && inventory[i].type === type && inventory[i].count < MAX_STACK) {
      const take = Math.min(MAX_STACK - inventory[i].count, count);
      inventory[i].count += take; count -= take;
    }
  }
  for (let i = 0; i < HOTBAR_SIZE && count > 0; i++) {
    if (!hotbar[i]) { const take = Math.min(MAX_STACK, count); hotbar[i] = { type, count: take }; count -= take; }
  }
  for (let i = 0; i < INV_SIZE && count > 0; i++) {
    if (!inventory[i]) { const take = Math.min(MAX_STACK, count); inventory[i] = { type, count: take }; count -= take; }
  }
  if (count > 0) { toast(t('tooFull')); return false; }
  return true;
}
export function countItem(type) {
  let n = 0;
  for (const s of hotbar) if (s && s.type === type) n += s.count;
  for (const s of inventory) if (s && s.type === type) n += s.count;
  return n;
}
export function removeItem(type, count) {
  for (let i = 0; i < HOTBAR_SIZE && count > 0; i++) {
    if (hotbar[i] && hotbar[i].type === type) {
      const take = Math.min(hotbar[i].count, count);
      hotbar[i].count -= take; count -= take;
      if (hotbar[i].count <= 0) hotbar[i] = null;
    }
  }
  for (let i = 0; i < INV_SIZE && count > 0; i++) {
    if (inventory[i] && inventory[i].type === type) {
      const take = Math.min(inventory[i].count, count);
      inventory[i].count -= take; count -= take;
      if (inventory[i].count <= 0) inventory[i] = null;
    }
  }
  return true;
}
export function getSelectedItem() {
  if (selectedSlot < 0 || selectedSlot >= HOTBAR_SIZE) return null;
  return hotbar[selectedSlot];
}
export function getAxeTier() {
  const sel = getSelectedItem(); if (!sel) return 0;
  const tp = sel.type;
  if (tp === 'iron_axe') return 3; if (tp === 'axe') return 2; if (tp === 'wood_axe') return 1; return 0;
}
export function getPickaxeTier() {
  const sel = getSelectedItem(); if (!sel) return 0;
  const tp = sel.type;
  if (tp === 'iron_pickaxe') return 3; if (tp === 'pickaxe') return 2; if (tp === 'wood_pickaxe') return 1; return 0;
}
export function getSwordDamage() {
  const sel = getSelectedItem(); if (!sel) return 1;
  const tp = sel.type;
  if (tp === 'iron_sword') return 6;
  if (tp === 'stone_sword') return 4;
  if (tp === 'wood_sword') return 2;
  return 1;
}
export function propToItem(prop) {
  if (prop === 'tree' || prop === 'pine') return 'wood';
  if (prop === 'rock') return 'stone';
  if (prop === 'iron') return 'iron';
  if (prop === 'coal') return 'coal';
  if (prop === 'cactus') return 'sticks';
  if (prop === 'bush') return 'berries';
  return null;
}
export function itemAmountFor(prop, tier) {
  if (prop === 'tree' || prop === 'pine') return [1, 2, 4, 6][tier] || 1;
  if (prop === 'rock' || prop === 'coal') return [0, 2, 3, 5][Math.max(0, tier)] || 2;
  if (prop === 'iron') return [0, 0, 1, 3][tier] || 1;
  if (prop === 'bush') return 1 + Math.floor(Math.random() * 3);
  return 1;
}

/* ============ 拖拽 ============ */
export const dragState = { active: false, item: null, from: null, fromIdx: 0, startX: 0, startY: 0, moved: false };
export function getArr(from) {
  if (from === 'hotbar') return hotbar;
  if (from === 'inv') return inventory;
  if (from === 'chest') { const c = chests.get(openChestKey); return c ? c.slots : null; }
  return null;
}
function getEl(id) { return document.getElementById(id); }
function startDrag(item, from, fromIdx, sx, sy) {
  dragState.active = true; dragState.item = item; dragState.from = from; dragState.fromIdx = fromIdx;
  dragState.startX = sx; dragState.startY = sy; dragState.moved = false;
  const ghost = getEl('dragGhost');
  if (ghost) {
    ghost.innerHTML = svgIcon(item.type, 24) + `<span class="ct">${item.count}</span>`;
    ghost.style.left = sx + 'px'; ghost.style.top = sy + 'px';
    ghost.classList.add('on');
  }
}
export function pickUpItem(from, idx, sx, sy) {
  const arr = getArr(from); if (!arr) return false;
  const item = arr[idx]; if (!item) return false;
  startDrag(item, from, idx, sx, sy);
  return true;
}
export function pickUpFromFurnaceSlot(slotId, sx, sy) {
  if (!openFurnaceKey) return false;
  const map = currentFurnaceStation === 'smoker' ? smokers : furnaces;
  const f = map.get(openFurnaceKey); if (!f) return false;
  const d = f.data; let item = null;
  if (slotId === 'fInput' && d.input > 0 && d.inputType) { item = { type: d.inputType, count: d.input }; d.input = 0; d.inputType = null; d.progress = 0; }
  else if (slotId === 'fFuel' && d.fuel > 0) { item = { type: 'coal', count: d.fuel }; d.fuel = 0; }
  else if (slotId === 'fOutput' && d.output > 0 && d.outputType) { item = { type: d.outputType, count: d.output }; d.output = 0; d.outputType = null; }
  if (!item) return false;
  startDrag(item, 'furnace', slotId, sx, sy);
  hooks.updateFurnaceUI && hooks.updateFurnaceUI();
  return true;
}
export function moveDrag(x, y) {
  if (!dragState.active) return;
  dragState.moved = true;
  const ghost = getEl('dragGhost');
  if (ghost) { ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; }
  document.querySelectorAll('.slot.dragging').forEach(el => el.classList.remove('dragging'));
  const srcEl = document.querySelector(`[data-drop-zone="${dragState.from}"][data-drop-idx="${dragState.fromIdx}"]`);
  if (srcEl) srcEl.classList.add('dragging');
}
export function cancelDrag() {
  dragState.active = false; dragState.item = null; dragState.from = null;
  const ghost = getEl('dragGhost');
  if (ghost) ghost.classList.remove('on');
  document.querySelectorAll('.slot.dragging').forEach(el => el.classList.remove('dragging'));
}
export function detachDragItem() {
  if (!dragState.active) return null;
  const item = dragState.item;
  if (dragState.from === 'hotbar') hotbar[dragState.fromIdx] = null;
  else if (dragState.from === 'inv') inventory[dragState.fromIdx] = null;
  else if (dragState.from === 'chest') { const c = chests.get(openChestKey); if (c) c.slots[dragState.fromIdx] = null; }
  return item;
}
export function returnDragItem() {
  if (!dragState.active) return;
  const item = dragState.item;
  if (item && item.count > 0 && dragState.from === 'furnace') addItem(item.type, item.count);
  cancelDrag(); hooks.updateAllUI && hooks.updateAllUI();
}
export function dropAt(to, toIdx) {
  if (!dragState.active) { cancelDrag(); return; }
  const toArr = getArr(to); if (!toArr) { returnDragItem(); return; }
  const fromIsFurnace = dragState.from === 'furnace';
  if (!fromIsFurnace && dragState.from === to && dragState.fromIdx === toIdx) { cancelDrag(); return; }
  const fromItem = dragState.item; if (!fromItem) { cancelDrag(); return; }
  const fromArr = fromIsFurnace ? null : getArr(dragState.from);
  if (!fromIsFurnace && !fromArr) { cancelDrag(); return; }
  const toItem = toArr[toIdx];
  if (toItem && toItem.type === fromItem.type && STACKABLE.has(toItem.type)) {
    const space = MAX_STACK - toItem.count;
    if (space > 0) {
      const take = Math.min(space, fromItem.count);
      toItem.count += take; fromItem.count -= take;
      if (fromItem.count <= 0) { if (!fromIsFurnace) fromArr[dragState.fromIdx] = null; }
      else if (fromIsFurnace) addItem(fromItem.type, fromItem.count);
      cancelDrag(); hooks.updateAllUI && hooks.updateAllUI(); return;
    }
  }
  if (!toItem) {
    toArr[toIdx] = fromItem;
    if (!fromIsFurnace) fromArr[dragState.fromIdx] = null;
    cancelDrag(); hooks.updateAllUI && hooks.updateAllUI(); return;
  }
  if (fromIsFurnace) { addItem(fromItem.type, fromItem.count); cancelDrag(); hooks.updateAllUI && hooks.updateAllUI(); return; }
  toArr[toIdx] = fromItem; fromArr[dragState.fromIdx] = toItem;
  cancelDrag(); hooks.updateAllUI && hooks.updateAllUI();
}
export function dropToFurnace(slotId) {
  if (!openFurnaceKey) { returnDragItem(); return; }
  const map = currentFurnaceStation === 'smoker' ? smokers : furnaces;
  const f = map.get(openFurnaceKey); if (!f) { returnDragItem(); return; }
  const d = f.data;
  const item = detachDragItem();
  if (!item || item.count <= 0) { cancelDrag(); hooks.updateAllUI && hooks.updateAllUI(); return; }
  const isSmoker = currentFurnaceStation === 'smoker';
  if (slotId === 'fInput') {
    const valid = isSmoker ? (item.type === 'fish' || item.type === 'raw_pork') : (item.type === 'iron');
    if (!valid) { toast(t('wrongStation')); addItem(item.type, item.count); cancelDrag(); hooks.updateAllUI && hooks.updateAllUI(); return; }
    if (d.inputType && d.inputType !== item.type) { addItem(d.inputType, d.input); d.input = 0; d.inputType = null; }
    const space = 10 - d.input;
    if (space <= 0) { addItem(item.type, item.count); cancelDrag(); hooks.updateAllUI && hooks.updateAllUI(); return; }
    const take = Math.min(space, item.count);
    d.inputType = item.type; d.input += take;
    if (item.count > take) addItem(item.type, item.count - take);
    cancelDrag(); hooks.updateAllUI && hooks.updateAllUI();
  } else if (slotId === 'fFuel') {
    if (item.type !== 'coal') { addItem(item.type, item.count); cancelDrag(); hooks.updateAllUI && hooks.updateAllUI(); return; }
    const space = 10 - d.fuel;
    if (space <= 0) { addItem(item.type, item.count); cancelDrag(); hooks.updateAllUI && hooks.updateAllUI(); return; }
    const take = Math.min(space, item.count);
    d.fuel += take;
    if (item.count > take) addItem(item.type, item.count - take);
    cancelDrag(); hooks.updateAllUI && hooks.updateAllUI();
  } else if (slotId === 'fOutput') { addItem(item.type, item.count); cancelDrag(); hooks.updateAllUI && hooks.updateAllUI(); }
}

export function bindGlobalPointerDrag() {
  window.addEventListener('pointermove', (e) => { if (dragState.active) moveDrag(e.clientX, e.clientY); });
  window.addEventListener('pointerup', (e) => {
    if (!dragState.active) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = target ? target.closest('[data-drop-zone]') : null;
    if (!slotEl) { returnDragItem(); return; }
    const zone = slotEl.dataset.dropZone, idx = slotEl.dataset.dropIdx;
    if (zone === 'furnace') dropToFurnace(idx);
    else dropAt(zone, parseInt(idx, 10));
  });
  window.addEventListener('pointercancel', returnDragItem);
}

/* ============ 掉落物 ============ */
export const droppedItems = new Map();
const DROP_LIFETIME = 180;
const DROP_GEO = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const DROP_COLORS = {
  wood: 0x8a5a2b, stone: 0x8d8d99, planks: 0xc49a6c, sticks: 0xa97445,
  stonebrick: 0x8d8d99, iron: 0xc07840, coal: 0x25252a, iron_ingot: 0xc8cdd4,
  berries: 0xc62a4a, fish: 0x5fb8d8, cooked_fish: 0xd89560,
  raw_pork: 0xf5a8b0, cooked_pork: 0xc08858,
  furnace: 0x5a5a64, smoker: 0x8a5a2b, torch: 0xffbb44, bridge: 0xa97445,
  fence: 0x6b4423, fence_gate: 0x6b4423, chest: 0xa97445, campfire: 0xff8844,
  stone_wall: 0x8d8d99, lantern: 0xffdd77,
  wood_axe: 0xc49a6c, wood_pickaxe: 0xc49a6c,
  axe: 0xb8c0c8, pickaxe: 0xb8c0c8, iron_axe: 0xd8dde3, iron_pickaxe: 0xd8dde3,
  wood_sword: 0xc49a6c, stone_sword: 0xb8c0c8, iron_sword: 0xd8dde3,
  fishing_rod: 0xa97445, crystal: 0x7dd8f0,
};
const dropMatCache = new Map();
function getDropMat(type) {
  if (!dropMatCache.has(type)) {
    const c = DROP_COLORS[type] !== undefined ? DROP_COLORS[type] : 0xcccccc;
    dropMatCache.set(type, new THREE.MeshLambertMaterial({ color: c }));
  }
  return dropMatCache.get(type);
}
export function createDropMesh(type, x, z) {
  const m = new THREE.Mesh(DROP_GEO, getDropMat(type));
  m.position.set(x, 0.35, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function createDropLocal(x, z, type, count) {
  const key = x + ',' + z;
  const existing = droppedItems.get(key);
  if (existing) {
    if (existing.type === type) {
      existing.count += count;
      const scale = 1 + Math.min(1.2, (existing.count - 1) * 0.02);
      existing.mesh.scale.setScalar(scale);
    }
    return;
  }
  const mesh = createDropMesh(type, x, z);
  scene.add(mesh);
  droppedItems.set(key, { type, count, mesh, bornAt: performance.now() });
}
export function dropSelectedItem(ctx) {
  const sel = getSelectedItem();
  if (!sel || sel.count <= 0) { toast(t('nothingToDrop')); return; }
  const dx = -Math.round(Math.sin(player.targetRot));
  const dz = -Math.round(Math.cos(player.targetRot));
  const tx = player.gridX + dx, tz = player.gridZ + dz;
  const key = tx + ',' + tz;
  if (hasBuilding(key)) { toast(t('cannotDropHere')); return; }
  const dropCount = sel.count, dropType = sel.type;
  const existing = droppedItems.get(key);
  if (existing) {
    if (existing.type === dropType) {
      existing.count += dropCount; existing.bornAt = performance.now();
      const scale = 1 + Math.min(1.2, (existing.count - 1) * 0.02);
      existing.mesh.scale.setScalar(scale);
      hotbar[selectedSlot] = null;
      if (ctx.netMode === 'host') ctx.broadcast({ type: 'itemDropped', x: tx, z: tz, itemType: dropType, count: dropCount });
      else if (ctx.netMode === 'client') ctx.sendToHost({ type: 'intent', action: 'drop', x: tx, z: tz, itemType: dropType, count: dropCount });
      hooks.updateAllUI && hooks.updateAllUI();
      toast(t('droppedItem', { n: dropCount, t: t(dropType) }));
      return;
    }
    toast(t('dropTypeMismatch')); return;
  }
  const mesh = createDropMesh(dropType, tx, tz);
  scene.add(mesh);
  droppedItems.set(key, { type: dropType, count: dropCount, mesh, bornAt: performance.now() });
  hotbar[selectedSlot] = null;
  if (ctx.netMode === 'host') ctx.broadcast({ type: 'itemDropped', x: tx, z: tz, itemType: dropType, count: dropCount });
  else if (ctx.netMode === 'client') ctx.sendToHost({ type: 'intent', action: 'drop', x: tx, z: tz, itemType: dropType, count: dropCount });
  hooks.updateAllUI && hooks.updateAllUI();
  toast(t('droppedItem', { n: dropCount, t: t(dropType) }));
}
export function checkPickupAtPlayer(ctx) {
  const key = player.gridX + ',' + player.gridZ;
  const drop = droppedItems.get(key);
  if (!drop) return;
  addItem(drop.type, drop.count);
  scene.remove(drop.mesh); droppedItems.delete(key);
  if (ctx.netMode === 'host') ctx.broadcast({ type: 'itemPickedUp', x: player.gridX, z: player.gridZ });
  else if (ctx.netMode === 'client') ctx.sendToHost({ type: 'intent', action: 'pickup', x: player.gridX, z: player.gridZ });
  toast(t('pickedUp', { n: drop.count, t: t(drop.type) }));
  hooks.updateAllUI && hooks.updateAllUI();
}
export function updateDroppedItems(dt) {
  const now = performance.now();
  const tt = now * 0.002;
  let idx = 0;
  const expired = [];
  for (const [key, drop] of droppedItems) {
    if (now - drop.bornAt > DROP_LIFETIME * 1000) { expired.push(key); continue; }
    drop.mesh.rotation.y += dt * 1.8;
    drop.mesh.position.y = 0.35 + Math.sin(tt + idx * 1.7) * 0.06;
    idx++;
  }
  for (const key of expired) {
    const drop = droppedItems.get(key);
    scene.remove(drop.mesh); droppedItems.delete(key);
  }
}

/* ============ 合成 ============ */
export const RECIPES = [
  { id:'planks', icon:'planks', cost:{wood:1}, gain:{planks:2}, nameKey:'recipePlanks', category:'materials' },
  { id:'sticks', icon:'sticks', cost:{planks:1}, gain:{sticks:2}, nameKey:'recipeSticks', category:'materials' },
  { id:'stonebrick', icon:'stonebrick', cost:{stone:2}, gain:{stonebrick:1}, nameKey:'recipeStonebrick', category:'materials' },
  { id:'torch', icon:'torch', cost:{sticks:1,coal:1}, gain:{torch:4}, nameKey:'recipeTorch', tagKey:'tagTorch', category:'materials' },
  { id:'lantern', icon:'lantern', cost:{iron_ingot:1,torch:1}, gain:{lantern:1}, nameKey:'recipeLantern', tagKey:'tagLantern', category:'materials' },
  { id:'campfire', icon:'campfire', cost:{sticks:4,planks:2}, gain:{campfire:1}, nameKey:'recipeCampfire', tagKey:'tagCampfire', category:'buildings' },
  { id:'bridge', icon:'bridge', cost:{planks:2}, gain:{bridge:1}, nameKey:'recipeBridge', tagKey:'tagBridge', category:'buildings' },
  { id:'fence', icon:'fence', cost:{sticks:4}, gain:{fence:2}, nameKey:'recipeFence', tagKey:'tagFence', category:'buildings' },
  { id:'fence_gate', icon:'fence_gate', cost:{sticks:2,planks:1}, gain:{fence_gate:1}, nameKey:'recipeGate', tagKey:'tagGate', category:'buildings' },
  { id:'stone_wall', icon:'stone_wall', cost:{stonebrick:2,fence:1}, gain:{stone_wall:1}, nameKey:'recipeStoneWall', tagKey:'tagStoneWall', category:'buildings' },
  { id:'chest', icon:'chest', cost:{planks:4}, gain:{chest:1}, nameKey:'recipeChest', tagKey:'tagChest', category:'buildings' },
  { id:'furnace', icon:'furnace', cost:{stone:6}, gain:{furnace:1}, nameKey:'recipeFurnace', tagKey:'tagFurnace', category:'buildings' },
  { id:'smoker', icon:'smoker', cost:{stone:4,sticks:2}, gain:{smoker:1}, nameKey:'recipeSmoker', tagKey:'tagSmoker', category:'buildings' },
  { id:'crystal', icon:'crystal', cost:{planks:4,stonebrick:3,iron_ingot:2}, gain:{crystal:1}, nameKey:'recipeCrystal', unique:true, tagKey:'tagCrystal', category:'buildings' },
  { id:'wood_axe', icon:'wood_axe', cost:{sticks:2,planks:2}, gain:{wood_axe:1}, nameKey:'recipeWoodAxe', tagKey:'tagWoodAxe', category:'tools' },
  { id:'wood_pickaxe', icon:'wood_pickaxe', cost:{sticks:2,planks:3}, gain:{wood_pickaxe:1}, nameKey:'recipeWoodPick', tagKey:'tagWoodPick', category:'tools' },
  { id:'wood_sword', icon:'wood_sword', cost:{sticks:2,planks:2}, gain:{wood_sword:1}, nameKey:'recipeWoodSword', tagKey:'tagWoodSword', category:'tools' },
  { id:'axe', icon:'axe', cost:{sticks:2,stone:1}, gain:{axe:1}, nameKey:'recipeAxe', tagKey:'tagAxe', category:'tools' },
  { id:'pickaxe', icon:'pickaxe', cost:{sticks:2,stone:2}, gain:{pickaxe:1}, nameKey:'recipePickaxe', tagKey:'tagPick', category:'tools' },
  { id:'stone_sword', icon:'stone_sword', cost:{sticks:2,stone:2}, gain:{stone_sword:1}, nameKey:'recipeStoneSword', tagKey:'tagStoneSword', category:'tools' },
  { id:'iron_axe', icon:'iron_axe', cost:{sticks:2,iron_ingot:3}, gain:{iron_axe:1}, nameKey:'recipeIronAxe', tagKey:'tagIronAxe', category:'tools' },
  { id:'iron_pickaxe', icon:'iron_pickaxe', cost:{sticks:2,iron_ingot:3}, gain:{iron_pickaxe:1}, nameKey:'recipeIronPick', tagKey:'tagIronPick', category:'tools' },
  { id:'iron_sword', icon:'iron_sword', cost:{sticks:2,iron_ingot:3}, gain:{iron_sword:1}, nameKey:'recipeIronSword', tagKey:'tagIronSword', category:'tools' },
  { id:'fishing_rod', icon:'fishing_rod', cost:{sticks:3,iron_ingot:1}, gain:{fishing_rod:1}, nameKey:'recipeFishingRod', tagKey:'tagFishingRod', category:'tools' },
];
export let currentCraftTab = 'tools';
export function setCurrentCraftTab(v) { currentCraftTab = v; }
function costString(cost) { return Object.entries(cost).map(([k, v]) => `${t(k)}:${v}`).join('  '); }
export function renderCraft() {
  const recipesEl = document.getElementById('recipes');
  if (!recipesEl) return;
  recipesEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const r of RECIPES) {
    if (r.category !== currentCraftTab) continue;
    let owned = false;
    if (r.unique) {
      if (r.id === 'crystal') owned = (countItem('crystal') > 0);
      else owned = countItem(r.id) > 0;
    }
    const can = !owned && Object.entries(r.cost).every(([k, v]) => countItem(k) >= v);
    const d = document.createElement('div');
    d.className = 'recipe' + (can ? ' can' : '') + (owned ? ' owned' : '');
    const sub = owned ? t('owned') : ((r.tagKey ? t(r.tagKey) + ' · ' : '') + costString(r.cost));
    d.innerHTML = `<span class="ic">${svgIcon(r.icon, 20)}</span>
      <span class="info"><div class="nm">${t(r.nameKey)}</div><div class="cost">${sub}</div></span>`;
    if (can) d.addEventListener('click', () => craft(r));
    frag.appendChild(d);
  }
  recipesEl.appendChild(frag);
}
export function craft(recipe) {
  if (recipe.unique) {
    if (recipe.id === 'crystal' && countItem('crystal') > 0) return;
    if (recipe.id !== 'crystal' && countItem(recipe.id) > 0) return;
  }
  for (const [k, v] of Object.entries(recipe.cost)) { if (countItem(k) < v) return; }
  for (const [k, v] of Object.entries(recipe.cost)) removeItem(k, v);
  for (const [k, v] of Object.entries(recipe.gain)) addItem(k, v);
  hooks.updateAllUI && hooks.updateAllUI();
}