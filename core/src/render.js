import * as THREE from 'three';
import { CAM_HEIGHT, BASE_VIEW, getCameraOffsetVec, getMoveDir as coreGetMoveDir } from './core.js';

const isMobile = window.matchMedia('(pointer: coarse)').matches;

export const renderer = new THREE.WebGLRenderer({
  antialias: false, powerPreference: 'high-performance', stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.0 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.sortObjects = false;
document.body.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ed9f5);

export const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

export const hemi = new THREE.HemisphereLight(0xcce8ff, 0x556b4a, 1.05);
scene.add(hemi);

export const sun = new THREE.DirectionalLight(0xfff4e0, 1.15);
sun.castShadow = true;
const SHADOW_SIZE = isMobile ? 256 : 512;
sun.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE);
const sc = sun.shadow.camera;
sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9;
sc.near = 1; sc.far = 60;
sun.shadow.bias = -0.0015;
sun.shadow.normalBias = 0.05;
scene.add(sun);
scene.add(sun.target);

/* ============ 光照池 ============ */
export const MAX_LIGHT_SLOTS = 4;
export const lightPool = [];
for (let i = 0; i < MAX_LIGHT_SLOTS; i++) {
  const light = new THREE.PointLight(0xffaa44, 0, 14, 0);
  light.position.y = 0.7;
  scene.add(light);
  lightPool.push({ light, key: null, baseIntensity: 1.0 });
}
export const lightAssignState = { x: -9999, z: -9999 };

/* ============ 涟漪 ============ */
const RIPPLE_GEO = new THREE.RingGeometry(0.30, 0.44, 16);
const RIPPLE_COUNT = 12;
const ripples = [];
let rippleIdx = 0;
for (let i = 0; i < RIPPLE_COUNT; i++) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xbfeaff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
  });
  const m = new THREE.Mesh(RIPPLE_GEO, mat);
  m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 5;
  scene.add(m); ripples.push({ mesh: m, t: -1 });
}
export function spawnRipple(x, z) {
  const r = ripples[rippleIdx];
  rippleIdx = (rippleIdx + 1) % RIPPLE_COUNT;
  r.t = 0; r.mesh.visible = true;
  r.mesh.position.set(x, -0.38, z);
  r.mesh.scale.set(1, 1, 1); r.mesh.material.opacity = 0.7;
}
export function updateRipples(dt) {
  for (const r of ripples) {
    if (r.t < 0) continue;
    r.t += dt * 1.8;
    if (r.t >= 1) { r.t = -1; r.mesh.visible = false; r.mesh.material.opacity = 0; }
    else { const s = 1 + r.t * 2.6; r.mesh.scale.set(s, s, 1); r.mesh.material.opacity = 0.7 * (1 - r.t); }
  }
}

/* ============ 传送特效（池化） ============ */
const TELEPORT_GEO = new THREE.BoxGeometry(0.14, 0.14, 0.14);
const TELEPORT_MAT = new THREE.MeshBasicMaterial({ color: 0x7dd8f0, transparent: true, depthWrite: false });
const TELEPORT_PER_BURST = 16;
const TELEPORT_POOL_SIZE = 32;
const teleportPool = [];
for (let i = 0; i < TELEPORT_POOL_SIZE; i++) {
  const m = new THREE.Mesh(TELEPORT_GEO, TELEPORT_MAT.clone());
  m.visible = false;
  scene.add(m);
  teleportPool.push({ mesh: m, t: -1, vx: 0, vy: 0, vz: 0 });
}
let tpIdx = 0;
export function spawnTeleportBurst(x, y, z) {
  for (let i = 0; i < TELEPORT_PER_BURST; i++) {
    const p = teleportPool[tpIdx];
    tpIdx = (tpIdx + 1) % TELEPORT_POOL_SIZE;
    const angle = (i / TELEPORT_PER_BURST) * Math.PI * 2;
    const speed = 1.8 + Math.random() * 1.4;
    p.vx = Math.cos(angle) * speed;
    p.vy = 2.0 + Math.random() * 1.5;
    p.vz = Math.sin(angle) * speed;
    p.mesh.position.set(x, y, z);
    p.mesh.scale.setScalar(1);
    p.mesh.material.opacity = 1;
    p.mesh.visible = true;
    p.t = 0;
  }
}
export function updateTeleportEffects(dt) {
  for (const p of teleportPool) {
    if (p.t < 0) continue;
    p.t += dt;
    if (p.t >= 0.9) { p.t = -1; p.mesh.visible = false; continue; }
    const life = 1 - p.t / 0.9;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy -= 4.5 * dt;
    p.mesh.material.opacity = life;
    p.mesh.scale.setScalar(life * 0.9 + 0.3);
  }
}

