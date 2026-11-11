/* Aquoral Canada — shared 3D stage.
   One fixed full-viewport WebGL canvas behind the page. Sections mark where the product should
   sit with <div class="stage-slot" data-slot="hero|anatomy|explore|order">. As the visitor scrolls,
   the product glides between slots (pose blending by distance to the viewport centre), so the same
   bottle that forms in the hero lands on the left of the anatomy section, then stands in the
   middle of the "who it helps" orbit.

   Flags: ?q=low|high quality · ?still skip intro · ?debug overlay
   Models come from window.AQ_GLB (base64, artifact build) or assets/models/*.glb. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const root = document.documentElement;
const canvas = document.getElementById('stage');
const params = new URLSearchParams(location.search);
const isPhone = matchMedia('(max-width: 860px), (pointer: coarse)').matches;
const QUALITY = params.get('q') || (isPhone ? 'low' : 'high');
const HIGH = QUALITY === 'high';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('still');
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ease = {
  in: t => t * t, out: t => 1 - (1 - t) ** 3, inOut: t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  back: t => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; }
};
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const dampAngle = (a, b, k, dt) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * (1 - Math.exp(-k * dt)); };

if (canvas) boot().catch(err => { console.error(err); fail(); });

function fail() { root.classList.remove('stage-ready'); root.classList.add('stage-failed'); document.dispatchEvent(new Event('aq:intro-done')); }

/* ---------- Poses: what each slot asks of the product ---------- */
const POSES = {
  //       fit: composition height (bottle = 1) that fills the slot; fitW: width
  hero:    { fit: 1.1, fitW: .9, spin: 1, box: 1, floor: 1, grid: 0, explode: 0, orbit: 0, bx: -.13, bz: .16, xx: .3, xz: -.42, xyaw: -.45 , twin: 0 },
  anatomy: { fit: 1.4, fitW: .52, spin: 0, box: 0, floor: 0, grid: 1, explode: 0, orbit: 0, bx: 0, bz: 0, xx: .42, xz: -.55, xyaw: -.5 , twin: 0 },
  explore: { fit: 1.25, fitW: .9, spin: 1, box: 0, floor: 0, grid: 0, explode: 0, orbit: 1, bx: 0, bz: 0, xx: .42, xz: -.55, xyaw: -.5 , twin: 0 },
  order:   { fit: 1.05, fitW: .9, spin: 1, box: 1, floor: 1, grid: 0, explode: 0, orbit: 0, bx: -.13, bz: .16, xx: .3, xz: -.42, xyaw: -.45 , twin: 0 }
};
const KEYS = ['x', 'y', 's', 'box', 'floor', 'grid', 'explode', 'orbit', 'bx', 'bz', 'xx', 'xz', 'xyaw', 'spin', 'twin'];

