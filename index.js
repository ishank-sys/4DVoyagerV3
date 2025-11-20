import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Base URL for static assets stored in Vercel Blob storage.
// This is hard-coded to avoid any runtime env issues.
const BLOB_BASE_URL = 'https://phv9f2n767db5svp.public.blob.vercel-storage.com';

function buildBlobUrl(path) {
  const normalizedBase = BLOB_BASE_URL.replace(/\/+$/, '');
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
}

// === Scene, Camera, Renderer ===
const container = document.getElementById('viewer-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });

// === Optimized Renderer Setup ===
function setupRenderer() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);
}
setupRenderer();

// === Controls ===
let controls;
function setupControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.screenSpacePanning = false;
  controls.minDistance = 1;
  controls.maxDistance = 100;

  controls.addEventListener('start', () => renderer.setPixelRatio(1));
  controls.addEventListener('end', () => renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)));
}
setupControls();

// Allow adjusting the zoom target on LORRY by Ctrl+Clicking the model
renderer.domElement.addEventListener('pointerdown', (e) => {
  try {
    if (currentProject !== 'LORRY') return;
    if (!(e.ctrlKey || e.metaKey)) return; // require modifier to avoid accidental changes
    const visibleModel = loadedModels.find(m => m.visible);
    if (!visibleModel) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(visibleModel, true);
    if (!hits.length) return;
    const hitPoint = hits[0].point;
    // Maintain current camera offset from target, but move both to the hit point
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    controls.target.copy(hitPoint);
    camera.position.copy(hitPoint.clone().add(offset));
    camera.lookAt(controls.target);
    controls.update();
  } catch {}
});

// === Lighting ===
function setupLighting() {
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2.5);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
  dirLight.position.set(10, 10, 5);
  dirLight.castShadow = false;
  scene.add(dirLight);
}
setupLighting();

// === Scene Theme ===
function applySceneBackgroundForTheme() {
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  const color = theme === 'dark' ? new THREE.Color(0x000c27) : new THREE.Color(0xffffff);
  scene.background = color;
  renderer.setClearColor(color, 1);
}
applySceneBackgroundForTheme();
try {
  const themeObserver = new MutationObserver(() => applySceneBackgroundForTheme());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
} catch {}

// === Loaders ===
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
loader.setDRACOLoader(dracoLoader);

// === UI Elements ===
const slider = document.getElementById("model-slider");
const autoplayButton = document.getElementById("autoplay-button");
const rotateButton = document.getElementById("rotate-button");
const prevButton = document.getElementById("prev-button");
const nextButton = document.getElementById("next-button");
const modelNameDisplay = document.getElementById("model-name-display");
const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");
const progressTbody = document.getElementById("progress-tbody");

// === Variables ===
let loadedModels = [];
let autoplayTimer = null;
let currentModelIndex = 0;
let scheduleData = [];
let currentProject = null;
// Map timeline index -> cell element for highlight updates
let timelineCells = [];
// Array of timeline events built from schedule (fab/erec)
let timelineEvents = [];
let timelinePopupEl = document.getElementById('timeline-popup');
// Maps for filename-based navigation and highlight sync
let filenameToModelIndex = new Map();
let filenameToTimelineIndex = new Map();
// Model cache for faster repeated loads
const modelCache = new Map();
// No remote storage: we load models directly from per-project models.json files
// Track preloading queue
const preloadQueue = new Set();

// Track the current timeline position (bidirectional)
let currentTimelineIndex = Number.NaN;

// Normalize filenames between schedule entries and actual files
// Examples:
//  - "BSGSifc-114.glb" -> "ifc-114"
//  - "BSGSifc-35" -> "ifc-35"
//  - "ifc-35" -> "ifc-35"
//  - "BSGSifc.glb" -> "ifc"
function normalizeFileKey(name) {
  if (!name || typeof name !== 'string') return null;
  let base = name.split('/').pop().trim().toLowerCase();
  base = base.replace(/\.glb$/i, '');
  base = base.replace(/^bsgs/, ''); // strip project prefix if present
  return base; // e.g., "ifc-114" or "ifc"
}