/* ============ 天气（减少粒子数） ============ */
const RAIN_COUNT = 120;
const SNOW_COUNT = 90;
const rainGeo = new THREE.BoxGeometry(0.12, 1.4, 0.12);
const rainMat = new THREE.MeshBasicMaterial({
  color: 0x99bbdd, transparent: true, opacity: 0.42, depthWrite: false,
});
const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, RAIN_COUNT);
rainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
rainMesh.frustumCulled = false; rainMesh.visible = false; rainMesh.renderOrder = 100;
scene.add(rainMesh);
const rainData = [];
const _dummy = new THREE.Object3D();
for (let i = 0; i < RAIN_COUNT; i++) {
  const r = { x: (Math.random() - 0.5) * 30, y: Math.random() * 14 - 2, z: (Math.random() - 0.5) * 30, vy: 22 + Math.random() * 8 };
  rainData.push(r); _dummy.position.set(r.x, r.y, r.z); _dummy.updateMatrix();
  rainMesh.setMatrixAt(i, _dummy.matrix);
}
rainMesh.instanceMatrix.needsUpdate = true;
const rainMatrixArray = rainMesh.instanceMatrix.array;

let snowPoints = null, snowPositions = null, snowVel = null;
function initSnow() {
  snowPositions = new Float32Array(SNOW_COUNT * 3);
  snowVel = new Float32Array(SNOW_COUNT);
  for (let i = 0; i < SNOW_COUNT; i++) {
    snowPositions[i*3] = (Math.random() - 0.5) * 30;
    snowPositions[i*3+1] = Math.random() * 14 - 2;
    snowPositions[i*3+2] = (Math.random() - 0.5) * 30;
    snowVel[i] = 1.5 + Math.random() * 1.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  snowPoints = new THREE.Points(geo, mat);
  snowPoints.frustumCulled = false; snowPoints.visible = false; snowPoints.renderOrder = 100;
  scene.add(snowPoints);
}
initSnow();

export const weather = { type: 'clear', intensity: 0, timer: 0, nextChange: 15 };
const weatherTagEl = document.getElementById('weatherTag');
let lastWeatherTagText = '';

export function getSnowRatio(px, pz, getBiome) {
  let snow = 0, total = 0;
  const R = 6;
  for (let dx = -R; dx <= R; dx++)
    for (let dz = -R; dz <= R; dz++) { total++; if (getBiome(px + dx, pz + dz) === 'snow') snow++; }
  return snow / total;
}
function updateRainFast(dt, px, pz) {
  const arr = rainMatrixArray;
  for (let i = 0; i < RAIN_COUNT; i++) {
    const r = rainData[i];
    r.y -= r.vy * dt;
    if (r.y < -2 || r.x < px - 15 || r.x > px + 15 || r.z < pz - 15 || r.z > pz + 15) {
      r.x = px + (Math.random() - 0.5) * 30; r.y = 10 + Math.random() * 6; r.z = pz + (Math.random() - 0.5) * 30;
    }
    const off = i * 16;
    arr[off + 12] = r.x; arr[off + 13] = r.y; arr[off + 14] = r.z;
  }
  rainMesh.instanceMatrix.needsUpdate = true;
}
function updateSnowFast(dt, px, pz) {
  const now = performance.now();
  for (let i = 0; i < SNOW_COUNT; i++) {
    const ix = i * 3;
    snowPositions[ix + 1] -= snowVel[i] * dt;
    snowPositions[ix] += Math.sin(now * 0.0012 + i * 1.3) * dt * 1.2;
    snowPositions[ix + 2] += Math.cos(now * 0.0011 + i * 0.7) * dt * 1.2;
    if (snowPositions[ix + 1] < -2 || snowPositions[ix] < px - 15 || snowPositions[ix] > px + 15 ||
        snowPositions[ix + 2] < pz - 15 || snowPositions[ix + 2] > pz + 15) {
      snowPositions[ix] = px + (Math.random() - 0.5) * 30;
      snowPositions[ix + 1] = 10 + Math.random() * 6;
      snowPositions[ix + 2] = pz + (Math.random() - 0.5) * 30;
    }
  }
  snowPoints.geometry.attributes.position.needsUpdate = true;
}
export function updateWeather(dt, playerMesh, getBiome, toast, t) {
  weather.timer += dt;
  if (weather.timer > weather.nextChange) {
    weather.timer = 0; weather.nextChange = 25 + Math.random() * 45;
    const r = Math.random();
    const prevType = weather.type;
    if (r < 0.55) weather.type = 'clear';
    else weather.type = getSnowRatio(playerMesh.position.x, playerMesh.position.z, getBiome) > 0.7 ? 'snow' : 'rain';
    if (weather.type !== prevType && weather.type !== 'clear') {
      toast(weather.type === 'rain' ? t('weatherRain') : t('weatherSnow'));
    }
  }
  const target = weather.type === 'clear' ? 0 : 1;
  weather.intensity += (target - weather.intensity) * Math.min(1, dt * 2.5);
  const intensity = Math.min(1, weather.intensity);
  if (intensity < 0.001) {
    if (rainMesh.visible) rainMesh.visible = false;
    if (snowPoints.visible) snowPoints.visible = false;
    if (weatherTagEl.classList.contains('on')) weatherTagEl.classList.remove('on');
    lastWeatherTagText = '';
    return;
  }
  const px = playerMesh.position.x, pz = playerMesh.position.z;
  const tagText = weather.type === 'rain' ? t('weatherRain') : t('weatherSnow');
  if (tagText !== lastWeatherTagText) {
    weatherTagEl.textContent = tagText; lastWeatherTagText = tagText;
    if (!weatherTagEl.classList.contains('on')) weatherTagEl.classList.add('on');
  }
  if (weather.type === 'rain') {
    if (!rainMesh.visible) rainMesh.visible = true;
    if (snowPoints.visible) snowPoints.visible = false;
    rainMat.opacity = 0.42 * intensity;
    updateRainFast(dt, px, pz);
  } else if (weather.type === 'snow') {
    if (!snowPoints.visible) snowPoints.visible = true;
    if (rainMesh.visible) rainMesh.visible = false;
    snowPoints.material.opacity = intensity;
    updateSnowFast(dt, px, pz);
  } else {
    if (rainMesh.visible) { rainMat.opacity = 0.42 * intensity; updateRainFast(dt, px, pz); }
    if (snowPoints.visible) { snowPoints.material.opacity = intensity; updateSnowFast(dt, px, pz); }
  }
}

/* ============ 昼夜 ============ */
export const timeState = { timeOfDay: 0.30, campfireTransition: null };
const SKY_DAY = new THREE.Color(0x9ed9f5);
const SKY_DUSK = new THREE.Color(0xa86040);
const SKY_NIGHT = new THREE.Color(0x03060f);
const SKY_RAIN = new THREE.Color(0x556677);
const SKY_SNOW = new THREE.Color(0x8899aa);
const _skyColor = new THREE.Color();
const SUN_DAY = new THREE.Color(0xfff4e0);
const SUN_NIGHT = new THREE.Color(0x405878);

export function updateDayNight(dt, playerMesh) {
  if (timeState.campfireTransition) {
    timeState.campfireTransition.elapsed += dt;
    if (timeState.campfireTransition.elapsed >= timeState.campfireTransition.duration) {
      timeState.timeOfDay = 0.27;
      timeState.campfireTransition = null;
    } else {
      const speed = timeState.campfireTransition.distance / timeState.campfireTransition.duration;
      timeState.timeOfDay = (timeState.timeOfDay + speed * dt) % 1;
    }
  } else {
    timeState.timeOfDay = (timeState.timeOfDay + dt / 300) % 1;
  }
  const sunAngle = (timeState.timeOfDay - 0.25) * Math.PI * 2;
  const sunHeight = Math.sin(sunAngle);
  let clamped = sunHeight * 5 + 0.5;
  if (clamped < 0) clamped = 0; else if (clamped > 1) clamped = 1;
  const dayAmount = clamped * clamped * (3 - 2 * clamped);
  const px = playerMesh.position.x, pz = playerMesh.position.z;
  sun.position.set(px + Math.cos(sunAngle) * 25, 8 + Math.max(0, sunHeight) * 22, pz + Math.sin(sunAngle) * 10 + 10);
  sun.target.position.set(px, 0, pz); sun.target.updateMatrixWorld();
  sun.intensity = 0.02 + dayAmount * 1.23;
  sun.color.copy(SUN_NIGHT).lerp(SUN_DAY, dayAmount);
  hemi.intensity = 0.04 + dayAmount * 1.01;
  if (dayAmount > 0.5) _skyColor.copy(SKY_DUSK).lerp(SKY_DAY, (dayAmount - 0.5) * 2);
  else _skyColor.copy(SKY_NIGHT).lerp(SKY_DUSK, dayAmount * 2);
  if (weather.intensity > 0.05) {
    if (weather.type === 'rain') _skyColor.lerp(SKY_RAIN, weather.intensity * 0.55 * (0.3 + dayAmount * 0.7));
    else if (weather.type === 'snow') _skyColor.lerp(SKY_SNOW, weather.intensity * 0.4 * (0.3 + dayAmount * 0.7));
  }
  scene.background.copy(_skyColor);
  const nightFactor = 1 - dayAmount;
  const torchIntensity = 0.9 + nightFactor * 1.6;
  for (const slot of lightPool) {
    if (slot.key) slot.light.intensity = slot.baseIntensity * torchIntensity;
    else slot.light.intensity = 0;
  }
}

/* ============ 相机 ============ */
export function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  const aspect = w / h;
  if (aspect >= 1) {
    camera.top = BASE_VIEW / 2; camera.bottom = -BASE_VIEW / 2;
    camera.left = -BASE_VIEW * aspect / 2; camera.right = BASE_VIEW * aspect / 2;
  } else {
    camera.left = -BASE_VIEW / 2; camera.right = BASE_VIEW / 2;
    camera.top = BASE_VIEW / aspect / 2; camera.bottom = -BASE_VIEW / aspect / 2;
  }
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
onResize();

export function updateCamera(playerMesh) {
  const off = getCameraOffsetVec();
  camera.position.set(playerMesh.position.x + off.x, CAM_HEIGHT, playerMesh.position.z + off.z);
  camera.lookAt(playerMesh.position.x, 0, playerMesh.position.z);
}