async function boot() {
  const css = (n, fb) => (getComputedStyle(root).getPropertyValue(n).trim() || fb);
  const COL = {
    top: css('--stage-top', '#04131D'), bot: css('--stage-bot', '#0A2A3D'), halo: css('--stage-halo', '#15608A'),
    rim: css('--stage-rim', '#5FE0D6'), water: css('--stage-water', '#D9FBF8'), floor: css('--stage-floor', '#04131D'),
    caustic: css('--stage-caustic', '#5FE0D6'), mote: css('--stage-mote', '#CFF7F3'), grid: css('--stage-grid', '#5FE0D6')
  };
  const C = k => new THREE.Color(COL[k]);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !HIGH, powerPreference: 'high-performance', alpha: false }); }
  catch (e) { fail(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, HIGH ? 2 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = .86;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, .1, 300);
  const CAM_D = 12;
  camera.position.set(0, 0, CAM_D); camera.lookAt(0, 0, 0);
  const WORLD_H = 2 * CAM_D * Math.tan(THREE.MathUtils.degToRad(11));

  /* Studio environment: dark room + softboxes, so glossy plastic reads as real */
  {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0a1c28, side: THREE.BackSide })));
    const box = (w, h, pos, k, tint = 0xffffff) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.copy(pos); m.lookAt(0, pos.y * .3, 0); env.add(m);
    };
    box(3.2, 9, new THREE.Vector3(-6, 3, 4), 7);
    box(2.2, 9, new THREE.Vector3(6.5, 3, 2), 3, 0xeef6fa);
    box(9, 5, new THREE.Vector3(0, 9, 0), 4);
    box(5, 8, new THREE.Vector3(0, 3, -8), 2.2, 0x6fd0ca);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, .035).texture; pm.dispose();
  }

  /* Lights (decay 0 so they are independent of how big the product is on screen) */
  const key = new THREE.SpotLight(0xffffff, 2.5, 0, Math.PI / 7, .55, 0);
  key.castShadow = true; key.shadow.mapSize.set(HIGH ? 2048 : 1024, HIGH ? 2048 : 1024);
  key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 6;
  const rimL = new THREE.SpotLight(C('rim'), 2.9, 0, Math.PI / 6, .7, 0);
  const rimR = new THREE.SpotLight(C('rim'), 2.3, 0, Math.PI / 6, .7, 0);
  scene.add(key, key.target, rimL, rimL.target, rimR, rimR.target);
  scene.add(new THREE.HemisphereLight(0x1b6189, 0x081d2b, .16));

  /* Backdrop: sweep with a halo that follows the product */
  const backdrop = new THREE.Mesh(new THREE.SphereGeometry(80, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    uniforms: { uTop: { value: C('top') }, uBot: { value: C('bot') }, uHalo: { value: C('halo') }, uHaloDir: { value: new THREE.Vector3(0, 0, -1) }, uHaloK: { value: .6 }, uHaloW: { value: 9 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uTop,uBot,uHalo,uHaloDir; uniform float uHaloK,uHaloW; varying vec3 vDir;
      void main(){
        float y = clamp(vDir.y*1.6+.35, 0., 1.);
        vec3 c = mix(uBot, uTop, smoothstep(0.,1.,y));
        float d = distance(vDir, uHaloDir);
        c = mix(c, uHalo, uHaloK * exp(-d*d*uHaloW));
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`
  }));
  scene.add(backdrop);

  /* Blueprint grid plane (anatomy) */
  const gridMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uK: { value: 0 }, uColor: { value: C('grid') }, uCenter: { value: new THREE.Vector2() }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uK,uTime; uniform vec3 uColor; uniform vec2 uCenter; varying vec2 vP;
      float line(float v, float w){ float f = abs(fract(v-.5)-.5)/fwidth(v); return 1.-min(f/w,1.); }
      void main(){
        vec2 p = vP*1.6;
        float minor = max(line(p.x*2.,1.), line(p.y*2.,1.))*.35;
        float major = max(line(p.x,1.2), line(p.y,1.2));
        float r = length(vP - uCenter);
        float fade = exp(-r*r*.045);
        float ring = smoothstep(.04,.0,abs(r - mod(uTime*.6, 9.)))*exp(-r*.25)*.5;   // slow sonar ripple
        float a = (max(minor, major*.75) * .32 + ring) * fade * uK;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
    extensions: { derivatives: true }
  });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), gridMat);
  grid.position.z = -2.4; scene.add(grid);

  /* Floor group: reflector + caustic pool + shadow; follows the product base */
  const floorG = new THREE.Group(); scene.add(floorG);
  let reflector = null;
  if (HIGH) {
    // Water-over-pool reflector: the mirror image is gently displaced by slow procedural swells so it shimmers like shallow water
    const waterShader = {
      name: 'AqWaterReflector',
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: { value: 0 } },
      vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec2 vP;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        void main(){ vUv = textureMatrix * vec4(position, 1.); vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float uTime; varying vec4 vUv; varying vec2 vP;
        #include <logdepthbuf_pars_fragment>
        vec2 swell(vec2 p, float t){ vec2 g = vec2(0.);
          vec2 d1 = normalize(vec2(1., .35)), d2 = normalize(vec2(-.6, 1.)), d3 = normalize(vec2(.2, -1.));
          g += d1 * cos(dot(p, d1) * 3.1 + t * .9) * .55; g += d2 * cos(dot(p, d2) * 4.3 - t * 1.2) * .35; g += d3 * cos(dot(p, d3) * 7.7 + t * 1.6) * .18;
          float r = length(p); g += normalize(p + .0001) * cos(r * 9. - t * 2.2) * .12 * exp(-r * .5);   // soft rings around the product
          return g; }
        float blendOverlay(float b, float s){ return b < .5 ? 2. * b * s : 1. - 2. * (1. - b) * (1. - s); }
        vec3 blendOverlay(vec3 b, vec3 s){ return vec3(blendOverlay(b.r, s.r), blendOverlay(b.g, s.g), blendOverlay(b.b, s.b)); }
        void main(){
          #include <logdepthbuf_fragment>
          vec2 n = swell(vP, uTime);
          vec4 uv = vUv; uv.xy += n * .028 * uv.w;
          vec4 base = texture2DProj(tDiffuse, uv);
          float glint = pow(clamp(.5 + .5 * n.x, 0., 1.), 14.) * .18 * exp(-length(vP) * .35);
          gl_FragColor = vec4(blendOverlay(base.rgb, color) + glint, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    };
    reflector = new Reflector(new THREE.CircleGeometry(9, 64), { textureWidth: Math.min(1536, innerWidth), textureHeight: Math.min(1536, innerHeight), color: 0x8899a0, clipBias: .003, shader: waterShader });
    reflector.rotation.x = -Math.PI / 2; floorG.add(reflector);
  }
  const floorMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uFloor: { value: C('floor') }, uCaustic: { value: C('caustic') }, uRefl: { value: HIGH ? 1 : 0 }, uCausticK: { value: 0 }, uFar: { value: C('bot') }, uK: { value: 1 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uTime,uRefl,uCausticK,uK; uniform vec3 uFloor,uCaustic,uFar; varying vec2 vP;
      float caustic(vec2 p){ vec2 q = p*5.; float t = uTime*.35, c = 0.;
        for(int i=0;i<3;i++){ q += vec2(sin(q.y*1.7+t), cos(q.x*1.5-t*1.1))*.55; c += .5/length(vec2(sin(q.x), cos(q.y))+.001); t*=1.27; }
        return pow(clamp(c*.18-.22,0.,1.), 2.6); }
      void main(){
        float r = length(vP);
        float pool = exp(-r*r*.45);
        vec3 col = mix(uFar, uFloor, smoothstep(9., 1.4, r));
        col += uCaustic * caustic(vP) * pool * uCausticK * .55;
        col *= mix(1., 1.14, pool);
        // shallow-water sheen: slow interfering swells catch the light (also gives phones, which have no mirror, a water read)
        float sw = sin(dot(vP, vec2(2.9, 1.)) + uTime * .9) * .55 + sin(dot(vP, vec2(-2.6, 4.1)) - uTime * 1.2) * .35 + sin(length(vP) * 9. - uTime * 2.2) * .25 * exp(-length(vP) * .5);
        col += vec3(.55, .78, .95) * pow(clamp(.5 + .5 * sw, 0., 1.), 10.) * pool * .14 * uK;
        float a = uRefl > .5 ? mix(.64, 1., smoothstep(.6, 4., r)) : 1.;
        a = mix(1., a, smoothstep(.7, 1., uK));
        a *= smoothstep(19., 9., r) * smoothstep(0., .7, uK);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(26, 64), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = .001; floor.renderOrder = 1; floorG.add(floor);
  const shadowMat = new THREE.ShadowMaterial({ color: C('top'), opacity: .55, transparent: true });
  const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(3, 48), shadowMat);
  shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = .002; shadowCatcher.receiveShadow = true; shadowCatcher.renderOrder = 2; floorG.add(shadowCatcher);
  const contactTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(2,10,16,.9)'); gr.addColorStop(.5, 'rgba(2,10,16,.3)'); gr.addColorStop(1, 'rgba(2,10,16,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const contactMat = new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false, opacity: 0 });

  /* Motes: drifting micro-droplets */
  const MOTES = HIGH ? 55 : 28;
  const mg = new THREE.BufferGeometry(), mp = new Float32Array(MOTES * 3), ms = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) { const a = Math.random() * Math.PI * 2, r = .5 + Math.random() * 3.2; mp.set([Math.cos(a) * r, Math.random() * 2.2, -Math.abs(Math.sin(a) * r) - .25 + (Math.random() - .5) * .6], i * 3); ms[i] = Math.random(); }
  mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('seed', new THREE.BufferAttribute(ms, 1));
  const motesMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: C('mote') }, uPx: { value: 1 }, uK: { value: 0 } },
    vertexShader: `attribute float seed; uniform float uTime,uPx; varying float vA;
      void main(){ vec3 p = position; float t = uTime*(.015+.02*seed);
        p.y = mod(p.y + t*2., 2.2); p.x += sin(uTime*.2+seed*30.)*.08;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = (6. + seed*22.) * uPx * (10. / -mv.z);
        vA = (.25+.75*seed) * smoothstep(0.,.25,p.y) * smoothstep(2.2,1.7,p.y); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uK; varying float vA;
      void main(){ float r = length(gl_PointCoord-.5); float disc = smoothstep(.5,.0,r); float ring = smoothstep(.5,.38,r)*smoothstep(.24,.38,r);
        gl_FragColor = vec4(uColor, (disc*.22+ring*.18) * vA * uK);
        #include <colorspace_fragment>
      }`
  });
  const motes = new THREE.Points(mg, motesMat); motes.renderOrder = 4;

  /* Rig: rig (world placement) > turn (yaw) > bottleG / boxG */
  const rig = new THREE.Group(), turn = new THREE.Group(), bottleG = new THREE.Group(), boxG = new THREE.Group();
  rig.add(turn, motes); turn.add(bottleG, boxG); scene.add(rig);
  const product = new THREE.Group(), ghost = new THREE.Group(); bottleG.add(product, ghost);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(.42, .42), contactMat);
  contact.rotation.x = -Math.PI / 2; contact.position.y = .003; contact.renderOrder = 3; bottleG.add(contact);
  const boxContact = new THREE.Mesh(new THREE.PlaneGeometry(1, .62), contactMat.clone());
  boxContact.rotation.x = -Math.PI / 2; boxContact.position.y = .003; boxContact.renderOrder = 3; boxG.add(boxContact);

  /* Liquid materials */
  const addFresnel = (mat, rim, k) => { mat.onBeforeCompile = sh => {
    sh.uniforms.uRim = { value: new THREE.Color(rim) }; sh.uniforms.uRimK = { value: k };
    sh.fragmentShader = 'uniform vec3 uRim; uniform float uRimK;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      `float fr = pow(1.0 - abs(dot(normalize(-vViewPosition), normal)), 2.4); outgoingLight += uRim * fr * uRimK;
       #include <opaque_fragment>`); }; };
  const water = () => new THREE.MeshPhysicalMaterial({ color: C('water'), roughness: .04, transmission: .72, thickness: .3, ior: 1.33,
    attenuationColor: C('rim'), attenuationDistance: 2, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 1.4, iridescence: .15, iridescenceIOR: 1.3 });
  const clipLevel = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);   // liquid: y <= level
  const solidPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4); // product: y <= sweep
  const underSolid = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e4);  // liquid: y >= sweep
  const buildMat = water(); buildMat.clippingPlanes = [clipLevel, underSolid]; buildMat.side = THREE.DoubleSide; addFresnel(buildMat, COL.rim, 1.3);
  const dropMat = water(); Object.assign(dropMat, { transmission: 1, roughness: 0, thickness: .4, attenuationDistance: 20 }); dropMat.color.set(0xffffff); dropMat.attenuationColor.set(0xffffff); addFresnel(dropMat, new THREE.Color(0xffffff), .55);
  const DROP_A = new THREE.Color(0xffffff), DROP_B = DROP_A; /* clear water droplet (Dapo 2026-11-11: not magenta) */

  /* Models */
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  async function loadGLB(name) {
    const inline = window.AQ_GLB?.[name];
    if (inline) { const bin = Uint8Array.from(atob(inline), c => c.charCodeAt(0)); return loader.parseAsync(bin.buffer, ''); }
    const base = document.querySelector('meta[name="aq-base"]')?.content || '';
    return loader.loadAsync(`${base}assets/models/${name}.glb`);
  }
  const [bG, xG] = await Promise.all([loadGLB('bottle'), loadGLB('box')]);
  const UNIT = 1 / .087;  // metres → bottle heights (bottle is 87 mm tall)
  const prep = (m, kind) => {
    m.traverse(o => {
      if (!o.isMesh) return;
      const src = o.material, name = (o.name + ' ' + (o.parent?.name || '') + ' ' + (src.name || '')).toLowerCase();
      const mat = new THREE.MeshPhysicalMaterial({ map: src.map || null, color: src.color, roughness: src.roughness ?? .4, metalness: 0 });
      if (mat.map) { mat.map.anisotropy = renderer.capabilities.getMaxAnisotropy(); mat.map.colorSpace = THREE.SRGBColorSpace; }
      if (kind === 'box') { mat.roughness = .62; mat.clearcoat = .12; mat.clearcoatRoughness = .4; }
      else if (/label/.test(name)) { mat.roughness = .4; mat.clearcoat = .25; mat.clearcoatRoughness = .2; }
      else if (/orifice|nozzle/.test(name)) { mat.roughness = .55; }
      else if (/cap/.test(name)) { mat.roughness = .34; mat.clearcoat = .7; mat.clearcoatRoughness = .14; }
      else { mat.roughness = .26; mat.clearcoat = 1; mat.clearcoatRoughness = .08; mat.sheen = .25; mat.sheenColor = new THREE.Color(0xd2f2f0); mat.sheenRoughness = .5; }
      mat.envMapIntensity = kind === 'box' || /label/.test(name) ? .7 : .9;
      o.material = mat; o.castShadow = true; o.receiveShadow = true;
    });
    const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
    m.scale.setScalar(UNIT); m.position.set(-c.x * UNIT, -b.min.y * UNIT, -c.z * UNIT);
    return m;
  };
  const bottle = prep(bG.scene, 'bottle'); product.add(bottle);
  // second canister for the "two canisters in the box" beat (shares geometry + materials)
  const twinG = new THREE.Group(), twin = bottle.clone(true); twinG.add(twin); turn.add(twinG); twinG.visible = false;
  const boxM = prep(xG.scene, 'box'); boxG.add(boxM);
  const capMesh = bottle.getObjectByName('Cap'); const cap0 = capMesh ? capMesh.position.y : 0;
  const boxMats = []; boxM.traverse(o => o.isMesh && boxMats.push(o.material));
  bottle.updateMatrixWorld(true);
  const H = new THREE.Box3().setFromObject(bottle).getSize(new THREE.Vector3()).y;   // ≈ 1
  product.traverse(o => { if (o.isMesh) { o.material.clippingPlanes = [solidPlane]; o.material.clipShadows = true; } });
  const ghostModel = bottle.clone(true); ghostModel.traverse(o => { if (o.isMesh) { o.material = buildMat; o.castShadow = false; } }); ghost.add(ghostModel);

  // Radius profile, for the glowing liquid edge
  const profile = (() => { const bins = 128, r = new Float32Array(bins), p = new THREE.Vector3(); bottle.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(bottleG.matrixWorld).invert();
    bottle.traverse(o => { if (!o.isMesh || o.name === 'Cap' && false) return; const pos = o.geometry.attributes.position, m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      for (let i = 0; i < pos.count; i += 1) { p.fromBufferAttribute(pos, i).applyMatrix4(m); const b = clamp(Math.floor(p.y / H * bins), 0, bins - 1); r[b] = Math.max(r[b], Math.hypot(p.x, p.z)); } });
    for (let i = 1; i < bins; i++) if (!r[i]) r[i] = r[i - 1];
    return y => r[clamp(Math.floor(y / H * bins), 0, bins - 1)]; })();

  /* Intro FX */
  const droplet = new THREE.Mesh(new THREE.SphereGeometry(.06, 48, 32), dropMat); bottleG.add(droplet); droplet.visible = false;
  const meniscus = new THREE.Mesh(new THREE.TorusGeometry(1, .005, 12, 160), new THREE.MeshBasicMaterial({ color: C('rim'), transparent: true, opacity: 0, toneMapped: false }));
  meniscus.rotation.x = Math.PI / 2; bottleG.add(meniscus);
  const ripples = [0, .14, .28].map(delay => { const m = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 128), new THREE.MeshBasicMaterial({ color: C('rim'), transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = .004; m.renderOrder = 5; m.userData.delay = delay; m.visible = false; bottleG.add(m); return m; });
  const crown = Array.from({ length: 14 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), dropMat); const a = i / 14 * Math.PI * 2 + Math.random() * .3;
    m.userData = { a, v: .5 + Math.random() * .45, up: .75 + Math.random() * .55, s: .009 + Math.random() * .01 }; m.visible = false; bottleG.add(m); return m; });

  /* Post */
  let composer = null, bloom = null;
  if (HIGH) {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .1, .5, .985); composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  const draw = () => composer ? composer.render() : renderer.render(scene, camera);

  /* Size */
  let vw = 1, vh = 1;
  function resize() {
    vw = innerWidth; vh = innerHeight;
    renderer.setSize(vw, vh, false); composer?.setSize(vw, vh); bloom?.resolution.set(vw, vh);
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    motesMat.uniforms.uPx.value = renderer.getPixelRatio() * (vh / 900);
    reflector?.getRenderTarget().setSize(Math.min(1536, vw), Math.min(1536, vh));
  }
  addEventListener('resize', resize); resize();
  const px2w = (px, py) => [(px - vw / 2) / vh * WORLD_H, -(py - vh / 2) / vh * WORLD_H];

  /* Slots, beats, overlays */
  const slots = [...document.querySelectorAll('.stage-slot')].map(el => ({ el, name: el.dataset.slot, base: POSES[el.dataset.slot] || POSES.hero, dyn: {} }));
  const heroSlot = slots.find(s => s.name === 'hero');
  /* Drag to rotate (horizontal only; vertical swipes still scroll the page). Auto-rotate pauses while dragging and resumes after. */
  let dragging = null, dragVel = 0, userOff = 0, lastDrag = -1e9;
  for (const s of slots) {
    const el = s.el; el.style.pointerEvents = 'auto'; el.style.touchAction = 'pan-y'; el.style.cursor = 'grab';
    el.addEventListener('pointerdown', e => { if (e.button) return; dragging = { x: e.clientX, y: e.clientY, t: performance.now(), on: false, id: e.pointerId }; dragVel = 0; });
    el.addEventListener('pointermove', e => {
      if (!dragging || e.pointerId !== dragging.id) return;
      const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      if (!dragging.on) { if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return; dragging.on = true; try { el.setPointerCapture(e.pointerId); } catch {} el.style.cursor = 'grabbing'; document.body.style.userSelect = 'none'; }
      const now = performance.now(), d = dx * .009;
      if (cur.spin > .5) spin += d; else userOff += d;
      dragVel = d / Math.max(.008, (now - dragging.t) / 1000); dragging.x = e.clientX; dragging.y = e.clientY; dragging.t = now; lastDrag = now;
    });
    const up = () => { if (dragging?.on) { el.style.cursor = 'grab'; document.body.style.userSelect = ''; lastDrag = performance.now(); } dragging = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.setAttribute('aria-hidden', 'true');
  }
  const anatomy = document.querySelector('[data-anatomy]');
  const beats = anatomy ? [...anatomy.querySelectorAll('[data-beat]')] : [];
  const anchors = { // bottle-local points (bottle height = 1)
    cap: new THREE.Vector3(0, .86, .128), pump: new THREE.Vector3(0, .66, .07), nozzle: new THREE.Vector3(0, .695, .075),
    label: new THREE.Vector3(.04, .34, .126), body: new THREE.Vector3(-.05, .18, .125), base: new THREE.Vector3(0, .02, .12), formula: new THREE.Vector3(0, .42, 0)
  };
  const leaderSvg = document.getElementById('leaders');
  const orbitBtns = [...document.querySelectorAll('[data-orbit]')];
  let orbitPaused = false, orbitSpin = 0, orbitSlot = null;
  orbitBtns.forEach(b => { ['pointerenter', 'focus'].forEach(e => b.addEventListener(e, () => orbitPaused = true)); ['pointerleave', 'blur'].forEach(e => b.addEventListener(e, () => orbitPaused = document.body.classList.contains('orbit-open'))); });
  document.addEventListener('aq:orbit-open', e => { orbitPaused = !!e.detail; });

  let activeBeat = -1;
  function updateBeats() {
    if (!anatomy) return;
    const r = anatomy.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, r.height - vh), 0, .9999);
    const i = Math.floor(p * beats.length);
    if (i !== activeBeat) {
      activeBeat = i;
      beats.forEach((b, j) => b.classList.toggle('is-active', j === i));
      anatomy.style.setProperty('--beat', i);
      anatomy.dispatchEvent(new CustomEvent('aq:beat', { detail: i }));
      const b = beats[i], s = slots.find(s => s.name === 'anatomy');
      if (s && b) s.dyn = { yaw: parseFloat(b.dataset.yaw || 0), explode: parseFloat(b.dataset.explode || 0), box: parseFloat(b.dataset.box || 0), twin: parseFloat(b.dataset.twin || 0) };
    }
    anatomy.style.setProperty('--progress', p.toFixed(4));
  }

  /* Current pose (damped) */
  const cur = { x: 0, y: -10, s: 1, box: 1, floor: 1, grid: 0, explode: 0, orbit: 0, bx: .3, bz: .14, xx: -.2, xz: -.12, xyaw: .5, spin: 1, twin: 0 };
  let yaw = -.25, spin = -.25, presence = 0, first = true, heroW = 1;
  function targetPose() {
    const acc = Object.fromEntries(KEYS.map(k => [k, 0])); let wsum = 0, sx = 0, cx = 0, maxW = 0;
    for (const s of slots) {
      const r = s.el.getBoundingClientRect(); if (!r.height) continue;
      const d = (r.top + r.height / 2 - vh / 2) / vh;
      const w = Math.exp(-((d / .42) ** 2)); if (s === heroSlot) heroW = w; if (w < 1e-3) continue;
      const P = { ...s.base, ...s.dyn };
      const sH = r.height / vh * WORLD_H, sW = r.width / vh * WORLD_H;
      const sc = Math.min(sH / P.fit, sW / P.fitW);
      const [x, y] = px2w(r.left + r.width / 2, r.bottom);
      const pose = { ...P, x, y: y + (sH - sc * P.fit) * .5, s: sc };
      for (const k of KEYS) acc[k] += pose[k] * w;
      const yw = P.spin > .5 ? spin : (P.yaw ?? 0);
      sx += Math.sin(yw) * w; cx += Math.cos(yw) * w; wsum += w; maxW = Math.max(maxW, w);
    }
    if (!wsum) return null;
    for (const k of KEYS) acc[k] /= wsum;
    acc.yaw = Math.atan2(sx, cx); acc.presence = clamp(maxW * 1.6, 0, 1);
    return acc;
  }

  /* Intro timeline (~2.5 s) */
  const T = { delay: .1, fall: .5, splash: .2, build: .85, solidify: .45, pop: .4, box: .7 };
  const t0 = T.delay, t1 = t0 + T.fall, t2 = t1 + T.splash * .4, t3 = t2 + T.build, t4 = t3 + T.solidify, t5 = t4 + T.pop, t6 = t4 + T.box;
  let intro = 0, playing = false, introDone = false;
  const boxIntro = { k: 1 };
  function setBoxFade(k) {
    boxIntro.k = k;
    for (const m of boxMats) { const tr = k < .999; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = k; }
  }
  function introUpdate(t) {
    const f = seg(t, t0, t1);
    droplet.visible = t >= t0 && t < t2 + .05;
    droplet.position.set(0, lerp(1.45, .06, ease.in(f)), 0);
    const st = 1 + ease.in(f) * .22; droplet.scale.set(1 / Math.sqrt(st), st, 1 / Math.sqrt(st));
    dropMat.color.copy(DROP_A).lerp(DROP_B, seg(t, t1 - .05, t1 + .2));
    if (t >= t1) { const sq = ease.out(seg(t, t1, t1 + T.splash)); droplet.scale.set(1 + sq * 2.2, Math.max(.05, 1 - sq * .95), 1 + sq * 2.2); droplet.position.y = .06 * (1 - sq) + .006; }
    ripples.forEach(r => { const rp = seg(t, t1 + r.userData.delay, t1 + r.userData.delay + 1.2); r.visible = rp > 0 && rp < 1; r.scale.setScalar(.06 + ease.out(rp) * .8); r.material.opacity = .55 * (1 - rp); });
    crown.forEach(m => { const u = t - t1, d = m.userData; m.visible = !reduceMotion && u > 0 && u < .8; if (!m.visible) return;
      const rr = .1 + d.v * u * .55; m.position.set(Math.cos(d.a) * rr, Math.max(0, d.up * u - 3.4 * u * u), Math.sin(d.a) * rr); m.scale.setScalar(d.s * (1 - u * .7)); });
    const b = ease.inOut(seg(t, t2, t3)), level = b * (H + .01);
    ghost.visible = t >= t2 && t < t4 + .01;
    const ws = rig.scale.y, wy = rig.position.y;
    clipLevel.constant = wy + level * ws;
    meniscus.visible = t >= t2 && b < 1 && t < t3 - .2;
    meniscus.position.y = level; meniscus.scale.setScalar(profile(Math.min(level, H - .001)) + .002);
    meniscus.material.opacity = Math.min(1, b * 8) * (1 - seg(b, .92, 1));
    const so = ease.inOut(seg(t, t3 - .2, t4)), sweep = so * (H + .02);
    product.visible = t >= t3 - .2;
    solidPlane.constant = t >= t4 ? 1e4 : wy + sweep * ws; underSolid.constant = t >= t4 ? 1e4 : -(wy + sweep * ws);
    if (so > 0 && so < 1) { meniscus.visible = true; meniscus.position.y = sweep; meniscus.scale.setScalar(profile(Math.min(sweep, H - .001)) + .003); meniscus.material.opacity = Math.sin(so * Math.PI); }
    const p = seg(t, t4, t5);
    bottleG.scale.setScalar(1 + (p > 0 ? (ease.back(p) - p) * .08 : 0));
    const bx = ease.out(seg(t, t4 - .1, t6));
    setBoxFade(bx); boxG.position.y = (1 - bx) * -.08;
    contact.material.opacity = Math.max(seg(t, t2, t3) * .6, ease.out(p));
    floorMat.uniforms.uCausticK.value = Math.max(seg(t, t1, t1 + 1) * .6, ease.out(seg(t, t3, t5)));
    motesMat.uniforms.uK.value = ease.inOut(seg(t, t1, t5));
    if (t >= t4 && !root.classList.contains('intro-revealed')) { root.classList.add('intro-revealed'); }
  }
  function introFinish() {
    introDone = true; playing = false;
    ghost.visible = droplet.visible = meniscus.visible = false; ripples.forEach(r => r.visible = false); crown.forEach(m => m.visible = false);
    product.visible = true; solidPlane.constant = 1e4; underSolid.constant = 1e4; bottleG.scale.setScalar(1); setBoxFade(1); boxG.position.y = 0;
    contact.material.opacity = 1; floorMat.uniforms.uCausticK.value = 1; motesMat.uniforms.uK.value = 1;
    root.classList.add('intro-revealed', 'intro-done');
    document.dispatchEvent(new Event('aq:intro-done'));
  }

  /* Frame */
  const hv = new THREE.Vector3(), tmp = new THREE.Vector3(), ndc = new THREE.Vector3();
  let lastS = 0, elapsed = 0, errors = 0, onScreen = true, last = performance.now();
  const stageSections = [...document.querySelectorAll('[data-stage-section]')];
  const io = new IntersectionObserver(es => { for (const e of es) e.target.__vis = e.isIntersecting; onScreen = stageSections.some(s => s.__vis); }, { rootMargin: '10% 0px' });
  stageSections.forEach(s => io.observe(s));

  function project(v) { ndc.copy(v).project(camera); return [(ndc.x + 1) / 2 * vw, (1 - ndc.y) / 2 * vh, ndc.z]; }

  function step(dt) {
    updateBeats();
    const tp = targetPose();
    if (tp) {
      if (first) { Object.assign(cur, tp); yaw = tp.yaw; first = false; }
      const k = reduceMotion ? 30 : 9;
      for (const kk of KEYS) cur[kk] = damp(cur[kk], tp[kk], kk === 'x' || kk === 'y' || kk === 's' ? k * 1.4 : k * .6, dt);
      if (!playing) yaw = dampAngle(yaw, tp.yaw + (cur.spin > .5 ? 0 : userOff), cur.spin > .5 || dragging?.on ? 30 : 4, dt);
      presence = damp(presence, tp.presence, 8, dt);
    } else presence = damp(presence, 0, 8, dt);
    const idle = performance.now() - lastDrag;
    if (!dragging?.on) {   // throw inertia, then auto-rotate fades back in
      const v = dragVel * dt; if (cur.spin > .5) spin += v; else userOff += v;
      dragVel *= Math.exp(-dt * 3.5);
      if (cur.spin <= .5 && idle > 2500) userOff = damp(userOff, 0, 1.5, dt);
    }
    spin += dt * (reduceMotion ? .12 : .42) * (introDone ? 1 : 0) * clamp((idle - 1200) / 1500, 0, 1);
    if (!orbitPaused) orbitSpin += dt * (reduceMotion ? .05 : .16);

    rig.position.set(cur.x, cur.y, 0); rig.scale.setScalar(cur.s);
    rig.visible = presence > .02;
    turn.rotation.y = yaw;
    const tw = ease.inOut(clamp(cur.twin, 0, 1));
    bottleG.position.set(cur.bx - .17 * tw, 0, cur.bz + .04 * tw);
    twinG.visible = tw > .01; twinG.position.set(cur.bx + .19 * tw, 0, cur.bz - .1 * tw); twinG.rotation.y = .9; twinG.scale.setScalar(Math.max(.001, tw));
    const bk = cur.box * boxIntro.k;
    boxG.visible = bk > .01; boxG.position.x = cur.xx; boxG.position.z = cur.xz; boxG.rotation.y = cur.xyaw;
    if (introDone) setBoxFade(clamp(cur.box * 1.15, 0, 1)), boxIntro.k = 1;
    if (capMesh) capMesh.position.y = cap0 + ease.inOut(clamp(cur.explode, 0, 1)) * .028;

    floorG.position.set(cur.x, cur.y, 0); floorG.scale.setScalar(cur.s);
    floorMat.uniforms.uK.value = cur.floor * presence;
    floorG.visible = cur.floor > .01;
    if (reflector) reflector.visible = cur.floor > .7;
    shadowMat.opacity = .55 * cur.floor;
    contact.visible = boxContact.visible = cur.floor > .05;
    boxContact.material.opacity = contact.material.opacity * bk;
    gridMat.uniforms.uK.value = cur.grid * presence;
    gridMat.uniforms.uCenter.value.set(cur.x, cur.y + cur.s * .5);

    // lights follow the product
    const s = cur.s, c = tmp.set(cur.x, cur.y + s * .5, 0);
    key.position.set(c.x - s * 1, cur.y + s * 2.9, s * 1.7); key.target.position.set(cur.x, cur.y, 0);
    rimL.position.set(c.x - s * 1.4, c.y + s * .8, -s * 1.5); rimL.target.position.copy(c);
    rimR.position.set(c.x + s * 1.45, c.y + s * .5, -s * 1.4); rimR.target.position.copy(c);
    if (Math.abs(s - lastS) / s > .02) { key.shadow.camera.near = s * 1.2; key.shadow.camera.far = s * 7; key.shadow.camera.updateProjectionMatrix(); lastS = s; }

    // halo behind the product
    hv.copy(c).sub(camera.position).normalize();
    const b = camera.position.dot(hv), cc = camera.position.lengthSq() - 80 * 80, tt = -b + Math.sqrt(b * b - cc);
    backdrop.material.uniforms.uHaloDir.value.copy(camera.position).addScaledVector(hv, tt).normalize();
    backdrop.material.uniforms.uHaloW.value = lerp(9, 22, cur.grid);
    backdrop.material.uniforms.uHaloK.value = .6 * Math.max(.25, presence);

    if (playing && heroW < .35) introFinish();   // visitor scrolled on: don't make them watch it later
    if (playing) { intro += dt; introUpdate(intro); if (intro >= Math.max(t5, t6)) introFinish(); }

    elapsed += reduceMotion ? dt * .25 : dt;
    floorMat.uniforms.uTime.value = elapsed; if (reflector) reflector.material.uniforms.uTime.value = elapsed; motesMat.uniforms.uTime.value = elapsed; gridMat.uniforms.uTime.value = elapsed;

    rig.updateMatrixWorld(true);
    updateOverlays(); updateHot(elapsed);
  }

  /* Hero facts as floating hotspot labels beside the bottle (anchored to the bottle axis so they don't swing with the spin) */
  const hotPills = [...document.querySelectorAll('.hero-facts .fact-pill')];
  const hotH = [.86, .58, .3], hotSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  if (hotPills.length) {
    hotSvg.setAttribute('class', 'hot-lines'); hotSvg.setAttribute('aria-hidden', 'true');
    hotSvg.innerHTML = hotPills.map(() => '<g><path/><circle r="4.5"/><circle class="ring" r="10"/></g>').join('');
    document.body.append(hotSvg); document.documentElement.classList.add('hero-hot');
  }
  const ws = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  function updateHot(time) {
    if (!hotPills.length) return;
    const k = introDone ? clamp((heroW - .35) / .45, 0, 1) * presence : 0;
    hotSvg.style.opacity = k.toFixed(3); hotSvg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    bottleG.getWorldScale(ws);
    const gs = hotSvg.children;
    hotPills.forEach((pill, i) => {
      pill.style.opacity = k.toFixed(3); pill.style.pointerEvents = k > .5 ? 'auto' : 'none';
      if (k < .01) return;
      tmp.set(0, hotH[i], 0); bottleG.localToWorld(tmp);
      tmp2.copy(tmp); tmp2.x -= .13 * ws.x;                      // bottle's left silhouette edge
      const [ax, ay] = project(tmp2), [cx] = project(tmp);
      const bob = reduceMotion ? 0 : Math.sin(time * 1.1 + i * 2.1) * 5;
      const w = pill.offsetWidth, h = pill.offsetHeight;
      const reach = isPhone ? 14 : 46 + (i % 2) * 34;
      const px = Math.max(8, ax - reach - w), py = ay - h / 2 + bob;
      pill.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
      const ex = px + w, ey = ay + bob;
      const g = gs[i]; g.querySelector('path').setAttribute('d', `M${ex},${ey} L${ax},${ay}`);
      for (const c of g.querySelectorAll('circle')) { c.setAttribute('cx', ax); c.setAttribute('cy', ay); }
      g.style.display = ax - ex > 6 ? '' : 'none';
    });
  }

  /* Leader lines for the anatomy callouts + orbiting hotspots */
  const leaderPaths = new Map();
  function updateOverlays() {
    if (leaderSvg) {
      leaderSvg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
      const show = cur.grid * presence;
      leaderSvg.style.opacity = show.toFixed(3);
      if (show > .02) for (const b of beats) {
        const a = anchors[b.dataset.anchor]; if (!a) continue;
        tmp.copy(a); if (b.dataset.anchor === 'cap') tmp.y += ease.inOut(clamp(cur.explode, 0, 1)) * .028 * UNIT;
        bottleG.localToWorld(tmp);
        const [ax, ay] = project(tmp);
        const card = b.querySelector('.callout-card') || b;
        const r = card.getBoundingClientRect();
        let g = leaderPaths.get(b);
        if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.innerHTML = '<path class="leader"/><circle class="leader-dot" r="5"/><circle class="leader-ring" r="12"/>'; leaderSvg.append(g); leaderPaths.set(b, g); }
        const active = b.classList.contains('is-active');
        const visible = active || !isPhone;
        g.style.display = visible && r.width ? '' : 'none';
        if (!visible) continue;
        const toRight = r.left > ax;
        const ex = toRight ? r.left - 8 : r.right + 8, ey = clamp(ay, r.top + 18, r.bottom - 18);
        const onTop = r.top > ay + 20 && isPhone;
        const [fx, fy] = onTop ? [clamp(ax, r.left + 20, r.right - 20), r.top - 8] : [ex, ey];
        const midx = onTop ? ax : lerp(ax, fx, .55);
        const d = onTop ? `M${ax},${ay} L${ax},${lerp(ay, fy, .5)} L${fx},${lerp(ay, fy, .5)} L${fx},${fy}` : `M${ax},${ay} L${midx},${ay} L${midx + (fx - midx) * .25},${fy} L${fx},${fy}`;
        g.querySelector('.leader').setAttribute('d', d);
        for (const cEl of g.querySelectorAll('circle')) { cEl.setAttribute('cx', ax); cEl.setAttribute('cy', ay); }
        g.classList.toggle('is-active', active);
      }
    }
    if (orbitBtns.length) {
      const k = cur.orbit * presence;
      /* Droplets ride a tilted ring confined to the explore slot (Dapo 2026-11-11: keep them in one
         clickable zone, never over the heading or off-screen). Evenly spaced, so they never overlap. */
      const slotEl = orbitSlot || (orbitSlot = document.querySelector('.stage-slot[data-slot="explore"]'));
      const r = slotEl ? slotEl.getBoundingClientRect() : { left: 0, top: 0, width: vw, height: vh };
      const pad = 10, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ry = Math.max(40, r.height * .4 - 28);
      orbitBtns.forEach((b, i) => {
        if (k < .02) { b.style.opacity = 0; b.style.pointerEvents = 'none'; b.tabIndex = -1; return; }
        const a = (i / orbitBtns.length) * Math.PI * 2 + orbitSpin;
        const depth = Math.cos(a);                       // 1 = in front
        const bw = b.offsetWidth || 52, bh = b.offsetHeight || 52;
        const rx = Math.max(30, r.width / 2 - bw / 2 - pad);
        const x = cx + Math.sin(a) * rx;
        const y = Math.min(r.top + r.height - bh / 2 - pad, Math.max(r.top + bh / 2 + pad, cy + depth * ry * .62 - ry * .08));
        b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%,-50%) scale(${(.86 + .14 * (depth + 1) / 2).toFixed(3)})`;
        b.style.opacity = k.toFixed(3);                 // full opacity: every droplet must read as tappable
        b.style.zIndex = depth > -.2 ? 3 : 1;
        b.style.pointerEvents = k > .6 ? 'auto' : 'none'; b.tabIndex = k > .6 ? 0 : -1;
      });
      document.body.classList.toggle('orbit-live', k > .6);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.034, (now - last) / 1000); last = now;   // a slow frame slows the intro instead of skipping it
    if (document.hidden) return;
    try {
      step(dt);
      if (onScreen || playing) draw();
    } catch (e) { console.error(e); if (++errors > 5) fail(); }
  }

  /* Warm-up: compile every material that will ever show, render twice, then reveal. This is what
     makes the first seconds smooth: no shader compile hitches in the middle of the intro. */
  const all = [product, ghost, droplet, meniscus, boxG, ...crown, ...ripples];
  all.forEach(o => o.visible = true);
  setBoxFade(.5);
  step(0); first = true;
  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
  draw(); setBoxFade(1); draw();
  all.forEach(o => o.visible = false); product.visible = true;

  const atTop = heroSlot && heroSlot.el.getBoundingClientRect().top > -vh * .3;
  const startIntro = () => {
    if (!atTop) { introFinish(); }   // the droplet intro is short (~2.5 s) and plays once, so it runs under reduced motion too (no splash crown)
    else { product.visible = false; setBoxFade(0); intro = 0; playing = true; introUpdate(0); }
    root.classList.add('stage-ready');
    last = performance.now(); requestAnimationFrame(frame);
  };
  // Start only when the page is actually visible to the visitor (background tabs / preloading iframes would otherwise "finish" the intro unseen)
  const whenVisible = () => new Promise(r => { if (document.visibilityState === 'visible') return r(); const f = () => { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', f); r(); } }; document.addEventListener('visibilitychange', f); });
  await whenVisible();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  startIntro();

  window.__stage = { renderer, scene, camera, seek: x => { playing = false; intro = x; introUpdate(x); draw(); }, finish: introFinish, get t() { return intro; }, get spin() { return spin; }, get dragging() { return !!dragging?.on; } };
  if (params.has('debug')) {
    const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info'), box = document.createElement('pre');
    box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;font:12px/1.4 monospace;background:#000c;color:#fff;padding:8px;border-radius:6px;max-width:90vw;white-space:pre-wrap';
    box.textContent = [`quality ${QUALITY} · dpr ${renderer.getPixelRatio()}`, `reduced motion ${reduceMotion}`, `GPU ${dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a'}`, navigator.userAgent].join('\n');
    document.body.append(box);
  }
}
