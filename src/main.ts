import * as THREE from 'three';
import { stops } from './content';
import type { PortfolioStop } from './content';
import { createAvatar } from './avatar';
import './style.css';

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing interface element: ${id}`);
  return node as T;
}

const app = element('app');
const canvas = element<HTMLCanvasElement>('world');
const loading = element('loading');
const labelsRoot = element('stationLabels');
const panel = element('infoPanel');
const panelBody = element('panelBody');
const destinationItems = element('destinationItems');
const destinations = element('destinations');
const nearPrompt = element('nearPrompt');
const nearPromptTitle = element('nearPromptTitle');
const toastEl = element('toast');
const viewCharacterButton = element('viewCharacterButton');
const faceDetailButton = element('faceDetailButton');

interface StationMesh {
  stop: PortfolioStop;
  group: THREE.Group;
  ring: THREE.Mesh;
  gem: THREE.Mesh;
  glow: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  crystalMat: THREE.MeshStandardMaterial;
}

interface WorldState {
  active: string | null;
  near: string | null;
  autoTarget: PortfolioStop | null;
  tourMode: boolean;
  pressed: Set<string>;
  yaw: number;
  pitch: number;
  dragging: boolean;
  player: THREE.Vector3;
  moving: boolean;
  jumpY: number;
  jumpVelocity: number;
  sprinting: boolean;
  characterView: boolean;
  faceDetail: boolean;
  viewTransition: boolean;
  preViewAvatarYaw: number | null;
  ready: boolean;
  labels: Map<string, HTMLButtonElement>;
  stationMeshes: StationMesh[];
}

const state: WorldState = {
  active: null, near: null, autoTarget: null, tourMode: false,
  pressed: new Set(), yaw: 0, pitch: 0.23, dragging: false,
  player: new THREE.Vector3(0, 0, 3.7), moving: false,
  jumpY: 0, jumpVelocity: 0, sprinting: false, characterView: false, faceDetail: false, viewTransition: false, preViewAvatarYaw: null,
  ready: false, labels: new Map(), stationMeshes: [],
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = () => window.innerWidth < 740;
const AVATAR_WORLD_SCALE = 1.55;
const WALK_SPEED = 2.15;
const RUN_SPEED = 3.8;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let cameraFocus: THREE.Vector3;
let avatar: THREE.Group;
let avatarParts: ReturnType<typeof createAvatar>;
let clock: THREE.Clock;
let sun: THREE.DirectionalLight;

function escapeHtml(value: string) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, char => entities[char]);
}

function toast(message: string) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2300);
}

function setMapOpen(open: boolean) {
  destinations.classList.toggle('open', open);
  destinations.inert = !open;
  destinations.setAttribute('aria-hidden', String(!open));
}

function setCharacterView(open: boolean) {
  if (open === state.characterView) return;
  state.characterView = open;
  state.viewTransition = true;
  if (!open) setFaceDetail(false);
  app.classList.toggle('character-view', open);
  viewCharacterButton.setAttribute('aria-pressed', String(open));
  viewCharacterButton.innerHTML = open ? 'Back to world <span aria-hidden="true">V</span>' : 'View character <span aria-hidden="true">V</span>';
  faceDetailButton.hidden = !open;
  if (open) {
    if (avatar) {
      state.preViewAvatarYaw = avatar.rotation.y;
      avatar.rotation.y = state.yaw + Math.PI;
    }
    app.classList.add('started');
    state.pressed.clear();
    state.autoTarget = null;
    state.tourMode = false;
    setMapOpen(false);
    closePanel();
  } else if (avatar && state.preViewAvatarYaw !== null) {
    avatar.rotation.y = state.preViewAvatarYaw;
    state.preViewAvatarYaw = null;
  }
}

function setFaceDetail(open: boolean) {
  state.faceDetail = open && state.characterView;
  faceDetailButton.setAttribute('aria-pressed', String(state.faceDetail));
  faceDetailButton.innerHTML = state.faceDetail
    ? 'Full character <span aria-hidden="true">F</span>'
    : 'Face detail <span aria-hidden="true">F</span>';
}

function contentMarkup(stop: PortfolioStop) {
  const entryTags = (label: string, tags?: string[]) => tags?.length
    ? `<div class="entry-stack"><h5>${escapeHtml(label)}</h5><ul class="panel-list" aria-label="${escapeHtml(label)}">${tags.map(tag => `<li>${escapeHtml(tag)}</li>`).join('')}</ul></div>`
    : '';
  return `<div class="panel-symbol" aria-hidden="true">${escapeHtml(stop.icon)}</div>
    <h2 id="panelTitle">${escapeHtml(stop.title)}</h2>
    <p class="panel-lead">${escapeHtml(stop.lead)}</p>
    ${stop.groups.map(group => `<section class="panel-section">
      <h3>${escapeHtml(group.heading)}</h3>
      ${(group.paragraphs || []).map(p => `<p>${escapeHtml(p)}</p>`).join('')}
      ${(group.entries || []).map(entry => `<article class="panel-entry">
        <div class="entry-meta">${escapeHtml(entry.meta)}</div>
        <h4>${escapeHtml(entry.title)}</h4>
        <p>${escapeHtml(entry.text)}</p>
        ${entryTags('Skills', entry.skills)}
        ${entryTags('Tools', entry.tools)}
        ${entry.link ? `<a class="panel-link" href="${escapeHtml(entry.link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.link.label)} <span aria-hidden="true">↗</span></a>` : ''}
      </article>`).join('')}
      ${group.tags ? `<ul class="panel-list">${group.tags.map(tag => `<li>${escapeHtml(tag)}</li>`).join('')}</ul>` : ''}
      ${(group.links || []).map(link => `<a class="panel-link" href="${escapeHtml(link.href)}" ${link.href.startsWith('mailto:') ? '' : 'target="_blank" rel="noopener noreferrer"'}>${escapeHtml(link.label)} <span aria-hidden="true">↗</span></a><br />`).join('')}
    </section>`).join('')}`;
}

function setupUI() {
  destinationItems.innerHTML = stops.map(stop => `<button class="destination-item" type="button" data-stop="${stop.id}"><span class="item-number">${stop.number}</span><span>${escapeHtml(stop.title)}</span><span class="item-arrow" aria-hidden="true">↗</span></button>`).join('');
  destinationItems.addEventListener('click', event => {
    if (!(event.target instanceof HTMLElement)) return;
    const button = event.target.closest<HTMLButtonElement>('[data-stop]');
    if (button?.dataset.stop) goToStop(button.dataset.stop);
  });

  for (const stop of stops) {
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'station-label';
    label.innerHTML = `<span class="label-spark" aria-hidden="true">${escapeHtml(stop.icon)}</span>${escapeHtml(stop.title)}<span class="label-distance"></span>`;
    label.setAttribute('aria-label', `Walk to ${stop.title}`);
    label.addEventListener('click', () => goToStop(stop.id));
    labelsRoot.appendChild(label);
    state.labels.set(stop.id, label);
  }

  element('tourBtn').addEventListener('click', () => {
    state.tourMode = true;
    goToStop(stops[0].id);
  });
  element('mapBtn').addEventListener('click', () => setMapOpen(!destinations.classList.contains('open')));
  element('topMapBtn').addEventListener('click', () => setMapOpen(!destinations.classList.contains('open')));
  element('closePanel').addEventListener('click', closePanel);
  element('nextStop').addEventListener('click', () => {
    const currentIndex = stops.findIndex(stop => stop.id === state.active);
    const next = stops[(currentIndex + 1) % stops.length];
    closePanel();
    goToStop(next.id);
  });
  element('nearPromptButton').addEventListener('click', () => state.near && openPanel(state.near));
  viewCharacterButton.addEventListener('click', () => setCharacterView(!state.characterView));
  faceDetailButton.addEventListener('click', () => setFaceDetail(!state.faceDetail));
  document.querySelector<HTMLAnchorElement>('.brand')?.addEventListener('click', event => {
    event.preventDefault();
    closePanel();
    setMapOpen(false);
    state.autoTarget = null;
    setCharacterView(false);
    state.pressed.clear();
    state.player.set(0,0,3.7);
    app.classList.remove('started');
  });
  document.addEventListener('pointerdown', event => {
    if (!(event.target instanceof Node)) return;
    if (!destinations.contains(event.target) && !element('mapBtn').contains(event.target) && !element('topMapBtn').contains(event.target)) setMapOpen(false);
  });
  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (key === 'escape') { closePanel(); setMapOpen(false); setCharacterView(false); }
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    const controlFocused = target instanceof HTMLElement && !!target.closest('button, a');
    if (key === 'v' && !event.repeat) setCharacterView(!state.characterView);
    if (key === 'f' && !event.repeat && state.characterView && !event.metaKey && !event.ctrlKey && !event.altKey) setFaceDetail(!state.faceDetail);
    if (key === 'e' && !event.repeat && state.near && !panel.classList.contains('open')) openPanel(state.near);
    if (key === 'm' && !event.repeat) setMapOpen(!destinations.classList.contains('open'));
    if (controlFocused || panel.classList.contains('open')) return;
    if (key === ' ' && !event.repeat) { event.preventDefault(); jump(); return; }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
      event.preventDefault();
      if (state.characterView) setCharacterView(false);
      state.pressed.add(key);
      app.classList.add('started');
    } else if (key === 'shift') state.pressed.add(key);
  });
  window.addEventListener('keyup', event => state.pressed.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => state.pressed.clear());

  document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(button => {
    const moveKeys: Record<string, string> = { up: 'w', down: 's', left: 'a', right: 'd' };
    const key = moveKeys[button.dataset.move ?? ''];
    if (!key) return;
    button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); if (state.characterView) setCharacterView(false); state.pressed.add(key); app.classList.add('started'); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => state.pressed.delete(key));
  });
  element('jumpButton').addEventListener('pointerdown', event => { event.preventDefault(); jump(); });
}

function jump() {
  if (panel.classList.contains('open') || state.jumpY > 0 || state.jumpVelocity > 0) return;
  if (state.characterView) setCharacterView(false);
  app.classList.add('started');
  state.jumpVelocity = 5.5;
}

function goToStop(id: string) {
  const stop = stops.find(item => item.id === id);
  if (!stop) return;
  setCharacterView(false);
  setMapOpen(false);
  closePanel();
  app.classList.add('started');
  if (!state.ready) { openPanel(id); return; }
  state.autoTarget = stop;
  toast(`Walking to ${stop.title}`);
}

function openPanel(id: string) {
  const stop = stops.find(item => item.id === id);
  if (!stop) return;
  setCharacterView(false);
  state.pressed.clear();
  state.active = id;
  state.autoTarget = null;
  if (avatarParts?.interact) avatarParts.interact();
  const index = stops.indexOf(stop);
  panelBody.innerHTML = contentMarkup(stop);
  panelBody.scrollTop = 0;
  element('panelKicker').textContent = `STOP ${stop.number} / 06`;
  element('panelCounter').textContent = `${stop.number} / 06`;
  element('nextStop').innerHTML = index === stops.length - 1 ? 'Back to start <span aria-hidden="true">↻</span>' : 'Next stop <span aria-hidden="true">→</span>';
  panel.classList.add('open');
  panel.inert = false;
  panel.setAttribute('aria-hidden', 'false');
  app.classList.add('panel-open');
  state.labels.forEach((label, key) => label.classList.toggle('active', key === id));
  setTimeout(() => element('closePanel').focus({ preventScroll: true }), 200);
}

function closePanel() {
  state.active = null;
  panel.classList.remove('open');
  panel.inert = true;
  panel.setAttribute('aria-hidden', 'true');
  app.classList.remove('panel-open');
  state.labels.forEach(label => label.classList.remove('active'));
}

function makeStoneTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Stone texture needs a 2D canvas context');
  const image = ctx.createImageData(1024, 1024);
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = Math.random() * 34 - 17;
    image.data[i] = 108 + noise; image.data[i + 1] = 107 + noise; image.data[i + 2] = 103 + noise; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const rows = 12, cols = 12, size = 1024 / cols;
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(29,31,30,.75)';
  for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
    const x = col * size, y = r * size;
    ctx.fillStyle = `rgba(${80 + Math.random()*50},${80 + Math.random()*49},${77 + Math.random()*45},.27)`;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 4); ctx.lineTo(x + size - 6, y + 2);
    ctx.lineTo(x + size - 3, y + size - 7); ctx.lineTo(x + 5, y + size - 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (Math.random() > .5) {
      ctx.beginPath(); ctx.moveTo(x + size * .35, y + size * .08);
      ctx.lineTo(x + size * (.3 + Math.random()*.25), y + size * (.2 + Math.random()*.3));
      ctx.strokeStyle = 'rgba(35,36,34,.2)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(29,31,30,.75)'; ctx.lineWidth = 5;
    }
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function mat(color: THREE.ColorRepresentation, roughness = 0.9, metalness = 0) { return new THREE.MeshStandardMaterial({ color, roughness, metalness }); }
const stone = mat(0x737676), darkStone = mat(0x4e5353), trimStone = mat(0x97928a);
const bronze = mat(0x9a7450, .46, .55), warmMetal = mat(0xd2ab71, .3, .68);
const foliageMats = [mat(0x1e3530), mat(0x253e34), mat(0x304c3b), mat(0x213a36)];

function mesh<M extends THREE.Material | THREE.Material[]>(geometry: THREE.BufferGeometry, material: M, x = 0, y = 0, z = 0, parent: THREE.Object3D = scene, shadow = true) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z); object.castShadow = shadow; object.receiveShadow = shadow;
  parent.add(object); return object;
}

function addBackdrop() {
  const backdrop = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/mountain-valley-panorama.png`, () => {
    loading.classList.add('done');
  }, undefined, () => loading.classList.add('done'));
  backdrop.colorSpace = THREE.SRGBColorSpace;
  const plane = mesh(new THREE.PlaneGeometry(280, 102.4), new THREE.MeshBasicMaterial({ map: backdrop, depthWrite: false, fog: false, toneMapped: false }), 0, 8.5, -94, scene, false);
  plane.renderOrder = -10;
  const haze = mesh(new THREE.PlaneGeometry(280, 110), new THREE.MeshBasicMaterial({ color: 0xbcc5c5, transparent: true, opacity: .06, depthWrite: false, fog: false }), 0, 1, -70, scene, false);
  haze.renderOrder = -9;
}