let orbitState = {
  running: false,
  rafId: null,
  lastTime: 0,
  speed: 0,
  currentAngle: 0
};
// Raycasting helpers for interactive target picking
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Adjustable camera defaults for LORRY (can be tuned easily)
const LORRY_CAMERA_DEFAULTS = {
  elevationDeg: 40,    // restore the nice balanced top view
  azimuthDeg: 30,      // back to a slightly side angle
  distanceFactor: 0.00007, // zoomed in by 30% (was 0.01, now 0.007)
  minDistanceFactor: 0.000001,
  maxDistanceFactor: 0.00001,
  rotateYDeg: 90,      // keep orientation consistent
  targetX: 0,
  targetY: 120,
  targetZ: 0
};


function getLorryCameraConfig(urlParams) {
  const c = { ...LORRY_CAMERA_DEFAULTS };
  const elev = parseFloat(urlParams.get('l_elev'));
  const azim = parseFloat(urlParams.get('l_azim'));
  const dist = parseFloat(urlParams.get('l_dist'));
  const ry = parseFloat(urlParams.get('l_roty'));
  const tx = parseFloat(urlParams.get('l_tx'));
  const ty = parseFloat(urlParams.get('l_ty'));
  const tz = parseFloat(urlParams.get('l_tz'));
  if (!isNaN(elev)) c.elevationDeg = elev;
  if (!isNaN(azim)) c.azimuthDeg = azim;
  if (!isNaN(dist)) c.distanceFactor = dist;
  if (!isNaN(ry)) c.rotateYDeg = ry;
  if (!isNaN(tx)) c.targetX = tx;
  if (!isNaN(ty)) c.targetY = ty;
  if (!isNaN(tz)) c.targetZ = tz;
  return c;
}

// === FPS Optimization ===
let frameCount = 0, lastTime = performance.now(), avgFPS = 60;
function monitorPerformance() {
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    avgFPS = frameCount;
    frameCount = 0;
    lastTime = now;
    if (avgFPS < 30) renderer.setPixelRatio(1);
    else if (avgFPS > 55) renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  }
}

// === Model Optimization ===
function optimizeModel(model) {
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          if (mat.isMeshStandardMaterial) {
            mat.envMapIntensity = 0.5;
            mat.roughness = 0.7;
            mat.metalness = 0.1;
            mat.normalMap = mat.bumpMap = mat.displacementMap = null;
            mat.needsUpdate = true;
          }
        });
      }
    }
  });
}

// === Model Visibility / Autoplay ===
function updateModelVisibility(index) {
  loadedModels.forEach(m => m.visible = false);
  if (loadedModels[index]) {
    loadedModels[index].visible = true;
    modelNameDisplay.textContent = loadedModels[index].userData.originalName || `Model ${index + 1}`;
  }
}
// Unified helper: always load model at index (even when autoplay paused)
function showModelAt(rawIndex, fromAutoplay = false) {
  if (!loadedModels.length) return;
  const i = Math.max(0, Math.min(parseInt(rawIndex, 10) || 0, loadedModels.length - 1));
  if (!fromAutoplay) stopAutoplay();
  slider.value = String(i);
  updateModelVisibility(i);
  
  // Preload next/prev models in background
  preloadAdjacentModels(i);
  
  try {
    const name = loadedModels[i]?.userData?.originalName;
    const tIdx = filenameToTimelineIndex.get(normalizeFileKey(name));
    if (Number.isFinite(tIdx)) {
      currentTimelineIndex = tIdx;
      updateTimelineHighlight(tIdx);
    } else {
      if (Number.isFinite(currentTimelineIndex)) {
        updateTimelineHighlight(currentTimelineIndex);
      }
    }
  } catch {
    if (Number.isFinite(currentTimelineIndex)) {
      updateTimelineHighlight(currentTimelineIndex);
    }
  }
}

// Preload adjacent models for smoother navigation
function preloadAdjacentModels(currentIndex, names, base) {
  if (!names || !names.length || !base) return;
  const indicesToPreload = [
    currentIndex - 1,
    currentIndex + 1,
    currentIndex + 2
  ].filter(idx => idx >= 0 && idx < names.length);

  indicesToPreload.forEach(idx => {
    const name = names[idx];
    if (!name) return;
    const cacheKey = `${base}/${name}`;
    const url = buildBlobUrl(`${base}/${encodeURIComponent(name)}`);
    if (!modelCache.has(cacheKey) && !preloadQueue.has(cacheKey)) {
      preloadQueue.add(cacheKey);
      loader.loadAsync(url)
        .then(gltf => {
          modelCache.set(cacheKey, gltf);
          preloadQueue.delete(cacheKey);
        })
        .catch(() => preloadQueue.delete(cacheKey));
    }
  });
}
function stopAutoplay() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
    autoplayButton.textContent = "▶";
  }
}
function advanceSlider() {
  const maxVal = Math.max(0, loadedModels.length - 1);
  let nextVal = parseInt(slider.value) + 1;
  if (nextVal > maxVal) nextVal = 0;
  slider.value = nextVal;
  showModelAt(nextVal, true); // pass true to indicate this is from autoplay
}

