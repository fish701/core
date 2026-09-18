import * as THREE from 'three';

/* ============ 常量 ============ */
export const CHUNK = 8;
export const HOTBAR_SIZE = 9;
export const INV_SIZE = 36;
export const CHEST_SIZE = 18;
export const MAX_STACK = 50;
export const MOVE_TIME_LAND = 0.17;
export const MOVE_TIME_WATER = 0.30;
export const JUMP_H = 0.42;
export const SINK_DEPTH = 0.26;
export const BASE_VIEW = 12;
export const CAM_RADIUS = Math.sqrt(15 * 15 + 15 * 15);
export const CAM_HEIGHT = 17;
export const CAM_BASE_ANGLE = Math.PI / 4;
export const DAY_LENGTH = 300;
export const SAVE_KEY = 'isocore_save_v2';
export const SAVE_VERSION = 3;
export const SAVE_VERSION_MIN = 1;

export const GRID_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const TWO_PI = Math.PI * 2;
export const SCREEN_TARGETS = { right: 0, forward: Math.PI / 2, left: Math.PI, back: -Math.PI / 2 };

/* ============ Hooks（解决循环依赖） ============ */
export const hooks = {
  updateAllUI: null,
  updateStatsUI: null,
  updateHotbarUI: null,
  updateInvUI: null,
  renderChestUI: null,
  updateFurnaceUI: null,
  updatePlaceHint: null,
  selectSlot: null,
  eatFood: null,
  openFurnace: null,
  openChest: null,
  closeFurnace: null,
  closeChest: null,
  renderCraft: null,
  applyLang: null,
  toast: null,
};