function addTerrace() {
  const topTexture = makeStoneTexture();
  const topMat = new THREE.MeshStandardMaterial({ map: topTexture, roughness: 1 });
  const base = mesh(new THREE.CylinderGeometry(10.7, 11.1, 1.1, 96, 1), [darkStone, topMat, darkStone], 0, -.56, 0);
  base.receiveShadow = true;
  mesh(new THREE.TorusGeometry(10.48, .18, 10, 128), trimStone, 0, .025, 0).rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(10.35, 10.35, .1, 96), new THREE.MeshStandardMaterial({ color: 0x77746e, transparent: true, opacity: .14, roughness: 1 }), 0, .03, 0).castShadow = false;

  const curvePoints = [];
  for (let i = -30; i <= 30; i++) {
    const a = i / 30 * Math.PI * .64;
    const x = Math.sin(a) * 10.13, z = -Math.cos(a) * 10.13;
    curvePoints.push(new THREE.Vector3(x, 1.51, z));
    if (i % 2 === 0) {
      const baluster = new THREE.Group();
      baluster.position.set(x, 0, z); baluster.rotation.y = a;
      mesh(new THREE.BoxGeometry(.43, .21, .4), trimStone, 0, .19, 0, baluster);
      mesh(new THREE.CylinderGeometry(.18, .22, .75, 8), stone, 0, .68, 0, baluster);
      mesh(new THREE.CylinderGeometry(.24, .18, .14, 8), trimStone, 0, 1.09, 0, baluster);
      mesh(new THREE.BoxGeometry(.43, .18, .43), trimStone, 0, 1.23, 0, baluster);
      scene.add(baluster);
    }
    if (i % 10 === 0) {
      const post = new THREE.Group();
      post.position.set(x, 0, z);
      mesh(new THREE.BoxGeometry(.68, 1.55, .68), stone, 0, .8, 0, post);
      mesh(new THREE.BoxGeometry(.82, .2, .82), trimStone, 0, 1.68, 0, post);
      mesh(new THREE.SphereGeometry(.29, 10, 8), stone, 0, 1.89, 0, post);
      scene.add(post);
    }
  }
  const railCurve = new THREE.CatmullRomCurve3(curvePoints);
  mesh(new THREE.TubeGeometry(railCurve, 100, .23, 8, false), trimStone, 0, 0, 0);
  const lowerCurve = new THREE.CatmullRomCurve3(curvePoints.map(point => new THREE.Vector3(point.x, .35, point.z)));
  mesh(new THREE.TubeGeometry(lowerCurve, 100, .17, 8, false), darkStone, 0, 0, 0);

  for (let i = 0; i < 45; i++) {
    const angle = i * 2.39996;
    const radius = 10.2 + (i % 4) * .52;
    const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
    if (z < -8.2 && Math.abs(x) < 9.2) continue;
    const rock = mesh(new THREE.DodecahedronGeometry(.25 + (i % 5) * .09, 0), i % 3 ? stone : darkStone, x, -.07, z);
    rock.rotation.set(i * .31, i * .72, i * .14);
    rock.scale.y = .45;
  }
}