// === Navigation Buttons ===
nextButton?.addEventListener("click", () => {
  stopAutoplay();
  advanceSlider();
});
prevButton?.addEventListener("click", () => {
  stopAutoplay();
  const maxVal = Math.max(0, loadedModels.length - 1);
  let prevVal = parseInt(slider.value) - 1;
  if (prevVal < 0) prevVal = maxVal;
  slider.value = prevVal;
  showModelAt(prevVal);
});

// === Autoplay ===
autoplayButton?.addEventListener("click", () => {
  if (autoplayButton.disabled) return;
  if (autoplayTimer) stopAutoplay();
  else {
    advanceSlider();
    autoplayTimer = setInterval(advanceSlider, 1500);
    autoplayButton.textContent = "❚❚";
  }
});

// === Slider direct interaction ===
if (slider) {
  slider.addEventListener('input', (e) => {
    showModelAt(e.target.value);
  });
  slider.addEventListener('change', (e) => {
    showModelAt(e.target.value);
  });
}

// === Rotation ===
rotateButton?.addEventListener("click", () => {
  if (orbitState.running) {
    orbitState.running = false;
    cancelAnimationFrame(orbitState.rafId);
    rotateButton.textContent = "⟳";
  } else {
    orbitState.running = true;
    orbitState.lastTime = performance.now();
    orbitState.speed = (Math.PI * 2) / 20000;
    rotateButton.textContent = "⏹";
    const rotateFrame = (now) => {
      if (!orbitState.running) return;
      const delta = now - orbitState.lastTime;
      orbitState.lastTime = now;
      orbitState.currentAngle += orbitState.speed * delta;
      loadedModels.forEach(m => { if (m) m.rotation.y = orbitState.currentAngle; });
      orbitState.rafId = requestAnimationFrame(rotateFrame);
    };
    orbitState.rafId = requestAnimationFrame(rotateFrame);
  }
});

