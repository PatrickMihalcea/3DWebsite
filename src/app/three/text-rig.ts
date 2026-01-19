import * as THREE from 'three';
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export type TextAlignment = 'left' | 'right' | 'center' | 'justified';

type TextRigOptions = {
  fontUrl: string;
  text?: string;

  // Geometry
  size?: number;
  height?: number;
  bevelEnabled?: boolean;
  bevelThickness?: number;
  bevelSize?: number;
  bevelSegments?: number;
  curveSegments?: number;

  // Material
  material?: THREE.Material;

  // Motion
  orbitIntensity?: number; // 0..1
  positionalFloatingIntensity?: number; // 0..1
  phobiaSensitivity?: number; // -1..1
  speed?: number;
  phase?: number;

  // Grabbing
  grabTiltIntensity?: number;   // 0..1 (tilt strength)
  grabMotionIntensity?: number; // 0..1 (positional strength)

  // Wrapping/Layout
  textAlignment?: TextAlignment; // default 'center'. left, right, center, justified
  lineHeight?: number; // default size * 1.25
  minScale?: number; // default 0.75
  spaceWidth?: number; // default size * 0.35
  wrapSpringIntensity?: number; // 0..1 (soft → snappy)
};

class FontCache {
  private static cache = new Map<string, Promise<Font>>();

  static load(fontUrl: string): Promise<Font> {
    const cached = this.cache.get(fontUrl);
    if (cached) return cached;

    const loader = new FontLoader();
    const p = new Promise<Font>((resolve, reject) => {
      loader.load(fontUrl, resolve, undefined, reject);
    });

    this.cache.set(fontUrl, p);
    return p;
  }
}

type WordMesh = {
  mesh: THREE.Mesh;
  width: number;            // unscaled local width
  target: THREE.Vector3;    // target local position (layout space)
  velocity: THREE.Vector3;  // spring velocity
  lineIndex: number;
};

export class TextRig {
  // ===== Motion tuning constants =====
  // Rotation sway (radians)
  private static readonly ORBIT_MAX_RAD = THREE.MathUtils.degToRad(8);
  // Positional float (world units)
  private static readonly FLOAT_MAX_Y = 0.45;
  private static readonly FLOAT_MAX_X = 0.25;
  // ===== Grab tuning constants (make 1.0 feel like “too much”) =====
  private static readonly GRAB_MAX_TILT_RAD = THREE.MathUtils.degToRad(14); // strong at 1.0
  private static readonly GRAB_MAX_ROLL_RAD = THREE.MathUtils.degToRad(10);
  private static readonly GRAB_MAX_MOTION_WORLD = 0.85; // world units
  // Hysteresis tuning:
  // - enter wrap when single-line requiredScale drops BELOW minScale * ENTER
  // - exit wrap when single-line requiredScale rises ABOVE minScale * EXIT
  private readonly WRAP_ENTER = 0.97;
  private readonly WRAP_EXIT = 1.12;

  public readonly group = new THREE.Group();

  private font!: Font;
  private material: THREE.Material;

  private text = '';
  private ready = false;

  // Motion params
  private orbitIntensity = 0.25;
  private floatIntensity = 0.15;
  private phobiaSensitivity = 0.0; // -1..1
  private speed = 0.8;
  private phase = 0;

  // Time
  private t = 0;

  // Base pose (rest)
  private basePosition = new THREE.Vector3();
  private baseRotation = new THREE.Euler();

  // Geometry styling
  private size: number;
  private height: number;
  private bevelEnabled: boolean;
  private bevelThickness: number;
  private bevelSize: number;
  private bevelSegments: number;
  private curveSegments: number;

  // Pointer & gummy state
  private pointer = new THREE.Vector2(0, 0);
  private influenceOffset = new THREE.Vector2(0, 0);
  private influenceVelocity = new THREE.Vector2(0, 0);

  // Layout / wrapping
  private textAlignment: TextAlignment = 'center';
  private lineHeight: number;
  private minScale: number;
  private spaceWidth: number;
  private maxLineWidthWorld: number | null = null;
  private wrapSpringIntensity = 0.5;

  private words: WordMesh[] = [];
  private layoutDirty = true;