function addPine(x: number, z: number, scale: number, material: THREE.Material) {
  const tree = new THREE.Group(); tree.position.set(x, -.45, z); tree.scale.setScalar(scale);
  mesh(new THREE.CylinderGeometry(.13, .19, 2.8, 7), mat(0x433f36), 0, 1.35, 0, tree);
  for (let i = 0; i < 5; i++) {
    const y = .85 + i * .58;
    const cone = mesh(new THREE.ConeGeometry(1.1 - i * .16, 1.8 - i * .12, 8), material, 0, y + .5, 0, tree);
    cone.rotation.y = i * .43;
  }
  scene.add(tree);
}

function addNature() {
  for (let i = 0; i < 31; i++) {
    const angle = i * 2.39996;
    const radius = 14 + ((i * 7) % 11) * .72;
    const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
    if (z < -13 && Math.abs(x) < 11) continue;
    addPine(x, z, 1.1 + (i % 6) * .24, foliageMats[i % foliageMats.length]);
  }
  for (let i = 0; i < 21; i++) {
    const x = Math.sin(i * 7.6) * (12 + (i % 5) * 1.8);
    const z = -14 - (i % 4) * 3.8;
    if (Math.abs(x) < 12) continue;
    addPine(x, z, 1 + (i % 4) * .34, foliageMats[(i + 2) % foliageMats.length]);
  }
  const rockMat = mat(0x6d7776);
  for (let i = 0; i < 35; i++) {
    const a = i * 2.39996, r = 10.8 + (i % 6) * .47;
    const rock = mesh(new THREE.DodecahedronGeometry(.45 + (i % 4)*.16, 0), rockMat, Math.sin(a)*r, -.32, Math.cos(a)*r);
    rock.rotation.set(i*.4, i*.3, i*.2); rock.scale.y = .58;
  }
}