// === Resize ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Load Models ===
async function loadAllModels() {
  loadingOverlay.classList.add("visible");
  try {
    const urlParams = new URLSearchParams(window.location.search);
    currentProject = (urlParams.get("project") || "BSGS").toUpperCase();
    const base = currentProject;
    
    // Map project codes to display names
    const projectDisplayNames = {
      '1': 'WRC',
      'WRC': 'Waste Management',
      'BSGS': 'BSGS',
      'CUP': 'CUP',
      'LORRY': 'LORRY'
    };
    
    const displayName = projectDisplayNames[currentProject] || currentProject;
    
    const manifestUrl = buildBlobUrl(`${base}/models.json`);

    const res = await fetch(manifestUrl, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Missing or invalid models.json in ${base}`);
    const names = await res.json();
    if (!Array.isArray(names) || names.length === 0) throw new Error(`models.json in ${base} is empty.`);

    loadedModels = [];

    // Load all models from local per-project manifest
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const url = buildBlobUrl(`${base}/${encodeURIComponent(name)}`);
      const cacheKey = `${base}/${name}`;
      
      try {
        loadingText.textContent = `Loading ${displayName} models... ${Math.round(((i + 1) / names.length) * 100)}%`;
        
        let gltf;
        if (modelCache.has(cacheKey)) {
          gltf = modelCache.get(cacheKey);
        } else {
          gltf = await loader.loadAsync(url);
          modelCache.set(cacheKey, gltf);
        }
        
        const model = gltf.scene;
        optimizeModel(model);
        model.userData.originalName = name;
        model.visible = false;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        
        if (currentProject === 'LORRY') {
          try {
            const urlParams = new URLSearchParams(window.location.search);
            const cfg = getLorryCameraConfig(urlParams);
            model.rotation.y += THREE.MathUtils.degToRad(cfg.rotateYDeg || 0);
          } catch {}
        }
        scene.add(model);
        loadedModels.push(model);
        
        const key = normalizeFileKey(name);
        if (key) filenameToModelIndex.set(key, loadedModels.length - 1);
        
        // Optionally preload next model in background
        if (i < names.length - 1) {
          preloadAdjacentModels(i, names, base);
        }
      } catch (err) {
        console.error(`[Loader] Failed to load ${url}:`, err);
      }
    }

    if (loadedModels.length > 0) {
      slider.max = loadedModels.length - 1;
      updateModelVisibility(0);
      const first = loadedModels[0];
      const box = new THREE.Box3().setFromObject(first);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      // Default camera for most projects
      camera.position.set(maxDim * 1.5, maxDim, maxDim * 1.5);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();

      // Apply LORRY-specific camera and control constraints (zoom-only, top-side)
      // Commented out to allow free camera movement for LORRY project
      
      if (currentProject === 'LORRY') {
        const urlParams = new URLSearchParams(window.location.search);
        const cfg = getLorryCameraConfig(urlParams);
        const elev = THREE.MathUtils.degToRad(cfg.elevationDeg);
        const azim = THREE.MathUtils.degToRad(cfg.azimuthDeg);
        const dist = Math.max(0.01, maxDim * cfg.distanceFactor);
        const y = dist * Math.sin(elev);
        const r = dist * Math.cos(elev);
        const x = r * Math.cos(azim);
        const z = r * Math.sin(azim);
          // Set adjustable target and position camera relative to it
          controls.target.set(cfg.targetX, cfg.targetY, cfg.targetZ);
          camera.position.set(cfg.targetX + x, cfg.targetY + y, cfg.targetZ + z);
          camera.lookAt(controls.target);
        // Lock controls to zoom only
        controls.enableRotate = false;
        controls.enablePan = false;
        controls.enableZoom = true;
        controls.enableKeys = false;
        controls.minDistance = Math.max(0.01, maxDim * cfg.minDistanceFactor);
        controls.maxDistance = Math.max(controls.minDistance + 0.01, maxDim * cfg.maxDistanceFactor);
        controls.update();
        // Disable rotate button controls for LORRY
        if (rotateButton) {
          rotateButton.disabled = true;
          if (orbitState.running) {
            orbitState.running = false;
            cancelAnimationFrame(orbitState.rafId);
          }
        }
      } else {
        // Ensure rotate button is enabled for non-LORRY projects
        if (rotateButton) rotateButton.disabled = false;
      }
      
      // Ensure rotate button is enabled for all projects
      if (rotateButton) rotateButton.disabled = false;

      autoplayButton.disabled = false;
      
      // Map project codes to display names
      const projectDisplayNames = {
        '1': 'WRC',
        'WRC': 'Waste Management',
        'BSGS': 'BSGS',
        'CUP': 'CUP',
        'LORRY': 'LORRY'
      };
      
      const displayName = projectDisplayNames[currentProject] || currentProject;
      loadingText.textContent = `${displayName} models loaded successfully`;

      // === NEW: Load corresponding schedule.json for this project ===
      await loadScheduleForProject(currentProject);
    } else {
      const projectDisplayNames = {
        '1': 'WRC',
        'WRC': 'Waste Management',
        'BSGS': 'BSGS',
        'CUP': 'CUP',
        'LORRY': 'LORRY'
      };
      const displayName = projectDisplayNames[currentProject] || currentProject;
      loadingText.textContent = `No models found for ${displayName}`;
    }
  } catch (err) {
    console.error("[Loader] Error:", err);
    loadingText.textContent = "Error loading models.";
  } finally {
    loadingOverlay.classList.remove("visible");
  }
}
loadAllModels();

async function loadScheduleForProject(project) {
  try {
    const scheduleUrl = buildBlobUrl(`${project}/schedule.json`);
    const res = await fetch(scheduleUrl, { cache: "no-cache" });
    if (!res.ok) throw new Error(`schedule.json missing for ${project}`);
    scheduleData = await res.json();

    // Build table from schedule.json
    progressTbody.innerHTML = "";
    timelineCells = []; // reset mapping
    timelineEvents = []; // reset events
    filenameToTimelineIndex = new Map(); // reset filename mapping for this project
    scheduleData.forEach((item, idx) => {
      const tr = document.createElement("tr");
      // map each member to two timeline indices (fab/erec)
      const fabIdx = idx * 2;
      const ercIdx = idx * 2 + 1;
      // Single file per date: prefer explicit 'file', else last of 'files'
      const fabFile = (item.fabricationCompletion && (item.fabricationCompletion.file || (Array.isArray(item.fabricationCompletion.files) ? item.fabricationCompletion.files[item.fabricationCompletion.files.length - 1] : null))) || null;
      const erecFile = (item.erectionCompletion && (item.erectionCompletion.file || (Array.isArray(item.erectionCompletion.files) ? item.erectionCompletion.files[item.erectionCompletion.files.length - 1] : null))) || null;
      const memberTd = document.createElement('td');
      memberTd.textContent = item.member;
      const fabTd = document.createElement('td');
      fabTd.className = 'clickable';
      fabTd.dataset.index = String(fabIdx);
      fabTd.dataset.date = item.fabricationCompletion.date;
      fabTd.dataset.type = 'fab';
      if (fabFile) fabTd.dataset.file = fabFile;
      fabTd.textContent = item.fabricationCompletion.date;
      const erecTd = document.createElement('td');
      erecTd.className = 'clickable';
      erecTd.dataset.index = String(ercIdx);
      erecTd.dataset.date = item.erectionCompletion.date;
      erecTd.dataset.type = 'erec';
      if (erecFile) erecTd.dataset.file = erecFile;
      erecTd.textContent = item.erectionCompletion.date;
      tr.appendChild(memberTd);
      tr.appendChild(fabTd);
      tr.appendChild(erecTd);
      timelineCells.push(fabTd, erecTd);
      // Build event objects (store note if available)
      timelineEvents.push({ index: fabIdx, date: item.fabricationCompletion.date, type: 'fab', note: item.fabricationCompletion.note || null, member: item.member, file: fabFile });
      timelineEvents.push({ index: ercIdx, date: item.erectionCompletion.date, type: 'erec', note: item.erectionCompletion.note || null, member: item.member, file: erecFile });
      if (fabFile) {
        const k = normalizeFileKey(fabFile);
        if (k) filenameToTimelineIndex.set(k, fabIdx);
      }
      if (erecFile) {
        const k = normalizeFileKey(erecFile);
        if (k) filenameToTimelineIndex.set(k, ercIdx);
      }
      progressTbody.appendChild(tr);
    });

    buildTimelineFromEvents();

    // click -> show the exact model by filename (normalized), and sync highlight
    const cells = progressTbody.querySelectorAll(".clickable");
    cells.forEach(cell => {
      cell.addEventListener("click", (e) => {
        const target = e.currentTarget;
        const idxStr = target.dataset.index;
        const dateStr = target.dataset.date;
        const file = target.dataset.file;
        const timelineIndex = Number(idxStr);
        const key = file ? normalizeFileKey(file) : null;
        if (key && filenameToModelIndex.has(key)) {
          const modelIndex = filenameToModelIndex.get(key);
          showModelAt(modelIndex);
          if (Number.isFinite(timelineIndex)) {
            currentTimelineIndex = timelineIndex;
            updateTimelineHighlight(timelineIndex);
          }
        } else if (Number.isFinite(timelineIndex)) {
          // Fallback: original behavior
          showModelAt(timelineIndex);
          currentTimelineIndex = timelineIndex;
          updateTimelineHighlight(timelineIndex);
        }
      });
    });

  } catch (err) {
    console.error(`Error loading schedule for ${project}:`, err);
    // fallback: if schedule fails, leave any existing table alone
  }
}

// Highlight fabrication/erection cells based on current slider index
function updateTimelineHighlight(currentIndex) {
  // Get the date of the clicked event
  const currentEvent = timelineEvents.find(e => e.index === currentIndex);
  if (!currentEvent) return;
  const currentDate = new Date(currentEvent.date);
  if (isNaN(currentDate.getTime())) return;
  
  timelineCells.forEach(cell => {
    const idx = parseInt(cell.dataset.index, 10);
    const type = cell.dataset.type;
    const cellDate = new Date(cell.dataset.date);
    
    // Ensure old selection styles do not mask red/green states
    cell.classList.remove('fab-done','fab-current','erec-done','erec-current','selected');
    
    if (Number.isFinite(idx) && Number.isFinite(currentIndex)) {
      // Only highlight cells whose date is <= currentDate
      if (!isNaN(cellDate.getTime()) && cellDate <= currentDate) {
        if (idx === currentIndex) {
          if (type === 'fab') cell.classList.add('fab-current');
          else if (type === 'erec') cell.classList.add('erec-current');
        } else {
          if (type === 'fab') cell.classList.add('fab-done');
          else if (type === 'erec') cell.classList.add('erec-done');
        }
      }
    }
  });
  // Also move the table to keep the current row in view and mark it active
  try {
    const container = document.querySelector('#progress-table .table-container');
    const currentCell = timelineCells.find(c => parseInt(c.dataset.index, 10) === Number(currentIndex));
    if (container && currentCell) {
      const row = currentCell.parentElement;
      // Clear any previous active row
      const allRows = container.querySelectorAll('tr');
      allRows.forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  } catch {}
  updateTimelinePopup(currentIndex);
}

// Build ticks/dates from timelineEvents (override any existing generic timeline)
function buildTimelineFromEvents() {
  const scaleEl = document.getElementById('timeline-scale');
  const datesEl = document.getElementById('timeline-dates');
  if (!scaleEl || !datesEl) return;
  scaleEl.innerHTML = '';
  datesEl.innerHTML = '';
  
  // Use hardcoded dates based on project instead of schedule dates
  const timelineConfigs = {
    'BSGS': [
      "Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026",
      "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026",
      "Jan 2027", "Feb 2027", "Mar 2027", "Apr 2027"
    ],
    'CUP': [
      "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026",
      "Jan 2027", "Feb 2027", "Mar 2027"
    ],
    'LORRY': [
      "Jan 2027", "Feb 2027", "Mar 2027", "Apr 2027", "May 2027", "Jun 2027"
    ],
    'WRC': [
      "Sep 2025", "Nov 2025",
      "Mar 2026", "Apr 2026","Jun 2026", "Jul 2026"
    ],
    '1': [
      "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026",
      "Jan 2027", "Feb 2027", "Mar 2027", "Apr 2027"
    ]
  };
  
  const dates = timelineConfigs[currentProject] || timelineConfigs['BSGS'];
  const ordered = [...timelineEvents].sort((a,b)=>a.index-b.index);
  
  const handleClick = (ev) => {
    // Prefer exact file mapping, else just update highlight to this event
    const key = ev.file ? normalizeFileKey(ev.file) : null;
    if (key && filenameToModelIndex.has(key)) {
      const modelIndex = filenameToModelIndex.get(key);
      showModelAt(modelIndex);
      currentTimelineIndex = ev.index;
      updateTimelineHighlight(ev.index);
    } else {
      currentTimelineIndex = ev.index;
      updateTimelineHighlight(ev.index);
    }
  };
  
  // Generate ticks and dates based on hardcoded date arrays - ensure they match
  dates.forEach((date, i) => {
    // Create tick
    const tick = document.createElement('div');
    tick.className = 'tick';
    // Map to timeline event if it exists, otherwise use index
    const ev = ordered[i];
    if (ev) {
      tick.dataset.index = String(ev.index);
      tick.style.cursor = 'pointer';
      tick.addEventListener('click', () => handleClick(ev));
    }
    scaleEl.appendChild(tick);
    
    // Create date label
    const span = document.createElement('span');
    span.textContent = date;
    span.style.cursor = 'pointer';
    if (ev) {
      span.addEventListener('click', () => handleClick(ev));
    }
    datesEl.appendChild(span);
  });
}

// Update / position popup for current timeline index with prev/current/next
function updateTimelinePopup(currentIndex) {
  if (!timelinePopupEl) return;
  const numericIndex = Number(currentIndex);
  const ordered = [...timelineEvents].sort((a, b) => a.index - b.index);
  const currentPos = ordered.findIndex(e => e.index === numericIndex);
  if (currentPos === -1) {
    timelinePopupEl.classList.remove('visible');
    return;
  }

  const prev = currentPos > 0 ? ordered[currentPos - 1] : null;
  const curr = ordered[currentPos];
  const next = currentPos < ordered.length - 1 ? ordered[currentPos + 1] : null;

  const renderLine = (ev, cls) => {
    if (!ev) return '';
    const title = ev.type === 'fab' ? 'Fabrication Complete' : 'Erection Complete';
    const note = ev.note ? ` – ${ev.note}` : '';
    return `<div class="milestone ${cls}">${title}: ${ev.member}${note}</div>`;
  };

  timelinePopupEl.innerHTML =
    renderLine(prev, 'prev') +
    renderLine(curr, 'current') +
    renderLine(next, 'next');

  timelinePopupEl.classList.add('visible');
}




// === Animation Loop ===
function animate() {
  requestAnimationFrame(animate);
  monitorPerformance();
  controls.update();
  renderer.render(scene, camera);
}
animate();
