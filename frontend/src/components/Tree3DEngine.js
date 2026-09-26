import * as THREE from 'three';
/* ================= TaskTree 3D — app ================= */
export function initTree3D(container) {
  'use strict';
  let tasks = [];

  /* visible error reporting — nothing fails silently */
  let _errShown = false;
  window.addEventListener('error', function (e) {
    if (_errShown) return; _errShown = true;
    try {
      const m = '⚠️ ' + (e && e.message ? e.message : 'Something glitched');
      try { if (typeof toast === 'function') toast(m) } catch (_) { }
      const l = document.getElementById('loader');
      if (l && !l.classList.contains('hide')) l.innerHTML = '<div class="tree">🌳</div><div style="max-width:82%;text-align:center;font-size:15px">' + m + '<br><small>Try reloading, or the 2D view.</small></div>';
    } catch (_) { }
  });
  const $ = (s) => document.querySelector(s) || ({ textContent: '', style: {}, classList: { toggle: () => { } }, onclick: null, addEventListener: () => { } });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function mulberry(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) }

  /* ---------- shared garden state (same save as 2D version!) ---------- */
  const SIZES = { sprout: { xp: 10, icon: '🌱', label: 'Sprout', leaves: 8 }, leaf: { xp: 20, icon: '🍃', label: 'Leaf', leaves: 14 }, branch: { xp: 50, icon: '🌿', label: 'Branch', leaves: 22 }, flower: { xp: 100, icon: '🌸', label: 'Flower', leaves: 0 } };
  const CATCOLORS = { Work: [0xc4b5fd, 0x7c3aed], Study: [0x93c5fd, 0x2563eb], Health: [0xf9a8d4, 0xdb2777], Personal: [0xfdba74, 0xea580c], Creative: [0xfde047, 0xca8a04] };
  const LEVELS = [{ xp: 0, name: 'Seed', emoji: '🌱' }, { xp: 30, name: 'Sprout', emoji: '🌱' }, { xp: 100, name: 'Sapling', emoji: '🌿' }, { xp: 250, name: 'Young Tree', emoji: '🌳' }, { xp: 500, name: 'Thriving Tree', emoji: '🌳' }, { xp: 1000, name: 'Mighty Tree', emoji: '🌲' }, { xp: 2000, name: 'Ancient Tree', emoji: '🌲' }, { xp: 3500, name: 'Enchanted Tree', emoji: '✨' }];
  const QUOTES = ["Small deeds done are better than great deeds planned.", "Don't watch the clock; do what it does. Keep going.", "A little progress each day adds up to big results.", "The secret of getting ahead is getting started.", "It always seems impossible until it's done.", "Grow through what you go through.", "Discipline is choosing what you want most over what you want now.", "Nature does not hurry, yet everything is accomplished."];
  const ACHS = [{ id: 'a1', e: '🌱', n: 'First Leaf', d: 'Complete your first task', c: s => s.done >= 1 }, { id: 'a2', e: '🌿', n: 'Branching Out', d: 'Grow 5 tasks — new branch!', c: s => s.done >= 5 }, { id: 'a3', e: '🌳', n: 'Little Grove', d: 'Grow 15 tasks', c: s => s.done >= 15 }, { id: 'a4', e: '🌸', n: 'First Bloom', d: 'Complete a 3+ hr deep-work task', c: s => s.flowers >= 1 }, { id: 'a5', e: '💐', n: 'Florist', d: 'Bloom 5 flowers', c: s => s.flowers >= 5 }, { id: 'a6', e: '⭐', n: 'Rising Sun', d: 'Earn 250 XP', c: s => s.xp >= 250 }, { id: 'a7', e: '🌟', n: 'Forest Legend', d: 'Earn 1000 XP', c: s => s.xp >= 1000 }, { id: 'a8', e: '🔥', n: 'On Fire', d: '3-day streak', c: s => s.streak >= 3 }];
  let state = { sky: 'auto', sound: false, rot: true };
  function save() { try { localStorage.setItem('tasktree_v1', JSON.stringify(state)) } catch (e) { } }
  function uid() { return Math.random().toString(36).slice(2, 9) }
  function dayKey(d) { return d.toISOString().slice(0, 10) }
  function stats() {
    const done = tasks.filter(t => t.done);
    const xp = done.reduce((s, t) => s + ((SIZES[t.size] || SIZES.leaf).xp || 0), 0);
    const flowers = done.filter(t => t.size === 'flower').length;
    // XP-based level (matches LEVELS array thresholds)
    let lvl = 0;
    for (let i = 0; i < LEVELS.length; i++) { if (xp >= LEVELS[i].xp) lvl = i; }
    // streak: count consecutive completed days up to today
    const daySet = new Set(done.map(t => t.completedAt ? dayKey(new Date(t.completedAt)) : null).filter(Boolean));
    let streak = 0;
    const d = new Date(); d.setHours(0,0,0,0);
    while (daySet.has(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
    return { done: done.length, lvl, xp, flowers, streak };
  }
  const births = {}; let justGrewId = null, lastGrowthPos = new THREE.Vector3(0, 3, 0), builtEnvLvl = -1;
  let clockT = 0;

  /* ---------- sound ---------- */
  let AC = null;
  function chime(big) {
    if (!state.sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const notes = big ? [523, 659, 784, 1047] : [660, 880];
      notes.forEach((f, i) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f; const t = AC.currentTime + i * .12; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.22, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .45); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + .5) });
    } catch (e) { }
  }

  /* ---------- renderer / scene / camera ---------- */

  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
  catch (err) { document.getElementById('loader').innerHTML = '<div class="tree">🌳</div><div style="max-width:82%;text-align:center">3D unavailable in this browser.<br><small>Try Chrome/Edge, or open the 2D view.</small></div>'; return; }
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setSize(container.clientWidth||window.innerWidth, container.clientHeight||window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe9f7, 46, 190);
  const camera = new THREE.PerspectiveCamera(50, (container.clientWidth||window.innerWidth) / (container.clientHeight||window.innerHeight), .1, 600);
  
  function handleResize() {
    if (!container) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
    if (renderer) renderer.setSize(w, h);
  }
  window.addEventListener('resize', handleResize);


  /* ---------- procedural canvas textures (no downloads!) ---------- */
  function canvasTex(w, h, fn, rx, ry) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rx) t.repeat.set(rx, ry || rx); t.anisotropy = 4; return t }
  const leafTex = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const grad = g.createLinearGradient(10, 64, 118, 64); grad.addColorStop(0, '#2f8f46'); grad.addColorStop(.5, '#63c276'); grad.addColorStop(1, '#2f8f46');
    g.fillStyle = grad; g.beginPath(); g.moveTo(8, 64); g.bezierCurveTo(30, 10, 90, 10, 120, 64); g.bezierCurveTo(90, 118, 30, 118, 8, 64); g.fill();
    g.strokeStyle = '#1f6b30'; g.lineWidth = 3; g.beginPath(); g.moveTo(10, 64); g.lineTo(118, 64); g.stroke();
    g.strokeStyle = '#9fe3a8'; g.lineWidth = 2; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(30 + i * 16, 64); g.lineTo(42 + i * 16, 40); g.stroke(); g.beginPath(); g.moveTo(30 + i * 16, 64); g.lineTo(42 + i * 16, 88); g.stroke() }
  });
  const barkTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#7a5230'; g.fillRect(0, 0, w, h); const R = mulberry(5);
    for (let i = 0; i < 130; i++) { const x = R() * w; g.strokeStyle = R() > .5 ? 'rgba(60,35,15,.55)' : 'rgba(160,115,70,.5)'; g.lineWidth = 1 + R() * 4; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (R() - .5) * 22, h * .33, x + (R() - .5) * 22, h * .66, x + (R() - .5) * 14, h); g.stroke() }
    for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(50,30,12,.5)'; g.beginPath(); g.ellipse(R() * w, R() * h, 4 + R() * 6, 7 + R() * 9, 0, 0, 7); g.fill() }
  }, 2, 2);
  const groundTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#69a85c'; g.fillRect(0, 0, w, h); const R = mulberry(11);
    for (let i = 0; i < 260; i++) { const r = 8 + R() * 38; g.fillStyle = R() > .5 ? 'rgba(70,140,60,.35)' : 'rgba(140,200,120,.3)'; g.beginPath(); g.arc(R() * w, R() * h, r, 0, 7); g.fill() }
    for (let i = 0; i < 2200; i++) { g.fillStyle = R() > .5 ? 'rgba(40,100,40,.5)' : 'rgba(170,220,150,.5)'; g.fillRect(R() * w, R() * h, 2, 2 + R() * 3) }
  }, 10, 10);
  const cloudTex = canvasTex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); const R = mulberry(21);
    for (let i = 0; i < 16; i++) { const x = 40 + R() * 176, y = 50 + R() * 40, r = 18 + R() * 26; const gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill() }
  });
  const glowTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h) });
  const grassTex = canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); const R = mulberry(31);
    for (let i = 0; i < 9; i++) { const x = 6 + i * 6 + R() * 3; const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#2f7a3c'); gr.addColorStop(1, '#7cc47f'); g.fillStyle = gr; g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + (R() - .5) * 10, h * .4, x + (R() - .5) * 16, 4 + R() * 14); g.quadraticCurveTo(x + 3, h * .5, x + 4, h); g.fill() }
  });
  const moonTex = canvasTex(256, 256, (g, w, h) => {
    // Base glowing disc
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 120);
    gr.addColorStop(0, 'rgba(255,255,240,1)');
    gr.addColorStop(0.5, 'rgba(240,240,210,1)');
    gr.addColorStop(0.82, 'rgba(200,200,180,0.9)');
    gr.addColorStop(1, 'rgba(150,150,130,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    
    // Cut out a crescent shape softly
    g.globalCompositeOperation = 'destination-out';
    const cutGr = g.createRadialGradient(160, 96, 0, 160, 96, 120);
    cutGr.addColorStop(0, 'rgba(0,0,0,1)');
    cutGr.addColorStop(0.6, 'rgba(0,0,0,1)');
    cutGr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = cutGr;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';

    // crater details on remaining part
    g.globalAlpha = 0.12;
    g.fillStyle = 'rgba(100,100,80,1)';
    [[95, 105, 18], [80, 155, 8], [120, 160, 7]].forEach(([cx, cy, r]) => {
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    });
    g.globalAlpha = 1;
  });

  function emojiTex(ch) { return canvasTex(128, 128, (g) => { g.font = '96px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70) }) }

  /* ---------- materials ---------- */
  const barkMat = new THREE.MeshStandardMaterial({ map: barkTex, roughness: .95, color: 0xcf9a68 });
  const twigMat = new THREE.MeshStandardMaterial({ map: barkTex, roughness: .95, color: 0xa87e52 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3e8f4e, roughness: .8 });
  const leafBaseMat = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: .42, side: THREE.DoubleSide, roughness: .75, metalness: 0 });
  const leafDepthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafTex, alphaTest: .42 });
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x6e4525, roughness: 1 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x9a958c, roughness: .9, flatShading: true });
  const waterMat = new THREE.MeshPhongMaterial({ color: 0x5fb3d9, shininess: 140, specular: 0xbfeaff, transparent: true, opacity: .92 });
  const proxyMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  const GREENS = [0x4caf5d, 0x3e9b4f, 0x66bb6a, 0x2f8f46, 0x7cc47f, 0x359846].map(c => new THREE.Color(c));

  /* ---------- lights ---------- */
  const sun = new THREE.DirectionalLight(0xfff1cf, 1.35);
  sun.position.set(26, 42, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  sun.shadow.camera.left = -20; sun.shadow.camera.right = 20; sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -12;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 150; sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  sun.target.position.set(0, 3, 0); scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xcfe9f7, 0x4a7a3f, .85); scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, .22); scene.add(amb);

  /* ---------- sky dome + fog ---------- */
  const skyUni = { top: { value: new THREE.Color(0x3d8fd6) }, hor: { value: new THREE.Color(0xcfe9f7) } };
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(230, 24, 16), new THREE.ShaderMaterial({
    uniforms: skyUni, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top;uniform vec3 hor;varying vec3 vP;void main(){float h=normalize(vP).y*.5+.5;vec3 c=mix(hor,top,smoothstep(.48,.85,h));c=mix(c,hor*.92,smoothstep(.48,.15,h));gl_FragColor=vec4(c,1.);}'
  }));
  scene.add(skyDome);

  /* ---------- static environment ---------- */
  const world = new THREE.Group(); scene.add(world);
  (function buildStatic() {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(130, 48), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
    const R = mulberry(99);
    // distant hills
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x5d9a52, roughness: 1 });
    [[-70, -60, 34], [60, -75, 42], [0, -95, 50], [-85, 20, 30], [80, 40, 34]].forEach(p => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(p[2], 20, 14), hillMat);
      m.scale.y = .28; m.position.set(p[0], -2, p[1]); world.add(m);
    });
    // background trees
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x6e4525, roughness: 1 });
    const coneM = new THREE.MeshStandardMaterial({ color: 0x2f7a3c, roughness: 1 });
    for (let i = 0; i < 12; i++) {
      const a = R() * Math.PI * 2, r = 30 + R() * 42, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 1.6 + R() * 2.2;
      const g = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(.22 * s, .34 * s, 1.6 * s, 7), trunkM); tr.position.y = .8 * s; g.add(tr);
      for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry((1.5 - k * .38) * s, (1.7 - k * .25) * s, 9), coneM); c.position.y = (1.8 + k * 1.05) * s; g.add(c) }
      g.position.set(x, 0, z); g.rotation.y = R() * 6; world.add(g);
    }
    // soil mound + stones
    const soil = new THREE.Mesh(new THREE.SphereGeometry(2.3, 26, 16), soilMat);
    soil.scale.set(1, .26, 1); soil.position.y = .1; soil.receiveShadow = true; world.add(soil);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const st = new THREE.Mesh(new THREE.DodecahedronGeometry(.14 + ((i * 37) % 10) / 38, 0), rockMat); st.position.set(Math.cos(a) * 2.5, .08, Math.sin(a) * 2.5); st.castShadow = true; world.add(st) }
    // rocks
    for (let i = 0; i < 7; i++) { const a = R() * 6.28, r = 5 + R() * 15; const m = new THREE.Mesh(new THREE.DodecahedronGeometry(.22 + R() * .5, 0), rockMat); m.position.set(Math.cos(a) * r, .2, Math.sin(a) * r); m.rotation.set(R() * 3, R() * 3, R() * 3); m.castShadow = true; m.receiveShadow = true; world.add(m) }
    // grass (instanced)
    const gg = new THREE.PlaneGeometry(.75, .62); gg.translate(0, .28, 0);
    const gm = new THREE.MeshStandardMaterial({ map: grassTex, alphaTest: .4, side: THREE.DoubleSide, roughness: 1 });
    const N = 900, grass = new THREE.InstancedMesh(gg, gm, N);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), P = new THREE.Vector3();
    let placed = 0, guard = 0;
    while (placed < N && guard++ < 8000) {
      const a = R() * Math.PI * 2, r = 2.9 + Math.sqrt(R()) * 21;
      P.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      if (P.distanceTo(new THREE.Vector3(7.5, 0, 3.5)) < 3.2) continue;
      E.set(0, R() * Math.PI, 0); Q.setFromEuler(E); const s = .7 + R() * .9; S.set(s, s, s);
      M.compose(P, Q, S); grass.setMatrixAt(placed, M);
      grass.setColorAt(placed, GREENS[Math.floor(R() * GREENS.length)]);
      placed++;
    }
    grass.count = placed; grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    grass.receiveShadow = true; world.add(grass);
  })();

  /* ---------- level-based environment ---------- */
  const envGroup = new THREE.Group(); scene.add(envGroup);
  function clearGroup(g) { for (let i = g.children.length - 1; i >= 0; i--) { const o = g.children[i]; g.remove(o); o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material && n.material._own) n.material.dispose() }) } }
  function buildEnv() {
    clearGroup(envGroup);
    const st = stats(); builtEnvLvl = st.lvl; const R = mulberry(500 + st.lvl);
    // mushrooms lvl>=2
    if (st.lvl >= 2) {
      const capM = new THREE.MeshStandardMaterial({ color: 0xd8443c, roughness: .6 });
      const stemM = new THREE.MeshStandardMaterial({ color: 0xf3ead6, roughness: .8 });
      [[2.9, 1.2], [-3.1, .6], [2.4, -2.2], [-2.6, -2.6]].forEach((p, i) => {
        const s = .7 + R() * .6, g = new THREE.Group();
        const st2 = new THREE.Mesh(new THREE.CylinderGeometry(.09 * s, .13 * s, .5 * s, 8), stemM); st2.position.y = .25 * s; st2.castShadow = true; g.add(st2);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(.3 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), capM); cap.position.y = .5 * s; cap.castShadow = true; g.add(cap);
        for (let d = 0; d < 4; d++) { const dot = new THREE.Mesh(new THREE.SphereGeometry(.045 * s, 6, 6), stemM); const a = R() * 6.28; dot.position.set(Math.cos(a) * .18 * s, .5 * s + .2 * s, Math.sin(a) * .18 * s); g.add(dot) }
        g.position.set(p[0], 0, p[1]); envGroup.add(g);
      });
    }
    // pond lvl>=3
    if (st.lvl >= 3) {
      const pond = new THREE.Group(); pond.position.set(7.5, 0, 3.5);
      const w = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), waterMat); w.rotation.x = -Math.PI / 2; w.position.y = .03; pond.add(w);
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(.16 + R() * .14, 0), rockMat); s.position.set(Math.cos(a) * 2.5, .1, Math.sin(a) * 2.5); s.castShadow = true; pond.add(s) }
      const lilyM = new THREE.MeshStandardMaterial({ color: 0x2f8f46, roughness: .7 });
      [[.6, .4], [-.8, -.5]].forEach(p => { const l = new THREE.Mesh(new THREE.CircleGeometry(.42, 14), lilyM); l.rotation.x = -Math.PI / 2; l.position.set(p[0], .06, p[1]); pond.add(l) });
      const lotus = makeFlower(0xf9a8d4, 0xdb2777, .8); lotus.group.position.set(-.8, .05, -.5); pond.add(lotus.group);
      for (let i = 0; i < 3; i++) { const reed = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, 1.4, 6), stemMat); reed.position.set(-2.2 + i * .5, .7, -1.2 + i * .3); pond.add(reed); const tip = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .3, 6), new THREE.MeshStandardMaterial({ color: 0x6e4525 })); tip.material._own = true; tip.position.set(-2.2 + i * .5, 1.4, -1.2 + i * .3); pond.add(tip) }
      envGroup.add(pond);
    }
    // ground flowers + critters lvl>=4
    if (st.lvl >= 4) {
      const cats = Object.keys(CATCOLORS);
      for (let i = 0; i < 10; i++) { const a = R() * 6.28, r = 3.5 + R() * 9; const c = CATCOLORS[cats[i % cats.length]]; const f = makeFlower(c[0], c[1], .45 + R() * .25); f.group.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); f.group.rotation.y = R() * 6; envGroup.add(f.group) }
      const hog = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex('🦔'), transparent: true, depthWrite: false })); hog.material._own = true; hog.scale.set(.9, .9, 1); hog.position.set(4.6, .45, 4.4); envGroup.add(hog);
      const frog = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex('🐸'), transparent: true, depthWrite: false })); frog.material._own = true; frog.scale.set(.7, .7, 1); frog.position.set(6.4, .35, 1.6); envGroup.add(frog);
    }
  }

  /* ---------- flowers / fruits ---------- */
  const flowerHeads = [];
  function makeFlower(petalC, deepC, scale) {
    scale = scale || 1; const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.035, .05, .8, 6), stemMat); stem.position.y = .4; stem.castShadow = true; g.add(stem);
    const lf = new THREE.Mesh(new THREE.PlaneGeometry(.5, .3), leafBaseMat.clone()); lf.material._own = true; lf.material.color = new THREE.Color(0x66bb6a); lf.position.set(.2, .35, 0); lf.rotation.set(0, .6, -.5); g.add(lf);
    const head = new THREE.Group(); head.position.y = .85; g.add(head);
    const petG = new THREE.SphereGeometry(.19, 10, 8); petG.scale(1, .3, .55);
    const pm = new THREE.MeshStandardMaterial({ color: petalC, roughness: .5 }); pm._own = true;
    for (let k = 0; k < 6; k++) { const p = new THREE.Mesh(petG, pm); const a = k / 6 * Math.PI * 2; p.position.set(Math.cos(a) * .18, .03, Math.sin(a) * .18); p.rotation.y = -a; p.rotation.z = .3; p.castShadow = true; head.add(p) }
    const c = new THREE.Mesh(new THREE.SphereGeometry(.11, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffdf6b, roughness: .5, emissive: 0x8a5a00, emissiveIntensity: .35 })); c.material._own = true; c.position.y = .08; head.add(c);
    g.scale.setScalar(scale); flowerHeads.push({ head: head, phase: Math.random() * 6 });
    return { group: g };
  }
  const fruitMat = new THREE.MeshStandardMaterial({ color: 0xffc93b, roughness: .35, emissive: 0xa86a00, emissiveIntensity: .5 });

  /* ---------- tree skeleton (seeded → stable shape as it grows) ---------- */
  const SKEL = (function () {
    const R = mulberry(1234); const defs = [];
    for (let i = 0; i < 12; i++) {
      const f = i / 11;
      defs.push({
        t: .34 + .6 * f + (R() - .5) * .05, az: i * 2.399963 + R() * .6, elev: .95 - .42 * f + (R() - .5) * .14, len: 3.0 - 1.5 * f + (R() - .5) * .4, r: .17 - .075 * f,
        twigs: [{ tt: .55, azOff: (R() - .5) * 1.8, elev: .75 + (R() - .5) * .3, len: 1.35 + (R() - .5) * .3 }, { tt: .85, azOff: (R() - .5) * 1.8, elev: .85 + (R() - .5) * .3, len: 1.05 + (R() - .5) * .25 }]
      });
    }
    return { defs: defs, lean: { x: (mulberry(7)() - .5) * .7, z: (mulberry(9)() - .5) * .7 } };
  })();
  function tubeBetween(a, b, r0, r1, mat, radial) {
    // Guard: skip if either endpoint has NaN/Infinity components
    if (!a || !b ||
        !isFinite(a.x) || !isFinite(a.y) || !isFinite(a.z) ||
        !isFinite(b.x) || !isFinite(b.y) || !isFinite(b.z)) return null;
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    if (!isFinite(len) || len < 0.0001) return null; // degenerate segment
    const g = new THREE.CylinderGeometry(r1, r0, len, radial || 7, 1); g.translate(0, len / 2, 0);
    const dn = d.clone().normalize();
    if (!isFinite(dn.x) || !isFinite(dn.y) || !isFinite(dn.z)) { g.dispose(); return null; }
    const m = new THREE.Mesh(g, mat); m.position.copy(a); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dn);
    m.castShadow = true; return m;
  }

  /* ---------- tree build ---------- */
  let treeGroup = null, leafMesh = null, leafData = [], leafYoung = [], flowerPops = [], proxies = [], crownGlow = null;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  function dirFromAzEl(az, el) { return V3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)) }
  function disposeTree() {
    if (!treeGroup) return;
    treeGroup.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material && n.material._own) n.material.dispose() });
    for (let i = flowerHeads.length - 1; i >= 0; i--) { let n = flowerHeads[i].head, hit = false; while (n) { if (n === treeGroup) { hit = true; break } n = n.parent } if (hit) flowerHeads.splice(i, 1) }
    scene.remove(treeGroup); treeGroup = null; leafMesh = null; leafData = []; leafYoung = []; flowerPops = []; proxies = []; crownGlow = null;
  }
  function addProxy(pos, r, data) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), proxyMat); m.position.copy(pos); m.userData.tip = data; treeGroup.add(m); proxies.push(m) }
  function buildTree() {
    disposeTree();
    const st = stats(); const done = tasks.filter(t => t.done);
    treeGroup = new THREE.Group(); scene.add(treeGroup);
    const BASE_Y = .4;
    // ---- seed state ----
    if (st.done === 0) {
      const seed = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 10), new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: .8 }));
      seed.scale.y = 1.35; seed.position.y = BASE_Y + .15; seed.castShadow = true; treeGroup.add(seed);
      return;
    }
    // ---- sprout state ----
    if (st.lvl <= 1) {
      const sh = 1.0 + st.done * .18;
      const top = V3(SKEL.lean.x * .3, BASE_Y + sh, SKEL.lean.z * .3);
      { const _m = tubeBetween(V3(0, BASE_Y, 0), top, .07, .045, stemMat, 7); if (_m) treeGroup.add(_m); }
      const leafTasks = done.filter(t => t.size !== 'flower');
      leafTasks.forEach((t, i) => {
        const R = mulberry(hashStr(t.id)); const n = t.size === 'branch' ? 6 : 4;
        const cx = top.x, cy = top.y - .15, cz = top.z;
        for (let k = 0; k < n; k++) {
          const a = R() * 6.28, rr = .3 + R() * .45;
          leafData.push({
            p: V3(cx + Math.cos(a) * rr, cy + (R() - .5) * .5, cz + Math.sin(a) * rr),
            e: [(R() - .5) * 2, R() * 6.28, (R() - .5) * 2], s: .75 + R() * .5, birth: births[t.id] || 0, ci: Math.floor(R() * GREENS.length)
          });
        }
        // Spread proxies in a circle so each task is individually hoverable
        const proxyAngle = (i / Math.max(leafTasks.length, 1)) * Math.PI * 2;
        const proxyR = 0.55 + i * 0.1;
        const px = top.x + Math.cos(proxyAngle) * proxyR;
        const pz = top.z + Math.sin(proxyAngle) * proxyR;
        addProxy(V3(px, cy, pz), .6, { task: t });
        if (t.id === justGrewId) lastGrowthPos.set(px, cy, pz);
      });
      finalizeLeaves(); return;
    }
    // ---- full tree ----
    const g = clamp(st.xp / 1200, 0, 1);
    const trunkH = 3.4 + Math.min(3.0, st.done * .1 + st.xp * .0011);
    const trunkR = (.34 + Math.min(.3, st.done * .008 + st.xp * .00008)) * (0.85 + 0.15 * g + 0.15);
    const trunkPt = t => V3(SKEL.lean.x * t * t * trunkH * .14, BASE_Y + t * trunkH, SKEL.lean.z * t * t * trunkH * .14);
    const SEGS = 6;
    for (let i = 0; i < SEGS; i++) {
      const a = trunkPt(i / SEGS), b = trunkPt((i + 1) / SEGS);
      { const _m = tubeBetween(a, b, trunkR * (1 - i / SEGS * .72), trunkR * (1 - (i + 1) / SEGS * .72), barkMat, 9); if (_m) treeGroup.add(_m); }
    }
    // roots
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + .4; const _r = tubeBetween(V3(Math.cos(a) * trunkR * .7, .55, Math.sin(a) * trunkR * .7), V3(Math.cos(a) * (trunkR + 1.1), .12, Math.sin(a) * (trunkR + 1.1)), .12, .03, barkMat, 6); if (_r) treeGroup.add(_r); }
    const nBr = Math.min(SKEL.defs.length, 2 + Math.floor(st.done / 2));
    const anchors = [], tips = [];
    for (let i = 0; i < nBr; i++) {
      const d = SKEL.defs[i];
      const start = trunkPt(d.t), dir = dirFromAzEl(d.az, d.elev);
      const end = start.clone().addScaledVector(dir, d.len);
      const sIn = start.clone().addScaledVector(dir, -.25);
      { const _m = tubeBetween(sIn, end, d.r * (0.7 + 0.5 * g + .3), d.r * .35, twigMat, 7); if (_m) treeGroup.add(_m); }
      tips.push(end.clone());
      d.twigs.forEach(tw => {
        const ts = sIn.clone().lerp(end, tw.tt);
        const td = dirFromAzEl(d.az + tw.azOff, tw.elev);
        const te = ts.clone().addScaledVector(td, tw.len);
        { const _m = tubeBetween(ts, te, .055, .02, twigMat, 6); if (_m) treeGroup.add(_m); }
        anchors.push(te.clone());
      });
      anchors.push(end.clone());
    }
    // crown anchors
    const apex = trunkPt(1);
    { const _m = tubeBetween(trunkPt(.93), apex.clone().add(V3(0, .5, 0)), trunkR * .28, .03, twigMat, 6); if (_m) treeGroup.add(_m); }
    for (let k = 0; k < 3; k++) { const a = k / 3 * 6.28 + .7; anchors.push(apex.clone().add(V3(Math.cos(a) * .7, .55 + ((k * 37) % 10) / 22, Math.sin(a) * .7))) }
    // ---- foliage from tasks ----
    const leafTasks = done.filter(t => t.size !== 'flower'), flowerTasks = done.filter(t => t.size === 'flower');
    // ambient filler canopy so young trees still look alive
    const lush = clamp(.3 + st.xp / 900, 0, 1);
    const RF = mulberry(777);
    anchors.forEach((an, ai) => {
      const n = Math.round(6 * lush);
      for (let k = 0; k < n; k++)leafData.push({ p: an.clone().add(V3((RF() - .5) * 2.4, (RF() - .5) * 1.8, (RF() - .5) * 2.4)), e: [(RF() - .5) * 2, RF() * 6.28, (RF() - .5) * 2], s: .8 + RF() * .5, birth: 0, ci: Math.floor(RF() * GREENS.length) });
    });
    leafTasks.forEach((t, i) => {
      const an = anchors.length ? anchors[i % anchors.length] : apex;
      const R = mulberry(hashStr(t.id)); const n = (SIZES[t.size] || SIZES.leaf).leaves;
      const cx = an.x + (R() - .5) * .3, cy = an.y + (R() - .5) * .3, cz = an.z + (R() - .5) * .3;
      for (let k = 0; k < n; k++)leafData.push({ p: V3(cx + (R() - .5) * 0.9, cy + (R() - .5) * 0.7, cz + (R() - .5) * 0.9), e: [(R() - .5) * 2, R() * 6.28, (R() - .5) * 2], s: (t.size === 'branch' ? 1.05 : .8) + R() * .5, birth: births[t.id] || 0, ci: Math.floor(R() * GREENS.length) });
      addProxy(V3(cx, cy, cz), .85, { task: t });
      if (t.id === justGrewId) lastGrowthPos.set(cx, cy, cz);
    });
    // ---- flowers ----
    flowerTasks.forEach((t, i) => {
      const tip = tips.length ? tips[(i * 2 + 1) % tips.length] : apex;
      const R = mulberry(hashStr(t.id + 'f'));
      const pos = tip.clone().add(V3((R() - .5) * .8, .15, (R() - .5) * .8));
      const col = CATCOLORS[t.cat] || CATCOLORS.Work;
      const f = makeFlower(col[0], col[1], 1 + R() * .3);
      f.group.position.copy(pos); f.group.rotation.y = R() * 6.28; treeGroup.add(f.group);
      if (births[t.id]) flowerPops.push({ g: f.group, birth: births[t.id], s: f.group.scale.x });
      addProxy(pos.clone().add(V3(0, .8, 0)), .7, { task: t });
      if (t.id === justGrewId) lastGrowthPos.copy(pos).add(V3(0, .8, 0));
    });
    // ---- streak fruits ----
    const nf = Math.min(st.streak, 8);
    for (let i = 0; i < nf; i++) {
      const an = anchors.length ? anchors[(i * 5 + 2) % anchors.length] : apex;
      const fr = new THREE.Mesh(new THREE.SphereGeometry(.17, 12, 10), fruitMat);
      fr.position.copy(an).add(V3(0, -.25, 0)); fr.castShadow = true; treeGroup.add(fr);
      addProxy(fr.position, .5, { html: '<b>🍎 Streak fruit</b><br>Day ' + st.streak + ' of your streak!<br><span style="opacity:.75">Keep growing daily 🔥</span>' });
    }
    // ---- bird nest lvl>=5 ----
    if (st.lvl >= 5 && tips.length) {
      const nb = tips[2 % tips.length].clone().lerp(trunkPt(.6), .35);
      const nest = new THREE.Group(); nest.position.copy(nb);
      const bowl = new THREE.Mesh(new THREE.TorusGeometry(.34, .13, 8, 14), new THREE.MeshStandardMaterial({ color: 0x6e4525, roughness: 1 })); bowl.rotation.x = Math.PI / 2; nest.add(bowl);
      const eggM = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, roughness: .5 });
      [[-.1, 0], [.12, .06]].forEach(p => { const e = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 8), eggM); e.position.set(p[0], .1, p[1]); nest.add(e) });
      const birdM = new THREE.MeshStandardMaterial({ color: 0x4a90d9, roughness: .7 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), birdM); body.position.set(.3, .22, 0); nest.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), birdM); head.position.set(.38, .38, .04); nest.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(.04, .12, 6), new THREE.MeshStandardMaterial({ color: 0xe9a13b })); beak.position.set(.38, .37, .16); beak.rotation.x = Math.PI / 2; nest.add(beak);
      treeGroup.add(nest);
      addProxy(nb, .8, { html: '<b>🐦 A bird moved in!</b><br>Your Mighty Tree is now a home.<br><span style="opacity:.75">Level 5 reward</span>' });
    }
    // ---- enchanted glow ----
    crownGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe87a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    crownGlow.material._own = true; crownGlow.scale.set(9, 9, 1); crownGlow.position.copy(apex); treeGroup.add(crownGlow);
    finalizeLeaves();
  }
  const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _S = new THREE.Vector3(), _P = new THREE.Vector3();
  function finalizeLeaves() {
    if (!leafData.length) { leafMesh = null; return }
    const geo = new THREE.PlaneGeometry(.55, .7, 1, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setZ(i, Math.cos(y / .7 * Math.PI) * .09) }
    geo.computeVertexNormals();
    leafMesh = new THREE.InstancedMesh(geo, leafBaseMat, leafData.length);
    leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    leafMesh.castShadow = true; leafMesh.receiveShadow = true;
    leafMesh.customDepthMaterial = leafDepthMat;
    leafData.forEach((L, i) => {
      _E.set(L.e[0], L.e[1], L.e[2]); _Q.setFromEuler(_E); _S.setScalar(L.s); _M.compose(L.p, _Q, _S);
      leafMesh.setMatrixAt(i, _M); leafMesh.setColorAt(i, GREENS[L.ci % GREENS.length]);
      if (L.birth && clockT - L.birth < 2) leafYoung.push(i);
    });
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    treeGroup.add(leafMesh);
  }

  /* ---------- growth burst particles ---------- */
  const MAXP = 420;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3);
  const pVel = new Float32Array(MAXP * 3), pLife = new Float32Array(MAXP);
  for (let i = 0; i < MAXP; i++) { pPos[i * 3 + 1] = -999 }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3).setUsage(THREE.DynamicDrawUsage));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .22, map: glowTex, vertexColors: true, transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false; scene.add(points);
  let pCursor = 0;
  function burst(pos, n, colors) {
    const c = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const i = pCursor; pCursor = (pCursor + 1) % MAXP;
      pPos[i * 3] = pos.x; pPos[i * 3 + 1] = pos.y; pPos[i * 3 + 2] = pos.z;
      const a = Math.random() * 6.28, b = Math.random() * Math.PI - Math.PI / 2, sp = 1.5 + Math.random() * 3;
      pVel[i * 3] = Math.cos(a) * Math.cos(b) * sp; pVel[i * 3 + 1] = Math.abs(Math.sin(b)) * sp + 1.2; pVel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * sp;
      c.set(colors[k % colors.length]); pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
      pLife[i] = 1.1 + Math.random() * .6;
    }
    pGeo.attributes.color.needsUpdate = true;
  }
  function tickBurst(dt) {
    let any = false;
    for (let i = 0; i < MAXP; i++) {
      if (pLife[i] <= 0) continue; any = true;
      pLife[i] -= dt; pVel[i * 3 + 1] -= dt * 3.2;
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      if (pLife[i] <= 0) pPos[i * 3 + 1] = -999;
    }
    if (any) pGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- sun / moon / stars / clouds / fireflies / critters ---------- */
  // Sun: bright solid disc with glow
  const sunDiscTex = canvasTex(256, 256, (g, w, h) => {
    // outer glow
    const gr2 = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr2.addColorStop(0, 'rgba(255,255,220,1)');
    gr2.addColorStop(0.25, 'rgba(255,230,100,1)');
    gr2.addColorStop(0.45, 'rgba(255,200,50,0.85)');
    gr2.addColorStop(0.65, 'rgba(255,160,0,0.4)');
    gr2.addColorStop(1, 'rgba(255,120,0,0)');
    g.fillStyle = gr2; g.fillRect(0, 0, w, h);
  });
  const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunDiscTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sunSpr.scale.set(72, 72, 1); scene.add(sunSpr);
  const moonSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false }));
  moonSpr.scale.set(26, 26, 1); scene.add(moonSpr);
  const starGeo = new THREE.BufferGeometry();
  (function () {
    const N = 500, a = new Float32Array(N * 3), R = mulberry(64);
    for (let i = 0; i < N; i++) { const t = R() * Math.PI * 2, p = R() * Math.PI * .42 + .08, r = 205; a[i * 3] = r * Math.sin(p) * Math.cos(t); a[i * 3 + 1] = r * Math.cos(p); a[i * 3 + 2] = r * Math.sin(p) * Math.sin(t) }
    starGeo.setAttribute('position', new THREE.BufferAttribute(a, 3))
  })();
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const stars = new THREE.Points(starGeo, starMat); scene.add(stars);
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: .95, depthWrite: false });
  const clouds = [];
  (function () {
    const R = mulberry(77);
    for (let i = 0; i < 7; i++) { const s = new THREE.Sprite(cloudMat); const sc = 16 + R() * 20; s.scale.set(sc, sc * .42, 1); s.position.set(-110 + R() * 220, 26 + R() * 20, -60 + R() * 80); s.userData.v = .5 + R() * .9; scene.add(s); clouds.push(s) }
  })();
  const flyGeo = new THREE.BufferGeometry();
  (function () {
    const N = 70, a = new Float32Array(N * 3), R = mulberry(88);
    for (let i = 0; i < N; i++) { const t = R() * 6.28, r = 2 + R() * 8; a[i * 3] = Math.cos(t) * r; a[i * 3 + 1] = .6 + R() * 6.5; a[i * 3 + 2] = Math.sin(t) * r }
    flyGeo.setAttribute('position', new THREE.BufferAttribute(a, 3))
  })();
  const flyMat = new THREE.PointsMaterial({ color: 0xffe87a, size: .4, map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flies = new THREE.Points(flyGeo, flyMat); scene.add(flies);
  // butterflies
  const butterflies = [];
  (function () {
    const cols = [0xff9d4d, 0xffffff, 0x7cc4ff];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const wm = new THREE.MeshBasicMaterial({ color: cols[i], side: THREE.DoubleSide, transparent: true, opacity: .95 }); wm._own = true;
      const wgeo = new THREE.PlaneGeometry(.3, .24); wgeo.translate(.15, 0, 0);
      const wl = new THREE.Mesh(wgeo, wm), wr = new THREE.Mesh(wgeo, wm); wr.rotation.y = Math.PI; g.add(wl); g.add(wr);
      g.userData = { wl: wl, wr: wr, ph: i * 2.1, sp: .5 + i * .16, rx: 3.5 + i * 1.5, rz: 3 + i * 1.2 };
      scene.add(g); butterflies.push(g);
    }
  })();
  // gulls
  const gulls = [];
  (function () {
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      const wm = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }); wm._own = true;
      const wgeo = new THREE.PlaneGeometry(.9, .22); wgeo.translate(.45, 0, 0);
      const wl = new THREE.Mesh(wgeo, wm), wr = new THREE.Mesh(wgeo, wm); wr.rotation.y = Math.PI; g.add(wl); g.add(wr);
      g.userData = { wl: wl, wr: wr, ph: i * 3.1, r: 17 + i * 6, h: 13 + i * 4, sp: .35 + i * .1 };
      scene.add(g); gulls.push(g);
    }
  })();

  /* ---------- sky presets + transitions ---------- */
  const SKY = {
    day: { top: 0x5eb6ef, hor: 0xcfe9f7, fogN: 46, fogF: 190, sun: 0xfff1cf, sunI: 2.2, hemiI: 1.2, ambI: 0.6, sunPos: [26, 42, 18], cloud: 0xffffff, cloudO: .95, star: 0, fire: 0, expo: 1.05, water: 0x5fb3d9 },
    sunset: { top: 0x2e2070, hor: 0xff6030, fogN: 40, fogF: 175, sun: 0xff8040, sunI: 2.0, hemiI: 1.0, ambI: 0.5, sunPos: [46, 12, -6], cloud: 0xffb090, cloudO: .88, star: .08, fire: .25, expo: 1.15, water: 0xe0602a },
    night: { top: 0x102040, hor: 0x2a4a8e, fogN: 42, fogF: 180, sun: 0xaac8ff, sunI: 1.2, hemiI: 0.8, ambI: 0.6, sunPos: [-24, 34, -18], cloud: 0x2a3a5e, cloudO: .45, star: 1, fire: 1, expo: 1.0, water: 0x1a3060 }
  };
  const cur = { top: new THREE.Color(0x3d8fd6), hor: new THREE.Color(0xcfe9f7), fogN: 46, fogF: 190, sun: new THREE.Color(0xfff1cf), sunI: 1.35, hemiI: .85, ambI: .22, sunPos: V3(26, 42, 18), cloud: new THREE.Color(0xffffff), cloudO: .95, star: 0, fire: 0, expo: 1.05, water: new THREE.Color(0x5fb3d9) };
  const _c1 = new THREE.Color(), _c2 = new THREE.Color();
  function skyMode() { if (state.sky !== 'auto') return state.sky; const h = new Date().getHours(); return (h >= 6 && h < 17) ? 'day' : (h >= 17 && h < 19.5) ? 'sunset' : 'night' }
  let skyInit = false;
  function tickSky(dt) {
    const T = SKY[skyMode()]; const k = skyInit ? 1 - Math.exp(-dt * 2.2) : 1; skyInit = true;
    _c1.set(T.top); cur.top.lerp(_c1, k); _c1.set(T.hor); cur.hor.lerp(_c1, k);
    cur.fogN = lerp(cur.fogN, T.fogN, k); cur.fogF = lerp(cur.fogF, T.fogF, k);
    _c1.set(T.sun); cur.sun.lerp(_c1, k); cur.sunI = lerp(cur.sunI, T.sunI, k);
    cur.hemiI = lerp(cur.hemiI, T.hemiI, k); cur.ambI = lerp(cur.ambI, T.ambI, k);
    _P.set(T.sunPos[0], T.sunPos[1], T.sunPos[2]); cur.sunPos.lerp(_P, k);
    _c1.set(T.cloud); cur.cloud.lerp(_c1, k); cur.cloudO = lerp(cur.cloudO, T.cloudO, k);
    cur.star = lerp(cur.star, T.star, k); cur.fire = lerp(cur.fire, T.fire, k); cur.expo = lerp(cur.expo, T.expo, k);
    _c1.set(T.water); cur.water.lerp(_c1, k);
    skyUni.top.value.copy(cur.top); skyUni.hor.value.copy(cur.hor);
    scene.fog.color.copy(cur.hor); scene.fog.near = cur.fogN; scene.fog.far = cur.fogF;
    sun.color.copy(cur.sun); sun.intensity = cur.sunI; sun.position.copy(cur.sunPos); sun.target.position.set(0, 0, 0);
    hemi.intensity = cur.hemiI; hemi.color.copy(cur.hor); amb.intensity = cur.ambI;
    renderer.toneMappingExposure = cur.expo;
    cloudMat.color.copy(cur.cloud); cloudMat.opacity = cur.cloudO;
    starMat.opacity = cur.star;
    const st = stats();
    flyMat.opacity = Math.max(cur.fire, st.lvl >= 7 ? .55 : 0);
    waterMat.color.copy(cur.water);
    const nightF = cur.star;
    // Sun: bright during day, orange during sunset, hidden at night
    const sunPos = cur.sunPos.clone().normalize().multiplyScalar(195);
    sunSpr.position.copy(sunPos);
    sunSpr.material.color.copy(cur.sun);
    sunSpr.material.opacity = Math.max(0, 1 - nightF * 1.6);
    sunSpr.visible = nightF < .65;
    // Sun scale: big bright circle during day, smaller orange ball at sunset
    const sunScale = nightF < .12 ? 72 : 55;
    sunSpr.scale.set(sunScale, sunScale, 1);
    // Moon: opposite quadrant from sun, visible at night
    const moonDir = new THREE.Vector3(-cur.sunPos.x * 0.7, Math.abs(cur.sunPos.y) * 0.8 + 10, -cur.sunPos.z * 0.7).normalize();
    moonSpr.position.copy(moonDir).multiplyScalar(195);
    moonSpr.material.opacity = Math.min(1, nightF * 1.3);
    moonSpr.visible = nightF > .2;
    moonSpr.scale.set(38, 38, 1);
    if (crownGlow) crownGlow.material.opacity = st.lvl >= 7 ? .35 + Math.sin(clockT * 2) * .1 : 0;
  }

  /* ---------- orbit camera ---------- */
  let tTheta = .75, tPhi = 1.0, tR = 15.5, theta = .75, phi = 1.0, R = 15.5;
  const camTarget = V3(0, 3.6, 0);
  function applyCam() {
    const sp = Math.sin(phi);
    camera.position.set(camTarget.x + R * sp * Math.sin(theta), camTarget.y + R * Math.cos(phi), camTarget.z + R * sp * Math.cos(theta));
    camera.lookAt(camTarget);
  }
  let lastInteract = 0, dragging = false;
  let mouseNX = 0, mouseNY = 0, mouseCX = 0, mouseCY = 0, mouseIn = false, hoverTip = null;
  (function controls() {
    const el = renderer.domElement; const ptrs = new Map(); let moved = 0, pinchD = 0;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => {
      el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragging = true; moved = 0; lastInteract = clockT;
      if (ptrs.size === 2) { const p = [...ptrs.values()]; pinchD = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) }
    });
    el.addEventListener('pointermove', e => {
      const rect = el.getBoundingClientRect();
      mouseNX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouseCX = e.clientX; mouseCY = e.clientY; mouseIn = true;
      if (!ptrs.has(e.pointerId)) return;
      const p = ptrs.get(e.pointerId); const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy);
      p.x = e.clientX; p.y = e.clientY; lastInteract = clockT;
      if (ptrs.size === 1) { tTheta -= dx * .0055; tPhi = clamp(tPhi - dy * .005, .3, 1.45) }
      else if (ptrs.size === 2) { const q = [...ptrs.values()]; const d = Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y); if (pinchD > 0) tR = clamp(tR - (d - pinchD) * .03, 7, 34); pinchD = d }
    });
    const up = e => { ptrs.delete(e.pointerId); if (ptrs.size === 0) dragging = false; if (moved < 7 && e.type === 'pointerup') handleTap(e) };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => { mouseIn = false });
    el.addEventListener('wheel', e => { e.preventDefault(); tR = clamp(tR * (1 + e.deltaY * .0011), 7, 34); lastInteract = clockT }, { passive: false });
  })();
  function tickCam(dt) {
    if (state.rot && clockT - lastInteract > 5) tTheta += dt * .07;
    const k = 1 - Math.exp(-dt * 7);
    theta = lerp(theta, tTheta, k); phi = lerp(phi, tPhi, k); R = lerp(R, tR, k);
    applyCam();
  }

  /* ---------- hover tooltip (raycast) ---------- */
  const ray = new THREE.Raycaster();
  function tickHover() {
    const tip = document.getElementById('tooltip');
    if (!tip) { return }
    if (!mouseIn || dragging || !proxies.length) { tip.style.display = 'none'; renderer.domElement.style.cursor = 'grab'; hoverTip = null; return }
    ray.setFromCamera({ x: mouseNX, y: mouseNY }, camera);
    const hit = ray.intersectObjects(proxies, false)[0];
    if (!hit) { tip.style.display = 'none'; renderer.domElement.style.cursor = 'grab'; hoverTip = null; return }
    const d = hit.object.userData.tip; hoverTip = d;
    tip.innerHTML = d.html ? d.html : (function () { const t = d.task; return '<b>' + (SIZES[t.size] || SIZES.leaf).icon + ' ' + esc(t.title) + '</b><br>🍃 ' + (SIZES[t.size] || SIZES.leaf).label + ' · ⏳ ' + t.hours + 'h · ' + esc(t.cat) + '<br><span style="opacity:.75">Grown ' + new Date(t.completedAt).toLocaleDateString() + '</span>' })();
    tip.style.display = 'block';
    const tipRect = container.getBoundingClientRect(); tip.style.left = Math.min(mouseCX + 16, tipRect.right - 245) + 'px';
    tip.style.top = Math.max(8, mouseCY - 10) + 'px';
    renderer.domElement.style.cursor = 'pointer';
  }
  function handleTap() {
    if (!hoverTip) return;
    if (hoverTip.html) { toast('✨ A living reward on your tree!'); return }
    const t = hoverTip.task; toast((SIZES[t.size] || SIZES.leaf).icon + ' "' + t.title + '" — part of your tree 💚');
  }

  /* ---------- sandbox-safe modal dialogs (confirm/prompt are blocked in previews) ---------- */
  function uiModal(o) {
    return new Promise(res => {
      const w = $('#modalWrap'), msg = $('#modalMsg'), inp = $('#modalInput'), ok = $('#modalOk'), cx = $('#modalCancel');
      let done = false;
      const fin = v => { if (done) return; done = true; w.classList.remove('show'); ok.onclick = cx.onclick = w.onclick = inp.onkeydown = null; res(v) };
      msg.textContent = o.msg; ok.textContent = o.ok || 'OK';
      inp.style.display = o.input ? 'block' : 'none';
      if (o.input) { inp.value = o.def || ''; setTimeout(() => { try { inp.focus(); inp.select() } catch (_) { } }, 60) }
      ok.onclick = () => fin(o.input ? inp.value.trim() : true);
      cx.onclick = () => fin(o.input ? null : false);
      w.onclick = e => { if (e.target === w) fin(o.input ? null : false) };
      inp.onkeydown = e => { if (e.key === 'Enter') fin(inp.value.trim()); if (e.key === 'Escape') fin(null) };
      w.classList.add('show');
    });
  }
  function uiConfirm(msg, ok) { return uiModal({ msg: msg, ok: ok || 'OK' }) }
  function uiPrompt(msg, def) { return uiModal({ msg: msg, ok: 'Save', input: true, def: def }) }
  /* ---------- UI: toasts / floats ---------- */
  function toast(msg, gold) {
    const d = document.createElement('div'); d.className = 'toast' + (gold ? ' gold' : ''); d.innerHTML = msg;
    const box = document.getElementById('toasts');
    if (!box) { return }
    box.appendChild(d);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { d.style.transition = '.5s'; d.style.opacity = '0'; setTimeout(() => d.remove(), 500) }, 3200);
  }
  const _v = new THREE.Vector3();
  function xpFloat(txt, worldPos) {
    _v.copy(worldPos || V3(0, 4, 0)).project(camera);
    const d = document.createElement('div'); d.className = 'xpf'; d.textContent = txt;
    d.style.left = ((_v.x * .5 + .5) * window.innerWidth) + 'px';
    d.style.top = ((-_v.y * .5 + .5) * window.innerHeight) + 'px';
    document.body.appendChild(d); setTimeout(() => d.remove(), 1800);
  }



  const clock = new THREE.Clock();

  function animate() {
    window._treeReqId = requestAnimationFrame(animate);
    const dt = clock.getDelta();
    clockT += dt;

    if (typeof tickSky === 'function') tickSky(dt);
    if (typeof tickCam === 'function') tickCam(dt);
    if (typeof tickBurst === 'function') tickBurst(dt);
    if (typeof tickHover === 'function') tickHover();

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }


  // Kick off initial rendering and environment setup if not yet done
  buildEnv();
  if (typeof buildTree === 'function') buildTree();
  if (typeof applyCam === 'function') applyCam();
  animate();

  /* ---------- UI render ---------- */

  return {
    setSky: (mode) => {
      state.sky = mode;
      // Force immediate update of sky state if needed, or tickSky will handle it
    },
    updateTasks: (newTasks) => {
      tasks = newTasks;
      buildEnv();
      if (typeof buildTree === 'function') buildTree();
    },
    cleanup: () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(window._treeReqId);
      if (renderer) {
        renderer.dispose();
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      }
    }
  };
}
