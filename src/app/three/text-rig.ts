import * as THREE from 'three';
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

type TextRigOptions = {
  fontUrl: string;                 // e.g. 'assets/fonts/helvetiker_regular.typeface.json'
  text?: string;
  size?: number;                   // world units
  height?: number;                 // extrusion depth
  bevelEnabled?: boolean;
  bevelThickness?: number;
  bevelSize?: number;
  bevelSegments?: number;
  curveSegments?: number;

  // luxury feel defaults
  material?: THREE.Material;

  // motion defaults
  orbitIntensity?: number;         // 0..1
  positionalFloatingIntensity?: number; // 0..1
  speed?: number;                  // base animation speed
  phase?: number;                  // phase offset (radians)
};

class FontCache {
  private static cache = new Map<string, Promise<Font>>();

  static load(fontUrl: string): Promise<Font> {
    const cached = this.cache.get(fontUrl);
    if (cached) return cached;

    const loader = new FontLoader();
    const p = new Promise<Font>((resolve, reject) => {
      loader.load(
        fontUrl,
        (font) => resolve(font),
        undefined,
        (err) => reject(err)
      );
    });

    this.cache.set(fontUrl, p);
    return p;
  }
}

export class TextRig {
  public readonly group = new THREE.Group();

  private font!: Font;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.Material;

  private text = '';
  private ready = false;

  private orbitIntensity = 0.25; // 0..1
  private floatIntensity = 0.15; // 0..1
  private speed = 0.8;
  private phase = 0;

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

  constructor(opts: TextRigOptions) {
    this.text = opts.text ?? '';
    this.size = opts.size ?? 1.0;
    this.height = opts.height ?? 0.18;
    this.bevelEnabled = opts.bevelEnabled ?? true;
    this.bevelThickness = opts.bevelThickness ?? 0.03;
    this.bevelSize = opts.bevelSize ?? 0.02;
    this.bevelSegments = opts.bevelSegments ?? 3;
    this.curveSegments = opts.curveSegments ?? 10;

    this.material =
      opts.material ??
      new THREE.MeshStandardMaterial({
        color: 0x111111,     // graphite
        metalness: 0.35,
        roughness: 0.25,
      });

    if (typeof opts.orbitIntensity === 'number') this.setOrbitIntensity(opts.orbitIntensity);
    if (typeof opts.positionalFloatingIntensity === 'number') this.setPositionalFloatingIntensity(opts.positionalFloatingIntensity);
    if (typeof opts.speed === 'number') this.speed = opts.speed;
    if (typeof opts.phase === 'number') this.phase = opts.phase;

    // Load font async (cached)
    FontCache.load(opts.fontUrl)
      .then((font) => {
        this.font = font;
        this.ready = true;

        // Build initial text (if provided)
        if (this.text) this.rebuildTextMesh(this.text);
      })
      .catch((e) => {
        console.error('Failed to load font for TextRig:', e);
      });
  }

  /** Set the "rest pose" (useful after positioning the rig). */
  public captureBasePose(): void {
    this.basePosition.copy(this.group.position);
    this.baseRotation.copy(this.group.rotation);
  }

  public setText(text: string): void {
    this.text = text;

    if (!this.ready) return; // font not loaded yet; will build once ready if text existed
    this.rebuildTextMesh(text);
  }

  public setOrbitIntensity(v: number): void {
    this.orbitIntensity = THREE.MathUtils.clamp(v, 0, 1);
  }

  public setPositionalFloatingIntensity(v: number): void {
    this.floatIntensity = THREE.MathUtils.clamp(v, 0, 1);
  }

  public setSpeed(v: number): void {
    this.speed = Math.max(0, v);
  }

  public setPhase(v: number): void {
    this.phase = v;
  }

  /** Call every frame with deltaTime in seconds. */
  public update(dt: number): void {
    if (!this.ready) return;

    this.t += dt * this.speed;

    // Luxury mapping: keep ranges small
    // orbitAmp in radians: max around ~2.5 degrees
    const orbitAmp = THREE.MathUtils.lerp(0.0, THREE.MathUtils.degToRad(2.5), this.orbitIntensity);

    // floatAmp in world units: max small (depends on your scene scale)
    const floatAmp = THREE.MathUtils.lerp(0.0, 0.18, this.floatIntensity);

    const tt = this.t + this.phase;

    // Circular sway (uniform rotation)
    const rx = orbitAmp * Math.sin(tt);
    const ry = orbitAmp * Math.cos(tt);

    // Gentle positional float (mostly Y, tiny X)
    const px = floatAmp * 0.35 * Math.cos(tt * 0.7);
    const py = floatAmp * Math.sin(tt * 0.65);

    this.group.rotation.x = this.baseRotation.x + rx;
    this.group.rotation.y = this.baseRotation.y + ry;

    this.group.position.x = this.basePosition.x + px;
    this.group.position.y = this.basePosition.y + py;
  }

  public dispose(): void {
    if (this.mesh) {
      const geom = this.mesh.geometry as THREE.BufferGeometry;
      geom.dispose();
      // material is owned by rig; dispose if you won't reuse it elsewhere
      this.material.dispose();
      this.group.remove(this.mesh);
      this.mesh = null;
    }
  }

  private rebuildTextMesh(text: string): void {
    // Dispose old geometry
    if (this.mesh) {
      const geom = this.mesh.geometry as THREE.BufferGeometry;
      geom.dispose();
      this.group.remove(this.mesh);
      this.mesh = null;
    }

    const geometry = new TextGeometry(text, {
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

    // Center geometry around origin so orbit pivots nicely
    const bb = geometry.boundingBox;
    if (bb) {
      const center = new THREE.Vector3();
      bb.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);
    }

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;

    this.group.add(this.mesh);
  }
}