  // Hierarchy to avoid centering drift when scaling
  private scaleGroup = new THREE.Group();  // scaled
  private centerGroup = new THREE.Group(); // translated to center (scales with scaleGroup)
  private wordGroup = new THREE.Group();   // contains word meshes

  // Smooth scale spring
  private currentScale = 1.0;
  private scaleVelocity = 0.0;
  private scaleTarget = 1.0;

  // Wrap state with hysteresis (prevents flip-flop)
  private wrapped = false;

  // Grabbing
  // Grab intensities (0..1). If both 0 -> effectively not grabbable.
  private grabTiltIntensity = 0.0;
  private grabMotionIntensity = 0.0;

  // Grab state
  private isGrabbing = false;
  private grabAnchor = new THREE.Vector2(0, 0); // [-1..1] where you “grabbed” within the box
  private grabPull = new THREE.Vector2(0, 0);   // normalized pull vector ([-1..1]ish)

  // Grab springs (local offsets applied on top of base pose)
  private grabPos = new THREE.Vector3(0, 0, 0);
  private grabPosVel = new THREE.Vector3(0, 0, 0);
  private grabPosTarget = new THREE.Vector3(0, 0, 0);

  private grabRot = new THREE.Euler(0, 0, 0, 'XYZ');
  private grabRotVel = new THREE.Vector3(0, 0, 0); // x,y,z angular velocity
  private grabRotTarget = new THREE.Euler(0, 0, 0, 'XYZ');