/* ============ 国际化 ============ */
export const STRINGS = {
  zh: {
    health:'生命', hunger:'饥饿', craft:'合成台', inventory:'背包 (E 关闭)',
    swimming:'游泳中', hintMain:'WASD 移动 · 左右方向键旋转视角 · 1-9 快捷栏 · Q 丢物品 · E 背包 · H 传送回水晶 · 右键熔炉/箱子',
    furnace:'熔炉', smoker:'烟熏炉', ironOre:'铁矿石', coal:'煤', ironIngot:'铁锭', chest:'箱子',
    furnaceTip:'拖动左侧槽放入铁矿石 · 拖动中间放入煤 · 拖动右侧取出铁锭',
    smokerTip:'拖动左侧槽放入生鱼或生猪肉 · 拖动中间放入煤 · 拖动右侧取出熟食',
    crystalBuilt:'大地水晶已激活', crystalBuiltMsg:'你在这片随机生成的世界里建立了自己的核心',
    starved:'你饿倒了', starvedMsg:'下一次记得多采集一些浆果', restart:'再来一次',
    keepPlaying:'继续游戏', owned:'已拥有',
    saveBtn:'保存', loadBtn:'读取', saved:'游戏已保存', loaded:'游戏已读取',
    noSave:'没有找到存档', saveError:'保存失败', loadError:'读取失败', incompatible:'存档版本不兼容',
    cantSaveInMP:'多人游戏中无法保存', cantLoadInMP:'多人游戏中无法读取',
    tutorialBtn:'📖 教程', tutorialClose:'关闭', menuSubtitle:'像素沙盒建造',
    tabTools:'工具', tabBuildings:'建筑', tabMaterials:'材料',
    wood:'木材', stone:'石头', planks:'木板', sticks:'木棍', stonebrick:'石砖',
    iron:'铁矿石', coalItem:'煤炭', iron_ingot:'铁锭', berries:'浆果', furnaceItem:'熔炉', smokerItem:'烟熏炉',
    torch:'火把', bridge:'桥', fence:'栅栏', fence_gate:'栅栏门', chestItem:'箱子',
    campfire:'篝火', stone_wall:'石墙', lantern:'灯笼',
    axe:'石斧', pickaxe:'石镐', iron_axe:'铁斧', iron_pickaxe:'铁镐', crystal:'大地水晶',
    wood_axe:'木斧', wood_pickaxe:'木镐', wood_sword:'木剑', stone_sword:'石剑', iron_sword:'铁剑',
    fishing_rod:'钓鱼竿', fish:'生鱼', cooked_fish:'烤鱼', raw_pork:'生猪排', cooked_pork:'熟猪排',
    recipePlanks:'木板 x2', recipeSticks:'木棍', recipeStonebrick:'石砖', recipeTorch:'火把 x4',
    recipeBridge:'桥', recipeFence:'栅栏 x2', recipeGate:'栅栏门', recipeChest:'箱子',
    recipeFurnace:'熔炉', recipeSmoker:'烟熏炉', recipeWoodAxe:'木斧', recipeWoodPick:'木镐',
    recipeAxe:'石斧', recipePickaxe:'石镐', recipeIronAxe:'铁斧', recipeIronPick:'铁镐',
    recipeCrystal:'大地水晶', recipeFishingRod:'钓鱼竿', recipeCampfire:'篝火',
    recipeWoodSword:'木剑', recipeStoneSword:'石剑', recipeIronSword:'铁剑',
    recipeStoneWall:'石墙', recipeLantern:'灯笼',
    tagTorch:'夜晚提供光照', tagBridge:'放置在水面上', tagFence:'阻挡通行（可被僵尸破坏）',
    tagGate:'点击开关（可被僵尸破坏）', tagChest:'右键打开存储（可被僵尸破坏）',
    tagFurnace:'右键熔炼矿石（可被僵尸破坏）', tagSmoker:'右键熏烤食物（可被僵尸破坏）',
    tagCampfire:'右键快速度过夜晚（可被僵尸破坏）',
    tagWoodAxe:'选中时砍树', tagWoodPick:'采集石头与煤炭',
    tagAxe:'选中时砍树 +100%', tagPick:'选中时挖矿 +100%',
    tagIronAxe:'选中时砍树 +200%', tagIronPick:'选中时挖矿 +200%',
    tagWoodSword:'伤害 2', tagStoneSword:'伤害 4', tagIronSword:'伤害 6',
    tagStoneWall:'僵尸无法破坏', tagLantern:'可放地面/桥上/石墙上',
    tagCrystal:'放置后按 H 传送', tagFishingRod:'面向水面按方向键钓鱼',
    needHits:'还需敲击 {n} 次', tooFull:'背包已满', notHungry:'并不饿',
    ate:'吃下{n} +{v} 饱食度', gotWood:'+{n} 木材', gotStone:'+{n} 石头',
    gotIron:'+{n} 铁矿石', gotCoal:'+{n} 煤炭', gotBerries:'+{n} 浆果', gotStick:'+1 木棍', gotPork:'+{n} 生猪排',
    placedFurnace:'熔炉已放置（右键使用）', placedSmoker:'烟熏炉已放置（右键使用）',
    placedTorch:'火把已放置', placedBridge:'桥已放置',
    placedFence:'栅栏已放置（僵尸可以破坏）', placedGate:'栅栏门已放置（点击开关）',
    placedChest:'箱子已放置（右键使用）', placedCrystal:'大地水晶已放置，按 H 传送回来',
    placedCampfire:'篝火已放置（右键快速度过夜晚）', placedStoneWall:'石墙已放置（僵尸无法破坏）',
    placedLantern:'灯笼已放置',
    recovered:'回收了 {s}', cannotWater:'不能放在水里', occupied:'这里被占用了',
    bridgeWaterOnly:'桥只能放在水面上', canPlaceAt:'点击放置{s}',
    gateOpen:'栅栏门打开', gateClose:'栅栏门关闭', noIron:'没有铁矿石', noCoal:'没有煤',
    inputFull:'输入槽已满', fuelFull:'燃料槽已满', noIngot:'没有成品',
    tookItem:'取出 {n} 个', selfBlock:'不能放在自己脚下',
    waterIn:'进入水中，可以游泳了', weatherRain:'开始下雨了', weatherSnow:'开始下雪了',
    needWater:'需要面向水面', waitFish:'再等等…', fishFail:'什么也没钓到',
    gotFish:'+{n} 生鱼', noInput:'没有可加工的物品',
    needWoodPick:'需要木质镐', needStonePick:'需要石质镐',
    wrongType:'类型不匹配', slotFull:'槽位已满',
    droppedItem:'丢出 {n} 个 {t}', cannotDropHere:'前方格子被建筑占用',
    pickedUp:'捡起了 {n} 个 {t}', nothingToDrop:'没有可丢的物品', dropTypeMismatch:'地面上是另一种物品',
    teleported:'已传送回水晶', noCrystal:'还没有放置水晶', noSpace:'水晶周围没有空间',
    crystalOccupied:'水晶只能放置一个',
    connecting:'连接中...', connected:'已连接', hostReady:'房间已创建',
    connFail:'连接失败', hostLeft:'房主已离开', kicked:'你被移出房间',
    enterCode:'请输入6位房间码', invalidCode:'房间码无效', playerJoined:'玩家加入了',
    playerLeft:'玩家离开了', mpNotAvail:'联机功能不可用',
    zombieAttack:'僵尸攻击！', skippedNight:'篝火驱散了长夜', skippedNightFast:'黎明正在到来…',
    onlyDayCanSleep:'只有夜晚才能用篝火', killedZombie:'击杀僵尸', killedPig:'击杀猪',
    zombieBrokeBuilding:'僵尸破坏了 {s}', viewRotated:'视角已旋转',
    regenHealth:'饱食恢复中...', wrongStation:'这个设备无法加工该物品',
  },
  en: {
    health:'HP', hunger:'Food', craft:'Crafting', inventory:'Inventory (E)',
    swimming:'Swimming', hintMain:'WASD move · ←→ rotate view · 1-9 hotbar · Q drop · E inventory · H teleport · Right-click furnace/chest',
    furnace:'Furnace', smoker:'Smoker', ironOre:'Iron Ore', coal:'Coal', ironIngot:'Iron Ingot', chest:'Chest',
    furnaceTip:'Drag ore into left slot · coal into mid · take ingots from right',
    smokerTip:'Drag raw food into left slot · coal into mid · take cooked from right',
    crystalBuilt:'Earth Crystal Activated', crystalBuiltMsg:'You built your core in this randomly generated world',
    starved:'You Starved', starvedMsg:'Remember to collect more berries next time', restart:'Restart',
    keepPlaying:'Keep Playing', owned:'Owned',
    saveBtn:'Save', loadBtn:'Load', saved:'Game saved', loaded:'Game loaded',
    noSave:'No save found', saveError:'Save failed', loadError:'Load failed', incompatible:'Incompatible save version',
    cantSaveInMP:'Cannot save in multiplayer', cantLoadInMP:'Cannot load in multiplayer',
    tutorialBtn:'📖 Tutorial', tutorialClose:'Close', menuSubtitle:'Pixel Sandbox Builder',
    tabTools:'Tools', tabBuildings:'Buildings', tabMaterials:'Materials',
    wood:'Wood', stone:'Stone', planks:'Planks', sticks:'Sticks', stonebrick:'Stone Brick',
    iron:'Iron Ore', coalItem:'Coal', iron_ingot:'Iron Ingot', berries:'Berries', furnaceItem:'Furnace', smokerItem:'Smoker',
    torch:'Torch', bridge:'Bridge', fence:'Fence', fence_gate:'Fence Gate', chestItem:'Chest',
    campfire:'Campfire', stone_wall:'Stone Wall', lantern:'Lantern',
    axe:'Stone Axe', pickaxe:'Stone Pickaxe', iron_axe:'Iron Axe', iron_pickaxe:'Iron Pickaxe',
    crystal:'Earth Crystal', wood_axe:'Wood Axe', wood_pickaxe:'Wood Pickaxe',
    wood_sword:'Wood Sword', stone_sword:'Stone Sword', iron_sword:'Iron Sword',
    fishing_rod:'Fishing Rod', fish:'Raw Fish', cooked_fish:'Cooked Fish', raw_pork:'Raw Pork', cooked_pork:'Cooked Pork',
    recipePlanks:'Planks x2', recipeSticks:'Sticks', recipeStonebrick:'Stone Brick', recipeTorch:'Torch x4',
    recipeBridge:'Bridge', recipeFence:'Fence x2', recipeGate:'Fence Gate', recipeChest:'Chest',
    recipeFurnace:'Furnace', recipeSmoker:'Smoker', recipeWoodAxe:'Wood Axe', recipeWoodPick:'Wood Pickaxe',
    recipeAxe:'Stone Axe', recipePickaxe:'Stone Pickaxe', recipeIronAxe:'Iron Axe', recipeIronPick:'Iron Pickaxe',
    recipeCrystal:'Earth Crystal', recipeFishingRod:'Fishing Rod', recipeCampfire:'Campfire',
    recipeWoodSword:'Wood Sword', recipeStoneSword:'Stone Sword', recipeIronSword:'Iron Sword',
    recipeStoneWall:'Stone Wall', recipeLantern:'Lantern',
    tagTorch:'Lights up the night', tagBridge:'Place on water', tagFence:'Blocks passage (breakable)',
    tagGate:'Click to toggle (breakable)', tagChest:'Right-click to store (breakable)',
    tagFurnace:'Right-click to smelt ore (breakable)', tagSmoker:'Right-click to smoke food (breakable)',
    tagCampfire:'Right-click to skip night (breakable)',
    tagWoodAxe:'When held: chops wood', tagWoodPick:'Mines stone and coal',
    tagAxe:'When held: chop +100%', tagPick:'When held: mine +100%',
    tagIronAxe:'When held: chop +200%', tagIronPick:'When held: mine +200%',
    tagWoodSword:'Damage 2', tagStoneSword:'Damage 4', tagIronSword:'Damage 6',
    tagStoneWall:'Zombies cannot break', tagLantern:'Placeable on ground/bridge/wall',
    tagCrystal:'Place then press H', tagFishingRod:'Face water and press a direction',
    needHits:'{n} more hits', tooFull:'Inventory full', notHungry:'Not hungry',
    ate:'Ate {n} +{v} food', gotWood:'+{n} Wood', gotStone:'+{n} Stone',
    gotIron:'+{n} Iron Ore', gotCoal:'+{n} Coal', gotBerries:'+{n} Berries', gotStick:'+1 Stick', gotPork:'+{n} Raw Pork',
    placedFurnace:'Furnace placed (right-click to use)', placedSmoker:'Smoker placed (right-click to use)',
    placedTorch:'Torch placed', placedBridge:'Bridge placed',
    placedFence:'Fence placed (zombies can break)', placedGate:'Fence Gate placed (click to toggle)',
    placedChest:'Chest placed (right-click to use)', placedCrystal:'Earth Crystal placed, press H to teleport',
    placedCampfire:'Campfire placed (right-click to skip night)', placedStoneWall:'Stone Wall placed (zombies cannot break)',
    placedLantern:'Lantern placed',
    recovered:'Recovered {s}', cannotWater:'Cannot place in water', occupied:'Occupied',
    bridgeWaterOnly:'Bridge only on water', canPlaceAt:'Click to place {s}',
    gateOpen:'Gate opened', gateClose:'Gate closed', noIron:'No iron ore', noCoal:'No coal',
    inputFull:'Input slot full', fuelFull:'Fuel slot full', noIngot:'Nothing to take',
    tookItem:'Took {n}', selfBlock:'Cannot place under yourself',
    waterIn:'Entered water, you can swim', weatherRain:'It started raining', weatherSnow:'It started snowing',
    needWater:'Need to face water', waitFish:'Wait a moment...', fishFail:'Nothing caught',
    gotFish:'+{n} Raw Fish', noInput:'Nothing to process',
    needWoodPick:'Need a Wood Pickaxe', needStonePick:'Need a Stone Pickaxe',
    wrongType:'Type mismatch', slotFull:'Slot full',
    droppedItem:'Dropped {n} {t}', cannotDropHere:'Tile occupied by building',
    pickedUp:'Picked up {n} {t}', nothingToDrop:'Nothing to drop', dropTypeMismatch:'Different item on ground',
    teleported:'Teleported to crystal', noCrystal:'No crystal placed yet', noSpace:'No space around crystal',
    crystalOccupied:'Only one crystal allowed',
    connecting:'Connecting...', connected:'Connected', hostReady:'Room created',
    connFail:'Connection failed', hostLeft:'Host left', kicked:'You were removed',
    enterCode:'Enter the 6-digit room code', invalidCode:'Invalid room code', playerJoined:'Player joined',
    playerLeft:'Player left', mpNotAvail:'Multiplayer unavailable',
    zombieAttack:'Zombie attack!', skippedNight:'Campfire dispelled the long night', skippedNightFast:'Dawn is coming...',
    onlyDayCanSleep:'Campfire only at night', killedZombie:'Zombie killed', killedPig:'Pig killed',
    zombieBrokeBuilding:'Zombie broke {s}', viewRotated:'View rotated',
    regenHealth:'Recovering...', wrongStation:'This station cannot process that item',
  }
};

