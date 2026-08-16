import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import './styles.css';

const MAX_OMEGA = 370;
const RING_OMEGA = 95;
const CHALLENGE_SECONDS = 12;
const $ = (selector) => document.querySelector(selector);
const ui = {
  scene: $('#scene'), rpm: $('#rpm'), meter: $('#meter-fill'), sound: $('#sound-status'), pitch: $('#pitch-status'), best: $('#best-time'),
  live: $('#live-time'), fill: $('#challenge-fill'), overlay: $('#start-overlay'), start: $('#start-button'), pad: $('#spin-pad'),
  cameraButton: $('#camera-button'), motionButton: $('#motion-button'), reset: $('#reset-button'), preview: $('#gesture-preview'),
  camera: $('#camera'), hands: $('#hand-overlay'), cameraStatus: $('#camera-status'), rings: $('#sound-rings'),
  modeButtons: [...document.querySelectorAll('[data-sound-mode]')], voiceClip: $('#you-gan-ma-audio'),
};

/** 只用振荡器、程序化噪声与滤波器实时合成带空气感的竹知了声。 */
class CicadaAudio {
  constructor() { this.context = null; this.started = false; }

  async start() {
    if (!this.context) this.createGraph();
    if (this.context.state === 'suspended') await this.context.resume();
    this.started = true;
  }

  createGraph() {
    const Context = window.AudioContext || window.webkitAudioContext;
    this.context = new Context();
    const now = this.context.currentTime;
    this.master = this.context.createGain();
    this.master.gain.setValueAtTime(0.0001, now);
    this.master.connect(this.context.destination);
    this.filter = this.context.createBiquadFilter();
    this.filter.type = 'bandpass'; this.filter.frequency.value = 850; this.filter.Q.value = 1.4;
    this.filter.connect(this.master);
    this.toneGain = this.context.createGain();
    this.harmonicGain = this.context.createGain();
    this.noiseGain = this.context.createGain();
    [this.toneGain, this.harmonicGain, this.noiseGain].forEach((gain) => { gain.gain.value = 0.0001; });
    this.tone = this.context.createOscillator(); this.tone.type = 'sawtooth';
    this.harmonic = this.context.createOscillator(); this.harmonic.type = 'sine';
    this.tone.connect(this.toneGain).connect(this.filter);
    this.harmonic.connect(this.harmonicGain).connect(this.filter);
    this.tone.start(); this.harmonic.start();
    const noise = this.context.createBufferSource();
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
    const noiseData = buffer.getChannelData(0); let previous = 0;
    for (let i = 0; i < noiseData.length; i += 1) { previous = previous * 0.97 + (Math.random() * 2 - 1) * 0.18; noiseData[i] = previous; }
    noise.buffer = buffer; noise.loop = true;
    const noiseFilter = this.context.createBiquadFilter(); noiseFilter.type = 'bandpass'; noiseFilter.frequency.value = 1450; noiseFilter.Q.value = 0.8;
    noise.connect(noiseFilter).connect(this.noiseGain).connect(this.master); noise.start();
  }

  update(omega) {
    if (!this.started) return;
    const t = this.context.currentTime;
    const ratio = THREE.MathUtils.clamp(Math.abs(omega) / MAX_OMEGA, 0, 1);
    const loudness = THREE.MathUtils.smoothstep(ratio, 0.12, 0.9);
    const frequency = 120 + 510 * Math.pow(ratio, 0.72);
    const wavering = 0.68 + 0.32 * Math.sin(t * (10 + ratio * 25));
    const gain = 0.28 * Math.pow(loudness, 1.6) * wavering;
    this.tone.frequency.setTargetAtTime(frequency, t, 0.035);
    this.harmonic.frequency.setTargetAtTime(frequency * 2.03, t, 0.035);
    this.filter.frequency.setTargetAtTime(620 + ratio * 1800, t, 0.06);
    this.filter.Q.setTargetAtTime(0.9 + ratio * 2.2, t, 0.06);
    this.toneGain.gain.setTargetAtTime(gain * 0.55, t, 0.025);
    this.harmonicGain.gain.setTargetAtTime(gain * 0.18, t, 0.025);
    this.noiseGain.gain.setTargetAtTime(gain * (0.1 + ratio * 0.48), t, 0.025);
    this.master.gain.setTargetAtTime(gain > 0.001 ? 0.96 : 0.0001, t, 0.04);
  }
}

