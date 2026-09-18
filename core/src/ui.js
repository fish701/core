import { t, toast, hooks, svgIcon, langState, STRINGS, svgIcon as svg } from './core.js';
import { HOTBAR_SIZE, INV_SIZE, CHEST_SIZE } from './core.js';
import { hotbar, inventory, FOOD, STACKABLE, PLACEABLE, PLACEABLE_KEY,
  getSelectedItem, setSelectedSlot, selectedSlot, getArr, addItem, removeItem,
  countItem, pickUpItem, pickUpFromFurnaceSlot, openChestKey, setOpenChestKey,
  openFurnaceKey, setOpenFurnaceKey, currentFurnaceStation, setCurrentFurnaceStation,
  chests, furnaces, smokers, dragState, returnDragItem } from './items.js';
import { healthState } from './actors.js';
import { crafting } from './items.js';
import { bridges, hasBridge } from './buildings.js';
import { chests as chestsMap, furnaces as furnacesMap, smokers as smokersMap } from './buildings.js';

/* ============ 元素缓存 ============ */
const E = {};
export function cacheElements() {
  E.hotbarEl = document.getElementById('hotbar');
  E.invPanel = document.getElementById('invPanel');
  E.invGrid = document.getElementById('invGrid');
  E.furnacePanel = document.getElementById('furnacePanel');
  E.chestPanel = document.getElementById('chestPanel');
  E.chestGrid = document.getElementById('chestGrid');
  E.dragGhost = document.getElementById('dragGhost');
  E.healthBarEl = document.getElementById('healthBar');
  E.hungerBarEl = document.getElementById('hungerBar');
  E.healthNumEl = document.getElementById('healthNum');
  E.hungerNumEl = document.getElementById('hungerNum');
  E.crystalTagEl = document.getElementById('crystalTag');
  E.placeHintEl = document.getElementById('placeHint');
  E.recipesEl = document.getElementById('recipes');
  E.toastsEl = document.getElementById('toasts');
}

export function updateStatsUI() {
  if (!E.healthBarEl) return;
  E.healthBarEl.style.width = Math.max(0, healthState.health) + '%';
  E.hungerBarEl.style.width = Math.max(0, healthState.hunger) + '%';
  E.healthNumEl.textContent = Math.max(0, Math.ceil(healthState.health));
  E.hungerNumEl.textContent = Math.max(0, Math.ceil(healthState.hunger));
}

/* ============ 槽位渲染 ============ */
function renderSlotEl(item, opts) {
  opts = opts || {};
  const el = document.createElement('div');
  el.className = 'slot' + (item ? ' filled' : '') + (opts.selected ? ' sel' : '');
  let inner = '';
  if (opts.num !== undefined) inner += `<span class="num">${opts.num}</span>`;
  if (item) inner += svgIcon(item.type, opts.iconSize || 20) + `<span class="ct">${item.count}</span>`;
  el.innerHTML = inner;
  return el;
}