export const langState = { current: 'zh' };

export function t(key, vars) {
  let s = STRINGS[langState.current][key] || STRINGS.zh[key] || key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}

/* ============ 噪声 ============ */
export let WORLD_SEED = Math.random() * 100000;
export function setWorldSeed(s) { WORLD_SEED = s; }

export function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7 + WORLD_SEED) * 43758.5453123;
  return s - Math.floor(s);
}
export function smoothNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
export function fbm(x, y) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < 4; i++) { s += smoothNoise(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return s / norm;
}

/* ============ 工具 ============ */
export function addVertexColor(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i*3]=c.r; arr[i*3+1]=c.g; arr[i*3+2]=c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
export function normAngle(a) {
  a = a % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/* ============ SVG 图标 ============ */
const svgCache = new Map();
export function svgIcon(name, size) {
  size = size || 20;
  const key = name + ':' + size;
  if (svgCache.has(key)) return svgCache.get(key);
  const icons = {
    wood: `<rect x="4" y="7" width="16" height="10" rx="2" fill="#8a5a2b"/><ellipse cx="7" cy="12" rx="2.5" ry="5" fill="#a97445"/><ellipse cx="7" cy="12" rx="1.2" ry="2.6" fill="#7a4a20"/>`,
    stone: `<path d="M5 16 L7 9 L14 6 L19 10 L18 17 L10 19 Z" fill="#8d8d99"/><path d="M7 9 L14 6 L12 12 Z" fill="#a5a5b2"/>`,
    planks: `<rect x="3" y="7" width="18" height="10" rx="1" fill="#c49a6c"/><line x1="3" y1="12" x2="21" y2="12" stroke="#a87a4a" stroke-width="1.2"/><line x1="9" y1="7" x2="9" y2="12" stroke="#a87a4a" stroke-width="1.2"/>`,
    sticks: `<rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="#a97445" transform="rotate(18 12 12)"/>`,
    stonebrick: `<rect x="4" y="6" width="16" height="12" fill="#8d8d99"/><line x1="4" y1="12" x2="20" y2="12" stroke="#6a6a76" stroke-width="1.5"/><line x1="12" y1="6" x2="12" y2="12" stroke="#6a6a76" stroke-width="1.5"/><line x1="8" y1="12" x2="8" y2="18" stroke="#6a6a76" stroke-width="1.5"/>`,
    iron: `<path d="M5 16 L7 9 L14 6 L19 10 L18 17 L10 19 Z" fill="#8d8d99"/><circle cx="11" cy="12" r="1.8" fill="#e0925a"/><circle cx="15" cy="10.5" r="1.4" fill="#e0925a"/><circle cx="9" cy="15" r="1.3" fill="#e0925a"/>`,
    coal: `<path d="M5 16 L7 9 L14 6 L19 10 L18 17 L10 19 Z" fill="#70707a"/><circle cx="11" cy="12" r="1.8" fill="#25252a"/><circle cx="15" cy="10.5" r="1.4" fill="#25252a"/><circle cx="9" cy="15" r="1.3" fill="#25252a"/>`,
    iron_ingot: `<path d="M6 16 L8 9 L16 9 L18 16 Z" fill="#c8cdd4"/><path d="M8 9 L16 9 L15 11 L9 11 Z" fill="#eef2f6"/>`,
    berries: `<circle cx="9" cy="13" r="3.5" fill="#c62a4a"/><circle cx="15" cy="13" r="3.5" fill="#c62a4a"/><circle cx="12" cy="9" r="3.5" fill="#e84060"/><path d="M12 5 Q13 3 15 3" stroke="#3f9440" stroke-width="1.4" fill="none"/>`,
    fish: `<ellipse cx="12" cy="13" rx="7" ry="4" fill="#5fb8d8"/><path d="M5 13 L2 9 L2 17 Z" fill="#3f98b8"/><circle cx="16" cy="12" r="0.9" fill="#0a2a3a"/><path d="M10 10 Q12 8 14 10" stroke="#8fd8e8" stroke-width="1" fill="none"/>`,
    cooked_fish: `<ellipse cx="12" cy="13" rx="7" ry="4" fill="#d89560"/><path d="M5 13 L2 9 L2 17 Z" fill="#b87040"/><circle cx="16" cy="12" r="0.9" fill="#3a1a0a"/><path d="M8 10 L10 9 M12 9 L14 10" stroke="#7a3a10" stroke-width="1" fill="none"/>`,
    raw_pork: `<ellipse cx="12" cy="12" rx="8" ry="6" fill="#f5a8b0"/><ellipse cx="12" cy="12" rx="5" ry="3.5" fill="#ffd4d8"/><ellipse cx="10" cy="11" rx="1.5" ry="1" fill="#c25a68"/><ellipse cx="14" cy="13" rx="1.2" ry="0.9" fill="#c25a68"/>`,
    cooked_pork: `<ellipse cx="12" cy="12" rx="8" ry="6" fill="#c08858"/><ellipse cx="12" cy="12" rx="5" ry="3.5" fill="#e0b088"/><ellipse cx="10" cy="11" rx="1.5" ry="1" fill="#8a5a30"/><ellipse cx="14" cy="13" rx="1.2" ry="0.9" fill="#8a5a30"/>`,
    furnace: `<rect x="5" y="6" width="14" height="13" rx="1" fill="#5a5a64"/><rect x="8" y="11" width="8" height="6" rx="0.5" fill="#ff8a3d"/><rect x="9.5" y="12.5" width="5" height="3" fill="#ffd166"/>`,
    smoker: `<rect x="4" y="8" width="16" height="11" rx="1" fill="#8a5a2b"/><rect x="6" y="12" width="12" height="5" rx="0.5" fill="#5a3a1e"/><rect x="8" y="13" width="8" height="3" fill="#ff9a3d"/><rect x="9" y="4" width="6" height="4" rx="1" fill="#888888" opacity="0.6"/><rect x="10" y="1" width="4" height="3" fill="#999999" opacity="0.4"/>`,
    torch: `<rect x="11" y="10" width="2" height="11" rx="1" fill="#6b4423"/><rect x="9.5" y="5" width="5" height="5" rx="1" fill="#ffbb44"/><rect x="10.5" y="6" width="3" height="3" fill="#ffdd77"/>`,
    bridge: `<rect x="2" y="11" width="20" height="3" rx="0.5" fill="#a97445"/><line x1="4" y1="12.5" x2="20" y2="12.5" stroke="#7a4a20" stroke-width="1"/><line x1="6" y1="11" x2="18" y2="14" stroke="#7a4a20" stroke-width="0.8"/><line x1="6" y1="14" x2="18" y2="11" stroke="#7a4a20" stroke-width="0.8"/>`,
    fence: `<rect x="2" y="10" width="20" height="2" fill="#6b4423"/><rect x="2" y="15" width="20" height="2" fill="#6b4423"/><rect x="3" y="6" width="2.2" height="13" fill="#5a3a1e"/><rect x="8" y="6" width="2.2" height="13" fill="#5a3a1e"/><rect x="13.6" y="6" width="2.2" height="13" fill="#5a3a1e"/><rect x="19" y="6" width="2.2" height="13" fill="#5a3a1e"/>`,
    fence_gate: `<rect x="2" y="10" width="20" height="2" fill="#6b4423"/><rect x="2" y="15" width="20" height="2" fill="#6b4423"/><rect x="3" y="6" width="2.2" height="13" fill="#5a3a1e"/><rect x="19" y="6" width="2.2" height="13" fill="#5a3a1e"/><line x1="5.2" y1="15" x2="19" y2="10" stroke="#8a5a2b" stroke-width="1.4"/>`,
    chest: `<rect x="3" y="10" width="18" height="9" rx="1" fill="#a97445"/><rect x="3" y="10" width="18" height="3" fill="#8a5a2b"/><rect x="10.5" y="13" width="3" height="4" fill="#ffd166"/><circle cx="12" cy="15.5" r="1" fill="#5a3a1e"/>`,
    campfire: `<ellipse cx="12" cy="17" rx="9" ry="3" fill="#3a2a1a"/><rect x="6" y="15" width="12" height="2.4" rx="1" fill="#6b4423"/><path d="M12 5 Q14 9 13 11 Q12 12 11 11 Q10 9 12 5 Z" fill="#ff6b1a"/><path d="M12 7 Q13 9 12.5 11 Q12 11.5 11.5 11 Q11 9 12 7 Z" fill="#ffcc33"/>`,
    stone_wall: `<rect x="2" y="8" width="20" height="12" fill="#8d8d99"/><line x1="2" y1="12" x2="22" y2="12" stroke="#5a5a66" stroke-width="1.5"/><line x1="2" y1="16" x2="22" y2="16" stroke="#5a5a66" stroke-width="1.5"/><line x1="8" y1="8" x2="8" y2="12" stroke="#5a5a66" stroke-width="1.5"/><line x1="15" y1="8" x2="15" y2="12" stroke="#5a5a66" stroke-width="1.5"/><line x1="5" y1="12" x2="5" y2="16" stroke="#5a5a66" stroke-width="1.5"/><line x1="12" y1="12" x2="12" y2="16" stroke="#5a5a66" stroke-width="1.5"/><line x1="19" y1="12" x2="19" y2="16" stroke="#5a5a66" stroke-width="1.5"/>`,
    lantern: `<rect x="11.5" y="2" width="1" height="3" fill="#4a4a52"/><rect x="7" y="5" width="10" height="2" fill="#4a4a52"/><rect x="7" y="17" width="10" height="2" fill="#4a4a52"/><rect x="7.5" y="7" width="1.5" height="10" fill="#3a3a42"/><rect x="15" y="7" width="1.5" height="10" fill="#3a3a42"/><rect x="9" y="7" width="6" height="10" fill="#ffdd77"/><rect x="10" y="8.5" width="4" height="7" fill="#ffffcc"/>`,
    wood_axe: `<rect x="11" y="8" width="2.4" height="13" rx="1" fill="#8a5a2b"/><path d="M8 4.5 L15.5 4 L17 9.5 L9.5 11 Z" fill="#c49a6c"/>`,
    wood_pickaxe: `<rect x="11" y="8" width="2.4" height="13" rx="1" fill="#8a5a2b"/><path d="M5 8 Q12 3 19 8 L17 10 Q12 6 7 10 Z" fill="#c49a6c"/>`,
    axe: `<rect x="11" y="8" width="2.4" height="13" rx="1" fill="#a97445"/><path d="M8 4.5 L15.5 4 L17 9.5 L9.5 11 Z" fill="#b8c0c8"/>`,
    pickaxe: `<rect x="11" y="8" width="2.4" height="13" rx="1" fill="#a97445"/><path d="M5 8 Q12 3 19 8 L17 10 Q12 6 7 10 Z" fill="#b8c0c8"/>`,
    iron_axe: `<rect x="11" y="8" width="2.4" height="13" rx="1" fill="#a97445"/><path d="M8 4.5 L15.5 4 L17 9.5 L9.5 11 Z" fill="#d8dde3"/>`,
    iron_pickaxe: `<rect x="11" y="8" width="2.4" height="13" rx="1" fill="#a97445"/><path d="M5 8 Q12 3 19 8 L17 10 Q12 6 7 10 Z" fill="#d8dde3"/>`,
    wood_sword: `<rect x="11" y="11" width="2" height="9" fill="#8a5a2b"/><rect x="9" y="19" width="6" height="2" rx="1" fill="#5a3a1e"/><path d="M9.5 3 L14.5 3 L13.5 12 L10.5 12 Z" fill="#c49a6c"/>`,
    stone_sword: `<rect x="11" y="11" width="2" height="9" fill="#a97445"/><rect x="9" y="19" width="6" height="2" rx="1" fill="#5a3a1e"/><path d="M9.5 3 L14.5 3 L13.5 12 L10.5 12 Z" fill="#b8c0c8"/>`,
    iron_sword: `<rect x="11" y="11" width="2" height="9" fill="#a97445"/><rect x="9" y="19" width="6" height="2" rx="1" fill="#5a3a1e"/><path d="M9.5 3 L14.5 3 L13.5 12 L10.5 12 Z" fill="#d8dde3"/>`,
    fishing_rod: `<rect x="5" y="3" width="2" height="18" rx="1" fill="#a97445" transform="rotate(15 6 12)"/><path d="M7 4 Q14 6 19 14" stroke="#aaaaaa" stroke-width="0.7" fill="none"/><circle cx="19" cy="14" r="1.1" fill="#e84040"/>`,
    crystal: `<path d="M12 3 L19 10 L12 21 L5 10 Z" fill="#7dd8f0"/><path d="M12 3 L19 10 L12 10 Z" fill="#a8e8f8"/><path d="M5 10 L12 10 L12 21 Z" fill="#5ab8d8"/>`,
  };
  const s = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">${icons[name] || ''}</svg>`;
  svgCache.set(key, s);
  return s;
}

/* ============ Toast ============ */
export function toast(text) {
  const el = document.getElementById('toasts');
  if (!el) return;
  const n = document.createElement('div');
  n.className = 'toast'; n.textContent = text;
  el.appendChild(n);
  setTimeout(() => n.remove(), 1200);
}

/* ============ 相机旋转 / 移动方向 ============ */
export let cameraRotation = 0;
export function setCameraRotation(v) { cameraRotation = v; }

const moveDirCache = new Map();
function computeMoveDirs(rotation) {
  const angle = CAM_BASE_ANGLE + rotation * (Math.PI / 4);
  const sinA = Math.sin(angle), cosA = Math.cos(angle);
  const sr = [sinA, -cosA];
  const sf = [-cosA, -sinA];
  const result = {};
  for (const [screenDir, target] of Object.entries(SCREEN_TARGETS)) {
    let best = GRID_DIRS[0], bestScore = -Infinity;
    for (const d of GRID_DIRS) {
      const sx = d[0] * sr[0] + d[1] * sr[1];
      const sy = d[0] * sf[0] + d[1] * sf[1];
      const theta = Math.atan2(sy, sx);
      let cw = ((target - theta) % TWO_PI + TWO_PI) % TWO_PI;
      const delta = cw > Math.PI ? TWO_PI - cw : cw;
      const score = -delta * 1000 - cw;
      if (score > bestScore) { bestScore = score; best = d; }
    }
    result[screenDir] = best;
  }
  return result;
}
export function getMoveDir(screenDir) {
  let cached = moveDirCache.get(cameraRotation);
  if (!cached) { cached = computeMoveDirs(cameraRotation); moveDirCache.set(cameraRotation, cached); }
  return cached[screenDir];
}
export function getCameraOffsetVec() {
  const angle = CAM_BASE_ANGLE + cameraRotation * (Math.PI / 4);
  return { x: CAM_RADIUS * Math.cos(angle), z: CAM_RADIUS * Math.sin(angle) };
}