/** 使用画布生成竹纤维贴图，避免把真实竹片简化成单一纯色。 */
function bambooTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 1024;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#caa44e'; ctx.fillRect(0, 0, 256, 1024);
  for (let x = 0; x < 256; x += 3) { const l = 142 + Math.round(Math.sin(x * 0.32) * 16 + Math.random() * 14); ctx.fillStyle = `rgba(${l},${Math.min(l + 38, 205)},${Math.max(38, l - 88)},.16)`; ctx.fillRect(x, 0, 1 + Math.random() * 2, 1024); }
  for (let y = 118; y < 1024; y += 180) { ctx.fillStyle = 'rgba(73,67,24,.28)'; ctx.fillRect(0, y, 256, 5); ctx.fillStyle = 'rgba(255,232,135,.24)'; ctx.fillRect(0, y + 5, 256, 4); }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1.2, 2); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

/** 以偏心叶片轮廓表达一片被竹签轴贯穿的薄竹片。 */
function bladeGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-1.7, .03); shape.bezierCurveTo(-1.48, .24, -.76, .33, -.14, .13); shape.quadraticCurveTo(0, .07, .15, .13); shape.bezierCurveTo(.78, .34, 1.52, .25, 1.8, .02); shape.bezierCurveTo(1.34, -.21, .62, -.27, .15, -.1); shape.quadraticCurveTo(0, -.04, -.14, -.1); shape.bezierCurveTo(-.78, -.31, -1.44, -.24, -1.7, .03);
  return new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: true, bevelSegments: 1, bevelSize: .012, bevelThickness: .01, curveSegments: 26 });
}

class Game {
  constructor() {
    this.clock = new THREE.Clock(); this.omega = 0; this.angle = 0; this.ringing = 0; this.best = Number(localStorage.getItem('zhu-zhiliao-best') || 0); this.pointer = null;
    this.audio = new CicadaAudio();
    this.soundMode = 'bamboo';
    this.clip = ui.voiceClip;
    this.clip.volume = 0;
    this.handLandmarker = null; this.handStream = null; this.lastVideoTime = -1; this.lastPalm = null; this.handFrame = null; this.motionActive = false; this.lastAcceleration = 0;
    this.setupScene(); this.bind(); this.animate(); ui.best.textContent = `${this.best.toFixed(1)}s`;
  }