function addStation(stop: PortfolioStop, index: number) {
  const group = new THREE.Group(); group.position.set(stop.x, 0, stop.z);
  const angle = Math.atan2(-stop.x, -stop.z); group.rotation.y = angle;
  mesh(new THREE.CylinderGeometry(1.05, 1.14, .14, 12), darkStone, 0, .07, 0, group);
  mesh(new THREE.CylinderGeometry(.76, .96, .24, 10), trimStone, 0, .26, 0, group);
  mesh(new THREE.CylinderGeometry(.53, .64, 1.26, 10), stone, 0, .96, 0, group);
  mesh(new THREE.CylinderGeometry(.8, .61, .22, 10), trimStone, 0, 1.7, 0, group);
  mesh(new THREE.CylinderGeometry(.8, .8, .08, 10), bronze, 0, 1.84, 0, group);
  const ring = mesh(new THREE.TorusGeometry(.43, .052, 10, 36), warmMetal, 0, 2.32, 0, group);
  ring.rotation.y = .12;
  mesh(new THREE.TorusGeometry(.35, .026, 8, 36), bronze, 0, 2.32, 0, group).rotation.y = -.33;
  const crystalColors = [0xe8c994,0xd8a977,0xa6c8c1,0xb8c8ce,0xe3b581,0xb9cba7];
  const crystalMat = new THREE.MeshStandardMaterial({ color: crystalColors[index], emissive: crystalColors[index], emissiveIntensity: .48, roughness: .19, metalness: .3 });
  const gem = mesh(new THREE.OctahedronGeometry(.24, 0), crystalMat, 0, 2.32, 0, group);
  const glow = mesh(new THREE.RingGeometry(.74, .84, 40), new THREE.MeshBasicMaterial({ color: crystalColors[index], transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide }), 0, .011, 0, group, false);
  glow.rotation.x = -Math.PI / 2;
  mesh(new THREE.BoxGeometry(.65, .15, .09), bronze, 0, 1.35, .56, group);
  scene.add(group);
  state.stationMeshes.push({ stop, group, ring, gem, glow, crystalMat });
}

