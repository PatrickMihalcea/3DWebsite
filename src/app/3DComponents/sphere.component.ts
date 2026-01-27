import {
  Component,
  ElementRef,
  Inject,
  PLATFORM_ID,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { LoadingManagerService } from '../Services/loading-manager.service';
import { ROUTE_CROSSFADE_MS } from '../Services/route-transitions';
import { Subscription, filter } from 'rxjs';

type AccelerationMode = 'up' | 'down' | 'linear' | 'arc';

type AnimationCheckpoint = {
  time: number; // seconds since animation start
  position: [number, number, number];
  angle: [number, number, number]; // radians (x,y,z)
  acceleration: AccelerationMode;
  scale: number;
};

@Component({
  selector: 'app-sphere',
  standalone: true,
  template: '<div class="sphere-container"></div>',
  styles: [`
    .sphere-container {
      width: 100%;
      height: 100%;
      display: block;
      position: relative;
      overflow: hidden;
      touch-action: none; /* allow cow tugging without page scroll */
    }
  `]
})
export class Sphere implements AfterViewInit, OnDestroy {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private bloomEnabled = false;

  private isBrowser = false;
  private frameId: number | null = null;
  private loadModelTimeoutId: number | null = null;
  private clock = new THREE.Clock();
  private routeSub: Subscription | null = null;

  // Default OrbitControls constraints for the Sphere scene.
  // Routes can override these via `routeCameraPresets[route].controls`.
  private readonly DEFAULT_CONTROLS_LIMITS = {
    autoRotateSpeed: 1.0,
    // Polar angle is measured from "up": 0 = directly above, PI/2 = horizon, PI = directly below.
    minPolarAngle: THREE.MathUtils.degToRad(75),  // don't go too high
    maxPolarAngle: THREE.MathUtils.degToRad(93),  // don't go too low
    // OrbitControls defaults (we make them explicit so we don't need to "capture" them at runtime).
    minDistance: 0,
    maxDistance: Infinity,
  } as const;

  /**
   * Route-driven camera presets.
   *
   * These keys correspond to the `data: { animation: '...' }` values in `app.routes.ts`.
   * Tweak these numbers to taste.
   */
  private readonly routeCameraPresets: Record<
    string,
    {
      position: [number, number, number];
      target: [number, number, number];
      /**
       * Horizontal framing shift in screen space.
       *
       * - `0` keeps the scene centered (default).
       * - Positive values push the scene to the **right** (useful to make room for left-side UI).
       * - Negative values push the scene to the **left**.
       *
       * Typical values: `0.15` .. `0.45`. Values near `0.5` approach the screen edge.
       *
       * Implementation note: this is implemented via an off-axis perspective projection
       * using `PerspectiveCamera.filmOffset`, so it does NOT change the world-space orbit center.
       */
      frameShiftX?: number; // ~[-0.5..0.5]
      autoRotate: boolean;
      /**
       * If true, pointer movement continuously drives camera Y using
       * `minCameraHeight`/`maxCameraHeight`.
       * If false, the camera's Y from the preset is preserved.
       */
      pointerHeight: boolean;
      /** Enable/disable gentle camera bob for this route. */
      bob: boolean;
      /** When true, render the scene with a bloom post-processing pass. */
      bloom: boolean;
      /** Optional bloom tuning when `bloom: true`. */
      bloomParams?: Partial<{ strength: number; radius: number; threshold: number }>;
      /** When true, render the UFO as a glowing particle mesh instead of the GLTF meshes. */
      ufoParticles: boolean;
      /** Optional tuning for the UFO particle look. */
      ufoParticleParams?: Partial<{ opacity: number; size: number; color: number; density: number }>;
      /** Enable/disable spawning new cows on this route. */
      cowSpawner: boolean;
      /**
       * Optional OrbitControls constraint overrides for this route.
       * Any omitted values fall back to Sphere's default constraints.
       */
      controls?: Partial<{
        minPolarAngle: number; // radians
        maxPolarAngle: number; // radians
        minDistance: number;
        maxDistance: number;
        autoRotateSpeed: number;
      }>;
    }
  > = {
    home: {
      position: [2, 0.5, 5],
      target: [0, 0.2, 0],
      frameShiftX: 0,
      autoRotate: true,
      pointerHeight: true,
      bob: true,
      bloom: true,
      bloomParams: { strength: 0.75, radius: 0.35, threshold: 0.15 },
      ufoParticles: false,
      cowSpawner: true,
    },
    projects: {
      position: [0, -3, 0],
      target: [0, 0, 0],
      // Push the background scene to the right on the Projects route.
      // Tweak this to taste (0.35..0.50 are common ranges).
      frameShiftX: 1,
      autoRotate: true,
      pointerHeight: false,
      bob: false,
      bloom: true,
      bloomParams: { strength: 0.45, radius: 0.4, threshold: 0.2 },
      ufoParticles: true,
      // Reduce perceived "luminosity" for particles (opacity + smaller point size).
      ufoParticleParams: { opacity: 0.35, size: 0.0212, color: 0x66baff , density: 0.7},
      cowSpawner: false,
      // Allow top-down shots.
      controls: { minPolarAngle: 0, maxPolarAngle: Math.PI },
    },
  };

  // Route camera tween state
  private routeCamActive = false;
  private routeCamElapsedSec = 0;
  private routeCamDurationSec = ROUTE_CROSSFADE_MS / 1000;
  private routeCamFromPos = new THREE.Vector3();
  private routeCamToPos = new THREE.Vector3();
  private routeCamFromTarget = new THREE.Vector3();
  private routeCamToTarget = new THREE.Vector3();
  private routeCamAutoRotateAfter = true;
  private routeCamFromFrameShiftX = 0;
  private routeCamToFrameShiftX = 0;

  /**
   * Flight animation is driven by checkpoints.
   *
   * - `time` is seconds from the start of the animation.
   * - First checkpoint MUST have `time: 0`.
   * - Each segment interpolates from checkpoint[i] -> checkpoint[i+1].
   * - Segment easing is controlled by checkpoint[i+1].acceleration:
   *   - 'up'     => ease-in (speeds up into the new position)
   *   - 'down'   => ease-out (slows down into the new position)
   *   - 'arc'    => ease-in-out (speeds up to midpoint, slows down to target)
   *   - 'linear' => constant speed
   */
  private ufo: THREE.Object3D | null = null; // wrapper that receives animation transforms
  private ufoModel: THREE.Object3D | null = null; // original GLTF scene
  private ufoPoints: THREE.Points | null = null; // particle representation
  private ufoParticlesDesired = false; // set by current route; applied once UFO loads
  private ufoParticleParamsDesired: Partial<{ opacity: number; size: number; color: number; density: number }> = {};
  private ufoPointsMaterial: THREE.PointsMaterial | null = null;
  private ufoPointsAllPositions: Float32Array | null = null; // cached full vertex list (xyzxyz...)
  private flightStartTime: number | null = null;

  // Cow spawner (multiple cows)
  private cowSpawnerActive = true;
  private cowTemplate: THREE.Object3D | null = null;
  private cowClips: THREE.AnimationClip[] = [];
  private cowNextSpawnTime: number | null = null; // seconds since scene start
  private cows: Array<{
    wrapper: THREE.Group;
    model: THREE.Object3D;
    spawnTime: number;
    startQuat: THREE.Quaternion;
    endQuat: THREE.Quaternion;
    tugOffset: THREE.Vector3;
    tugVel: THREE.Vector3;
    tugTarget: THREE.Vector3;
    mixer: THREE.AnimationMixer | null;
    action: THREE.AnimationAction | null;
  }> = [];

  // Knobs
  public firstCowTime = 10.0; // seconds after scene start when first cow begins rising
  public cowSpawnIntervalMinSec = 30.0; // random interval (seconds) min
  public cowSpawnIntervalMaxSec = 50.0; // random interval (seconds) max
  public cowMaxActive = 3; // safety cap
  public cowSensitivity = 0.6; // 0..1 (0 = no tug, 1 = strong tug)
  private cowMaxTugWorld = 1.5; // world units, scaled by cowSensitivity

  private cowAnimSpeed = 1.0;
  private cowAnimIndex = 0;
  private readonly animateUfo = true;
  private cowRiseDurationSec = 35.0;
  private cowStartPos = new THREE.Vector3(0, -6, -1);
  private cowEndPos = new THREE.Vector3(0, 1, -0.55); // tweak to place under UFO

  // Gentle camera bob (adds a small reversible offset so it doesn't drift)
  private cameraBobEnabled = true;
  private cameraBobAmpY = 0.4;
  private cameraBobAmpX = 0.0;
  private cameraBobAmpZ = 0;
  private cameraBobHz = 0.05; // cycles per second
  private cameraBobPrev = new THREE.Vector3();
  private cameraBobActiveLastFrame = false;

  // Mouse-driven camera height
  private cameraHeightEnabled = true;
  public minCameraHeight = 0;
  public maxCameraHeight = .5;
  private cameraHeightTarget: number | null = null;
  private cameraHeightFollowSpeed = 8; // higher = snappier

  // Edit this array to design new animations quickly.
  private readonly checkpoints: AnimationCheckpoint[] = [
    { time: 0, position: [2, 6, -10], angle: [0.2, -2.4, 0], acceleration: 'linear', scale: 0.0001 },
    // { time: 0, position: [-15, -3, -10], angle: [0, -0.6, -0.1], acceleration: 'linear', scale: 0.8 },
    // { time: 3.25, position: [-16, -3.2, -10], angle: [0, -0.7, -0.2], acceleration: 'linear', scale: 1 },
    { time: 3, position: [-3, -1, 0], angle: [-1, -1.0, -1.0], acceleration: 'arc', scale: 0.95 },
    { time: 6, position: [0, 0.7, 0.12], angle: [0, 0, 0], acceleration: 'arc', scale: 1 },
  ];
  private resumeAutoRotateDuringIntoSecondsBefore = 3.5;

  // Optional: keep reference for cleanup
  private resizeHandler = () => this.onResize();

  // Cow tug interaction
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private tuggingCowIndex: number | null = null;
  private tugPointerId: number | null = null;
  private tugStartClientX = 0;
  private tugStartClientY = 0;
  private tugStartOffset = new THREE.Vector3();
  private pointerDownHandler = (ev: PointerEvent) => this.onPointerDown(ev);
  private pointerMoveHandler = (ev: PointerEvent) => this.onPointerMove(ev);
  private pointerUpHandler = (ev: PointerEvent) => this.onPointerUp(ev);
  private globalPointerMoveHandler = (ev: PointerEvent) => this.onGlobalPointerMove(ev);

  constructor(
    private elRef: ElementRef,
    private loadingService: LoadingManagerService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    // Prevent SSR from running Three.js / window calls
    if (!this.isBrowser) return;

    this.initScene();
    this.addLights();
    this.addOrbitControls();
    // Keep OrbitControls non-interactive always; only toggle auto-rotate around the intro.
    if (this.animateUfo) this.setAutoRotateEnabled(false);
    this.animate();

    window.addEventListener('resize', this.resizeHandler);

    // Tug interactions on the canvas
    const el = this.renderer.domElement;
    // Use capture so we can intercept events before OrbitControls (prevents OrbitControls state from leaving NONE).
    el.addEventListener('pointerdown', this.pointerDownHandler, { passive: false, capture: true });
    el.addEventListener('pointermove', this.pointerMoveHandler, { passive: false, capture: true });
    el.addEventListener('pointerup', this.pointerUpHandler, { passive: false, capture: true });
    el.addEventListener('pointercancel', this.pointerUpHandler, { passive: false, capture: true });

    // Drive camera "tilt" even when other overlay panes capture pointer events.
    window.addEventListener('pointermove', this.globalPointerMoveHandler, { passive: true });

    // Defer GLTF loading by one macrotask to avoid Angular dev-mode NG0100
    // (ExpressionChangedAfterItHasBeenCheckedError) when the loading manager
    // flips `isLoading$` during the initial view stability check.
    this.loadModelTimeoutId = window.setTimeout(() => this.loadModel(), 0);

    // Drive camera pose from route changes (Home vs Projects, etc).
    this.setupRouteCamera();
  }

  private setupRouteCamera(): void {
    // Apply initial route preset (no animation).
    this.applyRouteCameraPreset(this.getActiveRouteAnimationKey(), true);

    // Then animate on subsequent navigations.
    this.routeSub?.unsubscribe();
    this.routeSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        this.applyRouteCameraPreset(this.getActiveRouteAnimationKey(), false);
      });
  }

  private getActiveRouteAnimationKey(): string {
    // Walk to the deepest primary route and read its `data.animation` key.
    let r = this.router.routerState.snapshot.root;
    while (r.firstChild) r = r.firstChild;
    return (r.data?.['animation'] as string | undefined) ?? 'home';
  }

  private applyRouteCameraPreset(key: string, immediate: boolean): void {
    const preset = this.routeCameraPresets[key] ?? this.routeCameraPresets['home'];
    const toPos = new THREE.Vector3(preset.position[0], preset.position[1], preset.position[2]);
    const toTarget = new THREE.Vector3(preset.target[0], preset.target[1], preset.target[2]);
    const toFrameShiftX = preset.frameShiftX ?? 0;

    // Keep duration in sync in case you edit ROUTE_CROSSFADE_MS at runtime.
    this.routeCamDurationSec = Math.max(0.05, ROUTE_CROSSFADE_MS / 1000);

    if (immediate) {
      this.camera.position.copy(toPos);
      if (this.controls) this.controls.target.copy(toTarget);
      this.camera.lookAt(toTarget);
      this.applyFrameShiftX(toFrameShiftX);
      // IMPORTANT: pointer-driven height will otherwise "snap" camera Y back into the
      // [minCameraHeight..maxCameraHeight] range right after the tween completes.
      this.cameraHeightEnabled = preset.pointerHeight;
      this.cameraBobEnabled = preset.bob;
      this.cameraHeightTarget = preset.pointerHeight ? this.camera.position.y : null;
      this.setAutoRotateEnabled(preset.autoRotate);
      this.applyControlsLimitsForRoute(preset);
      this.applyBloomForRoute(preset);
      this.applyUfoParticlesForRoute(preset);
      this.applyCowSpawnerForRoute(preset);
      this.routeCamActive = false;
      return;
    }

    // Start tween from current camera pose.
    this.routeCamFromPos.copy(this.camera.position);
    this.routeCamToPos.copy(toPos);

    const currentTarget = this.controls?.target ?? new THREE.Vector3(0, 0, 0);
    this.routeCamFromTarget.copy(currentTarget);
    this.routeCamToTarget.copy(toTarget);

    this.routeCamFromFrameShiftX = this.getCurrentFrameShiftX();
    this.routeCamToFrameShiftX = toFrameShiftX;

    this.routeCamElapsedSec = 0;
    this.routeCamActive = true;
    this.routeCamAutoRotateAfter = preset.autoRotate;

    // Avoid controls fighting the route tween.
    this.setAutoRotateEnabled(false);
    this.cameraBobActiveLastFrame = false;

    // Apply per-route camera behaviors during/after the tween.
    this.cameraHeightEnabled = preset.pointerHeight;
    this.cameraBobEnabled = preset.bob;
    this.cameraHeightTarget = preset.pointerHeight ? this.camera.position.y : null;

    // Apply per-route OrbitControls constraints now, so the tween isn't snapped/clamped mid-way.
    this.applyControlsLimitsForRoute(preset);

    // Apply bloom toggle for this route (creates composer lazily if needed).
    this.applyBloomForRoute(preset);

    // Toggle UFO render mode (mesh vs particles) for this route.
    this.applyUfoParticlesForRoute(preset);

    // Enable/disable cow spawning for this route.
    this.applyCowSpawnerForRoute(preset);
  }

  private applyControlsLimitsForRoute(
    preset: { controls?: Partial<{ minPolarAngle: number; maxPolarAngle: number; minDistance: number; maxDistance: number; autoRotateSpeed: number }> }
  ): void {
    if (!this.controls) return;

    const o = preset.controls ?? {};
    this.controls.minPolarAngle = o.minPolarAngle ?? this.DEFAULT_CONTROLS_LIMITS.minPolarAngle;
    this.controls.maxPolarAngle = o.maxPolarAngle ?? this.DEFAULT_CONTROLS_LIMITS.maxPolarAngle;
    this.controls.minDistance = o.minDistance ?? this.DEFAULT_CONTROLS_LIMITS.minDistance;
    this.controls.maxDistance = o.maxDistance ?? this.DEFAULT_CONTROLS_LIMITS.maxDistance;
    this.controls.autoRotateSpeed = o.autoRotateSpeed ?? this.DEFAULT_CONTROLS_LIMITS.autoRotateSpeed;
  }

  private applyBloomForRoute(preset: { bloom: boolean; bloomParams?: Partial<{ strength: number; radius: number; threshold: number }> }): void {
    this.bloomEnabled = !!preset.bloom;
    if (this.bloomEnabled) {
      this.ensureBloomComposer();
      if (this.bloomPass && preset.bloomParams) {
        const p = preset.bloomParams;
        if (typeof p.strength === 'number') this.bloomPass.strength = p.strength;
        if (typeof p.radius === 'number') this.bloomPass.radius = p.radius;
        if (typeof p.threshold === 'number') this.bloomPass.threshold = p.threshold;
      }
    }
  }

  private applyUfoParticlesForRoute(
    preset: { ufoParticles: boolean; ufoParticleParams?: Partial<{ opacity: number; size: number; color: number; density: number }> }
  ): void {
    this.ufoParticlesDesired = !!preset.ufoParticles;
    this.ufoParticleParamsDesired = preset.ufoParticleParams ?? {};
    // Apply material changes immediately if points already exist.
    if (this.ufoPointsMaterial) {
      if (typeof this.ufoParticleParamsDesired.opacity === 'number') this.ufoPointsMaterial.opacity = this.ufoParticleParamsDesired.opacity;
      if (typeof this.ufoParticleParamsDesired.size === 'number') this.ufoPointsMaterial.size = this.ufoParticleParamsDesired.size;
      if (typeof this.ufoParticleParamsDesired.color === 'number') this.ufoPointsMaterial.color.setHex(this.ufoParticleParamsDesired.color);
      this.ufoPointsMaterial.needsUpdate = true;
    }
    // Apply density changes immediately if points already exist.
    if (this.ufoPoints && this.ufoPointsAllPositions) {
      this.applyUfoParticleDensity(this.ufoParticleParamsDesired.density ?? 0.5);
    }
    this.updateUfoRenderMode();
  }

  private updateUfoRenderMode(): void {
    if (!this.ufoModel || !this.ufoPoints) return;
    this.ufoModel.visible = !this.ufoParticlesDesired;
    this.ufoPoints.visible = this.ufoParticlesDesired;
  }

  private applyCowSpawnerForRoute(preset: { cowSpawner: boolean }): void {
    const next = !!preset.cowSpawner;
    // If we are re-enabling, restart the schedule so it's predictable.
    if (next && !this.cowSpawnerActive) {
      this.cowNextSpawnTime = this.clock.elapsedTime + this.firstCowTime;
    }
    // If we are disabling, delete any cows already spawned so the route state is clean.
    if (!next && this.cowSpawnerActive) {
      // Cancel any active tug so we don't keep referencing deleted indices.
      this.tuggingCowIndex = null;
      this.tugPointerId = null;

      for (const c of this.cows) {
        c.action?.stop();
        c.mixer?.uncacheRoot(c.model);
        this.scene?.remove(c.wrapper);
      }
      this.cows = [];
      this.cowNextSpawnTime = null;
    }
    this.cowSpawnerActive = next;
  }

  private ensureBloomComposer(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    if (this.composer && this.bloomPass) return;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const size = new THREE.Vector2();
    this.renderer.getSize(size);

    // Bloom defaults (tweak to taste).
    this.bloomPass = new UnrealBloomPass(size, 0.9, 0.7, 0.12);
    this.composer.addPass(this.bloomPass);
  }

  private disposeComposer(): void {
    // EffectComposer doesn't expose a stable public dispose() across all versions.
    // Safely dispose internal render targets if present.
    const c = this.composer as any;
    try {
      c?.renderTarget1?.dispose?.();
      c?.renderTarget2?.dispose?.();
    } catch {
      // ignore
    }
    this.bloomPass = null;
    this.composer = null;
  }

  private updateRouteCamera(dt: number): boolean {
    if (!this.routeCamActive) return false;

    this.routeCamElapsedSec += dt;
    const t = THREE.MathUtils.clamp(this.routeCamElapsedSec / this.routeCamDurationSec, 0, 1);
    const e = this.easeInOutQuint(t);

    const pos = new THREE.Vector3().lerpVectors(this.routeCamFromPos, this.routeCamToPos, e);
    const target = new THREE.Vector3().lerpVectors(this.routeCamFromTarget, this.routeCamToTarget, e);
    const frameShiftX = THREE.MathUtils.lerp(this.routeCamFromFrameShiftX, this.routeCamToFrameShiftX, e);

    this.camera.position.copy(pos);
    if (this.controls) this.controls.target.copy(target);
    this.camera.lookAt(target);
    this.applyFrameShiftX(frameShiftX);

    if (t >= 1) {
      this.routeCamActive = false;
      this.cameraHeightTarget = this.cameraHeightEnabled ? this.camera.position.y : null;
      this.setAutoRotateEnabled(this.routeCamAutoRotateAfter);
    }

    return true;
  }

  private getCurrentFrameShiftX(): number {
    // filmOffset is in mm; convert it back into our normalized [-0.5..0.5] scale.
    // We intentionally map so positive shiftX means "content moves right".
    const filmWidth = this.camera?.getFilmWidth?.() ?? 0;
    if (!filmWidth) return 0;
    return -(this.camera.filmOffset ?? 0) / filmWidth;
  }

  private applyFrameShiftX(shiftX: number): void {
    if (!this.camera) return;
    const filmWidth = this.camera.getFilmWidth();
    // Convention: positive shiftX pushes the content to the right.
    this.camera.filmOffset = -shiftX * filmWidth;
    this.camera.updateProjectionMatrix();
  }

  private initScene(): void {
    requestAnimationFrame(() => {this.onResize()}); // ensure the container is ready
    const container = this.elRef.nativeElement.querySelector('.sphere-container') as HTMLElement;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      (width || window.innerWidth) / (height || window.innerHeight),
      0.1,
      1000
    );
    this.camera.position.set(2, 0.5, 5);
    this.cameraHeightTarget = this.camera.position.y;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width || window.innerWidth, height || window.innerHeight);

    container.appendChild(this.renderer.domElement);
  }

  private loadModel(): void {
    const loader = new GLTFLoader(this.loadingService.getManager());
    // UFO
    loader.load(
      'assets/models/ufo/scene.gltf',
      (gltf) => {
        const model = gltf.scene;
        // Wrap the UFO so we can swap render modes (mesh vs particles) while keeping
        // a single animated transform target.
        const wrapper = new THREE.Group();
        wrapper.add(model);

        const points = this.buildPointsFromObject(model, this.ufoParticleParamsDesired);
        points.visible = false;
        wrapper.add(points);

        this.ufo = wrapper;
        this.ufoModel = model;
        this.ufoPoints = points;
        this.updateUfoRenderMode();

        // Initialize pose to first checkpoint and start the flight.
        this.applyCheckpointPose(wrapper, this.checkpoints[0]);
        this.flightStartTime = this.animateUfo ? this.clock.elapsedTime : null;
        if (this.flightStartTime !== null) this.setAutoRotateEnabled(false);

        this.scene.add(wrapper);
      },
      undefined,
      (error) => console.error('Error loading UFO model', error)
    );

    // Cow
    loader.load(
      'assets/models/cow/scene.gltf',
      (gltf) => {
        this.cowTemplate = gltf.scene;
        this.cowClips = gltf.animations ?? [];

        // Debug: list clips once
        // eslint-disable-next-line no-console
        console.log(
          '[cow] animations:',
          this.cowClips.map((a, i) => ({ i, name: a.name, duration: a.duration, tracks: a.tracks.length }))
        );

        // Arm the spawner
        this.cowNextSpawnTime = this.firstCowTime;
      },
      undefined,
      (error) => console.error('Error loading cow model', error)
    );
  }

  private buildPointsFromObject(
    root: THREE.Object3D,
    params: Partial<{ opacity: number; size: number; color: number; density: number }> = {}
  ): THREE.Points {
    // Build a single Points cloud from mesh vertices in `root`, expressed in root-local space.
    root.updateWorldMatrix(true, true);
    const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const tmp = new THREE.Vector3();
    const mat = new THREE.Matrix4();

    // Cache a full list of vertex positions once; density will subsample from this.
    const all: number[] = [];

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const geom = (mesh as any).geometry as THREE.BufferGeometry | undefined;
      if (!mesh.isMesh || !geom) return;

      const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!posAttr) return;

      mesh.updateWorldMatrix(true, false);
      mat.multiplyMatrices(invRoot, mesh.matrixWorld); // root-local transform

      for (let i = 0; i < posAttr.count; i += 1) {
        tmp.fromBufferAttribute(posAttr, i).applyMatrix4(mat);
        all.push(tmp.x, tmp.y, tmp.z);
      }
    });

    const geometry = new THREE.BufferGeometry();
    this.ufoPointsAllPositions = new Float32Array(all);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));

    const material = new THREE.PointsMaterial({
      color: params.color ?? 0x66baff,
      size: params.size ?? 0.024,
      sizeAttenuation: true,
      transparent: true,
      opacity: params.opacity ?? 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.ufoPointsMaterial = material;
    const points = new THREE.Points(geometry, material);
    this.ufoPoints = points;
    this.applyUfoParticleDensity(params.density ?? 0.5);
    return points;
  }

  private applyUfoParticleDensity(density: number): void {
    if (!this.ufoPoints || !this.ufoPointsAllPositions) return;
    const d = THREE.MathUtils.clamp(density, 0, 1);

    // Map density [0..1] -> stride [MAX_STRIDE..1]
    const MAX_STRIDE = 20;
    const stride = Math.max(1, Math.round(THREE.MathUtils.lerp(MAX_STRIDE, 1, d)));

    const src = this.ufoPointsAllPositions;
    const out: number[] = [];
    // src is xyzxyz..., so step by stride vertices => stride*3 floats
    const step = stride * 3;
    for (let i = 0; i < src.length; i += step) {
      out.push(src[i], src[i + 1], src[i + 2]);
    }
    // Always keep at least one point
    if (out.length === 0 && src.length >= 3) out.push(src[0], src[1], src[2]);

    const geom = this.ufoPoints.geometry as THREE.BufferGeometry;
    geom.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    geom.computeBoundingSphere();
  }

  private spawnCow(now: number): void {
    if (!this.cowTemplate) return;
    if (this.cows.length >= this.cowMaxActive) return;

    const cowModel = skeletonClone(this.cowTemplate) as THREE.Object3D;

    const wrapper = new THREE.Group();
    wrapper.position.copy(this.cowStartPos);
    wrapper.scale.setScalar(0.0015);

    const startQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      'XYZ'
    ));
    const endQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      'XYZ'
    ));
    wrapper.quaternion.copy(startQuat);

    // Keep model local transform neutral
    cowModel.position.set(0, 0, 0);
    cowModel.rotation.set(0, 0, 0);
    cowModel.scale.setScalar(1);
    wrapper.add(cowModel);

    let mixer: THREE.AnimationMixer | null = null;
    let action: THREE.AnimationAction | null = null;
    if (this.cowClips.length > 0) {
      const clip = this.cowClips[this.cowAnimIndex] ?? this.cowClips[0];
      mixer = new THREE.AnimationMixer(cowModel);
      action = mixer.clipAction(clip);
      action.reset();
      action.enabled = true;
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(this.cowAnimSpeed);
      action.play();
    }

    this.cows.push({
      wrapper,
      model: cowModel,
      spawnTime: now,
      startQuat,
      endQuat,
      tugOffset: new THREE.Vector3(),
      tugVel: new THREE.Vector3(),
      tugTarget: new THREE.Vector3(),
      mixer,
      action,
    });
    this.scene.add(wrapper);
  }

  private setPointerNdcFromEvent(ev: PointerEvent): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    this.pointerNdc.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -(((ev.clientY - rect.top) / rect.height) * 2 - 1)
    );
    return true;
  }

  private pickCowIndex(ev: PointerEvent): number | null {
    if (!this.cows.length) return null;
    if (!this.setPointerNdcFromEvent(ev)) return null;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    let bestIdx: number | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < this.cows.length; i++) {
      const hits = this.raycaster.intersectObject(this.cows[i].model, true);
      if (hits.length && hits[0].distance < bestDist) {
        bestDist = hits[0].distance;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private onPointerDown(ev: PointerEvent): void {
    if (this.cowSensitivity <= 0) return;
    const idx = this.pickCowIndex(ev);
    if (idx === null) return;

    ev.preventDefault();
    ev.stopPropagation();

    this.tuggingCowIndex = idx;
    this.tugPointerId = ev.pointerId;
    this.tugStartClientX = ev.clientX;
    this.tugStartClientY = ev.clientY;
    this.tugStartOffset.copy(this.cows[idx].tugOffset);

    try {
      this.renderer.domElement.setPointerCapture(ev.pointerId);
    } catch {
      // ignore
    }
  }

  private onPointerMove(ev: PointerEvent): void {
    this.updateCameraHeightTargetFromPointer(ev);

    if (this.tuggingCowIndex === null) return;
    if (this.tugPointerId !== ev.pointerId) return;
    if (this.cowSensitivity <= 0) return;

    ev.preventDefault();
    ev.stopPropagation();

    const c = this.cows[this.tuggingCowIndex];
    const dxPx = ev.clientX - this.tugStartClientX;
    const dyPx = ev.clientY - this.tugStartClientY;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const dist = this.camera.position.distanceTo(c.wrapper.position);
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const visibleH = 2 * Math.tan(vFov / 2) * dist;
    const visibleW = visibleH * this.camera.aspect;

    const worldPerPxX = visibleW / Math.max(1, rect.width);
    const worldPerPxY = visibleH / Math.max(1, rect.height);

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

    const desired = this.tugStartOffset.clone()
      .addScaledVector(right, dxPx * worldPerPxX)
      .addScaledVector(up, -dyPx * worldPerPxY);

    const max = this.cowMaxTugWorld * THREE.MathUtils.clamp(this.cowSensitivity, 0, 1);
    if (desired.length() > max) desired.setLength(max);

    c.tugTarget.copy(desired);
  }

  private onGlobalPointerMove(ev: PointerEvent): void {
    // No preventDefault/stopPropagation here; we just sample pointer position.

    this.updateCameraHeightTargetFromPointer(ev);
  }

  private onPointerUp(ev: PointerEvent): void {
    if (this.tuggingCowIndex === null) return;
    if (this.tugPointerId !== ev.pointerId) return;

    ev.preventDefault();
    ev.stopPropagation();

    const idx = this.tuggingCowIndex;
    if (this.cows[idx]) this.cows[idx].tugTarget.set(0, 0, 0);

    this.tuggingCowIndex = null;
    this.tugPointerId = null;

    try {
      this.renderer.domElement.releasePointerCapture(ev.pointerId);
    } catch {
      // ignore
    }
  }

  private addLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 5));

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0xaaaaaa, 0x444444);
    hemisphereLight.position.set(0, 20, 0);
    this.scene.add(hemisphereLight);
  }

  private addOrbitControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = this.DEFAULT_CONTROLS_LIMITS.autoRotateSpeed;
    // Disable ALL user interaction (orbit/pan/zoom) for Sphere.
    // We still keep OrbitControls around so `autoRotate` can run via `controls.update()`.
    this.controls.enableRotate = false;
    // Disable scroll/pinch zoom (dolly) entirely
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    // Limit vertical orbit (polar angle) so the camera can't go too far above/below the UFO.
    this.controls.minPolarAngle = this.DEFAULT_CONTROLS_LIMITS.minPolarAngle;
    this.controls.maxPolarAngle = this.DEFAULT_CONTROLS_LIMITS.maxPolarAngle;
    this.controls.minDistance = this.DEFAULT_CONTROLS_LIMITS.minDistance;
    this.controls.maxDistance = this.DEFAULT_CONTROLS_LIMITS.maxDistance;
  }

  private setAutoRotateEnabled(enabled: boolean): void {
    if (!this.controls) return;
    this.controls.autoRotate = enabled;
  }

  private updateCameraHeightTargetFromPointer(ev: PointerEvent): void {
    if (!this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.height <= 0) return;

    const t = THREE.MathUtils.clamp(1 - ((ev.clientY - rect.top) / rect.height), 0, 1); // top=1
    const min = Math.min(this.minCameraHeight, this.maxCameraHeight);
    const max = Math.max(this.minCameraHeight, this.maxCameraHeight);
    this.cameraHeightTarget = THREE.MathUtils.lerp(min, max, t);
  }

  private updateCameraHeight(dt: number): void {
    if (!this.cameraHeightEnabled) return;
    if (this.cameraHeightTarget === null) return;
    // Smooth exponential-ish follow
    const alpha = 1 - Math.exp(-this.cameraHeightFollowSpeed * dt);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.cameraHeightTarget, alpha);
  }

  private updateCameraBob(now: number): void {
    if (!this.cameraBobEnabled) return;

    const w = 2 * Math.PI * this.cameraBobHz;
    // Slightly different phases so it feels organic.
    const x = Math.sin(w * now) * this.cameraBobAmpX;
    const y = Math.sin(w * now + 1.4) * this.cameraBobAmpY;
    const z = Math.cos(w * now + 0.7) * this.cameraBobAmpZ;

    const next = new THREE.Vector3(x, y, z);

    // Avoid a one-frame "jump" when bob resumes after orbit/return.
    if (!this.cameraBobActiveLastFrame) {
      this.cameraBobPrev.copy(next);
      this.cameraBobActiveLastFrame = true;
      return;
    }

    const delta = next.clone().sub(this.cameraBobPrev);
    this.camera.position.add(delta);
    this.cameraBobPrev.copy(next);
    this.cameraBobActiveLastFrame = true;
  }

  private easeInCubic(t: number): number {
    return t * t * t;
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Quintic ease-in-out ("smootherstep"): very obvious slow-in + slow-out.
   * This matches the mental model of "speed up to midpoint, slow down after".
   */
  private easeInOutQuint(t: number): number {
    // 6t^5 - 15t^4 + 10t^3
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private easeLinear(t: number): number {
    return t;
  }

  private easeByMode(t: number, mode: AccelerationMode): number {
    if (mode === 'up') return this.easeInCubic(t);
    if (mode === 'down') return this.easeOutCubic(t);
    if (mode === 'arc') return this.easeInOutQuint(t);
    return this.easeLinear(t);
  }

  private applyCheckpointPose(
    obj: THREE.Object3D,
    cp: { position: [number, number, number]; angle: [number, number, number]; scale: number }
  ): void {
    obj.position.set(cp.position[0], cp.position[1], cp.position[2]);
    obj.rotation.set(cp.angle[0], cp.angle[1], cp.angle[2]);
    obj.scale.setScalar(cp.scale);
  }

  private updateFlightAnimation(elapsedSec: number): boolean {
    if (!this.ufo) return false;
    if (!this.checkpoints.length || this.checkpoints[0].time !== 0) return false;
    if (this.checkpoints.length < 2) return false;

    const last = this.checkpoints[this.checkpoints.length - 1];
    if (elapsedSec >= last.time) {
      this.applyCheckpointPose(this.ufo, last);
      return false;
    }

    // Find the current segment [a -> b] where a.time <= elapsed < b.time
    let idx = 0;
    for (let i = 0; i < this.checkpoints.length - 1; i++) {
      const a = this.checkpoints[i];
      const b = this.checkpoints[i + 1];
      if (elapsedSec >= a.time && elapsedSec < b.time) {
        idx = i;
        break;
      }
    }

    const a = this.checkpoints[idx];
    const b = this.checkpoints[idx + 1];
    const segDuration = Math.max(0.0001, b.time - a.time);
    const rawT = (elapsedSec - a.time) / segDuration;
    const t = Math.min(Math.max(rawT, 0), 1);
    const e = this.easeByMode(t, b.acceleration);

    // Position lerp
    const fromPos = new THREE.Vector3(a.position[0], a.position[1], a.position[2]);
    const toPos = new THREE.Vector3(b.position[0], b.position[1], b.position[2]);
    this.ufo.position.lerpVectors(fromPos, toPos, e);

    // Scale lerp
    const s = THREE.MathUtils.lerp(a.scale, b.scale, e);
    this.ufo.scale.setScalar(s);

    // Angle lerp (use quaternions to avoid weird wrap issues)
    const qa = new THREE.Quaternion().setFromEuler(new THREE.Euler(a.angle[0], a.angle[1], a.angle[2]));
    const qb = new THREE.Quaternion().setFromEuler(new THREE.Euler(b.angle[0], b.angle[1], b.angle[2]));
    this.ufo.quaternion.copy(qa).slerp(qb, e);

    if (elapsedSec >= last.time - this.resumeAutoRotateDuringIntoSecondsBefore) {
      this.setAutoRotateEnabled(true);
    }
    return true;
  }

  private animate = (): void => {
    this.frameId = window.requestAnimationFrame(this.animate);
    // IMPORTANT: getElapsedTime() internally calls getDelta(), so calling both will make dt ~0.
    // Use getDelta() once per frame, and read clock.elapsedTime for "now".
    const dt = this.clock.getDelta();
    const now = this.clock.elapsedTime;

    if (this.flightStartTime !== null) {
      const elapsed = now - this.flightStartTime;
      const active = this.updateFlightAnimation(elapsed);
      if (!active) {
        this.flightStartTime = null;
        this.setAutoRotateEnabled(true);
      }
    }

    // Spawn cows on a randomized interval
    if (this.cowSpawnerActive) {
      if (this.cowTemplate && this.cowNextSpawnTime !== null && now >= this.cowNextSpawnTime) {
        this.spawnCow(now);
        const min = Math.max(0.1, this.cowSpawnIntervalMinSec);
        const max = Math.max(min, this.cowSpawnIntervalMaxSec);
        this.cowNextSpawnTime = now + THREE.MathUtils.randFloat(min, max);
      }
    };

    // Update cows: rise + rotate + clip (+ tug). Destroy when reaching end position.
    if (this.cows.length) {
      const dead: number[] = [];
      for (let i = 0; i < this.cows.length; i++) {
        const c = this.cows[i];
        const rawT = (now - c.spawnTime) / this.cowRiseDurationSec;
        const t = THREE.MathUtils.clamp(rawT, 0, 1);
        const e = this.easeOutCubic(t);

        const basePos = new THREE.Vector3().lerpVectors(this.cowStartPos, this.cowEndPos, e);

        // Tug spring: cowSensitivity controls stiffness.
        const k = THREE.MathUtils.lerp(0, 55, THREE.MathUtils.clamp(this.cowSensitivity, 0, 1));
        const cDamp = 2 * Math.sqrt(k) * 0.95;
        const dx = c.tugOffset.x - c.tugTarget.x;
        const dy = c.tugOffset.y - c.tugTarget.y;
        const dz = c.tugOffset.z - c.tugTarget.z;
        const ax = -k * dx - cDamp * c.tugVel.x;
        const ay = -k * dy - cDamp * c.tugVel.y;
        const az = -k * dz - cDamp * c.tugVel.z;
        c.tugVel.x += ax * dt;
        c.tugVel.y += ay * dt;
        c.tugVel.z += az * dt;
        c.tugOffset.x += c.tugVel.x * dt;
        c.tugOffset.y += c.tugVel.y * dt;
        c.tugOffset.z += c.tugVel.z * dt;

        c.wrapper.position.copy(basePos).add(c.tugOffset);
        c.wrapper.quaternion.copy(c.startQuat).slerp(c.endQuat, e);

        if (c.action && !c.action.isRunning()) c.action.reset().play();
        c.mixer?.update(dt);

        if (rawT >= 1) dead.push(i);
      }

      for (let k = dead.length - 1; k >= 0; k--) {
        const idx = dead[k];
        if (this.tuggingCowIndex === idx) {
          this.tuggingCowIndex = null;
          this.tugPointerId = null;
        }
        const c = this.cows[idx];
        c.action?.stop();
        c.mixer?.uncacheRoot(c.model);
        this.scene.remove(c.wrapper);
        this.cows.splice(idx, 1);
      }
    }

    // Let OrbitControls apply damping, then add bob on top so it doesn't fight controls.
    const routeMoving = this.updateRouteCamera(dt);
    if (!routeMoving) {
      // IMPORTANT:
      // OrbitControls.update() clamps the camera to min/max polar angles, distance, etc.
      // If a route preset sets a camera pose outside those constraints (e.g. directly above),
      // calling update() will "snap" the camera to the nearest allowed pose.
      //
      // We only need OrbitControls when auto-rotate is enabled.
      if (this.controls?.autoRotate) this.controls.update();
      this.updateCameraHeight(dt);
      this.updateCameraBob(now);
    }
    if (this.bloomEnabled) {
      this.ensureBloomComposer();
      this.composer?.render();
    } else {
      this.renderer?.render(this.scene, this.camera);
    }
  };

  private onResize(): void {
    if (!this.renderer || !this.camera) return;

    const container = this.elRef.nativeElement.querySelector('.sphere-container') as HTMLElement;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();
    const w = width || window.innerWidth;
    const h = height || window.innerHeight;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;

    this.routeSub?.unsubscribe();
    this.routeSub = null;

    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('pointermove', this.globalPointerMoveHandler);

    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    this.controls?.dispose();
    this.disposeComposer();

    // Dispose UFO particle resources if created.
    if (this.ufoPoints) {
      this.ufoPoints.geometry?.dispose?.();
      const mat = this.ufoPoints.material as any;
      mat?.dispose?.();
      this.ufoPoints = null;
    }
    this.ufoPointsMaterial = null;
    this.ufoPointsAllPositions = null;
    this.ufoModel = null;
    this.ufo = null;

    // Dispose renderer + remove canvas
    if (this.renderer) {
      const el = this.renderer.domElement;
      el.removeEventListener('pointerdown', this.pointerDownHandler, true);
      el.removeEventListener('pointermove', this.pointerMoveHandler, true);
      el.removeEventListener('pointerup', this.pointerUpHandler, true);
      el.removeEventListener('pointercancel', this.pointerUpHandler, true);
      this.renderer.dispose();
      const canvas = this.renderer.domElement;
      canvas?.parentElement?.removeChild(canvas);
    }

    // Remove any spawned cows
    for (const c of this.cows) {
      c.action?.stop();
      c.mixer?.uncacheRoot(c.model);
      this.scene?.remove(c.wrapper);
    }
    this.cows = [];

    // Optional: dispose scene resources (good habit if you add lots of meshes/textures)
    this.scene?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();

      const mat = (mesh as any).material;
      if (mat) {
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
        else mat.dispose?.();
      }
    });
  }
}