export function updateHotbarUI() {
  if (!E.hotbarEl) return;
  E.hotbarEl.innerHTML = '';
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const el = renderSlotEl(hotbar[i], { selected: i === selectedSlot, num: i + 1 });
    el.dataset.dropZone = 'hotbar'; el.dataset.dropIdx = i;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault(); pickUpItem('hotbar', i, e.clientX, e.clientY);
    });
    el.addEventListener('click', () => {
      if (dragState.active || dragState.moved) return;
      selectSlot(i);
    });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); onHotbarSlotRightClick(i); });
    E.hotbarEl.appendChild(el);
  }
}
export function selectSlot(idx) {
  if (idx < 0 || idx >= HOTBAR_SIZE) return;
  setSelectedSlot(idx);
  updateHotbarUI(); updatePlaceHint();
}
function onHotbarSlotRightClick(i) {
  const item = hotbar[i]; if (!item) return;
  if (FOOD[item.type]) eatFood(i);
  else {
    const idx = inventory.findIndex(s => !s);
    if (idx >= 0) { inventory[idx] = item; hotbar[i] = null; updateAllUI(); }
  }
}
function eatFood(i) {
  const item = hotbar[i]; if (!item || !FOOD[item.type]) return;
  if (healthState.hunger >= 100) { toast(t('notHungry')); return; }
  const restore = FOOD[item.type];
  healthState.hunger = Math.min(100, healthState.hunger + restore);
  item.count -= 1;
  if (item.count <= 0) hotbar[i] = null;
  updateStatsUI(); updateAllUI();
  toast(t('ate', { n: t(item.type), v: restore }));
}
export function updateInvUI() {
  if (!E.invGrid) return;
  E.invGrid.innerHTML = '';
  for (let i = 0; i < INV_SIZE; i++) {
    const el = renderSlotEl(inventory[i], { iconSize: 22 });
    el.dataset.dropZone = 'inv'; el.dataset.dropIdx = i;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault(); pickUpItem('inv', i, e.clientX, e.clientY);
    });
    E.invGrid.appendChild(el);
  }
}
export function updateAllUI() {
  updateHotbarUI(); updateInvUI();
  hooks.renderCraft && hooks.renderCraft();
  if (openChestKey) renderChestUI();
  if (openFurnaceKey) updateFurnaceUI();
  updatePlaceHint();
  if (E.crystalTagEl) E.crystalTagEl.classList.toggle('on', !!window.__crystalKey);
}
export function updatePlaceHint() {
  if (!E.placeHintEl) return;
  const sel = getSelectedItem();
  if (!sel || !PLACEABLE.has(sel.type)) { E.placeHintEl.classList.remove('on'); return; }
  E.placeHintEl.textContent = t('canPlaceAt', { s: t(PLACEABLE_KEY[sel.type]) });
  E.placeHintEl.classList.add('on');
}

/* ============ 箱子 ============ */
export function openChest(key) {
  if (!chests.has(key)) return;
  setOpenChestKey(key);
  E.chestPanel.classList.add('show');
  renderChestUI(); updateInvUI(); updateHotbarUI();
}
export function closeChest() {
  if (dragState.active && dragState.from === 'chest') returnDragItem();
  setOpenChestKey(null);
  E.chestPanel.classList.remove('show');
}
export function renderChestUI() {
  if (!openChestKey) return;
  const c = chests.get(openChestKey); if (!c) return;
  E.chestGrid.innerHTML = '';
  for (let i = 0; i < CHEST_SIZE; i++) {
    const el = renderSlotEl(c.slots[i], { iconSize: 22 });
    el.dataset.dropZone = 'chest'; el.dataset.dropIdx = i;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault(); pickUpItem('chest', i, e.clientX, e.clientY);
    });
    E.chestGrid.appendChild(el);
  }
}