function addLantern(x: number, z: number) {
  const group = new THREE.Group(); group.position.set(x, 0, z);
  mesh(new THREE.CylinderGeometry(.17,.23,.22,8),darkStone,0,.11,0,group);
  mesh(new THREE.CylinderGeometry(.08,.11,1.2,8),bronze,0,.81,0,group);
  mesh(new THREE.BoxGeometry(.48,.11,.48),warmMetal,0,1.45,0,group);
  mesh(new THREE.BoxGeometry(.36,.37,.36),new THREE.MeshStandardMaterial({color:0xf0b969,emissive:0xffaa47,emissiveIntensity:1.2,transparent:true,opacity:.85}),0,1.69,0,group,false);
  mesh(new THREE.ConeGeometry(.34,.29,4),darkStone,0,2.01,0,group);
  scene.add(group);
  const light = new THREE.PointLight(0xffba69,1.8,6,2); light.position.set(x,1.7,z); scene.add(light);
}

function setupScene() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile() ? 1.5 : 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.29;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8e9ca4);
  scene.fog = new THREE.FogExp2(0x89969a, .007);
  camera = new THREE.PerspectiveCamera(mobile() ? 62 : 57, window.innerWidth/window.innerHeight, .1, 300);
  clock = new THREE.Clock();
  scene.add(new THREE.HemisphereLight(0xbdd9ed,0x504736,2.0));
  sun = new THREE.DirectionalLight(0xffd59a,3.6);
  sun.position.set(-16,22,-25); sun.castShadow = true;
  sun.shadow.mapSize.set(mobile() ? 1024 : 2048,mobile() ? 1024 : 2048);
  sun.shadow.camera.left=-22; sun.shadow.camera.right=22; sun.shadow.camera.top=22; sun.shadow.camera.bottom=-22;
  sun.shadow.camera.near=1; sun.shadow.camera.far=65; sun.shadow.bias=-.0004;
  scene.add(sun);
  addBackdrop(); addTerrace(); addNature();
  stops.forEach(addStation);
  addLantern(-8.6,2.1); addLantern(8.6,2.1);
  avatarParts = createAvatar(); avatar = avatarParts.root; avatar.scale.setScalar(AVATAR_WORLD_SCALE); scene.add(avatar); avatar.position.copy(state.player);
  camera.position.set(0,3.4,10.4); camera.lookAt(-.6,1.3,0);
  cameraFocus = new THREE.Vector3(-.6,1.3,0);
  state.ready = true;
  window.addEventListener('resize', onResize);
  setupDrag();
  renderer.setAnimationLoop(update);
  setTimeout(() => loading.classList.add('done'), 1600);
}