  setupScene() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setSize(ui.scene.clientWidth, ui.scene.clientHeight); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; ui.scene.append(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog('#b9d1ce', 7, 18);
    this.camera3d = new THREE.PerspectiveCamera(37, ui.scene.clientWidth / ui.scene.clientHeight, .1, 100); this.camera3d.position.set(4.4, 2.75, 6.3);
    this.controls = new OrbitControls(this.camera3d, this.renderer.domElement); this.controls.target.set(0, .12, 0); this.controls.enableDamping = true; this.controls.dampingFactor = .06; this.controls.minDistance = 4.6; this.controls.maxDistance = 9; this.controls.maxPolarAngle = Math.PI * .71;
    this.scene.add(new THREE.HemisphereLight('#d6f5df', '#1b2923', 2.8));
    const key = new THREE.DirectionalLight('#fff1b8', 3.8); key.position.set(4, 5, 3); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); this.scene.add(key);
    const rim = new THREE.PointLight('#81c8b4', 18, 11, 2); rim.position.set(-3, 1.6, -3); this.scene.add(rim);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(4.8, 64), new THREE.MeshStandardMaterial({ color: '#355c4c', roughness: 1, transparent: true, opacity: .45 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -2.22; ground.receiveShadow = true; this.scene.add(ground);
    this.toy = new THREE.Group(); this.toy.rotation.z = -.07; this.scene.add(this.toy);
    const texture = bambooTexture(); const bamboo = new THREE.MeshStandardMaterial({ map: texture, color: '#d3ad50', roughness: .55, metalness: .02 }); const dark = new THREE.MeshStandardMaterial({ map: texture, color: '#9a742c', roughness: .64 });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(.06, .075, 4.05, 28), bamboo); stick.position.y = -.15; stick.castShadow = true; this.toy.add(stick);
    [-1.65, .06, 1.48].forEach((y) => { const node = new THREE.Mesh(new THREE.TorusGeometry(.069, .016, 8, 30), dark); node.rotation.x = Math.PI / 2; node.position.y = y; this.toy.add(node); });
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(.092, .096, .68, 28), dark); grip.position.y = -1.23; grip.castShadow = true; this.toy.add(grip);
    this.rotor = new THREE.Group(); this.rotor.position.y = 1.55; this.toy.add(this.rotor);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.115, .115, .12, 24), dark); hub.rotation.x = Math.PI / 2; hub.castShadow = true; this.rotor.add(hub);
    const blade = new THREE.Mesh(bladeGeometry(), bamboo); blade.rotation.x = Math.PI / 2; blade.position.z = -.02; blade.castShadow = true; this.rotor.add(blade);
    this.ghosts = new THREE.Group(); this.ghosts.position.copy(this.rotor.position); this.toy.add(this.ghosts);
    for (let i = 0; i < 9; i += 1) { const ghost = new THREE.Mesh(bladeGeometry(), new THREE.MeshBasicMaterial({ color: '#f5d374', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); ghost.rotation.x = Math.PI / 2; ghost.userData.offset = (i + 1) * .18; this.ghosts.add(ghost); }
    this.halo = new THREE.Mesh(new THREE.RingGeometry(1.8, 1.84, 72), new THREE.MeshBasicMaterial({ color: '#f5d574', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); this.halo.rotation.x = -Math.PI / 2; this.halo.position.y = 1.53; this.toy.add(this.halo);
    addEventListener('resize', () => this.resize());
  }

  bind() {
    ui.start.addEventListener('click', () => this.activate());
    ui.pad.addEventListener('pointerdown', (event) => { this.activate(); ui.pad.setPointerCapture(event.pointerId); this.pointer = { x: event.clientX, t: performance.now() }; ui.pad.classList.add('is-spinning'); });
    ui.pad.addEventListener('pointermove', (event) => this.padMove(event)); ['pointerup', 'pointercancel'].forEach((name) => ui.pad.addEventListener(name, () => { this.pointer = null; ui.pad.classList.remove('is-spinning'); }));
    ui.pad.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.spin(52); } });
    ui.cameraButton.addEventListener('click', () => this.toggleCamera()); ui.motionButton.addEventListener('click', () => this.toggleMotion()); ui.reset.addEventListener('click', () => { this.ringing = 0; });
    ui.modeButtons.forEach((button) => button.addEventListener('click', () => this.setSoundMode(button.dataset.soundMode)));
  }

  async activate() {
    ui.overlay.classList.add('is-hidden');
    if (this.soundMode === 'bamboo') await this.audio.start();
    else this.startClip();
  }
  padMove(event) { if (!this.pointer) return; const now = performance.now(); const dx = event.clientX - this.pointer.x; const dt = Math.max(now - this.pointer.t, 12); if (Math.abs(dx) > 1) this.spin(Math.min(92, Math.abs(dx) / dt * 12.5 + Math.abs(dx) * .32)); this.pointer = { x: event.clientX, t: now }; }
  spin(amount) { this.omega = THREE.MathUtils.clamp(this.omega + amount, -MAX_OMEGA, MAX_OMEGA); this.activate(); if (this.soundMode === 'you-gan-ma') this.startClip(); }

  /** 切换时立即关闭另一条音轨，避免竹鸣和人声同时播放。 */
  setSoundMode(mode) {
    if (mode === this.soundMode) return;
    this.soundMode = mode;
    ui.modeButtons.forEach((button) => {
      const active = button.dataset.soundMode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (mode === 'bamboo') {
      this.clip.pause();
      this.clip.currentTime = 0;
    } else {
      this.audio.update(0);
      this.startClip();
    }
  }

  /** 人声音轨只在竹片仍在转动时循环；速度也会影响音量，停转后复位。 */
  startClip() {
    if (Math.abs(this.omega) <= 4 || !this.clip.paused) return;
    this.clip.play().catch((error) => console.warn('人声音轨尚未获得播放权限', error));
  }

  updateClip(speed, ratio) {
    const moving = speed > 4;
    this.clip.volume = moving ? 0.18 + 0.72 * THREE.MathUtils.smoothstep(ratio, 0, 0.85) : 0;
    if (moving) this.startClip();
    else if (!this.clip.paused) {
      this.clip.pause();
      this.clip.currentTime = 0;
    }
  }

  async toggleMotion() {
    if (this.motionActive) { removeEventListener('devicemotion', this.deviceMotion); this.motionActive = false; ui.motionButton.classList.remove('is-active'); ui.motionButton.setAttribute('aria-pressed', 'false'); return; }
    try {
      const Motion = window.DeviceMotionEvent;
      if (!Motion) throw new Error('unsupported');
      if (typeof Motion.requestPermission === 'function' && await Motion.requestPermission() !== 'granted') throw new Error('denied');
      this.deviceMotion = (event) => { const a = event.accelerationIncludingGravity; if (!a) return; const value = Math.hypot(a.x || 0, a.y || 0, a.z || 0); const burst = Math.abs(value - this.lastAcceleration); this.lastAcceleration = value; if (burst > 4.2) this.spin(Math.min(70, burst * 8.5)); };
      addEventListener('devicemotion', this.deviceMotion); this.motionActive = true; ui.motionButton.classList.add('is-active'); ui.motionButton.setAttribute('aria-pressed', 'true');
    } catch { ui.motionButton.classList.add('is-error'); setTimeout(() => ui.motionButton.classList.remove('is-error'), 1400); }
  }

  async toggleCamera() {
    if (this.handStream) { this.stopCamera(); return; }
    ui.cameraButton.disabled = true; ui.preview.hidden = false; ui.cameraStatus.textContent = '正在唤醒摄像头';
    try {
      this.handStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }); ui.camera.srcObject = this.handStream; await ui.camera.play(); await this.loadHandLandmarker(); ui.cameraButton.classList.add('is-active'); ui.cameraButton.setAttribute('aria-pressed', 'true'); ui.cameraStatus.textContent = '双手搓动即可加速'; this.detectHands();
    } catch (error) { console.error('手势识别启动失败', error); ui.cameraStatus.textContent = '未能访问手势识别'; setTimeout(() => { ui.preview.hidden = true; }, 1800); this.stopCamera(); }
    finally { ui.cameraButton.disabled = false; }
  }

  async loadHandLandmarker() {
    if (this.handLandmarker) return;
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');
    this.handLandmarker = await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: .56, minTrackingConfidence: .54 });
  }

  detectHands() {
    if (!this.handStream || !this.handLandmarker) return;
    if (ui.camera.readyState >= 2 && ui.camera.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = ui.camera.currentTime; const results = this.handLandmarker.detectForVideo(ui.camera, performance.now()); const hands = results.landmarks || []; this.drawHands(hands);
      if (hands.length >= 2) { const palms = hands.slice(0, 2).map((hand) => hand[9]); const separation = palms[0].x - palms[1].x; if (this.lastPalm !== null) { const rub = Math.abs(separation - this.lastPalm); if (rub > .004) this.spin(Math.min(45, rub * 1150)); } this.lastPalm = separation; ui.cameraStatus.textContent = '正在捕捉搓动'; }
      else { this.lastPalm = null; ui.cameraStatus.textContent = '请让双手同时入镜'; }
    }
    this.handFrame = requestAnimationFrame(() => this.detectHands());
  }

  drawHands(hands) {
    const rect = ui.camera.getBoundingClientRect(); const width = Math.max(1, Math.round(rect.width)); const height = Math.max(1, Math.round(rect.height)); if (ui.hands.width !== width || ui.hands.height !== height) { ui.hands.width = width; ui.hands.height = height; }
    const ctx = ui.hands.getContext('2d'); ctx.clearRect(0, 0, width, height); ctx.strokeStyle = '#f6dc76'; ctx.fillStyle = '#f6dc76'; ctx.lineWidth = 2;
    const links = [[0,5],[5,9],[9,13],[13,17],[0,17],[0,1],[1,2],[2,3],[3,4],[5,6],[6,7],[7,8],[9,10],[10,11],[11,12],[13,14],[14,15],[15,16],[17,18],[18,19],[19,20]];
    hands.forEach((hand) => { hand.forEach((point) => { ctx.beginPath(); ctx.arc((1 - point.x) * width, point.y * height, 2.6, 0, Math.PI * 2); ctx.fill(); }); links.forEach(([a,b]) => { ctx.beginPath(); ctx.moveTo((1 - hand[a].x) * width, hand[a].y * height); ctx.lineTo((1 - hand[b].x) * width, hand[b].y * height); ctx.stroke(); }); });
  }

  stopCamera() { if (this.handFrame) cancelAnimationFrame(this.handFrame); this.handFrame = null; if (this.handStream) this.handStream.getTracks().forEach((track) => track.stop()); this.handStream = null; this.lastPalm = null; ui.preview.hidden = true; ui.cameraButton.classList.remove('is-active'); ui.cameraButton.setAttribute('aria-pressed', 'false'); }

  update(dt) {
    const sign = Math.sign(this.omega); const speed = Math.abs(this.omega);
    // 轴承摩擦为线性项，竹片切割空气产生随速度平方增加的阻力项。
    this.omega = sign * Math.max(0, speed - (.27 * speed + .00125 * speed * speed) * dt); this.angle += this.omega * dt; this.rotor.rotation.y = this.angle;
    const ratio = THREE.MathUtils.clamp(speed / MAX_OMEGA, 0, 1); this.ghosts.visible = ratio > .16;
    this.ghosts.children.forEach((ghost) => { ghost.rotation.y = this.angle - ghost.userData.offset * (.7 + ratio * 3.1); ghost.material.opacity = .012 + ratio * .075; });
    this.halo.material.opacity = ratio > .38 ? (ratio - .38) * .35 : 0; this.halo.scale.setScalar(.92 + ratio * .16 + Math.sin(this.clock.elapsedTime * 16) * ratio * .025); ui.rings.classList.toggle('is-audible', speed > RING_OMEGA); ui.rings.style.setProperty('--ring-intensity', ratio.toFixed(3));
    const rpm = Math.round(speed * 60 / (Math.PI * 2)); ui.rpm.textContent = rpm.toLocaleString('zh-CN'); ui.meter.style.width = `${Math.round(ratio * 100)}%`;
    const heard = speed > 25;
    if (this.soundMode === 'bamboo') {
      ui.sound.textContent = speed > RING_OMEGA ? '哇呜 - 哇呜' : heard ? '低声颤鸣' : '静待风起';
      ui.pitch.textContent = heard ? `${Math.round(120 + 510 * Math.pow(ratio, .72))} Hz` : '-- Hz';
      this.audio.update(this.omega);
    } else {
      ui.sound.textContent = speed > 4 ? '你干嘛' : '静待风起';
      ui.pitch.textContent = speed > 4 ? '循环音频' : '--';
      this.audio.update(0);
      this.updateClip(speed, ratio);
    }
    if (speed > RING_OMEGA) { this.ringing += dt; if (this.ringing > this.best) { this.best = this.ringing; localStorage.setItem('zhu-zhiliao-best', this.best.toFixed(2)); } } else if (this.ringing > 0) this.ringing = Math.max(0, this.ringing - dt * .55);
    ui.live.textContent = `${this.ringing.toFixed(1)}s`; ui.best.textContent = `${this.best.toFixed(1)}s`; ui.fill.style.width = `${Math.min(100, this.ringing / CHALLENGE_SECONDS * 100)}%`;
  }

  resize() { const { clientWidth: width, clientHeight: height } = ui.scene; this.camera3d.aspect = width / height; this.camera3d.updateProjectionMatrix(); this.renderer.setSize(width, height); }
  animate() { requestAnimationFrame(() => this.animate()); this.update(Math.min(this.clock.getDelta(), .05)); this.controls.update(); this.renderer.render(this.scene, this.camera3d); }
}

new Game();