/* ============ 熔炉 / 烟熏炉 ============ */
export function openFurnace(key, station) {
  setCurrentFurnaceStation(station || 'furnace');
  const map = currentFurnaceStation === 'smoker' ? smokers : furnaces;
  if (!map.has(key)) return;
  setOpenFurnaceKey(key);
  document.querySelector('#furnacePanel .panel-title').textContent =
    currentFurnaceStation === 'smoker' ? t('smoker') : t('furnace');
  document.getElementById('furnaceTipText').textContent =
    currentFurnaceStation === 'smoker' ? t('smokerTip') : t('furnaceTip');
  E.furnacePanel.classList.add('show');
  updateFurnaceUI(); updateInvUI();
}
export function closeFurnace() {
  if (dragState.active && dragState.from === 'furnace') returnDragItem();
  setOpenFurnaceKey(null);
  E.furnacePanel.classList.remove('show');
}
export function updateFurnaceUI() {
  if (!openFurnaceKey) return;
  const map = currentFurnaceStation === 'smoker' ? smokers : furnaces;
  const f = map.get(openFurnaceKey); if (!f || !f.data) return;
  const d = f.data;
  const defaultInput = currentFurnaceStation === 'smoker' ? 'fish' : 'iron';
  const defaultOutput = currentFurnaceStation === 'smoker' ? 'cooked_fish' : 'iron_ingot';
  const inputIconName = d.inputType || defaultInput;
  const outputIconName = d.outputType || defaultOutput;
  document.getElementById('fInputIcon').innerHTML = d.input > 0 ? svgIcon(inputIconName, 22) : '';
  document.getElementById('fInputCount').textContent = d.input > 0 ? d.input : '';
  document.getElementById('fFuelIcon').innerHTML = d.fuel > 0 ? svgIcon('coal', 22) : '';
  document.getElementById('fFuelCount').textContent = d.fuel > 0 ? d.fuel : '';
  document.getElementById('fOutputIcon').innerHTML = d.output > 0 ? svgIcon(outputIconName, 22) : '';
  document.getElementById('fOutputCount').textContent = d.output > 0 ? d.output : '';
  document.getElementById('fProgress').style.width = (d.progress * 100) + '%';
  let inputName = currentFurnaceStation === 'smoker' ? t('fish') : t('ironOre');
  if (d.inputType === 'iron') inputName = t('ironOre');
  else if (d.inputType === 'fish') inputName = t('fish');
  else if (d.inputType === 'raw_pork') inputName = t('raw_pork');
  document.getElementById('fInputName').textContent = inputName;
  let outputName = currentFurnaceStation === 'smoker' ? t('cooked_fish') : t('ironIngot');
  if (d.outputType === 'iron_ingot') outputName = t('iron_ingot');
  else if (d.outputType === 'cooked_fish') outputName = t('cooked_fish');
  else if (d.outputType === 'cooked_pork') outputName = t('cooked_pork');
  document.getElementById('fOutputName').textContent = outputName;
}

/* ============ i18n 应用 ============ */
export function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (STRINGS[langState.current][key]) el.textContent = STRINGS[langState.current][key];
  });
  const langBtn = document.getElementById('langBtn');
  if (langBtn) langBtn.textContent = langState.current === 'zh' ? 'EN' : '中文';
  const mBtn = document.getElementById('menuLangBtn');
  if (mBtn) mBtn.textContent = langState.current === 'zh' ? '中文 / EN' : 'EN / 中文';
  document.documentElement.lang = langState.current === 'zh' ? 'zh-CN' : 'en';
  const ct = document.getElementById('crystalTag');
  if (ct) ct.textContent = langState.current === 'zh' ? '按 H 传送回水晶' : 'Press H to teleport';
  const b1 = document.getElementById('btnSingle'), b2 = document.getElementById('btnHost'),
        b3 = document.getElementById('btnJoinToggle'), b4 = document.getElementById('btnJoinGo'),
        ic = document.getElementById('joinCode'), ms = document.getElementById('menuSubtitle');
  if (b1) b1.textContent = langState.current === 'zh' ? '🎮 单机模式' : '🎮 Singleplayer';
  if (b2) b2.textContent = langState.current === 'zh' ? '🌐 创建房间' : '🌐 Create Room';
  if (b3) b3.textContent = langState.current === 'zh' ? '🔗 加入房间' : '🔗 Join Room';
  if (b4) b4.textContent = langState.current === 'zh' ? '连接' : 'Connect';
  if (ic) ic.placeholder = langState.current === 'zh' ? '房间码' : 'Room Code';
  if (ms) ms.textContent = t('menuSubtitle');
  const tTools = document.getElementById('tabTools'), tB = document.getElementById('tabBuildings'), tM = document.getElementById('tabMaterials');
  if (tTools) tTools.textContent = t('tabTools');
  if (tB) tB.textContent = t('tabBuildings');
  if (tM) tM.textContent = t('tabMaterials');
  const fp = document.querySelector('#furnacePanel .panel-title');
  if (fp) fp.textContent = currentFurnaceStation === 'smoker' ? t('smoker') : t('furnace');
  const ftt = document.getElementById('furnaceTipText');
  if (ftt) ftt.textContent = currentFurnaceStation === 'smoker' ? t('smokerTip') : t('furnaceTip');
  hooks.renderCraft && hooks.renderCraft();
  updatePlaceHint();
  hooks.updateSaveLoadButtons && hooks.updateSaveLoadButtons();
}