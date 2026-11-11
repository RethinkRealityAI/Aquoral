/* Aquoral Canada: inner-page hero droplet.
   A clear, real-time 3D water droplet floats in every .page-hero panel, refracting a small orchid
   "brand dot" behind it, with slow ripples spreading on the panel below it. Replaces the old
   wave/mountain swirl art (Dapo 2026-11-11: "more slick and premium").

   Layout comes from CSS: .ph-anchor marks where the droplet sits and how big it is, per breakpoint.
   The canvas fills the rounded panel, and its backdrop is painted in the panel's own solid colour
   (read from the computed style of .page-hero::before), so it is seamless in both themes.
   Rendering pauses when the hero is off screen or the tab is hidden. No WebGL: the panel stays as is. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const hero = document.querySelector('.page-hero');
const fx = hero?.querySelector('.ph-fx');
const anchor = hero?.querySelector('.ph-anchor');
const canvas = fx?.querySelector('canvas');

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

if (hero && fx && anchor && canvas && webglOK()) init();

function init() {
  const params = new URLSearchParams(location.search);
  const isPhone = matchMedia('(max-width: 860px), (pointer: coarse)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Dapo wants motion to autoplay even with Reduce Motion on; it is slower and smaller there instead.
  const speed = params.has('still') ? 0 : reduce ? .45 : 1;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isPhone ? 2 : 1.75));
  renderer.toneMapping = THREE.NoToneMapping;   // keeps the refracted panel colour exact, so the droplet reads clear, not grey
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envLight = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  const studio = new THREE.Scene(); studio.background = new THREE.Color('#1b2a4a');
  for (const [x, y, z, w, h] of [[0, 6, 0, 10, 4], [-7, 1, 2, 2, 6], [7, 2, -1, 2, 5], [0, -6, 0, 12, 3]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m);
  }
  const envDark = pmrem.fromScene(studio, .02).texture;
  scene.environment = envLight;
  scene.environmentIntensity = 1;

  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  camera.position.set(0, 0, 12);
  const PLANE_Z = -3;

  /* Backdrop: the panel colour, a soft caustic pool under the droplet and slow ripple rings. */
  const bgU = {
    uBg: { value: new THREE.Color() }, uRing: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
    uDrop: { value: new THREE.Vector2() }, uR: { value: 1 }, uTime: { value: 0 }, uRingA: { value: .5 }, uGlowA: { value: .5 },
  };
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShaderMaterial({
    uniforms: bgU, toneMapped: false, depthWrite: false,
    vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xy; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform vec3 uBg, uRing, uGlow; uniform vec2 uDrop; uniform float uR, uTime, uRingA, uGlowA; varying vec2 vW;
      void main(){
        vec2 d = (vW - uDrop) / uR; d.y *= 3.4;            // a horizontal surface seen at a low angle
        float r = length(d);
        float glow = exp(-r * r * 2.2) * uGlowA;             // light focused through the droplet
        float rings = 0.;
        for (int i = 0; i < 3; i++) {
          float ph = fract(uTime * .11 + float(i) / 3.);
          float rr = .25 + ph * 2.1;
          float band = exp(-pow((r - rr) * 9., 2.));
          rings += band * pow(1. - ph, 1.6) * smoothstep(0., .12, ph);
        }
        vec3 c = mix(uBg, uGlow, clamp(glow, 0., 1.));
        c = mix(c, uRing, clamp(rings * uRingA, 0., 1.));
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`,
  }));
  backdrop.position.z = PLANE_Z;
  scene.add(backdrop);

  /* The droplet: a lathe teardrop, rounded base and soft tip, with a gentle liquid wobble. */
  const prof = [];
  const N = 72;
  for (let i = 0; i <= N; i++) {
    const t = i / N * Math.PI;                       // 0 = tip, PI = base
    const x = Math.sin(t) * Math.pow(Math.sin(t / 2), 1.35);
    const y = Math.cos(t);
    prof.push(new THREE.Vector2(Math.max(x, 1e-4) * .92, y));
  }
  const geo = new THREE.LatheGeometry(prof, 96);
  geo.computeVertexNormals();
  const time = { value: 0 };
  const dropMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: .02, transmission: 1, thickness: 1.6, ior: 1.333,
    attenuationColor: new THREE.Color('#cfeefc'), attenuationDistance: 6,
    clearcoat: 1, clearcoatRoughness: .02, specularIntensity: 1, envMapIntensity: 1.25,
  });
  dropMat.onBeforeCompile = (s) => {
    s.uniforms.uTime = time;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float tipW = smoothstep(-.2, 1., position.y);
        float wob = sin(position.y * 3.1 + uTime * 1.7) * .018 + sin(atan(position.z, position.x) * 3. + uTime * 1.1 + position.y * 2.) * .014;
        transformed.xz *= 1. + wob * (.6 + tipW);
        transformed.y += sin(uTime * 1.3) * .02 * (1. - tipW);`);
  };
  const drop = new THREE.Mesh(geo, dropMat);
  scene.add(drop);

  /* The orchid brand dot from the logo, small and behind the droplet, so the droplet magnifies it. */
  const dotMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#D42A8E'), roughness: .18, clearcoat: 1, clearcoatRoughness: .1 });
  const dot = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), dotMat);
  scene.add(dot);

  /* Two small satellite beads for depth. */
  const beads = [0].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), dropMat); scene.add(m); return m; });

  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-3, 5, 6); scene.add(key);

  /* Theme: copy the panel's solid colour and choose ring and glow colours for that ground. */
  function applyTheme() {
    const cs = getComputedStyle(hero, '::before');
    let bg = cs.backgroundColor;
    if (!bg || bg === 'transparent' || /rgba\(.*,\s*0\)/.test(bg)) bg = getComputedStyle(hero).backgroundColor;
    const c = new THREE.Color(); c.setStyle(bg, THREE.SRGBColorSpace);
    bgU.uBg.value.copy(c);
    renderer.setClearColor(c);
    const lightGround = c.getHSL({}).l > .6;
    if (lightGround) {
      bgU.uRing.value.setStyle('#254C9E', THREE.SRGBColorSpace); bgU.uRingA.value = .2;
      bgU.uGlow.value.setStyle('#A3DAF4', THREE.SRGBColorSpace); bgU.uGlowA.value = .75;
      dropMat.attenuationColor.setStyle('#d6effb', THREE.SRGBColorSpace); dropMat.attenuationDistance = 14;
      scene.environment = envDark; scene.environmentIntensity = 1.5;
    } else {
      bgU.uRing.value.setStyle('#A3DAF4', THREE.SRGBColorSpace); bgU.uRingA.value = .3;
      bgU.uGlow.value.setStyle('#3d6fc4', THREE.SRGBColorSpace); bgU.uGlowA.value = .55;
      dropMat.attenuationColor.setStyle('#dff3fd', THREE.SRGBColorSpace); dropMat.attenuationDistance = 7;
      scene.environment = envLight; scene.environmentIntensity = 1.35;
    }
  }

  /* Layout: map the .ph-anchor box (CSS pixels) to world units on the droplet's plane. */
  const L = { cx: 0, cy: 0, h: 1, unit: 1 };
  function layout() {
    const fr = fx.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    const w = Math.max(1, fr.width), h = Math.max(1, fr.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const worldH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const unit = worldH / h;                          // world units per CSS pixel at z = 0
    L.unit = unit;
    L.cx = (ar.left + ar.width / 2 - fr.left - w / 2) * unit;
    L.cy = -(ar.top + ar.height / 2 - fr.top - h / 2) * unit;
    // Teardrop is 2 units tall and ~1.25 wide; fit it inside the anchor box with room for the bob.
    L.h = Math.min(ar.height * unit * .38, ar.width * unit * .6);
    applyLayout(0);
  }
  function applyLayout(t) {
    const s = L.h, bob = Math.sin(t * .9) * s * .045;
    drop.scale.setScalar(s);
    drop.position.set(L.cx, L.cy + s * .12 + bob, 0);
    drop.rotation.set(Math.sin(t * .5) * .06, t * .35, Math.sin(t * .37) * .05 - .04);
    dot.scale.setScalar(s * .14);
    dot.position.set(L.cx * 1.2, (L.cy - s * .1) * 1.2 + bob * .3, -2.4);
    beads[0].scale.setScalar(s * .085);
    beads[0].position.set(L.cx + s * .9, L.cy - s * .25 + Math.sin(t * 1.1 + 1) * s * .06, .3);
    // Ripples centre on the panel just below the droplet's base, scaled to the droplet.
    const k = (camera.position.z - PLANE_Z) / camera.position.z;   // project onto the backdrop plane
    bgU.uDrop.value.set(L.cx * k, (L.cy - s * 1.15) * k);
    bgU.uR.value = s * 1.5 * k;
  }

  applyTheme(); layout();
  addEventListener('aq:theme', () => { applyTheme(); renderOnce(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { applyTheme(); renderOnce(); });
  new MutationObserver(() => { applyTheme(); renderOnce(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  new ResizeObserver(() => { layout(); renderOnce(); }).observe(fx);

  let visible = true, running = false, last = performance.now(), t = 0;
  function renderOnce() { applyLayout(t); time.value = t * speed; bgU.uTime.value = t; renderer.render(scene, camera); }
  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, .05); last = now;
    t += dt * speed;
    renderOnce();
    requestAnimationFrame(frame);
  }
  function setRun(on) {
    if (on === running) return;
    running = on;
    if (on) { last = performance.now(); requestAnimationFrame(frame); }
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; setRun(visible && !document.hidden); }).observe(hero);
  document.addEventListener('visibilitychange', () => setRun(visible && !document.hidden));

  renderer.compileAsync?.(scene, camera).catch(() => {}).finally(() => {
    renderOnce();
    requestAnimationFrame(() => { fx.classList.add('is-ready'); setRun(visible && !document.hidden); });
  }) ?? (renderOnce(), fx.classList.add('is-ready'), setRun(true));
  window.__drop = { renderer, scene, camera, layout, applyTheme };
}