  constructor(opts: TextRigOptions) {
    this.text = opts.text ?? '';

    this.size = opts.size ?? 1.0;
    this.height = opts.height ?? 0.18;
    this.bevelEnabled = opts.bevelEnabled ?? true;
    this.bevelThickness = opts.bevelThickness ?? 0.03;
    this.bevelSize = opts.bevelSize ?? 0.02;
    this.bevelSegments = opts.bevelSegments ?? 3;
    this.curveSegments = opts.curveSegments ?? 10;

    this.textAlignment = opts.textAlignment ?? 'center';
    this.lineHeight = opts.lineHeight ?? this.size * 1.25;
    this.minScale = opts.minScale ?? 0.75;
    this.spaceWidth = opts.spaceWidth ?? this.size * 0.35;

    this.material =
      opts.material ??
      new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.35,
        roughness: 0.25
      });

    if (typeof opts.orbitIntensity === 'number') this.setOrbitIntensity(opts.orbitIntensity);
    if (typeof opts.positionalFloatingIntensity === 'number') this.setPositionalFloatingIntensity(opts.positionalFloatingIntensity);
    if (typeof opts.phobiaSensitivity === 'number') this.setPhobiaSensitivity(opts.phobiaSensitivity);
    if (typeof opts.speed === 'number') this.setSpeed(opts.speed);
    if (typeof opts.phase === 'number') this.setPhase(opts.phase);
    if (typeof opts.wrapSpringIntensity === 'number') {
      this.wrapSpringIntensity = THREE.MathUtils.clamp(opts.wrapSpringIntensity, 0, 1);
    }
    if (typeof opts.grabTiltIntensity === 'number') {
      this.grabTiltIntensity = THREE.MathUtils.clamp(opts.grabTiltIntensity, 0, 1);
    }
    if (typeof opts.grabMotionIntensity === 'number') {
      this.grabMotionIntensity = THREE.MathUtils.clamp(opts.grabMotionIntensity, 0, 1);
    }

    // Build hierarchy
    this.group.add(this.scaleGroup);
    this.scaleGroup.add(this.centerGroup);
    this.centerGroup.add(this.wordGroup);

    FontCache.load(opts.fontUrl)
      .then((font) => {
        this.font = font;
        this.ready = true;
        if (this.text) this.rebuildWords(this.text);
      })
      .catch((e) => console.error('Failed to load font for TextRig:', e));
  }

  public captureBasePose(): void {
    this.basePosition.copy(this.group.position);
    this.baseRotation.copy(this.group.rotation);
  }

  public captureBasePosition(): void {
    this.basePosition.copy(this.group.position);
  }

  public setText(text: string): void {
    this.text = text;
    if (!this.ready) return;
    this.rebuildWords(text);
  }

  public setTextAlignment(a: TextAlignment): void {
    this.textAlignment = a;
    this.layoutDirty = true;
  }

  public setMinScale(v: number): void {
    this.minScale = THREE.MathUtils.clamp(v, 0.01, 1.0);
    this.layoutDirty = true;
  }

  public setOrbitIntensity(v: number): void {
    this.orbitIntensity = THREE.MathUtils.clamp(v, 0, 1);
  }

  public setPositionalFloatingIntensity(v: number): void {
    this.floatIntensity = THREE.MathUtils.clamp(v, 0, 1);
  }

  public setPhobiaSensitivity(v: number): void {
    this.phobiaSensitivity = THREE.MathUtils.clamp(v, -1, 1);
  }

  public setPointer(nx: number, ny: number): void {
    this.pointer.set(
      THREE.MathUtils.clamp(nx, -1, 1),
      THREE.MathUtils.clamp(ny, -1, 1)
    );
  }

  public setSpeed(v: number): void {
    this.speed = Math.max(0, v);
  }

  public setPhase(v: number): void {
    this.phase = v;
  }

  public setGrabTiltIntensity(v: number) {
    this.grabTiltIntensity = THREE.MathUtils.clamp(v, 0, 1);
  }
  public setGrabMotionIntensity(v: number) {
    this.grabMotionIntensity = THREE.MathUtils.clamp(v, 0, 1);
  }


  public layoutForWidthWorld(maxWidthWorld: number): void {
    this.maxLineWidthWorld = Math.max(0.1, maxWidthWorld);
    this.layoutDirty = true;
  }

  public update(dt: number): void {
    if (!this.ready) return;

    dt = Math.min(dt, 1 / 15);

    this.t += dt * this.speed;
    const tt = this.t + this.phase;

    // Orbit + float
    const orbitAmp = THREE.MathUtils.lerp(0, TextRig.ORBIT_MAX_RAD, this.orbitIntensity);
    const floatAmp = THREE.MathUtils.lerp(0, TextRig.FLOAT_MAX_Y, this.floatIntensity);

    const rx = orbitAmp * Math.sin(tt);
    const ry = orbitAmp * Math.cos(tt);

    const px = TextRig.FLOAT_MAX_X * floatAmp * Math.cos(tt * 0.7);
    const py = floatAmp * Math.sin(tt * 0.65);

    // ---- Grab springs first (so transforms use the latest grabPos/grabRot) ----
    this.updateGrabSprings(dt);

    // ---- Pointer influence (phobia) ONLY ONCE per frame ----
    const phobiaWas = this.phobiaSensitivity;
    if (this.isGrabbing) this.phobiaSensitivity = 0; // fully suppress while grabbing
    this.updatePointerSpring(dt);
    if (this.isGrabbing) this.phobiaSensitivity = phobiaWas;

    const mag = Math.abs(this.phobiaSensitivity);
    const influenceWorld = THREE.MathUtils.lerp(0.0, 0.35, mag);
    const ix = this.influenceOffset.x * influenceWorld;
    const iy = this.influenceOffset.y * influenceWorld;

    const influenceRot = THREE.MathUtils.lerp(0.0, THREE.MathUtils.degToRad(3.0), mag);
    const turnX = -this.influenceOffset.y * influenceRot;
    const turnY = -this.influenceOffset.x * influenceRot;

    // Apply transforms (now includes grab offsets updated this frame)
    this.group.rotation.x = this.baseRotation.x + rx + turnX + this.grabRot.x;
    this.group.rotation.y = this.baseRotation.y + ry + turnY + this.grabRot.y;
    this.group.rotation.z = this.baseRotation.z + this.grabRot.z;

    this.group.position.x = this.basePosition.x + px + ix + this.grabPos.x;
    this.group.position.y = this.basePosition.y + py + iy + this.grabPos.y;

    // Layout
    if (this.layoutDirty) {
      this.recomputeLayoutTargets();
      this.layoutDirty = false;
    }

    this.updateScaleSpring(dt);
    this.scaleGroup.scale.setScalar(this.currentScale);

    this.updateWordSprings(dt);
  }

  public dispose(): void {
    for (const w of this.words) {
      (w.mesh.geometry as THREE.BufferGeometry).dispose();
      this.wordGroup.remove(w.mesh);
    }
    this.words = [];
    this.material.dispose();
  }

  // ---------------------------
  // Build words
  // ---------------------------

  private rebuildWords(text: string): void {
    for (const w of this.words) {
      (w.mesh.geometry as THREE.BufferGeometry).dispose();
      this.wordGroup.remove(w.mesh);
    }
    this.words = [];

    this.centerGroup.position.set(0, 0, 0);

    const cleaned = text.trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      this.layoutDirty = true;
      return;
    }

    const tokens = cleaned.split(' ');
    for (const token of tokens) {
      const geometry = new TextGeometry(token, {
        font: this.font,
        size: this.size,
        height: this.height,
        curveSegments: this.curveSegments,
        bevelEnabled: this.bevelEnabled,
        bevelThickness: this.bevelThickness,
        bevelSize: this.bevelSize,
        bevelSegments: this.bevelSegments,
      });

      geometry.computeBoundingBox();
      const bb = geometry.boundingBox;

      let width = 0;
      if (bb) width = bb.max.x - bb.min.x;

      // Left-anchor at x=0
      if (bb) geometry.translate(-bb.min.x, 0, 0);

      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;

      const word: WordMesh = {
        mesh,
        width,
        target: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        lineIndex: 0,
      };

      mesh.position.copy(word.target);

      this.words.push(word);
      this.wordGroup.add(mesh);
    }

    this.currentScale = 1.0;
    this.scaleVelocity = 0.0;
    this.scaleTarget = 1.0;
    this.wrapped = false;

    this.layoutDirty = true;
  }

  // ---------------------------
  // Layout computation (smooth scale then wrap)
  // ---------------------------

  private recomputeLayoutTargets(): void {
    if (!this.maxLineWidthWorld || this.words.length === 0) {
      this.wrapped = false;
      this.setScaleTarget(1.0);
      this.assignSingleLineTargets();
      this.centerViaCenterGroup();
      return;
    }

    const naturalWidth = this.computeSingleLineWidth(); // local width at scale=1
    const singleRequiredScale = THREE.MathUtils.clamp(
      this.maxLineWidthWorld / Math.max(1e-6, naturalWidth),
      0.0,
      1.0
    );

    // Hysteresis switching
    if (!this.wrapped && singleRequiredScale < this.minScale * this.WRAP_ENTER) {
      this.wrapped = true;
    } else if (this.wrapped && singleRequiredScale > this.minScale * this.WRAP_EXIT) {
      this.wrapped = false;
    }

    if (!this.wrapped) {
      // Unwrapped: scale smoothly to fit in one line
      this.setScaleTarget(singleRequiredScale);
      this.assignSingleLineTargets();
      this.centerViaCenterGroup();
      return;
    }

    // Wrapped mode:
    // - Wrap using the "minScale reference width" so the breakpoints don't flap
    // - Then compute a wrappedScaleTarget based on the widest wrapped line so scaling remains smooth
    const wrapWidthLocal = this.maxLineWidthWorld / this.minScale;

    const lines = this.assignWrappedTargetsAndReturnLines(wrapWidthLocal);
    const widestLine = this.computeWidestLineWidth(lines);

    // smooth scale while wrapped too (instead of forcing minScale)
    const wrappedScaleTarget = THREE.MathUtils.clamp(
      this.maxLineWidthWorld / Math.max(1e-6, widestLine),
      0.01,
      1.0
    );

    // Keep it at least minScale-ish so it doesn't get too tiny in wrapped state
    this.setScaleTarget(Math.max(this.minScale, wrappedScaleTarget));

    this.centerViaCenterGroup();
  }

  private computeWidestLineWidth(lines: WordMesh[][]): number {
    let widest = 0;
    for (const line of lines) {
      widest = Math.max(widest, this.computeLineWidth(line));
    }
    return widest;
  }

  private setScaleTarget(v: number): void {
    this.scaleTarget = THREE.MathUtils.clamp(v, 0.01, 1.0);
  }

  private updateScaleSpring(dt: number): void {
    const k = 60;
    const c = 2 * Math.sqrt(k) * 0.95;

    const x = this.currentScale - this.scaleTarget;
    const a = -k * x - c * this.scaleVelocity;

    this.scaleVelocity += a * dt;
    this.currentScale += this.scaleVelocity * dt;
  }

  private updateWordSprings(dt: number): void {
    const k = THREE.MathUtils.lerp(35, 180, this.wrapSpringIntensity);
    const c = 2 * Math.sqrt(k) * THREE.MathUtils.lerp(1.1, 0.8, this.wrapSpringIntensity);

    for (const w of this.words) {
      const pos = w.mesh.position;
      const vel = w.velocity;

      const dx = pos.x - w.target.x;
      const dy = pos.y - w.target.y;

      const ax = -k * dx - c * vel.x;
      const ay = -k * dy - c * vel.y;

      vel.x += ax * dt;
      vel.y += ay * dt;

      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
    }
  }

  private computeSingleLineWidth(): number {
    let w = 0;
    for (let i = 0; i < this.words.length; i++) {
      w += this.words[i].width;
      if (i !== this.words.length - 1) w += this.spaceWidth;
    }
    return w;
  }

  private computeLineWidth(words: WordMesh[]): number {
    let w = 0;
    for (let i = 0; i < words.length; i++) {
      w += words[i].width;
      if (i !== words.length - 1) w += this.spaceWidth;
    }
    return w;
  }

  private assignSingleLineTargets(): void {
    const totalWidth = this.computeSingleLineWidth();
    const line = this.layoutLine(this.words);

    // Align within own width
    this.applyAlignmentToLine(line, totalWidth, totalWidth, this.textAlignment);

    for (const item of line.items) {
      item.word.target.set(item.x, 0, 0);
      item.word.lineIndex = 0;
    }
  }

  /**
   * Wraps & sets targets, and also returns the computed lines so we can measure widest line.
   */
  private assignWrappedTargetsAndReturnLines(maxWidthLocal: number): WordMesh[][] {
    const lines: WordMesh[][] = [];
    let current: WordMesh[] = [];
    let currentW = 0;

    for (const word of this.words) {
      const addW = (current.length === 0 ? 0 : this.spaceWidth) + word.width;

      if (current.length > 0 && (currentW + addW) > maxWidthLocal) {
        lines.push(current);
        current = [word];
        currentW = word.width;
      } else {
        current.push(word);
        currentW += addW;
      }
    }
    if (current.length) lines.push(current);

    for (let li = 0; li < lines.length; li++) {
      const lineWords = lines[li];
      const lineWidth = this.computeLineWidth(lineWords);
      const y = -li * this.lineHeight;

      const line = this.layoutLine(lineWords);

      const isLastLine = li === lines.length - 1;
      const alignmentForThisLine: TextAlignment =
        this.textAlignment === 'justified' && isLastLine ? 'left' : this.textAlignment;

      this.applyAlignmentToLine(line, maxWidthLocal, lineWidth, alignmentForThisLine);

      for (const item of line.items) {
        item.word.target.set(item.x, y, 0);
        item.word.lineIndex = li;
      }
    }

    return lines;
  }

  private layoutLine(words: WordMesh[]): { items: { word: WordMesh; x: number }[] } {
    const items: { word: WordMesh; x: number }[] = [];
    let x = 0;

    for (let i = 0; i < words.length; i++) {
      items.push({ word: words[i], x });
      x += words[i].width;
      if (i !== words.length - 1) x += this.spaceWidth;
    }

    return { items };
  }

  private applyAlignmentToLine(
    line: { items: { word: WordMesh; x: number }[] },
    maxWidthLocal: number,
    lineWidthLocal: number,
    alignment: TextAlignment
  ): void {
    if (alignment === 'left') return;

    if (alignment === 'right') {
      const shift = maxWidthLocal - lineWidthLocal;
      for (const item of line.items) item.x += shift;
      return;
    }

    if (alignment === 'center') {
      const shift = (maxWidthLocal - lineWidthLocal) * 0.5;
      for (const item of line.items) item.x += shift;
      return;
    }

    // justified
    const gaps = Math.max(0, line.items.length - 1);
    if (gaps === 0) return;

    const extra = Math.max(0, maxWidthLocal - lineWidthLocal);
    const extraPerGap = extra / gaps;

    let x = 0;
    for (let i = 0; i < line.items.length; i++) {
      line.items[i].x = x;
      x += line.items[i].word.width;
      if (i !== line.items.length - 1) x += this.spaceWidth + extraPerGap;
    }
  }

  /**
   * Center based on TARGETS by moving centerGroup.
   * This transform sits under scaleGroup so it scales correctly with currentScale.
   */
  private centerViaCenterGroup(): void {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const w of this.words) {
      const x0 = w.target.x;
      const x1 = x0 + w.width;

      const y0 = w.target.y;
      const y1 = y0 + this.size; // approx height

      minX = Math.min(minX, x0);
      maxX = Math.max(maxX, x1);
      minY = Math.min(minY, y0);
      maxY = Math.max(maxY, y1);
    }

    if (!isFinite(minX) || !isFinite(maxX)) return;

    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;

    this.centerGroup.position.set(-cx, -cy, 0);
  }

  // ---------------------------
  // Pointer spring for whole rig
  // ---------------------------

  private updatePointerSpring(dt: number): void {
    const s = this.phobiaSensitivity;

    if (Math.abs(s) < 1e-4) {
      const decay = Math.max(0, 1 - dt * 10);
      this.influenceOffset.multiplyScalar(decay);
      this.influenceVelocity.multiplyScalar(decay);
      return;
    }

    const strength = Math.abs(s);
    const sign = Math.sign(s);

    const maxOffset = THREE.MathUtils.lerp(0.0, 0.55, strength);
    const k = THREE.MathUtils.lerp(18, 140, strength);
    const c = 2 * Math.sqrt(k) * THREE.MathUtils.lerp(1.05, 0.85, strength);

    const toward = this.pointer.clone();
    const len = toward.length();

    if (len < 1e-4) {
      const decay = Math.max(0, 1 - dt * 8);
      this.influenceOffset.multiplyScalar(decay);
      this.influenceVelocity.multiplyScalar(decay);
      return;
    }

    toward.divideScalar(len);

    const proximity = THREE.MathUtils.clamp(1 - len, 0, 1);
    const targetStrength = maxOffset * (0.25 + 0.75 * proximity);

    const target = toward.multiplyScalar(targetStrength * sign);

    const ax = -k * (this.influenceOffset.x - target.x) - c * this.influenceVelocity.x;
    const ay = -k * (this.influenceOffset.y - target.y) - c * this.influenceVelocity.y;

    this.influenceVelocity.x += ax * dt;
    this.influenceVelocity.y += ay * dt;

    this.influenceOffset.x += this.influenceVelocity.x * dt;
    this.influenceOffset.y += this.influenceVelocity.y * dt;
  }

  public getBoundsWorld(): { width: number; height: number } {
    // If we don't have words yet (font still loading), report 0.
    // (HeroScene can handle 0 gracefully.)
    // @ts-ignore: words is a private field inside the class anyway
    if (!this.words || this.words.length === 0) return { width: 0, height: 0 };

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    // Targets are in "layout/local" space (before scale). Width is also local.
    for (const w of this.words) {
      const x0 = w.target.x;
      const x1 = x0 + w.width;

      const y0 = w.target.y;
      const y1 = y0 + this.size; // approximate height of a line using font size

      if (x0 < minX) minX = x0;
      if (x1 > maxX) maxX = x1;
      if (y0 < minY) minY = y0;
      if (y1 > maxY) maxY = y1;
    }

    if (!isFinite(minX) || !isFinite(maxX)) return { width: 0, height: 0 };

    const widthLocal = Math.max(0, maxX - minX);
    const heightLocal = Math.max(0, maxY - minY);

    // Your text block is rendered inside scaleGroup with currentScale applied.
    const s = this.currentScale;

    return {
      width: widthLocal * s,
      height: heightLocal * s,
    };
  }

  public beginGrab(anchorX: number, anchorY: number): void {
    if (this.grabTiltIntensity <= 0 && this.grabMotionIntensity <= 0) return;

    this.isGrabbing = true;
    this.grabAnchor.set(
      THREE.MathUtils.clamp(anchorX, -1, 1),
      THREE.MathUtils.clamp(anchorY, -1, 1)
    );

    // reset pull so it starts calm
    this.grabPull.set(0, 0);
  }

  // Called each pointer move while active
  // pullX/pullY should be normalized (-1..1) based on drag distance
  public updateGrab(pullX: number, pullY: number): void {
    if (!this.isGrabbing) return;

    this.grabPull.set(
      THREE.MathUtils.clamp(pullX, -1, 1),
      THREE.MathUtils.clamp(pullY, -1, 1)
    );

    // Strength based on pull distance
    const pullMag = THREE.MathUtils.clamp(this.grabPull.length(), 0, 1);

    // Translation target (pull direction)
    const motionMax = TextRig.GRAB_MAX_MOTION_WORLD * this.grabMotionIntensity;
    this.grabPosTarget.set(
      this.grabPull.x * motionMax,
      this.grabPull.y * motionMax,
      0
    );

    // Tilt target
    const tiltMax = TextRig.GRAB_MAX_TILT_RAD * this.grabTiltIntensity;

    // Pitch (x) responds to vertical pull; yaw (y) responds to horizontal pull
    const pitch = -this.grabPull.y * tiltMax;
    const yaw   =  this.grabPull.x * tiltMax;

    // Roll is what gives “grabbed on the side” torque feeling.
    // Depends on where you grabbed (anchor) + pull direction.
    const rollMax = TextRig.GRAB_MAX_ROLL_RAD * this.grabTiltIntensity;
    const roll =
      (-this.grabPull.x * this.grabAnchor.y + this.grabPull.y * this.grabAnchor.x) * rollMax;

    this.grabRotTarget.set(pitch, yaw, roll, 'XYZ');

    // If you want pull to feel more “hand-like”, you can optionally amplify torque with pullMag:
    // this.grabRotTarget.x *= (0.6 + 0.4 * pullMag);
    // this.grabRotTarget.y *= (0.6 + 0.4 * pullMag);
    // this.grabRotTarget.z *= (0.6 + 0.4 * pullMag);
  }

  // Called on pointer up/cancel
  public endGrab(): void {
    this.isGrabbing = false;

    // spring back to neutral targets
    this.grabPosTarget.set(0, 0, 0);
    this.grabRotTarget.set(0, 0, 0, 'XYZ');
    this.grabPull.set(0, 0);
  }

  // You’ll use this in HeroScene’s hit-testing
  public isGrabActive(): boolean {
    return this.isGrabbing;
  }

  private updateGrabSprings(dt: number): void {
    // Butter: fairly stiff but critically damped-ish
    const kPos = 90;
    const cPos = 2 * Math.sqrt(kPos) * 0.95;

    // Position spring
    {
      const dx = this.grabPos.x - this.grabPosTarget.x;
      const dy = this.grabPos.y - this.grabPosTarget.y;

      const ax = -kPos * dx - cPos * this.grabPosVel.x;
      const ay = -kPos * dy - cPos * this.grabPosVel.y;

      this.grabPosVel.x += ax * dt;
      this.grabPosVel.y += ay * dt;

      this.grabPos.x += this.grabPosVel.x * dt;
      this.grabPos.y += this.grabPosVel.y * dt;
    }

    // Rotation spring
    const kRot = 120;
    const cRot = 2 * Math.sqrt(kRot) * 0.95;

    {
      const rx = this.grabRot.x - this.grabRotTarget.x;
      const ry = this.grabRot.y - this.grabRotTarget.y;
      const rz = this.grabRot.z - this.grabRotTarget.z;

      const ax = -kRot * rx - cRot * this.grabRotVel.x;
      const ay = -kRot * ry - cRot * this.grabRotVel.y;
      const az = -kRot * rz - cRot * this.grabRotVel.z;

      this.grabRotVel.x += ax * dt;
      this.grabRotVel.y += ay * dt;
      this.grabRotVel.z += az * dt;

      this.grabRot.x += this.grabRotVel.x * dt;
      this.grabRot.y += this.grabRotVel.y * dt;
      this.grabRot.z += this.grabRotVel.z * dt;
    }
  }
}