function setupDrag() {
  let lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', event => {
    state.dragging = true; lastX = event.clientX; lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!state.dragging) return;
    const dx = event.clientX-lastX, dy = event.clientY-lastY;
    state.yaw = THREE.MathUtils.clamp(state.yaw-dx*.005,-.78,.78);
    state.pitch = THREE.MathUtils.clamp(state.pitch+dy*.003,-.12,.6);
    lastX=event.clientX; lastY=event.clientY;
  });
  canvas.addEventListener('pointerup', () => { state.dragging=false; });
  canvas.addEventListener('pointercancel', () => { state.dragging=false; });
}

function onResize() {
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w,h,false); renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,mobile()?1.5:1.8));
  camera.aspect=w/h;
  camera.fov=state.characterView && state.faceDetail ? (mobile()?44:38) : (mobile()?62:57);
  camera.updateProjectionMatrix();
}

function updateMovement(dt: number) {
  if (panel.classList.contains('open') || state.characterView) { state.moving=false; state.sprinting=false; return; }
  const direction = new THREE.Vector3();
  const keys = state.pressed;
  if (keys.has('w') || keys.has('arrowup')) direction.z -= 1;
  if (keys.has('s') || keys.has('arrowdown')) direction.z += 1;
  if (keys.has('a') || keys.has('arrowleft')) direction.x -= 1;
  if (keys.has('d') || keys.has('arrowright')) direction.x += 1;
  if (direction.lengthSq() > 0) {
    state.autoTarget=null; state.tourMode=false;
    direction.normalize().applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw);
  } else if (state.autoTarget) {
    const stop = state.autoTarget;
    direction.set(stop.x-state.player.x,0,(stop.z+1.1)-state.player.z);
    if (direction.length() < 1.28) { state.autoTarget=null; openPanel(stop.id); direction.set(0,0,0); }
    else direction.normalize();
  }
  state.moving=false;
  state.sprinting=false;
  if (direction.lengthSq() === 0) return;
  const wantsSprint=(keys.has('shift') || keys.has('shiftleft') || keys.has('shiftright')) && !state.autoTarget;
  const speed=wantsSprint?RUN_SPEED:WALK_SPEED;
  const next=state.player.clone().addScaledVector(direction,Math.min(dt,.05)*speed);
  const radius=Math.hypot(next.x,next.z);
  if (radius>9.55) { next.x*=9.55/radius; next.z*=9.55/radius; }
  state.moving=next.distanceToSquared(state.player)>0.0000001;
  state.sprinting=state.moving && wantsSprint;
  state.player.copy(next);
  if (!state.moving && state.autoTarget) { state.autoTarget=null; toast('Choose another path'); }
  // The avatar's front points along local -Z, so positive X (D) is a left-hand yaw.
  const targetYaw=Math.atan2(-direction.x,-direction.z);
  const diff=Math.atan2(Math.sin(targetYaw-avatar.rotation.y),Math.cos(targetYaw-avatar.rotation.y));
  avatar.rotation.y+=diff*(1-Math.exp(-12*dt));
}

function updateJump(dt: number) {
  if (state.jumpVelocity !== 0 || state.jumpY > 0) {
    state.jumpY += state.jumpVelocity * dt;
    state.jumpVelocity -= 15.5 * dt;
    if (state.jumpY <= 0) { state.jumpY = 0; state.jumpVelocity = 0; }
  }
}

function updateAvatar(t: number, dt: number) {
  avatar.position.lerp(state.player.clone().add(new THREE.Vector3(0,state.jumpY,0)),Math.min(1,dt*15));
  avatarParts.update(t,dt,state.moving,state.sprinting,state.jumpY > .05);
}

function updateCamera(dt: number) {
  const lerpFactor = prefersReducedMotion ? 1 : 1-Math.exp(-6*dt);
  const targetFov = state.characterView && state.faceDetail ? (mobile()?44:38) : (mobile()?62:57);
  if (Math.abs(camera.fov-targetFov) > .01) {
    camera.fov = THREE.MathUtils.lerp(camera.fov,targetFov,lerpFactor);
    camera.updateProjectionMatrix();
  }
  if (state.characterView) {
    const distance=state.faceDetail?(mobile()?1.18:1.05):4.25;
    const height=state.faceDetail?2.57:1.6;
    const focusHeight=state.faceDetail?2.57:1.0;
    const front=new THREE.Vector3(Math.sin(state.yaw)*distance,height,Math.cos(state.yaw)*distance);
    camera.position.lerp(state.player.clone().add(front),lerpFactor);
    cameraFocus.lerp(new THREE.Vector3(state.player.x,focusHeight,state.player.z),lerpFactor);
    camera.lookAt(cameraFocus);
    return;
  }
  const d=mobile()?7.4:6.5;
  const cameraOffset=new THREE.Vector3(Math.sin(state.yaw)*d,2.85+state.pitch*3.2,Math.cos(state.yaw)*d);
  const desired=state.player.clone().add(cameraOffset);
  camera.position.lerp(desired,Math.min(1,dt*4.5));
  const focus=new THREE.Vector3(state.player.x-(mobile()?0:.7),1.35,state.player.z-1.5);
  if (state.viewTransition) {
    cameraFocus.lerp(focus,lerpFactor);
    if (cameraFocus.distanceToSquared(focus)<.0001) {
      cameraFocus.copy(focus);
      state.viewTransition=false;
    }
  } else cameraFocus.copy(focus);
  camera.lookAt(cameraFocus);
}

function updateLabels() {
  const w=window.innerWidth,h=window.innerHeight;
  type LabelRect = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>;
  const placed: LabelRect[] = [];
  const welcome=app.classList.contains('started')?null:document.querySelector('.welcome-card')?.getBoundingClientRect();
  for (const stop of stops) {
    const label=state.labels.get(stop.id);
    if (!label) continue;
    const projected=new THREE.Vector3(stop.x,3.15,stop.z).project(camera);
    const visible=projected.z<1 && projected.z>-1 && projected.x>-1.1 && projected.x<1.1 && projected.y>-1 && projected.y<.93;
    label.style.display=visible?'block':'none';
    if (!visible) continue;
    const width=label.offsetWidth || 110, height=label.offsetHeight || 30;
    const x=THREE.MathUtils.clamp((projected.x*.5+.5)*w,width/2+8,w-width/2-8);
    let y=(-projected.y*.5+.5)*h;
    const collision=(a: LabelRect,b: LabelRect)=>a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;
    let rect={left:x-width/2,right:x+width/2,top:y-height,bottom:y};
    for (let tries=0;tries<5;tries++) {
      const hitsPlaced=placed.some(other=>collision(rect,other));
      const hitsWelcome=welcome && !mobile() && collision(rect,welcome);
      if (!hitsPlaced && !hitsWelcome) break;
      y-=height+7; rect={left:x-width/2,right:x+width/2,top:y-height,bottom:y};
    }
    label.style.left=`${x}px`;
    label.style.top=`${y}px`;
    placed.push(rect);
    const dist=Math.round(Math.hypot(stop.x-state.player.x,stop.z-state.player.z));
    const distanceLabel = label.querySelector('.label-distance');
    if (distanceLabel) distanceLabel.textContent=`${dist}m`;
  }
}

function updateNear() {
  if (panel.classList.contains('open')) { nearPrompt.hidden=true; return; }
  let nearest: PortfolioStop | null = null, min=Infinity;
  for (const stop of stops) {
    const distance=Math.hypot(stop.x-state.player.x,stop.z-state.player.z);
    if (distance<min) { nearest=stop; min=distance; }
  }
  state.near=nearest && min<2.15?nearest.id:null;
  nearPrompt.hidden=!state.near;
  if (state.near && nearest) nearPromptTitle.textContent=nearest.title;
}

function update() {
  const dt=Math.min(clock.getDelta(),.06),t=clock.elapsedTime;
  updateMovement(dt); updateJump(dt); updateAvatar(t,dt); updateCamera(dt);
  for (const item of state.stationMeshes) {
    item.ring.rotation.z=t*.33;
    item.gem.position.y=2.32+Math.sin(t*1.7+stops.indexOf(item.stop))*.075;
    const distance=Math.hypot(item.stop.x-state.player.x,item.stop.z-state.player.z);
    item.crystalMat.emissiveIntensity=distance<2.3?.95:.48;
    item.glow.material.opacity=distance<2.3?.5:.28;
  }
  updateLabels(); updateNear();
  renderer.render(scene,camera);
}

setupUI();
try { setupScene(); }
catch (error) {
  console.error('3D scene unavailable',error);
  state.ready=false;
  loading.classList.add('done');
  labelsRoot.hidden = true;
  setMapOpen(true);
  toast('Use the destination list to explore the portfolio');
}
